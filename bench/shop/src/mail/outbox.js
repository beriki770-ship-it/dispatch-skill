'use strict';

// Collects outgoing mail in memory. Delivery is done by a separate worker
// that drains the outbox; here it is also what tests inspect.
function createOutbox({ ids, clock }) {
  const messages = [];

  async function send({ from, to, subject, text }) {
    if (!to) throw new Error('Mail needs a recipient');
    const message = {
      id: ids('msg'),
      from,
      to,
      subject,
      text,
      queuedAt: new Date(clock.now()).toISOString(),
    };
    messages.push(message);
    return message.id;
  }

  return {
    send,
    list: () => messages.map((message) => ({ ...message })),
    clear: () => {
      messages.length = 0;
    },
  };
}

module.exports = { createOutbox };
