'use strict';

const { assertPercent } = require('../util/validate');

// Product discounts are whole percentages taken off the unit price.

function applyPercent(amount, percent) {
  return amount * (1 - percent / 100);
}

// Normalises an optional discount from user input: undefined means none.
function normalizeDiscount(percent) {
  if (percent === undefined || percent === null) return 0;
  return assertPercent(percent, 'discountPercent');
}

module.exports = { applyPercent, normalizeDiscount };
