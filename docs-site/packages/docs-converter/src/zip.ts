// A deterministic zip writer for docs bundles: the same files give the same bytes (sorted entries, fixed
// timestamp, plain file mode, no extra fields), so the same content always has the same sha256. No dependencies.
import zlib from 'node:zlib';

export interface ZipEntry { name: string; data: Buffer }

const SAFE = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)[^\\\0]+$/;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01, the earliest DOS date
const DOS_TIME = 0;
const MODE = 0o100644; // regular file, rw-r--r--

/** Build a zip from entries (repo-relative names with `/`). Refuses unsafe and duplicate (case-insensitive) names. */
export function zipEntries(entries: ZipEntry[]): Buffer {
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.name || !SAFE.test(e.name)) throw new Error(`unsafe zip entry name: ${JSON.stringify(e.name)}`);
    const key = e.name.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate zip entry name: ${e.name}`);
    seen.add(key);
  }
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of sorted) {
    const name = Buffer.from(e.name, 'utf8');
    const deflated = zlib.deflateRawSync(e.data, { level: 9 });
    const crc = zlib.crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((MODE << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, deflated);
    centrals.push(central, name);
    offset += local.length + name.length + deflated.length;
    if (offset > 0xffffffff) throw new Error('bundle too large for a zip without zip64');
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  if (sorted.length > 0xffff) throw new Error('too many zip entries without zip64');
  return Buffer.concat([...locals, cd, end]);
}
