// Ported from WaveFunctionCollapse, Copyright (C) 2016 Maxim Gumin, MIT License.
// https://github.com/mxgmn/WaveFunctionCollapse
// Step-by-step port of WaveFunctionCollapse's Model.cs (Entropy heuristic, N = 1,
// non-periodic). Each step() observes one cell and propagates, so the caller can
// draw the garden as it settles.

const DX = [-1, 0, 1, 0];
const DY = [0, 1, 0, -1];
const OPPOSITE = [2, 3, 0, 1];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Solver {
  constructor({ weights, propagator }, mx, my, seed) {
    const T = weights.length, n = mx * my;
    Object.assign(this, { weights, propagator, mx, my, T, n });
    this.random = mulberry32(seed);
    this.wlw = weights.map((w) => w * Math.log(w));
    const sumW = weights.reduce((a, b) => a + b, 0);
    const sumWlw = this.wlw.reduce((a, b) => a + b, 0);

    this.wave = new Uint8Array(n * T).fill(1);
    this.compatible = new Int32Array(n * T * 4);
    for (let i = 0; i < n; i++)
      for (let t = 0; t < T; t++)
        for (let d = 0; d < 4; d++) this.compatible[(i * T + t) * 4 + d] = propagator[OPPOSITE[d]][t].length;
    this.ones = new Int32Array(n).fill(T);
    this.sums = new Float64Array(n).fill(sumW);
    this.sumsLog = new Float64Array(n).fill(sumWlw);
    this.entropy = new Float64Array(n).fill(Math.log(sumW) - sumWlw / sumW);
    this.stack = [];
    this.dirty = new Set();
    this.status = "running";
    this.settled = 0;
  }

  ban(i, t) {
    const T = this.T;
    this.wave[i * T + t] = 0;
    this.compatible.fill(0, (i * T + t) * 4, (i * T + t) * 4 + 4);
    this.stack.push(i, t);
    this.ones[i] -= 1;
    this.sums[i] -= this.weights[t];
    this.sumsLog[i] -= this.wlw[t];
    this.entropy[i] = Math.log(this.sums[i]) - this.sumsLog[i] / this.sums[i];
    if (this.ones[i] === 1) this.settled++;
    if (this.ones[i] === 0) this.status = "contradiction";
    this.dirty.add(i);
  }

  propagate() {
    const { T, mx, my, propagator, compatible, stack } = this;
    while (stack.length) {
      const t1 = stack.pop(), i1 = stack.pop();
      const x1 = i1 % mx, y1 = (i1 / mx) | 0;
      for (let d = 0; d < 4; d++) {
        const x2 = x1 + DX[d], y2 = y1 + DY[d];
        if (x2 < 0 || y2 < 0 || x2 >= mx || y2 >= my) continue;
        const i2 = x2 + y2 * mx;
        for (const t2 of propagator[d][t1]) {
          const k = (i2 * T + t2) * 4 + d;
          if (--compatible[k] === 0) this.ban(i2, t2);
        }
      }
      if (this.status === "contradiction") return;
    }
  }

  /** Observe one cell and propagate. Returns the observed cell index, or -1. */
  step() {
    if (this.status !== "running") return -1;
    let best = 1e4, argmin = -1;
    for (let i = 0; i < this.n; i++) {
      if (this.ones[i] > 1 && this.entropy[i] <= best) {
        const e = this.entropy[i] + 1e-6 * this.random();
        if (e < best) { best = e; argmin = i; }
      }
    }
    if (argmin < 0) {
      this.status = "done";
      return -1;
    }

    const { T, wave, weights } = this;
    let r = this.random() * this.sums[argmin], pick = -1;
    for (let t = 0; t < T; t++) {
      if (!wave[argmin * T + t]) continue;
      pick = t;
      r -= weights[t];
      if (r <= 0) break;
    }
    for (let t = 0; t < T; t++) if (wave[argmin * T + t] && t !== pick) this.ban(argmin, t);
    this.propagate();
    return argmin;
  }

  /** The single remaining variant of a settled cell, or -1. */
  observed(i) {
    if (this.ones[i] !== 1) return -1;
    return this.wave.indexOf(1, i * this.T) - i * this.T;
  }
}
