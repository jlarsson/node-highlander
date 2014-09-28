var highLander = require('./../index');
highLander
    .repository({
        fileJournal: {
            path: './explorative/journal/log.txt'
        },
        model: {
            count: 0
        },
        commandRegistry: highLander.commandRegistry({
            resolveMissingCommandHandler: function (ctx) {
                return function () {
                    console.log('skipping unknown command \'%s\'', ctx.command);
                }
            }
        })
    })
    .registerCommand('started', function (ctx, cb) {
        ++ctx.model.count;
        cb();
    })
    .execute('started', {
        when: new Date().getTime()
    })
    .query(
        function (model, cb) {
            cb(null,model.count);
        },
        function (err, count) {
            console.log('count=' + count);
        });