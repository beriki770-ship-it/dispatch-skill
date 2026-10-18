'use strict';

const { createMockGateway } = require('./mock-gateway');

// The shop talks to payments only through this factory, so the mock can be
// swapped for the real processor client in one place.
function createPaymentService(options) {
  return createMockGateway(options);
}

module.exports = { createPaymentService };
