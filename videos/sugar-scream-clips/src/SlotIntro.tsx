// Slot intro: the witch streaks across the moonlit sky, the logo slams in, candies rain,
// the five bonuses are named one by one, then the max win.
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
import { art, Backdrop, Embers, Flash, Logo, music, outline, sfx, shake, SYMBOLS, Vignette } from "./parts";

const CandyRain: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 26 }, (_, i) => {
        const delay = random(`rain-d-${i}`) * 1.6 * fps;
        const t = Math.max(0, frame - delay) / fps;
        const y = -200 + t * (900 + random(`rain-v-${i}`) * 700);
        const x = random(`rain-x-${i}`) * width;
        const size = 90 + random(`rain-s-${i}`) * 80;
        return frame < delay || y > height + 200 ? null : (
          <Img
            key={i}
            src={art(`sym_${SYMBOLS[i % SYMBOLS.length]}`)}
            style={{ position: "absolute", left: x - size / 2, top: y, width: size, height: size, rotate: `${(random(`rain-r-${i}`) - 0.5) * 60 + t * 40}deg` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ readonly label: string; readonly icon: string; readonly color: string }> = ({ label, icon, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        width: 330,
        scale: interpolate(frame, [0, 0.35 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 11 }),
          output: "perceptual-scale",
        }),
      }}
    >
      <Img src={art(icon)} style={{ height: 210, objectFit: "contain", filter: `drop-shadow(0 0 24px ${color})` }} />
      <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 52, lineHeight: 1.05, color: "white", textAlign: "center", textShadow: outline(4, "#2a0040") }}>{label}</div>
    </div>
  );
};

export const SlotIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326", translate: shake(frame, 1.6 * fps, 12, 28, "intro") }}>
      <Backdrop src={art("bg_base")} zoomFrom={1.25} zoomTo={1.05} dim={0.25} />
      <Embers color="#ff9ad8" count={50} seed="intro" />

      {/* the witch crosses the sky, trailing her spell */}
      <Sequence name="Witch fly-by" durationInFrames={2 * fps} layout="none">
        <Img
          name="Witch"
          src={art("panel_witch")}
          style={{
            position: "absolute",
            width: 760,
            top: 120,
            translate: interpolate(frame, [0, 1.8 * fps], ["-900px 220px", "2100px -120px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.45, 0, 0.55, 1),
            }),
            rotate: "-8deg",
          }}
        />
      </Sequence>

      <Sequence name="Candy rain" from={1.6 * fps} layout="none">
        <CandyRain />
      </Sequence>

      {/* logo */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: portrait ? 260 : 150 }}>
        <Logo at={1.6 * fps} size={230} />
        <Interactive.Div
          name="Tagline"
          style={{
            marginTop: 30,
            maxWidth: "90%",
            textAlign: "center",
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: 76,
            color: "#ffd34d",
            textShadow: outline(5, "#5a1300"),
            opacity: interpolate(frame, [2.3 * fps, 2.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          A Halloween candy nightmare
        </Interactive.Div>
      </AbsoluteFill>

      {/* the five bonuses, one after another */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: portrait ? 300 : 110 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            rowGap: 40,
            maxWidth: portrait ? 1040 : 1800,
            gap: 24,
            opacity: interpolate(frame, [7.2 * fps, 7.6 * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <Sequence name="Witch's Spell card" from={3.2 * fps} layout="none">
            <Feature label="Witch's Spell" icon="panel_fx_spell" color="#d36bff" />
          </Sequence>
          <Sequence name="Trick or Treat card" from={3.6 * fps} layout="none">
            <Feature label="Trick or Treat" icon="panel_door" color="#ff8a00" />
          </Sequence>
          <Sequence name="Haunted Cauldron card" from={4.0 * fps} layout="none">
            <Feature label="Haunted Cauldron" icon="sym_JK" color="#9dff4a" />
          </Sequence>
          <Sequence name="Full Moon card" from={4.4 * fps} layout="none">
            <Feature label="Full Moon" icon="sym_SC" color="#ff4a2a" />
          </Sequence>
          <Sequence name="Loot Box card" from={4.8 * fps} layout="none">
            <Feature label="Loot Box" icon="panel_loot_box_1" color="#ffd34d" />
          </Sequence>
        </div>
      </AbsoluteFill>

      {/* max win */}
      <Sequence name="Max win" from={7.4 * fps} layout="none">
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: portrait ? 420 : 170 }}>
          <Interactive.Div
            name="Max win line"
            style={{
              fontFamily: "Fredoka",
              fontWeight: 700,
              fontSize: portrait ? 104 : 120,
              color: "#ffd34d",
              textShadow: outline(8, "#5a1300"),
              scale: interpolate(frame, [7.4 * fps, 7.8 * fps], [0.4, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 10 }),
                output: "perceptual-scale",
              }),
            }}
          >
            WIN UP TO 5,000x
          </Interactive.Div>
        </AbsoluteFill>
      </Sequence>

      <Vignette strength={0.7} />
      <Flash at={1.6 * fps} frames={12} />
      <Flash at={7.4 * fps} frames={10} color="#ffd34d" peak={0.6} />
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [0, 0.4 * fps, 9.4 * fps, 10 * fps], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      <Audio
        name="Music"
        src={music("music_base")}
        volume={interpolate(frame, [0, 0.5 * fps, 9 * fps, 10 * fps], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      <Audio name="Spell" src={sfx("spell")} from={0.2 * fps} volume={0.8} />
      <Audio name="Logo hit" src={sfx("impact")} from={1.6 * fps} volume={0.9} />
      <Audio name="Logo bell" src={sfx("scatter")} from={1.65 * fps} volume={0.6} />
      <Audio name="Card 1" src={sfx("knock")} from={3.2 * fps} volume={0.5} />
      <Audio name="Card 2" src={sfx("knock")} from={3.6 * fps} volume={0.5} />
      <Audio name="Card 3" src={sfx("knock")} from={4.0 * fps} volume={0.5} />
      <Audio name="Card 4" src={sfx("knock")} from={4.4 * fps} volume={0.5} />
      <Audio name="Card 5" src={sfx("knock")} from={4.8 * fps} volume={0.5} />
      <Audio name="Max win" src={sfx("bigWin")} from={7.4 * fps} volume={0.8} />
    </AbsoluteFill>
  );
};
