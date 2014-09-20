(function (module) {
    _ = require('lodash');

    var Klass = function (options) {
        this.commands = {};
    };

    function normalizeHandler(handler) {
        if (_.isFunction(handler)) {
            return normalizeHandler({
                execute: handler,
                validate: function () {}
            });
        }
        if (!_.isObject(handler)) {
            throw new TypeError('Parameter handler in registerCommand(name,handler) should be an object or a function');
        }
        if (('execute' in handler) && !_.isFunction(handler.execute)) {
            throw new TypeError('execute must be function member in a command handler');
        }
        if (('validate' in handler) && !_.isFunction(handler.validate)) {
            throw new TypeError('validate must be function member in a command handler');
        }
        if (!(('execute' in handler) && ('validate' in handler))) {
            handler = {
                validate: handler.validate ? handler.validate.bind(handler) : _.noop,
                execute: handler.execute ? handler.execute.bind(handler) : _.noop,
            }
        }
        return handler;
    }

    var proto = Klass.prototype;

    proto.registerCommand = function (name, handler) {
        this.commands[name] = normalizeHandler(handler);
        return this;
    };
    proto.getCommandHandler = function (name) {
        return this.commands[name] || normalizeHandler({
            execute: function (){
//                throw new Error('No handler for command \'' + name + '\' is registered');
                console.error('No handler for command \'%s\' is registered', name);
            }
        });
    };

    module.exports = function (options) {
        return new Klass(options);
    };
})(module);