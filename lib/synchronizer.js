(function (module){
    "use strict";
    
    var rwlock = require('rwlock');
    
    var Klass = function (){
        this.lock = new rwlock();
    };
    Klass.prototype.readOperation = function (fn){
        this.lock.readLock(fn);
    };
    Klass.prototype.writeOperation = function (fn){
        this.lock.writeLock(fn);
    };
    
    module.exports = function (){ return new Klass(); };
})(module);