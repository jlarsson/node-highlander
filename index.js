(function (module) {
    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        synchronizer = require('./lib/synchronizer'),
        marshaller = require('./lib/marshaller'),
        journal = require('./lib/journal');

    var Klass = function (options) {

        var options = _.defaults({}, options, {
            model: {},
            synchronizer: synchronizer(),
            marshaller: marshaller(),
            journal: journal()
        });

        this.commands = {};
        this.model = options.model;
        this.synchronizer = options.synchronizer;
        this.marshaller = options.marshaller;
        this.journal = options.journal;

        this.ready = false;
        this.readyQ = [];

        var self = this;
    };


    var proto = Klass.prototype;

    proto.enqueueReady = function (fn) {
        if (this.ready) {
            fn();
            return;
        }
        this.readyQ.push(fn);

        if (!this.restoring) {
            this.restoring = true;
            var self = this;
            this.journal.replay(new EventEmitter()
                .on('command', function (command) {
                    var handler = self.getCommandHandler(command.command);
                    handler.execute(self.model, command.args);
                })
                .on('done', function () {
                    for (var i = 0; i < self.readyQ.length; ++i) {
                        self.readyQ[i]();
                    }
                    self.readyQ = [];
                    self.restoring = false;
                    self.ready = true;
                }));
        }
    }

    proto.registerCommand = function (name, handler) {
        var h;
        if (_.isFunction(handler)) {
            h = {
                validate: function () {},
                execute: handler
            }
        } else if (_.isObject(handler)) {
            h = _.defaults({}, handler, {
                validate: function () {},
                execute: function () {}
            });
        }
        if (h) {
            this.commands[name] = h;
        }
        return this;
    };
    proto.getCommandHandler = function (name) {
        return this.commands[name];
    },
    proto.query = function (query, cb) {
        var self = this;
        self.enqueueReady(function () {
            self.synchronizer.readOperation(function (done) {
                var err, result;
                try {
                    var unsafeResult = query(self.model);
                    result = self.marshaller.marshal(unsafeResult);
                } catch (e) {
                    err = e;
                }
                done();
                cb(err, result);
            });
        });
    };
    proto.execute = function (command, args, cb) {
        var self = this;

        self.enqueueReady(function () {
            self.synchronizer.writeOperation(function (done) {
                var finCalled = false;
                var fin = function (err, result) {
                    if (!finCalled) {
                        finCalled = true;
                        done();
                        (cb || (function () {}))(err, result);
                    }
                };

                try {
                    var handler = self.getCommandHandler(command);
                    handler.validate(self.model, args);

                    self.journal.append({
                            command: command,
                            args: args
                        },
                        function (err) {
                            if (err) {
                                return fin(err, null);
                            }
                            var unsafeResult = handler.execute(self.model, args);
                            result = self.marshaller.marshal(unsafeResult);
                            fin(null, result);
                        }
                    );
                } catch (e) {
                    fin(e, null);
                }
            });
        });
    };

    module.exports = function (options) {
        return new Klass(options);
    };

    // some factories
    module.exports.marshaller = function () {
        return marshaller();
    };
    module.exports.synchronizer = function () {
        return synchronizer();
    };
    module.exports.journal = function () {
        return journal();
    };

})(module);