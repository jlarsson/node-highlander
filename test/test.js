var Promise = require('bluebird');
var _ = require('lodash');
var assert = require('assert');
var mkdirp = Promise.promisify(require('mkdirp'));
var rmrf = Promise.promisify(require('rimraf'));
var highlander = require('../')

describe('highlander', function() {
  'use strict';

  var testFolder = './tmp';
  var testJournal = './tmp/test.journal';
  var repo;

  function createRepo() {
    return highlander({
      path: testJournal
    });
  }
  beforeEach(function(done) {
    rmrf(testFolder)
      .then(mkdirp.bind(null, testFolder))
      .then(function() {
        repo = createRepo()
      })
      .then(done);
  })
  afterEach(function(done) {
    return done();
    rmrf(testFolder)
      .then(done);
  });

  describe('commands', function() {
    it('must be registered before called', function(done) {
      repo.execute({
          name: 'set-x'
        })
        .then(function() {
          assert.fail('expected error');
        })
        .catch(highlander.Error, function(e) {
          done();
        })
        .catch(done);
    })

    it('commands are logged in journal', function(done) {
      var logIsCalled = false;
      repo.journal = {
        replay: function() {
          return Promise.fulfilled();
        },
        log: function() {
          logIsCalled = true;
        }
      };

      repo.register({
          name: 'set-x'
        })
        .then(function() {
          return repo.execute({
            name: 'set-x'
          });
        })
        .then(function() {
          assert(logIsCalled);
        })
        .then(done)
        .catch(done);
    })

    it('validate is called before logging', function(done) {
      repo.journal = {
        replay: function() {
          return Promise.fulfilled();
        },
        log: function() {
          assert.fail('log() should not be called i validation fails');
        }
      };
      repo.register({
          name: 'set-x',
          validate: function(ctx) {
            var validationError = new Error('Validation failed');
            validationError.isValidationError = true;
            throw validationError;
          }
        })
        .then(function() {
          return repo.execute({
            name: 'set-x'
          });
        })
        .then(function (){
          return assert.fail('Validation should have failed');
        })
        .catch(function(e) {
          assert(e.isValidationError,'Expected validation error');
        })
        .then(done)
        .catch(done);
    })

    it('first command execution triggers journal replay', function(done) {
      var replayCallCount = false;
      repo.journal = {
        replay: function() {
          ++replayCallCount;
          return Promise.fulfilled();
        },
        log: function() {}
      };

      repo.register({
          name: 'set-x'
        })
        .then(function firstExecute() {
          return repo.execute({
            name: 'set-x'
          });
        })
        .then(function() {
          assert(replayCallCount === 1);
        })
        .then(function secondExecute() {
          return repo.execute({
            name: 'set-x'
          });
        })
        .then(function() {
          assert(replayCallCount === 1);
        })
        .then(done)
        .catch(done);

    })
  })

  describe('concurrency', function() {
    it('queries are read locked (multiple readers)', function(done) {
      var N = 10;
      var invocations = 0;
      var concurrency = 0;
      var maxConcurrency = 0;
      var queries = _.range(0, N).map(function(i) {
        return repo.query(function() {
          // track number of active queries
          ++invocations;
          ++concurrency;
          maxConcurrency = Math.max(maxConcurrency, concurrency);
          // stay alive a while before returning
          return Promise.delay(50)
            .then(function() {
              --concurrency;
            });

        })
      });
      Promise.all(queries)
        .then(function() {
          assert(maxConcurrency == N);
          assert(invocations === N);
          done();
        })
        .catch(done);
    })
    it('commands are write locked (atmost 1 writer)', function(done) {
      var N = 5;
      var invocations = 0;
      var concurrency = 0;
      var maxConcurrency = 0;
      repo.register({
        name: 'set-x',
        execute: function(ctx) {
          // track number of active commands
          ++invocations;
          ++concurrency;
          maxConcurrency = Math.max(maxConcurrency, concurrency);
          // stay alive a while before returning
          return Promise.delay(50)
            .then(function() {
              --concurrency;
            });
        }
      })
      var commands = _.range(0, N).map(function(i) {
        return repo.execute({
          name: 'set-x',
          argument: 123
        });
      })

      Promise.all(commands)
        .then(function() {
          assert(maxConcurrency === 1);
          assert(invocations === N);
          done();
        })
        .catch(done);
    });

    it('queries and commands can be interleaved (1 writer or N readers)', function(done) {
      var N = 15;
      var invocations = 0;
      var readerCount = 0;
      var writerCount = 0;
      repo.register({
        name: 'set-x',
        execute: function(ctx) {
          ++invocations;
          assert(readerCount === 0);
          assert(writerCount === 0);
          ++writerCount;
          return Promise.delay(50)
            .then(function() {
              --writerCount;
            });
        }
      })

      var actions = _.range(0, N).map(function(i) {
        if ((i % 4) === 0) {
          return repo.execute({
            name: 'set-x',
            argument: 123
          });
        }
        return repo.query(function(ctx) {
          ++invocations;
          assert(writerCount === 0);
          ++readerCount;
          return Promise.delay(50)
            .then(function() {
              --readerCount;
            });
        });
      });
      Promise.all(actions)
        .then(function() {
          assert(readerCount === 0);
          assert(writerCount === 0);
          assert(invocations === N);
          done();
        })
        .catch(done);
    })

  })

  describe("Happy path", function() {
    it("register command, execute it and query model", function(done) {
      repo.register({
          name: 'inc',
          execute: function(ctx) {
            var model = ctx.model;
            var argument = ctx.argument;
            return model[argument.prop] = (model[argument.prop] || 0) + argument.count;
          }
        })
        .then(function execute_a_command() {
          return repo.execute({
            name: 'inc',
            argument: {
              prop: 'x',
              count: 10
            }
          })
        })
        .then(function verify_command_result(v) {
          assert(v === 10);
        })
        .then(function query_the_model() {
          return repo.query(function(ctx) {
            return ctx.model.x;
          });
        })
        .then(function verify_query_result(v) {
          assert(v === 10);
        })
        .then(done)
        .catch(done);
    })
  })

});
