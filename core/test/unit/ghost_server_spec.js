/*globals describe, it, beforeEach, afterEach*/
/*jshint expr:true*/
var should          = require('should'),
    express         = require('express'),
    _               = require('lodash'),
    rewire          = require('rewire'),
    sinon           = require('sinon'),

    // Stuff we are testing
    GhostServer     = rewire('../../server/GhostServer');

describe('GhostServer', function () {
    function restoreConfiguration() {
        var config = GhostServer.__get__('config');
        _.merge(config, config._config);
    }

    function configureToBeMiddleware() {
        var config = GhostServer.__get__('config');
        _.merge(config, {
            server: false,
            middleware: true
        });
    }

    function shouldBeAnInstanceOfExpress(express) {
        // first-order duck typing for an express server
        express.should.be.a.function;
        express.length.should.equal(3, 'a real express server function has an arity of 3');
        express.request.should.be.an.object;
        express.response.should.be.an.object;
    }

    var sandbox, server;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        server = express();
    });

    afterEach(function () {
        sandbox.restore();
        restoreConfiguration();
    });

    describe('instantiating', function () {
        describe('configured as a stand-alone app', function () {
            it('schedules a warning message to appear if the server doesn\'t start', function () {
                var ghost = new GhostServer(server);
                should(ghost.upgradeWarning).not.equal(undefined);
            });
        });

        describe('configured to run as Express middleware', function () {
            it('doesn\'t schedule a warning message', function () {
                configureToBeMiddleware();
                var ghost = new GhostServer(server);
                should(ghost.upgradeWarning).equal(undefined);
            });
        });
    });

    describe('with a server instance', function () {
        var ghost, listenMock;

        beforeEach(function () {
            listenMock = sandbox.stub(server, 'listen');
            listenMock.returns({
                mockOf: 'HttpServer',
                on: function () {}
            });
            ghost = new GhostServer(server);
        });

        describe('configured as a stand-alone app', function () {
            it('resolves the initial deferred with an instance of GhostServer', function (done) {
                ghost.start().then(function (resolved) {
                    listenMock.calledOnce.should.be.true;
                    resolved.should.be.an.instanceOf(GhostServer);
                    done();
                });
            });
        });

        describe('configured to run as Express middleware', function () {
            it('resolves the initial deferred with an Express server object', function (done) {
                configureToBeMiddleware();
                ghost.start().then(function (resolved) {
                    listenMock.called.should.be.false;
                    shouldBeAnInstanceOfExpress(resolved);
                    done();
                });
            });
        });
    });
});
