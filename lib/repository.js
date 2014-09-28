(function (module) {
    "use strict";
    
    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        util = require('util'),
        commandRegistry = require('./commandRegistry'),
        synchronizer = require('./synchronizer'),
        marshaller = require('./marshaller'),
        fileJournal = require('./filejournal'),
        memoryJournal = require('./memoryjournal'),
        debug = require('debug')('highlander');

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }

        var options = _.defaults({}, options, {
            model: {},
            commandRegistry: commandRegistry(),
            synchronizer: synchronizer(options),
            marshaller: marshaller(options),
            //journal: journal(options)
        });

        options.journal = options.journal || (options.fileJournal ? fileJournal(options.fileJournal) : memoryJournal());

        this.model = options.model;
        this.commandRegistry = options.commandRegistry;
        this.synchronizer = options.synchronizer;
        this.marshaller = options.marshaller;
        this.journal = options.journal;

        this.ready = false;
        this.readyQ = [];
    };

    function wrapCallback(userCallback, syncCallback, marshaller){
        var called = false;
        return function (err, result){
            if (!called) {
                var safeResult = err ? null : marshaller.marshal(result);
                syncCallback();
                (userCallback || _.noop)(err, safeResult);
            }
        }
    };
    
    var proto = Klass.prototype;

    proto.createCommandContext = function (command, args, replay) {
        return {
            model: this.model,
            command: command,
            args: args,
            replay: replay
        };
    };
    proto.enqueueReady = function (fn) {
        if (this.ready) {
            return fn();
        }
        this.readyQ.push(fn);

        if (!this.restoring) {
            this.restoring = true;
            
            debug('restoring journal');
            //this.execute('$prerestore');
            this.journal.replay()
                .on('command', function (entry) {
                    var ctx = this.createCommandContext(entry.c, entry.a, true);
                    var handler = this.getCommandHandler(ctx);
                    handler.validate(ctx);
                    handler.execute(ctx, _.noop);
                }.bind(this))
                .on('done', function () {
                    //this.execute('$postrestore');
                    debug('done restoring journal');
                    
                    for (var i = 0; i < this.readyQ.length; ++i) {
                        this.readyQ[i]();
                    }
                    this.readyQ = [];
                    this.restoring = false;
                    this.ready = true;
                }.bind(this));
        }
    }

    proto.registerCommand = function (name, handler) {
        this.commandRegistry.registerCommand(name, handler);
        return this;
    };
    proto.getCommandHandler = function (ctx) {
        return this.commandRegistry.getCommandHandler(ctx);
    },
    proto.query = function (query, cb) {
        var self = this;
        self.enqueueReady(function () {
            self.synchronizer.readOperation(function (done) {
                query(self.model, wrapCallback(cb, done, self.marshaller));
            });
        });
        return this;
    };
    proto.execute = function (command, args, cb) {
        var self = this;
        self.enqueueReady(function () {
            self.synchronizer.writeOperation(function (done) {
                debug('execute(\'%s\',%j)', command,args);
                var lcb = function (err, result){
                    if (err) {
                        debug('execute(\'%s\',%j) failed: %s', command,args, err);
                    }
                    (cb||_.noop)(err, result);
                };
                
                
                var fin = wrapCallback(lcb,done,self.marshaller);

                var ctx = self.createCommandContext(command, args, false);
                var handler = self.getCommandHandler(ctx);
                if (!handler){
                    return fin(new Error(util.format('No handler for command \'%s\' is registered', command)), null);
                }
                
                handler.validate(ctx, function (err){
                    if (err) {
                        return fin(err, null);
                    }
                    self.journal.append(
                        ctx,
                        function (err) {
                            if (err) {
                                return fin(err, null);
                            }
                            debug('appended');
                            handler.execute(ctx, fin);
                        }
                    );
                });
            });
        });
        return this;
    };

    module.exports = Klass;
})(module);