require('./utils/startup-check').check();

var _      = require('lodash'),
    config = require('./config'),
    ghost  = require('./index');

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

    return middlewareInstance;
}

module.exports = buildServer;
