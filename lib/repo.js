(function (module) {
    "use strict";

    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        util = require('util'),
        debug = require('debug')('highlander'),
        commandRegistry = require('./commandRegistry'),
        synchronizer = require('./synchronizer'),
        marshaller = require('./marshaller'),
        fileJournal = require('./filejournal'),
        memoryJournal = require('./memoryjournal');


    var Klass = function (owner) {
        if (!(this instanceof Klass)) {
            return new Klass(owner);
        }

        this.owner = owner;
        this.ready = false;
        this.readyQ = [];
    };

    function firstThen(first, second) {
        return function () {
            (first || _.noop)();
            (second || _.noop)();
        };
    }

    function wrapCallback(userCallback, syncCallback, marshaller) {
        var called = false;
        return function (err, result) {
            if (!called) {
                var safeResult = err ? null : marshaller.marshal(result);
                syncCallback();
                (userCallback || _.noop)(err, safeResult);
            }
        }
    };

    function makeAsync(fn) {
        if (fn.length > 1) {
            return fn;
        }
        return function (arg1, callback) {
            var error;
            var result = null;
            try {
                result = arg1.call(this, arg1) || null;
            } catch (err) {
                error = err;
            }
            callback(error, result);
        }
    }

    var proto = Klass.prototype;
    Object.defineProperty(proto, 'model', {
        get: function () {
            return this.owner.model;
        }
    });
    Object.defineProperty(proto, 'commandRegistry', {
        get: function () {
            return this.owner.commandRegistry;
        }
    });
    Object.defineProperty(proto, 'synchronizer', {
        get: function () {
            return this.owner.synchronizer;
        }
    });
    Object.defineProperty(proto, 'marshaller', {
        get: function () {
            return this.owner.marshaller;
        }
    });
    Object.defineProperty(proto, 'journal', {
        get: function () {
            return this.owner.journal;
        }
    });

    proto.createCommandContext = function (command, args) {
        return {
            model: this.model,
            command: command,
            args: args
        };
    };
    proto.enqueueReady = function (fn) {
        if (this.ready) {
            return fn(_.noop);
        }
        this.readyQ.push(fn);
        this.ensureRestore();
    };

    proto.ensureRestore = function () {
        if (this.restoring) {
            return;
        }

        this.restoring = true;
        var self = this;

        var restoreQ = [{
            command: '$prerestore',
            args: null,
            restoring: true
            }];

        function replay(command) {
            self.synchronizer.writeOperation(function (done) {
                self.exec(command, function (err, result) {
                    // TODO: How do we handle errors during restore?
                    done();
                });
            });
        }
        replay({
            command: '$prerestore',
            args: null,
            restoring: true
        });

        self.journal.replay()
            .on('command', function (entry) {
                replay({
                    command: entry.c,
                    args: entry.a,
                    restoring: true
                });
            })
            .on('done', function () {
                debug('journal done');
                replay({
                    command: '$postrestore',
                    args: null,
                    restoring: true
                });
                while (self.readyQ.length > 0) {
                    (self.readyQ.shift())(_.noop);
                }
                self.synchronizer.writeOperation(function (done) {
                    self.restoring = false;
                    self.ready = true;
                    done();
                });
            });
    };

    proto.getCommandHandler = function (ctx) {
        return this.commandRegistry.getCommandHandler(ctx);
    },
    proto.query = function (opts) {
        var self = this;
        self.enqueueReady(function (next) {
            self.synchronizer.readOperation(function (done) {
                makeAsync(opts.query)(self.model, wrapCallback(opts.cb, firstThen(done, next), self.marshaller));
            });
        });
        return this;
    };
    proto.execute = function (opts) {
        var self = this;
        self.enqueueReady(function (next) {
            self.synchronizer.writeOperation(function (done) {
                return self.exec(opts, firstThen(done, next));
            });
        });
        return this;
    };
    proto.exec = function (opts, done) {
        var command = opts.command,
            args = opts.args,
            cb = opts.cb,
            self = this;

        debug('execute(\'%s\',%j)', command, args);
        var lcb = function (err, result) {
            if (err) {
                debug('execute(\'%s\',%j) failed: %s', command, args, err);
            }
            (cb || _.noop)(err, result);
        };


        var fin = wrapCallback(lcb, done, self.marshaller);

        var ctx = self.createCommandContext(command, args);
        var handler = self.getCommandHandler(ctx);
        if (!handler) {
            return fin(new Error(util.format('No handler for command \'%s\' is registered', command)), null);
        }

        ctx.restoring = opts.restoring;
        makeAsync(handler.validate).call(handler, ctx, function (err) {
            if (err) {
                return fin(err, null);
            }
            if (opts.restoring) {
                return makeAsync(handler.execute).call(handler, ctx, fin);
            }
            self.journal.append(
                ctx,
                function (err) {
                    if (err) {
                        return fin(err, null);
                    }
                    handler.execute(ctx, fin);
                }
            );
        });
    };

    module.exports = Klass;
})(module);