// Checks a Stake upload set before it is packaged:
//   - index.json lists every mode with its books and lookup table, and the files exist
//   - every lookup-table row matches a book id and that book's payoutMultiplier
//     (the same check the RGS runs on upload)
//   - every book passes the engine's validateBook
//
//   node --experimental-strip-types tools/verify-math.ts math-output/publish
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { validateBook } from '../src/engine/validate.ts';

const dir = process.argv[2] ?? 'math-output/publish';
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { modes: { name: string; cost: number; events: string; weights: string }[] };
let failed = false;
for (const m of index.modes) {
  const books = new Map<number, { payoutMultiplier: number; events: unknown }>();
  const text = zstdDecompressSync(readFileSync(join(dir, m.events))).toString('utf8');
  let invalid = 0;
  for (const line of text.split('\n')) {
    if (!line) continue;
    const b = JSON.parse(line);
    books.set(b.id, b);
    const res = validateBook(b);
    if (!res.ok && invalid++ < 3) console.error(`[${m.name}] book ${b.id}: ${res.errors.join('; ')}`);
  }
  const rows = readFileSync(join(dir, m.weights), 'utf8').trim().split('\n');
  let mismatched = 0;
  for (const row of rows) {
    const [id, weight, payout] = row.split(',').map(Number);
    const b = books.get(id);
    if (!b || b.payoutMultiplier !== payout || !(weight >= 0)) mismatched++;
  }
  const ok = invalid === 0 && mismatched === 0 && rows.length === books.size;
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${m.name.padEnd(9)} ${books.size} books, ${rows.length} lookup rows, ${invalid} invalid, ${mismatched} mismatched`);
}
process.exit(failed ? 1 : 0);
