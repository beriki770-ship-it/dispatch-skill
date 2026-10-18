'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { UploadError, NotFoundError } = require('../util/errors');
const { sanitizeFilename, extensionOf, numbered } = require('./filenames');

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Stores uploaded files (cover images, sample chapters) on local disk.
// Existing files are never overwritten: a taken name gets a numeric suffix.
function createUploadStore({ dir, maxBytes, allowedExtensions }) {
  const root = path.resolve(dir);
  const allowed = new Set(allowedExtensions.map((ext) => ext.toLowerCase()));

  async function save(filename, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buffer.length === 0) throw new UploadError('File is empty');
    if (buffer.length > maxBytes) {
      throw new UploadError(`File is too large (maximum ${formatBytes(maxBytes)})`, {
        size: buffer.length,
        maxBytes,
      });
    }

    const clean = sanitizeFilename(filename);
    const ext = extensionOf(clean);
    if (!allowed.has(ext)) {
      throw new UploadError(`Files of type ${ext || '(none)'} are not allowed`, { ext });
    }

    let name = clean;
    let target = path.join(root, name);
    for (let n = 1; await exists(target); n += 1) {
      name = numbered(clean, n);
      target = path.join(root, name);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });

    return {
      name,
      path: target,
      size: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async function read(name) {
    const target = path.join(root, sanitizeFilename(name));
    try {
      return await fs.readFile(target);
    } catch (error) {
      if (error.code === 'ENOENT') throw new NotFoundError('upload', name);
      throw error;
    }
  }

  async function remove(name) {
    try {
      await fs.unlink(path.join(root, sanitizeFilename(name)));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async function list() {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  return { save, read, remove, list, dir: root };
}

module.exports = { createUploadStore, formatBytes, sanitizeFilename };
