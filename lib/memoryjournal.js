(function (module) {
    var events = require('events');

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }
        this.log = [];
    }
    var proto = Klass.prototype;
    proto.append = function (ctx, cb) {
        this.log.push({
            c: ctx.command,
            a: ctx.args,
            r: this.log.length
        });
        cb();
    };
    proto.replay = function () {
        var emitter = new events.EventEmitter();

        setImmediate(function () {
            for (var i = 0; i < this.log.length; ++i) {
                emitter.emit('command', this.log[i]);
            }
            emitter.emit('done');
        }.bind(this));
        return emitter;
    };

    module.exports = Klass;
})(module);