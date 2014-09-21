var highlander = require('./../index'),
    nomnom = require('nomnom'),
    fs = require('fs');

var opts = nomnom
    .option('reset', {
        abbr: 'r',
        flag: true,
        help: 'Clear repository (ie remove log file)'
    })
    .option('scan', {
        abbr: 's',
        flag: true,
        help: 'Scan log file using API'
    }).parse();


var repo = highlander.repository({
        model: {
            startCount: 0
        },
        journal: highlander.fileJournal({
            path: 'samples.log'
        })
    })
    .registerCommand('start', function (ctx) {
        ++ctx.model.startCount;
    });

function reset(next) {
    console.log('== Removing %s', repo.journal.options.path);
    fs.unlink(repo.journal.options.path, function (err) {
        if (err) {
            console.error(err);
        }
        next();
    });
}

function scan(next) {
    console.log('== Scanning');

    repo.journal.replay()
        .on('command', function (cmd) {
            console.log(cmd);
        })
        .on('done', next);
}

function registerStarted(next) {
    repo.execute('start', {t: new Date().getTime()}, next);
}

function showStartCount(next) {
    repo.query(
        function (model) {
            return model.startCount;
        },
        function (err, startCount) {
            console.log('== Info');
            console.log('According to repository, this process was started %d times', startCount);
            next();
        });
}


function composedInvoke(chain) {
    (function next() {
        var f = chain.shift();
        if (f) {
            f(next);
        }
    })();
}

var chain = [
    registerStarted,
    opts.scan ? scan : null,
    opts.reset ? reset : null,
    showStartCount
].filter(function (v) {
    return v;
});
composedInvoke(chain);