// Renders every clip to out/<id>.mp4 (H.264 + AAC), or only the ids given as arguments.
import { execFileSync } from "node:child_process";

const ALL = [
  "Slot-Intro",
  "Entry-Haunted-Cauldron", "Entry-Full-Moon", "Entry-Trick-or-Treat", "Entry-Loot-Box",
  "Win-Big", "Win-Mega", "Win-Monster", "Win-Sugar-Scream", "Win-Max",
  "Jumpscare-Ghost", "Jumpscare-Witch", "Jumpscare-Pumpkin", "Jumpscare-Skull",
];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
for (const id of ids) {
  console.log(`rendering ${id}`);
  execFileSync("npx", ["remotion", "render", id, `out/${id}.mp4`, "--codec=h264", "--crf=20", "--log=error"], { stdio: "inherit" });
}
