// Writes every Sugar Scream runtime asset as an SVG into public/assets/.
// All art is original vector work drawn here in code (no third-party images).
//
//   npm run art
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '../public/assets');
mkdirSync(OUT, { recursive: true });

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>\n`;

const radial = (id, stops, cx = '35%', cy = '30%', r = '75%') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const linear = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const shadow = `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="0.55"/></filter>`;
const glow = (id, color, dev = 8) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${dev}" result="b"/><feFlood flood-color="${color}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
/** Glossy highlight used on every candy. */
const gloss = (x, y, rx, ry, rot = -25, o = 0.55) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${o}"/>`;

const symbols = {
  // Bleeding Heart: a glossy cherry-red heart gummy dripping syrup.
  BH: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M100 172 C40 128 18 98 22 66 C26 36 54 22 76 28 C88 31 96 40 100 50 C104 40 112 31 124 28 C146 22 174 36 178 66 C182 98 160 128 100 172 Z" fill="url(#g)" stroke="#4a0010" stroke-width="5"/>
      <path d="M58 118 q4 22 0 34 q-6 8 -10 0 q-3 -12 2 -30z M140 120 q3 16 -1 26 q-5 7 -9 0 q-2 -10 3 -24z" fill="#b5001f" stroke="#4a0010" stroke-width="3"/>
      <path d="M100 160 C58 128 38 104 40 74" fill="none" stroke="#ff8a9a" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
      ${gloss(66, 58, 18, 10)} ${gloss(134, 54, 9, 5, 20, 0.45)}
      <circle cx="120" cy="92" r="5" fill="#fff" opacity="0.7"/>
    </g>`, radial('g', [[0, '#ff6f85'], [0.45, '#e0002b'], [1, '#6d0016']]) + shadow),

  // Witch's Potion: a round violet flask with a bubbling brew and a cork.
  WP: svg(200, 200, `
    <g filter="url(#sh)">
      <rect x="82" y="18" width="36" height="22" rx="5" fill="#b07a45" stroke="#3b2210" stroke-width="4"/>
      <path d="M86 38 h28 v26 C152 74 170 104 162 136 C154 168 128 182 100 182 C72 182 46 168 38 136 C30 104 48 74 86 64 Z" fill="url(#g)" stroke="#2a0b45" stroke-width="5"/>
      <path d="M44 120 C60 112 80 128 100 120 C120 112 140 128 158 120 C160 150 136 176 100 176 C64 176 40 150 44 120 Z" fill="#c64dff" opacity="0.85"/>
      <circle cx="78" cy="140" r="8" fill="#f3c4ff" opacity="0.8"/><circle cx="116" cy="150" r="5" fill="#f3c4ff" opacity="0.8"/><circle cx="128" cy="132" r="4" fill="#f3c4ff" opacity="0.7"/>
      <path d="M78 98 l8 8 m0 -8 l-8 8 M114 98 l8 8 m0 -8 l-8 8" stroke="#2a0b45" stroke-width="4" stroke-linecap="round"/>
      <path d="M88 116 q12 8 24 0" fill="none" stroke="#2a0b45" stroke-width="4" stroke-linecap="round"/>
      ${gloss(66, 92, 14, 8)}
    </g>`, radial('g', [[0, '#c9a2ff'], [0.5, '#7a2fd0'], [1, '#2e0a5c']]) + shadow),

  // Slime Drop: a toxic-green gumdrop with sugar crystals and a drip.
  SL: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M100 18 C120 52 168 92 168 130 C168 164 138 184 100 184 C62 184 32 164 32 130 C32 92 80 52 100 18 Z" fill="url(#g)" stroke="#0d3b00" stroke-width="5"/>
      <path d="M58 160 q-2 18 6 22 q8 2 8 -10z" fill="#5fd400" stroke="#0d3b00" stroke-width="3"/>
      <circle cx="80" cy="122" r="13" fill="#fff" stroke="#0d3b00" stroke-width="3"/><circle cx="84" cy="124" r="6" fill="#111"/>
      <circle cx="124" cy="118" r="9" fill="#fff" stroke="#0d3b00" stroke-width="3"/><circle cx="126" cy="120" r="4" fill="#111"/>
      <path d="M86 152 q14 -8 30 0" fill="none" stroke="#0d3b00" stroke-width="4" stroke-linecap="round"/>
      ${[[70, 84], [132, 92], [104, 64], [142, 140], [60, 140], [108, 168]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="5" fill="#eaffd0" opacity="0.8" transform="rotate(30 ${x} ${y})"/>`).join('')}
      ${gloss(80, 70, 14, 7, -50)}
    </g>`, radial('g', [[0, '#d8ff7a'], [0.5, '#45c400'], [1, '#155c00']]) + shadow),

  // Ghost Marshmallow: a pale blue marshmallow ghost.
  GM: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M44 176 V92 C44 52 70 24 100 24 C130 24 156 52 156 92 V176 l-18 -14 l-19 16 l-19 -16 l-19 16 l-19 -16 Z" fill="url(#g)" stroke="#1e3a6e" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="80" cy="92" rx="10" ry="15" fill="#13234a"/><ellipse cx="120" cy="92" rx="10" ry="15" fill="#13234a"/>
      <circle cx="83" cy="86" r="3.5" fill="#fff"/><circle cx="123" cy="86" r="3.5" fill="#fff"/>
      <ellipse cx="100" cy="128" rx="11" ry="14" fill="#13234a"/>
      <ellipse cx="66" cy="116" rx="8" ry="5" fill="#ff9ccf" opacity="0.6"/><ellipse cx="134" cy="116" rx="8" ry="5" fill="#ff9ccf" opacity="0.6"/>
      ${gloss(72, 52, 16, 8)}
    </g>`, radial('g', [[0, '#ffffff'], [0.55, '#bfe0ff'], [1, '#5c8fd6']]) + shadow),

  // Poison Apple: a candy apple glazed in sickly green with a skull highlight.
  PA: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M100 52 C70 34 30 46 30 98 C30 146 62 182 86 182 C94 182 96 176 100 176 C104 176 106 182 114 182 C138 182 170 146 170 98 C170 46 130 34 100 52 Z" fill="url(#g)" stroke="#2a0d00" stroke-width="5"/>
      <path d="M100 52 C98 36 104 22 112 14" fill="none" stroke="#4a2a10" stroke-width="7" stroke-linecap="round"/>
      <path d="M106 34 C122 18 146 20 152 30 C138 40 120 42 106 34 Z" fill="#3fa82c" stroke="#123d0b" stroke-width="3"/>
      <path d="M78 108 c0 -16 44 -16 44 0 c0 10 -6 14 -8 18 h-28 c-2 -4 -8 -8 -8 -18z" fill="#e9ffd9" opacity="0.85"/>
      <circle cx="91" cy="108" r="5" fill="#3a1206"/><circle cx="109" cy="108" r="5" fill="#3a1206"/>
      <path d="M92 126 v6 M100 126 v6 M108 126 v6" stroke="#3a1206" stroke-width="3"/>
      ${gloss(62, 80, 15, 9)}
    </g>`, radial('g', [[0, '#ff7a5c'], [0.5, '#a3120a'], [1, '#3d0500']]) + shadow),

  // Eyeball Gumball: a bloodshot eyeball gumball.
  EY: svg(200, 200, `
    <g filter="url(#sh)">
      <circle cx="100" cy="100" r="74" fill="url(#g)" stroke="#5a2020" stroke-width="5"/>
      <path d="M30 92 q20 4 34 -6 M36 128 q16 -6 28 2 M170 96 q-18 6 -32 -2 M164 132 q-16 -8 -28 0 M100 28 q-6 18 4 30" fill="none" stroke="#d61f2c" stroke-width="3" stroke-linecap="round"/>
      <circle cx="108" cy="104" r="34" fill="url(#iris)" stroke="#0d2d1a" stroke-width="3"/>
      <circle cx="108" cy="104" r="15" fill="#050505"/>
      <circle cx="98" cy="94" r="6" fill="#fff"/>
      ${gloss(70, 60, 18, 10)}
    </g>`, radial('g', [[0, '#ffffff'], [0.7, '#f1e6d8'], [1, '#c9a98f']]) + radial('iris', [[0, '#9cff8a'], [0.6, '#1f9b4a'], [1, '#0a3b1c']], '50%', '50%', '60%') + shadow),

  // Pumpkin Bonbon: a round orange bonbon in a twisted wrapper.
  PU: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M52 100 L12 64 Q6 100 12 136 Z M148 100 L188 64 Q194 100 188 136 Z" fill="url(#wrap)" stroke="#3a1a50" stroke-width="5" stroke-linejoin="round"/>
      <path d="M22 80 l18 14 M22 120 l18 -14 M178 80 l-18 14 M178 120 l-18 -14" stroke="#3a1a50" stroke-width="3" opacity="0.6"/>
      <circle cx="100" cy="100" r="56" fill="url(#g)" stroke="#5a2400" stroke-width="5"/>
      <path d="M100 44 C80 70 80 130 100 156 M100 44 C120 70 120 130 100 156 M62 60 C52 84 52 116 62 140 M138 60 C148 84 148 116 138 140" fill="none" stroke="#b84a00" stroke-width="4" opacity="0.7"/>
      ${gloss(80, 74, 16, 9)}
    </g>`, radial('g', [[0, '#ffd27a'], [0.5, '#ff8a00'], [1, '#a83c00']]) + linear('wrap', [[0, '#c78bff'], [1, '#5e1d9c']]) + shadow),

  // Gummy Bat: a purple translucent bat gummy.
  BT: svg(200, 200, `
    <g filter="url(#sh)">
      <path d="M100 66 C110 66 116 74 118 82 C138 60 168 58 190 76 C176 80 170 92 172 104 C160 98 148 102 144 114 C134 106 122 110 116 122 C112 132 106 140 100 146 C94 140 88 132 84 122 C78 110 66 106 56 114 C52 102 40 98 28 104 C30 92 24 80 10 76 C32 58 62 60 82 82 C84 74 90 66 100 66 Z" fill="url(#g)" stroke="#1f0436" stroke-width="5" stroke-linejoin="round"/>
      <path d="M86 70 l-6 -16 l14 10 z M114 70 l6 -16 l-14 10 z" fill="#6a1ea8" stroke="#1f0436" stroke-width="3"/>
      <circle cx="90" cy="92" r="6" fill="#ffe14d"/><circle cx="110" cy="92" r="6" fill="#ffe14d"/>
      <path d="M92 110 l4 8 l4 -6 l4 6 l4 -8" fill="#fff" stroke="#1f0436" stroke-width="2"/>
      ${gloss(60, 80, 14, 5, -20, 0.45)} ${gloss(140, 80, 14, 5, 20, 0.45)}
    </g>`, radial('g', [[0, '#d39bff'], [0.5, '#7b25c4'], [1, '#2d0652']], '50%', '35%') + shadow),

  // Candy Corn: the classic tricolour kernel.
  CC: svg(200, 200, `
    <g filter="url(#sh)">
      <clipPath id="k"><path d="M100 18 C116 18 170 140 166 162 C162 182 38 182 34 162 C30 140 84 18 100 18 Z"/></clipPath>
      <g clip-path="url(#k)">
        <rect x="0" y="0" width="200" height="80" fill="#fff6e0"/>
        <rect x="0" y="80" width="200" height="56" fill="#ffb300"/>
        <rect x="0" y="136" width="200" height="64" fill="#ff6a00"/>
        <rect x="0" y="0" width="200" height="200" fill="url(#shade)"/>
      </g>
      <path d="M100 18 C116 18 170 140 166 162 C162 182 38 182 34 162 C30 140 84 18 100 18 Z" fill="none" stroke="#5a2400" stroke-width="5"/>
      ${gloss(84, 70, 6, 22, 15)}
    </g>`, linear('shade', [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(90,20,0,0.35)']], 1, 0) + shadow),

  // Skull Lollipop (scatter): a swirled skull lollipop on a stick.
  SC: svg(200, 200, `
    <g filter="url(#gl)">
      <rect x="93" y="120" width="14" height="74" rx="6" fill="#f4f0e8" stroke="#4a3a2a" stroke-width="3"/>
      <circle cx="100" cy="82" r="68" fill="url(#g)" stroke="#3d0060" stroke-width="5"/>
      <path d="M100 82 m0 -52 a52 52 0 1 1 -1 0 M100 82 m0 -36 a36 36 0 1 0 1 0 M100 82 m0 -20 a20 20 0 1 1 -1 0" fill="none" stroke="#ff4fd8" stroke-width="7" opacity="0.6"/>
      <path d="M68 78 c0 -30 64 -30 64 0 c0 14 -8 20 -10 26 h-44 c-2 -6 -10 -12 -10 -26z" fill="#fffaf0" stroke="#2a0040" stroke-width="4"/>
      <ellipse cx="87" cy="80" rx="9" ry="10" fill="#2a0040"/><ellipse cx="113" cy="80" rx="9" ry="10" fill="#2a0040"/>
      <path d="M100 90 l-5 9 h10 z" fill="#2a0040"/>
      <path d="M84 106 v8 M94 106 v8 M106 106 v8 M116 106 v8" stroke="#2a0040" stroke-width="3"/>
      ${gloss(66, 44, 16, 8)}
    </g>`, radial('g', [[0, '#ffb3f5'], [0.5, '#b31fd6'], [1, '#3d0060']]) + glow('gl', '#ff4fd8', 7)),

  // Jack-o'-Lantern multiplier: a carved, glowing pumpkin (value drawn by the client).
  JK: svg(200, 200, `
    <g filter="url(#gl)">
      <ellipse cx="58" cy="112" rx="40" ry="60" fill="url(#g)" stroke="#4a1a00" stroke-width="5"/>
      <ellipse cx="142" cy="112" rx="40" ry="60" fill="url(#g)" stroke="#4a1a00" stroke-width="5"/>
      <ellipse cx="100" cy="112" rx="46" ry="66" fill="url(#g)" stroke="#4a1a00" stroke-width="5"/>
      <path d="M94 50 C92 34 96 24 108 16" fill="none" stroke="#2f5a14" stroke-width="10" stroke-linecap="round"/>
      <path d="M58 92 l20 -16 l8 22 z M142 92 l-20 -16 l-8 22 z" fill="#fff36b" stroke="#4a1a00" stroke-width="3"/>
      <path d="M48 128 q52 44 104 0 l-10 4 l-6 -10 l-10 12 l-10 -10 l-10 12 l-8 -12 l-10 12 l-10 -10 l-10 10 l-6 -10 z" fill="#fff36b" stroke="#4a1a00" stroke-width="3"/>
    </g>`, radial('g', [[0, '#ffc266'], [0.55, '#ff6a00'], [1, '#8a2a00']]) + glow('gl', '#ffb300', 10)),
};

const scenes = {
  // Base background: a candy-coloured haunted night, full moon, hills, graveyard and lollipop trees.
  bg: svg(1920, 1080, `
    <rect width="1920" height="1080" fill="url(#sky)"/>
    ${Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 733) % 1920}" cy="${(i * 397) % 620}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.3 + (i % 5) / 8}"/>`).join('')}
    <circle cx="1500" cy="250" r="190" fill="url(#moonGlow)"/>
    <circle cx="1500" cy="250" r="120" fill="url(#moon)"/>
    <circle cx="1460" cy="220" r="18" fill="#e9d9a6" opacity="0.6"/><circle cx="1540" cy="290" r="26" fill="#e9d9a6" opacity="0.5"/><circle cx="1530" cy="200" r="10" fill="#e9d9a6" opacity="0.6"/>
    <path d="M0 760 C240 640 420 700 640 660 C900 610 1080 720 1320 650 C1560 590 1760 660 1920 620 V1080 H0 Z" fill="#3a1556"/>
    <path d="M0 860 C300 760 520 820 760 790 C1000 760 1260 850 1500 800 C1700 760 1820 790 1920 770 V1080 H0 Z" fill="#26093d"/>
    ${[[140, 760], [330, 800], [1590, 760], [1790, 780]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-6" y="-120" width="12" height="130" fill="#1a0429"/><circle cx="0" cy="-140" r="46" fill="#ff5fae" opacity="0.85"/><path d="M0 -140 m0 -36 a36 36 0 1 1 -1 0 M0 -140 m0 -20 a20 20 0 1 0 1 0" fill="none" stroke="#fff" stroke-width="8" opacity="0.7"/></g>`).join('')}
    ${[[420, 900], [560, 930], [1300, 910], [1440, 940], [240, 960], [1660, 950]].map(([x, y], i) => `<path d="M${x - 34} ${y} v-60 a34 34 0 0 1 68 0 v60 z" fill="#140221" opacity="0.95"/>${i % 2 ? `<path d="M${x} ${y - 70} v34 M${x - 12} ${y - 58} h24" stroke="#3b1a55" stroke-width="6"/>` : ''}`).join('')}
    <path d="M0 990 C400 950 700 1000 960 980 C1220 960 1500 1010 1920 970 V1080 H0 Z" fill="#100118"/>
    <rect width="1920" height="1080" fill="url(#vignette)"/>
  `, linear('sky', [[0, '#0b0326'], [0.45, '#2a0a4d'], [0.8, '#6a1b6e'], [1, '#c23b72']]) +
    radial('moon', [[0, '#fffbe6'], [0.8, '#f6e7b5'], [1, '#e2c983']], '40%', '40%', '70%') +
    radial('moonGlow', [[0, 'rgba(255,240,190,0.55)'], [1, 'rgba(255,240,190,0)']], '50%', '50%', '50%') +
    radial('vignette', [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.65)']], '50%', '50%', '75%')),

  // Board panel behind the 6x5 grid: a dark glass slab in a candy-cane frame.
  panel: svg(1200, 1000, `
    <rect x="18" y="18" width="1164" height="964" rx="48" fill="url(#cane)" />
    <rect x="40" y="40" width="1120" height="920" rx="34" fill="#160427" opacity="0.92"/>
    <rect x="40" y="40" width="1120" height="920" rx="34" fill="url(#inner)"/>
    ${Array.from({ length: 5 }, (_, i) => `<line x1="${40 + (i + 1) * 186.67}" y1="60" x2="${40 + (i + 1) * 186.67}" y2="940" stroke="#ff8ad8" stroke-opacity="0.08" stroke-width="3"/>`).join('')}
  `, `<pattern id="stripes" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="60" height="60" fill="#fff4f8"/><rect width="30" height="60" fill="#ff2e7e"/></pattern>` +
    `<linearGradient id="cane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ab8"/><stop offset="1" stop-color="#9b1fd1"/></linearGradient>` +
    radial('inner', [[0, 'rgba(160,60,220,0.35)'], [1, 'rgba(0,0,0,0)']], '50%', '40%', '70%')),

  // Witch on a broomstick (Witch's Spell).
  witch: svg(400, 260, `
    <g fill="#12021e">
      <path d="M20 170 L330 150 L334 160 L22 182 Z" fill="#6b3a1a"/>
      <path d="M300 140 l90 -10 l-10 20 l12 6 l-90 16 z" fill="#c98b3a"/>
      <path d="M150 160 C140 120 160 90 190 84 C214 80 236 100 236 128 L240 156 Z"/>
      <path d="M176 92 L206 10 L226 96 Z"/><path d="M160 96 h84 l-6 10 h-74 z"/>
      <circle cx="214" cy="104" r="16" fill="#7bd64a"/>
      <path d="M226 104 l14 6 l-14 4 z" fill="#7bd64a"/>
      <path d="M160 140 l-40 26 l50 -6 z"/>
    </g>
    <circle cx="218" cy="100" r="3" fill="#fff"/>
  `),

  // Ghost that jumps out on a "Trick".
  ghost: svg(260, 300, `
    <path d="M20 290 V120 C20 56 70 10 130 10 C190 10 240 56 240 120 V290 l-36 -26 l-37 30 l-37 -30 l-37 30 l-37 -30 Z" fill="#f4f7ff" stroke="#8aa0d6" stroke-width="6"/>
    <ellipse cx="94" cy="120" rx="22" ry="32" fill="#130a2a"/><ellipse cx="166" cy="120" rx="22" ry="32" fill="#130a2a"/>
    <ellipse cx="130" cy="200" rx="34" ry="44" fill="#130a2a"/>
  `),

  // Cauldron for the multiplier meter.
  cauldron: svg(260, 220, `
    <ellipse cx="130" cy="70" rx="110" ry="28" fill="#2b0b3d" stroke="#0b0012" stroke-width="6"/>
    <ellipse cx="130" cy="66" rx="96" ry="20" fill="url(#brew)"/>
    <circle cx="96" cy="58" r="10" fill="#c7ff8a" opacity="0.8"/><circle cx="150" cy="54" r="7" fill="#c7ff8a" opacity="0.8"/><circle cx="128" cy="44" r="5" fill="#c7ff8a" opacity="0.7"/>
    <path d="M24 74 C20 150 60 200 130 200 C200 200 240 150 236 74 C210 96 50 96 24 74 Z" fill="url(#pot)" stroke="#0b0012" stroke-width="6"/>
    <path d="M60 196 l-16 20 M200 196 l16 20" stroke="#0b0012" stroke-width="12" stroke-linecap="round"/>
    <ellipse cx="80" cy="120" rx="16" ry="30" fill="#fff" opacity="0.08"/>
  `, radial('brew', [[0, '#d8ff7a'], [1, '#33a100']], '50%', '50%', '60%') + linear('pot', [[0, '#3a2a4a'], [1, '#0e0716']])),

  // Loot Box: a glossy candy-wrapped gift box with a ribbon, bow and a skull tag.
  loot_box: svg(240, 260, `
    <g filter="url(#sh)">
      <rect x="22" y="104" width="196" height="140" rx="16" fill="url(#body)" stroke="#3a0a55" stroke-width="6"/>
      <rect x="12" y="74" width="216" height="46" rx="12" fill="url(#lid)" stroke="#3a0a55" stroke-width="6"/>
      <rect x="104" y="74" width="32" height="170" fill="url(#rib)" stroke="#7a4a00" stroke-width="3"/>
      <rect x="12" y="150" width="216" height="26" fill="url(#rib)" stroke="#7a4a00" stroke-width="3" opacity="0.95"/>
      <path d="M120 74 C88 30 44 34 58 62 C66 78 96 78 120 74 Z M120 74 C152 30 196 34 182 62 C174 78 144 78 120 74 Z" fill="url(#rib)" stroke="#7a4a00" stroke-width="4"/>
      <circle cx="120" cy="72" r="13" fill="#ffd34d" stroke="#7a4a00" stroke-width="4"/>
      <g transform="translate(176 196) rotate(12)"><rect x="-22" y="-16" width="44" height="34" rx="8" fill="#fff6e0" stroke="#3a0a55" stroke-width="3"/><circle cx="-8" cy="-2" r="5" fill="#3a0a55"/><circle cx="8" cy="-2" r="5" fill="#3a0a55"/><path d="M-8 10 h16" stroke="#3a0a55" stroke-width="3"/></g>
      ${[[48, 128], [70, 210], [196, 126], [40, 186]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff" opacity="0.35"/>`).join('')}
      ${gloss(60, 92, 26, 8, -8, 0.5)}
    </g>`, linear('body', [[0, '#ff5fbf'], [1, '#8a0f6a']]) + linear('lid', [[0, '#ff9ad6'], [1, '#c2187f']]) + linear('rib', [[0, '#fff3a0'], [0.5, '#ffc62e'], [1, '#d18a00']], 1, 0) + shadow),

  // Front door for Trick or Treat.
  door: svg(200, 300, `
    <rect x="6" y="6" width="188" height="288" rx="90" ry="70" fill="#4a1d0a" stroke="#1a0800" stroke-width="10"/>
    <rect x="26" y="40" width="148" height="240" rx="70" ry="54" fill="url(#wood)"/>
    <path d="M100 40 V280 M26 160 H174" stroke="#2a0e02" stroke-width="6"/>
    <circle cx="150" cy="172" r="10" fill="#f5c542" stroke="#6a4a00" stroke-width="3"/>
    <path d="M78 88 l22 -18 l22 18 v22 h-44 z" fill="#ffb300" opacity="0.9"/>
    <path d="M60 230 q40 22 80 0" fill="none" stroke="#ff7a00" stroke-width="5" opacity="0.6"/>
  `, linear('wood', [[0, '#8a3d17'], [1, '#4a1d0a']], 1, 1)),
};

for (const [name, content] of Object.entries(symbols)) writeFileSync(join(OUT, `sym_${name}.svg`), content);
for (const [name, content] of Object.entries(scenes)) writeFileSync(join(OUT, `${name}.svg`), content);
console.log(`wrote ${Object.keys(symbols).length + Object.keys(scenes).length} assets to public/assets`);
