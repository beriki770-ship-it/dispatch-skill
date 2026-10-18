'use strict';

const templates = require('./templates');
const { createOutbox } = require('./outbox');
const { render } = require('./template');

function createMailer({ i18n, config, ids, clock }) {
  const outbox = createOutbox({ ids, clock });
  const money = { currency: config.currency, locale: config.locale };

  function options(language) {
    return { t: i18n.t, language: i18n.resolveLanguage(language || config.defaultLanguage), money };
  }

  const renderOrderConfirmation = (order, language) => templates.orderConfirmation(order, options(language));
  const renderShippingNotice = (order, language) => templates.shippingNotice(order, options(language));

  async function deliver(order, rendered) {
    if (!order.email) return null;
    return outbox.send({ from: config.mail.from, to: order.email, ...rendered });
  }

  return {
    renderOrderConfirmation,
    renderShippingNotice,
    sendOrderConfirmation: (order) => deliver(order, renderOrderConfirmation(order, order.language)),
    sendShippingNotice: (order) => deliver(order, renderShippingNotice(order, order.language)),
    outbox,
  };
}

module.exports = { createMailer, render };
