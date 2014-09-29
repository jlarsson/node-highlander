/*jslint node: true */
/*global describe,it*/
'use strict';

var assert = require('assert'),
    highlander = require('./../index'),
    should = require('should');


describe('synchronous api', function () {
    it('command handlers may skip callback parameter and instead return value', function (done) {
        highlander.repository()
            .registerCommand('cmd', function (a) {
                return 'cmd was called';
            })
            .execute('cmd', null, function (err, message) {
                assert.equal('cmd was called', message);
                done();
            });
    });

    it('validators may throw', function (done) {
        highlander.repository()
            .registerCommand('cmd', {
                validate: function () {
                    throw 'test validation failed!';
                },
                execute: function () {}
            })
            .execute('cmd', null, function (err, message) {
                assert.equal(err, 'test validation failed!');
                done();
            });
    });

    it('queries may throw', function (done) {
        highlander.repository()
            .query(function () {
                throw 'test query failed';
            }, function (err, message) {
                assert.equal(err, 'test query failed');
                done();
            });
    });

    it('queries may skip callback parameter and instead return value', function (done) {
        highlander.repository()
            .query(function () {
                return 'hooray';
            }, function (err, message) {
                assert.equal(message, 'hooray');
                done();
            });
    });
});