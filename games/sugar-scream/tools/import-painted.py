"""Turns the supplied painted art in art/source/ into runtime assets in public/assets/.

Symbols are art/source/sym_<ID>.(webp|png); buttons are art/source/btn_<name>.(webp|png)
(btn_spin, btn_spin_active, btn_auto, btn_turbo, btn_menu, btn_sound, btn_mute, btn_minus,
btn_plus, btn_buy, btn_ante); backgrounds are bg_<base|cauldron|fullmoon|tot|loading|intro> and UI
panels panel_<free|meter|door|board>.

Each sym_<ID>.(webp|png) source is trimmed to its visible pixels, centred on a square
canvas with a little padding (so every symbol has the same visual size), resized to
512x512 and saved as WebP. The client uses public/assets/sym_<ID>.webp when it exists and
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
SIZE = 512
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
WIDE = {"buy": 640, "ante": 640}

buttons = []
for path in sources("btn"):
    name = path.stem.split("_", 1)[1]
    if name in WIDE:
        im = Image.open(path).convert("RGBA")
        im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
        im = im.resize((WIDE[name], round(im.height * WIDE[name] / im.width)), Image.LANCZOS)
    else:
        im = fit(path, 384, 0.0)
    im.save(OUT / f"btn_{name}.webp", "WEBP", quality=90, method=6)
    buttons.append(name)
    print(f"btn_{name}: {path.name} -> public/assets/btn_{name}.webp")

# Backgrounds (bg_base, bg_cauldron, bg_fullmoon) keep their size; UI panels keep their aspect.
backgrounds = []
for path in sources("bg"):
    name = path.stem.split("_", 1)[1]
    im = Image.open(path).convert("RGB")
    if im.width > 1920:
        im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    im.save(OUT / f"bg_{name}.webp", "WEBP", quality=82, method=6)
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
    width = 800 if im.width > im.height else 480
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f"panel_{name}.webp", "WEBP", quality=90, method=6)
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
    canvas.save(OUT / f"sym_{sid}.webp", "WEBP", quality=90, method=6)
    painted.append(sid)
    print(f"sym_{sid}: {path.name} -> public/assets/sym_{sid}.webp")

(ROOT / "src" / "client" / "painted.json").write_text(json.dumps({"symbols": sorted(painted), "buttons": sorted(buttons), "backgrounds": sorted(backgrounds), "panels": sorted(panels)}) + "\n")
print(f"{len(painted)} symbols, {len(buttons)} buttons, {len(backgrounds)} backgrounds, {len(panels)} panels")
