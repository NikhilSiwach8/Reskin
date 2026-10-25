// Game rules / paytable panel, generated from the engine configuration so the rules
// can never drift from the math. RTP and max-win figures come from the published math
// report (math.json) and are only shown when that report exists.
import { BET_MODES, BUY_MODES, FEATURES, PAYLINES, RELIC_TABLES, SURGE_MULT, SYMBOL_ORDER, SYMBOLS, WINCAP } from '../../engine/config.ts';
import type { SymbolId } from '../../engine/types.ts';
import { localizeTree } from './text.ts';

export interface MathSummary {
  modes: { mode: string; cost: number; rtp: number; maxWin: number; maxWinProbability: number; hitRate: number }[];
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const x = (centi: number) => `${(centi / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}x`;

function uniq(nums: number[]): string {
  return [...new Set(nums)].sort((a, b) => a - b).map((n) => `${n}x`).join(', ');
}

function paylineSvg(rows: number[], n: number): string {
  const c = 12;
  const cells = Array.from({ length: 25 }, (_, i) => {
    const reel = Math.floor(i / 5), row = i % 5;
    const on = rows[reel] === row;
    return `<rect x="${reel * c + 1}" y="${row * c + 1}" width="${c - 2}" height="${c - 2}" rx="2" fill="${on ? '#7DFFA8' : '#2A1A48'}"/>`;
  }).join('');
  return `<figure class="payline"><svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">${cells}</svg><figcaption>${n}</figcaption></figure>`;
}

export function buildRules(container: HTMLElement, opts: { math?: MathSummary; betFormatter: (centi: number) => string; disabledBuy: boolean }): void {
  const sym = (id: SymbolId) => `<img src="assets/${SYMBOLS[id].asset}.webp" alt="" class="sym-icon" onerror="this.style.visibility='hidden'">`;
  const payRows = SYMBOL_ORDER.filter((id) => SYMBOLS[id].category !== 'scatter')
    .map((id) => {
      const s = SYMBOLS[id];
      return `<tr><td class="sym-cell">${sym(id)}<span>${s.name}</span></td><td>${x(s.pays[3]!)}</td><td>${x(s.pays[4]!)}</td><td>${x(s.pays[5]!)}</td><td class="pay-now">${opts.betFormatter(s.pays[5]!)}</td></tr>`;
    })
    .join('');
  const mathRows = opts.math
    ? opts.math.modes
        .map((m) => {
          const def = BET_MODES.find((b) => b.name === m.mode);
          const label = def?.path ? `Buy ${def.label}` : (def?.label ?? m.mode);
          // Max win is the largest payout in the mode's published books (only Cursed Fortune can reach the cap).
          return `<tr><td>${label}</td><td>${m.cost}x bet</td><td>${pct(m.rtp)}</td><td>${Math.min(m.maxWin, WINCAP / 100).toLocaleString('en-US')}x bet</td></tr>`;
        })
        .join('')
    : '';
  const ph = FEATURES.phantomHeist;
  const pp = FEATURES.phantomPayday;
  const th = FEATURES.thirteenthHour;
  const tk = FEATURES.threeKeys;
  const vb = FEATURES.vaultBreach;
  const ov = FEATURES.overload;

  container.innerHTML = `
<section>
  <h3>How to play</h3>
  <p>Midnight Vault is a 5-reel, 5-row video slot with 15 fixed paylines. Choose your bet and press Spin (or the spacebar). Wins pay left to right on adjacent reels, starting from the leftmost reel. Only the highest win on each payline is paid. Line wins on different paylines are added together.</p>
  <p>Line pays are shown as multiples of the total bet. The value column shows the 5-of-a-kind win for your current bet.</p>
</section>
<section>
  <h3>Paytable</h3>
  <table class="paytable"><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th><th>5 at your bet</th></tr></thead><tbody>${payRows}</tbody></table>
  <p>${sym('VK')} <b>Vault Key</b> is a scatter and does not pay on paylines.</p>
</section>
<section>
  <h3>Paylines</h3>
  <div class="paylines">${PAYLINES.map((p, i) => paylineSvg(p, i + 1)).join('')}</div>
</section>
<section>
  <h3>${sym('RL')} The Cursed Relic</h3>
  <p>The Cursed Relic is wild and substitutes for every symbol except the Vault Key. Five Relics on a payline pay ${x(SYMBOLS.RL.pays[5]!)}; when a line starts with Relics, the higher of the Relic win and the substituted-symbol win is paid.</p>
  <p>Every Relic carries a multiplier and may expand. An expanding Relic grows right and down from where it landed into a 2x2, 3x3 or 4x4 block (shifted left or up at the edge of the grid). A block never covers a Vault Key or another expanded block; it shrinks to the largest size that fits. New Relics inside the block are absorbed and add their multiplier to it.</p>
  <p><b>Multipliers:</b> a winning payline is multiplied by the <b>sum</b> of the multipliers of the different Relic blocks in that win. A block crossed by the line on several cells counts once.</p>
  <ul>
    <li>Base game Relic multipliers: ${uniq(RELIC_TABLES.base.mult.map(([m]) => m))}</li>
    <li>Respin and free-spin Relic multipliers: ${uniq([...RELIC_TABLES.respin.mult, ...RELIC_TABLES.free.mult].map(([m]) => m))}</li>
    <li>Cursed Fortune Relic multipliers: ${uniq(RELIC_TABLES.cursedFortune.mult.map(([m]) => m))} (increased by Relic Overload, see Cursed Fortune)</li>
    <li>Relic Surge multipliers: ${uniq(Object.values(SURGE_MULT).flatMap((t) => t.map(([m]) => m)))}</li>
    <li>Phantom wilds: ${uniq(pp.wildMult.map(([m]) => m))}</li>
  </ul>
</section>
<section>
  <h3>Base game features</h3>
  <p>Each base game spin can trigger at most one feature. If several apply, the order is: The Vault Breach, Three Keys to the Vault, The Thirteenth Hour, Lockdown Spin, Spectral Respin, Phantom Heist. Feature symbols appear at most once per reel, so "3 symbols" always means 3 different reels.</p>
  <h4>${sym('VD')} Lockdown Spin: 3 or more Vault Doors</h4>
  <p>Reels showing a Vault Door lock in chains and the other reels respin ${FEATURES.lockdown.respins} times. A Vault Door landing on a respinning reel locks that reel and resets the respins to ${FEATURES.lockdown.respins}. The feature ends when the respins run out or all 5 reels are locked. Then the chains break, every Vault Door opens into a Cursed Relic, Relics expand, and only the final grid is paid.</p>
  <h4>${sym('EL')} Spectral Respin: 3 or more Spectral Elixirs</h4>
  <p>All Elixirs and Relics are held and every other position respins once. Then Relics expand and only the final grid is paid.</p>
  <h4>${sym('PH')} Phantom Heist: 3 or more Phantoms</h4>
  <p>The Phantom steals the most common low symbol (A, K, Q, J, 10; ties go to the higher-paying symbol) and turns every copy of it into one symbol drawn from: ${ph.targets.map(([s]) => SYMBOLS[s].name).join(', ')}. Phantom wilds are 1x1 Relics carrying a multiplier. Then Relics expand and the grid is paid. Transformations never carry into later spins.</p>
  <h4>${sym('CL')} The Thirteenth Hour: 3 or more Clocks</h4>
  <p>The triggering spin is paid, then the clock starts at hour ${th.startHour} and ${th.spins} free special spins are played. Each Clock landing during these spins advances the clock one hour (up to XIII). The Final Countdown Spin follows: a guaranteed Relic Surge places a Relic block whose size depends on the hour reached (IX-XI: 2x2, XII: 3x3, XIII: 4x4). A guaranteed Relic Surge does not guarantee a win.</p>
  <h4>Blackout Spin</h4>
  <p>Sometimes the reels fade to darkness before a feature-triggering result is revealed. This is presentation only and never changes the result.</p>
</section>
<section>
  <h3>${sym('VK')} Three Keys to the Vault</h3>
  <p>3 Vault Keys anywhere award ${tk.spinsByKeys[3]} free spins and 4 Keys award ${tk.spinsByKeys[4]}. The triggering spin is paid first. The vault then chooses one of three bonus paths at random. Landing ${tk.retriggerKeys} or more Keys during free spins awards +${tk.retriggerSpins} spins, up to ${tk.maxSpins} spins in total.</p>
  <h4>Key One: Cursed Fortune</h4>
  <p>More Relics, with multipliers of ${uniq(RELIC_TABLES.cursedFortune.mult.map(([m]) => m))}. <b>Relic Overload:</b> every Relic and Ledger that lands adds 1 charge to the Relic Seal, and the charge lasts for the whole bonus. At ${ov.thresholds.join(', ')} charge, Relic Overload reaches levels 1, 2 and 3. Level 1: Relics expand to at least 2x2. Level 2: every new Relic's multiplier is increased by 2. Level 3: Relics expand to at least 3x3, and each Relic's multiplier is increased by 2 and then doubled. Order on each spin: charge is added, the level updates, Relics expand, then the grid is paid.</p>
  <h4>Key Two: Phantom Payday</h4>
  <p>More Phantoms. Each Phantom or Ledger that lands adds 1 to the Phantom Seal (levels at ${pp.sealThresholds.join(', ')}). On any spin with a Phantom, a Phantom Heist marks ${pp.baseMarks} + ${pp.marksPerPhantom} per Phantom + ${pp.marksPerLevel} per seal level low-symbol positions (up to ${pp.maxMarks}) and transforms them into one symbol. Higher seal levels favour higher-paying symbols; at level 3 the Phantom can create wilds with ${uniq(pp.wildMult.map(([m]) => m))} multipliers.</p>
  <h4>Key Three: Midnight Countdown</h4>
  <p>More Clocks. The clock starts at hour ${FEATURES.midnightCountdown.startHour}. Each Clock or Ledger advances it one hour. When it strikes XIII, a Final Countdown Spin is added: that spin starts with a guaranteed ${FEATURES.midnightCountdown.strikeSurgeSize}x${FEATURES.midnightCountdown.strikeSurgeSize} Relic Surge. The clock then resets to hour ${FEATURES.midnightCountdown.startHour}.</p>
</section>
<section>
  <h3>The Vault Breach</h3>
  <p>5 Vault Keys open The Vault Breach, a four-stage bonus with ${vb.hauntingSpins + vb.overloadSpins + 1} spins and no retriggers.</p>
  <ol>
    <li><b>The Seal Breaks:</b> the vault opens.</li>
    <li><b>The Haunting:</b> ${vb.hauntingSpins} spins, each with a Phantom Heist that transforms ${uniq(vb.hauntingMarks.map(([m]) => m)).replace(/x/g, '')} positions.</li>
    <li><b>Relic Overload:</b> ${vb.overloadSpins} spins starting at level ${ov.thresholds.filter((t) => vb.overloadStartCharge >= t).length} (${vb.overloadStartCharge} charge), with at least one Relic per spin.</li>
    <li><b>The Final Heist:</b> a ${vb.finalSurgeSize}x${vb.finalSurgeSize} Relic Surge, then a Lockdown in which reels showing Relics lock and the others respin ${vb.finalHeistRespins} times (new Relics lock their reel and reset the respins). The final grid is expanded and paid.</li>
  </ol>
</section>
<section>
  <h3>The Haunted Ledger</h3>
  <p>During bonus rounds the Ledger shows three seals with their real progress. Relic Seal: Relic Overload charge. Phantom Seal: Phantom Payday progress, or the positions transformed during The Haunting. Clock Seal: the hour hand in Midnight Countdown, or the current stage of The Vault Breach. Seals reset when the bonus ends.</p>
</section>
${opts.disabledBuy ? '' : `<section>
  <h3>Buy Bonus</h3>
  <p>Each bonus path can be bought directly. You choose the path; the vault does not choose for you. Every bought bonus starts with 3 Vault Keys and ${FEATURES.threeKeys.spinsByKeys[3]} free spins, with the normal retriggers.</p>
  <ul>${BUY_MODES.map((m) => `<li><b>${m.label}</b>: ${m.cost}x the bet. ${m.description}</li>`).join('')}</ul>
  <p>The Vault Breach cannot be bought; it opens only when 5 Vault Keys land in the base game.</p>
</section>`}
<section>
  <h3>Return to player and maximum win</h3>
  ${opts.math ? `<table class="paytable"><thead><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr></thead><tbody>${mathRows}</tbody></table>` : '<p>RTP information is not available in this build.</p>'}
  <p>The maximum win is ${(WINCAP / 100).toLocaleString('en-US')}x the bet in every mode. When a round reaches it, the round ends immediately and the maximum win is paid.</p>
</section>
<section>
  <h3>Controls</h3>
  <ul class="ui-guide">
    <li><b>Spin</b> (spacebar): place a bet and spin. While the reels spin, press again to show the result faster.</li>
    <li><b>- / +</b>: change the bet. Every bet level offered by the server is available.</li>
    <li><b>Autoplay</b>: play a chosen number of rounds after confirmation. It stops on a feature if selected, or when the balance is too low.</li>
    <li><b>Turbo</b>: faster animations. Wins and results stay readable.</li>
    <li><b>Sound</b>: mute or unmute. Music and effects can be set separately in Settings.</li>
    <li><b>Settings</b>: music, effects, reduced motion, turbo, random jump scares and the intro screen.</li>
    <li><b>Jump scares</b>: occasional random scares are cosmetic only. They are never linked to a result, never delay a round, and are off in turbo, with reduced motion, during features and in replay. You can turn them off in Settings.</li>
    <li><b>Info</b>: these rules.</li>
  </ul>
</section>
<section class="disclaimer">
  <h3>Disclaimer</h3>
  <p>Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and &copy; 2026 Stake Engine. Midnight Vault artwork and sound &copy; 2026 its developers.</p>
</section>`;
  localizeTree(container);
}
