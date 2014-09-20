require('./../index')
    .repository({
        fileJournal: {
            path: './tmp/journal/log.txt'
        },
        model: {
            count: 0
        }
    })
    .registerCommand('inc', function (model) { ++model.count; })
    .execute('inc', {when: new Date().getTime()})
    .query(
        function (model) { return model.count; },
        function (err, count) { console.log('count=' + count); });