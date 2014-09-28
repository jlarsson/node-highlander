(function (module) {
    "use strict";
    
    var debug = require('debug')('highlander');
    
    var Klass = function (name, inner){
        this.name = name;
        this.inner = inner;
    };
    
    var proto = Klass.prototype;
    
    proto.validate = function (ctx, cb) {
        //debug('validating \'%s\'', this.name);
        try{
            return this.inner.validate(ctx,cb);
        }
        catch (err){
            debug('validation failed for command \'%s\'', this.name);
            cb(err, null);
        }
    };
    
    proto.execute = function (ctx, cb) {
        //debug('executing \'%s\'', this.name);
        try{
            return this.inner.execute(ctx,cb);
        }
        catch (err){
            debug('execution failed for command \'%s\'', this.name);
            cb(err, null);
        }
    };
    
    
    module.exports = function (name, inner) { return new Klass(name, inner); };
})(module);