'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('../src/scheduler');
const { fixedClock } = require('../src/util/clock');

test('jobs run once their interval has passed', async () => {
  const clock = fixedClock();
  const scheduler = createScheduler({ clock });
  let runs = 0;
  scheduler.every('count', 1000, () => {
    runs += 1;
  });
  assert.deepEqual(await scheduler.runDue(), []);
  clock.advance(1000);
  assert.deepEqual(await scheduler.runDue(), ['count']);
  assert.deepEqual(await scheduler.runDue(), []);
  clock.advance(1000);
  await scheduler.runDue();
  assert.equal(runs, 2);
});

test('a failing job is recorded and does not stop the others', async () => {
  const clock = fixedClock();
  const scheduler = createScheduler({ clock });
  let ran = false;
  scheduler.every('broken', 10, () => {
    throw new Error('disk full');
  });
  scheduler.every('fine', 10, () => {
    ran = true;
  });
  clock.advance(10);
  assert.deepEqual(await scheduler.runDue(), ['broken', 'fine']);
  assert.equal(ran, true);
  assert.equal(scheduler.list()[0].lastError, 'disk full');
});

test('job names are unique and can be cancelled', () => {
  const scheduler = createScheduler({ clock: fixedClock() });
  scheduler.every('job', 10, () => {});
  assert.throws(() => scheduler.every('job', 10, () => {}));
  assert.equal(scheduler.cancel('job'), true);
  assert.deepEqual(scheduler.list(), []);
});

test('the shop registers its housekeeping jobs', () => {
  const { createShop } = require('../src');
  const names = createShop().scheduler.list().map((job) => job.name);
  assert.deepEqual(names, ['purge-expired-sessions', 'prune-rate-limiter']);
});
