'use strict';

const { ShopError } = require('../util/errors');

// A deliberately small SQL dialect, enough for the query builder:
//
//   SELECT * FROM <collection>
//     [WHERE <cond> [AND|OR <cond>]...]
//     [ORDER BY <field> [ASC|DESC]]
//     [LIMIT <n>] [OFFSET <n>]
//
//   <cond>    := <operand> <op> <operand>
//   <op>      := = | != | <> | < | <= | > | >= | LIKE
//   <operand> := field name (dots for nested fields) | 'string' | number
//
// String literals use single quotes; a quote inside a literal is written
// twice (''), as in standard SQL. AND binds tighter than OR. There are no
// parentheses.

class SqlError extends ShopError {
  constructor(message) {
    super(message, 'SQL');
  }
}

const KEYWORDS = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'LIKE']);
const OPERATORS = ['<=', '>=', '!=', '<>', '=', '<', '>', '*', ','];

function tokenize(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "'") {
      let value = '';
      i += 1;
      for (;;) {
        if (i >= text.length) throw new SqlError('Unterminated string literal');
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        value += text[i];
        i += 1;
      }
      tokens.push({ type: 'string', value });
      continue;
    }

    const rest = text.slice(i);

    const number = /^-?\d+(\.\d+)?/.exec(rest);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }

    const op = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (op) {
      tokens.push({ type: 'op', value: op === '<>' ? '!=' : op });
      i += op.length;
      continue;
    }

    const word = /^[A-Za-z_][\w.]*/.exec(rest);
    if (word) {
      const upper = word[0].toUpperCase();
      if (KEYWORDS.has(upper)) tokens.push({ type: 'keyword', value: upper });
      else tokens.push({ type: 'ident', value: word[0] });
      i += word[0].length;
      continue;
    }

    throw new SqlError(`Unexpected character "${ch}" at position ${i}`);
  }

  return tokens;
}

function parse(text) {
  const tokens = tokenize(text);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isKeyword = (value) => peek() && peek().type === 'keyword' && peek().value === value;

  function expectKeyword(value) {
    const token = next();
    if (!token || token.type !== 'keyword' || token.value !== value) {
      throw new SqlError(`Expected ${value}`);
    }
  }

  function expect(type) {
    const token = next();
    if (!token || token.type !== type) throw new SqlError(`Expected ${type}`);
    return token;
  }

  function operand() {
    const token = next();
    if (!token) throw new SqlError('Unexpected end of statement');
    if (token.type === 'ident') return { kind: 'field', name: token.value };
    if (token.type === 'string' || token.type === 'number') return { kind: 'literal', value: token.value };
    throw new SqlError(`Unexpected token "${token.value}"`);
  }

  function comparison() {
    const left = operand();
    const token = next();
    let op;
    if (token && token.type === 'op' && !['*', ','].includes(token.value)) op = token.value;
    else if (token && token.type === 'keyword' && token.value === 'LIKE') op = 'LIKE';
    else throw new SqlError('Expected comparison operator');
    const right = operand();
    return { left, op, right };
  }

  // Disjunctive normal form: an array of AND-groups, any of which may match.
  function condition() {
    const groups = [[comparison()]];
    while (isKeyword('AND') || isKeyword('OR')) {
      const joiner = next().value;
      if (joiner === 'AND') groups[groups.length - 1].push(comparison());
      else groups.push([comparison()]);
    }
    return groups;
  }

  expectKeyword('SELECT');
  const star = next();
  if (!star || star.value !== '*') throw new SqlError('Only SELECT * is supported');
  expectKeyword('FROM');
  const collection = expect('ident').value;

  const statement = { collection, where: null, orderBy: null, limit: null, offset: 0 };

  if (isKeyword('WHERE')) {
    next();
    statement.where = condition();
  }
  if (isKeyword('ORDER')) {
    next();
    expectKeyword('BY');
    const field = expect('ident').value;
    let direction = 'ASC';
    if (isKeyword('ASC') || isKeyword('DESC')) direction = next().value;
    statement.orderBy = { field, direction };
  }
  if (isKeyword('LIMIT')) {
    next();
    statement.limit = expect('number').value;
  }
  if (isKeyword('OFFSET')) {
    next();
    statement.offset = expect('number').value;
  }
  if (pos < tokens.length) throw new SqlError(`Unexpected token "${peek().value}"`);

  return statement;
}

function readField(row, name) {
  return name.split('.').reduce((value, key) => (value == null ? undefined : value[key]), row);
}

function likeToRegExp(pattern) {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function compare(left, op, right) {
  switch (op) {
    case '=':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case 'LIKE':
      return typeof left === 'string' && likeToRegExp(right).test(left);
    default:
      throw new SqlError(`Unknown operator ${op}`);
  }
}

function matches(row, groups) {
  const value = (operand) => (operand.kind === 'field' ? readField(row, operand.name) : operand.value);
  return groups.some((group) => group.every((c) => compare(value(c.left), c.op, value(c.right))));
}

function execute(text, loadCollection) {
  const statement = parse(text);
  let rows = loadCollection(statement.collection);

  if (statement.where) rows = rows.filter((row) => matches(row, statement.where));

  if (statement.orderBy) {
    const { field, direction } = statement.orderBy;
    const sign = direction === 'DESC' ? -1 : 1;
    rows.sort((a, b) => {
      const x = readField(a, field);
      const y = readField(b, field);
      if (x === y) return 0;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x < y ? -1 : 1) * sign;
    });
  }

  const end = statement.limit === null ? undefined : statement.offset + statement.limit;
  return rows.slice(statement.offset, end);
}

module.exports = { tokenize, parse, execute, SqlError };
