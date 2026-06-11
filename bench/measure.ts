// Non-invasive measurement helpers. All pattern selection is done with an in-page
// element.click() so it works regardless of device/panel visibility (on mobile the
// control panel is off-canvas) — we are measuring render cost, not hit-testing.
import type { CDPSession, Page } from '@playwright/test';
import { PAN_DISTANCE_PX, PAN_FRAMES, SETTLE_MS } from './matrix';

// CSS override that neutralizes attribute-based clips at runtime (clip=off). The renderer
// emits `<g clip-path="url(#fr-clip-…)">`; CSS overrides SVG presentation attributes, so
// this removes them without touching src/. Injected at document-start so it covers every
// render (initial + every switch).
export const CLIP_OFF_CSS = '*[clip-path]{clip-path:none !important;}';

export const injectClipOff = async (page: Page): Promise<void> => {
  await page.addInitScript((css) => {
    const apply = () => {
      const style = document.createElement('style');
      style.id = '__bench_clip_off';
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  }, CLIP_OFF_CSS);
};

// Hide the control panel (the only <aside>) at document-start — same non-invasive injection
// approach as clip-off. display:none excludes the panel's ~440k nodes from layout / style-recalc
// / paint while leaving them in the DOM, so whole-doc domNodes is UNCHANGED (a control showing
// node count is constant) while any FCP/pan/switch improvement isolates the panel's render cost.
// Pattern selection still works: HTMLElement.click() fires on a display:none button.
export const injectPanelHidden = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const apply = () => {
      const style = document.createElement('style');
      style.id = '__bench_panel_hidden';
      style.textContent = 'aside{display:none !important;}';
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  });
};

export type NodeMetrics = {
  domNodes: number;
  layoutCount: number;
  recalcStyleCount: number;
};

export const getNodeMetrics = async (client: CDPSession): Promise<NodeMetrics> => {
  const { metrics } = (await client.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  const get = (name: string) =>
    metrics.find((m) => m.name === name)?.value ?? NaN;
  return {
    domNodes: get('Nodes'),
    layoutCount: get('LayoutCount'),
    recalcStyleCount: get('RecalcStyleCount'),
  };
};

// Cumulative main-thread JS execution time (CDP ScriptDuration, seconds → ms). Snapshot
// before/after the switch; the delta is the scripting (React reconciliation + innerHTML parse)
// portion — which, subtracted from wall-clock switch latency, isolates browser-render cost.
export const getScriptDurationMs = async (client: CDPSession): Promise<number> => {
  const { metrics } = (await client.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  return (metrics.find((m) => m.name === 'ScriptDuration')?.value ?? NaN) * 1000;
};

// first-contentful-paint of the app shell (client-rendered Next export), via the in-page
// paint timeline. This is the shell paint, not the pattern paint — a secondary signal.
export const getFcpMs = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fromBuffer = performance
          .getEntriesByType('paint')
          .find((e) => e.name === 'first-contentful-paint');
        if (fromBuffer) return resolve(fromBuffer.startTime);
        const obs = new PerformanceObserver((list) => {
          const e = list
            .getEntries()
            .find((x) => x.name === 'first-contentful-paint');
          if (e) {
            obs.disconnect();
            resolve(e.startTime);
          }
        });
        obs.observe({ type: 'paint', buffered: true });
        setTimeout(() => resolve(NaN), 5000);
      }),
  );

// Wait until the wallpaper SVG has painted content, then flush two rAFs + a fixed settle.
export const waitStable = async (page: Page, settleMs = SETTLE_MS): Promise<void> => {
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('#wallpaper svg');
      return (
        !!svg &&
        svg.querySelectorAll('path,polygon,rect,circle,use,line').length > 0
      );
    },
    { timeout: 30_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
  await page.waitForTimeout(settleMs);
};

// Select a pattern by title and resolve with click→stable-paint latency (ms), measured
// entirely in-page. "Stable" = the wallpaper SVG markup is unchanged for 3 consecutive
// frames (a DOM-settle proxy for paint completion).
export const selectPatternTimed = (page: Page, title: string): Promise<number> =>
  page.evaluate(
    (t) =>
      new Promise<number>((resolve) => {
        const btn = document.querySelector<HTMLButtonElement>(
          `button[title="${t}"]`,
        );
        const wall = document.querySelector('#wallpaper');
        if (!btn || !wall) return resolve(NaN);
        const t0 = performance.now();
        btn.click();
        let stable = 0;
        let last = '';
        let frames = 0;
        const tick = () => {
          frames++;
          const svg = wall.querySelector('svg');
          const painted = svg?.querySelectorAll(
            'path,polygon,rect,circle,use,line',
          );
          const sig = svg
            ? `${svg.innerHTML.length}:${painted?.length ?? 0}`
            : '';
          if (svg && (painted?.length ?? 0) > 0 && sig === last) {
            if (++stable >= 3) return resolve(performance.now() - t0);
          } else {
            stable = 0;
            last = sig;
          }
          if (frames > 600) return resolve(performance.now() - t0); // safety
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    title,
  );

// Untimed in-page click (used to return to the baseline before a warm switch).
export const clickPattern = async (page: Page, title: string): Promise<void> => {
  await page.evaluate((t) => {
    document.querySelector<HTMLButtonElement>(`button[title="${t}"]`)?.click();
  }, title);
};

// CDP Tracing around a single action; returns summed RasterTask + Paint durations (ms).
// Paint = main-thread paint setup, RasterTask = raster worker — together the paint/raster
// cost the container-pan is blind to.
export const traceRaster = async <T>(
  client: CDPSession,
  action: () => Promise<T>,
): Promise<{ rasterMs: number; result: T }> => {
  const events: { name: string; dur?: number }[] = [];
  // CDPSession event payloads are loosely typed; narrow at use.
  const onData = (d: unknown) => {
    const value = (d as { value?: { name: string; dur?: number }[] }).value;
    if (value) for (const e of value) events.push(e);
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
  const rasterMs =
    events
      .filter((e) => e.name === 'RasterTask' || e.name === 'Paint')
      .reduce((s, e) => s + (typeof e.dur === 'number' ? e.dur : 0), 0) / 1000;
  return { rasterMs, result };
};

// Composite/commit pan: translate the wallpaper content over PAN_FRAMES rAF frames and
// record consecutive-frame deltas (ms). NOT a paint/clip indicator — it composites a
// (possibly promoted) layer; it captures the "feels heavy" commit cost directly.
export const runPan = (page: Page): Promise<number[]> =>
  page.evaluate(
    ({ frames, dist }) =>
      new Promise<number[]>((resolve) => {
        const el =
          (document.querySelector('#wallpaper > div') as HTMLElement | null) ??
          (document.querySelector('#wallpaper') as HTMLElement | null);
        if (!el) return resolve([]);
        const deltas: number[] = [];
        let i = 0;
        let last = performance.now();
        const step = (t: number) => {
          deltas.push(t - last);
          last = t;
          el.style.transform = `translateX(${(i / frames) * dist}px)`;
          i++;
          if (i <= frames) requestAnimationFrame(step);
          else {
            el.style.transform = '';
            resolve(deltas.slice(1)); // drop the baseline first delta
          }
        };
        requestAnimationFrame(step);
      }),
    { frames: PAN_FRAMES, dist: PAN_DISTANCE_PX },
  );

export const getDpr = (page: Page): Promise<number> =>
  page.evaluate(() => window.devicePixelRatio);

// Element count under #wallpaper only — isolates the rendered pattern from the panel's ~30
// gallery swatch SVGs (which dominate the whole-document CDP `Nodes` metric). This is the
// node count hypothesis 3 actually cares about.
export const getWallpaperNodeCount = (page: Page): Promise<number> =>
  page.evaluate(() => document.querySelectorAll('#wallpaper *').length);
