'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createI18n, interpolate } = require('../src/i18n');

const i18n = createI18n({ defaultLanguage: 'en' });

test('translates into German', () => {
  assert.equal(i18n.t('de', 'errors.emptyCart'), 'Ihr Warenkorb ist leer');
});

test('regional language tags fall back to the base language', () => {
  assert.equal(i18n.t('de-AT', 'errors.emptyCart'), 'Ihr Warenkorb ist leer');
});

test('unknown languages use the default language', () => {
  assert.equal(i18n.t('fr', 'errors.emptyCart'), 'Your cart is empty');
});

test('unknown keys come back unchanged', () => {
  assert.equal(i18n.t('en', 'errors.doesNotExist'), 'errors.doesNotExist');
});

test('placeholders are filled in', () => {
  assert.equal(interpolate('Order {id} for {name}', { id: 7, name: 'Ann' }), 'Order 7 for Ann');
  assert.equal(interpolate('Hello {name}', {}), 'Hello {name}');
});

test('the English out-of-stock message', () => {
  assert.equal(i18n.t('en', 'errors.outOfStock', { name: 'Atlas' }), 'Not enough stock for Atlas');
});

test('every English key has a German translation', () => {
  const en = require('../src/i18n/messages/en');
  const de = require('../src/i18n/messages/de');
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});
