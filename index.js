(function (module) {
    repository = require('./lib/repository')
    synchronizer = require('./lib/synchronizer'),
    marshaller = require('./lib/marshaller'),
    fileJournal = require('./lib/filejournal'),
    memoryJournal = require('./lib/memoryjournal'),
    commandRegistry = require('./lib/commandRegistry'),
    nomarshal = require('./lib/nomarshal');

    module.exports = function (options) { return repository(options); };
    module.exports.repository = repository;
    module.exports.marshaller = marshaller;
    module.exports.synchronizer = synchronizer;
    module.exports.fileJournal = fileJournal;
    module.exports.memoryJournal = memoryJournal;
    module.exports.commandRegistry = commandRegistry;
    module.exports.nomarshal = nomarshal;

})(module);