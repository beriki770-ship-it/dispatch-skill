'use strict';

const crypto = require('node:crypto');

// Ids are "<prefix>_<counter><random>": the counter keeps them sortable by
// creation within one process, the random tail keeps two processes apart.
function createIdGenerator() {
  let counter = 0;
  return function nextId(prefix) {
    counter += 1;
    const tail = crypto.randomBytes(3).toString('hex');
    return `${prefix}_${counter.toString(36).padStart(4, '0')}${tail}`;
  };
}

// Opaque, URL-safe secret for session tokens.
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { createIdGenerator, randomToken };
