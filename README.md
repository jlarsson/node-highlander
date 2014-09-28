# node-highlander
Prevalence layer for node.

# Installation

`npm i highlander`

## Designed for simplicity
node-highlander is a simple implementation of [System Prevalence](http://en.wikipedia.org/wiki/System_Prevalence). As such it can be used as

- a database (persistent, transactional)
- a building block for simplified CQRS or Event Sourcing (since Prevalence, when not picky about theory or full set of features, can be seen a a special case where there is exactly one aggregate)  


Use it if you appreciate that

- data schema is in your code
- performance is through the roof since all data is in main memory
- its easily maintable/readable/hackable since all history (of data modifications) are kept in a journal
	- typically a plain text file in production
	- typically a copy of the production file in development
	- in-memory in testing scenarios  
 
Dont use it

- for distributed, clustered, or otherwise non-monolithic systems
- without proper TDD
- without a basic understanding of the Prevalence pattern  

## Ok, show me the code!

Setup a repository that is backed to disk with

    var highlander = require('highlander');
    var repo = highlander.repository({
    	journal: highlander.fileJournal({path: 'data.log'}),
    	model: {todos: []} 
    });

Define a command (add todo):

`repo.registerCommand('add todo',function (ctx, cb){ ctx.model.todos.push(ctx.args); cb(); });` 

Add a todo by executing a command:

    repo.execute('add todo',{text: 'buy milk'}, function (err, data) {
    	if (err) { 
    		console.error(err); 
    	}
    });

List all todos:

    repo.query(
		function (model, cb) { cb(null, model.todos); },
		function (err, todos) {
			if (err){
				return console.error(err);
			}
			for (var i = 0; i < todos.length; ++i){
				console.log(todos[i].text);
			}
		});

# API
## repository(options)
Create a new repository instance. All members of options are optional with reasonable defaults:

- `model` - the application state, defaults to `{}`
- `commandRegistry` - registered commands
- `synchronizer` - reader/writer locks
- `marshaller` - marshalling of data between model/repository and application
- `journal` - persistent history of commands, defaults to in-memory journal.   

## repository.execute(name, args, callback)
Invoke asynchronously a named command with specified arguments.
The callback (optional) should be have the form `function (err, result) {...}`.

## repository.query(fn, callback)
Invoke a query asynchronously.

The query predicate (`fn`) should have the form `function (model, cb) {...}`, and is assumed to have no side effects on the model. `fn` must report result with a call to `cb(<err>,<result>)`.
The callback `callback` (optional) should be have the form `function (err, result) {...}`.

    repository.query(
        function (model, cb) {
            var result = calculateResult(model);
            cb(null, result);
        },
        function (err, result) {
            console.log(result);
        });


## repository.registerCommand(name, handler)
Register a command. Handler must be on the form

- `function (context, cb) {...}`
- `{execute: function (context, cb) {...}}`
- `{execute: function (context, cb) {...}, validate: function (context, cb) {...}}`     

Context is setup to
 
    {
    	model: <the model>,
    	command: <name of invoked command>,
    	args: <supplied command arguments>
    }  
    
### validators - validate(ctx,cb)
Validators are called before executors. 

    function (ctx, cb){
        if (argumentsAreInconsistentWithModel(ctx.args, ctx.model){
            return cb('Validation error');
        }
        cb();
    }


Also, validators may `throw` in case of failed validation.

    function (ctx, cb){
        if (argumentsAreInconsistentWithModel(ctx.args, ctx.model){
            throw 'Validation error';
        }
    }

### executors - execute(ctx, cb)
Executors may freely inspect the context parameter. In particular, they are assumed to modify `context.model` in a meaningful way. 

    function (ctx, cb) {
        ctx.model.gizmo = ctx.args.gizmo;
        cb(null,ctx.model.gizmo);
    }


## Why asynchronous when all state is in main memory anyways?

- Execution of a command involves writing a log entry, possibily to disk or other external storage. This is in node an inherently asynchronoius operation
- Execution of commands and queries are serialized using reader/writer locks. Thus the actual execution might be deferred due to synchronization. 

To avoid nasty race conditions, results from commands and queries are marshalled (ie deep copied).

# Why no snapshots?
node-highlander does not support snapshots, since

- snapshotting a live in memory representation to Json would restrict the model to NOT contain any cycles.
- anything related to runtime behaviour of the model (classes, prototypes etc) would be lost in a restore from snapshot.
  
