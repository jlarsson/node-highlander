(function (module) {
    "use strict";

    var rwlock = require('rwlock');
    var classBuilder = require('ryoc');

    var Klass = classBuilder()
        .construct(function init() {
            this.lock = new rwlock();
        })
        .method('readOperation', function readOperation (fn) {
            this.lock.readLock(fn);
        })
        .method('writeOperation', function writeOperation (fn) {
            this.lock.writeLock(fn);
        })
        .toClass();

    module.exports = Klass;
})(module);