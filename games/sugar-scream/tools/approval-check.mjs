// Stake Engine approval checklist, automated against the local mock RGS.
// Covers every checklist item that can be tested in a browser; items that need the Stake
// dashboard, the real RGS or a person (thumbnail, Slack, device lab) are listed as manual.
//
//   npm run math:dev          # once, to create math-output/dev
//   npm run check:approval
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 5192;
const RGS = `localhost:${PORT}/rgs`;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

const results = [];
const check = (group, name, ok, detail = '') => {
  results.push({ group, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? ` — ${detail}` : ''}`);
};
const money = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));
let n = 0;

/** Opens the game; resolves once loading has finished (or failed). */
async function open(params = {}, viewport = { width: 1280, height: 720 }, { intro = true } = {}) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width < 900 });
  page.errors = [];
  page.requests = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => r.url().includes('/rgs/') && page.requests.push(r.url().replace(/^.*\/rgs/, '')));
  // play the pick bonuses like a player
  await page.addInitScript(() => setInterval(() => {
    document.querySelector('#loot:not(.hidden) .loot-box:not(:disabled)')?.click();
    document.querySelector('#tot:not(.hidden) .door:not(:disabled)')?.click();
  }, 500));
  const q = new URLSearchParams({ sessionID: `appr-${Date.now()}-${n++}`, rgs_url: RGS, lang: 'en', currency: 'USD', ...params });
  for (const [k, v] of Object.entries(params)) if (v === null) q.delete(k);
  await page.goto(`http://localhost:${PORT}/?${q}`);
  await page.waitForFunction(() => {
    const l = document.querySelector('#loading');
    return !l || l.classList.contains('hidden') || /error|failed|missing|problem|unavailable/i.test(l.textContent ?? '');
  }, null, { timeout: 120000, polling: 200 });
  // the intro splash follows a successful authenticate; dismiss it once it is up
  if (intro && (await page.isHidden('#loading'))) {
    await page.waitForSelector('#intro', { state: 'visible', timeout: 15000 }).then(() => page.click('#intro-go', { force: true })).catch(() => {});
    await page.waitForSelector('#intro', { state: 'hidden', timeout: 5000 }).catch(() => {});
    // the slot intro clip follows Start: tap it away like a player
    await page.waitForSelector('#clip:not(.hidden)', { timeout: 6000 }).then(() => page.dispatchEvent('#clip', 'pointerdown')).catch(() => {});
    await page.waitForSelector('#clip', { state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  return page;
}
const idle = (page) => page.waitForFunction(() => !document.querySelector('#btn-spin').classList.contains('spinning'), null, { timeout: 600000, polling: 300 });
const text = (page, sel) => page.textContent(sel).then((s) => (s ?? '').trim());
const visibleText = (page) => page.evaluate(() => {
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const el = t.parentElement;
    if (!el || el.closest('#dev-harness')) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0 || el.closest('.hidden')) continue;
    if (t.nodeValue.trim()) out.push(t.nodeValue.trim());
  }
  return out.join(' | ');
});

// ------------------------------------------------------------------ PreChecks
{
  const page = await open();
  check('PreChecks', 'Authenticates with the RGS on launch', page.requests.includes('/wallet/authenticate') && (await page.isHidden('#loading')) && money(await text(page, '#meter-balance .meter-value')) === 1000);
  await page.click('#btn-spin', { force: true });
  await idle(page);
  check('PreChecks', 'Spin sends a successful play request', page.requests.includes('/wallet/play'), page.requests.join(' '));
  const html = await page.content();
  check('PreChecks', 'No Stake Engine loader in the game', !/stake[ -]?engine[ -]?loader|stake-loader/i.test(html));
  check('PreChecks', 'No page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}
{
  const page = await open({ rgs_url: 'rgs.invalid.example' }, undefined, { intro: false });
  const msg = await text(page, '#loading');
  check('PreChecks', 'Authentication fails cleanly with an invalid rgs_url', /connection|problem|failed/i.test(msg) && page.errors.length === 0, msg.slice(-80));
  await page.close();
}

// ------------------------------------------------------------------ Bet levels
{
  const page = await open();
  const levels = await page.evaluate(() => Number(document.querySelector('#bp-slider').max) + 1);
  check('Bet levels', 'Uses every bet level from authenticate (14 in the mock) and its default (1.00)', levels === 14 && money(await text(page, '#meter-bet .meter-value')) === 1);
  for (let i = 0; i < 20; i++) await page.click('#bet-minus', { force: true });
  const min = money(await text(page, '#meter-bet .meter-value'));
  for (let i = 0; i < 20; i++) await page.click('#bet-plus', { force: true });
  const max = money(await text(page, '#meter-bet .meter-value'));
  check('Bet levels', 'Min and max bet come from authenticate (0.10 to 100.00)', min === 0.1 && max === 100, `${min} .. ${max}`);
  await page.close();
}
{
  // Active round restore: play a winning round straight through the API, then load the game.
  const sessionID = `appr-resume-${Date.now()}`;
  const api = await browser.newPage();
  await api.goto(`http://localhost:${PORT}/`);
  const played = await api.evaluate(async ({ rgs, sessionID }) => {
    const post = (p, b) => fetch(`http://${rgs}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionID, ...b }) }).then((r) => r.json());
    await post('/wallet/authenticate', { language: 'en' });
    for (let i = 0; i < 60; i++) {
      const r = await post('/wallet/play', { amount: 2_000_000, mode: 'base' });
      if (r.round?.active) return r.round.payoutMultiplier;
    }
    return 0;
  }, { rgs: RGS, sessionID });
  await api.close();
  const page = await open({ sessionID });
  await page.waitForTimeout(800);
  const betShown = money(await text(page, '#meter-bet .meter-value'));
  await idle(page);
  check('Bet levels', 'An active round resumes at its own bet (2.00, default is 1.00) and is settled', played > 0 && betShown === 2 && page.requests.includes('/wallet/end-round'), `payout ${played}x, bet shown ${betShown}`);
  await page.close();
}

// ------------------------------------------------------------------ Currency
for (const [cur, expect, social] of [['USD', /^\$1,000\.00$/], ['EUR', /^€1,000\.00$/], ['JPY', /^¥1,000$/], ['XSC', /^1,000\.00 SC$/, true], ['XGC', /^1,000\.00 GC$/, true]]) {
  const page = await open({ sessionID: `appr-cur-${cur}-${Date.now()}`, currency: cur });
  const bal = await text(page, '#meter-balance .meter-value');
  check('Currency', `${cur} balance shows as ${bal}`, expect.test(bal) && (!social || !bal.includes('$')));
  await page.close();
}
{
  const page = await open();
  for (let i = 0; i < 20; i++) await page.click('#bet-minus', { force: true }); // 0.10 bet
  await page.click('#btn-menu', { force: true });
  await page.click('#btn-rules', { force: true });
  await page.waitForTimeout(300);
  const rules = await text(page, '#rules-body');
  // Candy Corn 8-9 pays 0.25x: 0.025 at a 0.10 bet must not round to 0.03
  check('Currency', 'Sub-cent payouts are shown exactly ($0.025 at a $0.10 bet)', rules.includes('$0.025'));
  await page.close();
}

// ------------------------------------------------------------------ RGS requests
{
  const page = await open();
  let zero = false;
  let zeroEnded = false;
  for (let i = 0; i < 12 && !zero; i++) {
    const before = page.requests.length;
    const resp = page.waitForResponse((r) => r.url().includes('/wallet/play'));
    await page.click('#btn-spin', { force: true });
    const round = (await (await resp).json()).round;
    await idle(page);
    await page.waitForTimeout(300);
    if (round.payoutMultiplier === 0) {
      zero = true;
      zeroEnded = page.requests.slice(before).includes('/wallet/end-round');
    }
  }
  check('RGS requests', 'Zero-win rounds send no end-round', zero && !zeroEnded);
  for (let i = 0; i < 20; i++) await page.click('#bet-plus', { force: true }); // 100.00 bet: Full Moon costs 30,000
  await page.click('#btn-buy', { force: true });
  await page.waitForTimeout(600);
  const plays = page.requests.filter((r) => r === '/wallet/play').length;
  const disabled = await page.isDisabled('#buy-options .buy-option:nth-child(2) button');
  await page.click('#buy-options .buy-option:nth-child(2) button', { force: true });
  await page.waitForTimeout(800);
  const confirmOpen = await page.isVisible('#modal-confirm');
  check('RGS requests', 'A bet above the balance sends no play request', disabled && !confirmOpen && page.requests.filter((r) => r === '/wallet/play').length === plays);
  await page.close();
}

// ------------------------------------------------------------------ Frontend
{
  const page = await open();
  const plays = () => page.requests.filter((r) => r === '/wallet/play').length;
  const before = plays();
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  await idle(page);
  check('Frontend', 'Spacebar spins', plays() === before + 1);
  await page.mouse.wheel(0, 2000);
  await page.keyboard.press('PageDown');
  const scroll = await page.evaluate(() => ({ y: scrollY, x: scrollX, h: document.documentElement.scrollHeight - innerHeight, w: document.documentElement.scrollWidth - innerWidth }));
  check('Frontend', 'The game frame does not scroll', scroll.y === 0 && scroll.x === 0 && scroll.h <= 0 && scroll.w <= 0, JSON.stringify(scroll));
  const vp = await page.getAttribute('meta[name=viewport]', 'content');
  const touch = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  check('Responsive', 'Double-tap zoom is disabled (viewport + touch-action)', /user-scalable=no/.test(vp) && /maximum-scale=1/.test(vp) && touch === 'manipulation', `${touch}`);
  // Game rules
  await page.click('#btn-menu', { force: true });
  await page.click('#btn-rules', { force: true });
  await page.waitForTimeout(300);
  const r = await text(page, '#rules-body');
  const rows = [
    ['RTP and max win are stated', /96\.00%/.test(r) && /5,000x/.test(r)],
    ['Payout per symbol (all 9 paying symbols)', ['Bleeding Heart', "Witch's Potion", 'Slime Drop', 'Ghost Marshmallow', 'Poison Apple', 'Eyeball Gumball', 'Pumpkin Bonbon', 'Gummy Bat', 'Candy Corn'].every((s) => r.includes(s))],
    ['Win combinations (8-9, 10-11, 12+ anywhere)', /12\+/.test(r) && /10-11/.test(r) && /8-9/.test(r) && /anywhere/.test(r)],
    ['Every mode has a description and cost', /Ante Bet \(1\.25x bet\)/.test(r) && /\(100x bet\)/.test(r) && /\(300x bet\)/.test(r) && /\(92x bet\)/.test(r)],
    ['Free spins and retrigger conditions', /award 10 free spins/.test(r) && /more free spins/.test(r) && /Full Moon free spins/.test(r)],
    ['General disclaimer', /Malfunction voids all pays and plays/.test(r)],
    ['User interaction guide', /How to play/.test(r) && /Spacebar|spacebar/.test(r) && /Autoplay/.test(r)],
  ];
  for (const [name, ok] of rows) check('Game rules', name, ok);
  await page.click('#modal-rules .modal-close', { force: true });
  // Autoplay confirmation
  await page.click('#btn-auto', { force: true });
  const startDisabled = await page.isDisabled('#auto-start');
  const p0 = plays();
  await page.click('#auto-counts button', { force: true });
  await page.waitForTimeout(400);
  check('Auto play', 'Autoplay needs a round count and Start to confirm', (await page.isVisible('#modal-auto')) && startDisabled && plays() === p0);
  await page.click('#modal-auto .modal-close', { force: true });
  // High cost modes: buying asks for confirmation
  await page.click('#btn-buy', { force: true });
  await page.waitForFunction(() => [...document.querySelectorAll('#buy-cards .buy-card')].every((c) => c.getAnimations().every((a) => a.playState !== 'running')), null, { timeout: 5000, polling: 50 });
  await page.click('#buy-options .buy-option:nth-child(1) button', { force: true });
  await page.waitForTimeout(300);
  const confirm = await page.isVisible('#modal-confirm');
  const confirmText = await text(page, '#confirm-text');
  await page.click('#confirm-no', { force: true });
  check('Auto play', 'Feature buys ask for confirmation, showing the cost', confirm && /100x/.test(confirmText) && plays() === p0, confirmText);
  // Sound
  const before2 = await page.getAttribute('#btn-sound', 'aria-label');
  await page.click('#btn-sound', { force: true });
  const after2 = await page.getAttribute('#btn-sound', 'aria-label');
  check('Sounds', 'Sound can be switched off', before2 === 'Mute' && after2 === 'Unmute');
  check('Frontend', 'No page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

// ------------------------------------------------------------------ Responsive (layout fits, no overlap)
for (const [label, vp] of [['Desktop', { width: 1920, height: 1080 }], ['Laptop', { width: 1366, height: 768 }], ['Popout S', { width: 400, height: 225 }], ['Popout L', { width: 800, height: 450 }], ['Mobile portrait', { width: 390, height: 844 }], ['Mobile landscape', { width: 844, height: 390 }]]) {
  const page = await open({}, vp);
  await page.click('#btn-spin', { force: true });
  await idle(page);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const s of ['#btn-spin', '#btn-buy', '#meter-balance', '#meter-bet', '#meter-win', '#btn-sound', '#btn-menu']) {
      const r = document.querySelector(s)?.getBoundingClientRect();
      if (!r || r.width === 0) out.push(`${s} missing`);
      else if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(`${s} off screen`);
    }
    return out;
  });
  check('Responsive', `${label} ${vp.width}x${vp.height}: controls on screen, round plays`, bad.length === 0 && page.errors.length === 0, bad.join(', '));
  await page.close();
}

// ------------------------------------------------------------------ Languages
for (const lang of ['en', 'de', 'xx', '%%%', '']) {
  const page = await open({ lang });
  check('Languages', `lang=${JSON.stringify(lang)} loads and plays`, (await page.isHidden('#loading')) && page.errors.length === 0);
  await page.close();
}

// ------------------------------------------------------------------ Social (stake.us)
const RESTRICTED = /\b(buy|bought|purchase|bets?|betting|wager|gamble|cash|money|deposit|withdraw|pays?|paid|payout|credit|currency|stake|rebet|profit)\b/i;
for (const [label, params] of [['social=true', { social: 'true' }], ['XSC currency', { sessionID: `appr-cur-XSC-${Date.now()}`, currency: 'XSC' }]]) {
  const page = await open(params);
  const texts = [await visibleText(page)];
  await page.click('#btn-buy', { force: true });
  await page.waitForTimeout(600);
  texts.push(await visibleText(page));
  await page.click('#modal-buy .modal-close', { force: true });
  await page.click('#btn-menu', { force: true });
  await page.click('#btn-rules', { force: true });
  await page.waitForTimeout(300);
  texts.push(await text(page, '#rules-body'));
  const hits = texts.join(' ').match(new RegExp(RESTRICTED, 'gi')) ?? [];
  check('Stake.US', `${label}: no restricted words in the game, Bonus Games and rules`, hits.length === 0, [...new Set(hits)].join(', '));
  await page.close();
}

// ------------------------------------------------------------------ Replay
const csv = readFileSync('math-output/dev/lookUpTable_bonus_0.csv', 'utf8').trim().split('\n').map((l) => l.split(',').map(Number));
const replayId = csv.find(([, w, p]) => w > 0 && p > 0)[0];
for (const [label, vp, params] of [
  ['Replay', { width: 1280, height: 720 }, { amount: '2000000', currency: 'EUR', lang: 'de' }],
  ['Replay Popout S', { width: 400, height: 225 }, {}],
  ['Replay social', { width: 390, height: 844 }, { social: 'true', currency: 'XSC' }],
]) {
  const page = await open({ replay: 'true', game: 'sugar-scream', version: '1', mode: 'bonus', event: String(replayId), sessionID: null, ...params }, vp, { intro: false });
  await page.waitForSelector('#btn-replay:not([disabled])', { timeout: 30000 });
  const info = await text(page, '#replay-info');
  const cur = params.currency === 'EUR' ? '€' : params.currency === 'XSC' ? 'SC' : '$';
  const amount = params.amount ? 2 : 1;
  const infoOk = info.includes(`${cur === '$' ? '$' : cur === '€' ? '€' : ''}${amount}`) && /100x =/.test(info) && /\dx/.test(info);
  await page.click('#btn-replay', { force: true });
  await page.waitForFunction(() => /again/i.test(document.querySelector('#btn-replay').textContent) && !document.querySelector('#btn-replay').disabled, null, { timeout: 600000, polling: 300 });
  const win1 = await text(page, '#meter-win .meter-value');
  await page.click('#btn-replay', { force: true });
  await page.waitForFunction(() => /again/i.test(document.querySelector('#btn-replay').textContent) && !document.querySelector('#btn-replay').disabled, null, { timeout: 600000, polling: 300 });
  const win2 = await text(page, '#meter-win .meter-value');
  const soundVisible = await page.isVisible('#btn-sound');
  const noWallet = !page.requests.some((r) => r.startsWith('/wallet/'));
  let restricted = [];
  if (params.social) restricted = (await visibleText(page)).match(new RegExp(RESTRICTED, 'gi')) ?? [];
  check('Replay', `${label} ${vp.width}x${vp.height}: shows bet, cost and multiplier; plays, plays again, sound switch, no wallet calls`,
    infoOk && win1 === win2 && win1 !== '–' && soundVisible && noWallet && restricted.length === 0 && page.errors.length === 0,
    `${info.replace(/\s+/g, ' ')} | win ${win1}${restricted.length ? ` | restricted: ${restricted.join(',')}` : ''}${page.errors.length ? ` | ${page.errors.join(' | ')}` : ''}`);
  await page.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} automated checks passed`);
process.exit(failed.length ? 1 : 0);
