"""Command line for Mia's Garden.

  python3 -m garden install                      # write tileset XML + PNGs into the repo
  python3 -m garden generate --roses 70 --lilies 30 --stature 60 -o garden.png
"""
from __future__ import annotations

import argparse
from pathlib import Path

from . import bridge


def main() -> None:
    ap = argparse.ArgumentParser(prog="garden")
    sub = ap.add_subparsers(dest="cmd", required=True)

    inst = sub.add_parser("install", help="write tilesets/mias_garden.xml and tile PNGs")
    inst.add_argument("--tile-px", type=int, default=32)

    gen = sub.add_parser("generate", help="grow a garden and render it")
    gen.add_argument("--roses", type=float, default=50, help="The Whisper of Roses, 0-100")
    gen.add_argument("--lilies", type=float, default=50, help="Abundance of Lilies, 0-100")
    gen.add_argument("--stature", type=float, default=50, help="Stature of the Bloom, 0-100")
    gen.add_argument("--size", type=int, default=24)
    gen.add_argument("--seed", type=int)
    gen.add_argument("--engine", choices=("auto", "dotnet", "python"), default="auto")
    gen.add_argument("--no-frame", action="store_true")
    gen.add_argument("-o", "--out", type=Path, default=Path("mias_garden.png"))

    args = ap.parse_args()
    if args.cmd == "install":
        bridge.install_tileset(tile_px=args.tile_px)
        print(f"wrote {bridge.REPO / 'tilesets' / 'mias_garden.xml'} and tile PNGs")
        return

    p = bridge.Poetics(args.roses, args.lilies, args.stature)
    grid = bridge.solve(p, args.size, args.size, args.seed, args.engine)
    print(bridge.render(grid, p, args.out, frame=not args.no_frame))


if __name__ == "__main__":
    main()
