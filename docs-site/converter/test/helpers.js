import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
/** Create a throwaway content source from { 'rel/path.md': 'content' }. */
export function tempSource(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-site-test-'));
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
  return root;
}
