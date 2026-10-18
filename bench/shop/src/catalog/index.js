'use strict';

const { NotFoundError, ValidationError } = require('../util/errors');
const { assertString, assertNonNegativeInt } = require('../util/validate');
const { assertCents, normalizeDiscount } = require('../pricing');

const PRODUCTS = 'products';
const STOCK = 'stock';

const EDITABLE_FIELDS = ['name', 'description', 'category', 'price', 'discountPercent'];

function normalizeCategory(category) {
  return assertString(category, 'category', { max: 80 }).toLowerCase();
}

function createCatalog({ db, ids, clock }) {
  const { store } = db;

  // Creates the product and its stock record. `createdAt` may be passed when
  // importing an existing catalogue; it defaults to now.
  function createProduct(input) {
    const name = assertString(input.name, 'name', { max: 200 });
    const price = assertCents(input.price, 'price');
    const stock = assertNonNegativeInt(input.stock ?? 0, 'stock');
    let createdAt = new Date(clock.now()).toISOString();
    if (input.createdAt !== undefined) {
      const parsed = Date.parse(input.createdAt);
      if (Number.isNaN(parsed)) throw new ValidationError('createdAt must be an ISO date', { field: 'createdAt' });
      createdAt = new Date(parsed).toISOString();
    }

    const product = store.insert(PRODUCTS, {
      id: ids('prd'),
      name,
      description: input.description ? assertString(input.description, 'description', { min: 0 }) : '',
      category: normalizeCategory(input.category ?? 'general'),
      price,
      discountPercent: normalizeDiscount(input.discountPercent),
      createdAt,
    });
    store.insert(STOCK, { id: product.id, available: stock, reserved: 0, sold: 0 });
    return product;
  }

  function getProduct(id) {
    return store.get(PRODUCTS, id);
  }

  function requireProduct(id) {
    const product = getProduct(id);
    if (!product) throw new NotFoundError('product', id);
    return product;
  }

  function updateProduct(id, patch) {
    requireProduct(id);
    const changes = {};
    for (const [key, value] of Object.entries(patch || {})) {
      if (!EDITABLE_FIELDS.includes(key)) {
        throw new ValidationError(`Field "${key}" cannot be changed`, { field: key });
      }
      if (key === 'name') changes.name = assertString(value, 'name', { max: 200 });
      if (key === 'description') changes.description = assertString(value, 'description', { min: 0 });
      if (key === 'category') changes.category = normalizeCategory(value);
      if (key === 'price') changes.price = assertCents(value, 'price');
      if (key === 'discountPercent') changes.discountPercent = normalizeDiscount(value);
    }
    return store.update(PRODUCTS, id, changes);
  }

  function removeProduct(id) {
    store.remove(STOCK, id);
    return store.remove(PRODUCTS, id);
  }

  function listProducts() {
    return store.all(PRODUCTS);
  }

  function findByCategory(category) {
    return db.from(PRODUCTS).where('category', String(category).toLowerCase()).orderBy('name').all();
  }

  return { createProduct, getProduct, requireProduct, updateProduct, removeProduct, listProducts, findByCategory };
}

module.exports = { createCatalog };
