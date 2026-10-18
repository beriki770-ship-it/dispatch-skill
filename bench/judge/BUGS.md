# Seeded bugs (hidden — never copy into shop/)

`node judge.js <shop-copy>` checks each bug through the public API in the shop
README. "Visible" = a test in `shop/test` fails on the seeded code because of it.
`ref/` is the reference fix (all 16 true); `diff -r shop ref` shows each fix.

| id | grade | file(s) | bug | judge checks | visible test |
| --- | --- | --- | --- | --- | --- |
| B01 | mechanical | src/orders/index.js | order stored as `shippingAdress` (property typo) | `orders.create()` result and `orders.get()` carry `shippingAddress` equal to the input | yes |
| B02 | mechanical | src/mail/templates.js | confirmation mail uses i18n key `mail.orderShipped.subject` | `renderOrderConfirmation` subject is exactly "Order {id} confirmed" / "Bestellung {id} bestätigt" | no |
| B03 | mechanical | src/i18n/messages/en.js | "Not enought stock" misspelt | `i18n.t('en','errors.outOfStock')` and the thrown OutOfStockError message equal "Not enough stock for Atlas" | yes |
| B04 | mechanical | src/config/defaults.js | `maxBytes: 5 * KB * 102` (~510 KB, not 5 MB) | 1 MB and 4 MB uploads accepted, 6 MB rejected | no |
| B05 | mechanical | src/ratelimit/index.js (+ src/index.js) | exported as `createRatelimiter`, README says `createRateLimiter` | `require(src/ratelimit).createRateLimiter` is a working function | no |
| B06 | standard | src/util/paginate.js | `totalPages = floor(total/size) + 1` (extra page on exact multiples) | search with 20/21/10 items: totalPages 2/3/2, `hasNext` false on last page | yes |
| B07 | standard | src/search/index.js | `sort:'newest'` sorts oldest first | three products with set `createdAt` come back newest first | yes |
| B08 | standard | src/reports/sales.js | `dailySales` buckets by UTC date, not Europe/Vienna | 23:30Z orders land on the next Vienna day, winter (CET) and summer (CEST) | no |
| B09 | standard | src/reports/csv.js | only commas trigger quoting; quotes not doubled, newlines not quoted | `toCsv` output parsed by an RFC 4180 reader returns the original cells (quotes, commas, `\n`) | yes |
| B10 | standard | src/ratelimit/limiter.js | window reset clears count but keeps `windowStart`, so after the first window the limit never applies again | 3 windows of 150 ms with max 2: each gives `[true,true,false]` | yes |
| B11 | hard/security | src/uploads/filenames.js | `replace('../','')` strips only the first `../`; `..\` and nested segments untouched | six traversal names (`../../`, `....//`, `..\..\`, `sub/../../../`, absolute path…) leave no file outside `uploads.dir`; a plain name still saves | yes (`../../` only) |
| B12 | hard/security | src/auth/sessions.js | cache hit returns the user without checking `expiresAt` | token authenticated twice (cached), then after TTL `authenticate` returns null | yes |
| B13 | hard/security | src/db/query.js | string values interpolated into SQL without doubling `'` | three injection payloads via `db.from().where()` and `catalog.findByCategory()` return no rows (or throw); normal queries still work | no |
| B14 | hard/security | src/inventory/stock.js | check-then-`await audit`-then-decrement: concurrent `reserve()` all pass the check, stock goes negative | 6 concurrent reserves on stock 3 → exactly 3 succeed, available 0; 3 concurrent orders on stock 1 → 1 placed | no |
| B15 | design | src/pricing/index.js, src/pricing/tax.js, src/cart/cart.js, src/orders/index.js, src/reports/sales.js | money converted to float euros for maths, so half-cent cases round the wrong way | line 205 @50% = 103; cart 103+5997; order tax on 145 = 15, total 160; summary average of 1000/1001 = 1001 | no |
| B16 | design | src/search/index-cache.js, src/cart/price-cache.js (wired in src/index.js) | search index invalidates on insert/delete only; cart price cache (10 min TTL) never invalidated | after `updateProduct` price 1000→1500: search shows 1500, existing cart subtotal and unitPrice update, rename is searchable | no |

`regression`: runs `node --test --test-reporter=tap` in the copy (180 s timeout)
and requires every one of the 102 tests that passed on the seeded code to still
pass by name. Visible tests: 110 total, 102 pass and 8 fail on seeded shop
(B01, B03, B06, B07, B09, B10, B11, B12).

Notes on fairness:
- Checks use only README-documented API (`createShop`, `catalog`, `cart`, `orders`,
  `search`, `reports`, `mail`, `i18n`, `uploads`, `auth`, `db.from`, `inventory`,
  `src/ratelimit`). B10 accepts either export name so it stays independent of B05.
- B11/B13 accept rejecting or sanitising. B14 accepts a rejected promise or `false`
  for the losing reservations.
- B15 cannot be passed by changing `toMinor` alone; tax and averages need integer maths.
