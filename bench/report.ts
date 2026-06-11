// Reduce raw per-iteration samples into median+spread metrics, write the results JSON,
// and print the pretty stdout summary table.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dropWarmup,
  panRunStats,
  summarize,
  type PanRunStats,
  type Summary,
} from './stats';
import type { Clip, PanelState } from './matrix';

// Raw samples collected per cell (every run kept; warmup dropped here at reduce time).
export type RawCell = {
  pattern: string;
  patternRole: string;
  clip: Clip;
  device: string;
  env: {
    cpuThrottle: number;
    dpr: number;
    viewport: { width: number; height: number };
    buildSha: string;
    serveMode: 'static-export';
    note: string;
  };
  raw: {
    fcpMs: number[];
    domNodes: number[]; // whole-document (CDP Nodes) — dominated by gallery swatches
    svgNodes: number[]; // #wallpaper subtree only — the pattern's own nodes
    layoutCount: number[];
    recalcStyleCount: number[];
    panRuns: number[][]; // one array of frame-deltas per kept run
    initialRasterMs: number[];
    initialLatencyMs: number[];
    switchRasterMs: number[];
    switchLatencyMs: number[];
  };
};

export type CellMetrics = {
  probe: 'pattern';
  pattern: string;
  patternRole: string;
  clip: Clip;
  device: string;
  env: RawCell['env'];
  metrics: {
    fcpMs: Summary;
    domNodes: Summary;
    svgNodes: Summary;
    layoutCount: Summary;
    recalcStyleCount: Summary;
    // Pan headline: per-run stats, then median across runs of each field.
    pan: { [K in keyof PanRunStats]: Summary };
    // Raster (CDP Tracing) at the two paint-heavy moments — the real clip/overdraw probe.
    initialRenderRasterMs: Summary;
    initialRenderLatencyMs: Summary;
    switchRasterMs: Summary;
    switchLatencyMs: Summary;
  };
};

const reducePan = (panRuns: number[][]): CellMetrics['metrics']['pan'] => {
  const per = panRuns.map(panRunStats);
  return {
    p50: summarize(per.map((p) => p.p50)),
    p95: summarize(per.map((p) => p.p95)),
    max: summarize(per.map((p) => p.max)),
    over16: summarize(per.map((p) => p.over16)),
    over50: summarize(per.map((p) => p.over50)),
  };
};

export const reduceCell = (c: RawCell): CellMetrics => ({
  probe: 'pattern',
  pattern: c.pattern,
  patternRole: c.patternRole,
  clip: c.clip,
  device: c.device,
  env: c.env,
  metrics: {
    fcpMs: summarize(dropWarmup(c.raw.fcpMs)),
    domNodes: summarize(dropWarmup(c.raw.domNodes)),
    svgNodes: summarize(dropWarmup(c.raw.svgNodes)),
    layoutCount: summarize(dropWarmup(c.raw.layoutCount)),
    recalcStyleCount: summarize(dropWarmup(c.raw.recalcStyleCount)),
    pan: reducePan(dropWarmup(c.raw.panRuns)),
    initialRenderRasterMs: summarize(dropWarmup(c.raw.initialRasterMs)),
    initialRenderLatencyMs: summarize(dropWarmup(c.raw.initialLatencyMs)),
    switchRasterMs: summarize(dropWarmup(c.raw.switchRasterMs)),
    switchLatencyMs: summarize(dropWarmup(c.raw.switchLatencyMs)),
  },
});

// ---- panel-isolation probe (separate experiment) ----

export type PanelRawCell = {
  pattern: string;
  panel: PanelState;
  device: string;
  env: RawCell['env'];
  raw: {
    fcpMs: number[];
    domNodes: number[];
    svgNodes: number[];
    layoutCount: number[];
    recalcStyleCount: number[];
    panRuns: number[][];
    switchLatencyMs: number[];
    switchScriptMs: number[]; // ScriptDuration delta over the switch (React-reconciliation share)
  };
};

export type PanelCellMetrics = {
  probe: 'panel';
  pattern: string;
  panel: PanelState;
  device: string;
  env: RawCell['env'];
  metrics: {
    fcpMs: Summary;
    domNodes: Summary; // whole-doc; UNCHANGED across shown/hidden (control)
    svgNodes: Summary;
    layoutCount: Summary;
    recalcStyleCount: Summary;
    pan: { [K in keyof PanRunStats]: Summary };
    switchLatencyMs: Summary;
    switchScriptMs: Summary;
  };
};

export const reducePanelCell = (c: PanelRawCell): PanelCellMetrics => ({
  probe: 'panel',
  pattern: c.pattern,
  panel: c.panel,
  device: c.device,
  env: c.env,
  metrics: {
    fcpMs: summarize(dropWarmup(c.raw.fcpMs)),
    domNodes: summarize(dropWarmup(c.raw.domNodes)),
    svgNodes: summarize(dropWarmup(c.raw.svgNodes)),
    layoutCount: summarize(dropWarmup(c.raw.layoutCount)),
    recalcStyleCount: summarize(dropWarmup(c.raw.recalcStyleCount)),
    pan: reducePan(dropWarmup(c.raw.panRuns)),
    switchLatencyMs: summarize(dropWarmup(c.raw.switchLatencyMs)),
    switchScriptMs: summarize(dropWarmup(c.raw.switchScriptMs)),
  },
});

export const buildSha = (): string => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

// __dirname (CJS) rather than import.meta.url — Playwright transpiles the harness to CJS.
const RESULTS_DIR = join(__dirname, 'results');

export const writeResultsJson = (
  cells: (CellMetrics | PanelCellMetrics)[],
  isoStamp: string,
): string => {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const safe = isoStamp.replace(/[:.]/g, '-');
  const file = join(RESULTS_DIR, `${safe}.json`);
  writeFileSync(file, JSON.stringify(cells, null, 2));
  return file;
};

// ---- pretty stdout table ----

const f = (n: number, d = 1): string =>
  Number.isFinite(n) ? n.toFixed(d) : '—';

const pad = (s: string, w: number): string =>
  s.length >= w ? s : s + ' '.repeat(w - s.length);

export const printSummary = (cells: CellMetrics[]): void => {
  const byPattern = new Map<string, CellMetrics[]>();
  for (const c of cells) {
    const arr = byPattern.get(c.pattern) ?? [];
    arr.push(c);
    byPattern.set(c.pattern, arr);
  }

  const cols: [string, number][] = [
    ['device', 8],
    ['clip', 5],
    ['svgNodes', 9],
    ['fcp(med)', 9],
    ['initRaster', 11],
    ['swRaster', 9],
    ['swLat', 8],
    ['panP95', 8],
    ['pan>50', 7],
  ];
  const header = cols.map(([h, w]) => pad(h, w)).join(' ');

  for (const [pattern, group] of byPattern) {
    const role = group[0]?.patternRole ?? '';
    console.log(`\n■ ${pattern}  — ${role}`);
    console.log('  ' + header);
    console.log('  ' + '-'.repeat(header.length));
    for (const c of group) {
      const m = c.metrics;
      const row = [
        pad(c.device, 8),
        pad(c.clip, 5),
        pad(f(m.svgNodes.median, 0), 9),
        pad(f(m.fcpMs.median), 9),
        pad(f(m.initialRenderRasterMs.median), 11),
        pad(f(m.switchRasterMs.median), 9),
        pad(f(m.switchLatencyMs.median), 8),
        pad(f(m.pan.p95.median), 8),
        pad(f(m.pan.over50.median, 0), 7),
      ].join(' ');
      console.log('  ' + row);
    }

    // clip on→off deltas at the PAINT moments (initial render + switch), per device.
    // NOTE: this delta is a LOWER BOUND on clip cost — removing clip can grow painted
    // area, partially offsetting the removed clip-stencil cost.
    for (const device of ['desktop', 'mobile']) {
      const on = group.find((c) => c.device === device && c.clip === 'on');
      const off = group.find((c) => c.device === device && c.clip === 'off');
      if (!on || !off) continue;
      const dInit =
        on.metrics.initialRenderRasterMs.median -
        off.metrics.initialRenderRasterMs.median;
      const dSwitch =
        on.metrics.switchRasterMs.median - off.metrics.switchRasterMs.median;
      const dPan = on.metrics.pan.p95.median - off.metrics.pan.p95.median;
      console.log(
        `    Δ clip(on−off) ${pad(device, 8)} initRaster=${f(dInit)}ms  switchRaster=${f(
          dSwitch,
        )}ms  panP95=${f(dPan)}ms (≈0 expected — pan is composite-only)`,
      );
    }
  }
  console.log(
    '\nclip on→off delta is a LOWER BOUND on clip cost (clip removal can increase painted area).',
  );
  console.log(
    'panP95 = composite/commit cost, NOT a paint/clip indicator. CPU throttle does not throttle the GPU.',
  );
};

// Panel-isolation probe summary: shown vs hidden, per device, for the one probe pattern.
export const printPanelSummary = (cells: PanelCellMetrics[]): void => {
  if (cells.length === 0) return;
  console.log(
    `\n══ PANEL-ISOLATION PROBE — pattern ${cells[0].pattern}, panel display:none (nodes stay in DOM) ══`,
  );
  const cols: [string, number][] = [
    ['device', 8],
    ['panel', 7],
    ['domNodes', 9],
    ['svgNodes', 9],
    ['layoutCnt', 10],
    ['recalcCnt', 10],
    ['fcp(med)', 9],
    ['panP95', 8],
    ['swLat', 8],
    ['swScript', 9],
    ['swRender', 9],
  ];
  const header = cols.map(([h, w]) => pad(h, w)).join(' ');
  console.log('  ' + header);
  console.log('  ' + '-'.repeat(header.length));
  for (const c of cells) {
    const m = c.metrics;
    // swRender = wall-clock switch latency minus the scripting (React) share → browser-render.
    const swRender = m.switchLatencyMs.median - m.switchScriptMs.median;
    console.log(
      '  ' +
        [
          pad(c.device, 8),
          pad(c.panel, 7),
          pad(f(m.domNodes.median, 0), 9),
          pad(f(m.svgNodes.median, 0), 9),
          pad(f(m.layoutCount.median, 0), 10),
          pad(f(m.recalcStyleCount.median, 0), 10),
          pad(f(m.fcpMs.median), 9),
          pad(f(m.pan.p95.median), 8),
          pad(f(m.switchLatencyMs.median), 8),
          pad(f(m.switchScriptMs.median), 9),
          pad(f(swRender), 9),
        ].join(' '),
    );
  }
  for (const device of ['desktop', 'mobile']) {
    const shown = cells.find((c) => c.device === device && c.panel === 'shown');
    const hidden = cells.find((c) => c.device === device && c.panel === 'hidden');
    if (!shown || !hidden) continue;
    const d = (sel: (m: PanelCellMetrics['metrics']) => number) =>
      f(sel(shown.metrics) - sel(hidden.metrics));
    const swRenderOf = (m: PanelCellMetrics['metrics']) =>
      m.switchLatencyMs.median - m.switchScriptMs.median;
    console.log(
      `    Δ panel(shown−hidden) ${pad(device, 8)} fcp=${d((m) => m.fcpMs.median)}ms  ` +
        `panP95=${d((m) => m.pan.p95.median)}ms  swLat=${d(
          (m) => m.switchLatencyMs.median,
        )}ms  ` +
        `[swScript=${d((m) => m.switchScriptMs.median)}ms  swRender=${f(
          swRenderOf(shown.metrics) - swRenderOf(hidden.metrics),
        )}ms]  ` +
        `(domNodes unchanged: ${f(shown.metrics.domNodes.median, 0)} vs ${f(
          hidden.metrics.domNodes.median,
          0,
        )})`,
    );
  }
  console.log(
    'A large shown−hidden delta with UNCHANGED domNodes ⇒ the panel chrome (not the pattern) drives layout/recalc/paint cost.',
  );
  console.log(
    'swScript = ScriptDuration delta (React reconciliation + innerHTML parse); swRender = swLat − swScript (browser layout/paint).',
  );
  console.log(
    'display:none leaves the React tree identical, so a near-zero swScript Δ with a large swRender Δ pins the cost on browser render, not React.',
  );
};
