(function (module){
    "use strict";
    
    var Klass = function (){};
    Klass.prototype.marshal = function (obj){
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }
    
    module.exports = function (){ return new Klass(); };
})(module);