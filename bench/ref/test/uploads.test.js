'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createShop } = require('../src');

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-uploads-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'public', 'uploads');
  return { root, dir, uploads: createShop({ uploads: { dir } }).uploads };
}

test('saves a file and reports its size and hash', async (t) => {
  const { uploads, dir } = setup(t);
  const saved = await uploads.save('cover.png', Buffer.from('png-bytes'));
  assert.equal(saved.name, 'cover.png');
  assert.equal(saved.size, 9);
  assert.equal(saved.sha256.length, 64);
  assert.equal(fs.readFileSync(path.join(dir, 'cover.png'), 'utf8'), 'png-bytes');
});

test('a taken name gets a numeric suffix', async (t) => {
  const { uploads } = setup(t);
  await uploads.save('cover.png', Buffer.from('one'));
  const second = await uploads.save('cover.png', Buffer.from('two'));
  assert.equal(second.name, 'cover-1.png');
  assert.deepEqual(await uploads.list(), ['cover-1.png', 'cover.png']);
});

test('disallowed file types are rejected', async (t) => {
  const { uploads } = setup(t);
  await assert.rejects(uploads.save('run.exe', Buffer.from('MZ')), { code: 'UPLOAD' });
});

test('empty files are rejected', async (t) => {
  const { uploads } = setup(t);
  await assert.rejects(uploads.save('empty.txt', Buffer.alloc(0)), { code: 'UPLOAD' });
});

test('unsafe characters are replaced', async (t) => {
  const { uploads } = setup(t);
  const saved = await uploads.save('my:cover?.png', Buffer.from('x'));
  assert.equal(saved.name, 'my_cover_.png');
});

test('a file name cannot climb out of the upload directory', async (t) => {
  const { uploads, root } = setup(t);
  try {
    await uploads.save('../../escape.txt', Buffer.from('x'));
  } catch {
    // Rejecting the name is fine too.
  }
  assert.equal(fs.existsSync(path.join(root, 'escape.txt')), false);
  assert.equal(fs.existsSync(path.join(root, 'public', 'escape.txt')), false);
});

test('read and remove work on saved files', async (t) => {
  const { uploads } = setup(t);
  await uploads.save('notes.txt', Buffer.from('hello'));
  assert.equal((await uploads.read('notes.txt')).toString(), 'hello');
  assert.equal(await uploads.remove('notes.txt'), true);
  await assert.rejects(uploads.read('notes.txt'), { code: 'NOT_FOUND' });
});
