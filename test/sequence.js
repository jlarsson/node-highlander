var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');


describe('sequence of commands and queries', function () {

    // setup a shared in-memory journal
    var sharedJournal = highlander.memoryJournal();

    function createRepo(journal) {
        return highlander.repository({
            journal: journal,
            model: {
                expected: 0
            }
        })
            .registerCommand('verify and inc', function (ctx, cb) {
                var model = ctx.model;
                var expected = ctx.args;
                var verified = model.expected === expected;
                ++model.expected;

                cb(verified ? null : 'fail', expected);
            });
    }

    var N = 1000;

    it('commands and queries are executed in order', function (done) {
        var repo = createRepo(sharedJournal);
        for (var i = 0; i < N; ++i) {
            repo.execute('verify and inc', i, function (err) {
                assert(!err);
            });
        }

        repo.query(function (model, cb) {
                cb(null, model.expected);
            },
            function (err, expected) {
                assert.equal(expected, N);
                done();
            });

    });

    it('journal is restored in order', function (done) {
        var repo = createRepo(sharedJournal);

        repo.query(function (model, cb) {
                cb(null, model.expected);
            },
            function (err, expected) {
                assert.equal(expected, N);
                done();
            });

    });

});