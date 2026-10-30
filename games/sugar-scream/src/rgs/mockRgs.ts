// Local mock of the Stake Engine RGS for development (Vite dev-server middleware).
//
// It implements the documented RGS HTTP contract (authenticate, balance, play,
// end-round, bet/event, bet/replay) on top of the math files produced by
// `npm run math:dev`, sampling books by their lookup-table weights exactly as the
// real RGS does. It is NOT part of the production build: on Stake Engine the real
// RGS (rgs_url query parameter) serves the uploaded math files.
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import type { Plugin } from 'vite';

const API_MULTIPLIER = 1_000_000;
const PREFIX = '/rgs';

interface StoredBook {
  id: number;
  payoutMultiplier: number;
  events: unknown[];
  criteria?: string;
}

interface ModeData {
  name: string;
  cost: number;
  books: StoredBook[];
  cumulative: bigint[];
  total: bigint;
}

interface Session {
  balance: number;
  round: null | { mode: string; amount: number; payoutMultiplier: number; costMultiplier: number; state: unknown[]; bookId: number; active: boolean; event?: string };
}

const BET_LEVELS = [100_000, 200_000, 400_000, 600_000, 800_000, 1_000_000, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000];

function loadModes(dir: string): Map<string, ModeData> {
  const modes = new Map<string, ModeData>();
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { modes: { name: string; cost: number; events: string; weights: string }[] };
  for (const m of index.modes) {
    const text = zstdDecompressSync(readFileSync(join(dir, m.events))).toString('utf8');
    const books = text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as StoredBook);
    const byId = new Map(books.map((b) => [b.id, b]));
    const rows = readFileSync(join(dir, m.weights), 'utf8').trim().split('\n').map((r) => r.split(',').map((v) => BigInt(v)));
    const ordered: StoredBook[] = [];
    const cumulative: bigint[] = [];
    let total = 0n;
    for (const [id, weight, payout] of rows) {
      const book = byId.get(Number(id));
      if (!book || BigInt(book.payoutMultiplier) !== payout) throw new Error(`mock RGS: lookup table mismatch for ${m.name} book ${id}`);
      if (weight === 0n) continue;
      total += weight;
      ordered.push(book);
      cumulative.push(total);
    }
    modes.set(m.name, { name: m.name, cost: m.cost, books: ordered, cumulative, total });
  }
  return modes;
}

/** Weighted pick with a cryptographic RNG over the uint64 weights. */
function pick(mode: ModeData): StoredBook {
  const r = randomBigInt(mode.total);
  let lo = 0;
  let hi = mode.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mode.cumulative[mid] > r) hi = mid;
    else lo = mid + 1;
  }
  return mode.books[lo];
}

function randomBigInt(max: bigint): bigint {
  // rejection sampling over 64 random bits
  const limit = (1n << 64n) - ((1n << 64n) % max);
  for (;;) {
    const v = (BigInt(randomInt(0, 2 ** 32)) << 32n) | BigInt(randomInt(0, 2 ** 32));
    if (v < limit) return v % max;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

/** Dev-only: a `cur-XXX` marker in the session ID picks the currency (e.g. cur-EUR, cur-XSC). */
const currencyOf = (sessionID: string) => /cur-([A-Z]{3})/.exec(sessionID)?.[1] ?? 'USD';

const toRound = (r: NonNullable<Session['round']>) => ({
  betID: r.bookId,
  amount: r.amount,
  payout: Math.round((r.amount * r.payoutMultiplier)),
  payoutMultiplier: r.payoutMultiplier,
  costMultiplier: r.costMultiplier,
  active: r.active,
  mode: r.mode,
  event: r.event ?? null,
  state: r.state,
});

export function mockRgs(options: { dir?: string } = {}): Plugin {
  let modes: Map<string, ModeData> | null = null;
  const sessions = new Map<string, Session>();
  return {
    name: 'sugar-scream-mock-rgs',
    apply: 'serve',
    configureServer(server) {
      const dir = options.dir ?? process.env.SS_MATH_DIR ?? join(server.config.root, 'math-output/dev');
      const ensure = () => {
        if (modes) return modes;
        if (!existsSync(join(dir, 'index.json'))) throw new Error(`No math files in ${dir}. Run "npm run math:dev" first.`);
        modes = loadModes(dir);
        server.config.logger.info(`[mock RGS] loaded ${[...modes.values()].map((m) => `${m.name}: ${m.books.length} books`).join(', ')}`);
        return modes;
      };

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next();
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname.slice(PREFIX.length);
        try {
          const all = ensure();
          if (req.method === 'GET' && path.startsWith('/bet/replay/')) {
            const [, , , , , modeName, event] = path.split('/'); // /bet/replay/{game}/{version}/{mode}/{event}
            const mode = all.get(modeName);
            const book = mode?.books.find((b) => String(b.id) === event);
            if (!mode || !book) return send(res, 404, { error: 'NOT_FOUND', message: 'replay not found' });
            return send(res, 200, { payoutMultiplier: book.payoutMultiplier / 100, costMultiplier: mode.cost, state: book.events });
          }
          if (req.method !== 'POST') return send(res, 400, { error: 'ERR_VAL', message: 'POST required' });
          const body = await readJson(req);
          const sessionID = String(body.sessionID ?? '');
          if (!sessionID) return send(res, 401, { error: 'ERR_IS', message: 'missing session' });
          let s = sessions.get(sessionID);
          if (path === '/wallet/authenticate') {
            if (!s) sessions.set(sessionID, (s = { balance: 1_000 * API_MULTIPLIER, round: null }));
            return send(res, 200, {
              balance: { amount: s.balance, currency: currencyOf(sessionID) },
              round: s.round?.active ? toRound(s.round) : null,
              config: {
                gameID: 'sugar-scream-dev',
                minBet: BET_LEVELS[0],
                maxBet: BET_LEVELS[BET_LEVELS.length - 1],
                stepBet: 100_000,
                defaultBetLevel: 1_000_000,
                betLevels: BET_LEVELS,
                betModes: {},
                jurisdiction: {
                  socialCasino: url.searchParams.get('social') === '1' || ['XGC', 'XSC'].includes(currencyOf(sessionID)),
                  disabledFullscreen: false, disabledTurbo: false, disabledSuperTurbo: false, disabledAutoplay: false,
                  disabledSlamstop: false, disabledSpacebar: false, disabledBuyFeature: false,
                  // dev-only: a `jur-flags` marker in the session ID turns the jurisdiction displays on
                  displayNetPosition: sessionID.includes('jur-flags'), displayRTP: sessionID.includes('jur-flags'), displaySessionTimer: sessionID.includes('jur-flags'),
                  minimumRoundDuration: 0,
                },
              },
              meta: null,
            });
          }
          if (!s) return send(res, 401, { error: 'ERR_IS', message: 'session not authenticated' });

          switch (path) {
            case '/wallet/balance':
              return send(res, 200, { balance: { amount: s.balance, currency: currencyOf(sessionID) } });
            case '/wallet/play':
            case '/dev/force': {
              if (s.round?.active) return send(res, 400, { error: 'ERR_VAL', message: 'round already active' });
              const amount = Number(body.amount);
              const mode = all.get(String(body.mode ?? ''));
              if (!mode || !BET_LEVELS.includes(amount)) return send(res, 400, { error: 'ERR_VAL', message: 'invalid mode or amount' });
              const cost = amount * mode.cost;
              if (cost > s.balance) return send(res, 400, { error: 'ERR_IPB', message: 'insufficient balance' });
              let book = pick(mode);
              if (path === '/dev/force') {
                // Development harness: pick a real, published book carrying a given tag.
                const want = String(body.scenario ?? '');
                const matches = mode.books.filter((b) => scenarioMatches(b, want));
                if (!matches.length) return send(res, 404, { error: 'NOT_FOUND', message: `no ${want} book in this set` });
                book = matches[randomInt(0, matches.length)];
              }
              s.balance -= cost;
              const payoutMultiplier = book.payoutMultiplier / 100;
              s.round = { mode: mode.name, amount, payoutMultiplier, costMultiplier: mode.cost, state: book.events, bookId: book.id, active: payoutMultiplier > 0 };
              return send(res, 200, { balance: { amount: s.balance, currency: currencyOf(sessionID) }, round: toRound(s.round) });
            }
            case '/wallet/end-round': {
              if (!s.round?.active) return send(res, 400, { error: 'ERR_VAL', message: 'no active round' });
              s.balance += Math.round(s.round.amount * s.round.payoutMultiplier);
              s.round.active = false;
              return send(res, 200, { balance: { amount: s.balance, currency: currencyOf(sessionID) } });
            }
            case '/bet/event': {
              if (!s.round?.active) return send(res, 400, { error: 'ERR_VAL', message: 'no active round' });
              s.round.event = String(body.event ?? '');
              return send(res, 200, { event: s.round.event });
            }
            default:
              return send(res, 404, { error: 'NOT_FOUND', message: path });
          }
        } catch (e) {
          server.config.logger.error(String(e));
          return send(res, 500, { error: 'ERR_GEN', message: e instanceof Error ? e.message : 'error' });
        }
      });
    },
  };
}

function scenarioMatches(b: StoredBook, want: string): boolean {
  const events = b.events as { type: string; kind?: string; prize?: string }[];
  const has = (type: string, kind?: string) => events.some((e) => e.type === type && (kind === undefined || e.kind === kind));
  const feature = has('freeSpinsStart') || has('trickOrTreat') || has('witchSpell') || has('lootBox');
  switch (want) {
    case 'loss':
      return b.payoutMultiplier === 0;
    case 'win':
      return b.payoutMultiplier > 0 && !feature;
    case 'tumble':
      return events.filter((e) => e.type === 'tumble').length >= 3 && !feature;
    case 'bigwin':
      return b.payoutMultiplier >= 2000 && !has('freeSpinsStart');
    case 'wincap':
      return b.criteria === 'wincap';
    case 'witchSpell':
      return has('witchSpell') && !has('trickOrTreat') && !has('freeSpinsStart');
    case 'trickOrTreat':
      return has('trickOrTreat') && !events.some((e) => e.prize === 'lollipop');
    case 'goldenLollipop':
      return events.some((e) => e.prize === 'lollipop');
    case 'cauldron':
      return has('freeSpinsStart', 'cauldron') && !has('trickOrTreat');
    case 'fullMoon':
      return has('freeSpinsStart', 'fullMoon');
    case 'pumpkinPatch':
      return has('pumpkinSplit');
    case 'retrigger':
      return has('retrigger');
    case 'lootBox':
      return has('lootBox');
    case 'lootMax':
      return events.some((e) => e.type === 'lootBox' && (e as { tier?: string }).tier === 'max');
    case 'graveyard':
      return has('holdStart') && b.criteria !== 'wincap';
    case 'lantern':
      return events.some((e) => e.type === 'holdRespin' && ((e as { boosts?: unknown[] }).boosts?.length ?? 0) > 0);
    case 'jackpot':
      return events.some((e) => e.type === 'holdRespin' && ((e as { landed?: { kind: string }[] }).landed ?? []).some((o) => o.kind === 'mini' || o.kind === 'major'));
    case 'grand':
      return events.some((e) => e.type === 'holdEnd' && (e as { grand?: boolean }).grand);
    default:
      return false;
  }
}
