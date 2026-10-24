#!/usr/bin/env python3
"""Cut the supplied painted artwork (art/source/*.webp) into individual game assets.

    python3 tools/import-painted.py      # then: npm run art

Writes
  art/painted/<name>.png  painted replacements that tools/render-art.mjs prefers over vector renders
  src/client/ui/img/<name>.webp  painted UI pieces (bundled by Vite) (spin button, buttons, meter and feature panels)

Background removal is a flood fill from the crop edges (pixels close to the background
colour), followed by a soft colour-to-alpha band so glows fade out instead of keeping a halo.
Symbol tiles keep their painted plates (the glow is painted over them), cut with rounded corners.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art/source'
PAINTED = ROOT / 'art/painted'
UI = ROOT / 'src/client/ui/img'
PAINTED.mkdir(parents=True, exist_ok=True)
UI.mkdir(parents=True, exist_ok=True)


def load(name):
    return Image.open(SRC / name).convert('RGBA')


# ---------------------------------------------------------------- helpers

def rounded_mask(w, h, r):
    """Anti-aliased rounded-rectangle alpha mask (4x supersampled)."""
    s = 4
    yy, xx = np.mgrid[0:h * s, 0:w * s]
    cx = np.clip(xx, r * s, (w - r) * s)
    cy = np.clip(yy, r * s, (h - r) * s)
    inside = ((xx - cx) ** 2 + (yy - cy) ** 2) <= (r * s) ** 2
    m = inside.reshape(h, s, w, s).mean(axis=(1, 3))
    return (m * 255).astype(np.uint8)


def flood_background(rgb, bg, tol):
    """Boolean mask of pixels connected to the image edge whose colour is within `tol` of `bg`."""
    h, w, _ = rgb.shape
    near = np.abs(rgb.astype(int) - np.array(bg)).max(axis=2) <= tol
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:] |= out[:-1]
        m[:-1] |= out[1:]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def key_out(img, bg, tol, band=6):
    """Removes the background colour connected to the edges, with a soft colour-to-alpha band."""
    a = np.asarray(img).astype(float)
    rgb = a[..., :3]
    bgm = flood_background(rgb.astype(np.uint8), bg, tol)
    edge = dilate(bgm, band) & ~bgm
    bgc = np.array(bg, float)
    span = np.maximum(255 - bgc, bgc)
    alpha = np.where(bgm, 0.0, 1.0)
    # colour-to-alpha against the background inside the band
    diff = np.abs(rgb - bgc) / span
    ca = np.clip(diff.max(axis=2) * 1.6, 0, 1)
    alpha = np.where(edge, ca, alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = np.clip((rgb - (1 - alpha[..., None]) * bgc) / safe, 0, 255)
    rgb_out = np.where(edge[..., None], unmixed, rgb)
    out = np.dstack([rgb_out, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(img, pad=4):
    bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))


def square(img, size=None):
    """Centres an image on a transparent square canvas."""
    s = max(img.size)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img, ((s - img.width) // 2, (s - img.height) // 2), img)
    return out.resize((size, size), Image.LANCZOS) if size else out


def shift_greens(img, target_hue, sat_boost=1.0):
    """Moves green hues (only) to `target_hue` (PIL 0-255 scale); gold, purple and grey stay."""
    rgba = np.asarray(img)
    hsv = np.asarray(img.convert('RGB').convert('HSV')).copy().astype(int)
    h, s = hsv[..., 0], hsv[..., 1]
    green = (h >= 55) & (h <= 125) & (s >= 50)
    hsv[..., 0] = np.where(green, target_hue, h)
    hsv[..., 1] = np.where(green, np.clip(s * sat_boost, 0, 255), s)
    rgb = np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB'))
    return Image.fromarray(np.dstack([rgb, rgba[..., 3]]), 'RGBA')


def save_painted(name, img):
    img.save(PAINTED / f'{name}.png')
    print(f'art/painted/{name}.png  {img.width}x{img.height}')


def save_ui(name, img, width):
    h = round(img.height * width / img.width)
    img.resize((width, h), Image.LANCZOS).save(UI / f'{name}.webp', quality=92)
    print(f'src/client/ui/img/{name}.webp  {width}x{h}')


# ---------------------------------------------------------------- symbols (symbols-sheet.webp)

sheet = load('symbols-sheet.webp')
COLS = [17, 378, 738, 1099]
ROWS = [22, 376, 728]
TILE = 331
TILES = {
    (0, 0): 'sym_relic', (0, 1): 'sym_vaultdoor', (0, 2): 'sym_phantom', (0, 3): 'sym_clock',
    (1, 0): 'sym_key', (1, 1): 'sym_elixir', (1, 2): 'sym_ledger', (1, 3): 'sym_chest',
    (2, 0): 'sym_goldbag', (2, 1): 'deco_candle', (2, 2): 'fx_portal', (2, 3): 'fx_lock',
}
mask = Image.fromarray(rounded_mask(TILE, TILE, 30), 'L')
tiles = {}
for (r, c), name in TILES.items():
    t = sheet.crop((COLS[c], ROWS[r], COLS[c] + TILE, ROWS[r] + TILE))
    t.putalpha(mask)
    tiles[name] = t
    if not name.startswith('deco'):
        save_painted(name, t.resize((1024, 1024), Image.LANCZOS))

save_painted('relic_block', tiles['sym_relic'].resize((1024, 1024), Image.LANCZOS))
save_painted('fx_phantom', tiles['sym_phantom'].resize((1024, 1024), Image.LANCZOS))
save_painted('fx_vault_door', tiles['sym_vaultdoor'].resize((1024, 1024), Image.LANCZOS))
key = tiles['sym_key'].resize((1024, 1024), Image.LANCZOS)
save_painted('key_cursed_fortune', key)
save_painted('key_phantom_payday', shift_greens(key, 200, 1.1))
save_painted('key_midnight_countdown', shift_greens(key, 22, 1.2))

# ---------------------------------------------------------------- logo (already transparent)

logo = trim(load('logo.webp'), 6)
save_painted('logo', logo.resize((1536, round(logo.height * 1536 / logo.width)), Image.LANCZOS))

# ---------------------------------------------------------------- backgrounds

bank = load('bg-bank.webp').convert('RGB').resize((1920, 1080), Image.LANCZOS)
save_painted('bg_bank', bank.convert('RGBA'))
vault = load('bg-vault.webp').convert('RGB').resize((1920, 1080), Image.LANCZOS).convert('RGBA')
save_painted('bg_final_heist', vault)
# Cursed Fortune: a closer view of the treasury, greener
w, h = vault.size
zoom = vault.crop((int(w * 0.08), int(h * 0.06), int(w * 0.92), int(h * 0.94))).resize((1920, 1080), Image.LANCZOS)
save_painted('bg_cursed_fortune', shift_greens(zoom, 92, 1.15))
save_painted('bg_phantom_payday', shift_greens(vault, 196, 1.1))
save_painted('bg_midnight_countdown', shift_greens(vault, 24, 1.15))

# ---------------------------------------------------------------- UI (ui-sheet.webp, dark background)

ui = load('ui-sheet.webp')
UI_BG = (13, 9, 22)
UI_CROPS = {
    'spin': ((12, 2, 434, 382), 360),
    'btn_menu': ((452, 12, 613, 143), 120),
    'btn_sound': ((622, 12, 783, 143), 120),
    'btn_settings': ((792, 12, 938, 143), 120),
    'btn_turbo': ((947, 12, 1103, 143), 120),
    'btn_minus': ((1127, 12, 1293, 143), 120),
    'btn_plus': ((1317, 12, 1483, 143), 120),
    'panel_balance': ((450, 160, 780, 318), 360),
    'panel_bet': ((790, 160, 1120, 318), 360),
    'panel_win': ((1145, 160, 1525, 318), 400),
    'panel_feature': ((1078, 338, 1534, 704), 460),
}
pieces = {}
for name, (box, width) in UI_CROPS.items():
    piece = trim(key_out(ui.crop(box), UI_BG, 22, band=5), 2)
    pieces[name] = piece
    save_ui(name, piece, width)

# Blank button plate: the turbo plate with its icon covered by the plate's own interior shading.
blank = pieces['btn_turbo'].copy()
arr = np.asarray(blank).copy()
hgt, wid = arr.shape[:2]
y0, y1, x0, x1 = int(hgt * 0.20), int(hgt * 0.82), int(wid * 0.27), int(wid * 0.73)
# take a vertical strip of interior just left of the icon and stretch it across the icon area
strip = arr[y0:y1, int(wid * 0.22):int(wid * 0.26), :3].astype(float).mean(axis=1)
arr[y0:y1, x0:x1, :3] = np.repeat(strip[:, None, :], x1 - x0, axis=1).astype(np.uint8)
save_ui('btn_blank', Image.fromarray(arr, 'RGBA'), 120)
print('done')
