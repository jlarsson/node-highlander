(function (module) {
    "use strict";

    var _ = require('lodash'),
        util = require('util');

    function throwMissingHandler(ctx) {
        throw new Error(util.format('No handler for command \'%s\' is registered', ctx.command));
    }

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }

        this.options = _.defaults({}, options, {
            resolveMissingCommandHandler: function (ctx) { return throwMissingHandler; }
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
    proto.getCommandHandler = function (ctx) {
        if (_.isString(ctx)) {
            return this.getCommandHandler({
                command: ctx
            });
        }
        return (this.commands[ctx.command] || normalizeHandler(this.options.resolveMissingCommandHandler(ctx))) || normalizeHandler(throwMissingHandler);
    };

    module.exports = Klass;
})(module);