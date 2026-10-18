'use strict';

const { ValidationError } = require('../util/errors');

// Fluent builder over the store's SQL dialect (see sql.js):
//
//   db.from('products').where('category', 'books').where('price', '<', 2000)
//     .orderBy('price', 'desc').limit(10).all()
//
// Field names are checked against a strict pattern; values become literals.

const FIELD_PATTERN = /^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/;
const ALLOWED_OPS = new Set(['=', '!=', '<', '<=', '>', '>=', 'LIKE']);

function assertField(field) {
  if (typeof field !== 'string' || !FIELD_PATTERN.test(field)) {
    throw new ValidationError(`Invalid field name "${field}"`);
  }
  return field;
}

function literal(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError('Numeric values must be finite');
    return String(value);
  }
  if (typeof value === 'string') return `'${value}'`;
  throw new ValidationError(`Unsupported value type ${typeof value}`);
}

class QueryBuilder {
  constructor(store, collection) {
    this.store = store;
    this.collection = assertField(collection);
    this.conditions = [];
    this.order = null;
    this.max = null;
    this.skip = 0;
  }

  #add(joiner, field, op, value) {
    const operator = String(op).toUpperCase();
    if (!ALLOWED_OPS.has(operator)) throw new ValidationError(`Unsupported operator "${op}"`);
    this.conditions.push({ joiner, field: assertField(field), op: operator, value });
    return this;
  }

  // where(field, value) means equality; where(field, op, value) for the rest.
  where(field, op, value) {
    if (arguments.length === 2) return this.#add('AND', field, '=', op);
    return this.#add('AND', field, op, value);
  }

  orWhere(field, op, value) {
    if (arguments.length === 2) return this.#add('OR', field, '=', op);
    return this.#add('OR', field, op, value);
  }

  orderBy(field, direction = 'asc') {
    const dir = String(direction).toUpperCase();
    if (dir !== 'ASC' && dir !== 'DESC') throw new ValidationError(`Invalid sort direction "${direction}"`);
    this.order = { field: assertField(field), direction: dir };
    return this;
  }

  limit(n) {
    if (!Number.isInteger(n) || n < 0) throw new ValidationError('limit must be a non-negative integer');
    this.max = n;
    return this;
  }

  offset(n) {
    if (!Number.isInteger(n) || n < 0) throw new ValidationError('offset must be a non-negative integer');
    this.skip = n;
    return this;
  }

  toSql() {
    let sql = `SELECT * FROM ${this.collection}`;
    this.conditions.forEach((c, index) => {
      sql += index === 0 ? ' WHERE ' : ` ${c.joiner} `;
      sql += `${c.field} ${c.op} ${literal(c.value)}`;
    });
    if (this.order) sql += ` ORDER BY ${this.order.field} ${this.order.direction}`;
    if (this.max !== null) sql += ` LIMIT ${this.max}`;
    if (this.skip) sql += ` OFFSET ${this.skip}`;
    return sql;
  }

  all() {
    return this.store.execute(this.toSql());
  }

  first() {
    const previous = this.max;
    this.max = 1;
    try {
      return this.all()[0] || null;
    } finally {
      this.max = previous;
    }
  }

  count() {
    return this.all().length;
  }
}

module.exports = { QueryBuilder };
