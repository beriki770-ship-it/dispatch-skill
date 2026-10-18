'use strict';

const { AuthError } = require('../util/errors');
const { verifyPassword } = require('./passwords');
const { createUserService } = require('./users');
const { createSessionService } = require('./sessions');

function createAuth({ store, ids, clock, ttlMs, i18n, language = 'en' }) {
  const users = createUserService({ store, ids, clock });
  const sessions = createSessionService({ store, clock, ttlMs });

  function invalidCredentials() {
    const message = i18n ? i18n.t(language, 'errors.invalidCredentials') : 'Invalid email or password';
    return new AuthError(message);
  }

  return {
    register: (input) => users.register(input),

    // Returns { token, expiresAt }. The same error is used for an unknown
    // email and an incorrect password so the response does not reveal which
    // accounts exist.
    login(email, password) {
      const row = users.findRowByEmail(email || '');
      if (!row || !verifyPassword(String(password), row.passwordHash)) throw invalidCredentials();
      return sessions.create(row.id);
    },

    // Returns the public user for a valid token, otherwise null.
    authenticate(token) {
      const userId = sessions.validate(token);
      return userId ? users.get(userId) : null;
    },

    logout: (token) => sessions.revoke(token),
    purgeExpired: () => sessions.purgeExpired(),
    getUser: (id) => users.get(id),
  };
}

module.exports = { createAuth };
