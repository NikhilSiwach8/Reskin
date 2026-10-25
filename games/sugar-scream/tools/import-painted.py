"""Turns the supplied painted art in art/source/ into runtime assets in public/assets/.

Symbols are art/source/sym_<ID>.(webp|png); buttons are art/source/btn_<name>.(webp|png)
(btn_spin, btn_spin_active, btn_auto, btn_turbo, btn_menu, btn_sound, btn_minus, btn_plus).

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


buttons = []
for path in sources("btn"):
    name = path.stem.split("_", 1)[1]
    fit(path, 384, 0.0).save(OUT / f"btn_{name}.webp", "WEBP", quality=90, method=6)
    buttons.append(name)
    print(f"btn_{name}: {path.name} -> public/assets/btn_{name}.webp")

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

(ROOT / "src" / "client" / "painted.json").write_text(json.dumps({"symbols": sorted(painted), "buttons": sorted(buttons)}) + "\n")
print(f"{len(painted)} painted symbols, {len(buttons)} buttons")
