// Short in-game moments: the Witch's Spell cut-in, a free-spins retrigger, the Golden Lollipop
// and the free-spins total. Each ends on a bright flash, so the cut back to the board reads as
// a transition. The total screen carries no amount: the game overlays the real win.
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Img, Interactive, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { art, Backdrop, Embers, Flash, Fountain, music, outline, Rays, sfx, shake, Vignette } from "./parts";

/** Big punchy title that springs in at `at` (frames). */
const Title: React.FC<{ readonly at: number; readonly size: number; readonly color: string; readonly glow: string; readonly children: React.ReactNode }> = ({ at, size, color, glow, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Interactive.Div
      name="Title"
      style={{
        maxWidth: "92%",
        textAlign: "center",
        fontFamily: "Creepster",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: 4,
        color,
        textShadow: `0 0 40px ${glow}, 0 10px 0 rgba(0,0,0,0.6)`,
        scale: interpolate(frame, [at, at + 0.35 * fps], [2.4, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 10 }),
          output: "perceptual-scale",
        }),
        opacity: interpolate(frame, [at, at + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </Interactive.Div>
  );
};

/** The closing white-out that hands the screen back to the board. */
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        opacity: interpolate(frame, [durationInFrames - 6, durationInFrames - 1], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    />
  );
};

/** Witch's Spell: the witch streaks across with a sparkle trail and the title lands. */
export const SpellCut: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#12001f" }}>
      <Backdrop src={art("bg_intro")} zoomFrom={1.2} zoomTo={1.05} dim={0.45} style={{ filter: "blur(6px) saturate(1.3)" }} />
      <Embers color="#d36bff" count={50} seed="spell" />
      {/* the sparkle trail behind her */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = 0.1 * fps + i * 2.2;
        const x = interpolate(t, [0, 1.1 * fps], [-0.2 * width, 1.1 * width]);
        const y = interpolate(t, [0, 1.1 * fps], [0.72 * height, 0.22 * height]);
        return (
          <Img
            key={i}
            src={art("panel_fx_spell")}
            style={{
              position: "absolute",
              left: x - 140,
              top: y - 140 + (random(`sp-${i}`) - 0.5) * 60,
              width: 280,
              opacity: interpolate(frame, [t, t + 4, t + 18], [0, 0.95, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              scale: interpolate(frame, [t, t + 18], [0.5, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      <Img
        name="Witch"
        src={art("panel_witch")}
        style={{
          position: "absolute",
          width: portrait ? 760 : 900,
          left: 0,
          top: 0,
          translate: interpolate(frame, [0.1 * fps, 1.2 * fps], [`${-0.6 * width}px ${0.6 * height}px`, `${1.05 * width}px ${0.05 * height}px`], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.4, 0, 0.6, 1),
          }),
          rotate: "-10deg",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Title at={0.8 * fps} size={portrait ? 150 : 190} color="#e7b8ff" glow="#b13cff">
          Witch&apos;s Spell!
        </Title>
      </AbsoluteFill>
      <Vignette strength={0.6} />
      <Outro />
      <Audio name="Spell" src={sfx("spell")} volume={0.9} />
      <Audio name="Whoosh" src={sfx("whoosh")} from={0.15 * fps} volume={0.8} />
    </AbsoluteFill>
  );
};

/** Retrigger: Skull Lollipops burst onto the screen and +5 FREE SPINS slams in. */
export const Retrigger: React.FC<{ readonly spins: number }> = ({ spins }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326", translate: shake(frame, 0.45 * fps, 12, 24, "retrigger") }}>
      <Backdrop src={art("bg_fs_cauldron")} zoomFrom={1.15} zoomTo={1.25} dim={0.5} />
      <Rays color="rgba(157, 255, 74, 0.22)" />
      {/* three Skull Lollipops spin in from the edges */}
      {[0, 1, 2].map((i) => {
        const at = i * 4;
        const angle = -0.9 + i * 0.9;
        const r = portrait ? 330 : 420;
        return (
          <Img
            key={i}
            src={art("sym_SC")}
            style={{
              position: "absolute",
              width: portrait ? 260 : 300,
              left: width / 2 - (portrait ? 130 : 150),
              top: height / 2 - (portrait ? 130 : 150) - (portrait ? 300 : 120),
              translate: interpolate(frame, [at, at + 0.4 * fps], [`${Math.sin(angle) * 1400}px ${-900}px`, `${Math.sin(angle) * r}px ${(1 - Math.cos(angle)) * 80}px`], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.back(1.6)),
              }),
              rotate: `${interpolate(frame, [at, at + 0.4 * fps], [-200, angle * 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}deg`,
              filter: "drop-shadow(0 0 30px rgba(255, 120, 220, 0.8))",
            }}
          />
        );
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: portrait ? 420 : 300 }}>
        <Title at={0.45 * fps} size={portrait ? 150 : 180} color="#9dff4a" glow="#5fd400">
          +{spins} Free Spins
        </Title>
      </AbsoluteFill>
      <Vignette strength={0.55} />
      <Flash at={0.45 * fps} frames={8} peak={0.6} />
      <Outro />
      <Audio name="Retrigger" src={sfx("retrigger")} volume={0.9} />
      <Audio name="Hit" src={sfx("impact")} from={0.45 * fps} volume={0.7} />
      <Audio name="Bells" src={sfx("lollipop")} from={0.5 * fps} volume={0.7} />
    </AbsoluteFill>
  );
};

/** Golden Lollipop: the golden door glows open on the lollipop and the free spins are named. */
export const LollipopReveal: React.FC<{ readonly spins: number }> = ({ spins }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0a00" }}>
      <Backdrop src={art("bg_tot")} zoomFrom={1.1} zoomTo={1.22} dim={0.55} />
      <Rays color="rgba(255, 211, 77, 0.3)" />
      <Embers color="#ffd34d" count={55} seed="lollipop" />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: portrait ? 520 : 200 }}>
        <Img
          name="Golden door"
          src={art("panel_door_lollipop")}
          style={{
            height: portrait ? 760 : 640,
            filter: "brightness(1.1) drop-shadow(0 0 60px rgba(255, 211, 77, 0.95))",
            scale: interpolate(frame, [0, 0.5 * fps], [0.3, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 11 }),
              output: "perceptual-scale",
            }),
            rotate: `${Math.sin(frame / 5) * 1.5}deg`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: portrait ? 360 : 110, gap: 10 }}>
        <Title at={0.6 * fps} size={portrait ? 130 : 150} color="#ffd34d" glow="#ff8a00">
          Golden Lollipop!
        </Title>
        <Interactive.Div
          name="Spins"
          style={{
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: portrait ? 64 : 72,
            color: "#9dff4a",
            textShadow: outline(5, "#1e5200"),
            opacity: interpolate(frame, [1.0 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {spins} FREE SPINS
        </Interactive.Div>
      </AbsoluteFill>
      <Vignette strength={0.55} />
      <Flash at={0.6 * fps} frames={10} color="#ffd34d" peak={0.5} />
      <Outro />
      <Audio name="Lollipop" src={sfx("lollipop")} volume={0.9} />
      <Audio name="Bonus" src={sfx("bonus")} from={0.55 * fps} volume={0.7} />
    </AbsoluteFill>
  );
};

/** Free-spins total: rays, a fountain of candy and coins and a TOTAL WIN title (the game adds the amount). */
export const FreeSpinsTotal: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326" }}>
      <Backdrop src={art("bg_feature_end")} zoomFrom={1.05} zoomTo={1.15} dim={0.45} />
      <Rays color="rgba(255, 211, 77, 0.26)" />
      <Fountain count={80} seed="fs-total" />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: portrait ? 300 : 260 }}>
        <Title at={0.15 * fps} size={portrait ? 170 : 200} color="#ffd34d" glow="#ff8a00">
          Total Win
        </Title>
      </AbsoluteFill>
      <Vignette strength={0.55} />
      <Outro />
      <Audio name="End sting" src={music("sting_end")} volume={0.8} />
      <Audio name="Coins" src={sfx("coins")} from={0.4 * fps} volume={0.6} />
      <Audio name="Lands" src={sfx("lollipop")} from={Math.round(1.2 * fps)} volume={0.6} />
    </AbsoluteFill>
  );
};

