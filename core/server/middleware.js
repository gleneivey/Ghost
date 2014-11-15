require('./utils/startup-check').check();

var express = require('express'),
    _       = require('lodash'),
    config  = require('./config'),
    ghost   = require('./index');

function logStartMessages() {
    console.log('Ghost middleware configured and ready to serve requests'.green);
    if (process.env.NODE_ENV !== 'production') {
        console.log(('Ghost is running in environment "' + process.env.NODE_ENV + '"...').grey);
    }
}

function buildServer(configValues) {
    var setupResults, message,
        promise = config.init(_.merge(configValues, {asMiddleware: true}), 'middleware'),
        ghostPromise,
        actualGhostInstance,
        startupTimingWrapper;

    if (promise.isRejected()) {
        message = promise.reason();
        promise.catch(function () {});  // silence "Possibly unhandled" warnings
        throw message;
    }

    setupResults = ghost.setupMiddleware(promise);
    ghostPromise = setupResults[0];
    actualGhostInstance = setupResults[1];

    ghostPromise.then(logStartMessages);
    startupTimingWrapper = express();
    startupTimingWrapper.use(
        function (req, res, next) {
            ghostPromise.then(function () {
                // let Ghost know where it's really mounted
                actualGhostInstance.mountpath = startupTimingWrapper.mountpath;
                actualGhostInstance.parent = startupTimingWrapper.parent;

                actualGhostInstance(req, res, next);
            });
        }
    );

    startupTimingWrapper.ghostPromise = ghostPromise;
    return startupTimingWrapper;
}

module.exports = buildServer;
