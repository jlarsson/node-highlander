(function (module) {
    var fs = require('fs'),
        readline = require('readline'),
        path = require('path'),
        mkdirp = require('mkdirp');

    var Klass = function (options) {
        this.options = options;
        this.folderChecked = false;
    };
    var proto = Klass.prototype;

    proto.appendToExisting = function (entry, cb) {
        fs.appendFile(this.options.path, JSON.stringify(entry)+'\r\n', cb);
    };
    proto.append = function (entry, cb) {
        if (!this.folderChecked) {
            var self = this;

            mkdirp(path.dirname(self.options.path), function (err) {
                if (err) {
                    return cb(err);
                }
                self.folderChecked = true;
                self.appendToExisting(entry, cb);
            });
        } else {
            this.appendToExisting(entry, cb);
        }
    };
    proto.replay = function (events) {
        var self = this;
        fs.exists(self.options.path, function (exists) {
            if (!exists){
                events.emit('done');
                return;
            }

            readline.createInterface({
                input: fs.createReadStream(self.options.path),
                terminal: false
            })
                .on('line', function (line) {
                    events.emit('command', JSON.parse(line));
                })
                .on('close', function () {
                    events.emit('done');
                });
        });
    };


    module.exports = function (path) {
        return new Klass(path);
    };
})(module);