import { Composition, Folder } from "remotion";
import { BonusEntry } from "./BonusEntry";
import { Jumpscare } from "./Jumpscare";
import { LoadingLoop } from "./LoadingLoop";
import { PumpkinPatchPromo } from "./PumpkinPatchPromo";
import { FreeSpinsTotal, LollipopReveal, Retrigger, SpellCut } from "./Moments";
import { SlotIntro } from "./SlotIntro";
import { WinClip } from "./WinClip";

// In-game versions, generated as one template: a landscape and a portrait cut of every clip,
// rendered small (npm run render:game) into the game's public/assets/clips. The win clips leave
// the amount out (the game overlays the real win) and the jumpscares open straight on the scare.
const WIN_TIERS = ["panel_win_big", "panel_win_mega", "panel_win_monster", "panel_win_sugar", "panel_win_max"];
const GAME_CLIPS = [
  { id: "loading", component: LoadingLoop, frames: 180, props: {} },
  { id: "intro", component: SlotIntro, frames: 300, props: {} },
  { id: "entry-cauldron", component: BonusEntry, frames: 165, props: { world: "bg_portal_cauldron", title: "Haunted Cauldron", subtitle: "10 FREE SPINS", accent: "#9dff4a", track: "music_free" } },
  { id: "entry-fullmoon", component: BonusEntry, frames: 165, props: { world: "bg_portal_fullmoon", title: "Full Moon", subtitle: "12 FREE SPINS · CAULDRON STARTS AT x5", accent: "#ff5a2a", track: "music_fullmoon" } },
  { id: "entry-tot", component: BonusEntry, frames: 165, props: { world: "bg_portal_tot", title: "Trick or Treat", subtitle: "KNOCK ON 3 DOORS", accent: "#ff8a00", track: "music_feature" } },
  { id: "entry-loot", component: BonusEntry, frames: 165, props: { world: "bg_portal_loot", title: "Loot Box", subtitle: "PICK A BOX · UP TO 5,000x", accent: "#ffd34d", track: "music_feature" } },
  ...(["big", "mega", "monster", "sugar", "max"] as const).map((tier, i) => ({
    id: `win-${tier}`,
    component: WinClip,
    // tiers at 0.75 s each from 0.25 s, then about 2 s on the last one
    frames: Math.round((0.25 + Math.max(1.6, (i + 1) * 0.75) + 2.1) * 30),
    props: {
      background: ["bg_base", "bg_fs_cauldron", "bg_cauldron", "bg_fs_fullmoon", "bg_feature_end"][i],
      tiers: WIN_TIERS.slice(0, i + 1),
      amount: 1,
      multiplier: 1,
      currency: "$",
      rayColor: ["rgba(255, 170, 60, 0.22)", "rgba(255, 79, 176, 0.24)", "rgba(157, 255, 74, 0.22)", "rgba(255, 120, 230, 0.24)", "rgba(255, 211, 77, 0.28)"][i],
      showAmount: false,
    },
  })),
  { id: "scare-ghost", component: Jumpscare, frames: 45, props: { background: "bg_tot", monster: "sym_GM", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-witch", component: Jumpscare, frames: 45, props: { background: "bg_base", monster: "panel_witch", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-pumpkin", component: Jumpscare, frames: 45, props: { background: "bg_fullmoon", monster: "sym_JK", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-skull", component: Jumpscare, frames: 45, props: { background: "bg_cauldron", monster: "sym_SC", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-eyeball", component: Jumpscare, frames: 45, props: { background: "bg_portal_tot", monster: "sym_EY", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-bat", component: Jumpscare, frames: 45, props: { background: "bg_loot", monster: "sym_BT", tease: "", tagline: "", calm: 0, sting: false } },
  { id: "scare-apple", component: Jumpscare, frames: 45, props: { background: "bg_fs_fullmoon", monster: "sym_PA", tease: "", tagline: "", calm: 0, sting: false } },
  // in-game moments (short; each ends on a white flash back to the board)
  { id: "spell", component: SpellCut, frames: 54, props: {} },
  { id: "retrigger", component: Retrigger, frames: 66, props: { spins: 5 } },
  { id: "lollipop", component: LollipopReveal, frames: 78, props: { spins: 10 } },
  // the game overlays the real total at 1.2 s
  { id: "fs-total", component: FreeSpinsTotal, frames: 120, props: {} },
];
export const GAME_CLIP_IDS = GAME_CLIPS.map((c) => c.id);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Intro">
        <Composition id="Slot-Intro" component={SlotIntro} durationInFrames={300} fps={30} width={1920} height={1080} />
      </Folder>

      <Folder name="Bonus-Entry">
        <Composition
          id="Entry-Haunted-Cauldron"
          component={BonusEntry}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ world: "bg_portal_cauldron", title: "Haunted Cauldron", subtitle: "10 FREE SPINS", accent: "#9dff4a", track: "music_free" }}
        />
        <Composition
          id="Entry-Full-Moon"
          component={BonusEntry}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ world: "bg_portal_fullmoon", title: "Full Moon", subtitle: "12 FREE SPINS · CAULDRON STARTS AT x5", accent: "#ff5a2a", track: "music_fullmoon" }}
        />
        <Composition
          id="Entry-Trick-or-Treat"
          component={BonusEntry}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ world: "bg_portal_tot", title: "Trick or Treat", subtitle: "KNOCK ON 3 DOORS", accent: "#ff8a00", track: "music_feature" }}
        />
        <Composition
          id="Entry-Loot-Box"
          component={BonusEntry}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ world: "bg_portal_loot", title: "Loot Box", subtitle: "PICK A BOX · UP TO 5,000x", accent: "#ffd34d", track: "music_feature" }}
        />
      </Folder>

      <Folder name="Wins">
        <Composition
          id="Win-Big"
          component={WinClip}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_base", tiers: ["panel_win_big"], amount: 18.5, multiplier: 18.5, currency: "$", rayColor: "rgba(255, 170, 60, 0.22)" }}
        />
        <Composition
          id="Win-Mega"
          component={WinClip}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_fs_cauldron", tiers: ["panel_win_big", "panel_win_mega"], amount: 64.2, multiplier: 64.2, currency: "$", rayColor: "rgba(255, 79, 176, 0.24)" }}
        />
        <Composition
          id="Win-Monster"
          component={WinClip}
          durationInFrames={145}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_cauldron", tiers: ["panel_win_big", "panel_win_mega", "panel_win_monster"], amount: 238, multiplier: 238, currency: "$", rayColor: "rgba(157, 255, 74, 0.22)" }}
        />
        <Composition
          id="Win-Sugar-Scream"
          component={WinClip}
          durationInFrames={165}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_fs_fullmoon", tiers: ["panel_win_big", "panel_win_mega", "panel_win_monster", "panel_win_sugar"], amount: 1250, multiplier: 1250, currency: "$", rayColor: "rgba(255, 120, 230, 0.24)" }}
        />
        <Composition
          id="Win-Max"
          component={WinClip}
          durationInFrames={190}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_feature_end", tiers: ["panel_win_big", "panel_win_mega", "panel_win_monster", "panel_win_sugar", "panel_win_max"], amount: 5000, multiplier: 5000, currency: "$", rayColor: "rgba(255, 211, 77, 0.28)" }}
        />
      </Folder>

      <Folder name="Features">
        <Composition id="Pumpkin-Patch" component={PumpkinPatchPromo} durationInFrames={360} fps={30} width={1920} height={1080} />
        <Composition id="Pumpkin-Patch-Vertical" component={PumpkinPatchPromo} durationInFrames={360} fps={30} width={1080} height={1920} />
      </Folder>

      <Folder name="Jumpscares">
        <Composition
          id="Jumpscare-Ghost"
          component={Jumpscare}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_tot", monster: "sym_GM", tease: "Did you hear that…?", tagline: "Dare to spin?", calm: 3 }}
        />
        <Composition
          id="Jumpscare-Witch"
          component={Jumpscare}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_base", monster: "panel_witch", tease: "She's watching…", tagline: "The Witch is waiting", calm: 3 }}
        />
        <Composition
          id="Jumpscare-Pumpkin"
          component={Jumpscare}
          durationInFrames={190}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_fullmoon", monster: "sym_JK", tease: "The moon is rising…", tagline: "Full Moon awaits", calm: 3.3 }}
        />
        <Composition
          id="Jumpscare-Skull"
          component={Jumpscare}
          durationInFrames={175}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ background: "bg_cauldron", monster: "sym_SC", tease: "Something is brewing…", tagline: "Spin if you dare", calm: 2.8 }}
        />
      </Folder>

      <Folder name="Game">
        {GAME_CLIPS.flatMap((c) =>
          (["l", "p"] as const).map((o) => (
            <Composition
              key={`${c.id}-${o}`}
              id={`game-${c.id}-${o}`}
              component={c.component as React.FC<Record<string, unknown>>}
              durationInFrames={c.frames}
              fps={30}
              width={o === "l" ? 1920 : 1080}
              height={o === "l" ? 1080 : 1920}
              defaultProps={c.props}
            />
          )),
        )}
      </Folder>
    </>
  );
};
