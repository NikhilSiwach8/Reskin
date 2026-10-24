// Renders the SVG art set to high-resolution PNG sources and runtime WebP files.
//
//   node tools/render-art.mjs            # everything
//   node tools/render-art.mjs sym_relic  # only names containing "sym_relic"
//
// Outputs:
//   art/svg/<name>.svg           editable vector source (committed)
//   art/render/<name>.png        full-resolution render (regenerated, git-ignored)
//   public/assets/<name>.webp    runtime asset (committed)
//   public/assets/symbols.webp + symbols.json   symbol atlas (Pixi spritesheet format)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ASSETS } from './art/index.mjs';

// Playwright is pre-installed globally in this environment; require() resolves it via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = { svg: join(root, 'art/svg'), render: join(root, 'art/render'), out: join(root, 'public/assets') };
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });

const filter = process.argv[2];
const entries = Object.entries(ASSETS).filter(([name]) => !filter || name.includes(filter));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, def] of entries) {
  const markup = def.build();
  writeFileSync(join(dirs.svg, `${name}.svg`), markup);
  const [w, h] = def.render;
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}" style="width:${w}px;height:${h}px;display:block"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  const png = join(dirs.render, `${name}.png`);
  await page.screenshot({ path: png, omitBackground: !def.opaque, clip: { x: 0, y: 0, width: w, height: h } });
  const [rw, rh] = def.runtime;
  execFileSync('convert', [png, '-resize', `${rw}x${rh}!`, '-quality', def.opaque ? '86' : '92', '-define', 'webp:alpha-quality=95', join(dirs.out, `${name}.webp`)]);
  console.log(`${name}  ${w}x${h} -> ${rw}x${rh}`);
}
await browser.close();

// Symbol atlas: 4x4 grid of 256px cells.
const symbols = Object.keys(ASSETS).filter((n) => n.startsWith('sym_'));
if (!filter || filter.startsWith('sym')) {
  const cell = 256;
  const cols = 4;
  const frames = {};
  const args = ['-size', `${cols * cell}x${cols * cell}`, 'xc:none'];
  symbols.forEach((n, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    frames[n] = { frame: { x, y, w: cell, h: cell }, sourceSize: { w: cell, h: cell }, spriteSourceSize: { x: 0, y: 0, w: cell, h: cell } };
    args.push('(', join(dirs.render, `${n}.png`), '-resize', `${cell}x${cell}`, ')', '-geometry', `+${x}+${y}`, '-composite');
  });
  args.push('-quality', '92', '-define', 'webp:alpha-quality=95', join(dirs.out, 'symbols.webp'));
  execFileSync('convert', args);
  writeFileSync(
    join(dirs.out, 'symbols.json'),
    JSON.stringify({ frames, meta: { image: 'symbols.webp', format: 'RGBA8888', size: { w: cols * cell, h: cols * cell }, scale: 1 } }, null, 1),
  );
  console.log(`symbols atlas: ${symbols.length} frames`);
}
