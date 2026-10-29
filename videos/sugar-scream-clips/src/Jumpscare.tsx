// Jumpscare clip: a dark, quiet scene with a heartbeat and a rising drone, then a monster
// slams into the camera (shake, strobe, RGB split, screech), then the logo.
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  random,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { art, Backdrop, Embers, Logo, outline, sfx, shake, Vignette } from "./parts";

export type JumpscareProps = {
  readonly background: string;
  readonly monster: string;
  readonly tease: string;
  readonly tagline: string;
  /** Seconds of calm before the scare. */
  readonly calm: number;
};

/** The calm before: a darkened, flickering scene that slowly pushes in. */
const Calm: React.FC<{ readonly background: string; readonly monster: string; readonly tease: string }> = ({ background, monster, tease }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // a guttering candle: brightness dips at a few irregular moments
  const flicker = 0.55 + 0.12 * Math.sin(frame / 3.1) * Math.sin(frame / 7.7) - (frame % 37 < 3 ? 0.18 : 0);
  return (
    <AbsoluteFill style={{ filter: `grayscale(0.45) brightness(${flicker.toFixed(3)})` }}>
      <Backdrop src={art(background)} zoomFrom={1.05} zoomTo={1.22} />
      <Embers color="#ff9a3c" count={20} seed={`${background}-calm`} />
      {/* something lurking far away, barely visible */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img
          src={art(monster)}
          style={{
            height: 260,
            opacity: interpolate(frame, [0, durationInFrames], [0, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            filter: "blur(3px) brightness(0.4)",
            translate: `${Math.sin(frame / 18) * 30}px 40px`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 130 }}>
        <Interactive.Div
          name="Tease"
          style={{
            fontFamily: "Creepster",
            fontSize: 96,
            letterSpacing: 4,
            color: "#e8e0ff",
            textShadow: "0 0 24px rgba(160, 120, 255, 0.8)",
            opacity: interpolate(frame, [0.4 * fps, 1.2 * fps], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {tease}
        </Interactive.Div>
      </AbsoluteFill>
      <Vignette strength={0.92} />
    </AbsoluteFill>
  );
};

/** The scare: the monster fills the screen with shake, strobe and an RGB split. */
const Scare: React.FC<{ readonly background: string; readonly monster: string }> = ({ background, monster }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = interpolate(frame, [0, 4, 0.9 * fps], [0.35, 1.55, 1.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: [Easing.out(Easing.cubic), Easing.linear],
  });
  const split = interpolate(frame, [0, 0.6 * fps], [38, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strobe = frame < 10 ? (frame % 4 < 2 ? "rgba(255, 30, 30, 0.55)" : "rgba(255, 255, 255, 0.35)") : "transparent";
  // the friendly candy art turns nasty: a white-hot flash, a two-frame blackout before it lunges
  // again, and a glitchy skew
  // inverted, the candy art becomes a black thing with glowing eyes; it flickers to a harsh silhouette
  const look = frame < 2
    ? "brightness(3) grayscale(1)"
    : frame % 9 === 4
      ? "grayscale(1) brightness(0.25) contrast(3) drop-shadow(0 0 80px rgba(255,0,0,0.9))"
      : "invert(1) grayscale(0.85) contrast(1.7) drop-shadow(0 0 60px rgba(255,0,0,0.85)) drop-shadow(0 0 140px rgba(160,0,0,0.6))";
  const blackout = frame === 6 || frame === 7;
  const glitch = `skewX(${((random(`skew-${frame}`) - 0.5) * (frame < 0.5 * fps ? 16 : 5)).toFixed(1)}deg) scaleY(${(1 + (random(`sy-${frame}`) - 0.5) * 0.12).toFixed(3)})`;
  const copy = (tint: string, dx: number) => ( // tint is a CSS filter chain that colours the copy
    <Img
      src={art(monster)}
      style={{
        position: "absolute",
        height: 900,
        scale: size,
        translate: `${dx}px 0px`,
        filter: tint,
        mixBlendMode: "screen",
        opacity: 0.65,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#100000", overflow: "hidden", translate: shake(frame, 0, 0.9 * fps, 46, monster) }}>
      <Backdrop src={art(background)} zoomFrom={1.4} zoomTo={1.5} dim={0.5} style={{ filter: "saturate(2) hue-rotate(-20deg) brightness(0.6)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", transform: glitch, opacity: blackout ? 0 : 1 }}>
          {copy("sepia(1) saturate(9) hue-rotate(-45deg) brightness(0.9)", -split)}
          {copy("sepia(1) saturate(9) hue-rotate(140deg) brightness(0.9)", split)}
          <Img name="Monster" src={art(monster)} style={{ position: "absolute", height: 900, scale: size * (frame > 7 ? 1.12 : 1), filter: look }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: strobe }} />
      <Vignette strength={0.85} />
    </AbsoluteFill>
  );
};

/** After the scare: the logo out of the dark. */
const Sting: React.FC<{ readonly tagline: string }> = ({ tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#050008", justifyContent: "center", alignItems: "center", gap: 40 }}>
      <Logo at={0.25 * fps} size={210} />
      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily: "Fredoka",
          fontWeight: 700,
          fontSize: 88,
          color: "#ffd34d",
          textShadow: outline(6, "#5a1300"),
          opacity: interpolate(frame, [0.8 * fps, 1.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {tagline}
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const Jumpscare: React.FC<JumpscareProps> = ({ background, monster, tease, tagline, calm }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scareAt = Math.round(calm * fps);
  const stingAt = scareAt + Math.round(1.0 * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence name="Calm" durationInFrames={scareAt}>
        <Calm background={background} monster={monster} tease={tease} />
      </Sequence>
      <Sequence name="Scare" from={scareAt} durationInFrames={stingAt - scareAt}>
        <Scare background={background} monster={monster} />
      </Sequence>
      <Sequence name="Logo" from={stingAt}>
        <Sting tagline={tagline} />
      </Sequence>
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.4 * fps, durationInFrames], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      <Audio name="Heartbeat" src={sfx("heartbeat")} volume={0.9} />
      <Audio name="Wind" src={sfx("portal")} from={0.3 * fps} volume={0.35} />
      <Audio name="Riser" src={sfx("riser")} from={scareAt - Math.round(2.55 * fps)} volume={0.55} />
      <Audio name="Screech" src={sfx("screech")} from={scareAt} volume={1} />
      <Audio name="Impact" src={sfx("impact")} from={scareAt} volume={1} />
      <Audio name="Ghost" src={sfx("boo")} from={scareAt + 2} volume={0.8} />
      <Audio name="Logo bell" src={sfx("scatter")} from={stingAt + Math.round(0.25 * fps)} volume={0.7} />
      <Audio name="Cackle" src={sfx("spell")} from={stingAt + Math.round(0.6 * fps)} volume={0.6} />
    </AbsoluteFill>
  );
};
