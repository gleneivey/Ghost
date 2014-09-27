var
//    express = require('express'),
//    Promise = require('bluebird'),
    config = require('./config'),
    ghost = require('./index');

function buildServer(configValues) {
    var setupResults, message,
        promise = config.init(configValues, 'middleware'),
        ghostPromise, middlewareInstance;

    if (promise.isRejected()) {
        message = promise.reason();
        promise.catch(function () {});  // silence "Possibly unhandled" warnings
        throw message;
    }

    setupResults = ghost.setupMiddleware(promise);
    ghostPromise = setupResults[0];
    middlewareInstance = setupResults[1];
    middlewareInstance.getGhostPromise = function () {
        return ghostPromise;
    };

    return middlewareInstance;
}

module.exports = buildServer;
