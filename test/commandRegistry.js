var assert = require('assert'),
    commandRegistry = require('./../index').commandRegistry,
    should = require('should');

describe('commandRegistry.getCommandHandler()', function () {
    it('throws exception by default for unregistered commands', function () {
        var registry = commandRegistry();
        assert.throws(function () {
            registry.getCommandHandler('some missing command');
        });
    });
    it('allows fallback for unregistered commands', function () {
        var testHandler = function (){};
        var registry = commandRegistry({
            resolveMissingCommandHandler: function () { return testHandler; } 
        });
        var handler = registry.getCommandHandler('some missing command');
        assert(handler);
        testHandler.should.equal(handler.execute);
    });
});

describe('commandRegistry.registerCommand() throws exceptions when', function () {
    describe('registerCommand(<not an object or function>)', function () {
        it('throws an exception', function () {
            var registry = commandRegistry();
            assert.throws(function () {
                    registry.registerCommand('c');
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
    describe('registerCommand({validate: <not a function>})', function () {
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
    describe('registerCommand({execute: <not a function>})', function () {
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
    describe('registerCommand(function)', function () {
        var registry = commandRegistry();
        var testHandler = function () {};
        registry.registerCommand('c', testHandler);
        var handler = registry.getCommandHandler('c');
        it('wraps function in a command handler object', function () {
            handler.should.be.instanceof(Object);
        });
        it('which has the specified function as the execute method ', function () {
            handler.execute.should.be.instanceof(Function);
            handler.execute.should.be.exactly(testHandler);
        });
        it('and a validate method', function () {
            handler.validate.should.be.instanceof(Function);
        });
    });
});


describe('repo.registerCommand() accepts handler objects', function () {
    describe('registerCommand({})', function () {
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
    describe('registerCommand({handler: function () ...})', function () {
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