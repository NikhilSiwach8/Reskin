// Win screen clip: the win climbs through its tiers (Big, Mega, ... as in the game), each
// painted title punching in over rays and a fountain of candy and gold coins, while the
// amount counts up and lands on the final win.
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
import { art, Backdrop, Flash, Fountain, music, outline, Rays, sfx, shake, Vignette } from "./parts";

export type WinClipProps = {
  readonly background: string;
  /** Painted tier titles in order, e.g. ["panel_win_big", "panel_win_mega"]. */
  readonly tiers: string[];
  readonly amount: number;
  readonly multiplier: number;
  readonly currency: string;
  readonly rayColor: string;
  /** Show the counting amount (promo clips). The game overlays the real win instead. */
  readonly showAmount?: boolean;
};

const TIER_SECONDS = 0.75;

/** The game's tier thresholds (x bet): each tier's title shows while the amount climbs towards the next one. */
const TIER_MIN: Record<string, number> = { panel_win_big: 15, panel_win_mega: 40, panel_win_monster: 100, panel_win_sugar: 500, panel_win_max: 5000 };

/** One painted tier title: punches in, wobbles, holds. */
const TierTitle: React.FC<{ readonly src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 300 }}>
      <Img
        src={art(src)}
        style={{
          width: Math.min(1040, width * 0.92),
          scale: interpolate(frame, [0, 0.35 * fps], [0.25, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 9 }),
            output: "perceptual-scale",
          }),
          rotate: `${Math.sin(frame / 7) * 1.6}deg`,
          filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.55))",
        }}
      />
    </AbsoluteFill>
  );
};

/** The counting amount and the multiplier under it. */
const Amount: React.FC<{ readonly amount: number; readonly multiplier: number; readonly currency: string; readonly countFrames: number; readonly tiers: string[]; readonly tierFrames: number }> = ({ amount, multiplier, currency, countFrames, tiers, tierFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // climb in step with the titles: reach the next tier's threshold as its title lands, then the final win
  const bet = amount / multiplier;
  const stops = tiers.slice(1).map((t, i) => [(i + 1) * tierFrames, Math.min(amount, (TIER_MIN[t] ?? multiplier) * bet)] as const);
  const shown = interpolate(frame, [0, ...stops.map(([f]) => f), countFrames], [0, ...stops.map(([, v]) => v), amount], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const landed = frame >= countFrames;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 100 }}>
      <Interactive.Div
        name="Win amount"
        style={{
          fontFamily: "Fredoka",
          fontWeight: 700,
          fontSize: 150,
          lineHeight: 1,
          color: "#ffd34d",
          textShadow: outline(10, "#5a1300"),
          fontVariantNumeric: "tabular-nums",
          scale: interpolate(frame, [countFrames, countFrames + 0.3 * fps], [1.25, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 8 }),
            output: "perceptual-scale",
          }),
        }}
      >
        {currency}
        {shown.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Interactive.Div>
      <Interactive.Div
        name="Multiplier"
        style={{
          marginTop: 14,
          fontFamily: "Fredoka",
          fontWeight: 700,
          fontSize: 84,
          color: "#9dff4a",
          textShadow: outline(5, "#1e5200"),
          opacity: landed ? 1 : 0.0,
        }}
      >
        {multiplier.toLocaleString("en-US")}x
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const WinClip: React.FC<WinClipProps> = ({ background, tiers, amount, multiplier, currency, rayColor, showAmount = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tierFrames = Math.round(TIER_SECONDS * fps);
  const countFrames = Math.max(1.6 * fps, tiers.length * tierFrames);
  const start = Math.round(0.25 * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0326", translate: shake(frame, start + countFrames, 14, 22, "land") }}>
      <Backdrop src={art(background)} zoomFrom={1.08} zoomTo={1.18} dim={0.45} />
      <Sequence name="Rays" from={start} layout="none">
        <Rays color={rayColor} />
      </Sequence>
      <Sequence name="Fountain" from={start} layout="none">
        <Fountain count={90} seed={background} />
      </Sequence>
      {tiers.map((tier, i) => (
        <Sequence
          key={tier}
          name={`Tier ${i + 1}`}
          from={start + i * tierFrames}
          durationInFrames={i === tiers.length - 1 ? undefined : tierFrames}
          layout="none"
        >
          <TierTitle src={tier} />
        </Sequence>
      ))}
      {showAmount ? (
        <Sequence name="Amount" from={start} layout="none">
          <Amount amount={amount} multiplier={multiplier} currency={currency} countFrames={countFrames} tiers={tiers} tierFrames={tierFrames} />
        </Sequence>
      ) : null}
      <Vignette strength={0.55} />
      {tiers.map((tier, i) => (
        <Flash key={tier} at={start + i * tierFrames} frames={8} peak={0.55} />
      ))}
      <Flash at={start + countFrames} frames={10} color="#ffd34d" peak={0.5} />
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [0, 0.2 * fps, durationInFrames - 0.4 * fps, durationInFrames], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      <Audio name="Win sting" src={music("sting_bigwin")} from={start} volume={0.8} />
      {tiers.map((tier, i) => (
        <Audio key={tier} name={`Tier ${i + 1} hit`} src={sfx(i === tiers.length - 1 ? "bigWin" : "impact")} from={start + i * tierFrames} volume={i === tiers.length - 1 ? 0.85 : 0.55} />
      ))}
      <Audio name="Coins" src={sfx("coins")} from={start + 0.3 * fps} volume={0.55} />
      <Audio name="Coins again" src={sfx("coins")} from={start + 2.4 * fps} volume={0.45} />
      <Audio name="Amount lands" src={sfx("lollipop")} from={start + countFrames} volume={0.7} />
    </AbsoluteFill>
  );
};
