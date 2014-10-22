(function (module) {
    "use strict";

    var EventEmitter = require('events').EventEmitter;
    var _ = require('lodash');
    var util = require('util');
    var debug = require('debug')('highlander');
    var commandRegistry = require('./commandRegistry');
    var synchronizer = require('./synchronizer');
    var marshaller = require('./marshaller');
    var fileJournal = require('./filejournal');
    var memoryJournal = require('./memoryjournal');
    var safequery = require('./safequery');
    var classBuilder = require('ryoc');

    function firstThen(first, second) {
        return function () {
            (first || _.noop)();
            (second || _.noop)();
        };
    }

    function wrapCallback(userCallback, syncCallback, marshaller) {
        var called = false;
        return function wrappedCallback(err, result) {
            if (!called) {
                var safeResult = err ? null : marshaller.marshal(result);
                syncCallback();
                (userCallback || _.noop)(err, safeResult);
            }
        }
    };

    var Klass = classBuilder()
        .construct(function (owner) {
            this.owner = owner;
            this.ready = false;
            this.readyQ = [];
        })
        .getter('model', function () {
            return this.owner.model;
        })
        .getter('commandRegistry', function () {
            return this.owner.commandRegistry;
        })
        .getter('synchronizer', function () {
            return this.owner.synchronizer;
        })
        .getter('marshaller', function () {
            return this.owner.marshaller;
        })
        .getter('journal', function () {
            return this.owner.journal;
        })
        .method('createCommandContext', function (command, args) {
            return {
                model: this.model,
                command: command,
                args: args
            };
        })
        .method('enqueueReady', function (fn) {
            if (this.ready) {
                return fn(_.noop);
            }
            this.readyQ.push(fn);
            this.ensureRestore();
        })
        .method('ensureRestore', function () {
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
        })
        .method('getCommandHandler', function (ctx) {
            return this.commandRegistry.getCommandHandler(ctx);
        })
        .method('query', function (opts) {
            var self = this;
            self.enqueueReady(function (next) {
                self.synchronizer.readOperation(function (done) {
                    safequery(opts.query).call(opts.query, self.model, wrapCallback(opts.cb, firstThen(done, next), self.marshaller));
                });
            });
            return this;
        })
        .method('execute', function (opts) {
            var self = this;
            self.enqueueReady(function (next) {
                self.synchronizer.writeOperation(function (done) {
                    return self.exec(opts, firstThen(done, next));
                });
            });
            return this;
        })
        .method('exec', function (opts, done) {
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
            handler.validate(ctx, function (err) {
                if (err) {
                    return fin(err, null);
                }
                if (opts.restoring) {
                    return handler.execute(ctx, fin);
                }
                self.journal.append(
                    ctx,
                    function (err) {
                        if (err) {
                            return fin(err, null);
                        }
                        return handler.execute(ctx, fin);
                    }
                );
            });
        })
        .toClass();

    module.exports = Klass;
})(module);