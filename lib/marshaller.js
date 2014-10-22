(function (module) {
    "use strict";

    var classBuilder = require('ryoc');

    var skiptypes = {
        "undefined": true,
        "boolean": true,
        "number": true,
        "string": true
    };

    var Klass = classBuilder()
        .method('marshal', function marshal(obj) {
            if (skiptypes[typeof obj]) {
                return obj;
            }
            if (obj === null) {
                return null;
            }

            var customMarshal = obj.marshal;
            if (typeof customMarshal === 'function') {
                return obj.marshal();
            }

            return obj ? JSON.parse(JSON.stringify(obj)) : obj;
        })
        .toClass();

    module.exports = Klass;
})(module);