var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('restore', function () {

    // setup a shared in-memory journal
    var journal = repo.memoryJournal();

    function registerCommands(repo) {
        repo.registerCommand('set data prop', function (ctx) {
            var model = ctx.model;
            var data = ctx.args;
            (model.props || (model.props = {}))[data.name] = data.value;
        });
    }

    it('first run - just update model', function (done) {
        var r = repo({
            journal: journal
        });

        registerCommands(r);

        r.execute('set data prop', {
                name: 'a',
                value: '1'
            },
            function () {
                r.execute('set data prop', {
                    name: 'b',
                    value: '2'
                }, done);
            });
    });

    it('second run - verify restored model', function (done) {
        var r = repo({
            journal: journal
        });

        registerCommands(r);

        r.query(
            function (model) {
                return model.props;
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