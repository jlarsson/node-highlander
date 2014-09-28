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
            nojournal: true
            }];

        function replayJournal() {
            self.journal.replay()
                .on('command', function (entry) {
                    debug('journal command:', entry);
                    restoreQ.push({
                        command: entry.c,
                        args: entry.a,
                        nojournal: true
                    });
                })
                .on('done', function () {
                    debug('journal done');
                    restoreQ.push({
                        command: '$postrestore',
                        args: null,
                        nojournal: true
                    });
                    processRestoreQ();
                });
        }

        function processRestoreQ() {
            setImmediate(function () {
                if (restoreQ.length == 0) {
                    return processReadyQ();
                }
                var cmd = restoreQ.shift();
                debug('restoring ', cmd);
                self.exec(cmd, processRestoreQ);
            });
        }

        function processReadyQ() {
            setImmediate(function () {
                if (self.readyQ.length == 0) {
                    self.restoring = false;
                    self.ready = true;
                    return;
                }
                var fn = self.readyQ.shift();
                fn(processReadyQ);
            });
        }

        replayJournal();
    }

    proto.getCommandHandler = function (ctx) {
        return this.commandRegistry.getCommandHandler(ctx);
    },
    proto.query = function (opts) {
        var self = this;
        self.enqueueReady(function (next) {
            self.synchronizer.readOperation(function (done) {
                opts.query(self.model, wrapCallback(opts.cb, firstThen(done, next), self.marshaller));
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

        handler.validate(ctx, function (err) {
            if (err) {
                return fin(err, null);
            }
            if (opts.nojournal) {
                return handler.execute(ctx, fin);
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