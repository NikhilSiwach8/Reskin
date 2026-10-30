"""Derives interface textures from the painted art (no new artwork):

  ui_frame.webp          the board's candy-cane frame around a deep plum glass window. Its top and bottom
                         edges between the corner ornaments are rebuilt from crossfaded repeats
                         of plain candy-cane twist, so the frame nine-slices to any dialog width with
                         no seam (CSS: border-image-slice 270 220 385 220 fill, repeat round).
  ui_frame_crest.webp    the pumpkin crest from the top of the frame, set on top of a dialog
  ui_window.webp         the dark swirled window of the free-spins panel (card art backing)
  ui_cane.webp           one seamless repeat of the candy-cane twist, for bars and slider fills
  ui_logo.webp           the painted SUGAR SCREAM wordmark lifted off the loading art (keyed on its
                         pink and lime candy and the dark outline around it)

  python3 tools/derive-ui.py   (needs numpy, scipy and Pillow)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

A = Path(__file__).resolve().parent.parent / "public" / "assets"

board = Image.open(A / "panel_board.webp").convert("RGBA")
W, H = board.size
L, T, R, B = 111, 206, W - 111, 918  # the painted window (BOARD_FRAME in src/client/game/scene.ts)
CORNER = 220  # corner ornaments reach this far in from each side
TOP, BOTTOM = 270, H - 760  # slice heights: the top rim, and the bottom rim with its skull corners


RGB = np.asarray(board, dtype=float)


def twist_period(y0: int, y1: int, xs: range) -> tuple[int, int]:
    """Where the candy-cane twist repeats best: the start x and repeat length whose edge columns match."""
    def seam(x0: int, lag: int) -> float:
        return float(np.abs(RGB[y0:y1, x0:x0 + 3, :] - RGB[y0:y1, x0 + lag:x0 + lag + 3, :]).mean())
    return min(((x0, lag) for x0 in xs for lag in range(110, 200)), key=lambda c: seam(*c))


FADE = 28  # each repeat crossfades into the next over this many pixels, so no join shows


def side_period(x0: int, x1: int, ys: range) -> tuple[int, int]:
    """The same for a side rim, along y."""
    def seam(y0: int, lag: int) -> float:
        return float(np.abs(RGB[y0:y0 + 3, x0:x1, :] - RGB[y0 + lag:y0 + lag + 3, x0:x1, :]).mean())
    return min(((y0, lag) for y0 in ys for lag in range(110, 200)), key=lambda c: seam(*c))


def tiled_band(src: np.ndarray, y0: int, y1: int, x0: int, period: int, span: int = W - 2 * CORNER) -> Image.Image:
    """Whole repeats of one twist (rows y0..y1 of src, from x0) filling the span between the corners."""
    tile = src[y0:y1, x0:x0 + period + FADE]
    n = max(1, round(span / period))
    strip = np.zeros((y1 - y0, n * period + FADE, 4))
    ramp = np.linspace(0, 1, FADE)[None, :, None]
    for i in range(n):
        at = i * period
        if i:
            strip[:, at:at + FADE] = strip[:, at:at + FADE] * (1 - ramp) + tile[:, :FADE] * ramp
            strip[:, at + FADE:at + period + FADE] = tile[:, FADE:]
        else:
            strip[:, :period + FADE] = tile
    img = Image.fromarray(strip[:, :n * period].clip(0, 255).astype(np.uint8), "RGBA")
    return img.resize((span, y1 - y0), Image.LANCZOS)


frame = board.copy()
# top rim: plain twist from the left of the pumpkin; bottom rim: plain twist left of the gem
tx, pt = twist_period(20, TOP, range(230, 330, 2))
frame.paste(tiled_band(RGB, 0, TOP, tx, pt), (CORNER, 0))
bx, pb = twist_period(H - BOTTOM, H, range(240, 420, 2))
frame.paste(tiled_band(RGB, H - BOTTOM, H, bx, pb), (CORNER, H - BOTTOM))
# side rims: the same, along y (tiled as a band of the image turned on its side)
SIDE = H - TOP - BOTTOM
for x0, x1 in ((0, CORNER), (W - CORNER, W)):
    sy, ps = side_period(x0, x1, range(TOP, TOP + 140, 2))
    band = tiled_band(RGB[:, x0:x1].transpose(1, 0, 2), 0, x1 - x0, sy, ps, SIDE)
    frame.paste(band.transpose(Image.TRANSPOSE), (x0, TOP))
# the window: a deep plum glass, shaded darker under the rim (border-image "fill" stretches its middle)
win = Image.new("L", frame.size, 0)
ImageDraw.Draw(win).rounded_rectangle((L + 6, T + 6, R - 6, B - 6), radius=34, fill=255)
inside = np.asarray(win) > 0
shade = np.exp(-nd.distance_transform_edt(inside) / 26.0)[..., None]  # 1 at the rim, 0 deep inside
glass = np.array([30, 8, 52], dtype=float) * (1 - shade) + np.array([8, 0, 16], dtype=float) * shade
px = np.asarray(frame, dtype=float).copy()
px[inside, :3] = glass[inside]
px[inside, 3] = 247
frame = Image.fromarray(px.clip(0, 255).astype(np.uint8), "RGBA")
frame.save(A / "ui_frame.webp", quality=90)

# one repeat of the rim's candy-cane tube, for progress bars and slider fills
board.crop((tx, 118, tx + pt, 196)).convert("RGB").save(A / "ui_cane.webp", quality=90)

# the crest: pumpkin and gold scrolls from the top centre, feathered at its sides
CX0, CX1 = 430, 950
crest = board.crop((CX0, 0, CX1, TOP))
fade = Image.new("L", crest.size, 255)
d = ImageDraw.Draw(fade)
for i in range(46):
    v = int(255 * i / 46)
    d.line((i, 0, i, crest.height), fill=v)
    d.line((crest.width - 1 - i, 0, crest.width - 1 - i, crest.height), fill=v)
crest.putalpha(Image.composite(crest.getchannel("A"), Image.new("L", crest.size, 0), fade.filter(ImageFilter.GaussianBlur(2))))
crest.save(A / "ui_frame_crest.webp", quality=90)

# the dialog fill: the free-spins panel's dark window (below its cauldron)
free = Image.open(A / "panel_free.webp").convert("RGBA")
fw, fh = free.size
free.crop((int(fw * 0.16), int(fh * 0.42), int(fw * 0.84), int(fh * 0.86))).convert("RGB").save(A / "ui_window.webp", quality=88)

# the wordmark: candy-pink and slime-lime letters, their holes filled, plus the dark outline ring
load = Image.open(A / "bg_loading.webp").convert("RGB")
lw, lh = load.size
logo = load.crop((int(lw * 0.22), int(lh * 0.08), int(lw * 0.78), int(lh * 0.62)))
hsv = np.asarray(logo.convert("HSV"), dtype=float) / 255
hue, sat, val = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
core = (((hue > 300) | (hue < 15)) & (sat > 0.35) & (val > 0.6)) | ((hue > 45) & (hue < 120) & (sat > 0.45) & (val > 0.45))
core = nd.binary_fill_holes(nd.binary_closing(core, iterations=3))
lab, n = nd.label(core)
sizes = nd.sum(core, lab, range(1, n + 1))
keep = nd.binary_fill_holes(nd.binary_closing(np.isin(lab, 1 + np.where(sizes > 4000)[0]), iterations=6))
m = keep | (nd.binary_dilation(keep, iterations=9) & ~keep & (val < 0.42))
yy, xx = np.mgrid[: m.shape[0], : m.shape[1]]
m &= ~(((xx < 120) & (yy > 330)) | ((xx < 160) & (yy > 405)) | ((xx > 870) & (yy > 330)))  # smoke wisps and candy corn
m = nd.binary_fill_holes(nd.binary_closing(m, iterations=3))
logo = logo.convert("RGBA")
logo.putalpha(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4)))
logo.crop(logo.getbbox()).save(A / "ui_logo.webp", quality=90)
print(f"twist periods: top {pt}px, bottom {pb}px, sides {ps}px; wrote ui_frame.webp, ui_frame_crest.webp, ui_window.webp, ui_cane.webp, ui_logo.webp")
