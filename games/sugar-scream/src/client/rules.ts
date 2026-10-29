// Game rules and paytable, generated from the engine config so they always match the math.
import {
  BET_MODES, CAULDRON_SCATTERS, LOOT_BOXES, LOOT_CHANCE, LOOT_TABLE, LOOT_TIERS, DOORS, FREE_SPINS, FULL_MOON_SCATTERS, KNOCKS, KNOCK_TABLE, MIN_CLUSTER, MULT_VALUES,
  PAYING, RETRIGGER_SCATTERS, RETRIGGER_SPINS, SCATTER_PAYS, SYMBOLS, TRICK_OR_TREAT_SCATTERS, WINCAP,
} from '../engine/config.ts';
import { symbolSrc } from './assets.ts';
import { localizeTree } from './text.ts';

export interface MathSummary {
  modes: { mode: string; cost: number; rtp: number; maxWin: number; maxWinProbability: number; hitRate: number }[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildRules(root: HTMLElement, o: { math?: MathSummary; fmt: (centi: number) => string; disabledBuy: boolean }): void {
  const pays = PAYING.map((id) => {
    const p = SYMBOLS[id].pays!;
    return `<div class="paycell"><img src="${symbolSrc(id)}" alt=""><div><b>${esc(SYMBOLS[id].name)}</b><br>12+ ${o.fmt(p[2])}<br>10-11 ${o.fmt(p[1])}<br>8-9 ${o.fmt(p[0])}</div></div>`;
  }).join('');
  const treats = KNOCK_TABLE.filter(([v]) => typeof v === 'number').map(([v]) => o.fmt(v as number)).join(', ');
  const mults = MULT_VALUES.map(([v]) => `x${v}`).join(', ');
  // Ante Bet follows the buy-feature flag too.
  const modes = BET_MODES.filter((m) => m.name === 'base' || !o.disabledBuy);
  const modeRows = modes.map((m) => {
    const s = o.math?.modes.find((x) => x.mode === m.name);
    return `<tr><td>${esc(m.label)}</td><td>${m.cost}x</td><td>${s ? `${(s.rtp * 100).toFixed(2)}%` : '–'}</td><td>${s ? `${s.maxWin.toLocaleString('en-US')}x` : '–'}</td></tr>`;
  }).join('');
  root.innerHTML = `
    <h3>How to win</h3>
    <p>Sugar Scream is played on 6 reels and 5 rows. There are no paylines: ${MIN_CLUSTER} or more matching candies anywhere on the screen win. Wins are multiplied by the bet.</p>
    <p><b>Tumble:</b> after every win the winning candies burst, the candies above fall down and new ones drop in from the top. Tumbling continues as long as new wins appear. All tumble wins are added together.</p>
    <h3>Paytable</h3>
    <p>Values shown for the current bet.</p>
    <div class="paygrid">${pays}</div>
    <h3>Skull Lollipop</h3>
    <p><img src="${symbolSrc('SC')}" alt=""> Scatter. Counted anywhere on the board after the base-game tumbles end. 4 pay ${o.fmt(SCATTER_PAYS[4])}, 5 pay ${o.fmt(SCATTER_PAYS[5])}, 6 or more pay ${o.fmt(SCATTER_PAYS[6])}.</p>
    <h3>Witch's Spell</h3>
    <p>On any base-game spin the Witch can fly over the board before it is evaluated. Her spell turns several candies into one paying candy, always making at least ${MIN_CLUSTER} of it, so the spin always wins.</p>
    <h3>Trick or Treat</h3>
    <p>Exactly ${TRICK_OR_TREAT_SCATTERS} Skull Lollipops after the base-game tumbles start Trick or Treat. Knock on up to ${KNOCKS} of ${DOORS} doors. Each door hides a <b>Treat</b> (${treats}), a <b>Trick</b> (nothing), or the <b>Golden Lollipop</b>, which ends the knocking and awards ${FREE_SPINS.cauldron.spins} Haunted Cauldron free spins. Treats are kept. The prizes are decided when the round starts; the door you choose only decides where each prize is shown. You always choose the doors yourself, in autoplay too (autoplay waits for you); only replays open them automatically.</p>
    <h3>Loot Box</h3>
    <p>On any base-game spin that triggers no other feature, a Loot Box can drop (about 1 in ${Math.round(1 / LOOT_CHANCE).toLocaleString('en-US')} spins). Pick one of ${LOOT_BOXES} boxes to win one of these prizes, a whole-number multiple of the bet in the range shown:</p>
    <table><tr><th>Prize</th><th>Multiplier</th><th>Chance</th></tr>${LOOT_TABLE.map(([tier, w]) => {
      const t = LOOT_TIERS[tier];
      const total = LOOT_TABLE.reduce((sum, [, x]) => sum + x, 0);
      return `<tr><td>${esc(t.name)}</td><td>${t.min === t.max ? `${t.min.toLocaleString('en-US')}x` : `${t.min}x to ${t.max.toLocaleString('en-US')}x`}</td><td>${((w / total) * 100).toFixed(1)}%</td></tr>`;
    }).join('')}</table>
    <p>The prize is decided when the round starts; the box you pick only decides where it is shown. You always pick the box yourself, in autoplay too; only replays open one automatically. Wins are capped at the maximum win.</p>
    <h3>Haunted Cauldron free spins</h3>
    <p><img src="${symbolSrc('SC')}" alt=""> ${CAULDRON_SCATTERS} Skull Lollipops award ${FREE_SPINS.cauldron.spins} free spins.</p>
    <p><img src="${symbolSrc('JK')}" alt=""> During free spins Jack-o'-Lanterns can land, each carrying a multiplier (${mults}). They stay through the tumbles. When a free spin's tumbles end with a win, the spin's total win is multiplied by the sum of its Jack-o'-Lanterns <b>plus the Cauldron</b>. Then those Jack-o'-Lanterns are poured into the Cauldron, which keeps growing until the feature ends. Jack-o'-Lanterns on a spin without a win are lost.</p>
    <p>${RETRIGGER_SCATTERS} or more Skull Lollipops during free spins award ${RETRIGGER_SPINS} more free spins.</p>
    <h3>Full Moon free spins</h3>
    <p>${FULL_MOON_SCATTERS} or more Skull Lollipops award ${FREE_SPINS.fullMoon.spins} Full Moon free spins. They play like Haunted Cauldron, but the Cauldron starts at x${FREE_SPINS.fullMoon.cauldron}, Jack-o'-Lanterns land more often and each one adds <b>${FREE_SPINS.fullMoon.pour}x</b> its value to the Cauldron.</p>
    ${o.disabledBuy ? '' : '<h3>Ante Bet and Buy Feature</h3>'}
    ${modes.filter((m) => m.name !== 'base').map((m) => `<p><b>${esc(m.label)} (${m.cost}x bet):</b> ${esc(m.description)}</p>`).join('')}
    <h3>Return to player</h3>
    <table><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr>${modeRows}</table>
    ${o.math ? '' : '<p>RTP information is not available.</p>'}
    <p>The maximum win is ${(WINCAP / 100).toLocaleString('en-US')}x the bet per round. When a round reaches it, the round ends immediately and the win is paid.</p>
    <h3>How to play</h3>
    <ul>
      <li><b>Bet:</b> choose your bet with − and + under the spin button (bottom right), or with the slider in Bonus Games. Your balance is shown bottom left.</li>
      <li><b>Spin:</b> press the big spin button or the spacebar. Pressing spin again during a round speeds up the animations (slam stop); the result does not change.</li>
      <li><b>Autoplay</b> (circular arrows): pick the number of rounds and press Start to confirm. It can stop when a feature triggers, and stops if your balance is too low. It waits for you to pick the Trick-or-Treat doors and the Loot Box. Press it again to stop.</li>
      <li><b>Turbo</b> (lightning): plays rounds faster. Loot Box and Trick-or-Treat picks still wait for you.</li>
      <li><b>Sound</b> (speaker): mutes or unmutes everything. Music and effects volumes are in the menu.</li>
      <li><b>Bonus</b> (bottom left): opens Bonus Games, where you can switch Ante Bet on or off and buy a feature. Every buy asks for confirmation.</li>
      <li><b>Menu</b> (☰): music and effects volume, reduced motion, the intro screen, jumpscares (an occasional fright after a losing spin, purely for show), vibration and these rules.</li>
      <li><b>Win screens and bonus entrances:</b> tap to skip to the amount or into the bonus, tap again to close.</li>
    </ul>
    <p>Malfunction voids all pays and plays. All results are decided by the server when the round starts; animations do not affect them. If the display ever differs from the server's result, the server's result is the one that counts and is paid. Unfinished rounds are resumed when the game is reloaded.</p>
  `;
  localizeTree(root);
}
