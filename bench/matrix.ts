// The experiment matrix and all tunable knobs for the Stage-A render bench.
// pattern × clip × device, plus repetition counts and interaction parameters.

export type PatternSpec = {
  id: string;
  /** The gallery button's `title=` (unique per template — verified) → deterministic selector. */
  title: string;
  /** Which hypothesis axis this pattern stresses. */
  role: string;
};

// Optional env subsetting — for CI smoke runs and harness iteration. Defaults run the full
// matrix. e.g. BENCH_PATTERNS=gen-p4m BENCH_DEVICES=desktop BENCH_FRAME_K=3 BENCH_RASTER_K=2.
const csv = (v: string | undefined): string[] | null =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null;
const intEnv = (v: string | undefined, fallback: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// All four are GALLERY templates (gallery is the default mode on load), selected by their
// unique visible title via `button[title="..."]`. No data-testid / src/ change needed.
const ALL_PATTERNS: PatternSpec[] = [
  {
    id: 'gen-p4m',
    title: 'Computer-generated · p4m',
    role: '(a) clip-heavy confined glyph — motif clipped to fundamental region, 8 ops',
  },
  {
    id: 'cm-seigaiha-equilateral-triangle',
    title: 'Seigaiha -- equilateral triangle fundamental region',
    // SANITY CHECK: seigaiha uses NO clip, so its clip on/off delta must be ≈ 0. A large
    // delta here means the clip-isolation injection is misfiring.
    role: '(b) seigaiha overlap/overdraw — NO clip (clip-delta sanity check ≈ 0)',
  },
  {
    id: 'gen-cmm-quatrefoil',
    title: 'Talavera quatrefoil interlace',
    role: '(c) dense, path-complex region fill',
  },
  {
    id: 'gen-p6m-shamsa',
    title: 'Shamsa rosette',
    role: '(d) high-symmetry hexagonal (p6m) — 12 ops, highest node multiplicity',
  },
];

const PATTERN_FILTER = csv(process.env.BENCH_PATTERNS);
export const PATTERNS: PatternSpec[] = PATTERN_FILTER
  ? ALL_PATTERNS.filter((p) => PATTERN_FILTER.includes(p.id))
  : ALL_PATTERNS;

export const CLIPS = ['on', 'off'] as const;
export type Clip = (typeof CLIPS)[number];

export type DeviceSpec = {
  name: 'desktop' | 'mobile';
  /** Playwright device-descriptor key, or null for an explicit desktop context. */
  descriptor: string | null;
  /** CDP Emulation.setCPUThrottlingRate; 1 = no throttle. */
  cpuThrottle: number;
};

const ALL_DEVICES: DeviceSpec[] = [
  { name: 'desktop', descriptor: null, cpuThrottle: 1 },
  // Pixel-class descriptor sets isMobile, hasTouch and the real deviceScaleFactor (~2.75),
  // so raster AREA is representative. The 4× CPU throttle is applied via CDP.
  { name: 'mobile', descriptor: 'Pixel 5', cpuThrottle: 4 },
];

const DEVICE_FILTER = csv(process.env.BENCH_DEVICES);
export const DEVICES: DeviceSpec[] = DEVICE_FILTER
  ? ALL_DEVICES.filter((d) => DEVICE_FILTER.includes(d.name))
  : ALL_DEVICES;

export const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

// Repetition. Discard run 1 (warmup) everywhere; report median + spread over the rest.
export const FRAME_K = intEnv(process.env.BENCH_FRAME_K, 7); // domNodes / fcp / pan → 6 kept
// Raster carries the clip/overdraw decision, so keep ≥4 samples (K=5 → 4 kept). Raster
// windows are short, so the added time is small.
export const RASTER_K = intEnv(process.env.BENCH_RASTER_K, 5); // raster & latency → 4 kept

// Composite/commit pan (NOT a paint/clip indicator — it composites a promoted layer).
export const PAN_FRAMES = 120;
export const PAN_DISTANCE_PX = 200;

export const SETTLE_MS = 500; // fixed settle after networkidle + a double-rAF flush
export const FCP_BUDGET_MS = 30_000;

// Panel-isolation probe: the gallery panel holds ~440k of the ~460k document nodes (~30 live
// swatch SVGs). That node mass drives style-recalc / layout / memory independent of paint and
// is invisible to the pattern matrix (the panel is a constant background in every cell). This
// probe varies panel ∈ {shown, hidden} for ONE representative pattern on both devices to test
// whether the chrome itself — not the pattern — is the dominant cost.
export const PANEL_STATES = ['shown', 'hidden'] as const;
export type PanelState = (typeof PANEL_STATES)[number];
export const PANEL_PROBE_PATTERN =
  process.env.BENCH_PANEL_PATTERN || 'gen-p6m-shamsa'; // heaviest pattern → strongest contrast

// The switch SOURCE: p1 is the default-loaded pattern, so it is already on screen at goto.
// Each target is reached by switching FROM this baseline (the real M1 gallery-click path).
export const BASELINE_TITLE = 'Parallelogram (70°)';

// Frame-time thresholds for the composite-pan headline.
export const SLOW_FRAME_MS = 16.7;
export const JANK_FRAME_MS = 50;
