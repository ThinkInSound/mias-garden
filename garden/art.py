"""Procedural Victorian botanical art for Mia's Garden, with no third-party dependencies.

Tiles are drawn in base orientation by per-pixel shaders (supersampled), then
rotated exactly the way SimpleTiledModel.cs rotates them. The same drawings are
written as the PNGs the C# model loads and used to render finished grids.
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path
from typing import Callable, Dict, List, Tuple

from .tiles import CARDINALITY, TILES

RGB = Tuple[int, int, int]


def _hex(h: str) -> RGB:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


PALETTE: Dict[str, RGB] = {k: _hex(v) for k, v in {
    "parchment": "#F4F1EA", "parchment_shade": "#EADCC9", "sepia": "#7A6150",
    "forest": "#2F4A36", "fern": "#5C7A55", "sage": "#9DB08F",
    "rose": "#C48B8B", "rose_deep": "#9A5B62", "rose_blush": "#E8C9C3",
    "lavender": "#B6A5CC", "lavender_deep": "#8A79A8",
    "pond": "#C9CDDD", "pond_deep": "#B0B6CB", "pond_glint": "#E6E7EF",
    "stone": "#D8CCB7", "mortar": "#B9AA92",
    "iron": "#34322F", "gold": "#B08D57", "gold_light": "#D9BF86",
}.items()}

P = PALETTE
Shader = Callable[[float, float], RGB]


def _hash(x: int, y: int, salt: int = 0) -> float:
    h = (x * 374761393 + y * 668265263 + salt * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 0xFFFFFFFF


def _seg_dist(u, v, x0, y0, x1, y1) -> float:
    dx, dy = x1 - x0, y1 - y0
    t = max(0.0, min(1.0, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy)))
    return math.hypot(u - x0 - t * dx, v - y0 - t * dy)


def _leaf(u, v, cx, cy, angle, length=0.13, width=0.05) -> int:
    """0 outside, 1 leaf blade, 2 midrib. Pointed ellipse from (cx, cy) along angle."""
    ca, sa = math.cos(angle), math.sin(angle)
    x = (u - cx) * ca + (v - cy) * sa
    y = -(u - cx) * sa + (v - cy) * ca
    if x < 0 or x > length:
        return 0
    half = width * math.sin(math.pi * x / length)
    if abs(y) > half:
        return 0
    return 2 if abs(y) < 0.008 and x < length * 0.8 else 1


# ---------------------------------------------------------------- base layers

def lawn(u, v) -> RGB:
    gx, gy = int(u * 48), int(v * 48)
    r = _hash(gx, gy, 1)
    if r < 0.025:
        return P["sepia"] if r < 0.008 else P["sage"]
    return P["parchment_shade"] if _hash(gx // 3, gy // 3, 2) < 0.08 else P["parchment"]


def paving(u, v) -> RGB:
    fu, fv = (u * 4) % 1.0, (v * 4) % 1.0
    if fu < 0.05 or fu > 0.95 or fv < 0.05 or fv > 0.95:
        return P["mortar"]
    if _hash(int(u * 4), int(v * 4), 3) < 0.3 and _hash(int(u * 32), int(v * 32), 4) < 0.15:
        return P["parchment_shade"]
    return P["stone"]


def pond(u, v) -> RGB:
    cx, cy = int(u * 6), int(v * 6)
    if _hash(cx, cy, 5) < 0.22:
        fx, fy = (u * 6) % 1.0, (v * 6) % 1.0
        if abs(fy - 0.5) < 0.05 and 0.25 < fx < 0.75:
            return P["pond_glint"]
    return P["pond_deep"] if _hash(int(u * 24), int(v * 24), 6) < 0.08 else P["pond"]


# ------------------------------------------------------------ vine primitives

STEM_W = 0.035


def _stem(u, v, segments) -> RGB | None:
    for seg in segments:
        d = _seg_dist(u, v, *seg)
        if d < STEM_W:
            return P["forest"] if d > STEM_W * 0.45 else P["fern"]
    return None


def _thorn(u, v, x, y, dx, dy) -> bool:
    """Tiny sepia thorn pointing (dx, dy) from (x, y)."""
    return _seg_dist(u, v, x, y, x + dx, y + dy) < 0.012


def _leaf_color(k) -> RGB | None:
    return None if k == 0 else (P["forest"] if k == 2 else P["fern"])


def bramble_stem(bloom: float) -> Shader:
    leaves = [(0.5, 0.3, -2.4), (0.5, 0.3, -0.74), (0.5, 0.7, 2.4), (0.5, 0.7, 0.74)]

    def shade(u, v):
        for cx, cy, ang in leaves:
            c = _leaf_color(_leaf(u, v, cx, cy, ang))
            if c: return c
        s = _stem(u, v, [(0.5, 0.0, 0.5, 1.0)])
        if s: return s
        for y in (0.12, 0.88):
            for side in (-1, 1):
                if _thorn(u, v, 0.5 + side * STEM_W, y, side * 0.03, -0.02 if y < 0.5 else 0.02):
                    return P["sepia"]
        return lawn(u, v)
    return shade


def bramble_turn(bloom: float) -> Shader:
    def shade(u, v):
        c = _leaf_color(_leaf(u, v, 0.5 + 0.5 * math.cos(2.36), 0.5 * math.sin(2.36), 2.36, 0.14, 0.055))
        if c: return c
        d = abs(math.hypot(u - 1.0, v) - 0.5)
        if d < STEM_W:
            return P["forest"] if d > STEM_W * 0.45 else P["fern"]
        return lawn(u, v)
    return shade


def bramble_fork(bloom: float) -> Shader:
    def shade(u, v):
        # lavender sprig rising from the joint
        if abs(u - 0.5) < 0.012 and 0.2 < v < 0.5:
            return P["fern"]
        for i, y in enumerate((0.2, 0.27, 0.34, 0.41)):
            for side in ((0,) if i == 0 else (-1, 1)):
                if math.hypot(u - 0.5 - side * 0.035, v - y) < 0.03 * bloom:
                    return P["lavender_deep"] if (i + (side > 0)) % 2 else P["lavender"]
        for cx, cy, ang in ((0.25, 0.5, -2.0), (0.75, 0.5, -1.14)):
            c = _leaf_color(_leaf(u, v, cx, cy, ang, 0.11, 0.045))
            if c: return c
        s = _stem(u, v, [(0.0, 0.5, 1.0, 0.5), (0.5, 0.5, 0.5, 1.0)])
        if s: return s
        return lawn(u, v)
    return shade


def _bud(u, v, cx, cy, r) -> RGB | None:
    d = math.hypot(u - cx, v - cy)
    if d > r:
        return None
    if d > r * 0.86:
        return P["rose_deep"]
    a = math.atan2(v - cy, u - cx)
    spiral = (d / r * 2.2 + a / (2 * math.pi)) % 1.0
    if spiral < 0.16:
        return P["rose_deep"]
    return P["rose_blush"] if d < r * 0.25 or (u < cx and v < cy and d < r * 0.6) else P["rose"]


def rose_bud(bloom: float) -> Shader:
    r = 0.16 * bloom

    def shade(u, v):
        b = _bud(u, v, 0.5, 0.44, r)
        if b: return b
        for cx, cy, ang in ((0.5, 0.44 + r * 0.7, -2.5), (0.5, 0.44 + r * 0.7, -0.64)):
            c = _leaf_color(_leaf(u, v, cx, cy, ang, 0.1, 0.04))
            if c: return c
        for cx, cy, ang in ((0.5, 0.8, 2.6), (0.5, 0.8, 0.54)):
            c = _leaf_color(_leaf(u, v, cx, cy, ang))
            if c: return c
        s = _stem(u, v, [(0.5, 0.44, 0.5, 1.0)])
        if s: return s
        return lawn(u, v)
    return shade


def rose_bush(bloom: float) -> Shader:
    lobes = [(0.5 + 0.17 * math.cos(k * 2 * math.pi / 7), 0.5 + 0.17 * math.sin(k * 2 * math.pi / 7))
             for k in range(7)]
    blooms = [(0.5, 0.5)] + [(0.5 + 0.17 * math.cos(a), 0.5 + 0.17 * math.sin(a))
                             for a in (0.4, 1.66, 2.92, 4.18, 5.44)]
    r = 0.085 * bloom

    def shade(u, v):
        for cx, cy in blooms:
            b = _bud(u, v, cx, cy, r)
            if b: return b
        inner = min(math.hypot(u - x, v - y) for x, y in lobes)
        if inner < 0.15 or math.hypot(u - 0.5, v - 0.5) < 0.2:
            leafy = _hash(int(u * 40), int(v * 40), 7)
            return P["forest"] if leafy < 0.25 else (P["sage"] if leafy > 0.9 else P["fern"])
        if inner < 0.17:
            return P["forest"]
        # soft ink shadow to the lower right, as on an engraved plate
        if math.hypot(u - 0.53, v - 0.54) < 0.37 and _hash(int(u * 48), int(v * 48), 8) < 0.35:
            return P["parchment_shade"]
        return lawn(u, v)
    return shade


# ---------------------------------------------------------- region boundaries

def _rail(d: float) -> RGB | None:
    """Double iron rail centred on a boundary; d is signed distance across it."""
    if abs(abs(d) - 0.035) < 0.01:
        return P["iron"]
    return None


def _post(u, v, x, y) -> RGB | None:
    d = math.hypot(u - x, v - y)
    if d < 0.018:
        return P["gold_light"]
    if d < 0.035:
        return P["gold"] if d < 0.026 else P["iron"]
    return None


def _boundary(inside: Callable[[float, float], float], fill_in: Shader, fill_out: Shader,
              posts, rail: bool) -> Shader:
    """inside(u, v) < 0 means the inner region (stone or water)."""
    def shade(u, v):
        for x, y in posts:
            p = _post(u, v, x, y) if rail else None
            if p: return p
        d = inside(u, v)
        if rail:
            r = _rail(d)
            if r: return r
        else:
            if 0 <= d < 0.03:
                return P["fern"]
            if 0.03 <= d < 0.08:
                reed = _hash(int(u * 40), int(v * 40), 9) < 0.5
                return P["sage"] if reed else P["parchment_shade"]
        return fill_in(u, v) if d < 0 else fill_out(u, v)
    return shade


def _arc_posts(cx, cy):
    return [(cx + 0.5 * math.cos(a), cy + 0.5 * math.sin(a))
            for a in ((math.pi / 8, 3 * math.pi / 8) if cy == 0 else (-3 * math.pi / 8, -math.pi / 8))]


def straight(fill_in, rail):
    return lambda bloom: _boundary(lambda u, v: v - 0.5, fill_in, lawn,
                                   [(0.25, 0.5), (0.75, 0.5)], rail)


def outer(fill_in, rail):
    return lambda bloom: _boundary(lambda u, v: math.hypot(u - 1, v) - 0.5, fill_in, lawn,
                                   [(1 - x, y) for x, y in _arc_posts(0, 0)], rail)


def inner(fill_in, rail):
    return lambda bloom: _boundary(lambda u, v: 0.5 - math.hypot(u, v - 1), fill_in, lawn,
                                   _arc_posts(0, 1), rail)


def lily_pad(bloom: float) -> Shader:
    pads = [(0.3, 0.32, 0.15, 0.6), (0.7, 0.36, 0.12, 2.4), (0.42, 0.72, 0.13, 4.2)]
    lr = 0.1 * bloom

    def shade(u, v):
        # water lily: eight blush-lavender petals, gold heart
        lx, ly = 0.66, 0.68
        d = math.hypot(u - lx, v - ly)
        if d < lr * 0.28:
            return P["gold"] if d > lr * 0.14 else P["gold_light"]
        if d < lr:
            a = math.atan2(v - ly, u - lx)
            petal = abs(math.cos(4 * a))
            if d < lr * (0.55 + 0.45 * petal):
                return P["lavender"] if d > lr * 0.75 else P["rose_blush"]
        for cx, cy, r, notch in pads:
            d = math.hypot(u - cx, v - cy)
            if d < r:
                a = (math.atan2(v - cy, u - cx) - notch) % (2 * math.pi)
                if a < 0.45:
                    continue
                if d > r - 0.012:
                    return P["forest"]
                vein = abs(math.sin(5 * (a - 0.225))) < 0.08 and d > 0.02
                return P["sage"] if vein else P["fern"]
        return pond(u, v)
    return shade


SHADERS: Dict[str, Callable[[float], Shader]] = {
    "parchment_grass": lambda bloom: lawn,
    "rose_bush": rose_bush,
    "rose_bud": rose_bud,
    "bramble_stem": bramble_stem,
    "bramble_turn": bramble_turn,
    "bramble_fork": bramble_fork,
    "stone_path": lambda bloom: paving,
    "iron_fence": straight(paving, True),
    "iron_fence_corner": outer(paving, True),
    "iron_fence_inner": inner(paving, True),
    "water": lambda bloom: pond,
    "lily_pad": lily_pad,
    "pond_bank": straight(pond, False),
    "pond_bank_corner": outer(pond, False),
    "pond_bank_inner": inner(pond, False),
}


# -------------------------------------------------------------- raster output

Image = List[RGB]  # row-major, size * size


def draw_tile(name: str, size: int, bloom: float = 1.0, ss: int = 3) -> Image:
    shader = SHADERS[name](bloom)
    out: Image = []
    n = ss * ss
    for y in range(size):
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = shader((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
                    r += c[0]; g += c[1]; b += c[2]
            out.append((r // n, g // n, b // n))
    return out


def rotate(img: Image, size: int) -> Image:
    """SimpleTiledModel.cs rotate(): result(x, y) = src(size-1-y, x)."""
    return [img[size - 1 - y + x * size] for y in range(size) for x in range(size)]


def tile_variants(size: int, bloom: float = 1.0) -> Dict[str, Image]:
    """Every '<name> <t>' label the C# textOutput can emit, mapped to its bitmap."""
    out: Dict[str, Image] = {}
    for tile in TILES:
        img = draw_tile(tile.name, size, bloom)
        for t in range(CARDINALITY[tile.symmetry]):
            out[f"{tile.name} {t}"] = img
            img = rotate(img, size)
    return out


def write_png(path: Path, width: int, height: int, pixels: Image) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for r, g, b in pixels[y * width:(y + 1) * width]:
            raw += bytes((r, g, b))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
                     + chunk(b"IEND", b""))


def write_tile_pngs(folder: Path, size: int, bloom: float = 1.0) -> None:
    """Base-orientation PNGs named the way SimpleTiledModel loads them (unique=False)."""
    for tile in TILES:
        write_png(folder / f"{tile.name}.png", size, size, draw_tile(tile.name, size, bloom))


Grid = List[List[str]]  # rows of '<name> <t>' labels


def render(grid: Grid, size: int, bloom: float = 1.0, frame: bool = True) -> Tuple[int, int, Image]:
    """Compose a finished grid into one picture, optionally inside a gilt plate frame."""
    tiles = tile_variants(size, bloom)
    rows, cols = len(grid), len(grid[0])
    m = max(12, size * 3 // 4) if frame else 0
    W, H = cols * size + 2 * m, rows * size + 2 * m
    px: Image = [P["parchment_shade"]] * (W * H)

    for gy, row in enumerate(grid):
        for gx, label in enumerate(row):
            img = tiles[label]
            for y in range(size):
                base = (m + gy * size + y) * W + m + gx * size
                px[base:base + size] = img[y * size:(y + 1) * size]

    if frame:
        def rect(inset, thick, color):
            for t in range(thick):
                i = inset + t
                for x in range(i, W - i):
                    px[i * W + x] = color
                    px[(H - 1 - i) * W + x] = color
                for y in range(i, H - i):
                    px[y * W + i] = color
                    px[y * W + W - 1 - i] = color

        rect(m // 5, max(2, m // 8), P["gold"])
        rect(m // 5 + max(2, m // 8) + 2, 1, P["gold_light"])
        rect(m - 3, 2, P["sepia"])
        # gilt rosettes at the four corners
        c, rr = m // 5 + max(2, m // 8) // 2, max(3, m // 4)
        for cx, cy in ((c, c), (W - 1 - c, c), (c, H - 1 - c), (W - 1 - c, H - 1 - c)):
            for y in range(cy - rr, cy + rr + 1):
                for x in range(cx - rr, cx + rr + 1):
                    if 0 <= x < W and 0 <= y < H:
                        d = math.hypot(x - cx, y - cy)
                        if d <= rr:
                            px[y * W + x] = P["gold_light"] if d < rr * 0.45 else P["gold"]
    return W, H, px
