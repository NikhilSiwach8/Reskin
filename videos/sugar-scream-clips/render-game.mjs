// Renders the in-game clips (the "Game" folder) small, for the slot's frontend bundle:
// landscape at 1280x720, portrait at 540x960, into games/sugar-scream/public/assets/clips/.
// Each file is compressed hard (the frontend zip must stay under 50 MB), gets a limiter on the
// audio, and has its index moved to the front (+faststart) so it starts playing while it downloads.
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";

// a system ffmpeg has the limiter; Remotion's bundled one does not, so fall back to a fixed trim
let ffmpeg = ["ffmpeg"];
let audioFilter = "alimiter=limit=0.89:level=false";
try {
  execFileSync("ffmpeg", ["-hide_banner", "-h", "filter=alimiter"], { stdio: "ignore" });
} catch {
  ffmpeg = ["npx", "remotion", "ffmpeg"];
  audioFilter = "volume=0.85";
}

const OUT = "../../games/sugar-scream/public/assets/clips";
const IDS = [
  "loading", "intro", "entry-cauldron", "entry-fullmoon", "entry-tot", "entry-loot", "entry-graveyard",
  "win-big", "win-mega", "win-monster", "win-sugar", "win-max",
  "scare-ghost", "scare-witch", "scare-pumpkin", "scare-skull", "scare-eyeball", "scare-bat", "scare-apple",
  "spell", "retrigger", "lollipop", "fs-total",
];
const wanted = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
mkdirSync("out/game", { recursive: true });
for (const id of wanted.length ? IDS.filter((i) => wanted.includes(i)) : IDS) {
  // render sharp, then scale and compress in one ffmpeg pass (Remotion needs whole-pixel scales)
  for (const [o, scale, size] of [["l", "1", "1280:720"], ["p", "0.5", "540:960"]]) {
    const raw = `out/game/${id}-${o}.mp4`;
    console.log(`rendering ${id}-${o}`);
    execFileSync("npx", ["remotion", "render", `game-${id}-${o}`, raw, "--codec=h264", "--crf=16", `--scale=${scale}`, "--log=error"], { stdio: "inherit" });
    const tmp = `out/game/${id}-${o}.tmp.mp4`;
    execFileSync(ffmpeg[0], [...ffmpeg.slice(1), "-v", "error", "-y", "-i", raw, "-vf", `scale=${size}:flags=lanczos`, "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", ...(id === "loading" ? ["-an"] : ["-af", audioFilter, "-c:a", "aac", "-b:a", "96k"]), "-movflags", "+faststart", tmp], { stdio: "inherit" });
    renameSync(tmp, `${OUT}/${id}-${o}.mp4`);
    rmSync(raw);
  }
}
