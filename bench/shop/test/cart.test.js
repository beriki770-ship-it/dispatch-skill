'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

function setup() {
  const shop = createShop();
  const novel = shop.catalog.createProduct({ name: 'Novel', price: 1000, stock: 10 });
  const atlas = shop.catalog.createProduct({ name: 'Atlas', price: 2500, stock: 10, discountPercent: 10 });
  return { shop, novel, atlas, cart: shop.cart.createCart() };
}

test('cart lines carry name, unit price, quantity and line total', () => {
  const { cart, novel } = setup();
  cart.add(novel.id, 2);
  assert.deepEqual(cart.lines(), [
    { productId: novel.id, name: 'Novel', unitPrice: 1000, discountPercent: 0, quantity: 2, lineTotal: 2000 },
  ]);
});

test('adding the same product twice increases the quantity', () => {
  const { cart, novel } = setup();
  cart.add(novel.id).add(novel.id, 3);
  assert.equal(cart.lines()[0].quantity, 4);
  assert.equal(cart.itemCount(), 4);
});

test('product discounts apply to the line total', () => {
  const { cart, atlas } = setup();
  cart.add(atlas.id, 1);
  assert.equal(cart.lines()[0].lineTotal, 2250);
});

test('subtotal adds up all lines', () => {
  const { cart, novel, atlas } = setup();
  cart.add(novel.id, 1).add(atlas.id, 2);
  assert.equal(cart.subtotal(), 1000 + 4500);
});

test('setQuantity to zero removes the line', () => {
  const { cart, novel } = setup();
  cart.add(novel.id, 2);
  cart.setQuantity(novel.id, 0);
  assert.ok(cart.isEmpty());
});

test('unknown products cannot be added', () => {
  const { cart } = setup();
  assert.throws(() => cart.add('prd_missing', 1), { code: 'NOT_FOUND' });
});

test('quantities must be positive whole numbers and at most 99', () => {
  const { cart, novel } = setup();
  assert.throws(() => cart.add(novel.id, 0), { code: 'VALIDATION' });
  assert.throws(() => cart.add(novel.id, 1.5), { code: 'VALIDATION' });
  assert.throws(() => cart.add(novel.id, 100), { code: 'VALIDATION' });
});
