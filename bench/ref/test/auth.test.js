'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
const { createShop } = require('../src');

const ACCOUNT = { email: 'Reader@Example.com', password: 'correct horse', name: 'Ann Reader' };

test('register returns the user without the password hash', () => {
  const shop = createShop();
  const user = shop.auth.register(ACCOUNT);
  assert.equal(user.email, 'reader@example.com');
  assert.equal(user.name, 'Ann Reader');
  assert.equal(user.passwordHash, undefined);
});

test('register rejects a duplicate email regardless of case', () => {
  const shop = createShop();
  shop.auth.register(ACCOUNT);
  assert.throws(() => shop.auth.register({ ...ACCOUNT, email: 'READER@example.com' }), { code: 'VALIDATION' });
});

test('register rejects short passwords', () => {
  const shop = createShop();
  assert.throws(() => shop.auth.register({ ...ACCOUNT, password: 'short' }), { code: 'VALIDATION' });
});

test('login returns a token that authenticates the user', () => {
  const shop = createShop();
  const user = shop.auth.register(ACCOUNT);
  const { token, expiresAt } = shop.auth.login('reader@example.com', 'correct horse');
  assert.ok(expiresAt > Date.now());
  assert.equal(shop.auth.authenticate(token).id, user.id);
});

test('login fails with the same error for incorrect password and unknown email', () => {
  const shop = createShop();
  shop.auth.register(ACCOUNT);
  const expected = { code: 'AUTH', message: 'Invalid email or password' };
  assert.throws(() => shop.auth.login('reader@example.com', 'nope nope'), expected);
  assert.throws(() => shop.auth.login('ghost@example.com', 'correct horse'), expected);
});

test('logout invalidates the token', () => {
  const shop = createShop();
  shop.auth.register(ACCOUNT);
  const { token } = shop.auth.login(ACCOUNT.email, ACCOUNT.password);
  assert.ok(shop.auth.authenticate(token));
  shop.auth.logout(token);
  assert.equal(shop.auth.authenticate(token), null);
});

test('unknown tokens do not authenticate', () => {
  const shop = createShop();
  assert.equal(shop.auth.authenticate('not-a-token'), null);
  assert.equal(shop.auth.authenticate(''), null);
});

test('a session stops working once it has expired', async () => {
  const shop = createShop({ sessionTtlMs: 40 });
  shop.auth.register(ACCOUNT);
  const { token } = shop.auth.login(ACCOUNT.email, ACCOUNT.password);
  assert.ok(shop.auth.authenticate(token));
  await sleep(90);
  assert.equal(shop.auth.authenticate(token), null);
});

test('purgeExpired removes sessions past their lifetime', async () => {
  const shop = createShop({ sessionTtlMs: 20 });
  shop.auth.register(ACCOUNT);
  shop.auth.login(ACCOUNT.email, ACCOUNT.password);
  await sleep(50);
  assert.equal(shop.auth.purgeExpired(), 1);
});
