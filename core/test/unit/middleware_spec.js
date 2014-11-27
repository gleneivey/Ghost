/*globals describe, beforeEach, afterEach, it*/
/*jshint expr:true*/
var express         = require('express'),
    assert          = require('assert'),
    should          = require('should'),
    sinon           = require('sinon'),
    rewire          = require('rewire'),
    _               = require('lodash'),
    defaultConfig   = require('../../../config.example')[process.env.NODE_ENV],

    // Thing we are testing
    setupMiddleware = rewire('../../server/middleware/index'),
    middleware      = setupMiddleware.middleware;

describe('Middleware', function () {
    var sandbox;
    beforeEach(function () { sandbox = sinon.sandbox.create(); });
    afterEach(function () { sandbox.restore(); });

    // TODO: needs new test for ember admin
    // describe('redirectToDashboard', function () {
    //     var req, res;

    //     beforeEach(function () {
    //         req = {
    //             session: {}
    //         };

    //         res = {
    //             redirect: sinon.spy()
    //         };
    //     });

    //     it('should redirect to dashboard', function () {
    //         req.session.user = {};

    //         middleware.redirectToDashboard(req, res, null);
    //         assert(res.redirect.calledWithMatch('/ghost/'));
    //     });

    //     it('should call next if no user in session', function (done) {
    //         middleware.redirectToDashboard(req, res, function (a) {
    //             should.not.exist(a);
    //             assert(res.redirect.calledOnce.should.be.false);
    //             done();
    //         });
    //     });
    // });

    describe('setupMiddleware', function () {
        var config;

        beforeEach(function () {
            config = setupMiddleware.__get__('config');
            config.set(_.merge({}, defaultConfig));      // isolate us from previously-run unit test file(s)
        });

        describe('when Ghost is used as an Express middleware component itself', function () {
            var useStub, blogApp, adminApp, error404, error500;

            beforeEach(function () {
                // be middleware
                config.asMiddleware = true;
                delete config.server;

                blogApp = express();
                adminApp = express();
                error404 = setupMiddleware.__get__('errors').error404;
                error500 = setupMiddleware.__get__('errors').error500;

                useStub = sandbox.stub(blogApp, 'use');
                sandbox.stub(setupMiddleware.__get__('oauth'), 'init');  // would need lots more setup to run in tests
            });

            it('installs setPathsFromMountpath as the very first middleware used', function () {
                var error,
                    shortCircuit = 'don\'t bother finishing initialization in this test';
                useStub.throws(shortCircuit);

                try {
                    setupMiddleware(blogApp, adminApp);
                } catch (e) {
                    error = e;
                }

                error.name.should.equal(shortCircuit);
                useStub.calledOnce.should.be.true;
                useStub.args[0][0].should.equal(middleware.setPathsFromMountpath);
            });

            describe('handles generate404s in the config', function () {
                it('should configure errors.error404 as middleware when config key missing', function (done) {
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error404).should.be.true;
                    done();
                });

                it('should configure errors.error404 as middleware when true', function (done) {
                    config.generate404s = true;
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error404).should.be.true;
                    done();
                });

                it('should NOT configure errors.error404 as middleware when false', function (done) {
                    config.generate404s = false;
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error404).should.be.false;
                    done();
                });
            });

            describe('handles generate500s in the config', function () {
                it('should configure errors.error500 as middleware when config key missing', function (done) {
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error500).should.be.true;
                    done();
                });

                it('should configure errors.error500 as middleware when true', function (done) {
                    config.generate500s = true;
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error500).should.be.true;
                    done();
                });

                it('should NOT configure errors.error500 as middleware when false', function (done) {
                    config.generate500s = false;
                    setupMiddleware(blogApp, adminApp);
                    useStub.calledWith(error500).should.be.false;
                    done();
                });
            });
        });
    });

    describe('cacheControl', function () {
        var res;

        beforeEach(function () {
            res = {
                set: sinon.spy()
            };
        });

        it('correctly sets the public profile headers', function (done) {
            middleware.cacheControl('public')(null, res, function (a) {
                should.not.exist(a);
                res.set.calledOnce.should.be.true;
                res.set.calledWith({'Cache-Control': 'public, max-age=0'});
                done();
            });
        });

        it('correctly sets the private profile headers', function (done) {
            middleware.cacheControl('private')(null, res, function (a) {
                should.not.exist(a);
                res.set.calledOnce.should.be.true;
                res.set.calledWith({
                    'Cache-Control':
                        'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'
                });
                done();
            });
        });

        it('will not set headers without a profile', function (done) {
            middleware.cacheControl()(null, res, function (a) {
                should.not.exist(a);
                res.set.called.should.be.false;
                done();
            });
        });
    });

    describe('whenEnabled', function () {
        var cbFn, blogApp;

        beforeEach(function () {
            cbFn = sinon.spy();
            blogApp = {
                enabled: function (setting) {
                    if (setting === 'enabled') {
                        return true;
                    } else {
                        return false;
                    }
                }
            };
            middleware.cacheBlogApp(blogApp);
        });

        it('should call function if setting is enabled', function (done) {
            var req = 1, res = 2, next = 3;

            middleware.whenEnabled('enabled', function (a, b, c) {
                assert.equal(a, 1);
                assert.equal(b, 2);
                assert.equal(c, 3);
                done();
            })(req, res, next);
        });

        it('should call next() if setting is disabled', function (done) {
            middleware.whenEnabled('rando', cbFn)(null, null, function (a) {
                should.not.exist(a);
                cbFn.calledOnce.should.be.false;
                done();
            });
        });
    });

    describe('staticTheme', function () {
        beforeEach(function () {
            sandbox.stub(middleware, 'forwardToExpressStatic').yields();
        });

        afterEach(function () {
            middleware.forwardToExpressStatic.restore();
        });

        it('should call next if hbs file type', function (done) {
            var req = {
                url: 'mytemplate.hbs'
            };

            middleware.staticTheme(null)(req, null, function (a) {
                should.not.exist(a);
                middleware.forwardToExpressStatic.calledOnce.should.be.false;
                done();
            });
        });

        it('should call next if md file type', function (done) {
            var req = {
                url: 'README.md'
            };

            middleware.staticTheme(null)(req, null, function (a) {
                should.not.exist(a);
                middleware.forwardToExpressStatic.calledOnce.should.be.false;
                done();
            });
        });

        it('should call next if json file type', function (done) {
            var req = {
                url: 'sample.json'
            };

            middleware.staticTheme(null)(req, null, function (a) {
                should.not.exist(a);
                middleware.forwardToExpressStatic.calledOnce.should.be.false;
                done();
            });
        });

        it('should call express.static if valid file type', function (done) {
            var req = {
                    url: 'myvalidfile.css'
                };

            middleware.staticTheme(null)(req, null, function (reqArg, res, next) {
                /*jshint unused:false */
                middleware.forwardToExpressStatic.calledOnce.should.be.true;
                assert.deepEqual(middleware.forwardToExpressStatic.args[0][0], req);
                done();
            });
        });
    });

    describe('checkSSL middleware', function () {
        var checkSSL = middleware.checkSSL,
            redirectCalled, nextCalled,
            mockResponse,
            nextFunction = function () { nextCalled = true; };

        beforeEach(function () {
            redirectCalled = nextCalled = false;
            mockResponse = {
                redirect: function () { redirectCalled = true; }
            };
        });

        it('passes the request on if it receives an HTTPS request', function () {
            var mockRequest = {secure: true};
            checkSSL(mockRequest, mockResponse, nextFunction);
            nextCalled.should.be.true;
            redirectCalled.should.be.false;
        });

        describe('receiving a non-SSL request', function () {
            var mockRequest = {secure: false};

            it('redirects to HTTPS if it is configured with an "https" url', function () {
                setupMiddleware.__get__('config').url = 'https://127.0.0.1:2369';
                checkSSL(mockRequest, mockResponse, nextFunction);
                nextCalled.should.be.false;
                redirectCalled.should.be.true;
            });

            it('passes the request on if there is no "url" in the configuration', function () {
                delete setupMiddleware.__get__('config').url;
                checkSSL(mockRequest, mockResponse, nextFunction);
                nextCalled.should.be.true;
                redirectCalled.should.be.false;
            });
        });
    });

    describe('setPathsFromMountpath middleware', function () {
        var setPathsFromMountpath, nextStub, config, mockRequest, newPath,
            restoreUrl, restoreConfigUrl, restoreThemeUrl;

        beforeEach(function () {
            // overwrite so we have access to middleware module's internal config
            middleware =
                setupMiddleware.middleware =
                    rewire('../../server/middleware/middleware');

            setPathsFromMountpath = middleware.setPathsFromMountpath;
            nextStub = sinon.stub();
            config = middleware.__get__('config');
            newPath = '/our/site/blog';

            mockRequest = {
                protocol: 'proto',
                baseUrl: newPath,
                get: function () { return 'locohostle:42'; }
            };

            restoreConfigUrl = config._config.url;
            restoreUrl = config.url;
            restoreThemeUrl = config.theme.url;
        });

        afterEach(function () {
            nextStub.called.should.be.true;

            // restore global state for subsequent tests
            config._config.url = restoreConfigUrl;
            config.url = restoreUrl;
            config.theme.url = restoreThemeUrl;
        });

        it('copies from blogApp.mountpath to config fields', function () {
            var expectedUrl = 'proto://locohostle:42/our/site/blog';
            middleware.__set__('blogApp', {mountpath: newPath});
            config.paths.subdir.should.not.equal(newPath);

            setPathsFromMountpath(mockRequest, {}, nextStub);
            config.paths.subdir.should.equal(newPath);
            config.theme.url.should.equal(expectedUrl);
            config.url.should.equal(expectedUrl);
            config._config.url.should.equal(expectedUrl);
        });

        it('makes subdir empty if the mountpath is root', function () {
            middleware.__set__('blogApp', {mountpath: '/'});
            setPathsFromMountpath(mockRequest, {}, nextStub);
            config.paths.subdir.should.equal('');
        });
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
