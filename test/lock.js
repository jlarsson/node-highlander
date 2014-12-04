var Promise = require('bluebird');
var should = require('should');
var assert = require('assert');
var _ = require('lodash');
var Lock = require('../').Lock;


describe('lock', function() {
  'use strict';

  function createState() {
    return {
      readers: 0,
      writers: 0,
      invocations: 0,
      concurrency: 0,
      maxReaders: 0,
      maxWriters: 0,
      maxConcurrency: 0
    }
  }

  function createReaders(lock, count, state) {
    return _.range(0, count).map(function(i) {
      return lock.readLock(function() {
        ++state.readers;
        ++state.invocations;
        ++state.concurrency;
        state.maxConcurrency = Math.max(state.maxConcurrency, state.concurrency);
        state.maxReaders = Math.max(state.maxReaders, state.readers);
        return Promise.delay(50)
          .then(function() {
            assert(state.writers === 0, 'no writer should be active while reading');
            --state.concurrency;
            --state.readers;
          });
      }, '' + i);
    });
  }

  function createWriters(lock, count, state) {
    return _.range(0, count).map(function(i) {
      return lock.writeLock(function() {
        ++state.writers;
        ++state.invocations;
        ++state.concurrency;
        state.maxConcurrency = Math.max(state.maxConcurrency, state.concurrency);
        state.maxWriters = Math.max(state.maxWriters, state.writers);
        return Promise.delay(50)
          .then(function() {
            assert(state.readers === 0, 'no reader should be active while writing');
            --state.concurrency;
            --state.writers;
            assert(state.writers === 0, 'no other writer should be active while writing');
          });
      }, '' + i);
    });
  }

  it('allows simultaneous readers', function(done) {
    var lock = Lock();
    var N = 10;
    var state = createState();
    var readers = createReaders(lock, N, state);

    Promise.all(readers)
      .then(function() {
        assert(state.readers === 0);
        assert(state.maxConcurrency === N);
        assert(state.maxReaders == N);
        assert(state.invocations === N);
        done();
      })
      .catch(done);
  })

  it('prevents simultaneous writers', function(done) {
    var lock = Lock();
    var N = 5;
    var state = createState();
    var writers = createWriters(lock, N, state);

    Promise.all(writers)
      .then(function() {
        assert(state.writers === 0);
        assert(state.maxConcurrency == 1);
        assert(state.invocations === N);
        done();
      })
      .catch(done);
  })

  it('serializes readers and writers', function(done) {
    var lock = Lock();
    var state = createState();

    var all = createReaders(lock, 5, state)
      .concat(createWriters(lock, 2, state))
      .concat(createReaders(lock, 5, state));

    Promise.all(all)
      .then(function() {
        assert(state.readers === 0);
        assert(state.maxReaders === 5);

        assert(state.writers === 0);
        assert(state.maxWriters === 1);

        assert(state.maxConcurrency == 5);
        assert(state.invocations === all.length);
        done();
      })
      .catch(done);
  })
});
