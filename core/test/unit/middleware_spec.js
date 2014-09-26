/*globals describe, it */
/*jshint expr:true*/
var should          = require('should'),
//    sinon           = require('sinon'),
    rewire          = require('rewire'),

    // Thing we are testing
    middleware      = rewire('../../server/middleware');

// To stop jshint complaining
should.equal(true, true);

describe('Express middleware module', function () {
    var defaultConfig = {
        database: {client: 'sqlite3'}
    };

    function shouldBeAnInstanceOfExpress(express) {
        // first-order duck typing for an express server
        express.should.be.a.function;
        express.length.should.equal(3, 'a real express server function has an arity of 3');
        express.request.should.be.an.object;
        express.response.should.be.an.object;
    }

    it('returns an Express server instance when called', function () {
        shouldBeAnInstanceOfExpress(middleware(defaultConfig));
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
