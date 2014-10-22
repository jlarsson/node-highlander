(function (module) {
    "use strict";

    var classBuilder = require('ryoc');

    var Klass = classBuilder()
        .construct(function init(data) {
            this.data = data;
        })
        .method('marshal', function marshal(obj) {
            return this.data;
        })
        .toClass();

    module.exports = Klass;
})(module);