'use strict';

const { PaymentError, ValidationError, NotFoundError } = require('../util/errors');
const { assertCents } = require('../pricing');

// Stand-in for the card processor, with the same shape as the real client.
// Payment sources are test tokens:
//   tok_visa          succeeds
//   tok_declined      fails with card_declined
//   tok_insufficient  fails with insufficient_funds
const OUTCOMES = {
  tok_visa: null,
  tok_declined: 'card_declined',
  tok_insufficient: 'insufficient_funds',
};

function createMockGateway({ ids, clock }) {
  const charges = new Map();
  const byIdempotencyKey = new Map();

  async function charge({ amount, currency = 'EUR', source, idempotencyKey } = {}) {
    assertCents(amount, 'amount');
    if (amount === 0) throw new ValidationError('amount must be greater than zero');
    if (!Object.prototype.hasOwnProperty.call(OUTCOMES, source)) {
      throw new ValidationError(`Unknown payment source "${source}"`, { field: 'source' });
    }

    // A retried request with the same key returns the original result
    // instead of charging twice.
    if (idempotencyKey && byIdempotencyKey.has(idempotencyKey)) {
      return { ...charges.get(byIdempotencyKey.get(idempotencyKey)) };
    }

    const failure = OUTCOMES[source];
    if (failure) throw new PaymentError('Payment declined', { reason: failure });

    const record = {
      id: ids('ch'),
      amount,
      currency,
      status: 'succeeded',
      refunded: 0,
      createdAt: new Date(clock.now()).toISOString(),
    };
    charges.set(record.id, record);
    if (idempotencyKey) byIdempotencyKey.set(idempotencyKey, record.id);
    return { ...record };
  }

  // Refunds part or all of a charge. Defaults to whatever is left.
  async function refund(chargeId, amount) {
    const record = charges.get(chargeId);
    if (!record) throw new NotFoundError('charge', chargeId);
    const remaining = record.amount - record.refunded;
    const value = amount === undefined ? remaining : assertCents(amount, 'amount');
    if (value === 0 || value > remaining) {
      throw new ValidationError(`Refund must be between 1 and ${remaining} cents`);
    }
    record.refunded += value;
    record.status = record.refunded === record.amount ? 'refunded' : 'partially_refunded';
    return { chargeId, amount: value, status: record.status };
  }

  function getCharge(chargeId) {
    const record = charges.get(chargeId);
    return record ? { ...record } : null;
  }

  return { charge, refund, getCharge };
}

module.exports = { createMockGateway };
