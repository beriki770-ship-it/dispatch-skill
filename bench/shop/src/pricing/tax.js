'use strict';

const { toMajor, toMinor } = require('./money');

// VAT on a net amount, in cents. `ratePercent` is a whole percentage
// (10 for the reduced book rate).
function taxFor(netCents, ratePercent) {
  return toMinor(toMajor(netCents) * (ratePercent / 100));
}

module.exports = { taxFor };
