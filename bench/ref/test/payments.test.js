'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

test('a test card charge succeeds', async () => {
  const { payments } = createShop();
  const charge = await payments.charge({ amount: 1490, source: 'tok_visa' });
  assert.equal(charge.status, 'succeeded');
  assert.equal(charge.amount, 1490);
});

test('declined cards raise PaymentError with a reason', async () => {
  const { payments } = createShop();
  await assert.rejects(payments.charge({ amount: 100, source: 'tok_declined' }), (error) => {
    assert.equal(error.code, 'PAYMENT');
    assert.equal(error.details.reason, 'card_declined');
    return true;
  });
});

test('unknown sources and zero amounts are invalid', async () => {
  const { payments } = createShop();
  await assert.rejects(payments.charge({ amount: 100, source: 'tok_unknown' }), { code: 'VALIDATION' });
  await assert.rejects(payments.charge({ amount: 0, source: 'tok_visa' }), { code: 'VALIDATION' });
});

test('repeating an idempotency key does not charge twice', async () => {
  const { payments } = createShop();
  const first = await payments.charge({ amount: 500, source: 'tok_visa', idempotencyKey: 'k1' });
  const again = await payments.charge({ amount: 500, source: 'tok_visa', idempotencyKey: 'k1' });
  assert.equal(again.id, first.id);
});

test('partial and full refunds', async () => {
  const { payments } = createShop();
  const charge = await payments.charge({ amount: 1000, source: 'tok_visa' });
  assert.equal((await payments.refund(charge.id, 400)).status, 'partially_refunded');
  assert.equal((await payments.refund(charge.id)).amount, 600);
  assert.equal(payments.getCharge(charge.id).status, 'refunded');
  await assert.rejects(payments.refund(charge.id, 1), { code: 'VALIDATION' });
});
