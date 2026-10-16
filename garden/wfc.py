# Ported from WaveFunctionCollapse, Copyright (C) 2016 Maxim Gumin, MIT License.
"""Pure-Python port of Model.cs (Entropy heuristic, N = 1).

Used to preview without the .NET SDK and to sanity-check rule changes. Results
differ from the C# build seed-for-seed because the random generators differ.
"""
from __future__ import annotations

import math
import random
from typing import List, Optional

DX = (-1, 0, 1, 0)
DY = (0, 1, 0, -1)
OPPOSITE = (2, 3, 0, 1)


def run(weights: List[float], propagator, mx: int, my: int, seed: int,
        periodic: bool = False) -> Optional[List[int]]:
    """Returns observed variant indices (row-major), or None on contradiction."""
    T = len(weights)
    rng = random.Random(seed)
    wlw = [w * math.log(w) for w in weights]
    sum_w, sum_wlw = sum(weights), sum(wlw)
    start_entropy = math.log(sum_w) - sum_wlw / sum_w

    n = mx * my
    wave = [[True] * T for _ in range(n)]
    compatible = [[[len(propagator[OPPOSITE[d]][t]) for d in range(4)] for t in range(T)] for _ in range(n)]
    ones = [T] * n
    sums = [sum_w] * n
    sums_log = [sum_wlw] * n
    entropy = [start_entropy] * n
    stack = []

    def ban(i, t):
        wave[i][t] = False
        compatible[i][t] = [0, 0, 0, 0]
        stack.append((i, t))
        ones[i] -= 1
        sums[i] -= weights[t]
        sums_log[i] -= wlw[t]
        if sums[i] > 0:
            entropy[i] = math.log(sums[i]) - sums_log[i] / sums[i]

    def propagate() -> bool:
        while stack:
            i1, t1 = stack.pop()
            x1, y1 = i1 % mx, i1 // mx
            for d in range(4):
                x2, y2 = x1 + DX[d], y1 + DY[d]
                if not periodic and (x2 < 0 or y2 < 0 or x2 >= mx or y2 >= my):
                    continue
                i2 = (x2 % mx) + (y2 % my) * mx
                compat = compatible[i2]
                for t2 in propagator[d][t1]:
                    comp = compat[t2]
                    comp[d] -= 1
                    if comp[d] == 0:
                        ban(i2, t2)
        return all(o > 0 for o in ones)

    while True:
        best, argmin = 1e4, -1
        for i in range(n):
            if ones[i] > 1 and entropy[i] <= best:
                e = entropy[i] + 1e-6 * rng.random()
                if e < best:
                    best, argmin = e, i
        if argmin < 0:
            return [next(t for t in range(T) if wave[i][t]) for i in range(n)]

        w = wave[argmin]
        r = rng.random() * sums[argmin]
        acc, pick = 0.0, -1
        for t in range(T):
            if w[t]:
                acc += weights[t]
                pick = t
                if acc >= r:
                    break
        for t in range(T):
            if w[t] and t != pick:
                ban(argmin, t)
        if not propagate():
            return None
