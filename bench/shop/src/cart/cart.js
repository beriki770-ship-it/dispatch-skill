'use strict';

const { NotFoundError, ValidationError } = require('../util/errors');
const { assertPositiveInt } = require('../util/validate');
const { lineTotal, toMajor, toMinor } = require('../pricing');

const MAX_QUANTITY_PER_LINE = 99;

// A shopping cart holds product ids and quantities only. Prices are looked
// up when lines are read, so a cart always shows current catalogue prices.
// Adding to the cart does not reserve stock; that happens when the order is
// placed.
class Cart {
  #items = new Map();

  constructor({ catalog, priceCache }) {
    this.catalog = catalog;
    this.priceCache = priceCache;
  }

  #lookup(productId) {
    return this.priceCache.get(productId, () => this.catalog.getProduct(productId));
  }

  add(productId, quantity = 1) {
    assertPositiveInt(quantity, 'quantity');
    if (!this.#lookup(productId)) throw new NotFoundError('product', productId);
    const next = (this.#items.get(productId) || 0) + quantity;
    if (next > MAX_QUANTITY_PER_LINE) {
      throw new ValidationError(`At most ${MAX_QUANTITY_PER_LINE} of one product per order`, { field: 'quantity' });
    }
    this.#items.set(productId, next);
    return this;
  }

  // Setting a quantity of 0 removes the line.
  setQuantity(productId, quantity) {
    if (!this.#items.has(productId)) throw new NotFoundError('cart line', productId);
    if (quantity === 0) {
      this.#items.delete(productId);
      return this;
    }
    assertPositiveInt(quantity, 'quantity');
    if (quantity > MAX_QUANTITY_PER_LINE) {
      throw new ValidationError(`At most ${MAX_QUANTITY_PER_LINE} of one product per order`, { field: 'quantity' });
    }
    this.#items.set(productId, quantity);
    return this;
  }

  remove(productId) {
    return this.#items.delete(productId);
  }

  clear() {
    this.#items.clear();
  }

  isEmpty() {
    return this.#items.size === 0;
  }

  itemCount() {
    let count = 0;
    for (const quantity of this.#items.values()) count += quantity;
    return count;
  }

  // Lines in the order products were first added. A product removed from
  // the catalogue since it was added is dropped from the cart.
  lines() {
    const result = [];
    for (const [productId, quantity] of this.#items) {
      const product = this.#lookup(productId);
      if (!product) {
        this.#items.delete(productId);
        continue;
      }
      result.push({
        productId,
        name: product.name,
        unitPrice: product.price,
        discountPercent: product.discountPercent,
        quantity,
        lineTotal: lineTotal(product.price, quantity, product.discountPercent),
      });
    }
    return result;
  }

  // Sum of the line totals, in cents.
  subtotal() {
    const sum = this.lines().reduce((total, line) => total + toMajor(line.lineTotal), 0);
    return toMinor(sum);
  }

  toJSON() {
    return { lines: this.lines(), subtotal: this.subtotal(), itemCount: this.itemCount() };
  }
}

module.exports = { Cart, MAX_QUANTITY_PER_LINE };
