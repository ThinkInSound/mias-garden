# Mia's Garden

A pixel-art Victorian garden that grows itself, plot by plot, beneath a poem.

The site is the static web app in [`web/`](web/): no build step and no server. GitHub Pages
publishes that folder on every push to `main` (see `.github/workflows/pages.yml`).

## Run locally

```sh
cd web && python3 -m http.server 8000   # then open http://localhost:8000
```

## Layout

| Path | What it is |
| --- | --- |
| `web/` | The site: page, pixel sprites, ornaments, and a step-by-step JavaScript port of the WFC solver |
| `garden/` | Python tools: tileset compiler, a pure-Python solver, and a bridge to the C# WaveFunctionCollapse build |

`garden/` expects a clone of [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
next to it, in `WaveFunctionCollapse/`.

## Credits

The solver in `web/wfc.js` and the rule compiler in `web/tiles.js` and `garden/` are ports of
`Model.cs` and `SimpleTiledModel.cs` from
[WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse),
Copyright (C) 2016 Maxim Gumin, used under the MIT License.
