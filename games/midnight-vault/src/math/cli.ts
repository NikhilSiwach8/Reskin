// Generates the Stake Engine math files for Midnight Vault and a statistics report.
//
//   node --experimental-strip-types src/math/cli.ts --books 100000 --out math-output/publish
//
// Output (per Stake Engine RGS contract):
//   index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv
// plus stats.json and REPORT.md describing RTP, hit rate, volatility and feature frequencies.
import { closeSync, createReadStream, createWriteStream, mkdirSync, openSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createZstdCompress } from 'node:zlib';
import { BET_MODES, WINCAP } from '../engine/config.ts';
import { forcedKeyBoard, playRound, type ModeName } from '../engine/round.ts';
import { Rng } from '../engine/rng.ts';
import { windowProbability } from '../engine/reels.ts';
import type { Book } from '../engine/types.ts';
import { solveWeights } from './weights.ts';
import { buildStats, renderReport, type BookSummary, type ModeStats } from './stats.ts';

interface Args {
  books: number;
  out: string;
  seed: number;
  target: number;
  modes: ModeName[];
  forcedWincaps: number;
  forcedAttempts: number;
  forcedBreach: number;
  clientSummary: boolean;
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
    forcedBreach: Number(get('breach', '300')),
    clientSummary: argv.includes('--client-summary'),
  };
}

/** Streams book lines to an uncompressed temp file; only small summaries stay in memory. */
class BookSink {
  private fd: number;
  private buf: string[] = [];
  private size = 0;
  readonly summaries: BookSummary[] = [];
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    this.fd = openSync(path, 'w');
  }

  add(b: Book): void {
    const line = JSON.stringify({ id: b.id, payoutMultiplier: b.payoutMultiplier, events: b.events, criteria: b.criteria }) + '\n';
    this.buf.push(line);
    this.size += line.length;
    if (this.size > 4_000_000) this.flush();
    this.summaries.push({ id: b.id, payoutMultiplier: b.payoutMultiplier, tags: b.tags, criteria: b.criteria });
  }

  flush(): void {
    if (this.buf.length) writeSync(this.fd, this.buf.join(''));
    this.buf = [];
    this.size = 0;
  }

  async compressTo(target: string): Promise<void> {
    this.flush();
    closeSync(this.fd);
    await pipeline(createReadStream(this.path), createZstdCompress(), createWriteStream(target));
    rmSync(this.path);
  }
}

async function runMode(mode: ModeName, args: Args): Promise<ModeStats> {
  const def = BET_MODES.find((m) => m.name === mode)!;
  const rng = new Rng(args.seed ^ (mode === 'base' ? 0x0b5e : 0xb0b5));
  const t0 = Date.now();
  const sink = new BookSink(join(args.out, `books_${mode}.jsonl.tmp`));
  for (let i = 1; i <= args.books; i++) sink.add(playRound(i, mode, rng));
  const books = sink.summaries;
  const natural = books.length;
  const naturalCaps = books.filter((b) => b.criteria === 'wincap').length;
  const naturalPath = books.filter((b) => b.tags.includes('cursedFortune')).length;

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
      sink.add(book);
      hits++;
    }
  }
  const pPath = naturalPath / natural;
  const pCapGivenPath = attempts ? hits / attempts : 0;
  const estimate = Math.max(naturalCaps / natural, pPath * pCapGivenPath);
  if (hits === 0 && naturalCaps === 0) console.warn(`[${mode}] no win-cap book found; max win not reachable in this book set`);

  // The Vault Breach (5 Keys) is far rarer in the base game than one book in the natural
  // sample, but the rules promise it, so forced 5-Key rounds are added. Its probability is
  // exact: Keys appear at most once per reel window, so P(5 Keys) is the product of the
  // per-reel window probabilities.
  let breachProbability = 0;
  if (mode === 'base' && args.forcedBreach > 0) {
    breachProbability = windowProbability('base', 'VK').reduce((p, r) => p * r, 1);
    const brng = new Rng(args.seed ^ 0xb7ea);
    for (let i = 0; i < args.forcedBreach; i++) {
      const book = playRound(books.length + 1, 'base', brng, { board: forcedKeyBoard(brng, 5) });
      book.tags.push('forced');
      sink.add(book);
    }
  }

  const payouts = books.map((b) => b.payoutMultiplier);
  const solved = solveWeights({
    payouts,
    cost: def.cost,
    targetRtp: args.target,
    fixed: [
      { name: 'wincap', probability: estimate, members: books.map((b) => b.payoutMultiplier >= WINCAP) },
      ...(breachProbability ? [{ name: 'vaultBreach', probability: breachProbability, members: books.map((b) => b.tags.includes('vaultBreach')) }] : []),
    ],
  });

  await sink.compressTo(join(args.out, `books_${mode}.jsonl.zst`));
  writeFileSync(join(args.out, `lookUpTable_${mode}_0.csv`), books.map((b, i) => `${b.id},${solved.weights[i]},${b.payoutMultiplier}`).join('\n') + '\n');

  const stats = buildStats(mode, def.cost, books, solved.weights, {
    natural,
    naturalCaps,
    naturalBreach: naturalPath,
    forcedAttempts: attempts,
    forcedHits: hits,
    wincapEstimate: estimate,
    rawRtp: payouts.slice(0, natural).reduce((s, p) => s + p, 0) / natural / 100 / def.cost,
    zeroProbability: solved.belowProbability,
    aboveScale: solved.aboveScale,
    fixedGroups: solved.fixed,
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
  // Small summary for the in-game rules panel (RTP and max win per mode).
  const summary = JSON.stringify({
    generated: { books: args.books, seed: args.seed },
    modes: all.map((m) => ({ mode: m.mode, cost: m.cost, rtp: m.rtp, maxWin: m.maxWin, maxWinProbability: m.maxWinProbability, hitRate: m.hitRate })),
  }, null, 2) + '\n';
  writeFileSync(join(args.out, 'math.json'), summary);
  if (args.clientSummary) writeFileSync(join(process.cwd(), 'public/math.json'), summary);
  console.log(`wrote ${args.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
