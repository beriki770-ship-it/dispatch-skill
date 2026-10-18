'use strict';

const { setImmediate: nextTick } = require('node:timers/promises');

// Append-only record of every stock movement. Writing is asynchronous to
// match the interface of the persistent log used in production, which
// flushes to disk; this in-memory version yields once to behave the same way.
class AuditLog {
  constructor({ clock }) {
    this.clock = clock;
    this.entries = [];
  }

  async record(entry) {
    await nextTick();
    this.entries.push({ ...entry, at: new Date(this.clock.now()).toISOString() });
  }

  forProduct(productId) {
    return this.entries.filter((entry) => entry.productId === productId);
  }
}

module.exports = { AuditLog };
