// Feature art and effect sprites.
import { C, OUT, dropShadow, gloss, glowFilter, goldDefs, id, linear, poly, radial, sparkle, svg } from './lib.mjs';

function chain() {
  // Horizontal tileable chain strip, 512x96 (4 links).
  const [gd, gold] = goldDefs();
  const steel = id('st');
  const links = [];
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    links.push(`<rect x="${x + 8}" y="22" width="112" height="52" rx="26" fill="none" stroke="${C.outline}" stroke-width="26"/>`);
    links.push(`<rect x="${x + 8}" y="22" width="112" height="52" rx="26" fill="none" stroke="url(#${steel})" stroke-width="14"/>`);
    links.push(`<rect x="${x + 72}" y="40" width="40" height="16" rx="8" fill="url(#${gold})" ${OUT} stroke-width="5"/>`);
  }
  return svg(512, 96, [...gd, linear(steel, [[0, '#B0A6C8'], [0.5, '#5C5070'], [1, '#2A2238']])], links);
}

function lockBadge() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), steel = id('st');
  const spokes = Array.from({ length: 6 }, (_, i) => `<g transform="rotate(${i * 60} 128 140)"><rect x="122" y="66" width="12" height="60" rx="5" fill="url(#${gold})" ${OUT} stroke-width="4"/></g>`).join('');
  return svg(256, 256, [...gd, dropShadow(sh), radial(steel, [[0, '#5C5070'], [1, '#1C1726']])], [
    `<g filter="url(#${sh})">`,
    `<path d="M80 110 V80 C80 40 176 40 176 80 V110" fill="none" stroke="${C.outline}" stroke-width="34"/>`,
    `<path d="M80 110 V80 C80 40 176 40 176 80 V110" fill="none" stroke="url(#${gold})" stroke-width="20"/>`,
    `<circle cx="128" cy="150" r="86" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<circle cx="128" cy="150" r="68" fill="url(#${steel})" ${OUT} stroke-width="6"/>`,
    `<g transform="translate(0 10)">${spokes}</g>`,
    `<circle cx="128" cy="150" r="22" fill="url(#${gold})" ${OUT} stroke-width="6"/>`,
    `</g>`,
  ]);
}

function portal() {
  const ring = id('rg'), core = id('cr'), glow = id('gw');
  const swirls = Array.from({ length: 5 }, (_, i) => `<path transform="rotate(${i * 72} 256 256)" d="M256 70 C360 90 420 180 400 270" fill="none" stroke="${i % 2 ? C.violet : C.green}" stroke-width="16" stroke-linecap="round" opacity="0.85"/>`).join('');
  return svg(512, 512, [glowFilter(glow, C.green, 20, 1),
    radial(ring, [[0.55, C.green, 0], [0.8, C.green, 0.9], [1, C.violet, 0]]),
    radial(core, [[0, '#E8FFF0', 0.9], [0.4, C.violet, 0.6], [1, '#100D1D', 0]]),
  ], [
    `<circle cx="256" cy="256" r="240" fill="url(#${ring})"/>`,
    `<circle cx="256" cy="256" r="170" fill="url(#${core})"/>`,
    `<g filter="url(#${glow})">${swirls}</g>`,
  ]);
}

function clockFace() {
  const [gd, gold] = goldDefs();
  const face = id('fc'), glow = id('gw'), sh = id('s');
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 13) * Math.PI * 2;
    const c = (r) => [384 + r * Math.cos(a), 384 + r * Math.sin(a)];
    const [x1, y1] = c(300), [x2, y2] = c(i === 0 ? 220 : 250), [cx, cy] = c(196);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i === 0 ? C.green : C.gold}" stroke-width="${i === 0 ? 30 : 18}" stroke-linecap="round"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${i === 0 ? 16 : 9}" fill="${i === 0 ? C.green : C.violet}"/>`;
  }).join('');
  return svg(768, 768, [...gd, glowFilter(glow, C.green, 14, 1), dropShadow(sh, 16, 14, 0.7),
    radial(face, [[0, '#4A2A86'], [0.75, '#1E1238'], [1, '#0E0820']]),
  ], [
    `<g filter="url(#${sh})">`,
    `<circle cx="384" cy="384" r="372" fill="url(#${gold})" ${OUT} stroke-width="14"/>`,
    `<circle cx="384" cy="384" r="330" fill="url(#${face})" ${OUT} stroke-width="10"/>`,
    `<circle cx="384" cy="384" r="150" fill="none" stroke="${C.violet}" stroke-width="4" opacity="0.6"/>`,
    `</g>`,
    `<g filter="url(#${glow})">${ticks}</g>`,
  ]);
}

function clockHand() {
  // Pivot at (64, 448): the hand points up.
  const [gd, gold] = goldDefs();
  return svg(128, 512, [...gd], [
    `<path d="M64 20 L92 120 L76 128 L80 448 H48 L52 128 L36 120 Z" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<circle cx="64" cy="448" r="40" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<circle cx="64" cy="448" r="14" fill="${C.green}"/>`,
  ]);
}

function vaultDoorBig() {
  const [gd, gold] = goldDefs();
  const steel = id('st'), steel2 = id('st2'), sh = id('s'), seam = id('sm');
  const [g1, gl1] = gloss(320, 300, 160, 50, -30, 0.35);
  const bolts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return `<circle cx="${(512 + 430 * Math.cos(a)).toFixed(1)}" cy="${(512 + 430 * Math.sin(a)).toFixed(1)}" r="18" fill="url(#${gold})" ${OUT} stroke-width="6"/>`;
  }).join('');
  const spokes = Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45} 512 512)"><rect x="498" y="250" width="28" height="200" rx="10" fill="url(#${gold})" ${OUT} stroke-width="8"/><circle cx="512" cy="244" r="34" fill="url(#${gold})" ${OUT} stroke-width="9"/></g>`).join('');
  return svg(1024, 1024, [...gd, dropShadow(sh, 20, 18, 0.7), g1,
    linear(steel, [[0, '#7A7090'], [0.5, '#3A3348'], [1, '#18131F']]),
    radial(steel2, [[0, '#4E4464'], [1, '#18131F']]),
    radial(seam, [[0.86, C.green, 0], [0.92, C.green, 1], [1, C.green, 0]]),
  ], [
    `<g filter="url(#${sh})">`,
    `<circle cx="512" cy="512" r="500" fill="url(#${gold})" ${OUT} stroke-width="16"/>`,
    `<circle cx="512" cy="512" r="470" fill="url(#${steel})" ${OUT} stroke-width="8"/>`,
    bolts,
    `<circle cx="512" cy="512" r="380" fill="url(#${steel2})" ${OUT} stroke-width="10"/>`,
    `<circle cx="512" cy="512" r="380" fill="url(#${seam})"/>`,
    spokes,
    `<circle cx="512" cy="512" r="110" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<path d="M512 444 C556 444 584 474 584 512 C584 538 570 552 558 560 V584 H466 V560 C454 552 440 538 440 512 C440 474 468 444 512 444Z" fill="${C.ivory}" ${OUT} stroke-width="8"/>`,
    `<ellipse cx="488" cy="512" rx="16" ry="20" fill="${C.green}"/><ellipse cx="536" cy="512" rx="16" ry="20" fill="${C.green}"/>`,
    `</g>`,
    gl1,
  ]);
}

function bonusKey(color, light, dark) {
  const [gd, gold] = goldDefs();
  const gem = id('gm'), glow = id('gw'), sh = id('s'), aura = id('au');
  return svg(320, 640, [...gd, glowFilter(glow, color, 18, 0.9), dropShadow(sh),
    radial(gem, [[0, light], [0.5, color], [1, dark]]),
    radial(aura, [[0, color, 0.5], [1, color, 0]]),
  ], [
    `<ellipse cx="160" cy="200" rx="160" ry="200" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    `<rect x="142" y="300" width="36" height="300" rx="12" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<path d="M178 500 H236 V528 H212 V550 H236 V584 H178 Z" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<path d="M160 40 C240 40 290 100 290 170 C290 250 230 300 160 300 C90 300 30 250 30 170 C30 100 80 40 160 40 Z" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<path d="M120 20 L160 0 L200 20 L184 52 H136 Z" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<g filter="url(#${glow})"><polygon points="${poly(160, 170, 82, 6, Math.PI / 6)}" fill="url(#${gem})" ${OUT} stroke-width="9"/></g>`,
    `<polygon points="${poly(160, 160, 36, 6, Math.PI / 6)}" fill="#ffffff" opacity="0.45"/>`,
    `</g>`,
    sparkle(260, 70, 18),
  ]);
}

function seal(color, emblem) {
  const [gd, gold] = goldDefs();
  const face = id('fc'), glow = id('gw'), sh = id('s');
  return svg(256, 256, [...gd, glowFilter(glow, color, 10, 1), dropShadow(sh, 6, 5, 0.6),
    radial(face, [[0, '#3A2560'], [1, '#140C22']]),
  ], [
    `<g filter="url(#${sh})">`,
    `<polygon points="${poly(128, 128, 120, 12, 0)}" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<circle cx="128" cy="128" r="90" fill="url(#${face})" ${OUT} stroke-width="6"/>`,
    `</g>`,
    `<g filter="url(#${glow})">${emblem}</g>`,
  ]);
}

const relicEmblem = `<polygon points="128,64 176,98 176,158 128,194 80,158 80,98" fill="${C.green}" stroke="${C.outline}" stroke-width="7" stroke-linejoin="round"/><polygon points="128,64 176,98 128,114 80,98" fill="#E8FFF0" opacity="0.7"/>`;
const phantomEmblem = `<path d="M128 62 C170 62 190 100 192 140 C194 168 200 186 210 204 C190 198 176 210 160 200 C146 212 110 212 96 200 C80 210 66 198 46 204 C56 186 62 168 64 140 C66 100 86 62 128 62Z" fill="${C.violet}" stroke="${C.outline}" stroke-width="7" stroke-linejoin="round"/><path d="M104 130 Q114 120 124 130 Q114 138 104 130Z M132 130 Q142 120 152 130 Q142 138 132 130Z" fill="${C.green}"/>`;
const clockEmblem = `<circle cx="128" cy="128" r="62" fill="#1E1238" stroke="${C.gold}" stroke-width="10"/><path d="M128 128 V82 M128 128 L160 148" stroke="${C.amber}" stroke-width="10" stroke-linecap="round"/><circle cx="128" cy="76" r="8" fill="${C.green}"/>`;

function phantomBig() {
  const robe = id('rb'), inner = id('in'), glow = id('gw'), sh = id('s'), eye = id('ey'), hand = id('hd');
  return svg(768, 960, [glowFilter(glow, C.green, 14, 1), dropShadow(sh, 18, 16, 0.6),
    linear(robe, [[0, '#B48CFF'], [0.45, '#6A3FC4'], [1, '#1E0F3C']]),
    radial(inner, [[0, '#05030A'], [1, '#1C1030']], 0.5, 0.45, 0.6),
    radial(eye, [[0, '#FFFFFF'], [0.4, C.green], [1, '#1FBF66']]),
    linear(hand, [[0, '#C9B8FF'], [1, '#6A3FC4']]),
  ], [
    `<g filter="url(#${sh})">`,
    `<path d="M384 40 C540 40 620 170 628 330 C636 480 660 640 720 900 C650 880 610 920 560 890 C510 930 460 890 420 920 C380 890 330 930 290 900 C240 930 190 890 150 912 C110 880 70 900 40 900 C110 640 132 480 140 330 C148 170 228 40 384 40Z" fill="url(#${robe})" ${OUT} stroke-width="16"/>`,
    `<path d="M384 120 C484 120 536 206 536 310 C536 428 470 500 384 500 C298 500 232 428 232 310 C232 206 284 120 384 120Z" fill="url(#${inner})" ${OUT} stroke-width="12"/>`,
    `<path d="M600 520 C660 480 720 470 740 500 C720 520 690 530 660 560 C640 600 600 610 580 590 Z" fill="url(#${hand})" ${OUT} stroke-width="10"/>`,
    `<path d="M200 560 C150 600 100 640 70 620 C90 590 120 560 150 520 Z" fill="url(#${hand})" ${OUT} stroke-width="10"/>`,
    `</g>`,
    `<g filter="url(#${glow})"><path d="M310 310 Q340 282 370 310 Q340 334 310 310Z" fill="url(#${eye})"/><path d="M398 310 Q428 282 458 310 Q428 334 398 310Z" fill="url(#${eye})"/>`,
    `<circle cx="740" cy="470" r="26" fill="${C.green}" opacity="0.9"/></g>`,
  ]);
}

function particle(color, kind) {
  const g = id('p');
  if (kind === 'spark') {
    return svg(128, 128, [radial(g, [[0, '#ffffff'], [0.25, color, 0.9], [1, color, 0]])], [`<circle cx="64" cy="64" r="64" fill="url(#${g})"/>`, sparkle(64, 64, 40, '#ffffff', 0.9)]);
  }
  if (kind === 'wisp') {
    return svg(128, 128, [radial(g, [[0, color, 0.85], [1, color, 0]])], [`<ellipse cx="64" cy="64" rx="60" ry="40" fill="url(#${g})"/>`]);
  }
  const [gd, gold] = goldDefs();
  return svg(128, 128, [...gd], [
    `<ellipse cx="64" cy="64" rx="54" ry="54" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<ellipse cx="64" cy="64" rx="34" ry="34" fill="none" stroke="#9A6A1F" stroke-width="6"/>`,
    `<path d="M64 42 L70 58 L86 60 L74 70 L78 86 L64 78 L50 86 L54 70 L42 60 L58 58 Z" fill="#FFF1B0"/>`,
  ]);
}

export const EFFECT_ASSETS = {
  fx_chain: { build: chain, render: [1024, 192], runtime: [512, 96] },
  fx_lock: { build: lockBadge, render: [512, 512], runtime: [256, 256] },
  fx_portal: { build: portal, render: [1024, 1024], runtime: [512, 512] },
  fx_clock_face: { build: clockFace, render: [1536, 1536], runtime: [768, 768] },
  fx_clock_hand: { build: clockHand, render: [256, 1024], runtime: [128, 512] },
  fx_vault_door: { build: vaultDoorBig, render: [2048, 2048], runtime: [1024, 1024] },
  key_cursed_fortune: { build: () => bonusKey(C.green, '#E8FFF0', '#0E8A49'), render: [640, 1280], runtime: [320, 640] },
  key_phantom_payday: { build: () => bonusKey(C.violet, '#F0E6FF', '#4A2A86'), render: [640, 1280], runtime: [320, 640] },
  key_midnight_countdown: { build: () => bonusKey(C.amber, '#FFF1D0', '#9A4A0A'), render: [640, 1280], runtime: [320, 640] },
  seal_relic: { build: () => seal(C.green, relicEmblem), render: [512, 512], runtime: [256, 256] },
  seal_phantom: { build: () => seal(C.violet, phantomEmblem), render: [512, 512], runtime: [256, 256] },
  seal_clock: { build: () => seal(C.amber, clockEmblem), render: [512, 512], runtime: [256, 256] },
  fx_phantom: { build: phantomBig, render: [1536, 1920], runtime: [768, 960] },
  fx_spark: { build: () => particle(C.green, 'spark'), render: [256, 256], runtime: [128, 128] },
  fx_wisp: { build: () => particle(C.violet, 'wisp'), render: [256, 256], runtime: [128, 128] },
  fx_coin: { build: () => particle(C.gold, 'coin'), render: [256, 256], runtime: [128, 128] },
};
