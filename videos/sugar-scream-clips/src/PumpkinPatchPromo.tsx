// Pumpkin Patch promo: the new Full Moon feature in four beats. The title lands; on a board,
// Jack-o'-Lanterns split and their copies sprout with the same value; the copies pour into the
// Cauldron; the logo closes.
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
import { art, Backdrop, Embers, Flash, Logo, music, outline, Rays, sfx, shake, Vignette } from "./parts";

// A Full Moon board (6 reels x 5 rows). JK cells carry a multiplier.
const BOARD: string[][] = [
  ["CC", "EY", "PU", "BT", "GM"],
  ["PA", "JK", "CC", "WP", "EY"],
  ["SL", "BT", "EY", "PA", "CC"],
  ["PU", "CC", "GM", "BT", "WP"],
  ["EY", "WP", "PA", "CC", "BT"],
  ["JK", "GM", "SL", "EY", "PU"],
];
const VALUES: Record<string, number> = { "1,1": 5, "5,0": 8 };
// each split: source cell, target cell, and the frame (inside the board scene) it starts on
const SPLITS = [
  { from: [1, 1], to: [3, 3], at: 36 },
  { from: [5, 0], to: [2, 4], at: 66 },
] as const;
const FLIGHT = 16; // frames a seed takes to arc to its candy

// The painted board frame, as the game draws it (nine-slice of panel_board.webp).
const FRAME = { left: 111, top: 206, bottom: 918, pitch: 191.75, sliceTop: 215, sliceBottom: 330, sliceSide: 140, w: 1374, h: 1145 };

const Mult: React.FC<{ readonly value: number; readonly size: number }> = ({ value, size }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: size * 0.52,
      textAlign: "center",
      fontFamily: "Creepster",
      fontSize: size * 0.36,
      color: "#fff6c2",
      textShadow: "0 0 10px #000, 0 4px 0 #5a1300",
      WebkitTextStroke: `${Math.max(2, size * 0.025)}px #5a1300`,
    }}
  >
    x{value}
  </div>
);

/** The board, with the two splits playing over it. */
const SplitBoard: React.FC<{ readonly cell: number }> = ({ cell }) => {
  const frame = useCurrentFrame();
  const k = cell / FRAME.pitch;
  const extra = 5 * FRAME.pitch - (FRAME.bottom - FRAME.top);
  const w = 6 * cell;
  const h = 5 * cell;
  const sym = cell * 0.86;
  const grown = (reel: number, row: number) => SPLITS.find((s) => s.to[0] === reel && s.to[1] === row && frame >= s.at + FLIGHT);
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      {/* frame */}
      <div
        style={{
          position: "absolute",
          left: -FRAME.left * k,
          top: -FRAME.top * k,
          width: FRAME.w * k,
          height: (FRAME.h + extra) * k,
          borderStyle: "solid",
          borderWidth: `${FRAME.sliceTop * k}px ${FRAME.sliceSide * k}px ${FRAME.sliceBottom * k}px ${FRAME.sliceSide * k}px`,
          borderImage: `url(${art("panel_board")}) ${FRAME.sliceTop} ${FRAME.sliceSide} ${FRAME.sliceBottom} ${FRAME.sliceSide} fill / ${FRAME.sliceTop * k}px ${FRAME.sliceSide * k}px ${FRAME.sliceBottom * k}px ${FRAME.sliceSide * k}px stretch`,
          filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
        }}
      />
      {BOARD.map((col, reel) =>
        col.map((s, row) => {
          const g = grown(reel, row);
          const isJK = s === "JK" || !!g;
          const value = g ? VALUES[`${g.from[0]},${g.from[1]}`] : VALUES[`${reel},${row}`];
          const src = SPLITS.find((sp) => sp.from[0] === reel && sp.from[1] === row);
          // the source swells as it splits; a grown copy pops in
          const swell = src ? interpolate(frame, [src.at - 6, src.at, src.at + 8], [1, 1.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
          const pop = g ? interpolate(frame, [g.at + FLIGHT, g.at + FLIGHT + 10], [1.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) }) : 1;
          return (
            <div
              key={`${reel}-${row}`}
              style={{ position: "absolute", left: reel * cell + (cell - sym) / 2, top: row * cell + (cell - sym) / 2, width: sym, height: sym, scale: swell * pop }}
            >
              <Img src={art(`sym_${isJK ? "JK" : s}`)} style={{ width: "100%", height: "100%", filter: isJK ? "drop-shadow(0 0 18px rgba(255, 138, 0, 0.9))" : undefined }} />
              {isJK ? <Mult value={value} size={sym} /> : null}
            </div>
          );
        }),
      )}
      {/* glowing seeds arcing from each Jack-o'-Lantern to its candy */}
      {SPLITS.map((sp) => {
        const p = interpolate(frame, [sp.at, sp.at + FLIGHT], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
        if (frame < sp.at || frame > sp.at + FLIGHT) return null;
        const ax = sp.from[0] * cell + cell / 2;
        const ay = sp.from[1] * cell + cell / 2;
        const bx = sp.to[0] * cell + cell / 2;
        const by = sp.to[1] * cell + cell / 2;
        const lift = cell * 1.1;
        const x = ax + (bx - ax) * p;
        const y = ay + (by - ay) * p - Math.sin(p * Math.PI) * lift;
        const s = cell * (0.28 + Math.sin(p * Math.PI) * 0.18);
        return (
          <div
            key={sp.at}
            style={{
              position: "absolute",
              left: x - s / 2,
              top: y - s / 2,
              width: s,
              height: s,
              borderRadius: "50%",
              background: "radial-gradient(circle, #fff6c2, #ffa000 45%, rgba(255, 120, 0, 0) 70%)",
              boxShadow: "0 0 40px #ff8a00",
            }}
          />
        );
      })}
      {/* a burst where each copy lands */}
      {SPLITS.map((sp) => {
        const t = frame - (sp.at + FLIGHT);
        if (t < 0 || t > 12) return null;
        return (
          <Img
            key={`b${sp.at}`}
            src={art("panel_fx_pop")}
            style={{
              position: "absolute",
              left: sp.to[0] * cell + cell / 2 - cell * 0.9,
              top: sp.to[1] * cell + cell / 2 - cell * 0.9,
              width: cell * 1.8,
              opacity: 1 - t / 12,
              scale: 0.6 + t / 12,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </div>
  );
};

/** Scene 2: the board on one side, the explanation on the other. */
const SplitScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  const cell = portrait ? 150 : 128;
  const line = (at: number) => ({
    opacity: interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [at, at + 10], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }),
  });
  const sumAt = 96;
  return (
    <AbsoluteFill style={{ translate: shake(frame, SPLITS[1].at + FLIGHT, 8, 10, "split") }}>
      <Backdrop src={art("bg_fs_fullmoon")} zoomFrom={1.08} zoomTo={1.16} dim={0.35} />
      <Embers color="#ff8a3c" count={40} seed="split" />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? "column" : "row",
          justifyContent: "center",
          alignItems: "center",
          gap: portrait ? 140 : 110,
          paddingTop: portrait ? 120 : 40,
        }}
      >
        <SplitBoard cell={cell} />
        <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: portrait ? 940 : 780, alignItems: portrait ? "center" : "flex-start", textAlign: portrait ? "center" : "left" }}>
          <Interactive.Div name="Line 1" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: portrait ? 64 : 54, lineHeight: 1.1, color: "#fff", textShadow: outline(5, "#2a0040"), ...line(6) }}>
            {/* non-breaking hyphens keep the name on one line */}
            Every Jack‑o&apos;‑Lantern can split
          </Interactive.Div>
          <Interactive.Div name="Line 2" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 56, lineHeight: 1.1, color: "#ffd34d", textShadow: outline(5, "#5a1300"), ...line(SPLITS[0].at + FLIGHT + 4) }}>
            Copies keep their value
          </Interactive.Div>
          <Interactive.Div
            name="Sum"
            style={{
              fontFamily: "Creepster",
              fontSize: portrait ? 96 : 80,
              letterSpacing: 2,
              whiteSpace: "nowrap",
              color: "#9dff4a",
              textShadow: "0 0 30px #5fd400, 0 8px 0 #1e5200",
              opacity: interpolate(frame, [sumAt, sumAt + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              scale: interpolate(frame, [sumAt, sumAt + 0.35 * fps], [1.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.spring({ damping: 10 }), output: "perceptual-scale" }),
            }}
          >
            x5 + x8 + x5 + x8 = x26
          </Interactive.Div>
        </div>
      </AbsoluteFill>
      <Vignette strength={0.55} />
      <Flash at={SPLITS[0].at + FLIGHT} frames={6} color="#ffa000" peak={0.25} />
      <Flash at={SPLITS[1].at + FLIGHT} frames={6} color="#ffa000" peak={0.25} />
      <Audio name="Split 1" src={sfx("mult")} from={SPLITS[0].at} volume={0.8} />
      <Audio name="Sprout 1" src={sfx("pop")} from={SPLITS[0].at + FLIGHT} volume={0.9} />
      <Audio name="Split 2" src={sfx("mult")} from={SPLITS[1].at} volume={0.8} />
      <Audio name="Sprout 2" src={sfx("pop")} from={SPLITS[1].at + FLIGHT} volume={0.9} />
      <Audio name="Sum" src={sfx("impact")} from={sumAt} volume={0.6} />
    </AbsoluteFill>
  );
};

/** Scene 3: the copies pour into the Cauldron, which climbs. */
const CauldronScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  const value = Math.round(interpolate(frame, [0.4 * fps, 2.2 * fps], [5, 57], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }));
  return (
    <AbsoluteFill style={{ translate: shake(frame, 2.2 * fps, 10, 14, "pour") }}>
      <Backdrop src={art("bg_fs_cauldron")} zoomFrom={1.15} zoomTo={1.05} dim={0.4} />
      <Rays color="rgba(157, 255, 74, 0.2)" />
      <Embers color="#9dff4a" count={50} seed="pour" />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 10 }}>
        <Interactive.Div name="Pour line" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: portrait ? 60 : 66, color: "#fff", textShadow: outline(5, "#1e5200"), textAlign: "center", maxWidth: "90%" }}>
          and pour into the Cauldron
        </Interactive.Div>
        <div style={{ position: "relative", width: portrait ? 640 : 560 }}>
          <Img
            src={art("panel_cauldron_icon")}
            style={{ width: "100%", scale: 1 + Math.sin(frame / 4) * 0.02 * Math.min(1, frame / 20), filter: "drop-shadow(0 0 50px rgba(157, 255, 74, 0.7))" }}
          />
          <div style={{ position: "absolute", left: 0, right: 0, top: "52%", textAlign: "center", fontFamily: "Creepster", fontSize: portrait ? 170 : 150, color: "#fff", textShadow: "0 0 30px #5fd400, 0 8px 0 #1e5200" }}>
            x{value}
          </div>
        </div>
        <Interactive.Div name="Snowball" style={{ fontFamily: "Creepster", fontSize: portrait ? 110 : 120, letterSpacing: 3, color: "#ffd34d", textShadow: "0 0 30px #ff8a00, 0 8px 0 #5a1300", opacity: interpolate(frame, [2.2 * fps, 2.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          Splits snowball!
        </Interactive.Div>
      </AbsoluteFill>
      <Vignette strength={0.55} />
      <Flash at={2.2 * fps} frames={10} color="#9dff4a" peak={0.35} />
      <Audio name="Bubbles" src={sfx("cauldron")} volume={0.9} />
      <Audio name="Bubbles again" src={sfx("cauldron")} from={0.9 * fps} volume={0.8} />
      <Audio name="Snowball" src={sfx("bigWin")} from={2.2 * fps} volume={0.7} />
    </AbsoluteFill>
  );
};

export const PumpkinPatchPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const portrait = height > width;
  const titleAt = Math.round(0.35 * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326" }}>
      {/* 1. the title */}
      <Sequence name="Title" durationInFrames={Math.round(2.6 * fps)}>
        <AbsoluteFill style={{ translate: shake(frame, titleAt, 12, 22, "title") }}>
          <Backdrop src={art("bg_fs_fullmoon")} zoomFrom={1.25} zoomTo={1.08} dim={0.3} />
          <Rays color="rgba(255, 138, 0, 0.22)" />
          <Embers color="#ff8a3c" count={50} seed="title" />
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
            <Interactive.Div
              name="New tag"
              style={{
                padding: "8px 26px",
                borderRadius: 999,
                background: "#0b0014",
                border: "4px solid #fff",
                fontFamily: "Fredoka",
                fontWeight: 700,
                fontSize: 44,
                color: "#fff",
                letterSpacing: 3,
                rotate: "-3deg",
                opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              NEW IN FULL MOON
            </Interactive.Div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {!portrait ? <Img src={art("sym_JK")} style={{ width: 240, rotate: `${Math.sin(frame / 5) * 8}deg`, translate: `0px ${Math.abs(Math.sin(frame / 6)) * -26}px` }} /> : null}
              <Interactive.Div
                name="Title"
                style={{
                  fontFamily: "Creepster",
                  fontSize: portrait ? 190 : 210,
                  lineHeight: 0.95,
                  letterSpacing: 6,
                  textAlign: "center",
                  color: "#ff9a1a",
                  textShadow: "0 0 40px #ff5a00, 0 12px 0 #5a1300",
                  scale: interpolate(frame, [titleAt, titleAt + 0.4 * fps], [2.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.spring({ damping: 10 }), output: "perceptual-scale" }),
                  opacity: interpolate(frame, [titleAt, titleAt + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                Pumpkin
                {portrait ? <br /> : " "}
                Patch
              </Interactive.Div>
              {!portrait ? <Img src={art("sym_JK")} style={{ width: 240, rotate: `${-Math.sin(frame / 5) * 8}deg`, translate: `0px ${Math.abs(Math.sin(frame / 6 + 1)) * -26}px` }} /> : null}
            </div>
            {portrait ? <Img src={art("sym_JK")} style={{ width: 300, rotate: `${Math.sin(frame / 5) * 8}deg` }} /> : null}
          </AbsoluteFill>
          <Vignette strength={0.55} />
          <Flash at={titleAt} frames={10} />
        </AbsoluteFill>
      </Sequence>
      {/* 2. the split, on a board */}
      <Sequence name="Split" from={Math.round(2.6 * fps)} durationInFrames={Math.round(4.6 * fps)}>
        <SplitScene />
      </Sequence>
      {/* 3. into the Cauldron */}
      <Sequence name="Cauldron" from={Math.round(7.2 * fps)} durationInFrames={Math.round(3 * fps)}>
        <CauldronScene />
      </Sequence>
      {/* 4. the close */}
      <Sequence name="Close" from={Math.round(10.2 * fps)}>
        <AbsoluteFill>
          <Backdrop src={art("bg_fs_fullmoon")} zoomFrom={1.05} zoomTo={1.12} dim={0.55} />
        </AbsoluteFill>
        {/* its own layer above the backdrop (in-flow text would paint under the positioned backdrop) */}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 30 }}>
          <Logo at={4} size={portrait ? 200 : 190} />
          <Interactive.Div name="Close line" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: portrait ? 62 : 70, color: "#ff9a1a", textShadow: outline(6, "#5a1300"), textAlign: "center" }}>
            Pumpkin Patch in Full Moon free spins
          </Interactive.Div>
          <Interactive.Div name="Max win" style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: portrait ? 84 : 92, color: "#ffd34d", textShadow: outline(7, "#5a1300") }}>
            WIN UP TO 5,000x
          </Interactive.Div>
        </AbsoluteFill>
      </Sequence>
      <Flash at={Math.round(2.6 * fps)} frames={8} color="#ff9a1a" peak={0.4} />
      <Flash at={Math.round(7.2 * fps)} frames={8} color="#9dff4a" peak={0.4} />
      <Flash at={Math.round(10.2 * fps)} frames={8} peak={0.5} />
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [0, 0.3 * fps, durationInFrames - 0.5 * fps, durationInFrames], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
      <Audio
        name="Full Moon music"
        src={music("music_fullmoon")}
        volume={interpolate(frame, [0, 0.4 * fps, durationInFrames - fps, durationInFrames], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      <Audio name="Title hit" src={sfx("impact")} from={titleAt} volume={0.9} />
      <Audio name="Title thunder" src={sfx("bonus")} from={titleAt} volume={0.6} />
      <Audio name="Close bell" src={sfx("scatter")} from={Math.round(10.2 * fps) + 4} volume={0.7} />
    </AbsoluteFill>
  );
};
