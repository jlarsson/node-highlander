(function (module) {
    _ = require('lodash'),
        util = require('util');

    function throwMissingHandler(name){
                throw new Error(util.format('No handler for command \'%s\' is registered', name)); 
    }
    
    var Klass = function (options) {
        if (!(this instanceof Klass)){
            return new Klass(options);
        }
        
        this.options = _.defaults({}, options, {
            getCommandHandler: throwMissingHandler
        });
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
    proto.getCommandHandler = function (name, mustExist) {
        return mustExist ? 
            (this.commands[name] || throwMissingHandler(name))
            : (this.commands[name] || 
            (this.commands[name] = normalizeHandler(this.options.getCommandHandler(name))));
    };

    module.exports = Klass;
})(module);