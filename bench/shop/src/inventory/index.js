'use strict';

const { createInventory } = require('./stock');
const { AuditLog } = require('./audit');

module.exports = { createInventory, AuditLog };
