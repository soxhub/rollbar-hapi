'use strict';

const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Hapi = require('hapi');
const Boom = require('boom');
const sinon = require('sinon');
const expect = require('chai').expect;

lab.experiment('plugin exposes', function() {
	lab.test('should expose rollbar', async function() {
		let server = await makeServerWithPlugin();
		expect(server.plugins['rollbar-hapi'].rollbar).to.not.be.empty;
	});

	lab.test('should expose rollbar error function', async function () {
		let server = await makeServerWithPlugin();
		let rollbar = server.plugins['rollbar-hapi'].rollbar;

		expect(rollbar.error).to.be.a('function');
	});
});

lab.experiment('plugin relays server errors to rollbar', function() {
	lab.test('should relay http state errors', async function() {
		let server = await makeServerWithPlugin();

		// Add a basic route and register a cookie definition
		server.route({
			method: 'GET',
			path: '/good',
			handler: function (request, h) {
				return 'success';
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
		let rollbar = server.plugins['rollbar-hapi'].rollbar;
		let spy = sinon.stub(rollbar,'warning');

		// The emitting of the `tail` event is the last step in the hapi request cycle
		// (https://hapijs.com/api#request-lifecycle) and the ideal place to check the
		// state of any activity that occurs after the response is sent to the client
		// but before the request cycle completes.
		server.events.on('response', function() {
			sinon.assert.calledOnce(spy);
			let firstArg = spy.firstCall.args[0];
			expect(firstArg).to.be.a('string');
			spy.restore();
		});

		await server.inject(request);
	});

	lab.test('should relay internal errors', async function() {
		let server = await makeServerWithPlugin();

		let rollbar = server.plugins['rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/internal',
			handler: function (request, h) {
				return new Error('unexpected error');
			}
		});

		let stub = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/internal',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.calledTwice(stub);
			let secondCall = stub.secondCall;
			let firstArg = secondCall.args[0];
			expect(firstArg.isBoom).to.be.true;
			stub.restore();
		});

		await server.inject(request);
	});

	lab.test('should relay 4xx bad request errors', async function() {
		let server = await makeServerWithPlugin();

		let rollbar = server.plugins['rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/badRequest',
			handler: function (request, h) {
				return Boom.badRequest('Unsupported parameter');
			}
		});

		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/badRequest',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.calledOnce(stub);
			let firstArg = stub.firstCall.args[0];
			expect(firstArg.isBoom).to.be.true;
			stub.restore();
		});

		await server.inject(request);
	});

	lab.test('should sanitize messages', async function() {
		let server = await makeServerWithPlugin({
			sanitize: function() {
				return "foobar";
			}
		});

		let rollbar = server.plugins['rollbar-hapi'].rollbar;

		server.route({
			method: 'GET',
			path: '/badRequest',
			handler: function (request, h) {
				return Boom.badRequest('Unsupported parameter');
			}
		});

		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/badRequest',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.calledOnce(stub);
			let firstArg = stub.firstCall.args[0];
			expect(firstArg).to.equal('foobar');
			stub.restore();
		});

		await server.inject(request);
	});
});

lab.experiment('plugin relays server errors that are not filtered to rollbar', function() {
	lab.test('Does not relay responses that are filtered out', async function() {
		let server = await makeServerWithPlugin({
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
			handler: function (request, h) {
				return Boom.notFound('Not Found');
			}
		});

		let rollbar = server.plugins['rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.notCalled(stub);
			stub.restore();
		});

		await server.inject(request);
	});

	lab.test('Relays responses that pass through filter', async function() {
		let server = await makeServerWithPlugin({
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
			handler: function (request, h) {
				return Boom.notFound('Not Found');
			}
		});

		let rollbar = server.plugins['rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.calledOnce(stub);
			stub.restore();
		});

		await server.inject(request);
	});

	lab.test('Relays all responses when there is no filter option', async function() {
		let server = await makeServerWithPlugin();

		server.route({
			method: 'GET',
			path: '/notfound',
			handler: function (request, h) {
				return Boom.notFound('Not Found');
			}
		});

		let rollbar = server.plugins['rollbar-hapi'].rollbar;
		let stub  = sinon.stub(rollbar,'error');

		const request = {
			method: 'GET',
			url: '/notFound',
			payload: {}
		};

		server.events.on('response', function() {
			sinon.assert.calledOnce(stub);
			stub.restore();
		});

		await server.inject(request);
	});

});

let makeServerWithPlugin = async function (moreOptions = {}) {
	let server = new Hapi.Server({ port: 7000, routes: { state: { failAction: 'log' } } });

	let options = Object.assign({
		accessToken: '90bdff07d44a4984aea0d0684bb6c142'
	}, moreOptions);

	await server.register({
		plugin: require('../'),
		options: options
	});

	return server;
};
