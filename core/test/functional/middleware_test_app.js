var express = require('express'),
    ghost = require('../../server/middleware'),

    ghostConfig = require('../../../config.example.js')[process.env.NODE_ENV],
    host = ghostConfig.server.host,
    port = ghostConfig.server.port,

    app;

delete ghostConfig.server;
delete ghostConfig.url;

app = express();
app.use('/', ghost(ghostConfig));   // mount at root so paths in tests work for middleware and non-middleware

console.log('Middleware test harness listening on ' + host + ':' + port);
app.listen(port, host);
