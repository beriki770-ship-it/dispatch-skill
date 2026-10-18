'use strict';

const { Cart } = require('./cart');
const { PriceCache } = require('./price-cache');

// One price cache is shared by every cart of a shop instance.
function createCartService({ catalog, clock }) {
  const priceCache = new PriceCache({ clock });
  return {
    createCart: () => new Cart({ catalog, priceCache }),
    priceCache,
  };
}

module.exports = { createCartService, Cart };
