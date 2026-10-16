"""Bridge from Mia's Garden's poetic controls to WaveFunctionCollapse.

  The Whisper of Roses   -> weight of rose_bush and rose_bud
  Abundance of Lilies    -> weight of lily_pad (fully) and water (by square root)
  Stature of the Bloom   -> rendered tile size in pixels and blossom radius

Roses and lilies change the model's weights, so they need a new solve. Stature
only changes drawing, so an existing grid can be re-rendered without one.

The C# engine runs in a throwaway staging folder because Program.cs always
reads ./samples.xml, runs every entry in it, and empties ./output first.
"""
from __future__ import annotations

import random
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple

from . import art, tiles, wfc

REPO = Path(__file__).resolve().parent.parent / "WaveFunctionCollapse"
NAME = "mias_garden"


@dataclass
class Poetics:
    whisper_of_roses: float = 50.0      # 0..100
    abundance_of_lilies: float = 50.0   # 0..100
    stature_of_bloom: float = 50.0      # 0..100


def _gain(slider: float) -> float:
    """0..100 to a x1/16..x16 multiplier, x1 at 50. Weights stay strictly positive,
    since Model.cs takes log(weight)."""
    return 2.0 ** ((max(0.0, min(100.0, slider)) - 50.0) / 12.5)


def _remix(w: Dict[str, float], plain: str, feature: str, gain: float, growth: float) -> None:
    """Shift weight from `plain` to `feature` while keeping their total nearly fixed.

    Both are interior tiles of one region (lawn or pond), and the region's total
    interior weight decides how much of the garden it covers. Scaling the feature
    alone would also flood the map with that region.
    """
    total = w[plain] + w[feature]
    share = w[feature] * gain / (w[plain] + w[feature] * gain)
    total *= gain ** growth
    w[feature], w[plain] = total * share, total * (1 - share)


def weights_for(p: Poetics) -> Dict[str, float]:
    w = {t.name: t.weight for t in tiles.TILES}
    roses, lilies = _gain(p.whisper_of_roses), _gain(p.abundance_of_lilies)
    _remix(w, "parchment_grass", "rose_bush", roses, 0.05)
    w["rose_bud"] *= roses ** 0.6   # buds end every vine; full gain buries the lawn in stubs
    _remix(w, "water", "lily_pad", lilies, 0.15)
    return {k: round(v, 4) for k, v in w.items()}


def stature(p: Poetics) -> Tuple[int, float]:
    """(tile size in px, bloom radius multiplier)."""
    s = max(0.0, min(100.0, p.stature_of_bloom)) / 100.0
    return 16 + 4 * round(s * 12), 0.75 + 0.6 * s


def solve(p: Poetics, width: int = 24, height: int = 24, seed: Optional[int] = None,
          engine: str = "auto") -> art.Grid:
    """Run WFC and return the grid as rows of '<tile> <variant>' labels."""
    if engine == "auto":
        engine = "dotnet" if shutil.which("dotnet") else "python"
    if engine == "dotnet":
        return _solve_dotnet(p, width, height, seed)
    return _solve_python(p, width, height, seed)


def _solve_python(p, width, height, seed) -> art.Grid:
    c = tiles.compile_tileset(weights_for(p))
    rng = random.Random(seed)
    for _ in range(10):  # same retry budget as Program.cs
        observed = wfc.run(c.weights, c.propagator, width, height, rng.randrange(1 << 30))
        if observed is not None:
            labels = [f"{c.variants[t].tile.name} {c.variants[t].index}" for t in observed]
            return [labels[y * width:(y + 1) * width] for y in range(height)]
    raise RuntimeError("WFC hit a contradiction 10 times in a row")


def _solve_dotnet(p, width, height, seed) -> art.Grid:
    dll = REPO / "bin" / "WaveFunctionCollapse.dll"
    if not dll.exists():
        subprocess.run(["dotnet", "build", "-c", "Release"], cwd=REPO, check=True)

    tile_px, bloom = stature(p)
    with tempfile.TemporaryDirectory(prefix="mias_garden_") as tmp:
        stage = Path(tmp)
        (stage / "tilesets").mkdir()
        (stage / "tilesets" / f"{NAME}.xml").write_text(tiles.tileset_xml(weights_for(p)))
        art.write_tile_pngs(stage / "tilesets" / NAME, tile_px, bloom)
        # Program.cs reuses the same seed for all 10 retries when one is given,
        # so a fixed seed that contradicts fails outright.
        seed_attr = f' seed="{seed}"' if seed is not None else ""
        (stage / "samples.xml").write_text(
            f'<samples>\n  <simpletiled name="{NAME}" width="{width}" height="{height}"'
            f'{seed_attr} screenshots="1" textOutput="True"/>\n</samples>\n')

        subprocess.run(["dotnet", str(dll)], cwd=stage, check=True, capture_output=True)
        found = sorted((stage / "output").glob(f"{NAME}-*.txt"))
        if not found:
            raise RuntimeError("WFC hit a contradiction 10 times in a row")
        return parse_text_output(found[0].read_text())


def parse_text_output(text: str) -> art.Grid:
    """Parse SimpleTiledModel.TextOutput(): rows of 'name t, name t, '."""
    return [[cell.strip() for cell in line.split(",") if cell.strip()]
            for line in text.splitlines() if line.strip()]


def render(grid: art.Grid, p: Poetics, out: Path, frame: bool = True) -> Path:
    tile_px, bloom = stature(p)
    w, h, px = art.render(grid, tile_px, bloom, frame)
    art.write_png(out, w, h, px)
    return out


def install_tileset(weights: Optional[Dict[str, float]] = None, tile_px: int = 32) -> None:
    """Write tilesets/mias_garden.xml and its PNGs into the cloned repo."""
    (REPO / "tilesets" / f"{NAME}.xml").write_text(tiles.tileset_xml(weights))
    art.write_tile_pngs(REPO / "tilesets" / NAME, tile_px)
