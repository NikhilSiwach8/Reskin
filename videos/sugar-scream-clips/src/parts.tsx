// Shared building blocks for the Sugar Scream clips: fonts, backdrops, rays, the candy
// fountain, the logo, screen shake and flashes. Art and audio come from the game
// (games/sugar-scream/public/assets), copied into public/.
import { loadFont } from "@remotion/fonts";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

loadFont({ family: "Creepster", url: staticFile("fonts/Creepster.woff2") });
loadFont({ family: "Luckiest Guy", url: staticFile("fonts/LuckiestGuy.woff2") });
loadFont({ family: "Fredoka", url: staticFile("fonts/Fredoka-500.woff2"), weight: "500" });
loadFont({ family: "Fredoka", url: staticFile("fonts/Fredoka-700.woff2"), weight: "700" });

export const art = (name: string) => staticFile(`art/${name}.webp`);
export const sfx = (name: string) => staticFile(`sfx/${name}.wav`);
export const music = (name: string) => staticFile(`music/${name}.mp3`);

export const SYMBOLS = ["BH", "WP", "SL", "GM", "PA", "EY", "PU", "BT", "CC", "JK", "SC"];

/** A painted background that slowly pushes in (Ken Burns). */
export const Backdrop: React.FC<{
  readonly src: string;
  readonly zoomFrom?: number;
  readonly zoomTo?: number;
  readonly dim?: number;
  readonly style?: React.CSSProperties;
}> = ({ src, zoomFrom = 1.05, zoomTo = 1.15, dim = 0, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      {dim > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(8, 0, 20, ${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

/** Rotating light rays behind a win or a title. */
export const Rays: React.FC<{ readonly color?: string; readonly opacity?: number }> = ({
  color = "rgba(255, 211, 77, 0.22)",
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", overflow: "hidden", opacity }}>
      <div
        style={{
          width: 3200,
          height: 3200,
          borderRadius: "50%",
          background: `repeating-conic-gradient(${color} 0deg 9deg, transparent 9deg 20deg)`,
          maskImage: "radial-gradient(circle, black 15%, transparent 62%)",
          rotate: `${frame * 0.6}deg`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Dark edges that pull the eye to the centre. */
export const Vignette: React.FC<{ readonly strength?: number }> = ({ strength = 0.75 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, ${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** A full-screen flash that fades out from `at` over `frames`. */
export const Flash: React.FC<{ readonly at: number; readonly frames?: number; readonly color?: string; readonly peak?: number }> = ({
  at,
  frames = 10,
  color = "white",
  peak = 0.9,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + frames], [0, peak, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return o > 0 ? <AbsoluteFill style={{ backgroundColor: color, opacity: o }} /> : null;
};

/** Screen-shake offset at a frame: random jitter that decays after `at`. */
export const shake = (frame: number, at: number, frames: number, amount: number, seed = "shake") => {
  if (frame < at || frame > at + frames) return "0px 0px";
  const k = 1 - (frame - at) / frames;
  const x = (random(`${seed}-x-${frame}`) - 0.5) * 2 * amount * k;
  const y = (random(`${seed}-y-${frame}`) - 0.5) * 2 * amount * k;
  return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
};

/**
 * Candies and gold coins bursting up from the bottom centre and falling back under gravity.
 * One template for the whole fountain (a loop of particles, not individually editable clips).
 */
export const Fountain: React.FC<{ readonly start?: number; readonly count?: number; readonly seed?: string; readonly coins?: number }> = ({
  start = 0,
  count = 70,
  seed = "fountain",
  coins = 0.45,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const items = [];
  for (let i = 0; i < count; i++) {
    const delay = random(`${seed}-d-${i}`) * 2.2 * fps;
    const t = (frame - start - delay) / fps;
    if (t < 0 || t > 2.6) continue;
    const vx = (random(`${seed}-vx-${i}`) - 0.5) * 1500;
    const vy = -(1200 + random(`${seed}-vy-${i}`) * 900);
    const g = 1700;
    const x = width / 2 + vx * t;
    const y = height + 60 + vy * t + 0.5 * g * t * t;
    if (y > height + 200) continue;
    const size = 70 + random(`${seed}-s-${i}`) * 70;
    const spin = (random(`${seed}-r-${i}`) - 0.5) * 720 * t;
    const coin = random(`${seed}-c-${i}`) < coins;
    const sym = SYMBOLS[Math.floor(random(`${seed}-k-${i}`) * 9)];
    items.push(
      coin ? (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x - size * 0.3,
            top: y - size * 0.3,
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #fff6b0, #ffd34d 40%, #c98a00 75%, #7a4a00)",
            boxShadow: "0 0 14px rgba(255, 211, 77, 0.8)",
            rotate: `${spin}deg`,
            scale: `${Math.cos(t * 9 + i)} 1`,
          }}
        />
      ) : (
        <Img
          key={i}
          src={art(`sym_${sym}`)}
          style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, rotate: `${spin}deg` }}
        />
      ),
    );
  }
  return <AbsoluteFill style={{ overflow: "hidden" }}>{items}</AbsoluteFill>;
};

/** Floating sparkles or embers drifting up through a scene. */
export const Embers: React.FC<{ readonly color?: string; readonly count?: number; readonly seed?: string }> = ({
  color = "#ffd34d",
  count = 40,
  seed = "embers",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const speed = 1.2 + random(`${seed}-v-${i}`) * 2.4;
        const y = ((random(`${seed}-y-${i}`) * (height + 100) - frame * speed) % (height + 100) + height + 100) % (height + 100) - 50;
        const x = random(`${seed}-x-${i}`) * width + Math.sin(frame / 20 + i) * 18;
        const s = 4 + random(`${seed}-s-${i}`) * 8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: `0 0 ${s * 2}px ${color}`,
              opacity: 0.35 + 0.5 * Math.abs(Math.sin(frame / 12 + i)),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** The game's painted logo, punching in at `at`. */
export const Logo: React.FC<{ readonly at?: number; readonly size?: number; readonly style?: React.CSSProperties }> = ({
  at = 0,
  size = 200,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // the painted wordmark (the game's ui_logo, lifted off its loading art), slammed in at `at`
  return (
    <Img
      name="Logo"
      src={art("ui_logo")}
      style={{
        height: size * 1.6,
        filter: "drop-shadow(0 14px 22px rgba(0, 0, 0, 0.6))",
        scale: interpolate(frame, [at, at + 0.45 * fps], [2.4, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 12 }),
          output: "perceptual-scale",
        }),
        opacity: interpolate(frame, [at, at + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        ...style,
      }}
    />
  );
};

/** Where a fraction of a cover-fitted image lands on screen (for features painted into the art). */
export const coverPoint = (imgW: number, imgH: number, W: number, H: number, fx: number, fy: number) => {
  const sc = Math.max(W / imgW, H / imgH);
  return { x: (W - imgW * sc) / 2 + fx * imgW * sc, y: (H - imgH * sc) / 2 + fy * imgH * sc };
};

/** Big outlined Fredoka text for amounts and captions. */
export const outline = (px: number, color: string) =>
  `0 ${px}px 0 ${color}, 0 0 ${px * 6}px rgba(0, 0, 0, 0.75)`;
