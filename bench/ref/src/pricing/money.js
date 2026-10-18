'use strict';

const { ValidationError } = require('../util/errors');

// Amounts enter and leave the public API as integer cents. These helpers
// convert to and from the major unit (euros) for calculations and display.

function toMajor(cents) {
  return cents / 100;
}

function toMinor(amount) {
  return Math.round(amount * 100);
}

function assertCents(value, name = 'amount') {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${name} must be a non-negative integer number of cents`, { field: name, value });
  }
  return value;
}

// "12.34" - fixed two decimals, no currency sign. Used for CSV exports.
function formatPlain(cents) {
  return toMajor(cents).toFixed(2);
}

// Locale-aware display string, e.g. "€ 12,34" for de-AT.
function formatMoney(cents, { currency = 'EUR', locale = 'de-AT' } = {}) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(toMajor(cents));
}

module.exports = { toMajor, toMinor, assertCents, formatPlain, formatMoney };
