'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

const ADDRESS = { name: 'Ann Reader', street: 'Hauptstraße 1', postalCode: '1010', city: 'Wien', country: 'AT' };

function setup() {
  const shop = createShop();
  const novel = shop.catalog.createProduct({ name: 'Novel', price: 1000, stock: 5 });
  const cart = shop.cart.createCart().add(novel.id, 2);
  return { shop, novel, cart };
}

function place(shop, cart) {
  return shop.orders.create({ userId: 'usr_1', email: 'ann@example.com', cart, shippingAddress: ADDRESS });
}

test('creating an order computes subtotal, VAT and total', async () => {
  const { shop, cart } = setup();
  const order = await place(shop, cart);
  assert.equal(order.status, 'pending');
  assert.equal(order.subtotal, 2000);
  assert.equal(order.tax, 200);
  assert.equal(order.total, 2200);
  assert.equal(order.currency, 'EUR');
});

test('creating an order reserves stock', async () => {
  const { shop, cart, novel } = setup();
  await place(shop, cart);
  assert.deepEqual(shop.inventory.getLevels(novel.id), { available: 3, reserved: 2, sold: 0 });
});

test('the order keeps the shipping address', async () => {
  const { shop, cart } = setup();
  const order = await place(shop, cart);
  assert.deepEqual(order.shippingAddress, ADDRESS);
});

test('an empty cart cannot be ordered', async () => {
  const { shop } = setup();
  await assert.rejects(place(shop, shop.cart.createCart()), { code: 'VALIDATION', message: 'Your cart is empty' });
});

test('ordering more than is in stock fails and reserves nothing', async () => {
  const { shop, novel } = setup();
  const other = shop.catalog.createProduct({ name: 'Rare', price: 500, stock: 1 });
  const cart = shop.cart.createCart().add(novel.id, 1).add(other.id, 2);
  await assert.rejects(place(shop, cart), { code: 'OUT_OF_STOCK' });
  assert.equal(shop.inventory.getAvailable(novel.id), 5);
  assert.equal(shop.inventory.getAvailable(other.id), 1);
});

test('paying an order marks it paid, sells the stock and queues a mail', async () => {
  const { shop, cart, novel } = setup();
  const order = await place(shop, cart);
  const paid = await shop.orders.pay(order.id, 'tok_visa');
  assert.equal(paid.status, 'paid');
  assert.ok(paid.paymentId);
  assert.deepEqual(shop.inventory.getLevels(novel.id), { available: 3, reserved: 0, sold: 2 });
  const mails = shop.mail.outbox.list();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'ann@example.com');
});

test('a declined payment leaves the order pending', async () => {
  const { shop, cart } = setup();
  const order = await place(shop, cart);
  await assert.rejects(shop.orders.pay(order.id, 'tok_declined'), { code: 'PAYMENT' });
  assert.equal(shop.orders.get(order.id).status, 'pending');
});

test('cancelling a pending order releases its stock', async () => {
  const { shop, cart, novel } = setup();
  const order = await place(shop, cart);
  const cancelled = await shop.orders.cancel(order.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(shop.inventory.getAvailable(novel.id), 5);
});

test('cancelling a paid order refunds and restocks', async () => {
  const { shop, cart, novel } = setup();
  const order = await place(shop, cart);
  await shop.orders.pay(order.id, 'tok_visa');
  const refunded = await shop.orders.cancel(order.id);
  assert.equal(refunded.status, 'refunded');
  assert.equal(shop.inventory.getAvailable(novel.id), 5);
  assert.equal(shop.payments.getCharge(refunded.paymentId).status, 'refunded');
});

test('illegal status changes are rejected', async () => {
  const { shop, cart } = setup();
  const order = await place(shop, cart);
  assert.throws(() => shop.orders.markDelivered(order.id), { code: 'INVALID_STATE' });
});

test('orders are listed newest first', async () => {
  const { shop, novel } = setup();
  const first = await place(shop, shop.cart.createCart().add(novel.id, 1));
  const second = await place(shop, shop.cart.createCart().add(novel.id, 1));
  const listed = shop.orders.list({ userId: 'usr_1' });
  assert.deepEqual(listed.items.map((o) => o.id), [second.id, first.id]);
});

test('the shipping address is validated', async () => {
  const { shop, cart } = setup();
  await assert.rejects(
    shop.orders.create({ userId: 'usr_1', cart, shippingAddress: { ...ADDRESS, country: 'Austria' } }),
    { code: 'VALIDATION' },
  );
});
