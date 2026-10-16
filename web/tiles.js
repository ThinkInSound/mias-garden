// Ported from WaveFunctionCollapse, Copyright (C) 2016 Maxim Gumin, MIT License.
// https://github.com/mxgmn/WaveFunctionCollapse
// Mia's Garden tile catalog, 16x16 pixel sprites, and SimpleTiledModel rule compiler.
// Mirrors garden/tiles.py: same tiles, edges, symmetries and weights, so the rules
// match the C# tileset in WaveFunctionCollapse/tilesets/mias_garden.xml.

export const SIZE = 16;

export const PALETTE = {
  ".": "#F4F1EA", ",": "#E8D8C0", s: "#6A4E3C", k: "#2E2520",
  g: "#1E3B28", f: "#4A7543", a: "#94B482",
  r: "#C8323F", R: "#7E1626", b: "#F2A7A4",
  l: "#A58BD0", L: "#6B54A0",
  w: "#BFC6E0", W: "#9AA5C8", "*": "#EEF0F8",
  t: "#D9CBB0", m: "#A8977A",
  i: "#221F1D", o: "#B5853A", O: "#E6C373",
};

// ------------------------------------------------------------------ sprites

function rows(lines) {
  const px = lines.join("");
  if (px.length !== SIZE * SIZE) throw new Error(`sprite is ${px.length} px, expected 256`);
  return px.split("");
}

const LAWN = rows([
  "................",
  "...........,....",
  "..a.a...........",
  "...a............",
  "................",
  "........s.......",
  ".,..............",
  "...........a.a..",
  "............a...",
  "....,...........",
  "................",
  "..s.........,...",
  "......a.a.......",
  ".......a........",
  "................",
  "..........,.....",
]);

const WATER = rows([
  "wwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwww",
  "ww**wwwwwwwwwwww",
  "wwwwwwwwwwwwwwww",
  "wwwwwwwwwwWWwwww",
  "wwwwwwwwwwwwwwww",
  "wwwwwww***wwwwww",
  "wwwwwwwwwwwwwwww",
  "wwWWwwwwwwwwwwww",
  "wwwwwwwwwwwwwwww",
  "wwwwwwwwwwwww**w",
  "wwwwwwwwwwwwwwww",
  "wwwwwWWwwwwwwwww",
  "wwwwwwwwwwwwwwww",
  "wwwwwwwwwwWWwwww",
  "wwwwwwwwwwwwwwww",
]);

// Setts with 2px joints; the pattern is unchanged by every rotation and mirror,
// so paving lines up across rotated fence tiles.
function stone(x, y) {
  const u = x % 8, v = y % 8;
  if (u === 0 || u === 7 || v === 0 || v === 7) return "m";
  if (u === 1 && v === 1) return ".";
  if (u === 6 && v === 6) return "m";
  return "t";
}

const STEM = rows([
  ".......gg.......",
  "......sgg.......",
  ".......gg.......",
  "..ff...gg...ff..",
  ".faff..gg..ffaf.",
  ".faffgggggggffaf",
  "..fff..gg..fff..",
  ".......gg.......",
  ".......gg.......",
  "..fff..gg..fff..",
  "faffgggggggffaf.",
  ".faff..gg..ffaf.",
  "..ff...gg...ff..",
  ".......gg.......",
  ".......ggs......",
  ".......gg.......",
]).map((c, i) => (c === "." ? LAWN[i] : c));

const FORK = rows([
  "................",
  ".......LL.......",
  "......lLLl......",
  ".......LL.......",
  "......lLLl......",
  ".......LL.......",
  "...ff..ff..ff...",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "..faf..gg..faf..",
  "...f...gg...f...",
  ".......gg.......",
  ".......gg.......",
  ".......gg.......",
  ".......gg.......",
  ".......gg.......",
]).map((c, i) => (c === "." ? LAWN[i] : c));

const BUD = {
  bud: rows([
    "................",
    "................",
    "................",
    ".......RR.......",
    "......RrrR......",
    ".....RrbrrR.....",
    ".....RrrbrR.....",
    ".....RRrrRR.....",
    "....fgRRRRgf....",
    "...faf.gg.faf...",
    "....f..gg..f....",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
  ]),
  bloom: rows([
    "................",
    "......RRRR......",
    "....RRrrrrRR....",
    "...RrrbRRbrrR...",
    "...RrbRbbRbrR...",
    "...RrRbrrbRrR...",
    "...RrrRbbRrrR...",
    "....RRrrrrRR....",
    "...fgfRRRRfgf...",
    "..faf..gg..faf..",
    "...f...gg...f...",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
    ".......gg.......",
  ]),
};
for (const k in BUD) BUD[k] = BUD[k].map((c, i) => (c === "." ? LAWN[i] : c));

function bush(stage) {
  const out = LAWN.slice();
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 5.6) out[y * SIZE + x] = (x + y) % 5 === 0 ? "g" : (x < 7 && y < 7 && (x * 3 + y) % 7 === 0 ? "a" : "f");
      else if (d < 6.6) out[y * SIZE + x] = "g";
      else if (d < 7.4 && x > 8 && y > 8) out[y * SIZE + x] = ",";
    }
  const spots = [[5, 4], [10, 5], [4, 9], [8, 8], [10, 10]];
  const stamp = stage === "bloom" ? ["rRr", "RbR", "rRr"] : [".R.", "RrR", ".R."];
  for (const [cx, cy] of spots)
    stamp.forEach((line, dy) => [...line].forEach((c, dx) => {
      if (c !== ".") out[(cy - 1 + dy) * SIZE + cx - 1 + dx] = c;
    }));
  return out;
}

const LILY = {
  bud: rows([
    "wwwwwwwwwwwwwwww",
    "wwwggggwwwwwwwww",
    "wwgfffagwwwwwwww",
    "wgffafwwwwwwwwww",
    "wgfffaffgwwwwwww",
    "wgffffffgwwwwwww",
    "wwgffffgwwwwwwww",
    "wwwggggwwwwlwwww",
    "wwwwwwwwwwlLlwww",
    "wwwwwwwwwwwlwwww",
    "wwwww*wwwwwwwwww",
    "wwwwwwwwwggggwww",
    "wwwwwwwwgfaffgww",
    "ww**wwwwgffwwwww",
    "wwwwwwwwwggggwww",
    "wwwwwwwwwwwwwwww",
  ]),
  bloom: rows([
    "wwwwwwwwwwwwwwww",
    "wwwggggwwwwwwwww",
    "wwgfffagwwwwwwww",
    "wgffafwwwwwlwwww",
    "wgfffaffgwlblwww",
    "wgffffffglbOblww",
    "wwgffffgwwlblwww",
    "wwwggggwwwwlwwww",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    "wwwww*wwwwwwwwww",
    "wwwwwwwwwggggwww",
    "wwwwwwwwgfaffgww",
    "ww**wwwwgffwwwww",
    "wwwwwwwwwggggwww",
    "wwwwwwwwwwwwwwww",
  ]),
};

// Region boundary: d(x, y) < 6 is the inner region (stone or water), 6..10 is the
// edge band, >= 10 is lawn. The band hits tile edges at the same pixels for the
// straight, outer and inner shapes, so seams line up.
const straightD = (x, y) => y + 0.5;
const outerD = (x, y) => Math.hypot(x + 0.5 - 16, y + 0.5);
const innerD = (x, y) => 16 - Math.hypot(x + 0.5, y + 0.5 - 16);
const angleOuter = (x, y) => Math.atan2(y + 0.5, 16 - x - 0.5) * 180 / Math.PI;
const angleInner = (x, y) => Math.atan2(16 - y - 0.5, x + 0.5) * 180 / Math.PI;

function fence(dist, angle) {
  return rows(Array(SIZE).fill(".".repeat(SIZE))).map((_, i) => {
    const x = i % SIZE, y = (i / SIZE) | 0, d = dist(x, y);
    if (d < 6) return stone(x, y);
    if (d < 7 || (d >= 9 && d < 10)) return "i";
    if (d < 9) {
      if (angle) {
        const a = angle(x, y);
        if (Math.abs(a - 45) < 6) return d < 8 ? "O" : "o";
        if (Math.abs(a - 22) < 3 || Math.abs(a - 68) < 3) return "i";
      } else {
        if (x === 7 || x === 8) return y === 7 ? "O" : "o";
        if ([1, 4, 11, 14].includes(x)) return "i";
      }
      return ",";
    }
    return LAWN[i];
  });
}

function bank(dist) {
  return rows(Array(SIZE).fill(".".repeat(SIZE))).map((_, i) => {
    const x = i % SIZE, y = (i / SIZE) | 0, d = dist(x, y);
    if (d < 6) return WATER[i];
    if (d < 7) return "W";
    if (d < 9) return (x * 3 + y * 5) % 4 === 0 ? "f" : ((x + y * 3) % 7 === 0 ? "s" : "a");
    if (d < 10) return ",";
    return LAWN[i];
  });
}

function turn() {
  const out = LAWN.slice();
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const d = outerD(x, y);
      if (d >= 7 && d < 9) out[y * SIZE + x] = "g";
    }
  const leaf = [".ff", "faf", "ff."];
  leaf.forEach((line, dy) => [...line].forEach((c, dx) => {
    if (c !== ".") out[(10 + dy) * SIZE + 5 + dx] = c;
  }));
  out[3 * SIZE + 11] = "s";
  return out;
}

const SPRITES = {
  parchment_grass: () => LAWN,
  rose_bush: (stage) => bush(stage),
  rose_bud: (stage) => BUD[stage],
  bramble_stem: () => STEM,
  bramble_turn: () => turn(),
  bramble_fork: () => FORK,
  stone_path: () => rows(Array(SIZE).fill(".".repeat(SIZE))).map((_, i) => stone(i % SIZE, (i / SIZE) | 0)),
  iron_fence: () => fence(straightD),
  iron_fence_corner: () => fence(outerD, angleOuter),
  iron_fence_inner: () => fence(innerD, angleInner),
  water: () => WATER,
  lily_pad: (stage) => LILY[stage],
  pond_bank: () => bank(straightD),
  pond_bank_corner: () => bank(outerD),
  pond_bank_inner: () => bank(innerD),
};

export function sprite(name, stage = "bloom") {
  return SPRITES[name](stage);
}

// SimpleTiledModel.cs rotate(): result(x, y) = src(size-1-y, x), one quarter turn counter-clockwise.
export function rotateSprite(px) {
  const out = new Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) out[x + y * SIZE] = px[SIZE - 1 - y + x * SIZE];
  return out;
}

// ------------------------------------------------------------------ catalog

const GRASS = "GGG", STONE = "SSS", WATR = "WWW", STEM_E = "GvG", FENCE = "SfG", BANK = "WbG";
const rev = (e) => [...e].reverse().join("");

export const TILES = [
  { name: "parchment_grass", symmetry: "X", region: "lawn", weight: 8.0, edges: [GRASS, GRASS, GRASS, GRASS] },
  { name: "rose_bush", symmetry: "X", region: "lawn", weight: 0.7, edges: [GRASS, GRASS, GRASS, GRASS] },
  { name: "rose_bud", symmetry: "T", region: "lawn", weight: 0.4, edges: [GRASS, GRASS, STEM_E, GRASS] },
  { name: "bramble_stem", symmetry: "I", region: "lawn", weight: 0.5, edges: [STEM_E, GRASS, STEM_E, GRASS] },
  { name: "bramble_turn", symmetry: "L", region: "lawn", weight: 0.45, edges: [STEM_E, STEM_E, GRASS, GRASS] },
  { name: "bramble_fork", symmetry: "T", region: "lawn", weight: 0.12, edges: [GRASS, STEM_E, STEM_E, STEM_E] },
  { name: "stone_path", symmetry: "X", region: "paving", weight: 1.5, edges: [STONE, STONE, STONE, STONE] },
  { name: "iron_fence", symmetry: "T", region: "paving", weight: 0.3, edges: [STONE, FENCE, GRASS, rev(FENCE)] },
  { name: "iron_fence_corner", symmetry: "L", region: "paving", weight: 0.2, edges: [rev(FENCE), FENCE, GRASS, GRASS] },
  { name: "iron_fence_inner", symmetry: "L", region: "paving", weight: 0.2, edges: [STONE, STONE, FENCE, rev(FENCE)] },
  { name: "water", symmetry: "X", region: "pond", weight: 1.5, edges: [WATR, WATR, WATR, WATR] },
  { name: "lily_pad", symmetry: "X", region: "pond", weight: 0.4, edges: [WATR, WATR, WATR, WATR] },
  { name: "pond_bank", symmetry: "T", region: "pond", weight: 0.35, edges: [WATR, BANK, GRASS, rev(BANK)] },
  { name: "pond_bank_corner", symmetry: "L", region: "pond", weight: 0.25, edges: [rev(BANK), BANK, GRASS, GRASS] },
  { name: "pond_bank_inner", symmetry: "L", region: "pond", weight: 0.25, edges: [WATR, WATR, BANK, rev(BANK)] },
];

const CARDINALITY = { X: 1, I: 2, L: 4, T: 4 };

function maps(sym) {
  if (sym === "L") return [(i) => (i + 1) % 4, (i) => (i % 2 === 0 ? i + 1 : i - 1)];
  if (sym === "T") return [(i) => (i + 1) % 4, (i) => (i % 2 === 0 ? i : 4 - i)];
  if (sym === "I") return [(i) => 1 - i, (i) => i];
  return [(i) => i, (i) => i];
}

const rotateEdges = ([t, r, b, l]) => [r, b, l, t];
const mirrorEdges = ([t, r, b, l]) => [rev(t), rev(l), rev(b), rev(r)];
const same = (a, b) => a.every((e, i) => e === b[i]);

// Variants, weights and the 4-direction propagator, built exactly as SimpleTiledModel.cs does.
export function compile(weights = {}) {
  const variants = [], action = [], vweights = [];
  for (const tile of TILES) {
    const [a, b] = maps(tile.symmetry);
    const base = action.length;
    let edges = tile.edges;
    for (let t = 0; t < CARDINALITY[tile.symmetry]; t++) {
      variants.push({ tile, index: t, edges });
      edges = rotateEdges(edges);
      action.push([t, a(t), a(a(t)), a(a(a(t))), b(t), b(a(t)), b(a(a(t))), b(a(a(a(t))))].map((x) => base + x));
      vweights.push(weights[tile.name] ?? tile.weight);
    }
  }
  variants.forEach((v, i) => {
    if (!same(variants[action[i][1]].edges, rotateEdges(v.edges))) throw new Error(`${v.tile.name}: rotation mismatch`);
    if (!same(variants[action[i][4]].edges, mirrorEdges(v.edges))) throw new Error(`${v.tile.name}: symmetry mismatch`);
  });

  const T = variants.length;
  const fitsH = (l, r) => variants[l].edges[1] === rev(variants[r].edges[3]);
  const rules = [], covered = new Set();
  for (let L = 0; L < T; L++)
    for (let R = 0; R < T; R++) {
      if (!fitsH(L, R) || covered.has(L * T + R)) continue;
      rules.push([L, R]);
      const AL = action[L], AR = action[R];
      for (const [x, y] of [[L, R], [AL[6], AR[6]], [AR[4], AL[4]], [AR[2], AL[2]]]) covered.add(x * T + y);
    }

  const dense = [0, 1, 2, 3].map(() => Array.from({ length: T }, () => new Uint8Array(T)));
  for (const [L, R] of rules) {
    const D = action[L][1], U = action[R][1];
    dense[0][R][L] = 1;
    dense[0][action[R][6]][action[L][6]] = 1;
    dense[0][action[L][4]][action[R][4]] = 1;
    dense[0][action[L][2]][action[R][2]] = 1;
    dense[1][U][D] = 1;
    dense[1][action[D][6]][action[U][6]] = 1;
    dense[1][action[U][4]][action[D][4]] = 1;
    dense[1][action[D][2]][action[U][2]] = 1;
  }
  for (let t2 = 0; t2 < T; t2++)
    for (let t1 = 0; t1 < T; t1++) {
      dense[2][t2][t1] = dense[0][t1][t2];
      dense[3][t2][t1] = dense[1][t1][t2];
    }
  const propagator = dense.map((d) => d.map((row) => [...row.keys()].filter((t2) => row[t2])));
  return { variants, weights: vweights, propagator, rules };
}

// ------------------------------------------------------------------ poetics

const clamp = (v) => Math.max(0, Math.min(100, v));
const gain = (slider) => 2 ** ((clamp(slider) - 50) / 12.5);

// Shift weight from a region's plain interior tile to its feature tile while keeping
// the pair's total nearly fixed, so the region does not flood the map.
function remix(w, plain, feature, g, growth) {
  const total = w[plain] + w[feature];
  const share = (w[feature] * g) / (w[plain] + w[feature] * g);
  const scaled = total * g ** growth;
  w[feature] = scaled * share;
  w[plain] = scaled * (1 - share);
}

export function weightsFor({ roses, lilies }) {
  const w = Object.fromEntries(TILES.map((t) => [t.name, t.weight]));
  const r = gain(roses), l = gain(lilies);
  remix(w, "parchment_grass", "rose_bush", r, 0.05);
  w.rose_bud *= r ** 0.6;
  remix(w, "water", "lily_pad", l, 0.15);
  return w;
}

// Stature: larger blooms means bigger tiles, so fewer of them fit the (square) plate.
export function statureFor({ stature }) {
  const s = clamp(stature) / 100;
  const cols = Math.round(28 - 16 * s);
  return { cols, rows: cols, stage: s >= 0.5 ? "bloom" : "bud" };
}
