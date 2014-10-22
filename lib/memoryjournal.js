(function (module) {
    "use strict";

    var events = require('events');
    var classBuilder = require('ryoc');

    var Klass = classBuilder()
        .construct(function init() {
            this.log = [];
        })
        .method('append', function append(ctx, cb) {
            this.log.push({
                c: ctx.command,
                a: ctx.args,
                r: this.log.length
            });
            cb();
        })
        .method('replay', function replay() {
            var emitter = new events.EventEmitter();

            setImmediate(function emitCommands() {
                for (var i = 0; i < this.log.length; ++i) {
                    emitter.emit('command', this.log[i]);
                }
                emitter.emit('done');
            }.bind(this));
            return emitter;
        })
        .toClass();

    module.exports = Klass;
})(module);