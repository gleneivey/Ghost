var express = require('express'),
    config = require('./config');

function buildServer(configValues) {
    var ghostMiddleware, message,
        promise = config.init(configValues, 'middleware');
    if (promise.isRejected()) {
        message = promise.reason();
        promise.catch(function () {});  // silence "Possibly unhandled" warnings
        throw message;
    }

    ghostMiddleware = express();
    return ghostMiddleware;
}

module.exports = buildServer;
