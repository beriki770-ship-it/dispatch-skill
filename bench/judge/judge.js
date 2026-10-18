'use strict';

// Hidden judge for the shop benchmark.
//
//   node judge.js <path-to-shop-copy>
//
// Prints one JSON line: {"B01":bool,...,"B16":bool,"regression":bool}.
// Each Bxx check exercises only the public API documented in the shop's
// README, so any correct fix passes. A check that throws, times out or
// cannot load the code counts as false.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');

const ROOT = path.resolve(process.argv[2] || '.');
const CHECK_TIMEOUT_MS = 15000;
const SUITE_TIMEOUT_MS = 180000;

// Visible tests that passed on the original seeded code. "regression" is
// true only if every one of them still passes in the copy.
const BASELINE_PASSING = ["register returns the user without the password hash","register rejects a duplicate email regardless of case","register rejects short passwords","login returns a token that authenticates the user","login fails with the same error for incorrect password and unknown email","logout invalidates the token","unknown tokens do not authenticate","purgeExpired removes sessions past their lifetime","cart lines carry name, unit price, quantity and line total","adding the same product twice increases the quantity","product discounts apply to the line total","subtotal adds up all lines","setQuantity to zero removes the line","unknown products cannot be added","quantities must be positive whole numbers and at most 99","defaults load and are frozen","environment variables override defaults","explicit overrides beat the environment and merge nested objects","malformed numbers in the environment are rejected","invalid settings are rejected","writes a header and one line per row","uses custom headers and formatters","empty and missing values become empty cells","cells with commas are quoted","store hands out copies, not live objects","store emits change events","duplicate ids are rejected","equality, comparison and ordering","nested fields can be queried","orWhere adds an alternative","LIKE matches with wildcards, ignoring case","limit, offset, first and count","field names are validated","the builder produces readable SQL","string literals support doubled quotes","translates into German","regional language tags fall back to the base language","unknown languages use the default language","unknown keys come back unchanged","placeholders are filled in","every English key has a German translation","reserve moves stock from available to reserved","reserving more than is available throws OutOfStockError","release returns reserved stock","commit turns reserved stock into sold stock","restock adds to available stock","every movement is written to the audit log","unknown products have no stock record","template fills values and nested paths","each repeats a block per item","each exposes the item as a dot","if includes a block only when truthy, and blocks nest","inside each, outer values are still visible","the shipping notice is translated","order mails list the lines and the total","creating an order computes subtotal, VAT and total","creating an order reserves stock","an empty cart cannot be ordered","ordering more than is in stock fails and reserves nothing","paying an order marks it paid, sells the stock and queues a mail","a declined payment leaves the order pending","cancelling a pending order releases its stock","cancelling a paid order refunds and restocks","illegal status changes are rejected","orders are listed newest first","the shipping address is validated","the first page holds the first pageSize items","the last page holds the remainder","the page size is clamped to the maximum","invalid page numbers fall back to the first page","a test card charge succeeds","declined cards raise PaymentError with a reason","unknown sources and zero amounts are invalid","repeating an idempotency key does not charge twice","partial and full refunds","allows max calls per window, then blocks","reports the remaining allowance","keys are limited independently","prune drops keys whose window is over","reset clears one key","summary counts revenue orders only","summary of no orders is all zeros","daily sales for a midday date","daily sales rejects malformed dates","orders export has a header and local times","jobs run once their interval has passed","a failing job is recorded and does not stop the others","job names are unique and can be cancelled","the shop registers its housekeeping jobs","finds products by a word in the name","matching ignores accents and case","name matches rank above description matches","sort by price puts the cheapest first","category filter narrows the results","newly added products show up in search","unknown sort orders are rejected","saves a file and reports its size and hash","a taken name gets a numeric suffix","disallowed file types are rejected","empty files are rejected","unsafe characters are replaced","read and remove work on saved files"];

// ---------------------------------------------------------------- helpers

function load(rel) {
  return require(path.join(ROOT, 'src', rel));
}

function newShop(options = {}) {
  return load('index.js').createShop(options);
}

const ADDRESS = { name: 'Judge Reader', street: 'Ring 1', postalCode: '1010', city: 'Wien', country: 'AT' };

async function placeOrder(shop, cart) {
  return shop.orders.create({ userId: 'usr_judge', email: 'judge@example.com', cart, shippingAddress: { ...ADDRESS } });
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Settles a promise-or-value: true if it resolved to something other than
// false, false if it threw/rejected or returned false.
async function succeeded(fn) {
  try {
    const value = await fn();
    return value !== false;
  } catch {
    return false;
  }
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shop-judge-'));
}

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

// RFC 4180 reader, used to check that exported CSV reads back unchanged.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      // handled by the \n branch
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ----------------------------------------------------------------- checks

const checks = {
  // Order keeps shippingAddress under the documented property name.
  async B01() {
    const shop = newShop();
    const product = shop.catalog.createProduct({ name: 'Atlas', price: 1000, stock: 5 });
    const order = await placeOrder(shop, shop.cart.createCart().add(product.id, 1));
    return sameJson(order.shippingAddress, ADDRESS) && sameJson(shop.orders.get(order.id).shippingAddress, ADDRESS);
  },

  // Confirmation mail subject uses the "confirmed" message.
  async B02() {
    const shop = newShop();
    const order = {
      id: 'ord_judge1',
      email: 'judge@example.com',
      lines: [],
      subtotal: 1000,
      tax: 100,
      total: 1100,
      shippingAddress: { ...ADDRESS },
      shippingAdress: { ...ADDRESS },
    };
    const en = shop.mail.renderOrderConfirmation(order, 'en').subject;
    const de = shop.mail.renderOrderConfirmation(order, 'de').subject;
    return en === 'Order ord_judge1 confirmed' && de === 'Bestellung ord_judge1 bestätigt';
  },

  // English out-of-stock message is spelled as documented, also when thrown.
  async B03() {
    const shop = newShop();
    if (shop.i18n.t('en', 'errors.outOfStock', { name: 'Atlas' }) !== 'Not enough stock for Atlas') return false;
    const product = shop.catalog.createProduct({ name: 'Atlas', price: 1000, stock: 0 });
    try {
      await shop.inventory.reserve(product.id, 1);
      return false;
    } catch (error) {
      return error.message === 'Not enough stock for Atlas';
    }
  },

  // 5 MB upload limit: 1 MB accepted, 6 MB rejected.
  async B04() {
    const root = tempRoot();
    try {
      const shop = newShop({ uploads: { dir: path.join(root, 'up') } });
      const small = await succeeded(() => shop.uploads.save('one-mb.png', Buffer.alloc(1024 * 1024, 1)));
      const huge = await succeeded(() => shop.uploads.save('six-mb.png', Buffer.alloc(6 * 1024 * 1024, 1)));
      const near = await succeeded(() => shop.uploads.save('four-mb.png', Buffer.alloc(4 * 1024 * 1024, 1)));
      return small && near && !huge;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },

  // ratelimit module exports the documented factory name.
  async B05() {
    const mod = load('ratelimit');
    if (typeof mod.createRateLimiter !== 'function') return false;
    const limiter = mod.createRateLimiter({ windowMs: 1000, max: 1 });
    return limiter.hit('k').allowed === true && limiter.hit('k').allowed === false;
  },

  // totalPages = ceil(total / pageSize); hasNext false on the last page.
  async B06() {
    const make = (n) => {
      const shop = newShop();
      for (let i = 1; i <= n; i += 1) shop.catalog.createProduct({ name: `Lamp ${i}`, price: 100 + i, stock: 1 });
      return shop;
    };
    const twenty = make(20);
    const p2 = twenty.search.find('lamp', { pageSize: 10, page: 2 });
    const p1 = twenty.search.find('lamp', { pageSize: 10, page: 1 });
    const twentyOne = make(21).search.find('lamp', { pageSize: 10, page: 1 });
    const ten = make(10).search.find('lamp', { pageSize: 5, page: 2 });
    return (
      p2.totalPages === 2 &&
      p2.hasNext === false &&
      p2.items.length === 10 &&
      p1.hasNext === true &&
      twentyOne.totalPages === 3 &&
      ten.totalPages === 2 &&
      ten.hasNext === false
    );
  },

  // sort: 'newest' returns most recent createdAt first.
  async B07() {
    const shop = newShop();
    const a = shop.catalog.createProduct({ name: 'Sea Atlas', price: 1000, stock: 1, createdAt: '2025-06-01T00:00:00Z' });
    const b = shop.catalog.createProduct({ name: 'Sea Charts', price: 1000, stock: 1, createdAt: '2026-02-01T00:00:00Z' });
    const c = shop.catalog.createProduct({ name: 'Sea Songs', price: 1000, stock: 1, createdAt: '2025-11-15T00:00:00Z' });
    const ids = shop.search.find('sea', { sort: 'newest' }).items.map((item) => item.id);
    return sameJson(ids, [b.id, c.id, a.id]);
  },

  // dailySales buckets by the Vienna calendar day, winter and summer time.
  async B08() {
    const shop = newShop();
    const orders = [
      { id: 'a', status: 'paid', total: 100, createdAt: '2026-03-10T23:30:00.000Z' }, // 00:30 on 11 Mar in Vienna
      { id: 'b', status: 'paid', total: 200, createdAt: '2026-03-11T12:00:00.000Z' }, // 13:00 on 11 Mar
      { id: 'c', status: 'paid', total: 400, createdAt: '2026-03-11T23:30:00.000Z' }, // 00:30 on 12 Mar
      { id: 'd', status: 'paid', total: 800, createdAt: '2026-07-01T22:30:00.000Z' }, // 00:30 on 2 Jul (CEST)
      { id: 'e', status: 'paid', total: 1600, createdAt: '2026-07-01T21:30:00.000Z' }, // 23:30 on 1 Jul
    ];
    const march = shop.reports.dailySales(orders, '2026-03-11');
    const july = shop.reports.dailySales(orders, '2026-07-02');
    return march.count === 2 && march.revenue === 300 && july.count === 1 && july.revenue === 800;
  },

  // toCsv round-trips quotes, commas and line breaks.
  async B09() {
    const shop = newShop();
    const rows = [
      { a: 'He said "hi"', b: 'x,y', c: 'line1\nline2' },
      { a: 'plain', b: '"', c: 42 },
    ];
    const parsed = parseCsv(shop.reports.toCsv(rows, ['a', 'b', 'c'])).map((row) =>
      row.map((cell) => cell.replace(/\r\n/g, '\n')),
    );
    return sameJson(parsed, [
      ['a', 'b', 'c'],
      ['He said "hi"', 'x,y', 'line1\nline2'],
      ['plain', '"', '42'],
    ]);
  },

  // After a window ends, a fresh window allows max calls and then blocks.
  async B10() {
    const mod = load('ratelimit');
    const factory = mod.createRateLimiter || mod.createRatelimiter;
    const limiter = factory({ windowMs: 150, max: 2 });
    const first = [1, 2, 3].map(() => limiter.hit('ip').allowed);
    await sleep(220);
    const second = [1, 2, 3].map(() => limiter.hit('ip').allowed);
    await sleep(220);
    const third = [1, 2, 3].map(() => limiter.hit('ip').allowed);
    const expected = [true, true, false];
    return sameJson(first, expected) && sameJson(second, expected) && sameJson(third, expected);
  },

  // No upload name can write outside uploads.dir.
  async B11() {
    const root = tempRoot();
    try {
      const dir = path.join(root, 'a', 'b', 'uploads');
      const shop = newShop({ uploads: { dir } });
      const names = [
        '../../esc1.txt',
        '....//....//esc2.txt',
        '..\\..\\esc3.txt',
        '..%2f../esc4.txt',
        'sub/../../../esc5.txt',
        `${root}${path.sep}esc6.txt`,
      ];
      for (const name of names) {
        try {
          await shop.uploads.save(name, Buffer.from('x'));
        } catch {
          // Rejecting is an acceptable answer.
        }
      }
      const inside = path.resolve(dir) + path.sep;
      const outside = listFiles(root).filter((file) => !path.resolve(file).startsWith(inside));
      // A plain name must still work.
      const ok = await succeeded(() => shop.uploads.save('fine.txt', Buffer.from('x')));
      return outside.length === 0 && ok;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },

  // An expired session is rejected even after it was cached by a prior call.
  async B12() {
    const shop = newShop({ sessionTtlMs: 80 });
    shop.auth.register({ email: 'judge@example.com', password: 'long enough', name: 'Judge' });
    const { token } = shop.auth.login('judge@example.com', 'long enough');
    const live = shop.auth.authenticate(token);
    shop.auth.authenticate(token);
    await sleep(160);
    const later = shop.auth.authenticate(token);
    return Boolean(live) && !later;
  },

  // Query builder values cannot alter the query.
  async B13() {
    const shop = newShop();
    shop.catalog.createProduct({ name: 'One', price: 100, stock: 1, category: 'books' });
    shop.catalog.createProduct({ name: 'Two', price: 200, stock: 1, category: 'toys' });
    shop.catalog.createProduct({ name: 'Three', price: 300, stock: 1, category: 'games' });
    const payloads = ["nothing' OR '1'='1", "x' OR category != 'y", "books' OR price > '0"];
    for (const payload of payloads) {
      for (const run of [() => shop.db.from('products').where('category', payload).all(), () => shop.catalog.findByCategory(payload)]) {
        let rows;
        try {
          rows = run();
        } catch {
          continue; // rejecting the value is acceptable
        }
        if (!Array.isArray(rows) || rows.length !== 0) return false;
      }
    }
    // Normal queries still work.
    return shop.db.from('products').where('category', 'books').all().length === 1 && shop.catalog.findByCategory('toys').length === 1;
  },

  // Concurrent reservations never oversell.
  async B14() {
    const shop = newShop();
    const product = shop.catalog.createProduct({ name: 'Rare', price: 1000, stock: 3 });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => shop.inventory.reserve(product.id, 1)));
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value !== false).length;
    const available = shop.inventory.getAvailable(product.id);

    const shop2 = newShop();
    const p2 = shop2.catalog.createProduct({ name: 'Rare', price: 1000, stock: 1 });
    const carts = Array.from({ length: 3 }, () => shop2.cart.createCart().add(p2.id, 1));
    const orders = await Promise.allSettled(carts.map((cart) => placeOrder(shop2, cart)));
    const placed = orders.filter((r) => r.status === 'fulfilled').length;

    return ok === 3 && available === 0 && placed === 1 && shop2.inventory.getAvailable(p2.id) === 0;
  },

  // Exact integer-cent money across cart, orders and reports.
  async B15() {
    const shop = newShop();
    const half = shop.catalog.createProduct({ name: 'Half', price: 205, stock: 5, discountPercent: 50 });
    const cart = shop.cart.createCart().add(half.id, 1);
    if (cart.lines()[0].lineTotal !== 103 || cart.subtotal() !== 103) return false;

    const mixed = shop.cart.createCart().add(half.id, 1);
    const plain = shop.catalog.createProduct({ name: 'Plain', price: 1999, stock: 5 });
    mixed.add(plain.id, 3);
    if (mixed.subtotal() !== 103 + 5997) return false;

    const net = shop.catalog.createProduct({ name: 'Net', price: 145, stock: 5 });
    const order = await placeOrder(shop, shop.cart.createCart().add(net.id, 1));
    if (order.subtotal !== 145 || order.tax !== 15 || order.total !== 160) return false;

    const summary = shop.reports.salesSummary([
      { id: 'x', status: 'paid', total: 1000, createdAt: '2026-05-01T10:00:00Z' },
      { id: 'y', status: 'paid', total: 1001, createdAt: '2026-05-01T11:00:00Z' },
    ]);
    return summary.revenue === 2001 && summary.average === 1001 && summary.count === 2;
  },

  // Price updates are visible at once in search results and carts.
  async B16() {
    const shop = newShop();
    const lamp = shop.catalog.createProduct({ name: 'Reading Lamp', price: 1000, stock: 5 });
    const cart = shop.cart.createCart().add(lamp.id, 2);
    const before = shop.search.find('lamp').items[0].price === 1000 && cart.subtotal() === 2000;
    shop.catalog.updateProduct(lamp.id, { price: 1500 });
    const searched = shop.search.find('lamp').items[0].price === 1500;
    const carted = cart.subtotal() === 3000 && cart.lines()[0].unitPrice === 1500;
    const fresh = shop.cart.createCart().add(lamp.id, 1).subtotal() === 1500;
    shop.catalog.updateProduct(lamp.id, { name: 'Desk Lamp' });
    const renamed = shop.search.find('desk').total === 1;
    return before && searched && carted && fresh && renamed;
  },
};

// ------------------------------------------------------------- regression

function regression() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: SUITE_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) return false;
  const status = new Map();
  for (const line of (result.stdout || '').split(/\r?\n/)) {
    const match = /^(not ok|ok) \d+ - (.*?)(?: # .*)?$/.exec(line);
    if (match) status.set(match[2], match[1] === 'ok');
  }
  return BASELINE_PASSING.every((name) => status.get(name) === true);
}

// ------------------------------------------------------------------- main

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function main() {
  const out = {};
  // Stray console output from the code under test must not corrupt our line.
  const originalLog = console.log;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  for (const [id, check] of Object.entries(checks)) {
    try {
      out[id] = (await withTimeout(Promise.resolve().then(check), CHECK_TIMEOUT_MS)) === true;
    } catch {
      out[id] = false;
    }
  }
  out.regression = regression();
  console.log = originalLog;
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

process.on('unhandledRejection', () => {});
main();
