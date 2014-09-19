var assert = require('assert'),
    repo = require('./../index'),
    should = require('should');

describe('repo.execute()', function () {
    it('does not append to journal if validation fails', function (done) {
        var journal = repo.memoryJournal();
        
        var r = repo({journal: journal});
        r.registerCommand('c',{validate: function () {throw "validation failed"; }});
        
        r.execute('c',null, function (err,result){
            journal.log.should.have.length(0);
            
            err.should.be.equal('validation failed');
            done();
        });
    });

    it('does append to journal event if execution fails (MAKE SURE TO VALIDATE!!!)', function (done) {
        var journal = repo.memoryJournal();
        
        var r = repo({journal: journal});
        r.registerCommand('c',{execute: function () {throw "execute failed"; }});
        
        r.execute('c',null, function (err,result){
            journal.log.should.have.length(1);
            
            err.should.be.equal('execute failed');
            done();
        });
    });

});