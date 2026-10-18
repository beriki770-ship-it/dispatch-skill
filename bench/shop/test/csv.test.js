'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv } = require('../src/reports');

test('writes a header and one line per row', () => {
  const csv = toCsv([{ id: 1, title: 'Dune' }, { id: 2, title: 'Emma' }], ['id', 'title']);
  assert.equal(csv, 'id,title\n1,Dune\n2,Emma\n');
});

test('uses custom headers and formatters', () => {
  const csv = toCsv([{ price: 1490 }], [{ key: 'price', header: 'Price', format: (v) => (v / 100).toFixed(2) }]);
  assert.equal(csv, 'Price\n14.90\n');
});

test('empty and missing values become empty cells', () => {
  const csv = toCsv([{ a: null, b: undefined }], ['a', 'b', 'c']);
  assert.equal(csv, 'a,b,c\n,,\n');
});

test('cells with commas are quoted', () => {
  const csv = toCsv([{ title: 'Pride, and Prejudice' }], ['title']);
  assert.equal(csv, 'title\n"Pride, and Prejudice"\n');
});

test('quotes inside a cell are doubled', () => {
  const csv = toCsv([{ title: 'The "Hobbit"' }], ['title']);
  assert.equal(csv, 'title\n"The ""Hobbit"""\n');
});
