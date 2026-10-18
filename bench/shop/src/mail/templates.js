'use strict';

const { render } = require('./template');
const { formatMoney } = require('../pricing');

const ORDER_BODY = `{{ greeting }}

{{ intro }}

{{#each lines}}{{ quantity }} x {{ name }}  {{ amount }}
{{/each}}
{{ labels.subtotal }}: {{ subtotal }}
{{ labels.tax }}: {{ tax }}
{{ labels.total }}: {{ total }}
{{#if address}}
{{ labels.shippingTo }}:
{{ address.name }}
{{ address.street }}
{{ address.postalCode }} {{ address.city }}
{{ address.country }}
{{/if}}
{{ signature }}
`;

// Builds the template context shared by all order mails.
function orderContext(order, { t, language, money }) {
  const fmt = (cents) => formatMoney(cents, money);
  const address = order.shippingAddress || null;
  return {
    greeting: t(language, 'mail.greeting', { name: address ? address.name : '' }).trim(),
    lines: (order.lines || []).map((line) => ({
      quantity: line.quantity,
      name: line.name,
      amount: fmt(line.lineTotal),
    })),
    subtotal: fmt(order.subtotal || 0),
    tax: fmt(order.tax || 0),
    total: fmt(order.total || 0),
    address,
    labels: {
      subtotal: t(language, 'mail.subtotal'),
      tax: t(language, 'mail.tax'),
      total: t(language, 'mail.total'),
      shippingTo: t(language, 'mail.shippingTo'),
    },
    signature: t(language, 'mail.signature'),
  };
}

function orderConfirmation(order, options) {
  const { t, language } = options;
  const context = orderContext(order, options);
  context.intro = t(language, 'mail.orderConfirmed.intro');
  return {
    subject: t(language, 'mail.orderShipped.subject', { id: order.id }),
    text: render(ORDER_BODY, context),
  };
}

function shippingNotice(order, options) {
  const { t, language } = options;
  const context = orderContext(order, options);
  context.intro = t(language, 'mail.orderShipped.intro');
  return {
    subject: t(language, 'mail.orderShipped.subject', { id: order.id }),
    text: render(ORDER_BODY, context),
  };
}

module.exports = { orderConfirmation, shippingNotice, ORDER_BODY };
