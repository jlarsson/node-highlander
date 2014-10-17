(function (module) {
    "use strict";

    var Klass = function (data) {
        if (!(this instanceof Klass)) {
            return new Klass(data);
        }
        this.data = data;
    };
    Klass.prototype.marshal = function (obj) {
        return this.data;
    }

    module.exports = Klass;
})(module);