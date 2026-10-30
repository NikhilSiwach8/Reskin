"""Builds the Graveyard Lock orbs from the painted art (no new artwork):

  panel_orb_soul    the Autoplay button's candy glass in its gold ring (its icon filled in from the
                    glass), turned candy pink, with the Ghost Marshmallow glowing inside it
  panel_orb_mini    the same sphere turned slime-lime, the ghost inside
  panel_orb_major   the same sphere turned gold, the ghost inside
  bg_graveyard      the moonlit candy graveyard (bg_portal_exit) in a cold, ghostly grade
  ui_reel_strip     public/assets: the Graveyard Lock reel, one orb (or a gap) per grave, looping

They are written to art/source/ (WebP); tools/import-painted.py then imports them like any panel.

  python3 tools/derive-orbs.py && python3 tools/import-painted.py   (needs numpy and Pillow)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "public" / "assets"
SRC = ROOT / "art" / "source"
SIZE = 512

# the orb shell: the Autoplay button's candy glass in its gold ring, at the painting's full size,
# with its arrow icon filled in from the surrounding glass (the ghost sits over the middle anyway)
shell = Image.open(SRC / "btn_auto.webp").convert("RGBA")
shell = shell.crop(shell.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()).resize((SIZE, SIZE), Image.LANCZOS)
px = np.asarray(shell).astype(float)
hsv = np.asarray(shell.convert("RGB").convert("HSV")).astype(float) / 255
yy, xx = np.mgrid[:SIZE, :SIZE]
r = np.hypot(xx - SIZE / 2, yy - SIZE / 2) / (SIZE / 2)
icon = (hsv[..., 2] > 0.72) & (hsv[..., 1] < 0.42) & (r < 0.62)  # the cream arrows
icon = np.asarray(Image.fromarray((icon * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
keep = (~icon).astype(float)
filled = px.copy()
for sigma in (6, 14, 30):  # normalised convolution: fill the holes from the glass around them
    num = np.stack([np.asarray(Image.fromarray(np.clip(px[..., c] * keep, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma))).astype(float) for c in range(3)], -1)
    den = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma))).astype(float)[..., None] / 255
    est = num / np.maximum(den, 1e-3)
    hole = icon & (den[..., 0] > 0.02)
    filled[hole, :3] = est[hole]
    keep = np.maximum(keep, hole.astype(float))
    px = filled.copy()
sphere = Image.fromarray(np.clip(filled, 0, 255).astype(np.uint8), "RGBA")
GLASS = int(SIZE * 0.4)  # radius of the glass inside the ring


def recolor(im: Image.Image, hue_shift: float, sat: float = 1.0, bright: float = 1.0) -> Image.Image:
    """Turns the glass inside the gold ring to another candy colour (a feathered round mask, so the
    ring stays gold and no edge shows)."""
    hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(float)
    hsv[..., 0] = (hsv[..., 0] + hue_shift * 255 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * bright, 0, 255)
    turned = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGBA")
    turned.putalpha(im.getchannel("A"))
    m = Image.new("L", (SIZE, SIZE), 0)
    g = int(GLASS * 1.06)
    ImageDraw.Draw(m).ellipse((SIZE // 2 - g, SIZE // 2 - g, SIZE // 2 + g, SIZE // 2 + g), fill=255)
    return Image.composite(turned, im, m.filter(ImageFilter.GaussianBlur(10)))


def inside(orb: Image.Image, symbol: str, scale: float, glow: tuple[int, int, int]) -> Image.Image:
    """A symbol floating inside the glass: a soft glow, the symbol, then the glass highlight over it."""
    out = orb.copy()
    s = Image.open(A / f"sym_{symbol}.webp").convert("RGBA")
    d = int(GLASS * 2 * scale)
    s = s.resize((d, d), Image.LANCZOS)
    at = ((SIZE - d) // 2, (SIZE - d) // 2 + int(SIZE * 0.02))
    halo = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    halo.paste(Image.new("RGBA", s.size, glow + (255,)), at, s.getchannel("A"))
    out.alpha_composite(Image.eval(halo, lambda v: v).filter(ImageFilter.GaussianBlur(18)))
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    layer.paste(s, at, s)
    a = layer.getchannel("A").point(lambda v: int(v * 0.92))
    layer.putalpha(a)
    out.alpha_composite(layer)
    # the glass's own shine back on top (the brightest pixels of the sphere)
    shine = orb.copy()
    lum = shine.convert("L").point(lambda v: 255 if v > 225 else 0).filter(ImageFilter.GaussianBlur(3))
    glass = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(glass).ellipse((SIZE // 2 - GLASS, SIZE // 2 - GLASS, SIZE // 2 + GLASS, SIZE // 2 + GLASS), fill=255)
    shine.putalpha(Image.fromarray(np.minimum(np.asarray(lum), np.asarray(glass)).astype(np.uint8)).point(lambda v: int(v * 0.8)))
    out.alpha_composite(shine)
    return out


soul = inside(recolor(sphere, 12, 1.05, 1.05), "GM", 0.9, (255, 140, 230))
mini = inside(recolor(sphere, 146, 1.0, 1.05), "GM", 0.9, (190, 255, 120))
major = inside(recolor(sphere, 95, 1.15, 1.2), "GM", 0.9, (255, 220, 120))
for name, im in (("soul", soul), ("mini", mini), ("major", major)):
    im.save(SRC / f"panel_orb_{name}.webp", "WEBP", quality=95, method=6)

# the Graveyard Lock backdrop: the graveyard behind the bonus exit, cooled towards violet and teal
# and darkened at the edges so the orbs carry the light
yard = Image.open(SRC / "bg_portal_exit.webp").convert("RGB")
hsv = np.asarray(yard.convert("HSV")).astype(float)
hsv[..., 0] = (hsv[..., 0] + 14) % 256  # warm candle orange drifts to rose, violet to blue-violet
hsv[..., 1] *= 0.85
yard = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
w, h = yard.size
yy, xx = np.mgrid[:h, :w]
vignette = 1 - 0.55 * np.clip(np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) - 0.35, 0, 1)
px = np.asarray(yard).astype(float) * vignette[..., None] * np.array([0.82, 0.88, 1.0])
Image.fromarray(px.clip(0, 255).astype(np.uint8)).save(SRC / "bg_graveyard.webp", "WEBP", quality=95, method=6)
# the reel strip a column of empty graves scrolls while it spins: one tile per grave, looping
TILE = 200
order = ["soul", None, "lantern", "soul", None, "mini", "soul", None, "major", "soul", None, "soul"]
art = {"soul": soul, "mini": mini, "major": major, "lantern": Image.open(A / "sym_JK.webp").convert("RGBA")}
strip = Image.new("RGBA", (TILE, TILE * len(order)), (0, 0, 0, 0))
for i, kind in enumerate(order):
    if kind:
        pad = 14 if kind == "lantern" else 8
        strip.alpha_composite(art[kind].resize((TILE - 2 * pad, TILE - 2 * pad), Image.LANCZOS), (pad, i * TILE + pad))
strip.save(A / "ui_reel_strip.webp", "WEBP", quality=88, method=6)
print("wrote art/source/panel_orb_soul.webp, panel_orb_mini.webp, panel_orb_major.webp, bg_graveyard.webp")
