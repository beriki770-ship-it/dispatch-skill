'use strict';

const crypto = require('node:crypto');

// Password hashes are stored as "scrypt$<salt hex>$<hash hex>". The scheme
// name leaves room for a future algorithm without a migration flag day.

const KEY_LENGTH = 32;
const MIN_LENGTH = 8;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  // Constant-time comparison so response timing reveals nothing about the hash.
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword, MIN_LENGTH };
