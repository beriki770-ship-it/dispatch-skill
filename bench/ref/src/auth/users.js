'use strict';

const { ValidationError } = require('../util/errors');
const { assertEmail, assertString } = require('../util/validate');
const { hashPassword, MIN_LENGTH } = require('./passwords');

const COLLECTION = 'users';

// Strips secrets before a user record leaves the auth module.
function publicUser(row) {
  if (!row) return null;
  const { passwordHash, ...rest } = row;
  return rest;
}

function createUserService({ store, ids, clock }) {
  function findRowByEmail(email) {
    const normalized = String(email).trim().toLowerCase();
    return store.all(COLLECTION).find((row) => row.email === normalized) || null;
  }

  function register({ email, password, name }) {
    const normalizedEmail = assertEmail(email);
    const displayName = assertString(name, 'name', { max: 200 });
    if (typeof password !== 'string' || password.length < MIN_LENGTH) {
      throw new ValidationError(`password must have at least ${MIN_LENGTH} characters`, { field: 'password' });
    }
    if (findRowByEmail(normalizedEmail)) {
      throw new ValidationError('An account with this email already exists', { field: 'email' });
    }
    const row = store.insert(COLLECTION, {
      id: ids('usr'),
      email: normalizedEmail,
      name: displayName,
      passwordHash: hashPassword(password),
      createdAt: new Date(clock.now()).toISOString(),
    });
    return publicUser(row);
  }

  function get(id) {
    return publicUser(store.get(COLLECTION, id));
  }

  return { register, get, findRowByEmail };
}

module.exports = { createUserService, publicUser };
