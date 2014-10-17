var assert = require('assert'),
    repo = require('./../index'),
    should = require('should'),
    nomarshal = repo.nomarshal;

describe('repo.query()', function () {

    it('marshals objects', function (done) {
        var modelObj = {
            value: 'some value'
        };
        repo().query(
            function (model, cb) {
                cb(null, modelObj);
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj);
                assert.equal(obj.value, modelObj.value);
                assert(obj !== modelObj, 'Expected a copy');
                done();
            });
    });

    it('marshals null', function (done) {
        repo().query(
            function (model, cb) {
                cb(null, null);
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj === null);
                done();
            });
    });

    it('marshals undefined', function (done) {
        repo().query(
            function (model, cb) {
                cb(null, undefined);
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj === undefined);
                done();
            });
    });
    
    it('marshals integers', function (done) {
        repo().query(
            function (model, cb) {
                cb(null, 123);
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj === 123);
                done();
            });
    });
    
    it('marshals strings', function (done) {
        repo().query(
            function (model, cb) {
                cb(null, 'hello');
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj === 'hello');
                done();
            });
    });
    
    it('marshals booleans', function (done) {
        repo().query(
            function (model, cb) {
                cb(null, true);
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj === true);
                done();
            });
    });

    it('does not marshal nomarshal(...) result', function (done) {
        var modelObj = {
            value: 'some value'
        };
        repo().query(
            function (model, cb) {
                cb(null, nomarshal(modelObj));
            },
            function (err, obj) {
                assert(!err, 'error should not be set');
                assert(obj);
                assert.equal(obj.value, modelObj.value);
                assert(obj === modelObj, 'Expected same value');
                done();
            });
    });
});