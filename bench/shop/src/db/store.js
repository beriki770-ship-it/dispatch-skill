'use strict';

const { EventEmitter } = require('node:events');
const { ValidationError, NotFoundError } = require('../util/errors');
const { execute } = require('./sql');

// In-memory document store. Collections are created on first use; every
// document needs a string `id`. Reads and writes hand out copies, so a caller
// mutating a returned object never changes stored data behind the store's
// back.
//
// Every write emits a 'change' event:
//   { type: 'insert' | 'update' | 'delete', collection, id, doc, previous }
class Store extends EventEmitter {
  #collections = new Map();

  #collection(name) {
    if (!this.#collections.has(name)) this.#collections.set(name, new Map());
    return this.#collections.get(name);
  }

  insert(collection, doc) {
    if (!doc || typeof doc.id !== 'string' || doc.id === '') {
      throw new ValidationError(`Documents in "${collection}" need a string id`);
    }
    const rows = this.#collection(collection);
    if (rows.has(doc.id)) {
      throw new ValidationError(`Duplicate id "${doc.id}" in "${collection}"`);
    }
    const stored = structuredClone(doc);
    rows.set(doc.id, stored);
    this.emit('change', { type: 'insert', collection, id: doc.id, doc: structuredClone(stored) });
    return structuredClone(stored);
  }

  get(collection, id) {
    const row = this.#collection(collection).get(id);
    return row ? structuredClone(row) : null;
  }

  has(collection, id) {
    return this.#collection(collection).has(id);
  }

  update(collection, id, patch) {
    const rows = this.#collection(collection);
    const previous = rows.get(id);
    if (!previous) throw new NotFoundError(collection, id);
    const next = { ...previous, ...structuredClone(patch), id };
    rows.set(id, next);
    this.emit('change', {
      type: 'update',
      collection,
      id,
      doc: structuredClone(next),
      previous: structuredClone(previous),
    });
    return structuredClone(next);
  }

  // Adds `by` to a numeric field and returns the new value. Synchronous, so
  // two callers can never interleave inside it.
  increment(collection, id, field, by) {
    const rows = this.#collection(collection);
    const row = rows.get(id);
    if (!row) throw new NotFoundError(collection, id);
    const previous = structuredClone(row);
    row[field] = (row[field] || 0) + by;
    this.emit('change', { type: 'update', collection, id, doc: structuredClone(row), previous });
    return row[field];
  }

  remove(collection, id) {
    const rows = this.#collection(collection);
    const previous = rows.get(id);
    if (!previous) return false;
    rows.delete(id);
    this.emit('change', { type: 'delete', collection, id, previous: structuredClone(previous) });
    return true;
  }

  // All documents in insertion order.
  all(collection) {
    return [...this.#collection(collection).values()].map((row) => structuredClone(row));
  }

  count(collection) {
    return this.#collection(collection).size;
  }

  // Runs a statement produced by the query builder (see query.js).
  execute(statement) {
    return execute(statement, (name) => this.all(name));
  }
}

module.exports = { Store };
