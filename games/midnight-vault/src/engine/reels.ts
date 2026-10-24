// Reel strip construction and board drawing.
import { REEL_SETS, REELS, ROWS, SPACED_SYMBOLS, type StripSpec } from './config.ts';
import { Rng } from './rng.ts';
import type { Board, SymbolId } from './types.ts';

export type ReelStrips = SymbolId[][];

const stripCache = new Map<string, ReelStrips>();

/**
 * Builds the five strips of a reel set deterministically from its composition.
 * Every spaced symbol (Keys, Relics and the four feature symbols) is kept at least
 * ROWS positions away from its own copies (cyclically), so a reel window shows at
 * most one of each. Feature counts such as "3 Vault Doors" therefore always mean
 * three different reels.
 */
export function buildStrips(name: string, spec: StripSpec = REEL_SETS[name]): ReelStrips {
  const cached = stripCache.get(name);
  if (cached && spec === REEL_SETS[name]) return cached;
  if (!spec) throw new Error(`Unknown reel set ${name}`);
  const strips: ReelStrips = [];
  for (let reel = 0; reel < REELS; reel++) {
    const rng = new Rng(hash(`${name}:${reel}`));
    const strip: SymbolId[] = [];
    for (const [sym, count] of Object.entries(spec) as [SymbolId, number][]) for (let i = 0; i < count; i++) strip.push(sym);
    for (const sym of SPACED_SYMBOLS) {
      if ((spec[sym] ?? 0) * ROWS > strip.length) throw new Error(`Reel set ${name} too short to space ${sym}`);
    }
    rng.shuffle(strip);
    repairSpacing(strip, rng, name);
    strips.push(strip);
  }
  if (spec === REEL_SETS[name]) stripCache.set(name, strips);
  return strips;
}

function conflicts(strip: SymbolId[], i: number, sym: SymbolId): boolean {
  if (!SPACED_SYMBOLS.includes(sym)) return false;
  const n = strip.length;
  for (let d = 1; d < ROWS; d++) {
    if (strip[(i + d) % n] === sym || strip[(i - d + n) % n] === sym) return true;
  }
  return false;
}

/** Moves spaced symbols that sit too close to a copy of themselves (deterministic). */
function repairSpacing(strip: SymbolId[], rng: Rng, name: string): void {
  const n = strip.length;
  for (let pass = 0; pass < 200; pass++) {
    let bad = -1;
    for (let i = 0; i < n; i++) if (conflicts(strip, i, strip[i])) { bad = i; break; }
    if (bad === -1) return;
    const sym = strip[bad];
    // Swap with a non-spaced symbol at a position where neither side conflicts.
    const order = rng.shuffle([...Array(n).keys()]);
    let fixed = false;
    for (const j of order) {
      const other = strip[j];
      if (SPACED_SYMBOLS.includes(other)) continue;
      strip[bad] = other;
      strip[j] = sym;
      if (!conflicts(strip, j, sym)) { fixed = true; break; }
      strip[j] = other;
      strip[bad] = sym;
    }
    if (!fixed) break;
  }
  for (let i = 0; i < n; i++) if (conflicts(strip, i, strip[i])) throw new Error(`Could not space reel set ${name}`);
}

/** Draws a full board by picking a random stop on each strip. */
export function drawBoard(rng: Rng, reelSet: string): Board {
  const strips = buildStrips(reelSet);
  return strips.map((strip) => windowAt(strip, rng.int(strip.length)));
}

/** Draws one reel window. */
export function drawReel(rng: Rng, reelSet: string, reel: number): SymbolId[] {
  const strip = buildStrips(reelSet)[reel];
  return windowAt(strip, rng.int(strip.length));
}

export function windowAt(strip: SymbolId[], stop: number): SymbolId[] {
  const out: SymbolId[] = [];
  for (let r = 0; r < ROWS; r++) out.push(strip[(stop + r) % strip.length]);
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
