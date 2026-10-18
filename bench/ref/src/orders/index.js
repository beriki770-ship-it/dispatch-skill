'use strict';

const { NotFoundError, ValidationError } = require('../util/errors');
const { assertString, assertPlainObject, assertEmail } = require('../util/validate');
const { paginate } = require('../util/paginate');
const { taxFor } = require('../pricing');
const { assertTransition } = require('./status');

const ORDERS = 'orders';
const ADDRESS_FIELDS = ['name', 'street', 'postalCode', 'city', 'country'];

function normalizeAddress(input) {
  assertPlainObject(input, 'shippingAddress');
  const address = {};
  for (const field of ADDRESS_FIELDS) {
    address[field] = assertString(input[field], `shippingAddress.${field}`, { max: 200 });
  }
  if (!/^[A-Z]{2}$/.test(address.country)) {
    throw new ValidationError('shippingAddress.country must be a two-letter ISO code', {
      field: 'shippingAddress.country',
    });
  }
  return address;
}

function createOrderService({ store, ids, clock, config, inventory, payments, mail, i18n }) {
  let sequence = 0;

  function requireOrder(id) {
    const order = store.get(ORDERS, id);
    if (!order) throw new NotFoundError('order', id);
    return order;
  }

  function transition(order, status, extra = {}) {
    assertTransition(order.status, status);
    const now = new Date(clock.now()).toISOString();
    return store.update(ORDERS, order.id, {
      ...extra,
      status,
      history: [...order.history, { status, at: now }],
    });
  }

  // Places an order from a cart: reserves stock for every line, then stores
  // the order as "pending". If any line cannot be reserved, the lines
  // already reserved are released again and the error is rethrown.
  async function create({ userId, cart, shippingAddress, email, language }) {
    assertString(userId, 'userId');
    const address = normalizeAddress(shippingAddress);
    const recipient = email === undefined ? null : assertEmail(email);
    const lang = i18n.resolveLanguage(language || config.defaultLanguage);

    const lines = cart.lines();
    if (lines.length === 0) throw new ValidationError(i18n.t(lang, 'errors.emptyCart'));

    const id = ids('ord');
    const reserved = [];
    try {
      for (const line of lines) {
        await inventory.reserve(line.productId, line.quantity, { reference: id });
        reserved.push(line);
      }
    } catch (error) {
      for (const line of reserved) {
        await inventory.release(line.productId, line.quantity, { reference: id });
      }
      throw error;
    }

    const subtotal = cart.subtotal();
    const tax = taxFor(subtotal, config.vatRate);
    const total = subtotal + tax;
    const createdAt = new Date(clock.now()).toISOString();

    sequence += 1;
    return store.insert(ORDERS, {
      id,
      seq: sequence,
      userId,
      email: recipient,
      language: lang,
      status: 'pending',
      lines,
      subtotal,
      tax,
      total,
      currency: config.currency,
      shippingAddress: address,
      paymentId: null,
      createdAt,
      history: [{ status: 'pending', at: createdAt }],
    });
  }

  function get(id) {
    return store.get(ORDERS, id);
  }

  // Newest first. Orders placed within the same millisecond keep the order
  // in which they were created.
  function list({ userId, status, page = 1, pageSize = config.pageSize } = {}) {
    const rows = store
      .all(ORDERS)
      .filter((order) => (userId === undefined || order.userId === userId) && (status === undefined || order.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.seq - a.seq);
    return paginate(rows, { page, pageSize, maxPageSize: config.maxPageSize });
  }

  // Charges the order total. On success stock moves from reserved to sold
  // and the confirmation mail is queued. A declined payment leaves the
  // order pending so the customer can try another card.
  async function pay(id, source) {
    const order = requireOrder(id);
    assertTransition(order.status, 'paid');
    const charge = await payments.charge({
      amount: order.total,
      currency: order.currency,
      source,
      idempotencyKey: `order:${order.id}`,
    });
    for (const line of order.lines) {
      await inventory.commit(line.productId, line.quantity, { reference: order.id });
    }
    const paid = transition(order, 'paid', { paymentId: charge.id });
    await mail.sendOrderConfirmation(paid);
    return paid;
  }

  // Pending orders give their reservation back; paid orders are refunded
  // and their stock returned to the shelf.
  async function cancel(id) {
    const order = requireOrder(id);
    if (order.status === 'pending') {
      for (const line of order.lines) {
        await inventory.release(line.productId, line.quantity, { reference: order.id });
      }
      return transition(order, 'cancelled');
    }
    assertTransition(order.status, 'refunded');
    await payments.refund(order.paymentId);
    for (const line of order.lines) {
      await inventory.restock(line.productId, line.quantity, { reference: order.id });
    }
    return transition(order, 'refunded');
  }

  async function markShipped(id) {
    const shipped = transition(requireOrder(id), 'shipped');
    await mail.sendShippingNotice(shipped);
    return shipped;
  }

  function markDelivered(id) {
    return transition(requireOrder(id), 'delivered');
  }

  return { create, get, list, pay, cancel, markShipped, markDelivered };
}

module.exports = { createOrderService, normalizeAddress, ...require('./status') };
