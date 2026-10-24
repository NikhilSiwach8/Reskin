// Optional painted-art pass using the OpenAI Images API.
//
// The shipped art is vector (tools/art/*.mjs) because no image-generation credits were
// available when the game was built. With credits, this script generates painted versions
// of every asset; tools/render-art.mjs then prefers art/painted/<name>.png over the vector
// render automatically, so no code changes are needed.
//
//   OPENAI_API_KEY=... node tools/generate-art-openai.mjs                    # all assets
//   OPENAI_API_KEY=... node tools/generate-art-openai.mjs sym_relic logo      # some assets
//   ... --reference path/to/concept-board.png   # use concept crops as style references
//
// Review every generated image before shipping: Stake Engine requires unique assets, and
// generated images must not contain text, watermarks or third-party marks.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'art/painted');
mkdirSync(outDir, { recursive: true });

const STYLE =
  'Premium online slot game art, glossy stylized 3D-cartoon render, chunky exaggerated proportions, thick consistent dark outline, ' +
  'strong silhouette, rich materials, controlled glow. Halloween haunted-bank theme, playful and spooky, never gory. ' +
  'Palette: haunted purple #20152F, deep midnight #100D1D, spectral green #7DFFA8, aged ivory #E8E1CF, lantern amber #F5A13A, ' +
  'antique gold #D7A544, emergency crimson #D8423A, phantom violet #9D66FF. No text, no letters unless specified, no watermark, no UI.';

const ICON = 'Single centered game symbol filling about 88% of a square canvas, fully transparent background.';

// name: [prompt, size, transparent, reference crop box on the 1536x1024 concept board]
const ASSETS = {
  sym_relic: [`${ICON} Cursed Relic: a large faceted emerald crystal in an ornate chunky antique-gold square frame with corner flourishes, spectral green energy and floating sparkles.`, '1024x1024', true, [20, 416, 148, 540]],
  sym_vaultdoor: [`${ICON} Miniature round antique bank vault door, dark riveted metal, gold rim, gold spoked wheel with a small skull hub, glowing green seams.`, '1024x1024', true, [160, 416, 276, 540]],
  sym_phantom: [`${ICON} Phantom: a hooded supernatural thief in a purple cloak, face hidden in shadow with two glowing green eyes, mischievous not scary.`, '1024x1024', true, [288, 416, 400, 540]],
  sym_clock: [`${ICON} Thirteenth Clock: ornate gold pocket watch with a purple face and thirteen hour markers, the top marker glowing green.`, '1024x1024', true, [410, 416, 520, 540]],
  sym_elixir: [`${ICON} Spectral Elixir: round glass potion flask with cork, filled with luminous bubbling green liquid.`, '1024x1024', true, [530, 416, 630, 540]],
  sym_key: [`${ICON} Vault Key: ornate gold key with a hexagonal emerald jewel in the bow, supernatural green glow.`, '1024x1024', true, [640, 416, 745, 540]],
  sym_ledger: [`${ICON} Haunted Ledger: thick purple leather book with gold corners and a gold skull emblem with glowing green eyes.`, '1024x1024', true, [756, 416, 880, 540]],
  sym_chest: [`${ICON} Treasure Chest: gold-banded wooden chest, lid open, overflowing with glowing gold coins.`, '1024x1024', true, null],
  sym_goldbag: [`${ICON} Gold Bag: brown sack tied with gold rope, gold coins spilling around it.`, '1024x1024', true, [892, 416, 1010, 540]],
  sym_a: [`${ICON} The capital letter A as a chunky faceted amber-gold gemstone letter with bevel highlights.`, '1024x1024', true, [1046, 430, 1132, 550]],
  sym_k: [`${ICON} The capital letter K as a chunky faceted ruby-red gemstone letter with bevel highlights.`, '1024x1024', true, [1140, 430, 1226, 550]],
  sym_q: [`${ICON} The capital letter Q as a chunky faceted magenta-purple gemstone letter with bevel highlights.`, '1024x1024', true, [1234, 430, 1320, 550]],
  sym_j: [`${ICON} The capital letter J as a chunky faceted emerald-green gemstone letter with bevel highlights.`, '1024x1024', true, [1328, 430, 1414, 550]],
  sym_10: [`${ICON} The number 10 as chunky faceted sapphire-blue gemstone digits with bevel highlights.`, '1024x1024', true, [1422, 430, 1530, 550]],
  logo: ['Game logo wordmark reading exactly "MIDNIGHT VAULT" in ornate gothic gold and glowing green lettering on an ornamental dark purple plaque with a gold skull crest. Transparent background.', '1536x1024', true, [0, 0, 420, 370]],
  bg_bank: ['Wide landscape background: a haunted gothic bank at midnight in a crooked town, big purple full moon, amber lit windows, street lamps, bare trees, soft fog. The centre is darker and simpler where reels will sit. No text.', '1536x1024', false, [1062, 30, 1268, 196]],
  bg_cursed_fortune: ['Wide landscape background: interior vault hall with arches, spectral green light, piles of gold coins and emerald relics. Darker centre. No text.', '1536x1024', false, [310, 845, 508, 1010]],
  bg_phantom_payday: ['Wide landscape background: purple haunted staircase hall with ghostly figures and violet light. Darker centre. No text.', '1536x1024', false, [514, 845, 728, 1010]],
  bg_midnight_countdown: ['Wide landscape background: amber-lit gothic hall with a giant ornate wall clock showing thirteen markers. Darker centre. No text.', '1536x1024', false, [734, 845, 934, 1010]],
  bg_final_heist: ['Wide landscape background: an enormous treasury behind an open round vault door, mountains of gold coins, green spectral glow. Darker centre. No text.', '1536x1024', false, [938, 845, 1140, 1010]],
  frame: ['Ornate gold slot machine frame for a 5x5 reel grid shaped like a haunted bank facade: stone pillars, green flame braziers on top, pediment with a gold skull crest. The square reel window in the middle is fully transparent. Transparent background.', '1024x1024', true, [430, 30, 1050, 370]],
  fx_vault_door: [`${ICON} Huge round bank vault door seen front-on, riveted steel, gold rim, eight-spoke gold wheel with skull hub, glowing green seam.`, '1024x1024', true, [1270, 600, 1530, 780]],
  fx_phantom: ['Full-body hooded phantom thief in a purple cloak with glowing green eyes, reaching out with one hand holding a green wisp. Transparent background.', '1024x1536', true, [266, 600, 508, 780]],
  fx_clock_face: [`${ICON} Giant ornate clock face with gold rim, dark purple dial, thirteen hour markers, the top one glowing green; no hands.`, '1024x1024', true, [772, 600, 1004, 780]],
  key_cursed_fortune: ['Tall ornate gold key with a large green emerald in the bow, standing upright. Transparent background.', '1024x1536', true, [1020, 600, 1100, 780]],
  key_phantom_payday: ['Tall ornate gold key with a large violet amethyst in the bow, standing upright. Transparent background.', '1024x1536', true, [1100, 600, 1180, 780]],
  key_midnight_countdown: ['Tall ornate gold key with a large amber topaz in the bow, standing upright. Transparent background.', '1024x1536', true, [1180, 600, 1260, 780]],
};

const args = process.argv.slice(2);
const refIdx = args.indexOf('--reference');
const reference = refIdx >= 0 ? args[refIdx + 1] : null;
const names = args.filter((a, i) => !a.startsWith('--') && (refIdx < 0 || i !== refIdx + 1));
const list = Object.entries(ASSETS).filter(([n]) => !names.length || names.includes(n));
const endpoint = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
const headers = process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {};

for (const [name, [prompt, size, transparent, crop]] of list) {
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', `${STYLE} ${prompt}`);
  form.set('size', size);
  form.set('quality', 'high');
  if (transparent) form.set('background', 'transparent');
  let url = `${endpoint}/images/generations`;
  if (reference && crop && existsSync(reference)) {
    const tmp = join(outDir, `${name}.ref.png`);
    const [x0, y0, x1, y1] = crop;
    execFileSync('convert', [reference, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage', '-resize', '512x512', tmp]);
    form.set('image[]', new Blob([readFileSync(tmp)], { type: 'image/png' }), `${name}.png`);
    form.set('prompt', `Recreate the reference as a clean, original, high-resolution asset. ${STYLE} ${prompt}`);
    url = `${endpoint}/images/edits`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: form });
  const data = await res.json();
  if (!res.ok || !data.data?.[0]?.b64_json) {
    console.error(`${name}: ${data.error?.message ?? res.status}`);
    continue;
  }
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data.data[0].b64_json, 'base64'));
  console.log(`${name}: art/painted/${name}.png`);
}
console.log('Review the images, then run "npm run art" to rebuild runtime assets (painted PNGs take priority).');
