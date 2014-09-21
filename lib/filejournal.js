(function (module) {
    var fs = require('fs'),
        readline = require('readline'),
        path = require('path'),
        mkdirp = require('mkdirp'),
        events = require('events');

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }

        this.options = options;
        this.folderChecked = false;
    };
    var proto = Klass.prototype;

    proto.appendToExisting = function (ctx, cb) {
        var record = {
            t: new Date().toISOString(),
            c: ctx.command,
            a: ctx.args
        };
        fs.appendFile(this.options.path, JSON.stringify(record) + '\r\n', cb);
    };
    proto.append = function (ctx, cb) {
        if (!this.folderChecked) {
            var self = this;

            mkdirp(path.dirname(self.options.path), function (err) {
                if (err) {
                    return cb(err);
                }
                self.folderChecked = true;
                self.appendToExisting(ctx, cb);
            });
        } else {
            this.appendToExisting(ctx, cb);
        }
    };
    proto.replay = function () {
        var self = this;
        var emitter = new events.EventEmitter();
        
        fs.exists(self.options.path, function (exists) {
            if (!exists) {
                emitter.emit('done');
                return;
            }

            var revision = 0;
            readline.createInterface({
                input: fs.createReadStream(self.options.path),
                terminal: false
            })
                .on('line', function (line) {
                    if ((/^\{/).test(line)) {
                        var record = JSON.parse(line);
                        record.r = revision;
                        record.p = self.options.path;
                        emitter.emit('command', record);
                    }
                    ++revision;
                })
                .on('close', function () {
                    emitter.emit('done');
                });
        });
        return emitter;
    };


    module.exports = Klass;
})(module);