# Mia's Garden (web)

A static web app: no build step, no server code, no dependencies beyond Google Fonts.

| File | Role |
| --- | --- |
| `index.html` | Page, styles, controls |
| `app.js` | Sliders, animation loop, canvas rendering |
| `wfc.js` | Step-by-step port of `Model.cs` from WaveFunctionCollapse |
| `tiles.js` | Tile catalog, 16x16 pixel sprites, rule compiler, slider-to-weight mapping |
| `ornaments.js` | Pixel ornaments: drop capital, vines, corner flourishes, slider thumb |

## Run locally

ES modules do not load from `file://`, so serve the folder:

```sh
cd web && python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

Upload the folder as-is to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3).

## Keeping rules in sync

`tiles.js` mirrors `garden/tiles.py`: same tiles, edges, symmetries and weights, so it
produces the same 124 neighbor rules as `WaveFunctionCollapse/tilesets/mias_garden.xml`.
If you change a tile's edges or symmetry, change both files.
