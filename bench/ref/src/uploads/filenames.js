'use strict';

const path = require('node:path');
const { UploadError } = require('../util/errors');

// Characters that are unsafe or awkward in file names on at least one of
// the platforms the shop is deployed on.
const UNSAFE_CHARACTERS = /[<>:"|?*\u0000-\u001f]/g;
const MAX_NAME_LENGTH = 180;

// Turns a client-supplied file name into one that is safe to store: drops
// parent-directory segments and leading slashes, replaces unsafe characters
// and collapses whitespace.
function sanitizeFilename(name) {
  if (typeof name !== 'string') throw new UploadError('File name must be a string');

  let clean = name.normalize('NFC').trim();
  clean = clean.split(/[/\\]/).pop();
  clean = clean.replace(UNSAFE_CHARACTERS, '_').replace(/\s+/g, ' ');

  if (clean === '' || clean === '.' || clean === '..') {
    throw new UploadError('File name is empty after cleaning', { name });
  }
  if (clean.length > MAX_NAME_LENGTH) {
    const ext = path.extname(clean);
    clean = clean.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
  }
  return clean;
}

function extensionOf(name) {
  return path.extname(name).toLowerCase();
}

// "cover.png" -> "cover-1.png", "cover-2.png", ... used when a name is taken.
function numbered(name, n) {
  const ext = path.extname(name);
  return `${name.slice(0, name.length - ext.length)}-${n}${ext}`;
}

module.exports = { sanitizeFilename, extensionOf, numbered };
