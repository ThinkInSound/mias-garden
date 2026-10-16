# Ported from WaveFunctionCollapse, Copyright (C) 2016 Maxim Gumin, MIT License.
"""Mia's Garden tile catalog for WaveFunctionCollapse's SimpleTiledModel.

Each tile declares its four edges as sockets in base orientation. Neighbor rules
are derived from socket matches, compressed to the minimal set SimpleTiledModel
needs (it expands every rule by rotation and reflection itself), then checked by
rebuilding the C# propagator and comparing it to the socket ground truth.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# An edge is three samples (corner, middle, corner) read clockwise around the tile.
# Two tiles fit when one edge equals the other reversed.
GRASS = ("G", "G", "G")
STONE = ("S", "S", "S")
WATER = ("W", "W", "W")
STEM = ("G", "v", "G")      # lawn with a bramble stem crossing at the midpoint
FENCE = ("S", "f", "G")     # stone, iron railing, lawn
BANK = ("W", "b", "G")      # water, reed bank, lawn


def rev(edge):
    return tuple(reversed(edge))


@dataclass(frozen=True)
class Tile:
    name: str
    symmetry: str
    edges: tuple  # (top, right, bottom, left) in base orientation
    weight: float
    desc: str


TILES: List[Tile] = [
    Tile("parchment_grass", "X", (GRASS,) * 4, 8.0,
         "Open lawn drawn as bare aged parchment with faint sepia stipple."),
    Tile("rose_bush", "X", (GRASS,) * 4, 0.7,
         "A clipped standard rose seen from above: round fern-green crown, five dusty-rose blooms."),
    Tile("rose_bud", "T", (GRASS, GRASS, STEM, GRASS), 0.4,
         "Stem rises from the bottom edge to a single furled bud with two sepals. Ends a vine."),
    Tile("bramble_stem", "I", (STEM, GRASS, STEM, GRASS), 0.5,
         "Straight forest-green stem, top to bottom, with paired leaves and small thorns."),
    Tile("bramble_turn", "L", (STEM, STEM, GRASS, GRASS), 0.45,
         "Quarter-arc stem curling from the top edge to the right edge, one leaf on the outer curve."),
    Tile("bramble_fork", "T", (GRASS, STEM, STEM, STEM), 0.12,
         "Stem runs left to right with a branch down; a lavender sprig rises from the joint."),
    Tile("stone_path", "X", (STONE,) * 4, 1.5,
         "Warm grey square setts with darker mortar joints, four by four per tile."),
    Tile("iron_fence", "T", (STONE, FENCE, GRASS, rev(FENCE)), 0.3,
         "Paving on the top half, lawn below, black iron double rail along the middle with gold-capped posts."),
    Tile("iron_fence_corner", "L", (rev(FENCE), FENCE, GRASS, GRASS), 0.2,
         "Quarter-disc of paving in the top-right corner, lawn elsewhere, rail following the arc."),
    Tile("iron_fence_inner", "L", (STONE, STONE, FENCE, rev(FENCE)), 0.2,
         "Paving everywhere except a quarter-disc of lawn in the bottom-left corner, rail on the arc."),
    Tile("water", "X", (WATER,) * 4, 1.5,
         "Still pond in soft lavender-grey with a few pale glints."),
    Tile("lily_pad", "X", (WATER,) * 4, 0.4,
         "Pond with three notched lily pads and one blush-white water lily with a gold heart."),
    Tile("pond_bank", "T", (WATER, BANK, GRASS, rev(BANK)), 0.35,
         "Water on the top half, lawn below, sage reed margin along the middle."),
    Tile("pond_bank_corner", "L", (rev(BANK), BANK, GRASS, GRASS), 0.25,
         "Quarter-disc of water in the top-right corner, reed margin on the arc."),
    Tile("pond_bank_inner", "L", (WATER, WATER, BANK, rev(BANK)), 0.25,
         "Water everywhere except a quarter-disc of lawn in the bottom-left corner."),
]

CARDINALITY = {"X": 1, "I": 2, "L": 4, "T": 4}


def _maps(sym: str):
    """Rotation `a` and reflection `b` on variant indices, exactly as SimpleTiledModel.cs."""
    if sym == "L":
        return (lambda i: (i + 1) % 4), (lambda i: i + 1 if i % 2 == 0 else i - 1)
    if sym == "T":
        return (lambda i: (i + 1) % 4), (lambda i: i if i % 2 == 0 else 4 - i)
    if sym == "I":
        return (lambda i: 1 - i), (lambda i: i)
    return (lambda i: i), (lambda i: i)


def rotate_edges(e):
    """One counter-clockwise quarter turn, matching SimpleTiledModel's rotate()."""
    top, right, bottom, left = e
    return (right, bottom, left, top)


def mirror_edges(e):
    """Left-right mirror, matching SimpleTiledModel's reflect()."""
    top, right, bottom, left = e
    return (rev(top), rev(left), rev(bottom), rev(right))


@dataclass
class Variant:
    tile: Tile
    index: int
    edges: tuple

    @property
    def label(self) -> str:
        return self.tile.name if self.index == 0 else f"{self.tile.name} {self.index}"


@dataclass
class Compiled:
    variants: List[Variant]
    weights: List[float]
    action: List[List[int]]
    rules: List[Tuple[int, int]]
    propagator: List[List[List[int]]]


def compile_tileset(weights: Optional[Dict[str, float]] = None) -> Compiled:
    weights = weights or {}
    variants: List[Variant] = []
    action: List[List[int]] = []
    vweights: List[float] = []

    for tile in TILES:
        a, b = _maps(tile.symmetry)
        base = len(action)
        card = CARDINALITY[tile.symmetry]
        edges = tile.edges
        for t in range(card):
            variants.append(Variant(tile, t, edges))
            edges = rotate_edges(edges)
            action.append([base + x for x in (t, a(t), a(a(t)), a(a(a(t))),
                                              b(t), b(a(t)), b(a(a(t))), b(a(a(a(t)))))])
            vweights.append(weights.get(tile.name, tile.weight))

    # The art and sockets must really have the declared symmetry, or C# will
    # generate rotated/reflected rules that contradict the edges.
    for i, v in enumerate(variants):
        if variants[action[i][1]].edges != rotate_edges(v.edges):
            raise ValueError(f"{v.label}: edges are not consistent under rotation")
        if variants[action[i][4]].edges != mirror_edges(v.edges):
            raise ValueError(f"{v.label}: edges do not have {v.tile.symmetry} symmetry")

    T = len(variants)
    fits_h = lambda l, r: variants[l].edges[1] == rev(variants[r].edges[3])
    fits_v = lambda u, d: variants[u].edges[2] == rev(variants[d].edges[0])

    # Greedy cover: emit a rule only if its horizontal images aren't already covered.
    rules: List[Tuple[int, int]] = []
    covered = set()
    for L in range(T):
        for R in range(T):
            if not fits_h(L, R) or (L, R) in covered:
                continue
            rules.append((L, R))
            AL, AR = action[L], action[R]
            covered |= {(L, R), (AL[6], AR[6]), (AR[4], AL[4]), (AR[2], AL[2])}

    propagator = build_propagator(T, action, rules)

    # Verify the C# expansion reproduces exactly the socket adjacency.
    dx, dy = (-1, 0, 1, 0), (0, 1, 0, -1)
    for d in range(4):
        for t1 in range(T):
            expected = []
            for t2 in range(T):
                if dx[d] == -1: ok = fits_h(t2, t1)
                elif dx[d] == 1: ok = fits_h(t1, t2)
                elif dy[d] == 1: ok = fits_v(t1, t2)
                else: ok = fits_v(t2, t1)
                if ok: expected.append(t2)
            if propagator[d][t1] != expected:
                raise AssertionError(f"propagator mismatch for {variants[t1].label}, direction {d}")
            if not expected:
                raise AssertionError(f"{variants[t1].label} has no neighbors in direction {d}")

    return Compiled(variants, vweights, action, rules, propagator)


def build_propagator(T: int, action, rules) -> List[List[List[int]]]:
    """Port of the densePropagator construction in SimpleTiledModel.cs."""
    dense = [[[False] * T for _ in range(T)] for _ in range(4)]
    for L, R in rules:
        D, U = action[L][1], action[R][1]
        dense[0][R][L] = True
        dense[0][action[R][6]][action[L][6]] = True
        dense[0][action[L][4]][action[R][4]] = True
        dense[0][action[L][2]][action[R][2]] = True
        dense[1][U][D] = True
        dense[1][action[D][6]][action[U][6]] = True
        dense[1][action[U][4]][action[D][4]] = True
        dense[1][action[D][2]][action[U][2]] = True
    for t2 in range(T):
        for t1 in range(T):
            dense[2][t2][t1] = dense[0][t1][t2]
            dense[3][t2][t1] = dense[1][t1][t2]
    return [[[t2 for t2 in range(T) if dense[d][t1][t2]] for t1 in range(T)] for d in range(4)]


def tileset_xml(weights: Optional[Dict[str, float]] = None) -> str:
    """The tilesets/mias_garden.xml document SimpleTiledModel loads."""
    weights = weights or {}
    c = compile_tileset(weights)
    lines = ["<!-- Mia's Garden. Generated by garden/tiles.py; edit the catalog there. -->",
             "<set>", "  <tiles>"]
    for tile in TILES:
        w = weights.get(tile.name, tile.weight)
        lines.append(f'    <tile name="{tile.name}" symmetry="{tile.symmetry}" weight="{w:g}"/>')
    lines += ["  </tiles>", "  <neighbors>"]
    last = None
    for L, R in c.rules:
        left, right = c.variants[L], c.variants[R]
        if left.tile.name != last:
            lines.append(f"    <!-- {left.tile.name} -->")
            last = left.tile.name
        lines.append(f'    <neighbor left="{left.label}" right="{right.label}"/>')
    lines += ["  </neighbors>", "</set>", ""]
    return "\n".join(lines)
