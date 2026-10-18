'use strict';

const { randomToken } = require('../util/ids');

const COLLECTION = 'sessions';

// Sessions are bearer tokens with a fixed lifetime from login. Every API
// request validates its token, so validated tokens are kept in a small
// in-process cache in front of the store.
function createSessionService({ store, clock, ttlMs }) {
  const cache = new Map();

  function create(userId) {
    const now = clock.now();
    const session = {
      id: randomToken(),
      userId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    store.insert(COLLECTION, session);
    return { token: session.id, expiresAt: session.expiresAt };
  }

  // Returns the user id for a live token, or null.
  function validate(token) {
    if (typeof token !== 'string' || token === '') return null;

    const cached = cache.get(token);
    if (cached && cached.expiresAt > clock.now()) return cached.userId;
    cache.delete(token);

    const session = store.get(COLLECTION, token);
    if (!session) return null;
    if (session.expiresAt <= clock.now()) {
      store.remove(COLLECTION, token);
      return null;
    }
    cache.set(token, { userId: session.userId, expiresAt: session.expiresAt });
    return session.userId;
  }

  function revoke(token) {
    cache.delete(token);
    return store.remove(COLLECTION, token);
  }

  // Housekeeping for the scheduler: drops expired sessions from the store
  // and the cache. Returns how many were removed.
  function purgeExpired() {
    const now = clock.now();
    let removed = 0;
    for (const session of store.all(COLLECTION)) {
      if (session.expiresAt <= now) {
        store.remove(COLLECTION, session.id);
        cache.delete(session.id);
        removed += 1;
      }
    }
    return removed;
  }

  return { create, validate, revoke, purgeExpired };
}

module.exports = { createSessionService };
