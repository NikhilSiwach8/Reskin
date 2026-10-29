// Bonus entry, the game's door transition as a clip: the candy tunnel and BONUS! banner, the
// haunted hallway, a knock, the doors creak open, the camera flies through the arch and the
// bonus world appears with its title.
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { art, Backdrop, coverPoint, Embers, Flash, music, outline, sfx, shake, Vignette } from "./parts";

export type BonusEntryProps = {
  readonly world: string;
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly track: string;
};

// The arch in the painted hallway (fractions of the 1672x941 image), as measured for the game.
const HOLE = { x0: 0.3738, y0: 0.1807, x1: 0.6232, y1: 0.7981 };
const WALL = { w: 1672, h: 941 };

/** The candy tunnel spinning towards the camera, with the BONUS! banner. */
const Tunnel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#08000f", overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
      <Img
        src={art("bg_portal_tunnel")}
        style={{
          position: "absolute",
          width: "130%",
          height: "130%",
          objectFit: "cover",
          rotate: `${frame * 2.2}deg`,
          scale: interpolate(frame, [0, 1.3 * fps], [1, 1.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
      <Img
        name="Bonus banner"
        src={art("panel_bonus_banner")}
        style={{
          width: Math.min(1100, width * 0.9),
          scale: interpolate(frame, [0, 0.4 * fps, 1.1 * fps, 1.3 * fps], [0.2, 1, 1.05, 2.2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.spring({ damping: 10 }), Easing.linear, Easing.in(Easing.cubic)],
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [1.1 * fps, 1.3 * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
        }}
      />
    </AbsoluteFill>
  );
};

/** The hallway: doors closed, a knock, the doors swing open, the camera flies through. */
const Hallway: React.FC<{ readonly world: string }> = ({ world }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // the wall is cover-fitted, so map the arch through the same crop at any aspect ratio
  const a = coverPoint(WALL.w, WALL.h, width, height, HOLE.x0, HOLE.y0);
  const b = coverPoint(WALL.w, WALL.h, width, height, HOLE.x1, HOLE.y1);
  const hole = { left: a.x, top: a.y, w: b.x - a.x, h: b.y - a.y };
  const cx = hole.left + hole.w / 2;
  const cy = hole.top + hole.h / 2;
  const open = interpolate(frame, [1.1 * fps, 1.9 * fps], [0, 105], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.3, 1),
  });
  // the camera dives through the arch: everything scales up around the doorway
  const dive = interpolate(frame, [1.8 * fps, 2.6 * fps], [1, 5.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
    output: "perceptual-scale",
  });
  const leaf = (side: "left" | "right") => (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "50%",
        [side]: 0,
        overflow: "hidden",
        transformOrigin: `${side} center`,
        rotate: `0 1 0 ${side === "left" ? -open : open}deg`,
        filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))",
        backfaceVisibility: "hidden",
      }}
    >
      {/* the leaves are cut from the painted double doors: the wood spans 17%..83% x 17%..99.5% */}
      <Img src={art("panel_portal_doors")} style={{ position: "absolute", width: "303.8%", height: "121.7%", top: "-21%", left: side === "left" ? "-51.7%" : "-151.7%", maxWidth: "none" }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#08000f", overflow: "hidden" }}>
      {/* the bonus world, seen through the doorway */}
      <Img
        src={art(world)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: interpolate(frame, [1.1 * fps, 2.6 * fps], [1.5, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
      <AbsoluteFill
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          scale: interpolate(frame, [0, 1.1 * fps], [1.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * dive,
          translate: shake(frame, 0.55 * fps, 8, 10, "knock"),
          opacity: interpolate(frame, [2.35 * fps, 2.6 * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <Img src={art("panel_portal_wall")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", left: hole.left, top: hole.top, width: hole.w, height: hole.h, perspective: 1600 }}>
          {leaf("left")}
          {leaf("right")}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle, transparent 30%, rgba(8,0,15,0.9) 100%)",
          opacity: interpolate(frame, [0, 1.8 * fps], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
    </AbsoluteFill>
  );
};

/** Arrival: the bonus world settles and its title lands. */
const Arrival: React.FC<{ readonly world: string; readonly title: string; readonly subtitle: string; readonly accent: string }> = ({ world, title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop src={art(world)} zoomFrom={1.15} zoomTo={1.02} dim={0.15} />
      <Embers color={accent} count={45} seed={world} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 20, paddingBottom: 60 }}>
        <Interactive.Div
          name="Bonus title"
          style={{
            maxWidth: "92%",
            fontFamily: "Creepster",
            fontSize: 190,
            lineHeight: 1,
            color: "white",
            letterSpacing: 6,
            textAlign: "center",
            textShadow: `0 0 40px ${accent}, 0 12px 0 rgba(0,0,0,0.6)`,
            scale: interpolate(frame, [0.15 * fps, 0.6 * fps], [2.2, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 11 }),
              output: "perceptual-scale",
            }),
            opacity: interpolate(frame, [0.15 * fps, 0.25 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {title}
        </Interactive.Div>
        <Interactive.Div
          name="Bonus subtitle"
          style={{
            maxWidth: "88%",
            textAlign: "center",
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: 72,
            color: "#ffd34d",
            textShadow: outline(6, "#5a1300"),
            translate: interpolate(frame, [0.6 * fps, 0.95 * fps], ["0px 60px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 14 }),
            }),
            opacity: interpolate(frame, [0.6 * fps, 0.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {subtitle}
        </Interactive.Div>
      </AbsoluteFill>
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};

export const BonusEntry: React.FC<BonusEntryProps> = ({ world, title, subtitle, accent, track }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#08000f" }}>
      <Sequence name="Tunnel" durationInFrames={1.3 * fps}>
        <Tunnel />
      </Sequence>
      <Sequence name="Hallway" from={1.3 * fps} durationInFrames={2.6 * fps}>
        <Hallway world={world} />
      </Sequence>
      <Sequence name="Arrival" from={3.85 * fps}>
        <Arrival world={world} title={title} subtitle={subtitle} accent={accent} />
      </Sequence>
      <Flash at={1.3 * fps} frames={8} color="#ff4fb0" peak={0.5} />
      <Flash at={3.85 * fps} frames={14} />
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      <Audio name="Bonus trigger" src={sfx("bonus")} volume={0.85} />
      <Audio name="Hallway wind" src={sfx("portal")} from={1.3 * fps} volume={0.6} />
      <Audio name="Knock" src={sfx("knock")} from={1.85 * fps} volume={0.9} />
      <Audio name="Door creak" src={sfx("creak")} from={2.4 * fps} volume={0.9} />
      <Audio name="Whoosh" src={sfx("whoosh")} from={3.1 * fps} volume={0.9} />
      <Audio name="Arrive" src={sfx("arrive")} from={3.85 * fps} volume={0.8} />
      <Audio
        name="Bonus music"
        src={music(track)}
        from={3.85 * fps}
        volume={interpolate(frame, [3.85 * fps, 4.3 * fps, durationInFrames - 0.6 * fps, durationInFrames], [0, 0.75, 0.75, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </AbsoluteFill>
  );
};
