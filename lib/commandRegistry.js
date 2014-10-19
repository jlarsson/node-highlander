(function (module) {
    "use strict";

    var _ = require('lodash'),
        util = require('util'),
        debug = require('debug')('highlander'),
        safeHandler = require('./safehandler');

    var Klass = function (options) {
        if (!(this instanceof Klass)) {
            return new Klass(options);
        }

        this.options = _.defaults({}, options, {
            resolveMissingCommandHandler: function (name) { return null; }
        });
        this.commands = {
            '$prerestore': normalizeHandler('$prerestore', {}),
            '$postrestore': normalizeHandler('$postrestore', {})
        };
    };

    function normalizeHandler(name, handler) {
        if (!handler){
            //debug('attempt to register null handler for command %s', name);
            return null;
        }
        if (_.isFunction(handler)) {
            return normalizeHandler(name, {
                execute: handler
            });
        }
        if (!_.isObject(handler)) {
            throw new TypeError('Parameter handler in registerCommand(name,handler) should be an object or a function');
        }
                
        var execute = handler.execute || function (ctx, cb){ cb(null,null); };
        var validate = handler.validate || function (ctx, cb){ cb(null,null); };
        if (!_.isFunction(execute)){
            throw new TypeError('execute must be function member in a command handler');
        }
        if (!_.isFunction(validate)){
            throw new TypeError('validate must be function member in a command handler');
        }
        return safeHandler(name, {
            execute: execute.bind(handler),
            validate: validate.bind(handler)
        });
    }

    var proto = Klass.prototype;

    proto.registerCommand = function (name, handler) {
        debug('registerCommand(\'%s\')', name);
        var handler = normalizeHandler(name, handler);
        if (handler){
            this.commands[name] = handler;
        }
        return this;
    };
    proto.getCommandHandler = function (ctx) {
        if (_.isString(ctx)) {
            return this.getCommandHandler({
                command: ctx
            });
        }
        return (this.commands[ctx.command] || normalizeHandler(ctx.command, this.options.resolveMissingCommandHandler(ctx.command)));
    };

    module.exports = Klass;
})(module);