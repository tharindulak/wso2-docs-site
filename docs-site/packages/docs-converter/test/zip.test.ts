import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { zipEntries } from '../src/zip.js';

/** Read a zip's central directory: name, method, mode, DOS time and date, and the inflated data. */
function readZip(buf: Buffer) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Array<{ name: string; method: number; mode: number; time: number; date: number; data: string }> = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10), time = buf.readUInt16LE(p + 12), date = buf.readUInt16LE(p + 14);
    const size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32);
    const mode = buf.readUInt32LE(p + 38) >>> 16, local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const lName = buf.readUInt16LE(local + 26), lExtra = buf.readUInt16LE(local + 28);
    const raw = buf.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
    out.push({ name, method, mode, time, date, data: (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8') });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

test('entries are written sorted, deflated, as plain files with a fixed timestamp', () => {
  const zip = zipEntries([{ name: 'b/two.md', data: Buffer.from('two two two two') }, { name: 'a.yaml', data: Buffer.from('one') }]);
  const entries = readZip(zip);
  assert.deepEqual(entries.map((e) => e.name), ['a.yaml', 'b/two.md']);
  assert.deepEqual(entries.map((e) => e.data), ['one', 'two two two two']);
  for (const e of entries) {
    assert.equal(e.method, 8);
    assert.equal(e.mode, 0o100644);
    assert.equal(e.time, 0);
    assert.equal(e.date, (0 << 9) | (1 << 5) | 1); // 1980-01-01
  }
});

test('the same files give the same bytes, whatever order they come in', () => {
  const files = [{ name: 'x.md', data: Buffer.from('x') }, { name: 'y/z.png', data: Buffer.from([1, 2, 3]) }];
  assert.ok(zipEntries(files).equals(zipEntries([...files].reverse())));
});

test('unsafe or duplicate entry names are refused', () => {
  for (const name of ['../x', '/abs', 'a/../b', 'a\\b', '', 'a//b'])
    assert.throws(() => zipEntries([{ name, data: Buffer.from('') }]), /entry name/, name);
  assert.throws(() => zipEntries([{ name: 'a.md', data: Buffer.from('') }, { name: 'a.md', data: Buffer.from('') }]), /duplicate/);
  assert.throws(() => zipEntries([{ name: 'A.md', data: Buffer.from('') }, { name: 'a.md', data: Buffer.from('') }]), /duplicate/);
});
