'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/ratelimit/limiter');
const { fixedClock } = require('../src/util/clock');

test('allows max calls per window, then blocks', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 3, clock });
  const results = [1, 2, 3, 4].map(() => limiter.hit('ip-1').allowed);
  assert.deepEqual(results, [true, true, true, false]);
});

test('reports the remaining allowance', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, clock });
  assert.equal(limiter.hit('k').remaining, 1);
  assert.equal(limiter.hit('k').remaining, 0);
});

test('keys are limited independently', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, clock });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('b').allowed, true);
  assert.equal(limiter.hit('a').allowed, false);
});

test('a new window gives a fresh allowance that runs out again', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, clock });
  limiter.hit('k');
  limiter.hit('k');
  assert.equal(limiter.hit('k').allowed, false);
  clock.advance(1500);
  const results = [1, 2, 3].map(() => limiter.hit('k').allowed);
  assert.deepEqual(results, [true, true, false]);
});

test('prune drops keys whose window is over', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, clock });
  limiter.hit('a');
  limiter.hit('b');
  clock.advance(1000);
  assert.equal(limiter.prune(), 2);
  assert.equal(limiter.size(), 0);
});

test('reset clears one key', () => {
  const clock = fixedClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, clock });
  limiter.hit('a');
  limiter.reset('a');
  assert.equal(limiter.hit('a').allowed, true);
});
