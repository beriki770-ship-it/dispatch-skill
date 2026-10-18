'use strict';

const { ValidationError } = require('../util/errors');
const { paginate } = require('../util/paginate');
const { tokenize } = require('./tokenize');
const { SearchIndex } = require('./index-cache');

// Scoring per query word: a word in the name counts 3, a name word that
// starts with it counts 2, a match in description or category counts 1.
// A product must match at least one query word to be returned. An empty
// query returns the whole catalogue with score 0.
function score(document, queryTokens) {
  let total = 0;
  for (const word of queryTokens) {
    if (document.nameTokens.includes(word)) total += 3;
    else if (document.nameTokens.some((token) => token.startsWith(word))) total += 2;
    else if (document.textTokens.includes(word)) total += 1;
  }
  return total;
}

const SORTS = {
  relevance: (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  price: (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

function createSearch({ store, config }) {
  const index = new SearchIndex(store);

  function find(query = '', { page = 1, pageSize = config.pageSize, sort = 'relevance', category } = {}) {
    if (!SORTS[sort]) throw new ValidationError(`Unknown sort "${sort}"`, { field: 'sort' });
    const queryTokens = tokenize(query);
    const wanted = category === undefined ? null : String(category).toLowerCase();

    const results = [];
    for (const document of index.documents()) {
      const { product } = document;
      if (wanted !== null && product.category !== wanted) continue;
      const value = queryTokens.length === 0 ? 0 : score(document, queryTokens);
      if (queryTokens.length > 0 && value === 0) continue;
      results.push({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        discountPercent: product.discountPercent,
        createdAt: product.createdAt,
        score: value,
      });
    }

    results.sort(SORTS[sort]);
    return paginate(results, { page, pageSize, maxPageSize: config.maxPageSize });
  }

  return { find, index };
}

module.exports = { createSearch, score, tokenize };
