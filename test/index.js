'use strict';

const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Hapi = require('hapi');
const Boom = require('boom');
const sinon = require('sinon');
var expect = require('chai').expect;

lab.experiment('plugin exposes', function() {
	lab.test('should expose rollbar', function(done) {
		var server = makeServerWithPlugin();
		expect(server.plugins['@soxhub/rollbar-hapi'].rollbar).to.not.be.empty;
		done();
	});

	lab.test('should expose rollbar error function', function (done) {
		var server = makeServerWithPlugin();
		var rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;

		expect(rollbar.error).to.be.a('function');
		done();
	});
});

lab.experiment('plugin relays server errors to rollbar', function() {
	lab.test('should relay http state errors', function(done) {
		var server = makeServerWithPlugin();

		// Add a basic route and register a cookie definition
		server.route({
			method: 'GET',
			path: '/good',
			handler: function (request, reply) {
				return reply('success');
			}
		});

		server.state('session', {
			ttl: 24 * 60 * 60 * 1000,
			isSecure: true,
			path: '/',
			encoding: 'base64json'
		});

		// This request with an improperly encoded `session` cookie value
		// will trigger a state error and emit an internal-error event
		const request = {
			method: 'GET',
			url: '/good',
			payload: {},
			headers: {
				'Cookie': 'PHPSESSID=298zf09hf012fh2; session=u32t4o3tb3gg43; _gat=1;'
			}
		};

		// Wrap `rollbar.warning` with a spy
		var rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;
		let spy = sinon.stub(rollbar,'warning');

		// The emitting of the `tail` event is the last step in the hapi request cycle
		// (https://hapijs.com/api#request-lifecycle) and the ideal place to check the
		// state of any activity that occurs after the response is sent to the client
		// but before the request cycle completes.
		server.on('tail', function() {
			sinon.assert.calledOnce(spy);
			var firstArg = spy.firstCall.args[0];
			expect(firstArg).to.be.a('string');
			spy.restore();
			done();
		});

		server.inject(request);
	});

	lab.test('should relay internal errors', function(done) {
		var server = makeServerWithPlugin();

		var rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/internal',
			handler: function (request, reply) {
				return reply(new Error('unexpected error'));
			}
		});

		var stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/internal',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.calledTwice(stub);
			let secondCall = stub.secondCall;
			var firstArg = secondCall.args[0];
			expect(firstArg.isBoom).to.be.true;
			stub.restore();
			done();
		});

		server.inject(request);
	});

	lab.test('should relay 4xx bad request errors', function(done) {
		var server = makeServerWithPlugin();

		var rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/badRequest',
			handler: function (request, reply) {
				return reply(Boom.badRequest('Unsupported parameter'));
			}
		});

		var stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/badRequest',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.calledOnce(stub);
			var firstArg = stub.firstCall.args[0];
			expect(firstArg.isBoom).to.be.true;
			stub.restore();
			done();
		});

		server.inject(request);
	});

	lab.test('should sanitize messages', function(done) {
		let server = makeServerWithPlugin({
			sanitize: function() {
				return "foobar";
			}
		});

		var rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/badRequest',
			handler: function (request, reply) {
				return reply(Boom.badRequest('Unsupported parameter'));
			}
		});

		var stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/badRequest',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.calledOnce(stub);
			var firstArg = stub.firstCall.args[0];
			expect(firstArg).to.equal('foobar');
			stub.restore();
			done();
		});

		server.inject(request);
	});
});

lab.experiment('plugin relays server errors that are not filtered to rollbar', function() {
	lab.test('Does not relay responses that are filtered out', function(done) {
		let server = makeServerWithPlugin({
			filter: function(err) {
				if (err.output.statusCode !== 404) {
					return true;
				} else {
					return false;
				}
			}
		});

		server.route({
			method: 'GET',
			path: '/notfound',
			handler: function (request, reply) {
				return reply(Boom.notFound('Not Found'));
			}
		});

		let rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.notCalled(stub);
			stub.restore();
			done();
		});

		server.inject(request);
	});

	lab.test('Relays responses that pass through filter', function(done) {
		let server = makeServerWithPlugin({
			filter: function(err) {
				if (err.output.statusCode !== 401) {
					return true;
				} else {
					return false;
				}
			}
		});

		server.route({
			method: 'GET',
			path: '/notfound',
			handler: function (request, reply) {
				return reply(Boom.notFound('Not Found'));
			}
		});

		let rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.calledOnce(stub);
			stub.restore();
			done();
		});

		server.inject(request);
	});

	lab.test('Relays all responses when there is no filter option', function(done) {
		let server = makeServerWithPlugin();

		server.route({
			method: 'GET',
			path: '/notfound',
			handler: function (request, reply) {
				return reply(Boom.notFound('Not Found'));
			}
		});

		let rollbar = server.plugins['@soxhub/rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.on('tail', function() {
			sinon.assert.calledOnce(stub);
			stub.restore();
			done();
		});

		server.inject(request);
	});
});

var makeServerWithPlugin = function (moreOptions = {}) {
	var server = new Hapi.Server();

	server.connection({ port: 7000 });

	let options = Object.assign({
		accessToken: '90bdff07d44a4984aea0d0684bb6c142'
	}, moreOptions);

	server.register({
		register: require('../'),
		options
	}, function (err) {
		if (err) throw err;
	});

	return server;
};
