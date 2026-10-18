'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../src');

const ORDERS = [
  { id: 'o1', status: 'paid', subtotal: 1000, tax: 100, total: 1100, createdAt: '2026-05-04T08:00:00Z', lines: [{ quantity: 1 }], shippingAddress: { name: 'Ann' } },
  { id: 'o2', status: 'shipped', subtotal: 2000, tax: 200, total: 2200, createdAt: '2026-05-04T09:30:00Z', lines: [{ quantity: 2 }], shippingAddress: { name: 'Ben' } },
  { id: 'o3', status: 'cancelled', subtotal: 500, tax: 50, total: 550, createdAt: '2026-05-04T10:00:00Z', lines: [{ quantity: 1 }], shippingAddress: { name: 'Cem' } },
];

test('summary counts revenue orders only', () => {
  const { reports } = createShop();
  assert.deepEqual(reports.salesSummary(ORDERS), { count: 2, revenue: 3300, average: 1650 });
});

test('summary of no orders is all zeros', () => {
  const { reports } = createShop();
  assert.deepEqual(reports.salesSummary([]), { count: 0, revenue: 0, average: 0 });
});

test('daily sales for a midday date', () => {
  const { reports } = createShop();
  const day = reports.dailySales(ORDERS, '2026-05-04');
  assert.equal(day.date, '2026-05-04');
  assert.equal(day.count, 2);
  assert.equal(day.revenue, 3300);
});

test('daily sales rejects malformed dates', () => {
  const { reports } = createShop();
  assert.throws(() => reports.dailySales(ORDERS, '04.05.2026'), { code: 'VALIDATION' });
});

test('orders export has a header and local times', () => {
  const { reports } = createShop();
  const lines = reports.ordersCsv(ORDERS.slice(0, 1)).trim().split('\n');
  assert.equal(lines[0], 'Order,Date,Customer,Status,Items,Net,VAT,Total');
  assert.equal(lines[1], 'o1,2026-05-04 10:00,Ann,paid,1,10.00,1.00,11.00');
});
