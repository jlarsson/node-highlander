var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('repo.registerCommand() throws exceptions when', function () {
    describe('registerCommand(<not an object or function>)', function () {
        it('throws an exception', function () {
            var r = repo();
            assert.throws(function () {
                    r.registerCommand('c');
                },
                TypeError);
            assert.throws(function () {
                    r.registerCommand('c',123);
                },
                TypeError);
            assert.throws(function () {
                    r.registerCommand('c','a string...');
                },
                TypeError);
        });
    });
    describe('registerCommand({validate: <not a function>})', function () {
        it('throws an exception', function () {
            var r = repo();
            assert.throws(function () {
                    r.registerCommand('c', {validate: false});
                },
                TypeError);
        });
    });
    describe('registerCommand({execute: <not a function>})', function () {
        it('throws an exception', function () {
            var r = repo();
            assert.throws(function () {
                    r.registerCommand('c', {execute: "makes no sense"});
                },
                TypeError);
        });
    });
});

describe('repo.registerCommand() accepts a (execute) function', function () {
    describe('registerCommand(function)', function () {
        var r = repo();
        var testHandler = function () {};
        r.registerCommand('c', testHandler);
        var handler = r.getCommandHandler('c');
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
        var r = repo();
        r.registerCommand('c', {});
        var handler = r.getCommandHandler('c');
        it('extends specified handler with an (nop) execute method', function () {
            handler.validate.should.be.instanceof(Function);
        });
        it('and a (nop) validate method', function () {
            handler.validate.should.be.instanceof(Function);
        });
    });
    describe('registerCommand({handler: function () ...})', function () {
        var r = repo();
        r.registerCommand('c', {
            x: 1,
            execute: function () {
                return this.x;
            }
        });
        var handler = r.getCommandHandler('c');
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


