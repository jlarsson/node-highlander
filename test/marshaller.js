var Promise = require('bluebird');
var should = require('should');
var assert = require('assert');
var Marshaller = require('../').Marshaller;


describe("marshaller", function() {
  'use strict';

  function testStrictEqual(value) {
    return function test(done) {
      var marshaller = Marshaller();
      marshaller.marshal(value)
        .then(function(marshalledValue) {
          assert(value === marshalledValue);
          done();
        })
        .catch(done);
    }
  }

  function testCopied(value) {
    return function test(done) {
      var marshaller = Marshaller();
      marshaller.marshal(value)
        .then(function(marshalledValue) {
          assert(value !== marshalledValue);
          value.should.eql(value);
          done();
        })
        .catch(done);
    }
  }

  it("marshals undefined", testStrictEqual(undefined));
  it("marshals null", testStrictEqual(null));
  it("marshals numbers", testStrictEqual(123));
  it("marshals strings", testStrictEqual('hello world'));
  it("marshals objects", testCopied({
    a: 1,
    b: [1, 2, 3]
  }));

  it("allows objects to marshal them selves by defining marshal() member", testStrictEqual({
    a: 1,
    b: [1, 2, 3],
    marshal: function (){ return this; }
  }));
  it("ignores marshal member if not a function", testCopied({
    a: 1,
    b: [1, 2, 3],
    marshal: 123
  }));

})
