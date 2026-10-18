'use strict';

// Carts recompute their lines on every read, and a busy cart page reads them
// several times per request. This cache keeps the price-relevant fields of a
// product for a short while so those reads do not hit the catalogue each
// time.

const DEFAULT_TTL_MS = 10 * 60 * 1000;

class PriceCache {
  constructor({ clock, ttlMs = DEFAULT_TTL_MS }) {
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  // Returns the cached entry or calls `load()` and caches its result.
  // A null result (unknown product) is not cached.
  get(productId, load) {
    const now = this.clock.now();
    const hit = this.entries.get(productId);
    if (hit && hit.expiresAt > now) return hit.value;

    const product = load();
    if (!product) return null;
    const value = {
      name: product.name,
      price: product.price,
      discountPercent: product.discountPercent || 0,
    };
    this.entries.set(productId, { value, expiresAt: now + this.ttlMs });
    return value;
  }

  delete(productId) {
    this.entries.delete(productId);
  }

  clear() {
    this.entries.clear();
  }
}

module.exports = { PriceCache };
