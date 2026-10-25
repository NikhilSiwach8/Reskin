// Generates the Stake Engine math files for Sugar Scream and a statistics report.
//
//   node --experimental-strip-types src/math/cli.ts --books 100000 --out math-output/publish
//
// Output (per Stake Engine RGS contract):
//   index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv
// plus stats.json and REPORT.md describing RTP, hit rate, volatility and feature frequencies.
import { closeSync, createReadStream, createWriteStream, mkdirSync, openSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { constants as zlibConstants, createZstdCompress } from 'node:zlib';
import { BET_MODES, WINCAP } from '../engine/config.ts';
import { forcedScatterGrid, playRound, type ModeName } from '../engine/round.ts';
import { Rng } from '../engine/rng.ts';
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
  clientSummary: boolean;
  level: number;
  /** Per-mode natural book counts overriding --books (e.g. bonus=35000,fullmoon=30000). */
  modeBooks: Record<string, number>;
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
    modes: get('modes', BET_MODES.map((m) => m.name).join(',')).split(',') as ModeName[],
    forcedWincaps: Number(get('wincaps', '25')),
    forcedAttempts: Number(get('wincap-attempts', '600000')),
    clientSummary: argv.includes('--client-summary'),
    level: Number(get('level', '19')),
    modeBooks: Object.fromEntries(get('mode-books', '').split(',').filter(Boolean).map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)])),
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

  async compressTo(target: string, level: number): Promise<void> {
    this.flush();
    closeSync(this.fd);
    // Level 19 (the default) keeps the upload small; development runs use a faster level.
    const zstd = createZstdCompress({ params: { [zlibConstants.ZSTD_c_compressionLevel]: level, [zlibConstants.ZSTD_c_checksumFlag]: 1 } });
    await pipeline(createReadStream(this.path), zstd, createWriteStream(target));
    rmSync(this.path);
  }
}

async function runMode(mode: ModeName, args: Args): Promise<ModeStats> {
  const def = BET_MODES.find((m) => m.name === mode)!;
  const rng = new Rng(args.seed ^ (mode === 'base' ? 0x0b5e : 0xb0b5 + BET_MODES.indexOf(def)));
  const t0 = Date.now();
  const sink = new BookSink(join(args.out, `books_${mode}.jsonl.tmp`));
  // The buy modes' books are about 13x larger than base books, so they use fewer natural
  // books to keep the whole upload set small (see --mode-books).
  const count = args.modeBooks[mode] ?? args.books;
  for (let i = 1; i <= count; i++) sink.add(playRound(i, mode, rng));
  const books = sink.summaries;
  const natural = books.length;
  const naturalCaps = books.filter((b) => b.criteria === 'wincap').length;
  const naturalFeature = books.filter((b) => b.tags.includes('cauldron') || b.tags.includes('fullMoon')).length;

  // Forced win-cap search. Only free spins can reach the 10,000x cap, and far less often
  // than once in the natural sample. The base game and Ante Bet play extra free-spin
  // rounds from forced 4- and 5-Lollipop boards (Haunted Cauldron and Full Moon) and keep
  // the ones that reach the cap; the buys simply play more of their own rounds. Each
  // route's conditional hit rate times its natural frequency estimates the natural win-cap
  // probability used for the lookup-table weights.
  const routes: { scatters: number; tag: string }[] = def.forcedScatters
    ? [{ scatters: def.forcedScatters, tag: '' }]
    : [{ scatters: 4, tag: 'cauldron' }, { scatters: 5, tag: 'fullMoon' }];
  let attempts = 0;
  let hits = 0;
  let estimate = naturalCaps / natural;
  let routed = 0;
  routes.forEach((route, ri) => {
    const frng = new Rng(args.seed ^ 0xcafe ^ (BET_MODES.indexOf(def) * 16 + ri));
    let a = 0;
    let h = 0;
    const want = Math.ceil(args.forcedWincaps / routes.length);
    const maxAttempts = Math.ceil(args.forcedAttempts / routes.length);
    while (h < want && a < maxAttempts) {
      a++;
      const book = def.forcedScatters
        ? playRound(books.length + 1, mode, frng)
        : playRound(books.length + 1, mode, frng, { grid: forcedScatterGrid(frng, route.scatters), noSpell: true });
      if (book.criteria === 'wincap') {
        book.tags.push('forced');
        sink.add(book);
        h++;
      }
    }
    attempts += a;
    hits += h;
    const pRoute = route.tag ? books.slice(0, natural).filter((b) => b.tags.includes(route.tag)).length / natural : 1;
    routed += a ? pRoute * (h / a) : 0;
  });
  estimate = Math.max(estimate, routed);
  if (hits === 0 && naturalCaps === 0) console.warn(`[${mode}] no win-cap book found; max win not reachable in this book set`);

  const payouts = books.map((b) => b.payoutMultiplier);
  const solved = solveWeights({
    payouts,
    cost: def.cost,
    targetRtp: args.target,
    fixed: [
      { name: 'wincap', probability: estimate, members: books.map((b) => b.payoutMultiplier >= WINCAP) },
    ],
  });

  await sink.compressTo(join(args.out, `books_${mode}.jsonl.zst`), args.level);
  writeFileSync(join(args.out, `lookUpTable_${mode}_0.csv`), books.map((b, i) => `${b.id},${solved.weights[i]},${b.payoutMultiplier}`).join('\n') + '\n');

  const stats = buildStats(mode, def.cost, books, solved.weights, {
    natural,
    naturalCaps,
    naturalFeature,
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
    generated: { books: args.books, modeBooks: args.modeBooks, seed: args.seed },
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
