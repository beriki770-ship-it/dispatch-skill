'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../src/mail');
const { createShop } = require('../src');

test('template fills values and nested paths', () => {
  assert.equal(render('Hi {{ user.name }}!', { user: { name: 'Ann' } }), 'Hi Ann!');
  assert.equal(render('[{{ missing }}]', {}), '[]');
});

test('each repeats a block per item', () => {
  const text = render('{{#each items}}<{{ name }}:{{ qty }}>{{/each}}', {
    items: [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }],
  });
  assert.equal(text, '<a:1><b:2>');
});

test('each exposes the item as a dot', () => {
  assert.equal(render('{{#each tags}}{{ . }} {{/each}}', { tags: ['x', 'y'] }), 'x y ');
});

test('if includes a block only when truthy, and blocks nest', () => {
  const template = '{{#if show}}A{{#if inner}}B{{/if}}{{/if}}';
  assert.equal(render(template, { show: true, inner: true }), 'AB');
  assert.equal(render(template, { show: true, inner: false }), 'A');
  assert.equal(render(template, { show: false, inner: true }), '');
});

test('inside each, outer values are still visible', () => {
  assert.equal(render('{{#each items}}{{ name }}{{ sep }}{{/each}}', { sep: ';', items: [{ name: 'a' }] }), 'a;');
});

test('the shipping notice is translated', () => {
  const shop = createShop();
  const order = { id: 'ord_9', lines: [], subtotal: 0, tax: 0, total: 0 };
  assert.equal(shop.mail.renderShippingNotice(order, 'en').subject, 'Order ord_9 has shipped');
  assert.equal(shop.mail.renderShippingNotice(order, 'de').subject, 'Bestellung ord_9 wurde versendet');
});

test('order mails list the lines and the total', () => {
  const shop = createShop();
  const order = {
    id: 'ord_1',
    lines: [{ name: 'Dune', quantity: 2, lineTotal: 2400 }],
    subtotal: 2400,
    tax: 240,
    total: 2640,
  };
  const { text } = shop.mail.renderShippingNotice(order, 'en');
  assert.match(text, /2 x Dune/);
  assert.match(text, /Total: €\s26,40/);
});
