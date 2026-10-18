'use strict';

// CSV writer for exports opened in Excel and LibreOffice.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(',')) return `"${text}"`;
  return text;
}

// `columns` is a list of keys or of { key, header, format } objects.
// The header row uses `header` when given, otherwise the key.
function toCsv(rows, columns) {
  const specs = columns.map((column) => (typeof column === 'string' ? { key: column } : column));
  const header = specs.map((spec) => escapeCell(spec.header ?? spec.key)).join(',');
  const body = rows.map((row) =>
    specs
      .map((spec) => {
        const raw = row[spec.key];
        return escapeCell(spec.format ? spec.format(raw, row) : raw);
      })
      .join(','),
  );
  return [header, ...body].join('\n') + '\n';
}

module.exports = { toCsv, escapeCell };
