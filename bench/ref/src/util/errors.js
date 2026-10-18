'use strict';

// Error types shared by every module. Each one carries a stable `code` so a
// caller (HTTP layer, CLI, tests) can branch on it without matching message
// text, which is translated and may change.

class ShopError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

class ValidationError extends ShopError {
  constructor(message, details) {
    super(message, 'VALIDATION', details);
  }
}

class NotFoundError extends ShopError {
  constructor(what, id) {
    super(`${what} not found: ${id}`, 'NOT_FOUND', { what, id });
  }
}

class OutOfStockError extends ShopError {
  constructor(message, details) {
    super(message, 'OUT_OF_STOCK', details);
  }
}

class AuthError extends ShopError {
  constructor(message) {
    super(message, 'AUTH');
  }
}

class PaymentError extends ShopError {
  constructor(message, details) {
    super(message, 'PAYMENT', details);
  }
}

class UploadError extends ShopError {
  constructor(message, details) {
    super(message, 'UPLOAD', details);
  }
}

class StateError extends ShopError {
  constructor(message, details) {
    super(message, 'INVALID_STATE', details);
  }
}

module.exports = {
  ShopError,
  ValidationError,
  NotFoundError,
  OutOfStockError,
  AuthError,
  PaymentError,
  UploadError,
  StateError,
};
