'use strict';

const limiter = require('./limiter');

module.exports = { createRatelimiter: limiter.createRateLimiter };
