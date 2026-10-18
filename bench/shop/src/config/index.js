'use strict';

const defaults = require('./defaults');
const { readEnv } = require('./env');
const { ValidationError } = require('../util/errors');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Recursive merge: nested objects merge key by key, everything else
// (including arrays) is replaced wholesale by the later layer.
function merge(base, layer) {
  const out = { ...base };
  for (const [key, value] of Object.entries(layer || {})) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

function deepFreeze(object) {
  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(object);
}

function validate(config) {
  const problems = [];
  if (!/^[A-Z]{3}$/.test(config.currency)) problems.push('currency must be an ISO 4217 code');
  if (!Number.isInteger(config.vatRate) || config.vatRate < 0 || config.vatRate > 100) {
    problems.push('vatRate must be a whole percentage');
  }
  if (!Number.isInteger(config.sessionTtlMs) || config.sessionTtlMs <= 0) {
    problems.push('sessionTtlMs must be a positive integer');
  }
  if (!Number.isInteger(config.pageSize) || config.pageSize <= 0) problems.push('pageSize must be positive');
  if (config.pageSize > config.maxPageSize) problems.push('pageSize may not exceed maxPageSize');
  if (!Number.isInteger(config.uploads.maxBytes) || config.uploads.maxBytes <= 0) {
    problems.push('uploads.maxBytes must be a positive integer');
  }
  if (!Number.isInteger(config.rateLimit.max) || config.rateLimit.max <= 0) {
    problems.push('rateLimit.max must be a positive integer');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: config.timeZone });
  } catch {
    problems.push(`unknown timeZone "${config.timeZone}"`);
  }
  if (problems.length > 0) {
    throw new ValidationError(`Invalid configuration: ${problems.join('; ')}`, { problems });
  }
}

// defaults <- environment <- explicit overrides. The result is frozen so a
// module cannot change a setting another module relies on.
function loadConfig(overrides = {}, env = process.env) {
  const config = merge(merge(defaults, readEnv(env)), overrides);
  validate(config);
  return deepFreeze(config);
}

module.exports = { loadConfig, merge };
