var repo = require('./index');


var repo = require('./index')({
    fileJournal: {
        path: './tmp/journal/log.txt'
    },    model: {count: 0}
});

repo.registerCommand('inc',function (model) {
    ++model.count;
});

repo.execute('inc', {when: new Date().getTime()});

repo.query(
    function (model) { return model.count; }, 
    function (err, count) { console.log('count='+count); });