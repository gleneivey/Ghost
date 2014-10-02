require('./utils/startup-check').check();

var _      = require('lodash'),
    config = require('./config'),
    ghost  = require('./index');

function logStartMessages() {
    console.log('Ghost middleware configured and ready to serve requests'.green);
    if (process.env.NODE_ENV !== 'production') {
        console.log(('Ghost is running in environment "' + process.env.NODE_ENV + '"...').grey);
    }
}

function buildServer(configValues) {
    var setupResults, message,
        promise = config.init(_.merge(configValues, {asMiddleware: true}), 'middleware'),
        ghostPromise, middlewareInstance;

    if (promise.isRejected()) {
        message = promise.reason();
        promise.catch(function () {});  // silence "Possibly unhandled" warnings
        throw message;
    }

    setupResults = ghost.setupMiddleware(promise);
    ghostPromise = setupResults[0];
    middlewareInstance = setupResults[1];
    middlewareInstance.ghostPromise = ghostPromise;

    ghostPromise.then(logStartMessages);

    return middlewareInstance;
}

module.exports = buildServer;
