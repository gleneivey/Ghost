/*globals describe, it, beforeEach, afterEach */
/*jshint expr:true*/
var Promise         = require('bluebird'),
    should          = require('should'),                           // jshint ignore:line
    _               = require('lodash'),
    rewire          = require('rewire'),
    GhostServer     = require('../../server/ghost-server'),

    // Thing we are testing
    middleware      = rewire('../../server/middleware');

describe('Express middleware module', function () {
    var defaultConfig = {database: {client: 'sqlite3'}};

    function cleanOutConfigManager() {
        var middlewaresConfig = middleware.__get__('config');
        _(_.keys(middlewaresConfig._config)).each(function (key) {
            delete middlewaresConfig[key];
        });
        middlewaresConfig._config = {};
    }

    function shouldBeAnInstanceOfExpress(express) {
        // first-order duck typing for an express server
        express.should.be.a.function;
        express.length.should.equal(3, 'a real express server function has an arity of 3');
        express.request.should.be.an.object;
        express.response.should.be.an.object;
    }

    // alternatively we could stub server/index#setupFromConfigPromise or there-abouts, but
    //   for just two tests, the performance gain doesn't seem worth the loss of coverage
    function waitForTheConfigurationPromiseToResolve(middlewareInstance, done) {
        var promise = middlewareInstance.ghostPromise;
        promise.then(function () {
            done();
        }).catch(function (error) {
            error.should.equal('In this test, the promise should never be rejected.');
        });
    }

    beforeEach(function () {
        cleanOutConfigManager();
    });

    it('returns an Express server instance when called', function (done) {
        var middlewareInstance = middleware(defaultConfig);
        shouldBeAnInstanceOfExpress(middlewareInstance);

        waitForTheConfigurationPromiseToResolve(middlewareInstance, done);
    });

    it('extends the middleware instance to provide access to Ghost\'s initialization promise', function (done) {
        var middlewareInstance = middleware(defaultConfig);
        middlewareInstance.ghostPromise.should.be.an.instanceOf(Promise);

        waitForTheConfigurationPromiseToResolve(middlewareInstance, done);
    });

    it('asynchronously initializes the middleware', function (done) {
        var ghostInitializationPromise = middleware(defaultConfig).ghostPromise;
        ghostInitializationPromise.then(function (ghostServerInstance) {
            ghostServerInstance.should.be.an.instanceOf(GhostServer);
            done();
        }).catch(function (error) {
            error.should.be.null;
        });
    });

    describe('delays request handling until', function () {
        afterEach(function () {
            middleware = rewire('../../server/middleware');
        });

        it('after the middleware is initialized', function (done) {
            var ghostInstance,
                ghostInitializationPromise,
                serverConfigPromise,
                serverConfigResolver,
                req, res,
                mockServer,

                expectedMountpath = '/a/mount/path',
                expectedExpressParent = function () {},

            // build a log of the order in which events actually occurred
                sequenceOfOperations = [];

            // set stubs and spies to log events occurring within Ghost
            //   (ones that go into Ghost's dependencies)
            middleware.__set__('logStartMessages', function () {
                sequenceOfOperations.push('logged start message');
            });
            serverConfigPromise = new Promise(function (fn) {
                serverConfigResolver = function () { fn(); };
            });
            middleware.__get__('config').init = function () { return serverConfigPromise; };
            mockServer = function (req, res, next) {
                mockServer.mountpath.should.equal(expectedMountpath);
                mockServer.parent.should.equal(expectedExpressParent);

                sequenceOfOperations.push('handled request');
                next();
            };
            middleware.__get__('ghost').setupMiddleware = function (configInfoPromise) {
                var allDonePromise = configInfoPromise.then(function () { });
                return [allDonePromise, mockServer];
            };

            // generate 'from outside of Ghost' activity in order for situation under test
            //   -- first, start Ghost initializing
            sequenceOfOperations.push('started initialization');
            ghostInstance = middleware(defaultConfig);
            ghostInstance.mountpath = expectedMountpath;
            ghostInstance.parent = expectedExpressParent;
            ghostInitializationPromise = ghostInstance.ghostPromise;

            // set stubs and spies to log events occurring within Ghost
            //   (ones attached the middleware instance itself)
            ghostInitializationPromise.then(function () {
                sequenceOfOperations.push('finished initialization');
            });
            function assertionsAtEnd() {
                // verify that Ghost did its bits at the right points in the sequence
                sequenceOfOperations.should.eql([
                    'started initialization',
                    'made request',
                    'finished long-running initialization step',
                    'logged start message',
                    'finished initialization',
                    'handled request'
                ]);
                done();
            }

            //   -- next, simulate a request coming to us through the parent Express app
            req = {path: '/', url: '/', params: {}, route: {}};
            res = {
                locals: {},
                setHeader: function () {}
            };
            sequenceOfOperations.push('made request');
            ghostInstance(req, res, assertionsAtEnd);

            //   -- then, allow Ghost's initialization process to complete
            sequenceOfOperations.push('finished long-running initialization step');
            serverConfigResolver();
        });
    });

    it('it includes the "asMiddleware" flag in the configuration loaded', function (done) {
        var middlewareInstance = middleware(defaultConfig);
        middleware.__get__('config').asMiddleware.should.be.true;

        waitForTheConfigurationPromiseToResolve(middlewareInstance, done);
    });

    it('fails if it is given a bad configuration', function () {
        function createMiddlewareWithBadConfiguration() {
            return middleware({});
        }

        createMiddlewareWithBadConfiguration.should.throw('invalid database configuration');
    });

    describe('isSSLRequired', function () {
        var isSSLrequired = middleware.isSSLrequired;

        it('SSL is required if config.url starts with https', function () {
            isSSLrequired(undefined, 'https://example.com', undefined).should.be.true;
        });

        it('SSL is required if isAdmin and config.forceAdminSSL is set', function () {
            isSSLrequired(true, 'http://example.com', true).should.be.true;
        });

        it('SSL is not required if config.url starts with "http:/" and forceAdminSSL is not set', function () {
            isSSLrequired(false, 'http://example.com', false).should.be.false;
        });
    });

    describe('sslForbiddenOrRedirect', function () {
        var sslForbiddenOrRedirect = middleware.sslForbiddenOrRedirect;
        it('Return forbidden if config forces admin SSL for AdminSSL redirect is false.', function () {
            var response = sslForbiddenOrRedirect({
                forceAdminSSL: {redirect: false},
                configUrl: 'http://example.com'
            });
            response.isForbidden.should.be.true;
        });

        it('If not forbidden, should produce SSL to redirect to when config.url ends with no slash', function () {
            var response = sslForbiddenOrRedirect({
                forceAdminSSL: {redirect: true},
                configUrl: 'http://example.com/config/path',
                reqUrl: '/req/path'
            });
            response.isForbidden.should.be.false;
            response.redirectUrl({}).should.equal('https://example.com/config/path/req/path');
        });

        it('If config ends is slash, potential double-slash in resulting URL is removed', function () {
            var response = sslForbiddenOrRedirect({
                forceAdminSSL: {redirect: true},
                configUrl: 'http://example.com/config/path/',
                reqUrl: '/req/path'
            });
            response.redirectUrl({}).should.equal('https://example.com/config/path/req/path');
        });

        it('If config.urlSSL is provided it is preferred over config.url', function () {
            var response = sslForbiddenOrRedirect({
                forceAdminSSL: {redirect: true},
                configUrl: 'http://example.com/config/path/',
                configUrlSSL: 'https://example.com/ssl/config/path/',
                reqUrl: '/req/path'
            });
            response.redirectUrl({}).should.equal('https://example.com/ssl/config/path/req/path');
        });

        it('query string in request is preserved in redirect URL', function () {
            var response = sslForbiddenOrRedirect({
                forceAdminSSL: {redirect: true},
                configUrl: 'http://example.com/config/path/',
                configUrlSSL: 'https://example.com/ssl/config/path/',
                reqUrl: '/req/path'
            });
            response.redirectUrl({a: 'b'}).should.equal('https://example.com/ssl/config/path/req/path?a=b');
        });
    });
});
