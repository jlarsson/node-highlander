(function(module) {
  'use strict';
  var Promise = require('bluebird');
  var async = require('async');
  var _ = require('lodash');
  var debug = require('debug')('highlander');
  var rwlock = require('rwlock');
  var classBuilder = require('ryoc');

  var fs = require('fs');
  var fspath = require('path');
  var util = require('util');
  var assert = require('assert');
  var appendFileAsync = Promise.promisify(fs.appendFile);

  var using = Promise.using;
  var createResolved = function(value) {
    return Promise.resolve(value);
  }
  var createPromise = function(fn_resolve_reject) {
    return new Promise.Promise(fn_resolve_reject);
  };

  /*************************************************
    Repository is the main actor here.

    .model
      The in memory data
    .commands
      Mapping from commandname to handler
      Handlers have the form function (ctx)
    .register({name: string, execute: fn, validate: fn})
      register named command
      execute assumed to be function (context [,callback])
      validate assumed to be function (context [,callback])
      context is an object {model: <the model>, name: string, argument: any, replay: bool}

    .execute({name: string, argument: any})
      carries out action of named command
      write synhcronized (1 writer, 0 readers)
    .query(fn)
      evaluates fn(model)
      read synchronized (any readers, 0 writers)

  *************************************************/
  var Repository = (function RepositoryModule() {
    function exec(repo, command) {
      return repo.commands.lookup(command.name)
        .bind({
          repo: repo,
          command: command
        })
        .then(function exec_command(handler) {
          if (!handler) {
            throw CommandError('No handler found for %j. Please use Repository.register({name:...,execute:...,validate:...}) before.', command);
          }
          this.handler = handler;
          this.handlerContext = {
            model: this.repo.model,
            name: this.command.name,
            argument: this.command.argument,
            replay: this.command.replay,
            Promise: Promise
          };
        })
        .then(function exec_validate() {
          return this.handler.validate(this.handlerContext);
        })
        .then(function exec_log() {
          return this.command.replay ? null : this.repo.journal.log(this.command);
        })
        .then(function exec_execute() {
          debug('executing %j', this.command)
          return this.handler.execute(this.handlerContext);
        });
    }
    return classBuilder()
      .construct(function construct(options) {
        var opts = _.defaults({}, options, {
          model: {},
          commands: Commands(),
          marshaller: Marshaller(),
          lock: Lock(),
          journal: FileJournal((options || {}).path || './.highlander.journal')
        });
        this.model = opts.model;
        this.commands = opts.commands;
        this.marshaller = opts.marshaller;
        this.lock = opts.lock;
        this.journal = opts.journal;
      })
      .method('register', Promise.method(function register(command, callback) {
        return this.commands.register(command, callback);
      }))
      .method('initialize', Promise.method(function initialize(callback) {
        return this.__initialized ? true : this.lock.writeLock(function initialize_scope() {
              return this.__initialized ? true : exec(this, {
                  name: '$preinit',
                  argument: null,
                  replay: true
                })
                .bind(this)
                .then(function() {
                  return this.journal
                    .replay(function initialize_replay_command(entry) {
                      return exec(this, {
                        name: entry.name,
                        argument: entry.argument,
                        replay: true
                      });
                    }.bind(this));
                })
                .then(function() {
                  return exec(this, {
                    name: '$postinit',
                    argument: null,
                    replay: true
                  });
                })
                .then(function initialize_replay_done() {
                  debug('replay done')
                  this.__initialized = true;
                  return true;
                })
            }
            .bind(this),
            'initialize')
          .nodeify(callback);
      }))
      .method('query', function query(predicate, callback) {
        return this
          .initialize()
          .bind(this)
          .then(function query_run() {
            return this.lock.readLock(function query_scope() {
                var p = predicate;
                if (p.length === 2) {
                  // Node style: Function (ctx, callback)
                  p = Promise.promisify(p);
                }
                return p({
                  model: this.model,
                  promise: Promise
                });
              }
              .bind(this)
            )
          })
          .nodeify(callback);
      })
      .method('execute', function(command, callback) {
        verifyObject(command, 'Repository.execute(command) expects command like {name:[string],argument:...}');
        verifyString(command.name, 'Repository.execute(command) expects command like {name:[string],argument:...}');

        return this
          .initialize()
          .bind(this)
          .then(function execute_run() {
            return this.lock.writeLock(function execute_scope() {
              return exec(this, command)
                .bind(this)
                .then(function execute_marshal_result(result) {
                  return this.marshaller.marshal(result)
                })
                .then(function execute_done(result) {
                  debug('result:%j', result);
                  return result;
                });
            }
            .bind(this),
            command.name);
          })
          .nodeify(callback);
      })
      .toClass();
  })();

  /*****************************************************
  The purpose of marshalling is to create a deep copy
  of a value to avoid racing.
  Any data from inner model must be marshalled since
  its real state may be altered later by a command.
  *****************************************************/
  var Marshaller = (function MarshallerModule() {
    var skipTypes = {
      "undefined": true,
      "boolean": true,
      "number": true,
      "string": true
    };

    function marshalValue(value) {
      if (skipTypes[typeof(value)] || (value === null)) {
        return value;
      }
      return typeof(value.marshal) === 'function' ? value.marshal() : JSON.parse(JSON.stringify(value));
    }

    return classBuilder()
      .method('marshal', Promise.method(function marshal(value, callback) {
        return createResolved(marshalValue(value)).nodeify(callback);
      }))
      .toClass();
  })();

  /*******************************************************************************
    Commands is a registry over named actions on the model.
  *******************************************************************************/
  var Commands = (function CommandsModule() {
    return classBuilder()
      .construct(function construct() {
        this.handlers = {
          '$preinit': CommandHandler({
            name: '$preinit'
          }),
          '$postinit': CommandHandler({
            name: '$postinit'
          })
        };
      })
      .method('register', Promise.method(function setCommand(options, callback) {
        var command = CommandHandler(options);
        return createResolved(this.handlers[command.name] = command).nodeify(callback);
      }))
      .method('lookup', Promise.method(function getCommand(name, callback) {
        return createResolved(this.handlers[name]).nodeify(callback);
      }))
      .toClass();
  })();

  /*****************************************************
    Commands carries out operations on the model.
  *****************************************************/
  var CommandHandler = (function CommandModule() {

    function call(entry, command, methodName) {
      var f = command[methodName];
      if (!f) {
        return undefined;
      }
      if (f.length == 2) {
        // function (context, callback)
        f = Promise.promisify(f);
      }
      return f.call(command, {
        promise: Promise,
        model: entry.model,
        argument: entry.argument,
        replay: entry.replay || false
      });
    }
    return classBuilder()
      .construct(function construct(command) {
        verifyObject(command, 'Invalid command, expected {name:String,execute:Function,validate:Function}');
        verifyString(command.name, 'Invalid command, expected {name:String,execute:Function,validate:Function}');
        verifyOptionalFunction(command.execute, 'Invalid command, expected {name:String,execute:Function,validate:Function}');
        verifyOptionalFunction(command.validate, 'Invalid command, expected {name:String,execute:Function,validate:Function}');
        this.command = command;
      })
      .getter('name', function() {
        return this.command.name;
      })
      .method('execute', Promise.method(function execute(entry) {
        return call(entry, this.command, 'execute');
      }))
      .method('validate', Promise.method(function validate(entry) {
        return call(entry, this.command, 'validate');
      }))
      .toClass();
  })();

  /*****************************************************
    The Lock is a resource manager used to
    enforce Read/Write locks
  *****************************************************/
  var Lock = (function LockModule() {
    return classBuilder()
      .construct(function construct() {
        this.rwlock = new rwlock();
      })
      .method('readLock', function(fn, debugHint) {
        return using(this.getReadLock(debugHint), Promise.method(fn));
      })
      .method('writeLock', function(fn, debugHint) {
        return using(this.getWriteLock(debugHint), Promise.method(fn));
      })
      .method('getReadLock', function getReadLock(debugHint) {
        var self = this;
        return createPromise(function getReadLock_promise(resolve, reject) {
            self.rwlock.readLock(function getReadLock_acquired(done) {
              debug('+rlock %s', debugHint || '');
              resolve(done);
            });
          })
          .disposer(function getReadLock_release(done) {
            debug('-rlock %s', debugHint || '');
            done();
          });
      })
      .method('getWriteLock', function getWriteLock(debugHint) {
        var self = this;
        return createPromise(function getWriteLock_promise(resolve, reject) {
            self.rwlock.writeLock(function getWriteLock_acquired(done) {
              debug('+wlock %s', debugHint || '');
              resolve(done);
            });
          })
          .disposer(function getWriteLock_release(done) {
            debug('-wlock %s', debugHint || '');
            done();
          });
      })
      .toClass();
  })();


  /*****************************************************
    A file journal is flat file holding the history of
    all commands executed.

    When a repository comes to life, its full history
    is replayed, thus restoring its state in memory.

    All commands executed on a repository are logged
    to a journal before they are taken out on the
    repository model.
  *****************************************************/
  var FileJournal = (function() {
    // Verify that text line from journal is good
    // before handling it
    function replayValidate(replayHandler, line) {
      line = line.trim();
      if (line.indexOf('{') === 0) {
        // assume json
        var entry = JSON.parse(line);
        return replayHandler({
          name: entry.n,
          argument: entry.a
        });
      }
      if (line === '') {
        // assume some human had good cause to add a blank line
        // in the journal
        return;
      }
      if (line[0] === '#') {
        // yes, lines can be commented out with #
        return;
      }
      throw new Error(util.format('Invalid journal file (%s).\n-> %s', this.path, line));
    }

    return classBuilder()
      .construct(function construct(path) {
        this.path = fspath.resolve(path);
      })
      .method('log', Promise.method(function log(command, callback) {
        var entry = JSON.stringify({
          t: new Date(),
          n: command.name,
          a: command.argument
        });
        debug('journal.log(%s)', entry);
        return appendFileAsync(this.path,
            entry + '\n', {
              encoding: 'utf-8'
            }
          )
          .nodeify(callback);
      }))
      .method('replay', Promise.method(function replay(replayHandler) {
        return readLines(this.path, replayValidate.bind(this, replayHandler));
      }))
      .toClass();
  })();







  /*********************************************************
    This creature os overly complicated and should perhaps
    be more understandable with coroutines/generators/Rx.

    The general flow is
      open file
      while !oef
        fill buffer
        extract lines from buffer

        for every unprocessed line
          wait for line processing

    The implementation uses a mix of async/promise
  *********************************************************/
  function readLines(path, handler) {
    return createPromise(function(resolve, reject) {
      fs.open(path, 'r', function(err, fd) {
        if (err) {
          // Error opening file
          if (err.code === 'ENOENT') {
            return resolve();
          }
          return reject(err);
        }

        var eof = false;

        // We read one buffer at the time and this might not be a full line
        // Such buffers must be prepended to the next to for a full line
        var incompleteBuffer = null;

        // Array of unprocessed buffers forming complete lines
        var pendingBuffers = [];

        // Read position in file
        var fileOffset = 0;

        // process the file
        async.whilst(
          continueReading,
          readNext,
          doneReading
        );

        function processPendingBuffers(callback) {
          return Promise.each(pendingBuffers, function(buffer) {
              var line = buffer.toString('utf8');
              return handler(line);
            })
            .then(function() {
              pendingBuffers = [];
            });
        }

        // Continue while not end of file
        function continueReading() {
          return !eof;
        }

        // read next buffer, analyze line contents and emit found lines
        function readNext(callback) {
          var buflen = 1024 * 4;
          var buf = Buffer(buflen);

          fs.read(fd, buf, 0, buflen, fileOffset, function(err, bytesRead, data) {
            if (err) {
              return callback(err);
            }

            if (0 === bytesRead) {
              eof = true;
              return callback();
            }

            fileOffset += bytesRead;

            // Find end of line
            var ofs = 0;
            for (var i = 0; i < bytesRead; ++i) {
              if (buf.readUInt8(i) === 10 /* '\n' */ ) {
                var lineBuffer = buf.slice(ofs, i);
                pendingBuffers.push(incompleteBuffer ? Buffer.concat([incompleteBuffer, lineBuffer]) : lineBuffer);
                incompleteBuffer = null;
                ofs = i + 1;
              }
            }
            if (ofs < bytesRead) {
              var rest = (ofs === 0) && (bytesRead === buflen) ? buf : buf.slice(ofs, bytesRead);
              incompleteBuffer = incompleteBuffer ? Buffer.concat([incompleteBuffer, rest]) : rest;
            }
            processPendingBuffers()
              .then(callback)
              .catch(callback);
          });
        }

        // Close file and emit pending lines
        function doneReading(err) {
          fs.close(fd);
          if (err) {
            return reject(err);
          }
          if (incompleteBuffer != null) {
            pendingBuffers.push(incompleteBuffer);
          }
          processPendingBuffers()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }




  function verifyObject(obj, message) {
    assert(_.isObject(obj), message);
  }

  function verifyString(s, message) {
    assert(_.isString(s), message);
  }

  function verifyOptionalFunction(f, message) {
    assert(_.isUndefined(f) || _.isFunction(f), message);
  }

  var args2array = function(args) {
    return Array.prototype.slice.call(args, 0);
  }

  var BaseError = classBuilder()
    .inherit(Error)
    .construct(function(message) {
      Error.call(this);
      this.message = message;
    })
    .toClass();
  var CommandError = classBuilder()
    .inherit(BaseError)
    .construct(function() {
      BaseError.call(this, util.format.apply(null, args2array(arguments)))
    })
    .toClass();


  module.exports = function(options) {
    return Repository(options);
  };
  //module.exports.Command = Command;
  module.exports.Commands = Commands;
  module.exports.FileJournal = FileJournal;
  module.exports.Lock = Lock;
  module.exports.Marshaller = Marshaller;
  module.exports.Repository = Repository;

  module.exports.Error = BaseError;

  module.exports.Promise = Promise;

})(module);
