'use strict';

const limiter = require('./limiter');

module.exports = { createRateLimiter: limiter.createRateLimiter };
