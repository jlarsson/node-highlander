var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('commands', function () {
    describe('registerCommand', function () {
        it('infers execute() from a function', function (done) {
            var r = repo();
            r.registerCommand('cmd', function (model) {
                return 'command result';
            });

            r.execute('cmd', null, function (err, data) {
                assert(!err);
                data.should.equal('command result');
                done();
            });
        });
        it('infers validate() and execute() from an object', function (done) {
            var r = repo();
            var validateIsCalled = false;
            r.registerCommand('cmd', {
                validate: function (){ validateIsCalled = true; },
                execute: function (model) {
                    return 'command result';
                }
            });

            r.execute('cmd', null, function (err, data) {
                assert(!err);
                assert(validateIsCalled,'Validate was never called');
                data.should.equal('command result');
                done();
            });

        });
    })
});