// Development-only test harness (stripped from production builds).
// Each button asks the local mock RGS for a real book from the generated set that matches a
// scenario. The round goes through the normal play -> validate -> present -> end-round path,
// so the harness never bypasses outcome validation or balance handling.

import type { ModeName } from '../../engine/round.ts';
import type { RgsClient, RgsRound } from '../rgs.ts';

const SCENARIOS: [string, ModeName, string][] = [
  ['Loss', 'base', 'loss'],
  ['Win', 'base', 'win'],
  ['3+ tumbles', 'base', 'tumble'],
  ['Big win', 'base', 'bigwin'],
  ["Witch's Spell", 'base', 'witchSpell'],
  ['Trick or Treat', 'base', 'trickOrTreat'],
  ['Golden Lollipop', 'base', 'goldenLollipop'],
  ['Cauldron (base)', 'base', 'cauldron'],
  ['Full Moon (base)', 'ante', 'fullMoon'],
  ['Retrigger', 'bonus', 'retrigger'],
  ['Buy Cauldron', 'bonus', 'cauldron'],
  ['Buy Full Moon', 'fullmoon', 'fullMoon'],
  ['Max win', 'fullmoon', 'wincap'],
  ['Loot Box (base)', 'base', 'lootBox'],
  ['Buy Loot Box', 'lootbox', 'lootBox'],
  ['Loot Box max', 'lootbox', 'lootMax'],
];

type Request = (rgs: RgsClient, amount: number, mode: string) => Promise<{ balance: { amount: number; currency: string }; round: RgsRound }>;

const force = (scenario: string): Request => (rgs, amount, mode) =>
  rgs.request('POST', '/dev/force', { sessionID: rgs.sessionID, amount, mode, scenario });

export function mountHarness(run: (mode: ModeName, request: Request) => Promise<void>): void {
  const panel = document.createElement('details');
  panel.id = 'dev-harness';
  panel.innerHTML = `<summary>DEV</summary><div class="dev-grid">${SCENARIOS.map(([label, mode, s]) => `<button data-mode="${mode}" data-s="${s}">${label}</button>`).join('')}</div>`;
  Object.assign(panel.style, {
    position: 'fixed', top: '8px', right: '8px', zIndex: '60', background: 'rgba(0,0,0,.8)', color: '#7DFFA8',
    border: '1px solid #7DFFA8', borderRadius: '8px', padding: '4px 8px', font: '12px monospace', maxWidth: '240px',
  });
  const style = document.createElement('style');
  style.textContent = '#dev-harness .dev-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}#dev-harness button{background:#20152F;color:#E8E1CF;border:1px solid #9D66FF;border-radius:4px;padding:4px;font:11px monospace}';
  document.head.appendChild(style);
  panel.querySelectorAll<HTMLButtonElement>('button[data-s]').forEach((b) => b.addEventListener('click', () => void run(b.dataset.mode as ModeName, force(b.dataset.s!))));
  document.body.appendChild(panel);
}
