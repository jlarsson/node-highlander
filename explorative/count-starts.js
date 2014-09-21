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
            getCommandHandler: function (name){ return function (){console.log('skipping unknown command %s',name); }}
        })
    })
    .registerCommand('started', function (model) { ++model.count; })
    .execute('started', {when: new Date().getTime()})
    .query(
        function (model) { return model.count; },
        function (err, count) { console.log('count=' + count); });
