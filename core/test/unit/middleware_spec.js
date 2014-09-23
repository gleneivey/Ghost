/*globals describe, beforeEach, afterEach, before, it*/
/*jshint expr:true*/
var assert          = require('assert'),
    should          = require('should'),
    sinon           = require('sinon'),
    express         = require('express'),
    rewire          = require('rewire'),
    _               = require('lodash'),

    // Stuff we are testing
    middlewareSetup = rewire('../../server/middleware'),
    middleware      = middlewareSetup.middleware;

describe('Middleware', function () {
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
            sinon.stub(middleware, 'forwardToExpressStatic').yields();
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

    describe('middleware', function () {
        var sandbox, rootServer, adminServer, useSpy, error404, config;
        before(function () {
            config = middlewareSetup.__get__('config');
            // restore state of config object from changes made in other tests
            _.merge(config, config._config);
        });

        beforeEach(function () {
            error404 = middlewareSetup.__get__('errors').error404;

            sandbox = sinon.sandbox.create();
            rootServer = express();
            adminServer = express();
            useSpy = sandbox.stub(rootServer, 'use');

            // don't let the middlewareSetup function run stuff the test isn't set up for
            sandbox.stub(middlewareSetup.__get__('oauth'), 'init');
        });

        afterEach(function () {
            sandbox.restore();
        });

        describe('interpretation of generate404s key in configuration', function () {
            it('should configure errors.error404 as middleware when config key missing', function (done) {
                middlewareSetup(rootServer, adminServer);
                useSpy.calledWith(error404).should.be.true;
                done();
            });

            it('should configure errors.error404 as middleware when true', function (done) {
                config.generate404s = true;
                middlewareSetup(rootServer, adminServer);
                useSpy.calledWith(error404).should.be.true;
                done();
            });

            it('should NOT configure errors.error404 as middleware when false', function (done) {
                config.generate404s = false;
                middlewareSetup(rootServer, adminServer);
                useSpy.calledWith(error404).should.be.false;
                done();
            });
        });
    });
});
