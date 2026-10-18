'use strict';

const { NotFoundError, OutOfStockError } = require('../util/errors');
const { assertPositiveInt } = require('../util/validate');

const STOCK = 'stock';
const PRODUCTS = 'products';

// Stock per product has three counters:
//   available - can still be ordered
//   reserved  - held by pending orders
//   sold      - taken by paid orders
//
// reserve: available -> reserved   (order placed)
// release: reserved  -> available  (order cancelled before payment)
// commit:  reserved  -> sold       (order paid)
// restock: adds to available       (delivery, refund)
function createInventory({ store, audit, i18n, language = 'en' }) {
  function requireRow(productId) {
    const row = store.get(STOCK, productId);
    if (!row) throw new NotFoundError('stock record', productId);
    return row;
  }

  function productName(productId) {
    const product = store.get(PRODUCTS, productId);
    return product ? product.name : productId;
  }

  function getAvailable(productId) {
    return requireRow(productId).available;
  }

  function getLevels(productId) {
    const { available, reserved, sold } = requireRow(productId);
    return { available, reserved, sold };
  }

  async function reserve(productId, quantity, { reference } = {}) {
    assertPositiveInt(quantity, 'quantity');
    const row = requireRow(productId);
    if (row.available < quantity) {
      throw new OutOfStockError(i18n.t(language, 'errors.outOfStock', { name: productName(productId) }), {
        productId,
        requested: quantity,
        available: row.available,
      });
    }

    await audit.record({ type: 'reserve', productId, quantity, reference });

    // Apply as relative changes on the current record so a restock that
    // happened in the meantime is not overwritten.
    store.increment(STOCK, productId, 'available', -quantity);
    store.increment(STOCK, productId, 'reserved', quantity);
    return true;
  }

  async function release(productId, quantity, { reference } = {}) {
    assertPositiveInt(quantity, 'quantity');
    const row = requireRow(productId);
    const amount = Math.min(quantity, row.reserved);
    store.increment(STOCK, productId, 'reserved', -amount);
    store.increment(STOCK, productId, 'available', amount);
    await audit.record({ type: 'release', productId, quantity: amount, reference });
    return amount;
  }

  async function commit(productId, quantity, { reference } = {}) {
    assertPositiveInt(quantity, 'quantity');
    const row = requireRow(productId);
    const amount = Math.min(quantity, row.reserved);
    store.increment(STOCK, productId, 'reserved', -amount);
    store.increment(STOCK, productId, 'sold', amount);
    await audit.record({ type: 'commit', productId, quantity: amount, reference });
    return amount;
  }

  async function restock(productId, quantity, { reference } = {}) {
    assertPositiveInt(quantity, 'quantity');
    requireRow(productId);
    const available = store.increment(STOCK, productId, 'available', quantity);
    await audit.record({ type: 'restock', productId, quantity, reference });
    return available;
  }

  return { getAvailable, getLevels, reserve, release, commit, restock, audit };
}

module.exports = { createInventory };
