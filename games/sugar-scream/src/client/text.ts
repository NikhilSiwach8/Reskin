// UI text. English is the only shipped language (Stake Engine requires `en`); other `lang`
// values fall back to English without breaking layout. In social mode (stake.us) every
// string passes through the restricted-phrase replacements from the Stake guidelines.

const SOCIAL_REPLACEMENTS: [RegExp, string][] = [
  ['place your bets', 'come and play'],
  ['at the cost of', 'for'],
  ['cost of', 'can be played for'],
  ['buy bonus', 'get bonus'],
  ['bonus buy', 'bonus feature'],
  ['total bet', 'total play'],
  ['win feature', 'play feature'],
  ['loss limit', 'stop limit'],
  ['loss streak', 'miss streak'],
  ['pay table', 'win table'],
  ['paytable', 'win table'],
  ['paid out', 'won'],
  ['pays out', 'win'],
  ['pay out', 'win'],
  ['betting', 'playing'],
  ['bets', 'plays'],
  ['bet', 'play'],
  ['bought', 'instantly triggered'],
  ['purchase', 'play'],
  ['buy', 'play'],
  ['cash', 'coins'],
  ['credit', 'coins'],
  ['currency', 'token'],
  ['deposit', 'get coins'],
  ['gamble', 'play'],
  ['money', 'coins'],
  ['paid', 'won'],
  ['payer', 'winner'],
  ['pays', 'wins'],
  ['pay', 'win'],
  ['profit', 'net gain'],
  ['rebet', 'respin'],
  ['stake', 'play amount'],
  ['wager', 'play'],
  ['withdraw', 'redeem'],
].map(([from, to]) => [new RegExp(`\\b${from}\\b`, 'gi'), to] as [RegExp, string]);

let social = false;

export function setSocial(on: boolean): void {
  social = on;
}

export function isSocial(): boolean {
  return social;
}

function matchCase(src: string, out: string): string {
  if (src === src.toUpperCase()) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
  return out;
}

/** Applies social-mode replacements when active. */
export function t(text: string): string {
  if (!social) return text;
  let out = text;
  for (const [re, to] of SOCIAL_REPLACEMENTS) out = out.replace(re, (m) => matchCase(m, to));
  return out;
}

/** Applies t() to every text node under an element (used for generated rules). */
export function localizeTree(root: HTMLElement): void {
  if (!social) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = t(n.nodeValue ?? '');
  root.querySelectorAll<HTMLElement>('[aria-label],[title]').forEach((el) => {
    for (const a of ['aria-label', 'title']) if (el.hasAttribute(a)) el.setAttribute(a, t(el.getAttribute(a)!));
  });
}

export const FEATURE_NAMES: Record<string, string> = {
  lockdown: 'Lockdown Spin',
  phantomHeist: 'Phantom Heist',
  spectralRespin: 'Spectral Respin',
  thirteenthHour: 'The Thirteenth Hour',
  threeKeys: 'Three Keys to the Vault',
  vaultBreach: 'The Vault Breach',
  cursedFortune: 'Cursed Fortune',
  phantomPayday: 'Phantom Payday',
  midnightCountdown: 'Midnight Countdown',
};
