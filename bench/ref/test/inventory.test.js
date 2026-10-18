'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

function setup(stock = 4) {
  const shop = createShop();
  const product = shop.catalog.createProduct({ name: 'Poetry', price: 900, stock });
  return { shop, product, inventory: shop.inventory };
}

test('reserve moves stock from available to reserved', async () => {
  const { inventory, product } = setup();
  assert.equal(await inventory.reserve(product.id, 3), true);
  assert.deepEqual(inventory.getLevels(product.id), { available: 1, reserved: 3, sold: 0 });
});

test('reserving more than is available throws OutOfStockError', async () => {
  const { inventory, product } = setup(2);
  await assert.rejects(inventory.reserve(product.id, 3), { code: 'OUT_OF_STOCK' });
  assert.equal(inventory.getAvailable(product.id), 2);
});

test('release returns reserved stock', async () => {
  const { inventory, product } = setup();
  await inventory.reserve(product.id, 2);
  assert.equal(await inventory.release(product.id, 2), 2);
  assert.deepEqual(inventory.getLevels(product.id), { available: 4, reserved: 0, sold: 0 });
});

test('commit turns reserved stock into sold stock', async () => {
  const { inventory, product } = setup();
  await inventory.reserve(product.id, 2);
  await inventory.commit(product.id, 2);
  assert.deepEqual(inventory.getLevels(product.id), { available: 2, reserved: 0, sold: 2 });
});

test('restock adds to available stock', async () => {
  const { inventory, product } = setup(0);
  assert.equal(await inventory.restock(product.id, 5), 5);
});

test('every movement is written to the audit log', async () => {
  const { inventory, product } = setup();
  await inventory.reserve(product.id, 1, { reference: 'ord_1' });
  await inventory.release(product.id, 1, { reference: 'ord_1' });
  assert.deepEqual(
    inventory.audit.forProduct(product.id).map((entry) => entry.type),
    ['reserve', 'release'],
  );
});

test('unknown products have no stock record', async () => {
  const { inventory } = setup();
  await assert.rejects(inventory.reserve('prd_missing', 1), { code: 'NOT_FOUND' });
});
