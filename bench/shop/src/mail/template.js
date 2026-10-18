'use strict';

// Minimal text templating for e-mails.
//
//   {{ path.to.value }}            value from the context ('' if missing)
//   {{#each list}} ... {{/each}}   repeat; inside, {{ . }} is the item and
//                                  {{ name }} looks up the item first
//   {{#if value}} ... {{/if}}      include when truthy
//
// Blocks may nest. Output is plain text, so nothing is HTML-escaped.

function lookup(scopes, path) {
  if (path === '.') return scopes[0];
  const keys = path.split('.');
  for (const scope of scopes) {
    if (scope !== null && typeof scope === 'object' && keys[0] in scope) {
      return keys.reduce((value, key) => (value == null ? undefined : value[key]), scope);
    }
  }
  return undefined;
}

// Finds the {{/tag}} that closes the block opened just before `from`,
// skipping over nested blocks of the same kind.
function findClose(template, tag, from) {
  const open = new RegExp(`\\{\\{#${tag}\\s`, 'g');
  const close = new RegExp(`\\{\\{/${tag}\\}\\}`, 'g');
  let depth = 1;
  let pos = from;
  for (;;) {
    open.lastIndex = pos;
    close.lastIndex = pos;
    const nextOpen = open.exec(template);
    const nextClose = close.exec(template);
    if (!nextClose) throw new Error(`Unclosed {{#${tag}}} block`);
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      pos = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return { start: nextClose.index, end: nextClose.index + nextClose[0].length };
    pos = nextClose.index + nextClose[0].length;
  }
}

function renderWith(template, scopes) {
  let out = '';
  let pos = 0;
  const tagPattern = /\{\{\s*(#each|#if)?\s*([\w.]+|\.)\s*\}\}/g;

  for (;;) {
    tagPattern.lastIndex = pos;
    const match = tagPattern.exec(template);
    if (!match) break;
    out += template.slice(pos, match.index);
    const [whole, block, path] = match;
    const bodyStart = match.index + whole.length;

    if (!block) {
      const value = lookup(scopes, path);
      out += value == null ? '' : String(value);
      pos = bodyStart;
      continue;
    }

    const tag = block.slice(1);
    const close = findClose(template, tag, bodyStart);
    const body = template.slice(bodyStart, close.start);
    const value = lookup(scopes, path);

    if (tag === 'each') {
      for (const item of Array.isArray(value) ? value : []) out += renderWith(body, [item, ...scopes]);
    } else if (value) {
      out += renderWith(body, scopes);
    }
    pos = close.end;
  }

  return out + template.slice(pos);
}

function render(template, context = {}) {
  return renderWith(template, [context]);
}

module.exports = { render };
