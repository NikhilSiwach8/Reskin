// Backgrounds, frame, reel panel and logo.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { C, OUT, blurFilter, dropShadow, glowFilter, goldDefs, id, linear, prng, radial, sparkle, svg } from './lib.mjs';

const W = 1920;
const H = 1080;

// ---------------------------------------------------------------- town pieces

function moon(cx, cy, r) {
  const g = id('mn'), halo = id('mh');
  return {
    defs: [
      radial(g, [[0, '#FBF4FF'], [0.6, '#D9C2FF'], [1, '#9D7AE0']], 0.42, 0.4, 0.6),
      radial(halo, [[0.3, '#C9A8FF', 0.55], [1, '#9D66FF', 0]]),
    ],
    body: [
      `<circle cx="${cx}" cy="${cy}" r="${r * 2.6}" fill="url(#${halo})"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>`,
      ...[[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1], [0.35, -0.35, 0.08]].map(
        ([dx, dy, rr]) => `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${rr * r}" fill="#B596EE" opacity="0.45"/>`,
      ),
    ],
  };
}

function stars(rand, n, yMax) {
  return Array.from({ length: n }, () => {
    const x = rand() * W, y = rand() * yMax, r = 0.8 + rand() * 1.8;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#F3E9FF" opacity="${(0.3 + rand() * 0.6).toFixed(2)}"/>`;
  }).join('');
}

function clouds(rand, n, y0, y1, color, opacity) {
  return Array.from({ length: n }, () => {
    const x = rand() * W, y = y0 + rand() * (y1 - y0), w = 220 + rand() * 380, h = 26 + rand() * 30;
    return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${w / 2}" ry="${h}" fill="${color}" opacity="${opacity}"/>`;
  }).join('');
}

/** Crooked house silhouette with lit windows. */
function house(x, base, w, h, fill, rand, windowGlow) {
  const roof = h * (0.35 + rand() * 0.25);
  const lean = (rand() - 0.5) * 16;
  const parts = [];
  parts.push(
    `<path d="M${x} ${base} V${base - h} L${x + w / 2 + lean} ${base - h - roof} L${x + w} ${base - h} V${base} Z" fill="${fill}" ${OUT} stroke-width="4"/>`,
  );
  if (rand() > 0.5) {
    const cx = x + w * (0.2 + rand() * 0.5);
    parts.push(`<rect x="${cx}" y="${base - h - roof * 0.9}" width="${w * 0.12}" height="${roof * 0.7}" fill="${fill}" ${OUT} stroke-width="3"/>`);
  }
  const cols = Math.max(1, Math.floor(w / 46));
  const rows = Math.max(1, Math.floor(h / 60));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rand() < 0.42) continue;
      const wx = x + 14 + c * ((w - 28) / cols);
      const wy = base - h + 18 + r * 56;
      const lit = rand() < 0.75;
      parts.push(
        `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="18" height="26" rx="3" fill="${lit ? C.amber : '#2A1A44'}" ${lit ? `filter="url(#${windowGlow})"` : ''}/>`,
      );
    }
  }
  return parts.join('');
}

function skyline(rand, base, x0, x1, minH, maxH, fill, glow) {
  const out = [];
  let x = x0;
  while (x < x1) {
    const w = 70 + rand() * 120;
    out.push(house(x, base, w, minH + rand() * (maxH - minH), fill, rand, glow));
    x += w - 6;
  }
  return out.join('');
}

function tree(x, base, h, flip, fill) {
  const s = flip ? -1 : 1;
  const b = (dx, dy) => `${x + s * dx} ${base - dy}`;
  return `<path d="M${b(-18, 0)} L${b(-8, h * 0.55)} C${b(-30, h * 0.7)} ${b(-90, h * 0.8)} ${b(-150, h * 0.95)} L${b(-142, h * 0.98)} C${b(-80, h * 0.86)} ${b(-30, h * 0.8)} ${b(-4, h * 0.68)} L${b(-2, h)} L${b(8, h)} L${b(10, h * 0.72)} C${b(40, h * 0.85)} ${b(90, h * 0.9)} ${b(130, h * 1.02)} L${b(136, h * 0.98)} C${b(96, h * 0.84)} ${b(50, h * 0.74)} ${b(16, h * 0.56)} L${b(22, 0)} Z" fill="${fill}" ${OUT} stroke-width="4"/>`;
}

function lamp(x, base, h, glowId) {
  return `<g><rect x="${x - 5}" y="${base - h}" width="10" height="${h}" fill="#140C22"/>
<path d="M${x - 22} ${base - h} H${x + 22} L${x + 14} ${base - h - 46} H${x - 14} Z" fill="#140C22"/>
<rect x="${x - 12}" y="${base - h - 40}" width="24" height="34" rx="4" fill="${C.amber}" filter="url(#${glowId})"/>
<path d="M${x - 18} ${base - h - 46} L${x} ${base - h - 66} L${x + 18} ${base - h - 46} Z" fill="#140C22"/></g>`;
}

function ground(y, top, bottom) {
  const g = id('gr');
  return { defs: [linear(g, [[0, top], [1, bottom]])], body: [`<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="url(#${g})"/>`] };
}

function fog(y, h, color, opacity) {
  const g = id('fg'), b = id('fb');
  return {
    defs: [linear(g, [[0, color, 0], [0.5, color, opacity], [1, color, 0]]), blurFilter(b, 18)],
    body: [`<rect x="-40" y="${y}" width="${W + 80}" height="${h}" fill="url(#${g})" filter="url(#${b})"/>`],
  };
}

function bankExterior() {
  const rand = prng(1313);
  const sky = id('sky'), win = id('wg'), lampG = id('lg'), vig = id('vg'), bank = id('bk'), green = id('gn');
  const m = moon(330, 210, 128);
  const gr = ground(820, '#2A1A42', '#0E0A18');
  const f1 = fog(760, 180, '#B9A2E8', 0.28);
  const [gd, gold] = goldDefs();
  const defs = [
    linear(sky, [[0, '#07050F'], [0.45, '#1E1238'], [0.8, '#4A2A86'], [1, '#6A3FA8']]),
    glowFilter(win, C.amber, 7, 0.9),
    glowFilter(lampG, C.amber, 18, 0.95),
    glowFilter(green, C.green, 16, 0.9),
    radial(vig, [[0.55, '#000', 0], [1, '#000', 0.7]]),
    linear(bank, [[0, '#3A2560'], [1, '#1A1030']]),
    ...gd, ...m.defs, ...gr.defs, ...f1.defs,
  ];
  // Haunted bank silhouette behind the reel frame
  const bankBody = [
    `<path d="M560 840 V380 L960 210 L1360 380 V840 Z" fill="url(#${bank})" ${OUT} stroke-width="6"/>`,
    `<path d="M600 380 L960 236 L1320 380 Z" fill="#2A1A48" stroke="url(#${gold})" stroke-width="10"/>`,
    `<rect x="930" y="150" width="60" height="90" fill="#24163E" ${OUT} stroke-width="5"/>`,
    `<path d="M916 150 L960 96 L1004 150 Z" fill="#24163E" ${OUT} stroke-width="5"/>`,
    `<circle cx="960" cy="186" r="20" fill="${C.green}" filter="url(#${green})"/>`,
    ...[-1, 1].map((s) => `<rect x="${960 + s * 470 - 40}" y="300" width="80" height="540" fill="#24163E" ${OUT} stroke-width="5"/><path d="M${960 + s * 470 - 52} 300 L${960 + s * 470} 230 L${960 + s * 470 + 52} 300 Z" fill="#24163E" ${OUT} stroke-width="5"/>`),
  ];
  return svg(W, H, defs, [
    `<rect width="${W}" height="${H}" fill="url(#${sky})"/>`,
    stars(rand, 160, 520),
    ...m.body,
    clouds(rand, 9, 120, 420, '#2C1A4E', 0.55),
    clouds(rand, 6, 300, 520, '#6A4AA8', 0.18),
    skyline(rand, 830, -40, W + 40, 120, 260, '#170F2A', win),
    ...bankBody,
    ...gr.body,
    skyline(rand, 900, -60, 520, 200, 360, '#120B20', win),
    skyline(rand, 900, 1400, W + 60, 200, 360, '#120B20', win),
    tree(70, 1000, 520, false, '#0B0714'),
    tree(1850, 1000, 560, true, '#0B0714'),
    lamp(470, 1000, 300, lampG),
    lamp(1450, 1000, 300, lampG),
    ...f1.body,
    `<rect width="${W}" height="${H}" fill="url(#${vig})"/>`,
  ]);
}

// ---------------------------------------------------------------- interiors

function interior({ seed, wallTop, wallBottom, light, floorTop, floorBottom, accent, extra }) {
  const rand = prng(seed);
  const wall = id('wl'), floor = id('fl'), beam = id('bm'), vig = id('vg'), glow = id('gw'), soft = id('sf');
  const defs = [
    linear(wall, [[0, wallTop], [1, wallBottom]]),
    linear(floor, [[0, floorTop], [1, floorBottom]]),
    radial(beam, [[0, light, 0.75], [1, light, 0]]),
    radial(vig, [[0.5, '#000', 0], [1, '#000', 0.75]]),
    glowFilter(glow, accent, 14, 0.9),
    blurFilter(soft, 30),
  ];
  const arches = [];
  for (let i = 0; i < 7; i++) {
    const cx = 120 + i * 280;
    const depth = Math.abs(i - 3);
    const top = 160 + depth * 40;
    const w = 210 - depth * 10;
    arches.push(
      `<path d="M${cx - w / 2} 840 V${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2} V840 Z" fill="#000" opacity="${0.35 + depth * 0.06}" ${OUT} stroke-width="6"/>`,
      `<rect x="${cx + w / 2 + 6}" y="${top}" width="56" height="${840 - top}" fill="${wallBottom}" ${OUT} stroke-width="5"/>`,
    );
  }
  const torches = [300, 860, 1060, 1620].map(
    (x) => `<g><rect x="${x - 6}" y="420" width="12" height="60" fill="#1A1028"/><ellipse cx="${x}" cy="404" rx="18" ry="30" fill="${accent}" filter="url(#${glow})"/></g>`,
  );
  const motes = Array.from({ length: 70 }, () => `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * 900).toFixed(0)}" r="${(1 + rand() * 3).toFixed(1)}" fill="${accent}" opacity="${(0.2 + rand() * 0.5).toFixed(2)}"/>`).join('');
  return svg(W, H, defs, [
    `<rect width="${W}" height="${H}" fill="url(#${wall})"/>`,
    `<ellipse cx="960" cy="420" rx="760" ry="520" fill="url(#${beam})"/>`,
    ...arches,
    `<path d="M0 840 H${W} V${H} H0 Z" fill="url(#${floor})"/>`,
    ...Array.from({ length: 9 }, (_, i) => `<path d="M${960 + (i - 4) * 60} 840 L${960 + (i - 4) * 360} ${H}" stroke="#000" stroke-width="3" opacity="0.25"/>`),
    ...[880, 940, 1020].map((y) => `<path d="M0 ${y} H${W}" stroke="#000" stroke-width="3" opacity="0.2"/>`),
    ...torches,
    extra({ rand, glow, soft }),
    motes,
    `<rect width="${W}" height="${H}" fill="url(#${vig})"/>`,
  ]);
}

function coinPile(cx, base, w, h, goldId) {
  return `<path d="M${cx - w / 2} ${base} C${cx - w / 3} ${base - h} ${cx + w / 3} ${base - h} ${cx + w / 2} ${base} Z" fill="url(#${goldId})" ${OUT} stroke-width="5"/>` +
    Array.from({ length: 6 }, (_, i) => `<ellipse cx="${cx - w / 3 + (i * w) / 9}" cy="${base - h * 0.5 + (i % 2) * 14}" rx="18" ry="8" fill="#FFF1B0" opacity="0.5"/>`).join('');
}

function cursedFortuneBg() {
  const [gd, gold] = goldDefs();
  const out = interior({
    seed: 21, wallTop: '#06140E', wallBottom: '#0F3022', light: C.green, floorTop: '#123A2A', floorBottom: '#04100A', accent: C.green,
    extra: ({ glow }) => [coinPile(250, 900, 320, 110, gold), coinPile(1680, 910, 360, 130, gold), `<polygon points="960,250 1020,300 1020,380 960,430 900,380 900,300" fill="${C.green}" opacity="0.5" filter="url(#${glow})"/>`].join(''),
  });
  return out.replace('<defs>', `<defs>${gd.join('')}`);
}

function phantomPaydayBg() {
  return interior({
    seed: 22, wallTop: '#0E0820', wallBottom: '#2A1650', light: C.violet, floorTop: '#2A1A48', floorBottom: '#0A0614', accent: '#B48CFF',
    extra: ({ soft }) => [
      ...Array.from({ length: 10 }, (_, i) => `<rect x="${720 + i * 6}" y="${560 + i * 28}" width="${480 - i * 12}" height="28" fill="#1A1030" stroke="#000" stroke-width="3" transform="translate(${-i * 0} 0)"/>`),
      ...[[360, 520], [1560, 500], [1300, 620]].map(([x, y]) => `<path d="M${x} ${y} C${x + 40} ${y} ${x + 50} ${y + 50} ${x + 50} ${y + 90} L${x + 60} ${y + 150} L${x + 30} ${y + 130} L${x} ${y + 160} L${x - 30} ${y + 130} L${x - 60} ${y + 150} L${x - 50} ${y + 90} C${x - 50} ${y + 50} ${x - 40} ${y} ${x} ${y}Z" fill="#C9B8FF" opacity="0.35" filter="url(#${soft})"/>`),
    ].join(''),
  });
}

function midnightCountdownBg() {
  const [gd, gold] = goldDefs();
  const out = interior({
    seed: 23, wallTop: '#140A06', wallBottom: '#3A2010', light: C.amber, floorTop: '#3A2412', floorBottom: '#0E0804', accent: C.amber,
    extra: () => {
      const ticks = Array.from({ length: 13 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 13) * Math.PI * 2;
        return `<line x1="${960 + 150 * Math.cos(a)}" y1="${330 + 150 * Math.sin(a)}" x2="${960 + 128 * Math.cos(a)}" y2="${330 + 128 * Math.sin(a)}" stroke="${C.gold}" stroke-width="8"/>`;
      }).join('');
      return `<circle cx="960" cy="330" r="190" fill="url(#${gold})" ${OUT} stroke-width="8" opacity="0.85"/><circle cx="960" cy="330" r="164" fill="#2A160A" ${OUT} stroke-width="5"/>${ticks}<path d="M960 330 V200 M960 330 L1040 380" stroke="${C.gold}" stroke-width="12" stroke-linecap="round"/>`;
    },
  });
  return out.replace('<defs>', `<defs>${gd.join('')}`);
}

function finalHeistBg() {
  const [gd, gold] = goldDefs();
  const out = interior({
    seed: 24, wallTop: '#120A04', wallBottom: '#3E2608', light: '#FFD36A', floorTop: '#4A3010', floorBottom: '#120A02', accent: '#FFD36A',
    extra: ({ glow }) => [
      `<circle cx="960" cy="420" r="300" fill="none" stroke="${C.outline}" stroke-width="56"/>`, `<circle cx="960" cy="420" r="300" fill="none" stroke="url(#${gold})" stroke-width="40"/>`,
      `<circle cx="960" cy="420" r="260" fill="${C.green}" opacity="0.35" filter="url(#${glow})"/>`,
      coinPile(320, 920, 520, 200, gold), coinPile(1600, 930, 560, 220, gold), coinPile(960, 960, 700, 120, gold),
    ].join(''),
  });
  return out.replace('<defs>', `<defs>${gd.join('')}`);
}

// ---------------------------------------------------------------- frame & reel panel

/** Frame canvas 1000x1060; the reel window is x 125..875, y 200..950. */
export const FRAME = { w: 1000, h: 1060, window: { x: 125, y: 200, w: 750, h: 750 } };

function frame() {
  const [gd, gold, golddk] = goldDefs();
  const sh = id('s'), stone = id('st'), flame = id('fl'), fglow = id('fg'), green = id('gn');
  const { x, y, w, h } = FRAME.window;
  const pillar = (px) => `
<rect x="${px}" y="250" width="92" height="700" rx="10" fill="url(#${stone})" ${OUT} stroke-width="8"/>
${[0, 1, 2].map((i) => `<rect x="${px + 18 + i * 20}" y="280" width="12" height="640" rx="6" fill="#000" opacity="0.25"/>`).join('')}
<rect x="${px - 14}" y="226" width="120" height="40" rx="8" fill="url(#${gold})" ${OUT} stroke-width="7"/>
<rect x="${px - 14}" y="930" width="120" height="40" rx="8" fill="url(#${gold})" ${OUT} stroke-width="7"/>
<path d="M${px + 6} 226 C${px + 6} 196 ${px + 86} 196 ${px + 86} 226 Z" fill="url(#${golddk})" ${OUT} stroke-width="6"/>
<path d="M${px + 46} 120 C${px + 76} 150 ${px + 70} 180 ${px + 46} 196 C${px + 22} 180 ${px + 16} 150 ${px + 46} 120 Z" fill="url(#${flame})" filter="url(#${fglow})"/>
<path d="M${px + 46} 150 C${px + 60} 166 ${px + 58} 182 ${px + 46} 192 C${px + 34} 182 ${px + 32} 166 ${px + 46} 150 Z" fill="#E8FFF0" opacity="0.8"/>`;
  return svg(FRAME.w, FRAME.h, [...gd, dropShadow(sh, 14, 12, 0.6), glowFilter(fglow, C.green, 14, 1), glowFilter(green, C.green, 10, 1),
    linear(stone, [[0, '#3E2C5E'], [0.5, '#2A1C44'], [1, '#1A1030']], 0, 0, 1, 0),
    linear(flame, [[0, '#E8FFF0'], [0.4, C.green], [1, '#0E8A49']]),
  ], [
    `<g filter="url(#${sh})">`,
    // crest / pediment
    `<path d="M70 210 L500 40 L930 210 Z" fill="#24163E" stroke="url(#${gold})" stroke-width="14" stroke-linejoin="round"/>`,
    `<path d="M70 210 L500 40 L930 210 Z" fill="none" ${OUT} stroke-width="4"/>`,
    `<path d="M160 196 L500 70 L840 196 Z" fill="#1A1030"/>`,
    // skull ornament
    `<path d="M500 64 C548 64 580 96 580 138 C580 166 564 182 552 190 V214 H448 V190 C436 182 420 166 420 138 C420 96 452 64 500 64Z" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<g filter="url(#${green})"><ellipse cx="474" cy="138" rx="18" ry="22" fill="${C.green}"/><ellipse cx="526" cy="138" rx="18" ry="22" fill="${C.green}"/></g>`,
    `<path d="M500 160 L490 178 H510 Z" fill="${C.outline}"/><path d="M470 196 V214 M490 196 V214 M510 196 V214 M530 196 V214" stroke="${C.outline}" stroke-width="5"/>`,
    pillar(18), pillar(890),
    // window border
    `<rect x="${x - 34}" y="${y - 34}" width="${w + 68}" height="${h + 68}" rx="30" fill="none" stroke="${C.outline}" stroke-width="44"/>`,
    `<rect x="${x - 34}" y="${y - 34}" width="${w + 68}" height="${h + 68}" rx="30" fill="none" stroke="url(#${gold})" stroke-width="32"/>`,
    `<rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${h + 24}" rx="16" fill="none" stroke="${C.outline}" stroke-width="12"/>`,
    `<rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${h + 24}" rx="16" fill="none" stroke="url(#${golddk})" stroke-width="6"/>`,
    ...[[x - 34, y - 34], [x + w + 34, y - 34], [x - 34, y + h + 34], [x + w + 34, y + h + 34]].map(([cx, cy]) =>
      `<circle cx="${cx}" cy="${cy}" r="34" fill="url(#${gold})" ${OUT} stroke-width="8"/><circle cx="${cx}" cy="${cy}" r="16" fill="${C.green}" filter="url(#${green})"/>`),
    // base plinth
    `<path d="M60 990 H940 L910 1050 H90 Z" fill="url(#${stone})" ${OUT} stroke-width="8"/>`,
    `<rect x="60" y="978" width="880" height="24" rx="8" fill="url(#${gold})" ${OUT} stroke-width="6"/>`,
    `</g>`,
    sparkle(250, 120, 14, C.green), sparkle(760, 120, 14, C.green),
  ]);
}

function reelPanel() {
  const bg = id('rb'), vig = id('rv');
  const lines = [];
  for (let i = 1; i < 5; i++) lines.push(`<line x1="${i * 150}" y1="12" x2="${i * 150}" y2="738" stroke="#9D66FF" stroke-width="2" opacity="0.22"/>`);
  return svg(750, 750, [
    radial(bg, [[0, '#2A1A48'], [1, '#0E0A1A']]),
    radial(vig, [[0.6, '#000', 0], [1, '#000', 0.55]]),
  ], [
    `<rect width="750" height="750" fill="url(#${bg})"/>`,
    ...lines,
    `<rect width="750" height="750" fill="url(#${vig})"/>`,
  ]);
}

// ---------------------------------------------------------------- logo

function fontFace(family, pkg, file) {
  const require = createRequire(import.meta.url);
  const path = require.resolve(`${pkg}/files/${file}`);
  return `<style>@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${readFileSync(path).toString('base64')}) format('woff2');}</style>`;
}

function logo() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), green = id('gn'), vault = id('vt'), glow = id('gw');
  const face = fontFace('MVLogo', '@fontsource/cinzel-decorative', 'cinzel-decorative-latin-900-normal.woff2');
  const text = (str, x, y, size, fill, extra = '') => `<text x="${x}" y="${y}" font-family="MVLogo" font-size="${size}" font-weight="900" text-anchor="middle" ${extra} fill="${fill}">${str}</text>`;
  return svg(1200, 520, [face, ...gd, dropShadow(sh, 12, 10, 0.7), glowFilter(glow, C.green, 22, 0.9),
    linear(green, [[0, '#E8FFF0'], [0.4, C.green], [1, '#1C9A50']]),
    linear(vault, [[0, '#FFF6C8'], [0.45, '#F5C95A'], [1, '#8A5A12']]),
  ], [
    `<g filter="url(#${sh})">`,
    // ornamental backplate
    `<path d="M120 300 C180 150 380 120 600 120 C820 120 1020 150 1080 300 C1020 420 820 470 600 470 C380 470 180 420 120 300 Z" fill="#1A1030" stroke="url(#${gold})" stroke-width="14"/>`,
    `<path d="M600 18 C640 18 668 46 668 82 C668 104 656 118 646 124 V146 H554 V124 C544 118 532 104 532 82 C532 46 560 18 600 18Z" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<ellipse cx="578" cy="82" rx="14" ry="17" fill="${C.green}"/><ellipse cx="622" cy="82" rx="14" ry="17" fill="${C.green}"/>`,
    text('MIDNIGHT', 600, 280, 128, C.outline, `stroke="${C.outline}" stroke-width="26" stroke-linejoin="round"`),
    text('MIDNIGHT', 600, 280, 128, `url(#${vault})`),
    `<g filter="url(#${glow})">`,
    text('VAULT', 600, 430, 168, C.outline, `stroke="${C.outline}" stroke-width="30" stroke-linejoin="round"`),
    text('VAULT', 600, 430, 168, `url(#${green})`),
    `</g>`,
    text('VAULT', 600, 430, 168, 'none', `stroke="#0E5A30" stroke-width="4"`),
    `</g>`,
    sparkle(1010, 200, 22), sparkle(190, 380, 16, C.green), sparkle(860, 450, 14, C.green),
  ]);
}

export const SCENE_ASSETS = {
  bg_bank: { build: bankExterior, render: [W, H], runtime: [W, H], opaque: true },
  bg_cursed_fortune: { build: cursedFortuneBg, render: [W, H], runtime: [W, H], opaque: true },
  bg_phantom_payday: { build: phantomPaydayBg, render: [W, H], runtime: [W, H], opaque: true },
  bg_midnight_countdown: { build: midnightCountdownBg, render: [W, H], runtime: [W, H], opaque: true },
  bg_final_heist: { build: finalHeistBg, render: [W, H], runtime: [W, H], opaque: true },
  frame: { build: frame, render: [2000, 2120], runtime: [1000, 1060] },
  reel_panel: { build: reelPanel, render: [750, 750], runtime: [750, 750], opaque: true },
  logo: { build: logo, render: [2400, 1040], runtime: [1200, 520] },
};
