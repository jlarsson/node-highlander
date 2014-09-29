/*jslint node: true */
/*global describe,it*/
'use strict';

var assert = require('assert'),
    commandRegistry = require('./../index').commandRegistry,
    should = require('should');

describe('commandRegistry.getCommandHandler()', function () {
    it('returns null for unregistered commands', function () {
        var registry = commandRegistry();
        assert(registry.getCommandHandler('some missing command') === null);
    });
    it('allows fallback for unregistered commands', function () {
        function testHandler() {}
        var registry = commandRegistry({
            resolveMissingCommandHandler: function () { return testHandler; } 
        });
        var handler = registry.getCommandHandler('some missing command');
        assert(handler);
        testHandler.should.equal(handler.execute);
    });
});

describe('commandRegistry.registerCommand(<name>,<falsy>', function () {
    it('does nothing', function (){
        var registry = commandRegistry();
        
        registry.registerCommand('c');
        assert(registry.getCommandHandler('c') === null);
    });
});
    
describe('commandRegistry.registerCommand() throws exceptions when', function () {
    describe('registerCommand(<name>, <not an object or function>)', function () {
        it('throws an exception', function () {
            var registry = commandRegistry();
            assert.throws(function () {
                    registry.registerCommand('c','bad value');
                },
                TypeError);
            assert.throws(function () {
                    registry.registerCommand('c', 123);
                },
                TypeError);
            assert.throws(function () {
                    registry.registerCommand('c', 'a string...');
                },
                TypeError);
        });
    });
    describe('registerCommand(<name>,{validate: <not a function>})', function () {
        it('throws an exception', function () {
            var registry = commandRegistry();
            assert.throws(function () {
                    registry.registerCommand('c', {
                        validate: false
                    });
                },
                TypeError);
        });
    });
    describe('registerCommand(<name>,{execute: <not a function>})', function () {
        it('throws an exception', function () {
            var registry = commandRegistry();
            assert.throws(function () {
                    registry.registerCommand('c', {
                        execute: "makes no sense"
                    });
                },
                TypeError);
        });
    });
});

describe('commandRegistry.registerCommand() accepts a (execute) function', function () {
    describe('registerCommand(<name>,function)', function () {
        var registry = commandRegistry();
        var testHandler = function () {};
        registry.registerCommand('c', testHandler);
        var handler = registry.getCommandHandler('c');
        
        it('wraps function in a command handler object', function () {
            handler.should.be.an.Object;
        });
        it('which has an execute method ', function () {
            handler.execute.should.be.a.Function;
        });
        it('and a validate method', function () {
            handler.validate.should.be.a.Function;
        });
    });
});


describe('repo.registerCommand() accepts handler objects', function () {
    describe('registerCommand(<name>,{})', function () {
        var registry = commandRegistry();
        registry.registerCommand('c', {});
        var handler = registry.getCommandHandler('c');
        it('extends specified handler with an (nop) execute method', function () {
            handler.validate.should.be.instanceof(Function);
        });
        it('and a (nop) validate method', function () {
            handler.validate.should.be.instanceof(Function);
        });
    });
    describe('registerCommand(<name>,{handler: function () ...})', function () {
        var registry = commandRegistry();
        registry.registerCommand('c', {
            x: 1,
            execute: function () {
                return this.x;
            }
        });
        var handler = registry.getCommandHandler('c');
        it('extends specified handler with a validate method', function () {
            handler.validate.should.be.instanceof(Function);
        });
        it('and preserves given execute method', function () {
            handler.validate.should.be.instanceof(Function);
        });
        it('and preserves this bindings', function () {
            handler.execute().should.be.equal(1);
        });
    });
});