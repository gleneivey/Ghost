/*globals describe, beforeEach, afterEach, it*/
/*jshint expr:true*/
var express         = require('express'),
    assert          = require('assert'),
    should          = require('should'),
    sinon           = require('sinon'),
    rewire          = require('rewire'),

    // Thing we are testing
    setupMiddleware = rewire('../../server/middleware/index'),
    middleware      = setupMiddleware.middleware;

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

    describe('setup of Ghost\'s middleware components', function () {
        describe('when Ghost is used as an Express middleware component itself', function () {
            beforeEach(function () {
                sinon.stub(setupMiddleware.__get__('oauth'), 'init');  // would need lots more setup to run in tests
                delete setupMiddleware.__get__('config').server;
            });

            it('installs setSubdirPath as the very first middleware used', function () {
                var error,
                    blogApp = express(),
                    shortCircuit = 'don\'t bother finishing initialization in this test';
                sinon.stub(blogApp, 'use').throws(shortCircuit);

                try {
                    setupMiddleware(blogApp, express());
                } catch (e) {
                    error = e;
                }

                error.name.should.equal(shortCircuit);
                blogApp.use.calledOnce.should.be.true;
                blogApp.use.args[0][0].should.equal(middleware.setSubdirPath);
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

    describe('setSubdirPath middleware', function () {
        var setSubdirPath, nextStub, config;

        beforeEach(function () {
            setSubdirPath = middleware.setSubdirPath;
            nextStub = sinon.stub();
            config = setupMiddleware.__get__('config');
        });

        afterEach(function () {
            nextStub.called.should.be.true;
        });

        it('copies from blogApp.mountpath to config.paths.subdir', function () {
            var newPath = '/our/site/blog';

            setupMiddleware.__set__('blogApp', {mountpath: newPath});
            config.paths.subdir.should.not.equal(newPath);

            setSubdirPath({}, {}, nextStub);
            config.paths.subdir.should.equal(newPath);
        });

        it('makes subdir empty if the mountpath is root', function () {
            setupMiddleware.__set__('blogApp', {mountpath: '/'});
            setSubdirPath({}, {}, nextStub);
            config.paths.subdir.should.equal('');
        });
    });
});
