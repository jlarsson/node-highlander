var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('repo.query()', function () {
    it('pass results to callback', function (done) {
        repo().query(
            function () {
                return 'query result';
            },
            function (err, data) {
                assert(!err,'error should not be set');
                data.should.equal('query result');
                done();
            });
    });
    it('pass exceptions to callback', function (done) {
        repo().query(
            function () {
                throw 'query error';
            },
            function (err, data) {
                assert(!data,'result should not be set');
                err.should.equal('query error');
                done();
            });
    });
});