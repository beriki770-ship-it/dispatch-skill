'use strict';

// Built-in configuration. Environment variables (see env.js) and the
// overrides passed to createShop() are layered on top of this, in that order.

const KB = 1024;

module.exports = {
  currency: 'EUR',
  locale: 'de-AT',
  timeZone: 'Europe/Vienna',
  defaultLanguage: 'en',

  // The shop sells books, which carry the reduced Austrian VAT rate.
  // Whole percent, applied to the order net total.
  vatRate: 10,

  // Sessions last one hour from login.
  sessionTtlMs: 60 * 60 * 1000,

  pageSize: 20,
  maxPageSize: 100,

  uploads: {
    dir: './data/uploads',
    // Cover images and sample PDFs, up to 5 MB each.
    maxBytes: 5 * KB * 102,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt'],
  },

  rateLimit: {
    windowMs: 60 * 1000,
    max: 60,
  },

  mail: {
    from: 'orders@bookshop.example',
  },
};
