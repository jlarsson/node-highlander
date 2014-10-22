(function (module) {
    "use strict";

    var fs = require('fs');
    var readline = require('readline');
    var path = require('path');
    var mkdirp = require('mkdirp');
    var events = require('events');
    var debug = require('debug')('highlander');
    var classBuilder = require('ryoc');

    var Klass = classBuilder()
        .construct(function init(options) {
            this.options = options;
            this.folderChecked = false;
        })
        .method('appendToExisting', function appendToExisting(ctx, cb) {
            var record = {
                t: new Date(),
                c: ctx.command,
                a: ctx.args
            };
            fs.appendFile(this.options.path, JSON.stringify(record) + '\r\n', cb);
        })
        .method('append', function append(ctx, cb) {
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
        })
        .method('replay', function replay() {
            var emitter = new events.EventEmitter();

            fs.exists(this.options.path, function existsCallback(exists) {
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
        })
        .toClass();

    module.exports = Klass;
})(module);