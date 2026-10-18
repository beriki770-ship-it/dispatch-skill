'use strict';

// Words too common to help ranking, in the two shop languages.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'of', 'the', 'for', 'to', 'in', 'on', 'with',
  'der', 'die', 'das', 'und', 'ein', 'eine', 'für', 'mit', 'von', 'im',
]);

// Lower-case, strip accents ("Schäfer" matches "schafer"), split on anything
// that is not a letter or digit, drop stop words and single characters.
function tokenize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

module.exports = { tokenize, STOP_WORDS };
