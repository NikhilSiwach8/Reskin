// End-to-end smoke test: starts the Vite dev server (with the mock RGS), plays scenarios in
// headless Chromium and checks that rounds settle exactly and the page logs no errors.
//
//   npm run math:dev   # once, to create math-output/dev
//   npm run test:e2e   # optional args: scenario names, e.g. "lockdown cursedFortune"
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');

const ALL = [
  ['base', 'loss'], ['base', 'win'], ['base', 'relic'], ['base', 'lockdown'], ['base', 'phantomHeist'],
  ['base', 'spectralRespin'], ['base', 'thirteenthHour'], ['cursed', 'cursedFortune'], ['phantom', 'phantomPayday'],
  ['midnight', 'midnightCountdown'], ['base', 'vaultBreach'], ['cursed', 'wincap'],
];
const wanted = process.argv.slice(2);
const scenarios = wanted.length ? ALL.filter(([, s]) => wanted.includes(s)) : ALL;
const VIEWPORTS = [{ width: 1600, height: 900 }, { width: 390, height: 844 }];

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const money = (s) => Number(s.replace(/[^0-9.-]/g, ''));
let failures = 0;

for (const [i, [mode, scenario]] of scenarios.entries()) {
  const viewport = VIEWPORTS[i % VIEWPORTS.length];
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let round = null;
  page.on('response', async (r) => {
    if (r.url().includes('/rgs/dev/force')) round = await r.json().catch(() => null);
  });
  await page.goto(`http://localhost:5199/?sessionID=smoke-${scenario}-${Date.now()}&rgs_url=localhost:5199/rgs&lang=en&currency=USD`);
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 120000 }); // the mock RGS loads every book set on first use
  // dismiss the intro splash
  await page.waitForSelector('#splash-intro', { state: 'visible', timeout: 10000 }).then(() => page.evaluate(() => document.querySelector('#splash-intro-go').click())).catch(() => {});
  // Turbo keeps long bonus rounds short; results must still settle identically.
  await page.evaluate(() => document.querySelector('#btn-turbo').click());
  const start = money(await page.textContent('#meter-balance .meter-value'));
  await page.click('#dev-harness summary');
  await page.click(`#dev-harness button[data-s="${scenario}"]`);
  await page.waitForFunction(() => !document.querySelector('#btn-spin').classList.contains('spinning'), null, { timeout: 240000, polling: 300 }).catch(() => errors.push('round did not finish in time'));
  await page.waitForTimeout(400);
  const end = money(await page.textContent('#meter-balance .meter-value'));
  const win = money(await page.textContent('#meter-win .meter-value'));
  const cost = round?.round?.costMultiplier ?? NaN;
  const payout = round?.round?.payoutMultiplier ?? NaN;
  const expected = +(start - cost + payout).toFixed(2);
  const ok = errors.length === 0 && Math.abs(end - expected) < 0.005 && Math.abs(win - payout) < 0.005;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${scenario.padEnd(18)} ${viewport.width}x${viewport.height} payout ${payout}x balance ${start} -> ${end} (expected ${expected})${errors.length ? `\n  errors: ${errors.join(' | ')}` : ''}`);
  await page.close();
}

await browser.close();
await server.close();
console.log(failures ? `${failures} scenario(s) failed` : 'all scenarios passed');
process.exit(failures ? 1 : 0);
