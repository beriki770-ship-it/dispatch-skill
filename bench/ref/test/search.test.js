'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

function setup() {
  const shop = createShop();
  const add = (name, price, createdAt, extra = {}) =>
    shop.catalog.createProduct({ name, price, stock: 1, createdAt, ...extra });
  const products = {
    garden: add('Garden Birds', 1800, '2026-01-10T10:00:00Z', { description: 'A field guide' }),
    sea: add('Birds of the Sea', 2400, '2026-03-05T10:00:00Z'),
    guide: add('Field Guide to Trees', 1200, '2026-02-20T10:00:00Z', { description: 'birds and trees' }),
    cafe: add('Café Stories', 1500, '2026-01-01T10:00:00Z', { category: 'fiction' }),
  };
  return { shop, products };
}

test('finds products by a word in the name', () => {
  const { shop, products } = setup();
  const ids = shop.search.find('garden').items.map((item) => item.id);
  assert.deepEqual(ids, [products.garden.id]);
});

test('matching ignores accents and case', () => {
  const { shop, products } = setup();
  assert.deepEqual(shop.search.find('CAFE').items.map((item) => item.id), [products.cafe.id]);
});

test('name matches rank above description matches', () => {
  const { shop, products } = setup();
  const ids = shop.search.find('birds').items.map((item) => item.id);
  // Equal scores are ordered by name.
  assert.deepEqual(ids, [products.sea.id, products.garden.id, products.guide.id]);
});

test('sort by price puts the cheapest first', () => {
  const { shop } = setup();
  const prices = shop.search.find('birds', { sort: 'price' }).items.map((item) => item.price);
  assert.deepEqual(prices, [1200, 1800, 2400]);
});

test('sort by newest puts the most recent first', () => {
  const { shop, products } = setup();
  const ids = shop.search.find('birds', { sort: 'newest' }).items.map((item) => item.id);
  assert.deepEqual(ids, [products.sea.id, products.guide.id, products.garden.id]);
});

test('category filter narrows the results', () => {
  const { shop, products } = setup();
  const ids = shop.search.find('', { category: 'Fiction' }).items.map((item) => item.id);
  assert.deepEqual(ids, [products.cafe.id]);
});

test('newly added products show up in search', () => {
  const { shop } = setup();
  shop.search.find('birds');
  shop.catalog.createProduct({ name: 'Birds at Night', price: 900, stock: 1 });
  assert.equal(shop.search.find('birds').total, 4);
});

test('unknown sort orders are rejected', () => {
  const { shop } = setup();
  assert.throws(() => shop.search.find('birds', { sort: 'random' }), { code: 'VALIDATION' });
});
