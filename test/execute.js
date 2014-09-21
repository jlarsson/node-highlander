var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('repo.execute()', function () {
    it('calls <commandHandler>.validate()', function (done) {
        var r = repo();
        var validateCalled = false;
        r.registerCommand('cmd', {
            validate: function (){validateCalled = true;},
            execute: function (){return 'command result';}
        });

        r.execute('cmd', null, function (err, data) {
            assert(!err, 'Unexpected error');
            validateCalled.should.equal(true,'validation method should be called');
            data.should.equal('command result');
            done();
        });
    })

    it('fails gracefully without calling executing command if validation throws', function (done) {
        var r = repo();
        r.registerCommand('cmd', {
            validate: function (){throw 'validation failed'; },
            execute: function (){ assert.fail('command should not be executed'); }
        });

        r.execute('cmd', null, function (err, data) {
            assert(!data, 'Unexpected data');
            err.should.equal('validation failed');
            done();
        });
    })
});