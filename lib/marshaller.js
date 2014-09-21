(function (module) {
    "use strict";

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }
    };
    Klass.prototype.marshal = function (obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }

    module.exports = Klass;
})(module);