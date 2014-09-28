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
            resolveMissingCommandHandler: function () { return null; }
        });
        this.commands = {
            '$prerestore': normalizeHandler({}),
            '$postrestore': normalizeHandler({})
        };
    };

    function normalizeHandler(handler) {
        if (!handler){
            return null;
        }
        if (_.isFunction(handler)) {
            return normalizeHandler({
                execute: handler,
                validate: function (ctx, cb) { cb(null); }
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
                validate: handler.validate ? handler.validate.bind(handler) : function (ctx,cb){ 
                    debug('default validate');
                    cb(null); },
                execute: handler.execute ? handler.execute.bind(handler) : function (ctx,cb){ cb(null,null); }
            }
        }
        return handler;
    }

    var proto = Klass.prototype;

    proto.registerCommand = function (name, handler) {
        debug('registerCommand(\'%s\')', name);
        var handler = normalizeHandler(handler);
        if (handler){
            this.commands[name] = safeHandler(name, handler);
        }
        return this;
    };
    proto.getCommandHandler = function (ctx) {
        if (_.isString(ctx)) {
            return this.getCommandHandler({
                command: ctx
            });
        }
        return (this.commands[ctx.command] || normalizeHandler(this.options.resolveMissingCommandHandler(ctx)));
    };

    module.exports = Klass;
})(module);