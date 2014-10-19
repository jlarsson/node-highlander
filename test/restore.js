var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');

describe('restore', function () {

    // setup a shared in-memory journal
    var sharedJournal = highlander.memoryJournal();

    function createRepo(journal) {
        return highlander.repository({
                journal: journal
            })
            .registerCommand('set data prop', function (ctx, cb) {
                var model = ctx.model;
                var data = ctx.args;
                (model.props || (model.props = {}))[data.name] = data.value;
                cb();
            });
    }

    it('first run - just update model', function (done) {
        var repo = createRepo(sharedJournal);

        repo.execute('set data prop', {
                name: 'a',
                value: '1'
            },
            function (err, data) {
                repo.execute('set data prop', {
                    name: 'b',
                    value: '2'
                }, done);
            });
    });

    it('second run - verify restored model', function (done) {
        createRepo(sharedJournal)
            .query(
                function (model, cb) {
                    cb(null, model.props);
                },
                function (err, props) {
                    assert(!err);
                    assert(props);
                    assert.equal(props['a'], 1);
                    assert.equal(props['b'], 2);
                    done();
                }
        );
    });
});

describe('restore a big journal without getting stack overflow', function () {
    // setup a shared in-memory journal
    var sharedJournal = highlander.memoryJournal();

    function createRepo(journal) {
        return highlander.repository({
                journal: journal
            })
            .registerCommand('set data prop', function (ctx, cb) {
                var model = ctx.model;
                var data = ctx.args;
                (model.props || (model.props = {}))[data.name] = data.value;
                cb();
            });
    }

    it('first run - just update model', function (done) {
        this.timeout(10000);
        var repo = createRepo(sharedJournal);

        var N = 1000;
        var actual = 0;

        for (var i = 0; i < N; ++i) {
            repo.execute('set data prop', {
                    name: 'a',
                    value: '1'
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
            .execute('set data prop', {
                name: 'b',
                value: '2'
            })

        .query(
            function (model, cb) {
                cb(null, model.props);
            },
            function (err, props) {
                assert(!err);
                assert(props);
                assert.equal(props['a'], 1);
                assert.equal(props['b'], 2);
                done();
            }
        );
    });
});