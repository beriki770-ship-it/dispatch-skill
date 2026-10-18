'use strict';

const { systemClock } = require('../util/clock');

// Fixed-window rate limiter: each key may make `max` calls per window of
// `windowMs`. The window for a key starts with its first call.
function createRateLimiter({ windowMs, max, clock = systemClock }) {
  if (!Number.isInteger(windowMs) || windowMs <= 0) throw new Error('windowMs must be a positive integer');
  if (!Number.isInteger(max) || max <= 0) throw new Error('max must be a positive integer');

  const buckets = new Map();

  // Records one call for `key`. `allowed` is false once the key is over its
  // limit for the current window.
  function hit(key) {
    const now = clock.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }
    if (now - bucket.windowStart >= windowMs) {
      bucket.count = 0;
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      resetAt: bucket.windowStart + windowMs,
    };
  }

  function reset(key) {
    buckets.delete(key);
  }

  // Drops buckets whose window ended, so idle keys do not pile up.
  function prune() {
    const now = clock.now();
    let removed = 0;
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  return { hit, reset, prune, size: () => buckets.size };
}

module.exports = { createRateLimiter };
