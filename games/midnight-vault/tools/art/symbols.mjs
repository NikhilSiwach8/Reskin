// Reel symbols, 512x512, transparent background.
import { C, OUT, dropShadow, gloss, glowFilter, goldDefs, id, linear, poly, radial, sparkle, svg } from './lib.mjs';

const S = 512;

function relic() {
  const [gd, gold, golddk] = goldDefs();
  const glow = id('f'), sh = id('s'), em = id('em'), emd = id('emd'), back = id('bk'), aura = id('au');
  const [g1, gl1] = gloss(200, 170, 70, 26, -25, 0.8);
  const corner = (x, y, sx, sy) =>
    `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="M0 0 C40 -6 70 6 84 34 C60 26 40 30 30 52 C24 30 10 16 -6 12 Z" fill="url(#${gold})" ${OUT} stroke-width="7"/>`;
  return svg(S, S, [...gd, g1, glowFilter(glow, C.green, 16, 0.9), dropShadow(sh),
    linear(em, [[0, '#E8FFF0'], [0.35, '#8CFFB5'], [0.7, '#1FBF66'], [1, '#0A6B3A']]),
    linear(emd, [[0, '#2FD37A'], [1, '#04502A']]),
    radial(back, [[0, '#16402C'], [1, '#0B1612']]),
    radial(aura, [[0, C.green, 0.55], [1, C.green, 0]]),
  ], [
    `<circle cx="256" cy="256" r="236" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    `<rect x="62" y="62" width="388" height="388" rx="56" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<rect x="96" y="96" width="320" height="320" rx="36" fill="url(#${golddk})" ${OUT} stroke-width="6"/>`,
    `<rect x="112" y="112" width="288" height="288" rx="28" fill="url(#${back})" ${OUT} stroke-width="6"/>`,
    corner(70, 70, 1, 1), corner(442, 70, -1, 1), corner(70, 442, 1, -1), corner(442, 442, -1, -1),
    ...[[256, 70], [256, 442], [70, 256], [442, 256]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="${C.green}" ${OUT} stroke-width="6"/>`),
    `</g>`,
    `<g filter="url(#${glow})">`,
    `<polygon points="256,128 352,196 352,316 256,392 160,316 160,196" fill="url(#${em})" ${OUT} stroke-width="10"/>`,
    `<polygon points="256,128 352,196 256,226 160,196" fill="#C9FFDC" opacity="0.85"/>`,
    `<polygon points="160,196 256,226 256,392 160,316" fill="url(#${emd})" opacity="0.55"/>`,
    `<polygon points="256,226 352,196 352,316 256,392" fill="#0A6B3A" opacity="0.35"/>`,
    `<polyline points="160,196 256,226 352,196 M256,226 256,392" fill="none" stroke="#E8FFF0" stroke-width="4" opacity="0.7"/>`,
    `<polygon points="256,128 352,196 352,316 256,392 160,316 160,196" fill="none" ${OUT} stroke-width="10"/>`,
    `</g>`,
    gl1,
    sparkle(392, 118, 26), sparkle(118, 396, 18, C.green), sparkle(400, 404, 14, C.green, 0.8),
  ]);
}

function key() {
  const [gd, gold] = goldDefs();
  const glow = id('f'), sh = id('s'), em = id('em'), aura = id('au');
  const [g1, gl1] = gloss(190, 150, 46, 18, -40, 0.8);
  return svg(S, S, [...gd, glowFilter(glow, C.green, 14, 0.85), dropShadow(sh), g1,
    radial(em, [[0, '#E8FFF0'], [0.5, '#3BE58A'], [1, '#08713E']]),
    radial(aura, [[0, C.green, 0.4], [1, C.green, 0]]),
  ], [
    `<circle cx="256" cy="256" r="230" fill="url(#${aura})"/>`,
    `<g filter="url(#${glow})"><g filter="url(#${sh})" transform="rotate(-38 256 256)">`,
    // shaft and bit
    `<rect x="236" y="190" width="40" height="270" rx="14" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<path d="M276 372 H340 V400 H312 V420 H340 V452 H276 Z" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<rect x="226" y="230" width="60" height="22" rx="8" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    // ornate bow
    `<path d="M256 40 C318 40 362 84 362 138 C362 196 314 226 256 226 C198 226 150 196 150 138 C150 84 194 40 256 40 Z" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<path d="M256 62 C300 62 336 94 336 136 C336 180 302 204 256 204 C210 204 176 180 176 136 C176 94 212 62 256 62 Z" fill="#5A3608" ${OUT} stroke-width="6"/>`,
    `<path d="M214 22 L256 6 L298 22 L282 52 H230 Z" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<polygon points="${poly(256, 134, 52, 6, Math.PI / 6)}" fill="url(#${em})" ${OUT} stroke-width="8"/>`,
    `<polygon points="${poly(256, 128, 24, 6, Math.PI / 6)}" fill="#E8FFF0" opacity="0.7"/>`,
    `</g></g>`,
    gl1,
    sparkle(398, 120, 22), sparkle(110, 400, 16, C.green),
  ]);
}

function vaultDoor() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), steel = id('st'), steel2 = id('st2'), seam = id('sm'), aura = id('au');
  const [g1, gl1] = gloss(180, 150, 80, 26, -30, 0.45);
  const rivets = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<circle cx="${(256 + 196 * Math.cos(a)).toFixed(1)}" cy="${(256 + 196 * Math.sin(a)).toFixed(1)}" r="10" fill="url(#${gold})" ${OUT} stroke-width="4"/>`;
  });
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * 360;
    return `<g transform="rotate(${a} 256 256)"><rect x="248" y="112" width="16" height="100" rx="6" fill="url(#${gold})" ${OUT} stroke-width="6"/><circle cx="256" cy="108" r="20" fill="url(#${gold})" ${OUT} stroke-width="7"/></g>`;
  });
  return svg(S, S, [...gd, dropShadow(sh), g1,
    linear(steel, [[0, '#6E6680'], [0.5, '#3A3348'], [1, '#1C1726']]),
    radial(steel2, [[0, '#4A4060'], [1, '#191424']]),
    radial(seam, [[0.82, C.green, 0], [0.9, C.green, 0.95], [1, C.green, 0]]),
    radial(aura, [[0.6, C.green, 0.35], [1, C.green, 0]]),
  ], [
    `<circle cx="256" cy="256" r="250" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    `<circle cx="256" cy="256" r="226" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<circle cx="256" cy="256" r="210" fill="url(#${steel})" ${OUT} stroke-width="6"/>`,
    ...rivets,
    `<circle cx="256" cy="256" r="172" fill="url(#${steel2})" ${OUT} stroke-width="8"/>`,
    `<circle cx="256" cy="256" r="172" fill="url(#${seam})"/>`,
    `<circle cx="256" cy="256" r="150" fill="none" stroke="${C.green}" stroke-width="5" opacity="0.8"/>`,
    ...spokes,
    `<circle cx="256" cy="256" r="58" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    // skull hub
    `<path d="M256 222 C280 222 296 238 296 258 C296 272 288 280 282 284 V296 H230 V284 C224 280 216 272 216 258 C216 238 232 222 256 222Z" fill="${C.ivory}" ${OUT} stroke-width="6"/>`,
    `<ellipse cx="241" cy="258" rx="10" ry="12" fill="${C.outline}"/><ellipse cx="271" cy="258" rx="10" ry="12" fill="${C.outline}"/>`,
    `<circle cx="241" cy="259" r="4" fill="${C.green}"/><circle cx="271" cy="259" r="4" fill="${C.green}"/>`,
    `</g>`,
    gl1,
  ]);
}

function phantom() {
  const glow = id('f'), sh = id('s'), robe = id('rb'), inner = id('in'), aura = id('au'), eye = id('ey');
  const [g1, gl1] = gloss(200, 130, 60, 22, -25, 0.35);
  return svg(S, S, [glowFilter(glow, C.green, 10, 1), dropShadow(sh), g1,
    linear(robe, [[0, '#B48CFF'], [0.4, '#6A3FC4'], [1, '#2A1650']]),
    radial(inner, [[0, '#0B0614'], [1, '#1C1030']], 0.5, 0.45, 0.6),
    radial(aura, [[0, C.green, 0.35], [0.6, C.violet, 0.2], [1, C.violet, 0]]),
    radial(eye, [[0, '#FFFFFF'], [0.4, C.green], [1, '#1FBF66']]),
  ], [
    `<circle cx="256" cy="256" r="240" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    // cloak with wispy hem
    `<path d="M256 40 C352 40 404 120 410 220 C416 310 430 380 456 460 C420 448 400 470 372 452 C346 474 318 452 296 470 C272 450 240 472 216 452 C192 474 162 450 140 466 C116 448 92 462 60 456 C86 380 98 310 104 220 C110 120 160 40 256 40 Z" fill="url(#${robe})" ${OUT} stroke-width="12"/>`,
    // hood opening
    `<path d="M256 96 C318 96 352 150 352 214 C352 286 310 332 256 332 C202 332 160 286 160 214 C160 150 194 96 256 96 Z" fill="url(#${inner})" ${OUT} stroke-width="10"/>`,
    `<path d="M160 214 C170 150 206 110 256 108 C222 130 200 170 196 230 Z" fill="#000" opacity="0.4"/>`,
    // fold lines
    `<path d="M150 330 C170 380 168 420 162 452 M362 330 C342 380 344 420 350 452 M256 340 V460" fill="none" stroke="#2A1650" stroke-width="8" opacity="0.7"/>`,
    `</g>`,
    `<g filter="url(#${glow})">`,
    `<path d="M206 214 Q226 196 246 214 Q226 230 206 214Z" fill="url(#${eye})"/>`,
    `<path d="M266 214 Q286 196 306 214 Q286 230 266 214Z" fill="url(#${eye})"/>`,
    `</g>`,
    gl1,
    sparkle(410, 120, 18, C.green), sparkle(98, 150, 14, C.violet),
  ]);
}

function clock() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), face = id('fc'), aura = id('au'), glow = id('f');
  const [g1, gl1] = gloss(190, 170, 70, 24, -30, 0.6);
  const marks = Array.from({ length: 13 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 13) * Math.PI * 2;
    const r1 = 128, r2 = i === 0 ? 96 : 110;
    const x1 = 256 + r1 * Math.cos(a), y1 = 284 + r1 * Math.sin(a), x2 = 256 + r2 * Math.cos(a), y2 = 284 + r2 * Math.sin(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i === 0 ? C.green : C.gold}" stroke-width="${i === 0 ? 14 : 9}" stroke-linecap="round"/>`;
  });
  return svg(S, S, [...gd, dropShadow(sh), g1, glowFilter(glow, C.green, 8, 1),
    radial(face, [[0, '#7A4BD0'], [0.7, '#3A1F6E'], [1, '#1E0F3C']]),
    radial(aura, [[0.5, C.violet, 0.35], [1, C.violet, 0]]),
  ], [
    `<circle cx="256" cy="284" r="228" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    `<rect x="222" y="34" width="68" height="44" rx="14" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<circle cx="256" cy="40" r="26" fill="none" stroke="${C.outline}" stroke-width="22"/><circle cx="256" cy="40" r="26" fill="none" stroke="url(#${gold})" stroke-width="12"/>`,
    `<circle cx="256" cy="284" r="192" fill="url(#${gold})" ${OUT} stroke-width="12"/>`,
    `<circle cx="256" cy="284" r="162" fill="url(#${face})" ${OUT} stroke-width="8"/>`,
    `<circle cx="256" cy="284" r="146" fill="none" stroke="${C.gold}" stroke-width="3" opacity="0.6"/>`,
    `<g filter="url(#${glow})">${marks.join('')}</g>`,
    `<path d="M256 284 L256 186" stroke="${C.outline}" stroke-width="22" stroke-linecap="round"/><path d="M256 284 L256 186" stroke="url(#${gold})" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M256 284 L318 330" stroke="${C.outline}" stroke-width="22" stroke-linecap="round"/><path d="M256 284 L318 330" stroke="url(#${gold})" stroke-width="12" stroke-linecap="round"/>`,
    `<circle cx="256" cy="284" r="20" fill="url(#${gold})" ${OUT} stroke-width="7"/>`,
    `</g>`,
    gl1,
  ]);
}

function elixir() {
  const glow = id('f'), sh = id('s'), glass = id('gl'), liquid = id('lq'), cork = id('ck'), aura = id('au');
  const [g1, gl1] = gloss(200, 240, 30, 70, -15, 0.75);
  const bubbles = [[220, 330, 14], [280, 360, 10], [250, 300, 8], [300, 320, 12], [230, 390, 9]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E8FFF0" opacity="0.75"/>`);
  return svg(S, S, [glowFilter(glow, C.green, 18, 0.95), dropShadow(sh), g1,
    linear(glass, [[0, '#C9B8FF', 0.55], [1, '#5A3FA0', 0.65]], 0, 0, 1, 0),
    linear(liquid, [[0, '#C9FFDC'], [0.3, C.green], [1, '#0E8A49']]),
    linear(cork, [[0, '#C8955A'], [1, '#6E4520']]),
    radial(aura, [[0.3, C.green, 0.4], [1, C.green, 0]]),
  ], [
    `<circle cx="256" cy="300" r="220" fill="url(#${aura})"/>`,
    `<g filter="url(#${sh})">`,
    `<path d="M214 70 H298 V170 C366 196 412 254 412 324 C412 410 342 470 256 470 C170 470 100 410 100 324 C100 254 146 196 214 170 Z" fill="url(#${glass})" ${OUT} stroke-width="12"/>`,
    `<g filter="url(#${glow})"><path d="M122 300 C150 280 190 310 230 296 C270 282 300 304 340 290 C366 282 384 288 392 296 C398 312 400 318 400 326 C400 402 336 456 256 456 C176 456 112 402 112 326 C112 316 116 308 122 300 Z" fill="url(#${liquid})"/></g>`,
    ...bubbles,
    `<rect x="196" y="56" width="120" height="30" rx="12" fill="#8D79C8" ${OUT} stroke-width="9"/>`,
    `<path d="M220 18 H292 L300 62 H212 Z" fill="url(#${cork})" ${OUT} stroke-width="10"/>`,
    `<path d="M214 70 H298 V170 C366 196 412 254 412 324 C412 410 342 470 256 470 C170 470 100 410 100 324 C100 254 146 196 214 170 Z" fill="none" ${OUT} stroke-width="12"/>`,
    `</g>`,
    gl1,
    sparkle(400, 140, 22, C.green), sparkle(120, 170, 14),
  ]);
}

function ledger() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), cover = id('cv'), pages = id('pg'), glow = id('f');
  const [g1, gl1] = gloss(190, 150, 80, 24, -20, 0.4);
  return svg(S, S, [...gd, dropShadow(sh), g1, glowFilter(glow, C.green, 10, 1),
    linear(cover, [[0, '#7D4FC9'], [0.6, '#4A2A86'], [1, '#2A1650']]),
    linear(pages, [[0, '#FFF6DC'], [1, '#C9BB94']]),
  ], [
    `<g filter="url(#${sh})">`,
    `<path d="M120 112 L410 84 L430 410 L140 448 Z" fill="url(#${pages})" ${OUT} stroke-width="10"/>`,
    ...[0, 1, 2, 3].map((i) => `<path d="M${142 + i * 2} ${436 - i * 9} L${426 - i * 1} ${398 - i * 9}" stroke="#A8996F" stroke-width="3"/>`),
    `<path d="M86 96 L392 62 L412 392 L104 432 Z" fill="url(#${cover})" ${OUT} stroke-width="12"/>`,
    `<path d="M86 96 L130 92 L148 428 L104 432 Z" fill="#2A1650" opacity="0.6"/>`,
    ...[[92, 102, 1, 1], [386, 68, -1, 1], [406, 386, -1, -1], [110, 426, 1, -1]].map(([x, y, sx, sy]) =>
      `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="M0 0 H64 L50 16 H16 V50 L0 64 Z" fill="url(#${gold})" ${OUT} stroke-width="6"/>`),
    `<circle cx="252" cy="248" r="86" fill="url(#${gold})" ${OUT} stroke-width="10"/>`,
    `<circle cx="252" cy="248" r="66" fill="#2A1650" ${OUT} stroke-width="6"/>`,
    `<path d="M252 206 C278 206 294 222 294 244 C294 258 286 268 278 272 V286 H226 V272 C218 268 210 258 210 244 C210 222 226 206 252 206Z" fill="${C.ivory}" ${OUT} stroke-width="6"/>`,
    `<g filter="url(#${glow})"><ellipse cx="236" cy="244" rx="10" ry="12" fill="${C.green}"/><ellipse cx="268" cy="244" rx="10" ry="12" fill="${C.green}"/></g>`,
    `<path d="M240 276 V286 M252 276 V286 M264 276 V286" stroke="${C.outline}" stroke-width="4"/>`,
    `</g>`,
    gl1,
    sparkle(420, 120, 16, C.green),
  ]);
}

function chest() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), wood = id('wd'), lid = id('ld'), light = id('lt'), glow = id('f');
  const [g1, gl1] = gloss(180, 150, 90, 24, -10, 0.45);
  const coins = [[190, 196], [236, 178], [282, 186], [326, 198], [212, 214], [300, 214], [258, 206]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="14" fill="url(#${gold})" ${OUT} stroke-width="5"/>`);
  return svg(S, S, [...gd, dropShadow(sh), g1, glowFilter(glow, C.amber, 18, 0.8),
    linear(wood, [[0, '#8A4E2C'], [1, '#4A2414']]),
    linear(lid, [[0, '#A15F36'], [1, '#5A2C17']]),
    radial(light, [[0, '#FFF1B0', 0.95], [1, C.amber, 0]]),
  ], [
    `<ellipse cx="256" cy="190" rx="200" ry="110" fill="url(#${light})"/>`,
    `<g filter="url(#${sh})">`,
    // open lid behind
    `<path d="M88 214 L120 96 C180 66 332 66 392 96 L424 214 Z" fill="url(#${lid})" ${OUT} stroke-width="12"/>`,
    `<path d="M140 100 L120 214 M372 100 L392 214" stroke="url(#${gold})" stroke-width="26"/><path d="M140 100 L120 214 M372 100 L392 214" ${OUT} stroke-width="5" fill="none"/>`,
    `<g filter="url(#${glow})">${coins.join('')}</g>`,
    // body
    `<rect x="72" y="216" width="368" height="224" rx="26" fill="url(#${wood})" ${OUT} stroke-width="12"/>`,
    `<path d="M72 290 H440" stroke="#2E140A" stroke-width="6" opacity="0.6"/><path d="M72 360 H440" stroke="#2E140A" stroke-width="6" opacity="0.6"/>`,
    `<rect x="72" y="216" width="368" height="40" rx="14" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<rect x="124" y="216" width="40" height="224" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<rect x="348" y="216" width="40" height="224" fill="url(#${gold})" ${OUT} stroke-width="8"/>`,
    `<path d="M216 262 H296 V336 C296 360 278 376 256 376 C234 376 216 360 216 336 Z" fill="url(#${gold})" ${OUT} stroke-width="9"/>`,
    `<path d="M248 300 H264 V340 H248 Z M256 290 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0" fill="${C.outline}"/>`,
    `</g>`,
    gl1,
    sparkle(410, 118, 22), sparkle(110, 140, 16, C.amber),
  ]);
}

function goldBag() {
  const [gd, gold] = goldDefs();
  const sh = id('s'), sack = id('sk'), glow = id('f');
  const [g1, gl1] = gloss(200, 250, 60, 30, -30, 0.4);
  const coin = (x, y, r) => `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="url(#${gold})" ${OUT} stroke-width="6"/><ellipse cx="${x}" cy="${y}" rx="${r * 0.6}" ry="${r * 0.36}" fill="none" stroke="#9A6A1F" stroke-width="4"/></g>`;
  return svg(S, S, [...gd, dropShadow(sh), g1, glowFilter(glow, C.amber, 14, 0.75),
    radial(sack, [[0, '#C98A4E'], [0.6, '#8A5228'], [1, '#4A2810']], 0.4, 0.4, 0.7),
  ], [
    `<g filter="url(#${sh})">`,
    `<path d="M200 150 C120 196 76 270 84 350 C92 430 168 474 256 474 C344 474 420 430 428 350 C436 270 392 196 312 150 Z" fill="url(#${sack})" ${OUT} stroke-width="12"/>`,
    `<path d="M196 152 C170 120 176 82 206 70 C228 92 284 92 306 70 C336 82 342 120 316 152 Z" fill="url(#${sack})" ${OUT} stroke-width="11"/>`,
    `<path d="M186 150 C232 168 280 168 326 150" fill="none" stroke="${C.outline}" stroke-width="26" stroke-linecap="round"/><path d="M186 150 C232 168 280 168 326 150" fill="none" stroke="${C.gold}" stroke-width="14" stroke-linecap="round"/>`,
    `<circle cx="256" cy="330" r="66" fill="url(#${gold})" ${OUT} stroke-width="10"/><circle cx="256" cy="330" r="44" fill="none" stroke="#9A6A1F" stroke-width="6"/>`,
    `<path d="M256 300 L266 322 L290 324 L272 340 L278 364 L256 350 L234 364 L240 340 L222 324 L246 322 Z" fill="#FFF1B0" ${OUT} stroke-width="4"/>`,
    `</g>`,
    `<g filter="url(#${glow})">${[coin(232, 76, 30), coin(286, 60, 26), coin(258, 40, 22), coin(116, 446, 34), coin(404, 452, 30), coin(160, 470, 26)].join('')}</g>`,
    gl1,
    sparkle(400, 130, 22), sparkle(90, 210, 14, C.amber),
  ]);
}

// Chunky gem letters --------------------------------------------------------

const LETTERS = {
  A: 'M86 448 L198 64 H314 L426 448 H318 L298 378 H214 L194 448 Z M234 304 H278 L256 214 Z',
  K: 'M98 64 H196 V214 L298 64 H414 L290 238 L424 448 H306 L196 278 V448 H98 Z',
  Q: 'M256 58 C352 58 424 140 424 248 C424 304 404 352 370 388 L430 438 L376 484 L312 428 C294 434 276 438 256 438 C160 438 88 356 88 248 C88 140 160 58 256 58 Z M256 150 C214 150 184 192 184 248 C184 304 214 346 256 346 C298 346 328 304 328 248 C328 192 298 150 256 150 Z',
  J: 'M196 64 H424 V146 H376 V322 C376 410 318 454 238 454 C160 454 100 410 88 328 L184 312 C190 354 208 370 238 370 C268 370 282 350 282 314 V146 H196 Z',
  T: 'M44 144 L134 64 H208 V448 H118 V170 L64 204 Z M354 58 C426 58 474 136 474 254 C474 372 426 452 354 452 C282 452 234 372 234 254 C234 136 282 58 354 58 Z M354 146 C330 146 320 184 320 254 C320 324 330 364 354 364 C378 364 388 324 388 254 C388 184 378 146 354 146 Z',
};

const LETTER_COLORS = {
  A: ['#FFF3A6', '#FFC93A', '#C47A0C', '#6E3E04'],
  K: ['#FFB0A0', '#FF4A3A', '#B0161C', '#5E0810'],
  Q: ['#FFC2FF', '#E054FF', '#8A1FB8', '#43085E'],
  J: ['#D2FFB0', '#5CE84A', '#1C9A28', '#0B4A12'],
  T: ['#B8F2FF', '#3AC2FF', '#0E6CC8', '#06306A'],
};

/** Dark tile plate matching the painted symbol tiles (art/source/symbols-sheet.webp). */
function plate() {
  const rim = id('pr'), face = id('pf'), glow = id('pg');
  return {
    defs: [
      linear(rim, [[0, '#6A24A8'], [0.5, '#4A1580'], [1, '#2E0A58']]),
      radial(face, [[0, '#24123F'], [0.75, '#110828'], [1, '#08051A']]),
      radial(glow, [[0, '#9D66FF', 0.16], [1, '#9D66FF', 0]]),
    ],
    body: [
      `<rect x="4" y="4" width="504" height="504" rx="46" fill="url(#${rim})" stroke="#1A0533" stroke-width="6"/>`,
      `<rect x="24" y="24" width="464" height="464" rx="32" fill="url(#${face})" stroke="#2A0A50" stroke-width="5"/>`,
      `<rect x="34" y="34" width="444" height="444" rx="26" fill="url(#${glow})"/>`,
    ],
  };
}

function letter(ch) {
  const [c0, c1, c2, c3] = LETTER_COLORS[ch];
  const fill = id('lf'), top = id('lt'), sh = id('s'), clip = id('cl'), glow = id('f');
  const d = LETTERS[ch];
  const p = plate();
  return svg(S, S, [...p.defs, dropShadow(sh, 12, 6, 0.6), glowFilter(glow, c1, 12, 0.6),
    linear(fill, [[0, c0], [0.35, c1], [0.75, c2], [1, c3]]),
    linear(top, [[0, '#ffffff', 0.75], [1, '#ffffff', 0]]),
    `<clipPath id="${clip}"><path d="${d}" fill-rule="evenodd"/></clipPath>`,
  ], [
    ...p.body,
    `<g transform="translate(256 262) scale(0.86) translate(-256 -256)">`,
    `<g filter="url(#${glow})"><g filter="url(#${sh})">`,
    `<path d="${d}" fill-rule="evenodd" fill="${C.outline}" stroke="${C.outline}" stroke-width="34" stroke-linejoin="round"/>`,
    `<path d="${d}" fill-rule="evenodd" fill="url(#${fill})"/>`,
    `<g clip-path="url(#${clip})">`,
    `<rect x="0" y="40" width="512" height="200" fill="url(#${top})" opacity="0.6"/>`,
    `<path d="${d}" fill="none" stroke="${c3}" stroke-width="22" opacity="0.55" transform="translate(0 10)"/>`,
    `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.5" transform="translate(-3 -4)"/>`,
    `</g>`,
    `<path d="${d}" fill-rule="evenodd" fill="none" stroke="${C.outline}" stroke-width="10" stroke-linejoin="round"/>`,
    `</g></g>`,
    `</g>`,
    sparkle(ch === 'T' ? 440 : 420, 76, 14),
  ]);
}

export const SYMBOL_ASSETS = {
  sym_relic: relic,
  sym_key: key,
  sym_vaultdoor: vaultDoor,
  sym_phantom: phantom,
  sym_clock: clock,
  sym_elixir: elixir,
  sym_ledger: ledger,
  sym_chest: chest,
  sym_goldbag: goldBag,
  sym_a: () => letter('A'),
  sym_k: () => letter('K'),
  sym_q: () => letter('Q'),
  sym_j: () => letter('J'),
  sym_10: () => letter('T'),
};
