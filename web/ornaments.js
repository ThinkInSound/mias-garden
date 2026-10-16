// Pixel-art ornaments for the illuminated page: drop capital, vine borders,
// corner flourishes, divider and slider thumb. Each returns { w, h, px } where px
// holds palette keys from tiles.js ("" is transparent).

function pixmap(w, h, fill = "") {
  return { w, h, px: new Array(w * h).fill(fill) };
}

function set(pm, x, y, c) {
  if (x >= 0 && y >= 0 && x < pm.w && y < pm.h) pm.px[y * pm.w + x] = c;
}

function stamp(pm, x0, y0, lines) {
  lines.forEach((line, dy) => [...line].forEach((c, dx) => {
    if (c !== " ") set(pm, x0 + dx, y0 + dy, c);
  }));
}

const BLOOM = [" rRr ", "rRbRr", "RbObR", "rRbRr", " rRr "];
const SMALL_BLOOM = ["rRr", "RbR", "rRr"];
const LEAF_UP = [" ff", "faf", "ff "];
const LEAF_DOWN = ["ff ", "faf", " ff"];

/** 32x12 repeating vine with a rose, a hanging bud and leaves. */
export function vineStrip() {
  const pm = pixmap(32, 12);
  const yAt = (x) => 6 + Math.round(2.6 * Math.sin((2 * Math.PI * x) / 32));
  for (let x = 0; x < 32; x++) {
    const y = yAt(x), y2 = yAt(x + 1);
    for (let yy = Math.min(y, y2); yy <= Math.max(y, y2); yy++) set(pm, x, yy, "g");
  }
  stamp(pm, 22, 0, BLOOM);
  stamp(pm, 3, 4, LEAF_UP);
  stamp(pm, 13, 3, LEAF_DOWN);
  stamp(pm, 29, 1, LEAF_UP);
  set(pm, 8, 9, "g"); set(pm, 8, 10, "R"); set(pm, 7, 10, "r"); set(pm, 9, 10, "r"); set(pm, 8, 11, "R");
  set(pm, 16, 9, "L"); set(pm, 16, 10, "l");
  return pm;
}

/** 28x28 flourish for the top-left corner; mirror it for the others. */
export function cornerCurl() {
  const half = pixmap(28, 28);
  // Stem running right from the corner rose, with a tendril curling beneath it.
  for (let x = 5; x < 28; x++) set(half, x, 3, "g");
  for (let t = 0; t <= 1; t += 0.01) {
    const a = -Math.PI / 2 + t * Math.PI * 3, r = 4 * (1 - 0.75 * t);
    set(half, Math.round(13 + r * Math.cos(a)), Math.round(7 + r * Math.sin(a)), "g");
  }
  stamp(half, 19, 0, LEAF_UP);
  stamp(half, 23, 4, LEAF_DOWN);
  set(half, 13, 7, "l");
  set(half, 27, 2, "L");
  // The flourish is symmetric about the diagonal: mirror the stem down the left side.
  const pm = pixmap(28, 28);
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) {
      const c = half.px[y * 28 + x] || half.px[x * 28 + y];
      if (c) set(pm, x, y, c);
    }
  stamp(pm, 1, 1, BLOOM);
  return pm;
}

/** 80x11 gilt rule with a central rose. */
export function divider() {
  const pm = pixmap(80, 11);
  for (let x = 3; x < 77; x++) {
    if (x > 33 && x < 46) continue;
    set(pm, x, 5, x % 4 === 0 ? "O" : "o");
  }
  for (const x of [2, 77]) stamp(pm, x - 1, 4, [" o ", "oOo", " o "]);
  stamp(pm, 38, 3, BLOOM);
  stamp(pm, 33, 2, LEAF_UP);
  stamp(pm, 44, 6, LEAF_DOWN);
  set(pm, 36, 5, "g"); set(pm, 37, 5, "g"); set(pm, 43, 5, "g"); set(pm, 44, 5, "g");
  return pm;
}

/** 44x40 stone garden urn overflowing with roses, lavender and trailing ivy. */
export function urn() {
  const W = 44, H = 40, pm = pixmap(W, H), cx = 21.5;
  // urn: rim, bowl, stem, foot; lit from the left
  const rows = [
    [24, 13], [25, 13], [26, 11], [27, 10], [28, 10], [29, 9], [30, 9], [31, 8], [32, 7],
    [33, 3], [34, 3], [35, 4], [36, 7], [37, 8], [38, 8],
  ];
  for (const [y, half] of rows)
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = x === Math.round(cx - half) || x === Math.round(cx + half);
      const u = (x - (cx - half)) / (2 * half);
      set(pm, x, y, edge ? "s" : y === 24 || y === 36 ? "o" : u < 0.3 ? "." : u > 0.75 ? "m" : "t");
    }
  for (let x = Math.round(cx - 13); x <= Math.round(cx + 13); x++) set(pm, x, 23, "s");
  for (const x of [15, 21, 27]) set(pm, x, 29, "O"); // gilt studs on the bowl

  // foliage mound
  for (let y = 4; y < 23; y++)
    for (let x = 4; x < 40; x++) {
      // lumpy dome: radius wobbles with angle so the outline reads as leaves
      const a = Math.atan2(y - 23, x - cx), wob = 0.9 * Math.sin(a * 9) + 0.5 * Math.sin(a * 23);
      const d = Math.hypot((x - cx) / 1.45, (y - 23) / 1.3);
      if (d > 12.4 + wob) continue;
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      set(pm, x, y, d > 11.5 + wob ? "g" : h % 9 === 0 ? "a" : h % 4 === 0 ? "g" : "f");
    }
  // lavender spikes
  for (const [x, top] of [[7, 8], [36, 7], [12, 3]]) {
    for (let y = top; y < top + 9; y++) set(pm, x, y, y < top + 6 ? (y % 2 ? "L" : "l") : "f");
  }
  // trailing ivy over the rim
  for (const [x, len] of [[8, 10], [35, 12], [29, 6]]) {
    for (let y = 22; y < 22 + len; y++) set(pm, x + (y % 4 === 0 ? 1 : 0), y, "g");
    stamp(pm, x - 1, 22 + len - 1, ["ff", "fa"]);
  }
  for (const [x, y] of [[15, 9], [24, 5], [30, 11], [10, 14], [19, 15], [27, 17], [34, 16]]) stamp(pm, x - 2, y - 2, BLOOM);
  for (const [x, y] of [[20, 8], [6, 18], [37, 21]]) stamp(pm, x - 1, y - 1, SMALL_BLOOM);
  return pm;
}

/** 9x9 rose used as the slider thumb. */
export function thumb() {
  const pm = pixmap(9, 9);
  stamp(pm, 0, 0, [
    "  kkkkk  ",
    " kRrrrRk ",
    "kRrbRbrRk",
    "krbRbRbrk",
    "krRbObRrk",
    "krbRbRbrk",
    "kRrbRbrRk",
    " kRrrrRk ",
    "  kkkkk  ",
  ]);
  return pm;
}

// Textura capital M on a 19x18 grid.
const LETTER_M = [
  "                   ",
  " X  XXXX   XXXX    ",
  "XXXXX  XXXXX  XXXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  " XXX    XXX    XXX ",
  "XXXXX  XXXXX   XXXX",
  " X      X X     XX ",
  "                   ",
];

/** 44x44 illuminated initial: gilt frame, forest diaper ground, roses, gold M. */
export function dropCap() {
  const S = 44, pm = pixmap(S, S);
  const ring = ["k", "o", "O", "o", "k"];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (edge < ring.length) { set(pm, x, y, ring[edge]); continue; }
      const a = (x + y) % 6 === 0, b = (x - y + 60) % 6 === 0;
      set(pm, x, y, a && b ? "a" : a || b ? "f" : "g");
    }
  for (const [x, y] of [[5, 5], [36, 5], [5, 36], [36, 36]]) stamp(pm, x, y, SMALL_BLOOM);

  const ox = 12, oy = 13;
  const isM = (x, y) => LETTER_M[y]?.[x] === "X";
  for (let y = -1; y <= LETTER_M.length; y++)
    for (let x = -1; x <= 19; x++) {
      if (isM(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near ||= isM(x + dx, y + dy);
      if (near || isM(x - 1, y - 1)) set(pm, ox + x, oy + y, "k");
    }
  LETTER_M.forEach((line, y) => [...line].forEach((c, x) => {
    if (c !== "X") return;
    const lit = !isM(x - 1, y) || !isM(x, y - 1);
    set(pm, ox + x, oy + y, lit ? "." : y < 9 ? "O" : "o");
  }));
  return pm;
}
