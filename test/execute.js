var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');

describe('repo.execute()', function () {
    it('calls <commandHandler>.validate()', function (done) {
        var validateCalled = false;
        highlander()
            .registerCommand('cmd', {
                validate: function (ctx, cb) {
                    validateCalled = true;
                    cb();
                },
                execute: function (ctx, cb) {
                    return cb(null, 'command result');
                }
            }).execute('cmd', null, function (err, data) {
                assert(!err, 'Unexpected error');
                validateCalled.should.equal(true, 'validation method should be called');
                data.should.equal('command result');
                done();
            });
    })

    it('fails gracefully without calling executing command if validation throws', function (done) {
        highlander()
            .registerCommand('cmd', {
                validate: function () {
                    throw 'validation failed';
                },
                execute: function () {
                    assert.fail('command should not be executed');
                }
            })
            .execute('cmd', null, function (err, data) {
                assert(!data, 'Unexpected data');
                err.should.equal('validation failed');
                done();
            });
    })
});