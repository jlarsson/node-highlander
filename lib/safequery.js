(function (module) {
    "use strict";

    module.exports = function (fn) {
        if (fn.length > 1) {
            return fn;
        }
        return function safeQueryTryCatchWrapper(arg, cb) {
            var result, error = null;
            try {
                result = fn.call(this, arg) || null;
            } catch (e) {
                error = e;
            }
            cb(error, result);
        }
    };
})(module);