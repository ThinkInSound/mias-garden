// Mia's Garden web app: sliders drive the tile weights, the solver runs a few
// steps per animation frame, and the canvas shows each plot settling in turn.

import { SIZE, PALETTE, compile, weightsFor, statureFor, sprite, rotateSprite } from "./tiles.js";
import { Solver } from "./wfc.js";
import * as ornaments from "./ornaments.js";

const $ = (id) => document.getElementById(id);
const PACES = { leisurely: 1, steady: 3, brisk: 12, instant: Infinity };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Platform: tag the root so CSS can size controls for touch, and pick defaults for small screens.
const ua = navigator.userAgent;
const platform = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
  : /Android/.test(ua) ? "android" : "desktop";
const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 && platform !== "desktop";
document.documentElement.dataset.platform = platform;
document.documentElement.dataset.input = touch ? "touch" : "pointer";
const mobile = platform !== "desktop" || matchMedia("(max-width: 560px)").matches;
document.documentElement.dataset.device = mobile ? "mobile" : "desktop";

// ------------------------------------------------------------------ colour

const RGB = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) =>
  [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const pack = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r; // ImageData is RGBA little-endian
const PACKED = Object.fromEntries(Object.entries(RGB).map(([k, c]) => [k, pack(c)]));
const PALETTE_LIST = Object.values(RGB);

function nearest([r, g, b]) {
  let best = PALETTE_LIST[0], bd = Infinity;
  for (const c of PALETTE_LIST) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return pack(best);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Paint a pixmap of palette keys onto a fresh canvas. */
function toCanvas({ w, h, px }) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const out = new Uint32Array(img.data.buffer);
  px.forEach((k, i) => { if (k) out[i] = PACKED[k]; });
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ tile art

const artCache = new Map();

/** Per-variant sprite (pre-rotated, packed) and average colour for one bloom stage. */
function artFor(compiled, stage) {
  if (!artCache.has(stage)) {
    const bitmaps = [], averages = [];
    for (const v of compiled.variants) {
      let px = sprite(v.tile.name, stage);
      for (let r = 0; r < v.index; r++) px = rotateSprite(px);
      bitmaps.push(Uint32Array.from(px, (k) => PACKED[k]));
      const sum = [0, 0, 0];
      for (const k of px) for (let j = 0; j < 3; j++) sum[j] += RGB[k][j];
      averages.push(sum.map((s) => s / px.length));
    }
    artCache.set(stage, { bitmaps, averages });
  }
  return artCache.get(stage);
}

// ------------------------------------------------------------------ the plate

const canvas = $("plate");
const ctx = canvas.getContext("2d");
let img, pixels, solver, compiled, art, dims, rafId = 0, restartTimer = 0, loopTimer = 0;
const flashes = new Map();

const state = { roses: 50, lilies: 50, stature: 50, seed: freshSeed(), pace: mobile || !reduceMotion ? "leisurely" : "instant", loop: false };
// A narrow plate (phones) starts with larger blooms so each tile stays legible.
if ($("plate-box").clientWidth < 520) state.stature = 70;

function freshSeed() {
  return Math.floor(Math.random() * 1e6);
}

function paintCell(i) {
  const W = canvas.width, x0 = (i % dims.cols) * SIZE, y0 = ((i / dims.cols) | 0) * SIZE;
  const t = solver.observed(i);
  if (t >= 0) {
    const bmp = art.bitmaps[t];
    for (let y = 0; y < SIZE; y++) pixels.set(bmp.subarray(y * SIZE, y * SIZE + SIZE), (y0 + y) * W + x0);
    return;
  }
  // Unsettled plot: dither its likely colour into the parchment as options narrow.
  const T = solver.T, ones = solver.ones[i];
  const certainty = ones <= 0 ? 0 : 1 - Math.log(ones) / Math.log(T);
  const sum = [0, 0, 0];
  let total = 0;
  for (let t2 = 0; t2 < T; t2++) {
    if (!solver.wave[i * T + t2]) continue;
    const w = solver.weights[t2], a = art.averages[t2];
    sum[0] += a[0] * w; sum[1] += a[1] * w; sum[2] += a[2] * w; total += w;
  }
  const hint = total > 0 ? nearest(sum.map((s) => s / total)) : PACKED.R;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const plotMark = (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);
      const c = BAYER[(y % 4) * 4 + (x % 4)] < certainty * 0.9 ? hint : plotMark ? PACKED[","] : PACKED["."];
      pixels[(y0 + y) * W + x0 + x] = c;
    }
}

function restart({ newSeed = false } = {}) {
  cancelAnimationFrame(rafId);
  clearTimeout(restartTimer);
  clearTimeout(loopTimer);
  if (newSeed) state.seed = freshSeed();
  compiled = compile(weightsFor(state));
  const next = statureFor(state);
  art = artFor(compiled, next.stage);
  const resized = !dims || dims.cols !== next.cols || dims.rows !== next.rows;
  dims = next;
  if (resized) {
    canvas.width = dims.cols * SIZE;
    canvas.height = dims.rows * SIZE;
    img = ctx.createImageData(canvas.width, canvas.height);
    pixels = new Uint32Array(img.data.buffer);
  }
  solver = new Solver(compiled, dims.cols, dims.rows, state.seed);
  for (let i = 0; i < solver.n; i++) paintCell(i);
  solver.dirty.clear();
  flashes.clear();
  rafId = requestAnimationFrame(tick);
}

function tick() {
  const steps = PACES[state.pace];
  for (let k = 0; k < steps && solver.status === "running"; k++) {
    const cell = solver.step();
    if (cell >= 0 && !reduceMotion && steps !== Infinity) flashes.set(cell, 8);
  }
  for (const i of solver.dirty) paintCell(i);
  solver.dirty.clear();
  ctx.putImageData(img, 0, 0);

  ctx.fillStyle = PALETTE.O;
  for (const [i, left] of flashes) {
    const x = (i % dims.cols) * SIZE, y = ((i / dims.cols) | 0) * SIZE;
    if (left % 4 < 2) {
      ctx.fillRect(x, y, SIZE, 1); ctx.fillRect(x, y + SIZE - 1, SIZE, 1);
      ctx.fillRect(x, y, 1, SIZE); ctx.fillRect(x + SIZE - 1, y, 1, SIZE);
    }
    if (left <= 1) flashes.delete(i); else flashes.set(i, left - 1);
  }

  if (solver.status === "contradiction") {
    // A dead end: quietly try the next seed.
    restartTimer = setTimeout(() => { state.seed += 1; restart(); }, 400);
    return;
  }
  if (solver.status === "running" || flashes.size) rafId = requestAnimationFrame(tick);
  else scheduleLoop();
}

// In continuous mode a finished garden rests a moment, then is sown again with the same settings.
function scheduleLoop() {
  clearTimeout(loopTimer);
  if (state.loop && solver.status === "done") loopTimer = setTimeout(() => restart({ newSeed: true }), 2000);
}


// ------------------------------------------------------------------ controls

const WORDS = {
  roses: ["barely breathed", "a murmur", "a whisper", "a song", "a full chorus"],
  lilies: ["a lone pad", "scattered", "a fair few", "plentiful", "a flotilla"],
  stature: ["seedlings", "budding", "in bloom", "full bloom", "grand blooms"],
};

function describe(key) {
  const v = state[key];
  $(`${key}-word`).textContent = WORDS[key][Math.min(4, Math.floor(v / 20))];
}

for (const key of ["roses", "lilies", "stature"]) {
  const input = $(key);
  input.value = state[key];
  describe(key);
  let timer = 0;
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    describe(key);
    clearTimeout(timer);
    timer = setTimeout(() => restart(), 120);
  });
}

for (const btn of document.querySelectorAll("[data-pace]")) {
  btn.setAttribute("aria-pressed", String(btn.dataset.pace === state.pace));
  btn.addEventListener("click", () => {
    state.pace = btn.dataset.pace;
    for (const b of document.querySelectorAll("[data-pace]")) b.setAttribute("aria-pressed", String(b === btn));
    restart();
  });
}

$("sow").addEventListener("click", () => restart({ newSeed: true }));
$("urn").addEventListener("click", () => {
  state.loop = !state.loop;
  $("urn").setAttribute("aria-pressed", String(state.loop));
  if (state.loop) scheduleLoop();
  else clearTimeout(loopTimer);
  foldDials(state.loop);
});

// On phones (garden stacked above the menu) continuous mode folds the menu up so the garden
// and urn share the screen; a second press unfolds it. Desktop keeps its sidebar as is.
// anime.js drives the fold and the matching scroll; without it the change is instant.
const stacked = matchMedia("(max-width: 900px)");
let folded = false;

function foldDials(fold) {
  if (fold && !stacked.matches) return;
  if (!fold && !folded) return;
  folded = fold;
  const el = $("dials");
  const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
  const duration = reduceMotion ? 0 : 700;
  el.inert = fold;

  // Bring the garden to the top of the screen as the menu folds. The page needs room below
  // to scroll that far, or the browser pins its bottom edge and the menu appears not to move.
  const scroller = document.scrollingElement;
  let scrollTo = scroller.scrollTop;
  if (fold) {
    scrollTo = Math.max(0, $("plate-box").getBoundingClientRect().top + scroller.scrollTop - 12);
    document.body.style.minHeight = `${scrollTo + innerHeight}px`;
  }

  if (!window.anime) {
    el.hidden = fold;
    scroller.scrollTop = scrollTo;
    if (!fold) document.body.style.minHeight = "";
    return;
  }
  anime.remove([el, scroller]);
  el.style.overflow = "hidden";
  const from = el.offsetHeight;
  el.style.height = "auto";
  const full = el.scrollHeight;
  el.style.height = `${from}px`;
  const ease = "easeInOutCubic";
  anime({
    targets: el,
    height: fold ? 0 : full,
    opacity: fold ? 0 : 1,
    translateY: fold ? -16 : 0,
    marginBottom: fold ? -gap : 0,
    duration,
    easing: ease,
    complete: () => {
      if (fold) return;
      el.style.cssText = "";
      document.body.style.minHeight = "";
    },
  });
  if (fold) anime({ targets: scroller, scrollTop: scrollTo, duration, easing: ease });
}

// If the screen widens into the side-by-side layout while folded, put the sliders back at once.
stacked.addEventListener("change", (e) => {
  if (e.matches || !folded) return;
  folded = false;
  const el = $("dials");
  if (window.anime) anime.remove(el);
  el.style.cssText = "";
  el.hidden = false;
  el.inert = false;
  document.body.style.minHeight = "";
});

// ------------------------------------------------------------------ ornaments

function ornament(selector, pm, scale) {
  const url = toCanvas(pm).toDataURL();
  for (const el of document.querySelectorAll(selector)) {
    el.style.backgroundImage = `url(${url})`;
    el.style.setProperty("--ow", `${pm.w * scale}px`);
    el.style.setProperty("--oh", `${pm.h * scale}px`);
  }
}

function placeCanvas(id, pm) {
  const c = toCanvas(pm);
  c.setAttribute("aria-hidden", "true");
  $(id).replaceChildren(c);
}

ornament(".vine", ornaments.vineStrip(), 3);
ornament(".curl", ornaments.cornerCurl(), 3);
ornament(".divider", ornaments.divider(), 3);
ornament(".urn", ornaments.urn(), 3);
// Gilt rosettes for the plate frame's corners; the frame itself is CSS so it keeps one thickness.
const rosette = toCanvas({ w: 5, h: 5, px: [..."  k   kRk kRbRk kRk   k  "].map((c) => (c === " " ? "" : c)) }).toDataURL();
$("plate-box").style.setProperty("--rosette", `url(${rosette})`);
document.documentElement.style.setProperty("--thumb", `url(${toCanvas(ornaments.thumb()).toDataURL()})`);
placeCanvas("dropcap", ornaments.dropCap());


restart();
