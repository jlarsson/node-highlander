var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');

describe('repo.execute()', function () {
    it('does not append to journal if validation fails', function (done) {
        var journal = highlander.memoryJournal();

        highlander({
            journal: journal
        })
            .registerCommand('c', {
                validate: function (ctx, cb) {
                    throw "validation failed";
                }
            })
            .execute('c', null, function (err, result) {
                journal.log.should.have.length(0);

                err.should.be.equal('validation failed');
                done();
            });
    });

    it('does append to journal even if execution fails (MAKE SURE TO VALIDATE!!!)', function (done) {
        var journal = highlander.memoryJournal();

        highlander({
            journal: journal
        })
            .registerCommand('c', {
                execute: function (ctx, cb) {
                    throw "execute failed";
                }
            })
            .execute('c', null, function (err, result) {
                journal.log.should.have.length(1);

                err.should.be.equal('execute failed');
                done();
            });
    });

});