(function (module) {
    var EventEmitter = require('events').EventEmitter,
        _ = require('lodash'),
        commandRegistry = require('./commandRegistry'),
        synchronizer = require('./synchronizer'),
        marshaller = require('./marshaller'),
        fileJournal = require('./filejournal'),
        memoryJournal = require('./memoryjournal');

    var Klass = function (options) {
        if (!(this instanceof Klass)){
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
                    var handler = self.getCommandHandler(entry.c, false);
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
        this.commandRegistry.registerCommand(name,handler);
        return this;
    };
    proto.getCommandHandler = function (name, mustExist) {
        return this.commandRegistry.getCommandHandler(name, mustExist);
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
        return this;
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
                    var handler = self.getCommandHandler(command, true);
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
        return this;
    };

    module.exports = Klass;
})(module);