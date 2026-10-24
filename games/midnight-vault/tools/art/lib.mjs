// Shared SVG building blocks for the Midnight Vault art set.
// Style: chunky stylised 3D-cartoon, thick dark outlines, glossy highlights,
// controlled glow. Palette from the art direction brief.

export const C = {
  purple: '#20152F',
  midnight: '#100D1D',
  green: '#7DFFA8',
  ivory: '#E8E1CF',
  amber: '#F5A13A',
  gold: '#D7A544',
  crimson: '#D8423A',
  violet: '#9D66FF',
  outline: '#150A20',
};

let uid = 0;
export const id = (p) => `${p}${++uid}`;

export function svg(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<defs>${defs.join('')}</defs>\n${body.join('\n')}\n</svg>\n`;
}

export function linear(gid, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  return `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
}

export function radial(gid, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
  return `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`;
}

/** Soft coloured glow around the alpha of the element. */
export function glowFilter(fid, color, std = 14, strength = 1) {
  return `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="b"/>
<feFlood flood-color="${color}" flood-opacity="${strength}"/>
<feComposite in2="b" operator="in" result="g"/>
<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

export function blurFilter(fid, std) {
  return `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`;
}

export function dropShadow(fid, dy = 10, std = 8, opacity = 0.55) {
  return `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur in="SourceAlpha" stdDeviation="${std}"/><feOffset dy="${dy}" result="o"/>
<feFlood flood-color="#000" flood-opacity="${opacity}"/><feComposite in2="o" operator="in" result="s"/>
<feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

/** Standard gold material gradients. Returns [defs, fillId, darkId]. */
export function goldDefs() {
  const g = id('gold');
  const d = id('golddk');
  return [
    [
      linear(g, [[0, '#FFF1B0'], [0.25, '#F5C95A'], [0.55, C.gold], [0.8, '#9A6A1F'], [1, '#6B4410']]),
      linear(d, [[0, '#B8862E'], [1, '#5A3608']]),
    ],
    g,
    d,
  ];
}

/** A glossy white highlight ellipse. */
export function gloss(cx, cy, rx, ry, rot = -20, opacity = 0.55) {
  const gid = id('gl');
  return [
    radial(gid, [[0, '#ffffff', opacity], [1, '#ffffff', 0]]),
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${gid})" transform="rotate(${rot} ${cx} ${cy})"/>`,
  ];
}

/** Four-point sparkle. */
export function sparkle(x, y, r, color = '#ffffff', opacity = 0.9) {
  const k = r * 0.22;
  return `<path d="M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z" fill="${color}" opacity="${opacity}"/>`;
}

/** Regular polygon points. */
export function poly(cx, cy, r, n, rot = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Deterministic pseudo random for decorative scatter. */
export function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 0x100000000;
  };
}

export const OUT = `stroke="${C.outline}" stroke-linejoin="round" stroke-linecap="round"`;
