"""Builds the Graveyard Lock orbs from the painted art (no new artwork):

  panel_orb_soul    the candy-glass sphere from the board frame's corner (gold ring included)
                    with the Ghost Marshmallow glowing inside it
  panel_orb_mini    the same sphere turned slime-lime, the ghost inside
  panel_orb_major   the same sphere turned gold, the ghost inside
  bg_graveyard      the moonlit candy graveyard (bg_portal_exit) in a cold, ghostly grade

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

board = Image.open(A / "panel_board.webp").convert("RGBA")
CX, CY, R = 119, 141, 70  # the top-left corner sphere and its gold ring
sphere = board.crop((CX - R, CY - R, CX + R, CY + R)).resize((SIZE, SIZE), Image.LANCZOS)
mask = Image.new("L", (SIZE * 4, SIZE * 4), 0)
ImageDraw.Draw(mask).ellipse((8, 8, SIZE * 4 - 8, SIZE * 4 - 8), fill=255)
sphere.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
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


soul = inside(sphere, "GM", 0.72, (255, 140, 230))
mini = inside(recolor(sphere, 130, 1.0, 1.0), "GM", 0.72, (190, 255, 120))
major = inside(recolor(sphere, 62, 1.1, 1.12), "GM", 0.72, (255, 220, 120))
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
print("wrote art/source/panel_orb_soul.webp, panel_orb_mini.webp, panel_orb_major.webp, bg_graveyard.webp")
