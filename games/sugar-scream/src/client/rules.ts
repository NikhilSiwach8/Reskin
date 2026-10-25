// Game rules and paytable, generated from the engine config so they always match the math.
import {
  BET_MODES, CAULDRON_SCATTERS, DOORS, FREE_SPINS, FULL_MOON_SCATTERS, KNOCKS, KNOCK_TABLE, MIN_CLUSTER, MULT_VALUES,
  PAYING, RETRIGGER_SCATTERS, RETRIGGER_SPINS, SCATTER_PAYS, SYMBOLS, TRICK_OR_TREAT_SCATTERS, WINCAP,
} from '../engine/config.ts';
import { localizeTree } from './text.ts';

export interface MathSummary {
  modes: { mode: string; cost: number; rtp: number; maxWin: number; maxWinProbability: number; hitRate: number }[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildRules(root: HTMLElement, o: { math?: MathSummary; fmt: (centi: number) => string; disabledBuy: boolean }): void {
  const pays = PAYING.map((id) => {
    const p = SYMBOLS[id].pays!;
    return `<div class="paycell"><img src="assets/sym_${id}.svg" alt=""><div><b>${esc(SYMBOLS[id].name)}</b><br>12+ ${o.fmt(p[2])}<br>10-11 ${o.fmt(p[1])}<br>8-9 ${o.fmt(p[0])}</div></div>`;
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
    <p><img src="assets/sym_SC.svg" alt=""> Scatter. Counted anywhere on the board after the base-game tumbles end. 4 pay ${o.fmt(SCATTER_PAYS[4])}, 5 pay ${o.fmt(SCATTER_PAYS[5])}, 6 or more pay ${o.fmt(SCATTER_PAYS[6])}.</p>
    <h3>Witch's Spell</h3>
    <p>On any base-game spin the Witch can fly over the board before it is evaluated. Her spell turns several candies into one paying candy, always making at least ${MIN_CLUSTER} of it, so the spin always wins.</p>
    <h3>Trick or Treat</h3>
    <p>Exactly ${TRICK_OR_TREAT_SCATTERS} Skull Lollipops after the base-game tumbles start Trick or Treat. Knock on up to ${KNOCKS} of ${DOORS} doors. Each door hides a <b>Treat</b> (${treats}), a <b>Trick</b> (nothing), or the <b>Golden Lollipop</b>, which ends the knocking and awards ${FREE_SPINS.cauldron.spins} Haunted Cauldron free spins. Treats are kept. The prizes are decided when the round starts; the door you choose only decides where each prize is shown. In autoplay the doors open automatically.</p>
    <h3>Haunted Cauldron free spins</h3>
    <p><img src="assets/sym_SC.svg" alt=""> ${CAULDRON_SCATTERS} Skull Lollipops award ${FREE_SPINS.cauldron.spins} free spins.</p>
    <p><img src="assets/sym_JK.svg" alt=""> During free spins Jack-o'-Lanterns can land, each carrying a multiplier (${mults}). They stay through the tumbles. When a free spin's tumbles end with a win, the spin's total win is multiplied by the sum of its Jack-o'-Lanterns <b>plus the Cauldron</b>. Then those Jack-o'-Lanterns are poured into the Cauldron, which keeps growing until the feature ends. Jack-o'-Lanterns on a spin without a win are lost.</p>
    <p>${RETRIGGER_SCATTERS} or more Skull Lollipops during free spins award ${RETRIGGER_SPINS} more free spins.</p>
    <h3>Full Moon free spins</h3>
    <p>${FULL_MOON_SCATTERS} or more Skull Lollipops award ${FREE_SPINS.fullMoon.spins} Full Moon free spins. They play like Haunted Cauldron, but the Cauldron starts at x${FREE_SPINS.fullMoon.cauldron}, Jack-o'-Lanterns land more often and each one adds <b>${FREE_SPINS.fullMoon.pour}x</b> its value to the Cauldron.</p>
    ${o.disabledBuy ? '' : '<h3>Ante Bet and Buy Feature</h3>'}
    ${modes.filter((m) => m.name !== 'base').map((m) => `<p><b>${esc(m.label)} (${m.cost}x bet):</b> ${esc(m.description)}</p>`).join('')}
    <h3>Return to player</h3>
    <table><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr>${modeRows}</table>
    ${o.math ? '' : '<p>RTP information is not available.</p>'}
    <p>The maximum win is ${(WINCAP / 100).toLocaleString('en-US')}x the bet per round. When a round reaches it, the round ends immediately and the win is paid.</p>
    <h3>Controls</h3>
    <p>Spin with the spin button or the spacebar. Pressing spin during a round speeds up the animations (slam stop). Turbo plays rounds faster. Autoplay asks for confirmation and can stop when a feature triggers. Sound and music can be switched off in Settings or with the speaker button.</p>
    <p>Malfunction voids all pays and plays. All results are decided by the server when the round starts; animations do not affect them. Unfinished rounds are resumed when the game is reloaded.</p>
  `;
  localizeTree(root);
}
