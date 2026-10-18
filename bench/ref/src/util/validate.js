'use strict';

const { ValidationError } = require('./errors');

// Small assertion helpers. They throw ValidationError with the field name so
// the message tells the caller exactly which input was rejected.

function assertString(value, name, { min = 1, max = 10_000 } = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`, { field: name });
  }
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max} characters`, { field: name });
  }
  return value.trim();
}

function assertPositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${name} must be a positive integer`, { field: name, value });
  }
  return value;
}

function assertNonNegativeInt(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${name} must be a non-negative integer`, { field: name, value });
  }
  return value;
}

// Percentages are whole numbers from 0 to 100 everywhere in the shop.
function assertPercent(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ValidationError(`${name} must be a whole percentage between 0 and 100`, { field: name, value });
  }
  return value;
}

// Deliberately loose: one "@", something on both sides, a dot in the domain.
// Real verification happens by sending mail, not by regex.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertEmail(value, name = 'email') {
  const email = assertString(value, name, { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError(`${name} is not a valid email address`, { field: name });
  }
  return email;
}

function assertPlainObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`, { field: name });
  }
  return value;
}

module.exports = {
  assertString,
  assertPositiveInt,
  assertNonNegativeInt,
  assertPercent,
  assertEmail,
  assertPlainObject,
};
