# shop

Backend library for a small online bookshop: accounts, catalogue, carts,
stock, orders, mock payments, uploads, search, translated e-mails, CSV
reports, rate limiting and housekeeping jobs.

Plain Node.js (24+), CommonJS, no dependencies. Everything is in memory
apart from uploaded files, which go to disk.

```sh
npm test        # node --test
```

## Getting started

```js
const { createShop } = require('./src');

const shop = createShop({ uploads: { dir: './data/uploads' } });
const book = shop.catalog.createProduct({ name: 'The Hobbit', price: 1490, stock: 12, category: 'books' });

const cart = shop.cart.createCart();
cart.add(book.id, 2);

const order = await shop.orders.create({
  userId: 'usr_1',
  email: 'reader@example.com',
  cart,
  shippingAddress: { name: 'Ann Reader', street: 'Hauptstraße 1', postalCode: '1010', city: 'Wien', country: 'AT' },
});
await shop.orders.pay(order.id, 'tok_visa');
```

`createShop(options)` builds one independent shop instance. `options` is a
partial configuration (see below); `options.clock` replaces the system clock
(`{ now() }`, milliseconds). Each folder under `src/` is a module with an
`index.js`; `src/index.js` wires them together.

## Configuration

Defaults live in `src/config/defaults.js`. Environment variables
(`SHOP_*`, see `src/config/env.js`) override the defaults, and the options
passed to `createShop()` override both. Nested objects merge key by key.

| Setting | Default | Meaning |
| --- | --- | --- |
| `currency` | `EUR` | ISO currency code |
| `locale` | `de-AT` | Locale for formatted amounts |
| `timeZone` | `Europe/Vienna` | Time zone of the shop; defines the business day |
| `defaultLanguage` | `en` | Language when none is given (`en` or `de`) |
| `vatRate` | `10` | VAT in whole percent (reduced rate for books) |
| `sessionTtlMs` | 1 hour | Session lifetime from login |
| `pageSize` / `maxPageSize` | 20 / 100 | Default and largest page size |
| `uploads.dir` | `./data/uploads` | Where uploaded files are stored |
| `uploads.maxBytes` | 5 MB | Largest accepted upload |
| `uploads.allowedExtensions` | jpg, jpeg, png, webp, pdf, txt | Accepted file types |
| `rateLimit.windowMs` / `rateLimit.max` | 60 s / 60 | Default limiter settings |

## Money

All amounts in the public API are integer cents (`1490` is EUR 14.90),
in and out, and must stay exact end to end — a total never drifts by a cent.

* Line total = unit price × quantity − product discount
  (`discountPercent`, whole percent), rounded half up to the cent once per
  line.
* Order subtotal = sum of line totals (no further rounding).
* Order tax = subtotal × `vatRate` / 100, rounded half up to the cent once
  per order. Order total = subtotal + tax.
* Report averages are rounded half up to the cent.

Example: a line of 1 × 2.05 at 50 % off is 1.025, so 1.03 (103 cents).
VAT at 10 % on 1.45 is 0.145, so 0.15 (15 cents).

## Modules

### auth

* `auth.register({ email, password, name })` → user (no password hash).
  Emails are case-insensitive and unique; passwords need 8+ characters.
* `auth.login(email, password)` → `{ token, expiresAt }`. Throws `AuthError`
  with the same message for unknown email and incorrect password.
* `auth.authenticate(token)` → the user, or `null` when the token is unknown,
  logged out or expired. A session expires `sessionTtlMs` after login,
  no matter how often it is used.
* `auth.logout(token)`, `auth.purgeExpired()`.

### catalog

* `catalog.createProduct({ name, price, stock, category, description, discountPercent, createdAt })`.
  `price` in cents; `category` is stored lower-case; `createdAt` (ISO) is
  optional and defaults to now — used when importing a catalogue.
* `catalog.getProduct(id)` (or `null`), `catalog.updateProduct(id, patch)`
  (name, description, category, price, discountPercent),
  `catalog.removeProduct(id)`, `catalog.listProducts()`.
* `catalog.findByCategory(category)` → products in that category, by name.

A price change takes effect immediately everywhere: search results and
existing carts show the new price on their next read.

### db

`db.store` is the in-memory document store (`insert`, `get`, `update`,
`remove`, `all`, `increment`; emits `change` events). `db.from(collection)`
is a query builder:

```js
shop.db.from('products').where('category', 'books').where('price', '<', 2000)
  .orderBy('price', 'desc').limit(10).all();
```

`where(field, value)` is equality; `where(field, op, value)` supports
`= != < <= > >= LIKE` (`%` wildcard, case-insensitive). `orWhere` adds an OR
branch. Values are always treated as data: whatever a value contains, it
can only ever be compared, never change the query.

### cart

`cart.createCart()` → cart with `add(productId, qty)`,
`setQuantity(productId, qty)` (0 removes), `remove`, `clear`, `lines()`,
`subtotal()` (cents), `itemCount()`, `isEmpty()`. At most 99 of one product.
Lines use the current catalogue price.

### inventory

Per product: `available`, `reserved`, `sold`.

* `inventory.reserve(productId, qty)` (async) moves stock from available to
  reserved, or throws `OutOfStockError` when not enough is available.
  Available stock never goes below zero, also when many reservations run
  at the same time.
* `release`, `commit`, `restock` (async), `getAvailable(productId)`,
  `getLevels(productId)`.

### orders

* `orders.create({ userId, cart, shippingAddress, email, language })` (async)
  reserves stock for every line (all or nothing) and stores a `pending`
  order: `{ id, userId, email, language, status, lines, subtotal, tax, total,
  currency, shippingAddress, createdAt, history }`. `shippingAddress` needs
  `name, street, postalCode, city, country` (two-letter code) and is returned
  exactly as stored.
* `orders.get(id)`, `orders.list({ userId, status, page, pageSize })` —
  newest first, paginated.
* `orders.pay(id, source)` (async) charges the total; on success the order is
  `paid` and the confirmation mail is queued. Declined payments leave it
  `pending`.
* `orders.cancel(id)` — pending: release stock; paid: refund and restock.
* `orders.markShipped(id)` (queues the shipping mail), `orders.markDelivered(id)`.

Status flow: `pending → paid → shipped → delivered`, `pending → cancelled`,
`paid → refunded`.

### payments (mock)

`payments.charge({ amount, currency, source, idempotencyKey })`,
`payments.refund(chargeId, amount?)`, `payments.getCharge(id)`. Sources:
`tok_visa` succeeds, `tok_declined` and `tok_insufficient` fail with
`PaymentError`. Repeating an idempotency key returns the first charge.

### uploads

`uploads.save(filename, buffer)` (async) → `{ name, path, size, sha256 }`.
Files up to `uploads.maxBytes` (5 MB) with an allowed extension are
accepted. The client's file name is untrusted: a file is always written
inside `uploads.dir`; a name that tries to leave it (`../`, `..\`, absolute
paths) is rejected or reduced to its base name. Taken names get a `-1`,
`-2`… suffix. Also `read(name)`, `remove(name)`, `list()`.

### search

`search.find(query, { page, pageSize, sort, category })` →
`{ items, page, pageSize, total, totalPages, hasNext }`.

* Matching ignores case and accents. An empty query returns everything.
* `sort`: `relevance` (default, best match first), `price` (cheapest first),
  `newest` (most recent `createdAt` first).
* Items: `{ id, name, category, price, discountPercent, createdAt, score }`,
  always with the product's current price.

### Pagination (search and order lists)

Pages are 1-based. `totalPages` is the number of pages that contain at
least one item (`ceil(total / pageSize)`, so 0 for no results); `hasNext`
is true when a further page exists.

### i18n

`i18n.t(language, key, params)` with `{name}` placeholders; falls back to
the default language, then to the key. Languages: `en`, `de`.

| Key | English |
| --- | --- |
| `errors.outOfStock` | `Not enough stock for {name}` |
| `errors.invalidCredentials` | `Invalid email or password` |
| `errors.emptyCart` | `Your cart is empty` |
| `mail.orderConfirmed.subject` | `Order {id} confirmed` |
| `mail.orderShipped.subject` | `Order {id} has shipped` |

### mail

`mail.renderOrderConfirmation(order, language)` and
`mail.renderShippingNotice(order, language)` → `{ subject, text }`. The
confirmation subject is `mail.orderConfirmed.subject`
("Order {id} confirmed" / "Bestellung {id} bestätigt"), the shipping notice
uses `mail.orderShipped.subject`. Sent mail lands in `mail.outbox`.

### reports

* `reports.toCsv(rows, columns)` — RFC 4180 CSV. Cells containing a comma, a
  double quote or a line break are quoted, and quotes inside are doubled, so
  any spreadsheet reads back exactly the original values.
* `reports.ordersCsv(orders)` — one row per order, amounts as `12.34`.
* `reports.salesSummary(orders)` → `{ count, revenue, average }` in cents,
  counting orders that are paid, shipped or delivered.
* `reports.dailySales(orders, 'YYYY-MM-DD')` → `{ date, count, revenue }` for
  revenue orders placed on that calendar day in the shop's time zone
  (`timeZone`, Europe/Vienna) — an order at 00:30 Vienna time belongs to that
  Vienna date, whatever the UTC date is.

### ratelimit

`require('./src/ratelimit').createRateLimiter({ windowMs, max, clock })` →
`{ hit(key), reset(key), prune(), size() }`. `hit` returns
`{ allowed, remaining, resetAt }`. Fixed windows: each key gets `max` calls
per window; the window starts at the key's first call, and once it is over
the next call starts a fresh window with a fresh allowance of `max`.
The shop instance has one at `shop.limiter`.

### scheduler

`scheduler.every(name, intervalMs, fn)`, `cancel(name)`, `runDue()`,
`start(tickMs)`, `stop()`, `list()`. The shop registers session purging and
limiter pruning every 10 minutes; nothing runs until `start()` is called.
