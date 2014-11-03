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
        .inherit(EventEmitter)
        .construct(function init(owner) {
            EventEmitter.call(this);
            this.owner = owner;
            this.ready = false;
            this.readyQ = [];
        })
        .getter('model', function model() {
            return this.owner.model;
        })
        .getter('commandRegistry', function commandRegistry() {
            return this.owner.commandRegistry;
        })
        .getter('synchronizer', function synchronizer() {
            return this.owner.synchronizer;
        })
        .getter('marshaller', function marshaller() {
            return this.owner.marshaller;
        })
        .getter('journal', function journal() {
            return this.owner.journal;
        })
        .method('createCommandContext', function createCommandContext(command, args) {
            return {
                model: this.model,
                command: command,
                args: args
            };
        })
        .method('enqueueReady', function enqueueReady(fn) {
            if (this.ready) {
                return fn(_.noop);
            }
            this.readyQ.push(fn);
            this.ensureRestore();
        })
        .method('ensureRestore', function ensureRestore() {
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

            function onReplayCommand(entry) {
                replay({
                    command: entry.c,
                    args: entry.a,
                    restoring: true
                });
            }

            function onReplayDone() {
                postRestore();
                popAndExecuteReadyQ();
            }

            function popAndExecuteReadyQ() {
                if (self.readyQ.length > 0) {
                    return (self.readyQ.shift())(
                        function () {
                            setImmediate(popAndExecuteReadyQ);
                        }
                    );
                }
                self.synchronizer.writeOperation(function (done) {
                    self.restoring = false;
                    self.ready = true;
                    done();
                });
            }

            function preRestore() {
                debug('journal restore started');
                replay({
                    command: '$prerestore',
                    args: null,
                    restoring: true
                });
            }

            function postRestore() {
                replay({
                    command: '$postrestore',
                    args: null,
                    restoring: true
                });
                debug('journal restore finished');
            }

            preRestore();
            self.journal.replay()
                .on('command', onReplayCommand)
                .on('done', onReplayDone);
        })
        .method('getCommandHandler', function getCommandHandler(ctx) {
            return this.commandRegistry.getCommandHandler(ctx);
        })
        .method('query', function query(opts) {
            var self = this;
            self.enqueueReady(function (next) {
                self.synchronizer.readOperation(function (done) {
                    safequery(opts.query).call(opts.query, self.model, wrapCallback(opts.cb, firstThen(done, next), self.marshaller));
                });
            });
            return this;
        })
        .method('execute', function execute(opts) {
            var self = this;
            self.enqueueReady(function (next) {
                self.synchronizer.writeOperation(function (done) {
                    return self.exec(opts, firstThen(done, next));
                });
            });
            return this;
        })
        .method('exec', function exec(opts, done) {
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
                setImmediate(function () {
                    self.emit(
                        opts.restoring ? 'restored' : 'executed', {
                            command: command,
                            args: args,
                            restoring: opts.restoring,
                            error: err
                        })
                });
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