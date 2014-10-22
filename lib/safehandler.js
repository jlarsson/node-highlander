(function (module) {
    "use strict";

    var debug = require('debug')('highlander');
    var classBuilder = require('ryoc');

    function makeAsync(fn) {
        if (fn.length > 1) {
            return fn;
        }
        return function asyncTryCatchWrapper(arg, cb) {
            var result, error = null;
            try {
                result = fn.call(this, arg) || null;
            } catch (e) {
                error = e;
            }
            cb(error, result);
        }
    }

    var Klass = classBuilder()
        .construct(function init(name, inner) {
            this.name = name;
            this.inner = inner;
        })
        .method('validate', function validate(ctx, cb) {
            try {
                return makeAsync(this.inner.validate).call(this.inner, ctx, cb);
            } catch (err) {
                debug('validation failed for command \'%s\'', this.name);
                cb(err, null);
            }
        })
        .method('execute', function execute(ctx, cb) {
            try {
                return makeAsync(this.inner.execute).call(this.inner, ctx, cb);
            } catch (err) {
                debug('execution failed for command \'%s\'', this.name);
                cb(err, null);
            }
        })
        .toClass();


    module.exports = function (name, inner) {
        return new Klass(name, inner);
    };
})(module);