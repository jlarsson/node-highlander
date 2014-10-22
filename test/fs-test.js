var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should'),
    rimraf = require('rimraf');

describe('restore a big journal backed to file', function () {
    before(function (next) {
        rimraf('./tmp/test', next)
    });

    after(function (next) {
        rimraf('./tmp/test', next)
    });

    // setup a file journal
    var sharedJournal = highlander.fileJournal({
        path: './tmp/test/repo'
    });

    function createRepo(journal) {
        return highlander.repository({
            model: {
                counter: 0
            },
            journal: journal
        })
            .registerCommand('inc', function (ctx, cb) {
                var model = ctx.model;
                var data = ctx.args;
                model.counter += data.value;
                cb();
            });
    }

    var N = 1000;
    it('first run - just update model', function (done) {
        this.timeout(10000);
        var repo = createRepo(sharedJournal);

        var actual = 0;

        for (var i = 0; i < N; ++i) {
            repo.execute('inc', {
                    value: 1
                },
                function (err, data) {
                    ++actual;
                    if (actual === N) {
                        done();
                    }
                });
        }
    });

    it('second run - verify restored model', function (done) {
        createRepo(sharedJournal)
            .query(
                function (model, cb) {
                    cb(null, model.counter);
                },
                function (err, counter) {
                    assert(!err);
                    assert.equal(counter, N);
                    done();
                }
        );
    });
});