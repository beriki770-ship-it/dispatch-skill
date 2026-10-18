'use strict';

// VAT on a net amount, in cents. `ratePercent` is a whole percentage
// (10 for the reduced book rate). Integer maths, rounded half up.
function taxFor(netCents, ratePercent) {
  return Math.round((netCents * ratePercent) / 100);
}

module.exports = { taxFor };
