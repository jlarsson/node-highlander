(function (module){
    var Klass = function (){
        this.log = [];
    };
    
    var proto = Klass.prototype;
    
    proto.append = function (entry) {
        this.log.push(entry);
    };
    proto.replay = function (events){
        for(var i = 0; i < this.log.length; ++i){
            events.emit('command',this.log[i]);
        }
        events.emit('done');
    };
    
    module.exports = function (options){ return new Klass(options); };
})(module);