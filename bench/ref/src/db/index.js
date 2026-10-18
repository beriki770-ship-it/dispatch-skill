'use strict';

const { Store } = require('./store');
const { QueryBuilder } = require('./query');

function createDb() {
  const store = new Store();
  return {
    store,
    from: (collection) => new QueryBuilder(store, collection),
  };
}

module.exports = { createDb, Store, QueryBuilder };
