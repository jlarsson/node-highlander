(function (module){
    var Klass = function (options){
        
        this.impl = (options && options.journalPath) ? 
            require('./filejournal')({path: options.journalPath})
            : require('./memoryjournal')();
    };
    var proto = Klass.prototype;
    proto.append = function (entry, cb) { this.impl.append(entry,cb); };
    proto.replay = function (events){ this.impl.replay(events); };

    module.exports = function (options){ return new Klass(options); };
})(module);