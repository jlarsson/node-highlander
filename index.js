(function (module) {
    "use strict";

    var repository = require('./lib/repository');

    module.exports = function (options) {
        return repository(options);
    };
    module.exports.repository = repository;
    module.exports.marshaller = require('./lib/marshaller');
    module.exports.synchronizer = require('./lib/synchronizer');
    module.exports.fileJournal = require('./lib/filejournal');
    module.exports.memoryJournal = require('./lib/memoryjournal');
    module.exports.commandRegistry = require('./lib/commandRegistry');
    module.exports.nomarshal = require('./lib/nomarshal');

})(module);