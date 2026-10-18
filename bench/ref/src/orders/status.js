'use strict';

const { StateError } = require('../util/errors');

// Order lifecycle. Anything not listed here is not a legal move.
//
//   pending -> paid -> shipped -> delivered
//      |        |
//      v        v
//  cancelled  refunded
const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

// Statuses that count as revenue in reports.
const REVENUE_STATUSES = new Set(['paid', 'shipped', 'delivered']);

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new StateError(`Cannot move an order from "${from}" to "${to}"`, { from, to });
  }
}

module.exports = { TRANSITIONS, REVENUE_STATUSES, canTransition, assertTransition };
