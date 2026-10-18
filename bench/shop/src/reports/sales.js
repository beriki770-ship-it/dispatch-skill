'use strict';

const { ValidationError } = require('../util/errors');
const { toMajor, toMinor, formatPlain } = require('../pricing');
const { REVENUE_STATUSES } = require('../orders/status');
const { toCsv } = require('./csv');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRevenue(order) {
  return REVENUE_STATUSES.has(order.status);
}

// Calendar day ("YYYY-MM-DD") of a timestamp, used to bucket orders.
function dayOf(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

// "2026-03-11 14:05" in the shop's time zone, for human-readable exports.
function formatDateTime(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

// Count, revenue and average order value (all cents) over revenue orders.
function salesSummary(orders) {
  const counted = orders.filter(isRevenue);
  const sum = counted.reduce((total, order) => total + toMajor(order.total), 0);
  return {
    count: counted.length,
    revenue: toMinor(sum),
    average: counted.length === 0 ? 0 : toMinor(sum / counted.length),
  };
}

// Revenue orders placed on one calendar day.
function dailySales(orders, date, { timeZone } = {}) {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
    throw new ValidationError('date must be formatted YYYY-MM-DD', { field: 'date' });
  }
  const sameDay = orders.filter((order) => isRevenue(order) && dayOf(order.createdAt) === date);
  return {
    date,
    timeZone,
    count: sameDay.length,
    revenue: sameDay.reduce((total, order) => total + order.total, 0),
  };
}

const ORDER_COLUMNS = (timeZone) => [
  { key: 'id', header: 'Order' },
  { key: 'createdAt', header: 'Date', format: (value) => formatDateTime(value, timeZone) },
  { key: 'customer', header: 'Customer', format: (_, order) => (order.shippingAddress || {}).name || '' },
  { key: 'status', header: 'Status' },
  { key: 'items', header: 'Items', format: (_, order) => (order.lines || []).reduce((n, line) => n + line.quantity, 0) },
  { key: 'subtotal', header: 'Net', format: formatPlain },
  { key: 'tax', header: 'VAT', format: formatPlain },
  { key: 'total', header: 'Total', format: formatPlain },
];

function ordersCsv(orders, { timeZone } = {}) {
  return toCsv(orders, ORDER_COLUMNS(timeZone));
}

module.exports = { salesSummary, dailySales, ordersCsv, formatDateTime };
