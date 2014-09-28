/*jslint node: true */
/*global describe,it*/
'use strict';

var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');
/*

describe('$prestore command is called before any ', function () {
    function createRepo(journal) {
        return highlander.repository({
            journal: journal,
            model: {
                executedCommands: []
            }
        })
            .registerCommand('$prerestore', function (ctx) {
                console.log('$pre');
                ctx.model.executedCommands.push('$prerestore');
            })
            .registerCommand('$postrestore', function (ctx) {
                console.log('$post');
                ctx.model.executedCommands.push('$postrestore');
            })
            .registerCommand('my command', function (ctx) {
                console.log('$my command');
                ctx.model.executedCommands.push('my command');
            });
    }

    // setup a shared in-memory journal
    var journal = highlander.memoryJournal();

    it('doh!', function (done) {
        createRepo(journal)
            .query(function (model) {
                    return model.executedCommands;
                },
                function (err, executedCommands) {
                    console.log('err:', err);
                    console.log('executedCommands:', executedCommands);
                    assert(!err);
                    executedCommands.should.eql(['$prerestore', '$postrestore'])
                    done();
                });

    });
});*/