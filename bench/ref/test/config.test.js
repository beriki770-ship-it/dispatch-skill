'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

test('defaults load and are frozen', () => {
  const config = loadConfig({}, {});
  assert.equal(config.currency, 'EUR');
  assert.equal(config.timeZone, 'Europe/Vienna');
  assert.ok(Object.isFrozen(config.uploads));
});

test('environment variables override defaults', () => {
  const config = loadConfig({}, { SHOP_VAT_RATE: '20', SHOP_UPLOAD_DIR: '/srv/uploads' });
  assert.equal(config.vatRate, 20);
  assert.equal(config.uploads.dir, '/srv/uploads');
  assert.ok(config.uploads.allowedExtensions.includes('.png'));
});

test('explicit overrides beat the environment and merge nested objects', () => {
  const config = loadConfig({ rateLimit: { max: 5 } }, { SHOP_RATE_LIMIT_MAX: '9' });
  assert.equal(config.rateLimit.max, 5);
  assert.equal(config.rateLimit.windowMs, 60000);
});

test('malformed numbers in the environment are rejected', () => {
  assert.throws(() => loadConfig({}, { SHOP_SESSION_TTL_MS: 'soon' }), { code: 'VALIDATION' });
});

test('invalid settings are rejected', () => {
  assert.throws(() => loadConfig({ timeZone: 'Mars/Olympus' }, {}), { code: 'VALIDATION' });
  assert.throws(() => loadConfig({ vatRate: 7.7 }, {}), { code: 'VALIDATION' });
  assert.throws(() => loadConfig({ pageSize: 500 }, {}), { code: 'VALIDATION' });
});
