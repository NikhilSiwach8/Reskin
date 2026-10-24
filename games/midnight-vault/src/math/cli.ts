// Generates the Stake Engine math files for Midnight Vault and a statistics report.
//
//   node --experimental-strip-types src/math/cli.ts --books 100000 --out math-output/publish
//
// Output (per Stake Engine RGS contract):
//   index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv
// plus stats.json and REPORT.md describing RTP, hit rate, volatility and feature frequencies.
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createZstdCompress } from 'node:zlib';
import { BET_MODES, WINCAP } from '../engine/config.ts';
import { forcedKeyBoard, playRound, type ModeName } from '../engine/round.ts';
import { Rng } from '../engine/rng.ts';
import type { Book } from '../engine/types.ts';
import { solveWeights } from './weights.ts';
import { buildStats, renderReport, type ModeStats } from './stats.ts';

interface Args {
  books: number;
  out: string;
  seed: number;
  target: number;
  modes: ModeName[];
  forcedWincaps: number;
  forcedAttempts: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, def: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : def;
  };
  return {
    books: Number(get('books', '20000')),
    out: get('out', 'math-output/dev'),
    seed: Number(get('seed', '1313')),
    target: Number(get('target', '0.96')),
    modes: get('modes', 'base,bonus').split(',') as ModeName[],
    forcedWincaps: Number(get('wincaps', '25')),
    forcedAttempts: Number(get('wincap-attempts', '600000')),
  };
}

async function writeBooks(path: string, books: Book[]): Promise<void> {
  function* lines() {
    for (const b of books) yield JSON.stringify({ id: b.id, payoutMultiplier: b.payoutMultiplier, events: b.events, criteria: b.criteria }) + '\n';
  }
  await pipeline(Readable.from(lines()), createZstdCompress(), createWriteStream(path));
}

async function runMode(mode: ModeName, args: Args): Promise<ModeStats> {
  const def = BET_MODES.find((m) => m.name === mode)!;
  const rng = new Rng(args.seed ^ (mode === 'base' ? 0x0b5e : 0xb0b5));
  const t0 = Date.now();
  const books: Book[] = [];
  for (let i = 1; i <= args.books; i++) books.push(playRound(i, mode, rng));
  const natural = books.length;
  const naturalCaps = books.filter((b) => b.criteria === 'wincap').length;
  const naturalBreach = books.filter((b) => b.tags.includes('cursedFortune')).length;

  // Forced win-cap search. Cursed Fortune is the main natural route to the cap,
  // so we play extra Cursed Fortune rounds and keep the ones that reach it. The
  // conditional hit rate times the natural Cursed Fortune frequency estimates the
  // natural win-cap probability used for the lookup-table weights.
  let attempts = 0;
  let hits = 0;
  const frng = new Rng(args.seed ^ 0xcafe ^ (mode === 'base' ? 1 : 2));
  while (hits < args.forcedWincaps && attempts < args.forcedAttempts) {
    attempts++;
    const id = books.length + 1;
    const book =
      mode === 'base'
        ? playRound(id, 'base', frng, { board: forcedKeyBoard(frng, 3), forcedPath: 'cursedFortune' })
        : playRound(id, 'bonus', frng, { forcedPath: 'cursedFortune' });
    if (book.criteria === 'wincap') {
      book.tags.push('forced');
      books.push(book);
      hits++;
    }
  }
  const pPath = books.slice(0, natural).filter((b) => b.tags.includes('cursedFortune')).length / natural;
  const pCapGivenPath = attempts ? hits / attempts : 0;
  const estimate = Math.max(naturalCaps / natural, pPath * pCapGivenPath);
  if (hits === 0 && naturalCaps === 0) console.warn(`[${mode}] no win-cap book found; max win not reachable in this book set`);

  const payouts = books.map((b) => b.payoutMultiplier);
  const wincap = books.map((b) => b.payoutMultiplier >= WINCAP);
  const solved = solveWeights({ payouts, wincap, cost: def.cost, targetRtp: args.target, wincapProbability: estimate });

  await writeBooks(join(args.out, `books_${mode}.jsonl.zst`), books);
  writeFileSync(join(args.out, `lookUpTable_${mode}_0.csv`), books.map((b, i) => `${b.id},${solved.weights[i]},${b.payoutMultiplier}`).join('\n') + '\n');

  const stats = buildStats(mode, def.cost, books, solved.weights, {
    natural,
    naturalCaps,
    naturalBreach,
    forcedAttempts: attempts,
    forcedHits: hits,
    wincapEstimate: estimate,
    rawRtp: payouts.slice(0, natural).reduce((s, p) => s + p, 0) / natural / 100 / def.cost,
    zeroProbability: solved.belowProbability,
    aboveScale: solved.aboveScale,
    seconds: (Date.now() - t0) / 1000,
  });
  console.log(`[${mode}] ${books.length} books, raw RTP ${(stats.rawRtp * 100).toFixed(2)}%, weighted RTP ${(stats.rtp * 100).toFixed(3)}%, hit rate 1 in ${(1 / stats.hitRate).toFixed(2)}, sd ${stats.stdDev.toFixed(2)}x, ${stats.seconds.toFixed(1)}s`);
  return stats;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  const all: ModeStats[] = [];
  for (const mode of args.modes) all.push(await runMode(mode, args));
  const index = {
    modes: args.modes.map((m) => {
      const def = BET_MODES.find((d) => d.name === m)!;
      return { name: m, cost: def.cost, events: `books_${m}.jsonl.zst`, weights: `lookUpTable_${m}_0.csv` };
    }),
  };
  writeFileSync(join(args.out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  writeFileSync(join(args.out, 'stats.json'), JSON.stringify({ args, modes: all }, null, 2) + '\n');
  writeFileSync(join(args.out, 'REPORT.md'), renderReport(all, args));
  console.log(`wrote ${args.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
