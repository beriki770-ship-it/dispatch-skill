'use strict';

// Shared page slicing for search results and order lists. Pages are
// 1-based, and the page size is clamped so a client cannot ask for the
// whole table in one request.
function paginate(items, { page = 1, pageSize = 20, maxPageSize = 100 } = {}) {
  const size = Math.min(Math.max(1, Math.trunc(pageSize) || 1), maxPageSize);
  const current = Math.max(1, Math.trunc(page) || 1);
  const total = items.length;
  const totalPages = Math.ceil(total / size);
  const start = (current - 1) * size;

  return {
    items: items.slice(start, start + size),
    page: current,
    pageSize: size,
    total,
    totalPages,
    hasNext: current < totalPages,
  };
}

module.exports = { paginate };
