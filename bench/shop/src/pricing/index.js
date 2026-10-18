'use strict';

const money = require('./money');
const { applyPercent, normalizeDiscount } = require('./discounts');
const { taxFor } = require('./tax');
const { assertPositiveInt } = require('../util/validate');

// Price of one cart line in cents: unit price times quantity, less the
// product discount. Worked in euros so the percentage maths reads the same
// as on the price tag.
function lineTotal(unitPriceCents, quantity, discountPercent = 0) {
  money.assertCents(unitPriceCents, 'unitPrice');
  assertPositiveInt(quantity, 'quantity');
  const gross = money.toMajor(unitPriceCents) * quantity;
  return money.toMinor(applyPercent(gross, normalizeDiscount(discountPercent)));
}

module.exports = {
  lineTotal,
  taxFor,
  normalizeDiscount,
  ...money,
};
