(function (module) {
    "use strict";

    var EventEmitter = require('events').EventEmitter;
    var _ = require('lodash');
    var util = require('util');
    var commandRegistry = require('./commandRegistry');
    var synchronizer = require('./synchronizer');
    var marshaller = require('./marshaller');
    var fileJournal = require('./filejournal');
    var memoryJournal = require('./memoryjournal');
    var repo = require('./repo');
    var debug = require('debug')('highlander');
    var classBuilder = require('ryoc');

    var Klass = classBuilder()
        .construct(function init(options) {
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
        })
        .method('registerCommand', function registerCommand(name, handler) {
            this.commandRegistry.registerCommand(name, handler);
            return this;
        })
        .method('query', function query(query, cb) {
            this.repo.query({
                query: query,
                cb: cb
            });
            return this;
        })
        .method('execute', function execute(command, args, cb) {
            this.repo.execute({
                command: command,
                args: args,
                cb: cb
            });
            return this;
        })
        .toClass();

    module.exports = Klass;
})(module);