'use strict';

/* -*- javascript -*- */
/* *******************************************************************
 *  @author Evangelos Pappas <epappas@evalonlabs.com>
 *  @copyright (C) 2014, evalonlabs
 *  Copyright 2015, evalonlabs
 *
 *  The MIT License (MIT)
 *
 *  Copyright (c) 2015 Evangelos Pappas
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 *
 *  @doc
 *
 *  @end
 * *******************************************************************/

// Load modules
var rollbar = require('rollbar');
var util = require('util');

exports.register = function (server, options, next) {
    var preError = options.preError || function preError(err) { return err; };
    var rollbarKey = options.accessToken;
    var rollbarOpts = options;
    rollbarOpts.environment = rollbarOpts.environment || process.env.NODE_ENV;
    rollbarOpts.exitOnUncaughtException = typeof options.exitOnUncaughtException !== 'undefined' ?
        options.exitOnUncaughtException : true;

    rollbar.init(rollbarKey, rollbarOpts);
    rollbar.handleUncaughtExceptions(rollbarKey, rollbarOpts);

    server.on('stop', function stop() {
        rollbar.shutdown();
    });

    server.ext('onPreResponse', function onPreResponse(request, next) {
        var response = preError(request.response);
        if (response && response.isBoom) {
            rollbar.handleErrorWithPayloadData(response, response.output, request, logError);
        }

        next.continue();
    });

    server.on('log', function rollbarLog(event, tags) {
        if (tags.rollbarError) {
            return rollbar.handleError(event.err, formatReq(event.req));
        }
        if (tags.rollbarMessage) {
            return rollbar.reportMessage(event.msg, event.level || 'info', formatReq(event.req), logError);
        }
    });

    server.on('request-internal', function requestInternal(request, event, tags) {
        if (tags.error && tags.state) {
            return rollbar.reportMessage(event, event.level || 'warning', formatReq(request), logError);
        }
    });

    server.on('request-error', function requestError(request, err) {
        return rollbar.handleError(err, formatReq(request), logError);
    });

    server.expose('rollbar', rollbar);

    server.method('handleError', function handleError(err, req, next) {
        rollbar.handleError(err, formatReq(req), logError);
        next();
    });

    server.method('handleErrorWithPayloadData', function handleErrorWithPayloadData(err, opts, req, next) {
        rollbar.handleErrorWithPayloadData(err, opts, formatReq(req), logError);
        next();
    });

    server.method('reportMessage', function reportMessage(msg, level, req, next) {
        rollbar.reportMessage(msg, level, formatReq(req), logError);
        next();
    });

    server.method('reportMessageWithPayloadData', function reportMessageWithPayloadData(msg, opts, req, next) {
        rollbar.reportMessageWithPayloadData(msg, opts, formatReq(req), logError);
        next();
    });

    next();
};

exports.register.attributes = {
    pkg: require('../package.json')
};

function logError(err, rbPayload, rbResp) {
    if (err) {
        util.log(err);
        return;
    }
    if (rbResp && rbResp.uuid) {
        util.log('[Rollbar] link: https://rollbar.com/occurrence/uuid/?uuid=' + rbResp.uuid);
    }
}

function formatReq(request) {
    if (!request) return;

    let rollbarRequest = {
        ip: request.info.remoteAddress,
        headers: request.headers,
        url: request.url.path,
        method: request.method,
        protocol: request.connection.info.protocol,
        route: {
            path: request.route.path
        }
    };

    return rollbarRequest;
}
