"""Turns the supplied painted art in art/source/ into runtime assets in public/assets/.

Symbols are art/source/sym_<ID>.(webp|png); buttons are art/source/btn_<name>.(webp|png)
(btn_spin, btn_spin_active, btn_auto, btn_turbo, btn_menu, btn_sound, btn_mute, btn_minus,
btn_plus, btn_buy, btn_ante); backgrounds are bg_<base|cauldron|fullmoon|tot|loading|intro> and UI
panels panel_<free|meter|door|door_treat|door_trick|door_lollipop|board|win_big|win_mega|win_monster|win_sugar|win_max|witch|fx_spell|fx_pop|cauldron_icon>.

Each sym_<ID>.(webp|png) source is trimmed to its visible pixels, centred on a square
canvas with a little padding (so every symbol has the same visual size), resized to
768x768 and saved as WebP. The client uses public/assets/sym_<ID>.webp when it exists and
falls back to the vector sym_<ID>.svg otherwise; the list is written to
src/client/painted.json.

    python3 tools/import-painted.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "assets"
SIZE = 768  # symbols: sharp on retina screens at any board size (the client loads them at resolution 2)
PAD = 0.06  # fraction of the canvas left empty on each side

def fit(path: Path, size: int, pad: float) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    # trim to visible pixels (ignore near-transparent fringe)
    alpha = im.getchannel("A").point(lambda a: 255 if a > 8 else 0)
    im = im.crop(alpha.getbbox())
    inner = round(size * (1 - 2 * pad))
    scale = inner / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


def sources(prefix: str):
    return [p for p in sorted(SRC.glob(f"{prefix}_*.*")) if p.suffix.lower() in (".webp", ".png")]


# Wide plaques keep their aspect ratio; round buttons are square.
WIDE = {"buy": 800, "ante": 800}

buttons = []
for path in sources("btn"):
    name = path.stem.split("_", 1)[1]
    if name in WIDE:
        im = Image.open(path).convert("RGBA")
        im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
        im = im.resize((WIDE[name], round(im.height * WIDE[name] / im.width)), Image.LANCZOS)
    else:
        im = fit(path, 512, 0.0)
    im.save(OUT / f"btn_{name}.webp", "WEBP", quality=90, method=6)
    buttons.append(name)
    print(f"btn_{name}: {path.name} -> public/assets/btn_{name}.webp")

# Backgrounds (bg_base, bg_cauldron, bg_fullmoon) keep their size; UI panels keep their aspect.
backgrounds = []
for path in sources("bg"):
    name = path.stem.split("_", 1)[1]
    if name == "portal_wall":
        continue  # imported below as a panel with a transparent doorway
    im = Image.open(path).convert("RGB")
    if im.width > 1920:
        im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    im.save(OUT / f"bg_{name}.webp", "WEBP", quality=88, method=6)
    backgrounds.append(name)
    print(f"bg_{name}: {path.name} -> public/assets/bg_{name}.webp ({im.width}x{im.height})")

panels = []
for path in sources("panel"):
    name = path.stem.split("_", 1)[1]
    im = Image.open(path).convert("RGBA")
    if name == "board":
        # The board frame is used at its native size: the client maps the frame's measured
        # inner window (BOARD_FRAME in src/client/game/scene.ts) onto the 6x5 grid.
        im.save(OUT / f"panel_{name}.webp", "WEBP", quality=90, method=6)
        panels.append(name)
        print(f"panel_{name}: {path.name} -> public/assets/panel_{name}.webp ({im.width}x{im.height}, native)")
        continue
    im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
    big = name.startswith(("win_", "bonus_", "loot_title", "loot_trigger", "loot_pedestal", "portal_doors"))
    width = 1600 if big else 384 if name.startswith("fx_") else 1100 if im.width > im.height else 640
    width = min(width, im.width)  # never upscale past the painting
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    # the big full-screen panels are large already; a slightly lower quality keeps the bundle in budget
    im.save(OUT / f"panel_{name}.webp", "WEBP", quality=85 if big else 90, method=6)
    panels.append(name)
    print(f"panel_{name}: {path.name} -> public/assets/panel_{name}.webp ({im.width}x{im.height})")

painted = []
for path in sources("sym"):
    sid = path.stem.split("_", 1)[1]
    im = Image.open(path).convert("RGBA")
    # trim to visible pixels (ignore near-transparent fringe)
    alpha = im.getchannel("A").point(lambda a: 255 if a > 8 else 0)
    im = im.crop(alpha.getbbox())
    inner = round(SIZE * (1 - 2 * PAD))
    scale = inner / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    canvas.save(OUT / f"sym_{sid}.webp", "WEBP", quality=92, method=6)
    painted.append(sid)
    print(f"sym_{sid}: {path.name} -> public/assets/sym_{sid}.webp")

# The bonus-entrance hallway: its black doorway becomes transparent (flood fill from the
# centre), so the door leaves and the destination scene can show through it.
wall = SRC / "bg_portal_wall.webp"
if wall.exists():
    import numpy as np
    from collections import deque
    im = Image.open(wall).convert("RGB")
    if im.width > 1920:
        im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(int)
    dark = a.max(axis=2) < 28
    H, W = dark.shape
    hole = np.zeros_like(dark)
    q = deque([(H // 2, W // 2)])
    hole[H // 2, W // 2] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < H and 0 <= nx < W and dark[ny, nx] and not hole[ny, nx]:
                hole[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(hole, 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    Image.fromarray(rgba, "RGBA").save(OUT / "panel_portal_wall.webp", "WEBP", quality=85, method=6)
    ys, xs = np.nonzero(hole)
    portal_hole = [round(xs.min() / W, 4), round(ys.min() / H, 4), round((xs.max() + 1) / W, 4), round((ys.max() + 1) / H, 4)]
    if "portal_wall" not in panels:
        panels.append("portal_wall")
    print(f"panel_portal_wall: doorway {portal_hole}")
else:
    portal_hole = None

# The Ante plaque's painted toggle knob, cut out so the client can slide it (on/off).
ante = OUT / "btn_ante.webp"
if ante.exists():
    from PIL import ImageDraw
    plaque = Image.open(ante).convert("RGBA")
    k = plaque.width / 640
    cx, cy, r = 542 * k, 116 * k, 51 * k
    knob = plaque.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r)))
    mask = Image.new("L", knob.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, knob.width - 2, knob.height - 2), fill=255)
    knob.putalpha(mask)
    knob.save(OUT / "btn_ante_knob.webp", "WEBP", quality=92)
    if "ante_knob" not in buttons:
        buttons.append("ante_knob")

(ROOT / "src" / "client" / "painted.json").write_text(json.dumps({"symbols": sorted(painted), "buttons": sorted(buttons), "backgrounds": sorted(backgrounds), "panels": sorted(panels), "portalHole": portal_hole}) + "\n")
print(f"{len(painted)} symbols, {len(buttons)} buttons, {len(backgrounds)} backgrounds, {len(panels)} panels")
