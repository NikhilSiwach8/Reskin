// Production-build check: serves dist/ from a CDN-style sub-folder (as Stake Engine does),
// with the mock RGS from a Vite dev server behind /rgs, then plays the real build in
// headless Chromium: spins, both bonus buys through the Buy Feature dialog, rules panel.
// Fails on any 4xx/5xx or failed request, any page error, or a balance that does not settle.
//
//   npm run build && npm run check:build
import { createServer as createHttp, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const PREFIX = '/cdn/sugar-scream/1/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const vite = await createServer({ root: ROOT, server: { port: 5198, strictPort: true }, logLevel: 'error' });
await vite.listen();
const cdn = createHttp(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/rgs')) {
    const p = request({ host: 'localhost', port: 5198, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(p);
    return;
  }
  const rel = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) || 'index.html' : null;
  try {
    if (rel === null) throw new Error('outside the game folder');
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream' }).end(await readFile(join(DIST, rel)));
  } catch {
    res.writeHead(404).end();
  }
}).listen(5197);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const money = (s) => Number(s.replace(/[^0-9.-]/g, ''));
let failures = 0;

for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const problems = [];
  let lastRound = null;
  page.on('response', async (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
    if (r.url().includes('/rgs/wallet/play')) lastRound = (await r.json().catch(() => null))?.round ?? null;
  });
  page.on('requestfailed', (r) => problems.push(`failed ${r.url()}`));
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  await page.goto(`http://localhost:5197${PREFIX}index.html?sessionID=build-${Date.now()}&rgs_url=localhost:5197/rgs&lang=en&currency=USD`);
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 120000 });
  await page.evaluate(() => document.querySelector('#intro-go')?.click());
  await page.click('#btn-turbo', { force: true });
  const settle = async (label) => {
    // dialogs (free-spin intro / outro) continue by themselves in turbo
    await page.waitForFunction(() => !document.querySelector('#btn-spin').classList.contains('spinning'), null, { timeout: 300000, polling: 300 })
      .catch(() => problems.push(`${label}: round did not finish`));
    await page.waitForTimeout(300);
  };
  // the spin and buy buttons animate continuously, so clicks must not wait for them to be "stable"
  const tap = (sel) => page.click(sel, { force: true });
  const play = async (label, start) => {
    const before = money(await page.textContent('#meter-balance .meter-value'));
    lastRound = null;
    await start();
    await settle(label);
    const after = money(await page.textContent('#meter-balance .meter-value'));
    const r = lastRound;
    if (!r) return problems.push(`${label}: no round`);
    const expected = +(before - (r.amount / 1e6) * r.costMultiplier + (r.amount / 1e6) * r.payoutMultiplier).toFixed(2);
    if (Math.abs(after - expected) > 0.005) problems.push(`${label}: balance ${after}, expected ${expected}`);
    console.log(`  ${label.padEnd(16)} ${r.mode.padEnd(8)} payout ${r.payoutMultiplier}x  balance ${before} -> ${after}`);
  };
  console.log(`${viewport.width}x${viewport.height}`);
  for (let i = 1; i <= 4; i++) await play(`spin ${i}`, () => tap('#btn-spin'));
  for (const [n, label] of [[1, 'buy cauldron'], [2, 'buy full moon'], [3, 'buy loot box']]) {
    await play(label, async () => {
      await tap('#btn-buy');
      await tap(`#buy-options .buy-option:nth-child(${n}) button`);
      await tap('#confirm-yes');
    });
  }
  await page.click('#btn-menu', { force: true });
  await page.click('#btn-rules', { force: true });
  await page.waitForTimeout(500);
  if (!(await page.textContent('#rules-body')).includes('96.00%')) problems.push('rules panel shows no RTP');
  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${viewport.width}x${viewport.height}${ok ? '' : `\n  ${[...new Set(problems)].join('\n  ')}`}`);
  await page.close();
}

await browser.close();
cdn.close();
await vite.close();
console.log(failures ? `${failures} viewport(s) failed` : 'production build OK');
process.exit(failures ? 1 : 0);
