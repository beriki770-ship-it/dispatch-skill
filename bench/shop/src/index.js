'use strict';

const { loadConfig } = require('./config');
const { systemClock } = require('./util/clock');
const { createIdGenerator } = require('./util/ids');
const { createDb } = require('./db');
const { createI18n } = require('./i18n');
const { createAuth } = require('./auth');
const { createCatalog } = require('./catalog');
const { createInventory, AuditLog } = require('./inventory');
const { createCartService } = require('./cart');
const { createPaymentService } = require('./payments');
const { createMailer } = require('./mail');
const { createOrderService } = require('./orders');
const { createSearch } = require('./search');
const { createReports } = require('./reports');
const { createUploadStore } = require('./uploads');
const { createRatelimiter } = require('./ratelimit');
const { createScheduler } = require('./scheduler');

const TEN_MINUTES = 10 * 60 * 1000;

// Wires every module into one shop instance. Instances share nothing, so
// tests can create as many as they like.
//
// `options` is a partial config (see config/defaults.js); `options.clock`
// replaces the system clock.
function createShop(options = {}) {
  const { clock = systemClock, ...overrides } = options;
  const config = loadConfig(overrides);
  const ids = createIdGenerator();
  const db = createDb();
  const i18n = createI18n({ defaultLanguage: config.defaultLanguage });
  const language = config.defaultLanguage;

  const auth = createAuth({ store: db.store, ids, clock, ttlMs: config.sessionTtlMs, i18n, language });
  const catalog = createCatalog({ db, ids, clock });
  const inventory = createInventory({ store: db.store, audit: new AuditLog({ clock }), i18n, language });
  const cart = createCartService({ catalog, clock });
  const payments = createPaymentService({ ids, clock });
  const mail = createMailer({ i18n, config, ids, clock });
  const orders = createOrderService({ store: db.store, ids, clock, config, inventory, payments, mail, i18n });
  const search = createSearch({ store: db.store, config });
  const reports = createReports({ config });
  const uploads = createUploadStore(config.uploads);
  const limiter = createRatelimiter({ ...config.rateLimit, clock });

  const scheduler = createScheduler({ clock });
  scheduler.every('purge-expired-sessions', TEN_MINUTES, () => auth.purgeExpired());
  scheduler.every('prune-rate-limiter', TEN_MINUTES, () => limiter.prune());

  return { config, clock, db, i18n, auth, catalog, inventory, cart, payments, mail, orders, search, reports, uploads, limiter, scheduler };
}

module.exports = { createShop };
