(function (module) {
    "use strict";
    
    var skiptypes = {
        "undefined": true,
        "boolean": true,
        "number": true,
        "string": true
    };

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }
    };
    Klass.prototype.marshal = function (obj) {
        if (skiptypes[typeof obj]){
            return obj;
        }
        if (obj === null){
            return null;
        }
        
        var customMarshal = obj.marshal;
        if (typeof customMarshal === 'function'){
            return obj.marshal();
        }
        
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }

    module.exports = Klass;
})(module);