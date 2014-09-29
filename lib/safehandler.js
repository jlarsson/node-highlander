(function (module) {
    "use strict";

    var debug = require('debug')('highlander');

    var Klass = function (name, inner) {
        this.name = name;
        this.inner = inner;
    };


    function makeAsync(fn) {
        if (fn.length > 1) {
            return fn;
        }
        return function (arg, cb) {
            var result, error = null;
            try {
                result = fn.call(this, arg) || null;
            } catch (e) {
                error = e;
            }
            cb(error, result);
        }
    }
    var proto = Klass.prototype;

    proto.validate = function (ctx, cb) {
        try {
            return makeAsync(this.inner.validate).call(this.inner, ctx, cb);
        } catch (err) {
            debug('validation failed for command \'%s\'', this.name);
            cb(err, null);
        }
    };

    proto.execute = function (ctx, cb) {
        try {
            return makeAsync(this.inner.execute).call(this.inner, ctx, cb);
        } catch (err) {
            debug('execution failed for command \'%s\'', this.name);
            cb(err, null);
        }
    };


    module.exports = function (name, inner) {
        return new Klass(name, inner);
    };
})(module);