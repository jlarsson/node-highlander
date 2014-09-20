(function (module) {
    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        synchronizer = require('./synchronizer'),
        marshaller = require('./marshaller'),
        fileJournal = require('./filejournal'),
        memoryJournal = require('./memoryjournal');

    var Klass = function (options) {

        var options = _.defaults({}, options, {
            model: {},
            synchronizer: synchronizer(options),
            marshaller: marshaller(options),
            //journal: journal(options)
        });
        
        options.journal = options.journal || (options.fileJournal ? fileJournal(options.fileJournal) : memoryJournal());

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
            return fn();
        }
        this.readyQ.push(fn);

        if (!this.restoring) {
            this.restoring = true;
            var self = this;
            this.journal.replay(new EventEmitter()
                .on('command', function (entry) {
                    var handler = self.getCommandHandler(entry.c);
                    handler.execute(self.model, entry.a, _.noop);
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
        if (_.isFunction(handler)){
            return this.registerCommand(name, {
                execute: handler,
                validate: function () {}
            });
        }
        if (!_.isObject(handler)){
            throw new TypeError('Parameter handler in registerCommand(name,handler) should be an object or a function');
        }
        if (('execute' in handler) && !_.isFunction(handler.execute)){
            throw new TypeError('execute must be function member in a command handler');
        }
        if (('validate' in handler) && !_.isFunction(handler.validate)){
            throw new TypeError('validate must be function member in a command handler');
        }
        if (!(('execute' in handler) && ('validate' in handler))){
            handler = {
                validate: handler.validate ? handler.validate.bind(handler) : _.noop,
                execute: handler.execute ? handler.execute.bind(handler) : _.noop,
            }
        }
        this.commands[name] = handler;
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
                        (cb || _.noop)(err, result);
                    }
                };

                try {
                    var handler = self.getCommandHandler(command);
                    handler.validate(self.model, args);

                    self.journal.append({
                            c: command,
                            a: args
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
})(module);