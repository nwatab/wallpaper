// REGRESSION GUARD for the swatch-SVG over-invalidation fix, measured at the style-recalc level.
// The `UpdateLayoutTree` trace event carries `elementCount` = elements whose style was
// recalculated; we sum it over a baseline→p6m switch, panel shown vs hidden, both devices.
// With the fix, showing the panel adds ~no recalc (Δ single digits) — panel-shown recalcs only
// the new pattern's own nodes, same as panel-hidden. Pre-fix the panel added ~85,635 spurious
// recalcs every switch. This asserts the shown−hidden Δ stays small, so reintroducing the
// per-switch swatch re-commit fails here. (First event's args are logged to verify the field.)
import { test, expect, devices, type Browser, type BrowserContext, type CDPSession } from '@playwright/test';
import {
  BASELINE_TITLE,
  DESKTOP_VIEWPORT,
  DEVICES,
  PANEL_PROBE_PATTERN,
  PATTERNS,
  type DeviceSpec,
} from './matrix';
import {
  clickPattern,
  injectPanelHidden,
  selectPatternTimed,
  waitStable,
} from './measure';
import { dropWarmup, median } from './stats';

const ROUTE = '/wallpaper';
const K = Number(process.env.BENCH_DIAG_K || 3); // → 2 kept after warmup
const TARGET = PATTERNS.find((p) => p.id === PANEL_PROBE_PATTERN) ?? PATTERNS[0];

type RecalcEvent = { name: string; dur?: number; args?: unknown };

const elementCountOf = (e: RecalcEvent): number => {
  const a = e.args as
    | { elementCount?: number; beginData?: { elementCount?: number } }
    | undefined;
  return a?.elementCount ?? a?.beginData?.elementCount ?? 0;
};

// Capture UpdateLayoutTree (style recalc) events WITH args over an action window.
const captureRecalc = async <T>(
  client: CDPSession,
  action: () => Promise<T>,
): Promise<{
  elements: number;
  durMs: number;
  count: number;
  sampleArgs: unknown;
  result: T;
}> => {
  const evs: RecalcEvent[] = [];
  const onData = (d: unknown) => {
    const value = (d as { value?: RecalcEvent[] }).value;
    if (value)
      for (const e of value)
        if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') evs.push(e);
  };
  client.on('Tracing.dataCollected', onData);
  await client.send('Tracing.start', {
    categories: 'disabled-by-default-devtools.timeline,devtools.timeline',
    transferMode: 'ReportEvents',
  });
  let result: T;
  try {
    result = await action();
  } finally {
    const complete = new Promise<void>((res) =>
      client.once('Tracing.tracingComplete', () => res()),
    );
    await client.send('Tracing.end');
    await complete;
    client.off('Tracing.dataCollected', onData);
  }
  return {
    elements: evs.reduce((s, e) => s + elementCountOf(e), 0),
    durMs: evs.reduce((s, e) => s + (e.dur ?? 0), 0) / 1000,
    count: evs.length,
    sampleArgs: evs.sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))[0]?.args,
    result,
  };
};

const newContext = (browser: Browser, dev: DeviceSpec): Promise<BrowserContext> =>
  dev.descriptor
    ? browser.newContext({ ...devices[dev.descriptor] })
    : browser.newContext({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 });

const f = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));

test('over-invalidation diagnosis (recalc elementCount, panel shown vs hidden)', async ({
  browser,
}) => {
  for (const dev of DEVICES) {
    const context = await newContext(browser, dev);
    console.log(`\n══ RECALC SCOPE — ${TARGET.id} · ${dev.name} (throttle ${dev.cpuThrottle}×) ══`);
    let sampleShown: unknown;

    const row: Record<string, { elements: number; durMs: number; count: number }> = {};
    for (const panel of ['shown', 'hidden'] as const) {
      const elements: number[] = [];
      const durs: number[] = [];
      const counts: number[] = [];
      for (let k = 0; k < K; k++) {
        const page = await context.newPage();
        if (panel === 'hidden') await injectPanelHidden(page);
        const client = await context.newCDPSession(page);
        if (dev.cpuThrottle > 1)
          await client.send('Emulation.setCPUThrottlingRate', { rate: dev.cpuThrottle });
        await page.goto(ROUTE, { waitUntil: 'networkidle' });
        await waitStable(page);
        await clickPattern(page, BASELINE_TITLE);
        await waitStable(page);
        const cap = await captureRecalc(client, () => selectPatternTimed(page, TARGET.title));
        await waitStable(page);
        elements.push(cap.elements);
        durs.push(cap.durMs);
        counts.push(cap.count);
        if (panel === 'shown' && k === 0) sampleShown = cap.sampleArgs;
        await page.close();
      }
      row[panel] = {
        elements: median(dropWarmup(elements)),
        durMs: median(dropWarmup(durs)),
        count: median(dropWarmup(counts)),
      };
    }

    console.log(
      '  ' +
        [pad('panel', 8), pad('recalcElements', 16), pad('recalcDur(ms)', 14), pad('nEvents', 8)].join(
          ' ',
        ),
    );
    for (const panel of ['shown', 'hidden'] as const) {
      const r = row[panel];
      console.log(
        '  ' +
          [pad(panel, 8), pad(f(r.elements), 16), pad(f(r.durMs, 1), 14), pad(f(r.count), 8)].join(
            ' ',
          ),
      );
    }
    console.log(
      `  Δ shown−hidden: recalcElements=${f(row.shown.elements - row.hidden.elements)}  recalcDur=${f(
        row.shown.durMs - row.hidden.durMs,
        1,
      )}ms`,
    );
    console.log(`  (svg pattern subtree ≈ 12–20k nodes; whole panel ≈ 440k. Compare against those.)`);
    console.log('  sample UpdateLayoutTree args (verify elementCount field):');
    console.log('    ' + JSON.stringify(sampleShown));

    await context.close();

    // GUARD: the panel must add ~no style recalc on switch (fix gives single digits;
    // pre-fix was ~85,635). Threshold well above measurement noise, far below the bug.
    expect(row.shown.elements - row.hidden.elements).toBeLessThan(2000);
  }
});
