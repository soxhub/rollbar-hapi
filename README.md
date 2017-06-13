# rollbar-hapi
A Hapi plugin for rollbar painless integration

[![GitHub license](https://img.shields.io/github/license/epappas/rollbar-hapi.svg?style=flat-square)](https://github.com/epappas/rollbar-hapi/blob/master/LICENSE)
[![Travis](https://img.shields.io/travis/epappas/rollbar-hapi.svg?style=flat-square)](https://travis-ci.org/epappas/rollbar-hapi)
[![Coveralls](https://img.shields.io/coveralls/epappas/rollbar-hapi.svg?style=flat-square)](https://coveralls.io/r/epappas/random-api)
[![npm](https://img.shields.io/npm/dm/rollbar-hapi.svg?style=flat-square)](https://www.npmjs.com/package/rollbar-hapi)
[![npm](https://img.shields.io/npm/v/rollbar-hapi.svg?style=flat-square)](https://www.npmjs.com/package/rollbar-hapi)
[![GitHub stars](https://img.shields.io/github/stars/epappas/rollbar-hapi.svg?style=flat-square)](https://github.com/epappas/rollbar-hapi)

# installation

    npm install rollbar-hapi --save

# Use of

    server.register({
            register: require('./rollbar/index'),
            options: {
                accessToken: '',
                environment: '', // optional, defaults to process.env.NODE_ENV
                handleUncaughtExceptions: true // optional, defaults to false
            }
        }, function (err) {
            if (err) throw err;
        });

# Exposes

    server.plugins['rollbar-hapi'].rollbar // the rollbar module, already initialised

    The exposed `rollbar` above can be used to access rollbar's `log`, `debug`, `info`, `warning`, 
    `error`, and `critical` methods

