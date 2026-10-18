'use strict';

const money = require('./money');
const { normalizeDiscount } = require('./discounts');
const { taxFor } = require('./tax');
const { assertPositiveInt } = require('../util/validate');

// Price of one cart line in cents: unit price times quantity, less the
// product discount. Worked in euros so the percentage maths reads the same
// as on the price tag.
function lineTotal(unitPriceCents, quantity, discountPercent = 0) {
  money.assertCents(unitPriceCents, 'unitPrice');
  assertPositiveInt(quantity, 'quantity');
  // Integer maths in cents; Math.round is half-up for positive amounts.
  const percent = normalizeDiscount(discountPercent);
  return Math.round((unitPriceCents * quantity * (100 - percent)) / 100);
}

module.exports = {
  lineTotal,
  taxFor,
  normalizeDiscount,
  ...money,
};
