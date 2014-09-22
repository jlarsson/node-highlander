(function (module) {
    "use strict";
    
    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        commandRegistry = require('./commandRegistry'),
        synchronizer = require('./synchronizer'),
        marshaller = require('./marshaller'),
        fileJournal = require('./filejournal'),
        memoryJournal = require('./memoryjournal');

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
            this.journal.replay()
                .on('command', function (entry) {
                    var ctx = this.createCommandContext(entry.c, entry.a, true);
                    var handler = this.getCommandHandler(ctx);
                    handler.validate(ctx);
                    handler.execute(ctx, _.noop);
                }.bind(this))
                .on('done', function () {
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
        this.enqueueReady(function () {
            this.synchronizer.readOperation(function (done) {
                var err, result;
                try {
                    var unsafeResult = query(this.model);
                    result = this.marshaller.marshal(unsafeResult);
                } catch (e) {
                    err = e;
                }
                done();
                cb(err, result);
            }.bind(this));
        }.bind(this));
        return this;
    };
    proto.execute = function (command, args, cb) {
        this.enqueueReady(function () {
            this.synchronizer.writeOperation(function (done) {
                var finCalled = false;
                var fin = function (err, result) {
                    if (!finCalled) {
                        finCalled = true;
                        done();
                        (cb || _.noop)(err, result);
                    }
                };

                try {
                    var ctx = this.createCommandContext(command, args, false);
                    var handler = this.getCommandHandler(ctx);
                    handler.validate(ctx);
                    this.journal.append(
                        ctx,
                        function (err) {
                            if (err) {
                                return fin(err, null);
                            }
                            var unsafeResult = handler.execute(ctx);
                            var result = this.marshaller.marshal(unsafeResult);
                            fin(null, result);
                        }.bind(this)
                    );
                } catch (e) {
                    fin(e, null);
                }
            }.bind(this));
        }.bind(this));
        return this;
    };

    module.exports = Klass;
})(module);