(function (module) {
    "use strict";
    
    var fs = require('fs'),
        readline = require('readline'),
        path = require('path'),
        mkdirp = require('mkdirp'),
        events = require('events'),
        debug = require('debug')('highlander');

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
            t: new Date(),
            c: ctx.command,
            a: ctx.args
        };
        fs.appendFile(this.options.path, JSON.stringify(record) + '\r\n', cb);
    };
    proto.append = function (ctx, cb) {
        if (!this.folderChecked) {
            mkdirp(path.dirname(this.options.path), function (err) {
                if (err) {
                    return cb(err);
                }
                this.folderChecked = true;
                this.appendToExisting(ctx, cb);
            }.bind(this));
        } else {
            this.appendToExisting(ctx, cb);
        }
    };
    proto.replay = function () {
        var emitter = new events.EventEmitter();
        
        fs.exists(this.options.path, function (exists) {
            if (!exists) {
                emitter.emit('done');
                return;
            }

            var revision = 0;
            readline.createInterface({
                input: fs.createReadStream(this.options.path),
                terminal: false
            })
                .on('line', function (line) {
                    if ((/^\{/).test(line)) {
                        var record = JSON.parse(line);
                        record.r = revision;
                        record.p = this.options.path;
                        emitter.emit('command', record);
                    }
                    ++revision;
                }.bind(this))
                .on('close', function () {
                    emitter.emit('done');
                });
        }.bind(this));
        return emitter;
    };


    module.exports = Klass;
})(module);