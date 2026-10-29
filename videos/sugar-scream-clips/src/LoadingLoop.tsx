// Loading-screen loop: the painted loading art breathing, the brew glowing, embers rising and
// candies drifting down the sides. Every motion is periodic over the clip, so it
// loops seamlessly; it has no sound (browsers block sound before the first tap).
import { AbsoluteFill, Img, random, useCurrentFrame, useVideoConfig } from "remotion";
import { art, SYMBOLS } from "./parts";

const TAU = Math.PI * 2;

/** Embers that rise and wrap around exactly once (or twice) per loop. */
const LoopEmbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const span = height + 100;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 46 }, (_, i) => {
        const laps = 1 + Math.floor(random(`le-v-${i}`) * 2);
        const y = ((((random(`le-y-${i}`) - (frame / durationInFrames) * laps) % 1) + 1) % 1) * span - 50;
        const x = random(`le-x-${i}`) * width + Math.sin((frame / durationInFrames) * TAU * 2 + i) * 16;
        const s = 4 + random(`le-s-${i}`) * 8;
        const color = i % 3 === 0 ? "#9dff4a" : i % 3 === 1 ? "#ff9ad8" : "#ffd34d";
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
              opacity: 0.4 + 0.45 * Math.abs(Math.sin((frame / durationInFrames) * TAU * 3 + i)),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Candies drifting down the sides of the screen (clear of the painted logo in the middle). */
const SideCandies: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const portrait = height > width;
  const span = height + 360;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 14 }, (_, i) => {
        const left = i % 2 === 0;
        const band = portrait ? 0.2 : 0.2;
        const x = (left ? random(`sc-x-${i}`) * band : 1 - band + random(`sc-x-${i}`) * band) * width;
        const y = (((random(`sc-y-${i}`) + frame / durationInFrames) % 1) * span) - 180;
        const size = 90 + random(`sc-s-${i}`) * 70;
        const turns = (random(`sc-r-${i}`) < 0.5 ? -1 : 1) * (1 + Math.floor(random(`sc-t-${i}`) * 2));
        return (
          <Img
            key={i}
            src={art(`sym_${SYMBOLS[i % SYMBOLS.length]}`)}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y,
              width: size,
              height: size,
              rotate: `${(frame / durationInFrames) * 360 * turns}deg`,
              opacity: 0.85,
              filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.45))",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const LoadingLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const portrait = height > width;
  const phase = (frame / durationInFrames) * TAU;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326" }}>
      {/* the painted loading art; in portrait it is shown whole (the logo spans its width) over a
          blurred copy, rather than cropped */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {portrait ? (
          <Img src={art("bg_loading")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(28px) brightness(0.45) saturate(1.3)", scale: 1.15 }} />
        ) : null}
        <Img
          name="Loading art"
          src={art("bg_loading")}
          style={{
            position: "absolute",
            // portrait: 150% wide, so the logo (the middle 56% of the art) still fits the width
            width: portrait ? "150%" : "100%",
            left: portrait ? "-25%" : 0,
            height: portrait ? "auto" : "100%",
            top: portrait ? "18%" : 0,
            maskImage: portrait ? "linear-gradient(transparent, black 14%, black 84%, transparent)" : undefined,
            objectFit: "cover",
            scale: 1.05 + Math.sin(phase) * 0.025,
            filter: `brightness(${(1 + Math.sin(phase * 2) * 0.05).toFixed(3)})`,
          }}
        />
      </AbsoluteFill>
      {/* the brew in the cauldron glows and pulses */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            top: portrait ? `${18 + 0.62 * ((1.5 * width * 941) / 1672 / height) * 100}%` : "60%",
            width: portrait ? "90%" : "44%",
            aspectRatio: "3 / 1",
            translate: "0 -50%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(157, 255, 74, 0.55), rgba(157, 255, 74, 0) 70%)",
            mixBlendMode: "screen",
            opacity: 0.55 + Math.sin(phase * 3) * 0.35,
            scale: 1 + Math.sin(phase * 3) * 0.06,
          }}
        />
      </AbsoluteFill>
      <SideCandies />
      <LoopEmbers />
      {/* keep the bottom dark enough for the progress bar and its text */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 62%, rgba(8, 0, 20, 0.75) 100%)" }} />
    </AbsoluteFill>
  );
};
