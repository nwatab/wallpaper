// Pure summary statistics. Never report a single sample — every metric is a median
// over K≥2 kept runs with spread (IQR + min/max).
import { JANK_FRAME_MS, SLOW_FRAME_MS } from './matrix';

export type Summary = {
  median: number;
  iqr: number;
  min: number;
  max: number;
  n: number;
};

const sorted = (xs: number[]): number[] => [...xs].sort((a, b) => a - b);

export const median = (xs: number[]): number => {
  const s = sorted(xs);
  const n = s.length;
  if (n === 0) return NaN;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Linear-interpolation quantile (type-7), the conventional choice.
export const quantile = (xs: number[], q: number): number => {
  const s = sorted(xs);
  if (s.length === 0) return NaN;
  if (s.length === 1) return s[0];
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

export const summarize = (xs: number[]): Summary => ({
  median: median(xs),
  iqr: quantile(xs, 0.75) - quantile(xs, 0.25),
  min: xs.length ? Math.min(...xs) : NaN,
  max: xs.length ? Math.max(...xs) : NaN,
  n: xs.length,
});

export const countOver = (xs: number[], t: number): number =>
  xs.filter((x) => x > t).length;

export type PanRunStats = {
  p50: number;
  p95: number;
  max: number;
  over16: number;
  over50: number;
};

// Per-run statistics for one pan (one array of consecutive-frame deltas, ms).
export const panRunStats = (deltas: number[]): PanRunStats => ({
  p50: quantile(deltas, 0.5),
  p95: quantile(deltas, 0.95),
  max: deltas.length ? Math.max(...deltas) : NaN,
  over16: countOver(deltas, SLOW_FRAME_MS),
  over50: countOver(deltas, JANK_FRAME_MS),
});

// Drop the warmup run (index 0). Keeps callers from forgetting the convention.
export const dropWarmup = <T>(runs: T[]): T[] => runs.slice(1);
