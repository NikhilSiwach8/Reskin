import { Composition, Folder } from "remotion";
import { BonusEntry } from "./BonusEntry";
import { Jumpscare } from "./Jumpscare";
import { SlotIntro } from "./SlotIntro";
import { WinClip } from "./WinClip";

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
    </>
  );
};
