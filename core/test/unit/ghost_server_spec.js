/*globals describe, it, beforeEach, afterEach*/
/*jshint expr:true*/
var express         = require('express'),
    _               = require('lodash'),
    rewire          = require('rewire'),
    sinon           = require('sinon'),

    // Stuff we are testing
    GhostServer     = rewire('../../server/GhostServer');

function shouldBeAnInstanceOfExpress(express) {
    // first-order duck typing for an express server
    express.should.be.a.function;
    express.length.should.equal(3, 'a real express server function has an arity of 3');
    express.request.should.be.an.object;
    express.response.should.be.an.object;
}

describe('GhostServer', function () {
    var sandbox, server, ghost, listenMock;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        server = express();
        listenMock = sandbox.stub(server, 'listen');
        listenMock.returns({
            mockOf: 'HttpServer',
            on: function () {}
        });
        ghost = new GhostServer(server);
    });

    afterEach(function () {
        sandbox.restore();
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
            var config = GhostServer.__get__('config');
            _.merge(config, {
                server: false,
                middleware: true
            });

            ghost.start().then(function (resolved) {
                listenMock.called.should.be.false;
                shouldBeAnInstanceOfExpress(resolved);
                done();
            });
        });
    });
});
