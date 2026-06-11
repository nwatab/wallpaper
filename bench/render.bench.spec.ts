// Stage-A render-performance harness — ONE test drives the whole matrix
// (pattern × clip × device) so output (JSON + summary table) is emitted in one place.
//
// Probes per cell, matched to the hypotheses they actually test:
//  • initial-render raster (CDP Tracing)  — target's first paint, fresh page  [clip/overdraw]
//  • switch raster + latency (CDP Tracing) — warm baseline→target repaint, the M1 path [clip/overdraw]
//  • composite/commit pan (rAF frame deltas) — labeled NOT-a-paint indicator
//  • domNodes / layoutCount / recalcStyleCount (CDP Performance.getMetrics)
//  • fcp (in-page paint observer)
import { test, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  BASELINE_TITLE,
  CLIPS,
  DESKTOP_VIEWPORT,
  DEVICES,
  FRAME_K,
  PANEL_PROBE_PATTERN,
  PANEL_STATES,
  PATTERNS,
  RASTER_K,
  type Clip,
  type DeviceSpec,
  type PanelState,
  type PatternSpec,
} from './matrix';
import {
  clickPattern,
  getDpr,
  getFcpMs,
  getNodeMetrics,
  getScriptDurationMs,
  getWallpaperNodeCount,
  injectClipOff,
  injectPanelHidden,
  runPan,
  selectPatternTimed,
  traceRaster,
  waitStable,
} from './measure';
import {
  buildSha,
  printPanelSummary,
  printSummary,
  reduceCell,
  reducePanelCell,
  writeResultsJson,
  type CellMetrics,
  type PanelCellMetrics,
  type PanelRawCell,
  type RawCell,
} from './report';

const ROUTE = '/wallpaper';
const NOW_ISO = new Date().toISOString();
const SHA = buildSha();

const newContext = (browser: Browser, dev: DeviceSpec): Promise<BrowserContext> =>
  dev.descriptor
    ? browser.newContext({ ...devices[dev.descriptor] })
    : browser.newContext({
        viewport: DESKTOP_VIEWPORT,
        deviceScaleFactor: 1,
      });

const freshPage = async (
  context: BrowserContext,
  dev: DeviceSpec,
  opts: { clipOff?: boolean; panelHidden?: boolean } = {},
): Promise<{ page: Page; client: import('@playwright/test').CDPSession }> => {
  const page = await context.newPage();
  if (opts.clipOff) await injectClipOff(page);
  if (opts.panelHidden) await injectPanelHidden(page);
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');
  if (dev.cpuThrottle > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: dev.cpuThrottle });
  }
  await page.goto(ROUTE, { waitUntil: 'networkidle' });
  await waitStable(page); // baseline (p1) painted
  return { page, client };
};

const ENV_NOTE =
  'clip on→off delta is a LOWER BOUND on clip cost (clip removal can increase painted area). ' +
  'panP95 = composite/commit cost, not paint/clip. CPU throttle does not throttle the GPU; ' +
  'DPR is set so raster AREA is representative. Real-device validation is a follow-up.';

const makeEnv = (
  dev: DeviceSpec,
  dpr: number,
  viewport: { width: number; height: number },
): RawCell['env'] => ({
  cpuThrottle: dev.cpuThrottle,
  dpr,
  viewport,
  buildSha: SHA,
  serveMode: 'static-export',
  note: ENV_NOTE,
});

const defaultDpr = (dev: DeviceSpec): number =>
  dev.descriptor ? devices[dev.descriptor].deviceScaleFactor ?? 1 : 1;
const defaultViewport = (dev: DeviceSpec): { width: number; height: number } =>
  dev.descriptor ? devices[dev.descriptor].viewport ?? DESKTOP_VIEWPORT : DESKTOP_VIEWPORT;

const emptyRaw = (): RawCell['raw'] => ({
  fcpMs: [],
  domNodes: [],
  svgNodes: [],
  layoutCount: [],
  recalcStyleCount: [],
  panRuns: [],
  initialRasterMs: [],
  initialLatencyMs: [],
  switchRasterMs: [],
  switchLatencyMs: [],
});

const runCell = async (
  context: BrowserContext,
  dev: DeviceSpec,
  pattern: PatternSpec,
  clip: Clip,
): Promise<RawCell> => {
  const raw = emptyRaw();
  let dpr = defaultDpr(dev);
  let viewport = defaultViewport(dev);

  // --- Raster loop (CDP Tracing) — RASTER_K runs, warmup dropped at reduce. ---
  for (let k = 0; k < RASTER_K; k++) {
    const { page, client } = await freshPage(context, dev, { clipOff: clip === 'off' });

    // (i) initial render of the TARGET into a fresh page (cold DOM build).
    const init = await traceRaster(client, () => selectPatternTimed(page, pattern.title));
    await waitStable(page);
    raw.initialRasterMs.push(init.rasterMs);
    raw.initialLatencyMs.push(init.result);

    // (ii) warm switch: return to baseline (untraced), then trace baseline→target.
    await clickPattern(page, BASELINE_TITLE);
    await waitStable(page);
    const sw = await traceRaster(client, () => selectPatternTimed(page, pattern.title));
    await waitStable(page);
    raw.switchRasterMs.push(sw.rasterMs);
    raw.switchLatencyMs.push(sw.result);

    await page.close();
  }

  // --- Frame loop — FRAME_K runs: fcp, node metrics, composite pan. ---
  for (let k = 0; k < FRAME_K; k++) {
    const { page, client } = await freshPage(context, dev, { clipOff: clip === 'off' });
    raw.fcpMs.push(await getFcpMs(page));

    await selectPatternTimed(page, pattern.title);
    await waitStable(page);

    if (k === 0) {
      dpr = await getDpr(page);
      const vp = page.viewportSize();
      if (vp) viewport = vp;
    }

    const nodes = await getNodeMetrics(client);
    raw.domNodes.push(nodes.domNodes);
    raw.svgNodes.push(await getWallpaperNodeCount(page));
    raw.layoutCount.push(nodes.layoutCount);
    raw.recalcStyleCount.push(nodes.recalcStyleCount);

    raw.panRuns.push(await runPan(page));
    await page.close();
  }

  return {
    pattern: pattern.id,
    patternRole: pattern.role,
    clip,
    device: dev.name,
    env: makeEnv(dev, dpr, viewport),
    raw,
  };
};

// Panel-isolation probe: panel ∈ {shown, hidden} for ONE pattern. No CDP tracing — records
// whole-doc domNodes (a control: unchanged by display:none), node/recalc counts, fcp, pan, and
// switch latency. The shown−hidden delta isolates the panel chrome's render cost.
const runPanelCell = async (
  context: BrowserContext,
  dev: DeviceSpec,
  pattern: PatternSpec,
  panel: PanelState,
): Promise<PanelRawCell> => {
  const raw: PanelRawCell['raw'] = {
    fcpMs: [],
    domNodes: [],
    svgNodes: [],
    layoutCount: [],
    recalcStyleCount: [],
    panRuns: [],
    switchLatencyMs: [],
    switchScriptMs: [],
  };
  let dpr = defaultDpr(dev);
  let viewport = defaultViewport(dev);
  const panelHidden = panel === 'hidden';

  for (let k = 0; k < FRAME_K; k++) {
    const { page, client } = await freshPage(context, dev, { panelHidden });
    raw.fcpMs.push(await getFcpMs(page));

    // Cold initial render of the probe pattern.
    await selectPatternTimed(page, pattern.title);
    await waitStable(page);

    if (k === 0) {
      dpr = await getDpr(page);
      const vp = page.viewportSize();
      if (vp) viewport = vp;
    }

    const nodes = await getNodeMetrics(client);
    raw.domNodes.push(nodes.domNodes);
    raw.svgNodes.push(await getWallpaperNodeCount(page));
    raw.layoutCount.push(nodes.layoutCount);
    raw.recalcStyleCount.push(nodes.recalcStyleCount);

    // Warm switch latency: baseline → probe pattern (the M1 path). Snapshot ScriptDuration
    // around the switch to split the React-reconciliation share from browser-render cost.
    await clickPattern(page, BASELINE_TITLE);
    await waitStable(page);
    const scriptBefore = await getScriptDurationMs(client);
    raw.switchLatencyMs.push(await selectPatternTimed(page, pattern.title));
    await waitStable(page);
    raw.switchScriptMs.push((await getScriptDurationMs(client)) - scriptBefore);

    raw.panRuns.push(await runPan(page));
    await page.close();
  }

  return {
    pattern: pattern.id,
    panel,
    device: dev.name,
    env: makeEnv(dev, dpr, viewport),
    raw,
  };
};

test('render bench matrix (pattern × clip × device) + panel-isolation probe', async ({
  browser,
}) => {
  const cells: CellMetrics[] = [];
  const panelCells: PanelCellMetrics[] = [];
  const panelPattern =
    PATTERNS.find((p) => p.id === PANEL_PROBE_PATTERN) ?? PATTERNS[0];

  for (const dev of DEVICES) {
    const context = await newContext(browser, dev);

    // Pattern matrix: pattern × clip (answers clip / overdraw / node / re-render FOR THE PATTERN).
    for (const pattern of PATTERNS) {
      for (const clip of CLIPS) {
        console.log(`▶ ${pattern.id} · clip=${clip} · ${dev.name}`);
        cells.push(reduceCell(await runCell(context, dev, pattern, clip)));
      }
    }

    // Panel-isolation probe: panel ∈ {shown,hidden} for one pattern (answers whether the
    // panel chrome itself is the dominant cost).
    if (panelPattern) {
      for (const panel of PANEL_STATES) {
        console.log(`▶ [panel] ${panelPattern.id} · panel=${panel} · ${dev.name}`);
        panelCells.push(
          reducePanelCell(await runPanelCell(context, dev, panelPattern, panel)),
        );
      }
    }

    await context.close();
  }

  const file = writeResultsJson([...cells, ...panelCells], NOW_ISO);
  printSummary(cells);
  printPanelSummary(panelCells);
  console.log(`\nJSON → ${file}`);
  console.log(`env: build=${SHA}  serve=static-export  stamp=${NOW_ISO}`);
});
