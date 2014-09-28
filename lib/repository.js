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
        repo = require('./repo'),
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


        this.repo = repo(this);
    };
    var proto = Klass.prototype;

    proto.registerCommand = function (name, handler) {
        this.commandRegistry.registerCommand(name, handler);
        return this;
    };
    proto.query = function (query, cb) {
        this.repo.query({
            query: query,
            cb: cb
        });
        return this;
    };
    proto.execute = function (command, args, cb) {
        this.repo.execute({
            command: command,
            args: args,
            cb: cb
        });
        return this;
    };

    module.exports = Klass;
})(module);