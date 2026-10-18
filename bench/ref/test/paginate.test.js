'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { paginate } = require('../src/util/paginate');

const numbers = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('the first page holds the first pageSize items', () => {
  const page = paginate(numbers(25), { page: 1, pageSize: 10 });
  assert.deepEqual(page.items, numbers(10));
  assert.equal(page.total, 25);
  assert.equal(page.hasNext, true);
});

test('the last page holds the remainder', () => {
  const page = paginate(numbers(25), { page: 3, pageSize: 10 });
  assert.deepEqual(page.items, [21, 22, 23, 24, 25]);
  assert.equal(page.totalPages, 3);
  assert.equal(page.hasNext, false);
});

test('an exact multiple of the page size has no extra page', () => {
  const page = paginate(numbers(20), { page: 2, pageSize: 10 });
  assert.equal(page.totalPages, 2);
  assert.equal(page.hasNext, false);
});

test('the page size is clamped to the maximum', () => {
  const page = paginate(numbers(300), { page: 1, pageSize: 500, maxPageSize: 100 });
  assert.equal(page.pageSize, 100);
  assert.equal(page.items.length, 100);
});

test('invalid page numbers fall back to the first page', () => {
  assert.equal(paginate(numbers(5), { page: 0 }).page, 1);
  assert.equal(paginate(numbers(5), { page: -3 }).page, 1);
});
