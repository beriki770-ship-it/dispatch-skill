'use strict';

const { ValidationError } = require('../util/errors');

// Maps SHOP_* environment variables onto config paths. Only the settings an
// operator realistically changes per deployment are exposed here.
const VARIABLES = {
  SHOP_CURRENCY: { path: ['currency'], type: 'string' },
  SHOP_LOCALE: { path: ['locale'], type: 'string' },
  SHOP_TIME_ZONE: { path: ['timeZone'], type: 'string' },
  SHOP_DEFAULT_LANGUAGE: { path: ['defaultLanguage'], type: 'string' },
  SHOP_VAT_RATE: { path: ['vatRate'], type: 'int' },
  SHOP_SESSION_TTL_MS: { path: ['sessionTtlMs'], type: 'int' },
  SHOP_UPLOAD_DIR: { path: ['uploads', 'dir'], type: 'string' },
  SHOP_UPLOAD_MAX_BYTES: { path: ['uploads', 'maxBytes'], type: 'int' },
  SHOP_RATE_LIMIT_WINDOW_MS: { path: ['rateLimit', 'windowMs'], type: 'int' },
  SHOP_RATE_LIMIT_MAX: { path: ['rateLimit', 'max'], type: 'int' },
  SHOP_MAIL_FROM: { path: ['mail', 'from'], type: 'string' },
};

function parseValue(name, raw, type) {
  if (type === 'int') {
    if (!/^\d+$/.test(raw.trim())) {
      throw new ValidationError(`${name} must be a whole number, got "${raw}"`);
    }
    return Number.parseInt(raw, 10);
  }
  return raw.trim();
}

function setPath(target, path, value) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    node[key] = node[key] || {};
    node = node[key];
  }
  node[path[path.length - 1]] = value;
}

// Returns a partial config object containing only the variables that are set.
function readEnv(env = process.env) {
  const result = {};
  for (const [name, spec] of Object.entries(VARIABLES)) {
    const raw = env[name];
    if (raw === undefined || raw === '') continue;
    setPath(result, spec.path, parseValue(name, raw, spec.type));
  }
  return result;
}

module.exports = { readEnv, VARIABLES };
