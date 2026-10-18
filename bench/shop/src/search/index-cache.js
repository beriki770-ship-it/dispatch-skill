'use strict';

const { tokenize } = require('./tokenize');

// Tokenising every product description on every query is the expensive part
// of search, so the tokenised catalogue is built once and kept until the
// catalogue grows or shrinks.
class SearchIndex {
  #documents = null;

  constructor(store) {
    this.store = store;
    store.on('change', (event) => {
      if (event.collection !== 'products') return;
      if (event.type === 'insert' || event.type === 'delete') this.invalidate();
    });
  }

  invalidate() {
    this.#documents = null;
  }

  documents() {
    if (this.#documents === null) {
      this.#documents = this.store.all('products').map((product) => ({
        product,
        nameTokens: tokenize(product.name),
        textTokens: tokenize(`${product.description} ${product.category}`),
      }));
    }
    return this.#documents;
  }
}

module.exports = { SearchIndex };
