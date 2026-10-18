'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const { tokenize } = require('../src/db/sql');

function setup() {
  const db = createDb();
  db.store.insert('books', { id: 'b1', title: 'Dune', price: 1200, meta: { lang: 'en' } });
  db.store.insert('books', { id: 'b2', title: 'Emma', price: 900, meta: { lang: 'en' } });
  db.store.insert('books', { id: 'b3', title: 'Momo', price: 1500, meta: { lang: 'de' } });
  return db;
}

const ids = (rows) => rows.map((row) => row.id);

test('store hands out copies, not live objects', () => {
  const db = setup();
  const book = db.store.get('books', 'b1');
  book.title = 'changed';
  assert.equal(db.store.get('books', 'b1').title, 'Dune');
});

test('store emits change events', () => {
  const db = setup();
  const events = [];
  db.store.on('change', (event) => events.push(`${event.type}:${event.id}`));
  db.store.update('books', 'b1', { price: 1300 });
  db.store.remove('books', 'b2');
  assert.deepEqual(events, ['update:b1', 'delete:b2']);
});

test('duplicate ids are rejected', () => {
  const db = setup();
  assert.throws(() => db.store.insert('books', { id: 'b1' }), { code: 'VALIDATION' });
});

test('equality, comparison and ordering', () => {
  const db = setup();
  assert.deepEqual(ids(db.from('books').where('title', 'Emma').all()), ['b2']);
  assert.deepEqual(ids(db.from('books').where('price', '>=', 1200).orderBy('price', 'desc').all()), ['b3', 'b1']);
});

test('nested fields can be queried', () => {
  const db = setup();
  assert.deepEqual(ids(db.from('books').where('meta.lang', 'de').all()), ['b3']);
});

test('orWhere adds an alternative', () => {
  const db = setup();
  const rows = db.from('books').where('title', 'Dune').orWhere('title', 'Momo').orderBy('title').all();
  assert.deepEqual(ids(rows), ['b1', 'b3']);
});

test('LIKE matches with wildcards, ignoring case', () => {
  const db = setup();
  assert.deepEqual(ids(db.from('books').where('title', 'like', '%M%').orderBy('title').all()), ['b2', 'b3']);
});

test('limit, offset, first and count', () => {
  const db = setup();
  assert.deepEqual(ids(db.from('books').orderBy('price').limit(2).offset(1).all()), ['b1', 'b3']);
  assert.equal(db.from('books').orderBy('price').first().id, 'b2');
  assert.equal(db.from('books').where('price', '<', 1300).count(), 2);
});

test('field names are validated', () => {
  const db = setup();
  assert.throws(() => db.from('books').where('title; DROP', 'x'), { code: 'VALIDATION' });
});

test('the builder produces readable SQL', () => {
  const db = setup();
  const sql = db.from('books').where('price', '<', 1000).orderBy('title').limit(5).toSql();
  assert.equal(sql, 'SELECT * FROM books WHERE price < 1000 ORDER BY title ASC LIMIT 5');
});

test('string literals support doubled quotes', () => {
  assert.deepEqual(tokenize("'it''s'"), [{ type: 'string', value: "it's" }]);
});
