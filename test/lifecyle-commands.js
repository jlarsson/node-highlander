/*jslint node: true */
/*global describe,it*/
'use strict';

var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');


describe('$prestore command is called before any ', function () {
    function createRepo(journal) {
        return highlander.repository({
            journal: journal || highlander.memoryJournal(),
            model: {
                executedCommands: []
            }
        })
            //.on('executed', function (data){ console.log('executed: %j', data); })
            //.on('restored', function (data){ console.log('restored: %j', data); })
            .registerCommand('$prerestore', function (ctx, cb) {
                ctx.model.executedCommands.push('$prerestore');
                cb();
            })
            .registerCommand('$postrestore', function (ctx, cb) {
                ctx.model.executedCommands.push('$postrestore');
                cb();
            })
            .registerCommand('my command', function (ctx, cb) {
                ctx.model.executedCommands.push('my command');
                cb();
            })
            .registerCommand('my other command', function (ctx, cb) {
                ctx.model.executedCommands.push('my other command');
                cb();
            });
    }

    // setup a shared in-memory journal
    var journal = highlander.memoryJournal();

    it('$prestore and $postrestore are executed on empty journal', function (done) {
        createRepo()
            .query(function (model, cb) {
                    cb(null, model.executedCommands);
                },
                function (err, executedCommands) {
                    assert(!err);
                    executedCommands.should.eql(['$prerestore', '$postrestore'])
                    done();
                });

    });

    it('$postrestore is executed before queued commands', function (done) {
        createRepo()
            .execute('my command')
            .query(function (model, cb) {
                    cb(null, model.executedCommands);
                },
                function (err, executedCommands) {
                    assert(!err);
                    executedCommands.should.eql(['$prerestore', '$postrestore', 'my command'])
                    done();
                });

    });

    it('$postrestore is executed after journaled commands and before queued commands ', function (done) {
        var journal = highlander.memoryJournal();

        // warm up repo with a command in the journal
        createRepo(journal)
            .execute('my command', null, function () {
                createRepo(journal)
                    .execute('my other command')
                    .query(function (model, cb) {
                            cb(null, model.executedCommands);
                        },
                        function (err, executedCommands) {
                            assert(!err);
                            executedCommands.should.eql(['$prerestore', 'my command', '$postrestore', 'my other command'])
                            done();
                        });

            });

    });

});