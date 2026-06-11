# Render performance harness (Stage A)

Non-invasive Playwright harness that **measures the current SVG renderer** to locate the
mobile-jank bottleneck *before* any renderer change. Hypotheses, in priority order:
(1) clip-path cost, (2) overdraw, (3) DOM node count, (4) React re-render → full repaint.

```bash
npm run bench:render          # build static export, serve it, run the full matrix headless
BENCH_SKIP_BUILD=1 npm run bench:render   # reuse an existing out/ while iterating
npm run bench:guard           # run the render-regression guards (assert, fast)
```

## Regression guards (`bench:guard`)

Two assertion-backed specs lock in the gallery swatch over-invalidation fix
(`SwatchImage` memo) so a future change can't silently reintroduce it:

- `diagnose-levels.bench.spec.ts` — node-identity: every swatch `<svg>` must
  **survive** a pattern switch (pre-fix: all recreated, 0/N).
- `diagnose-invalidation.bench.spec.ts` — CDP `UpdateLayoutTree.elementCount`:
  the panel-shown−hidden recalc Δ on a switch must stay **small** (pre-fix:
  ~85,635 spurious recalcs; with the fix: single digits).

Both drive the production static export via `playwright.diagnose.config.ts`.

Outputs:

- `bench/results/<ISO-timestamp>.json` — per-cell median + spread + env.
- A stdout summary table grouped by pattern, with the clip on→off raster deltas.

## Environment (faithful production paint)

`next.config.ts` sets `output:'export'`, so **`next start` does not work**. Instead the harness
runs `next build` (static export → `out/`) and serves it via `bench/serve-export.mjs`, mounted
under the app's `basePath` `/wallpaper`. This is the most faithful measurement of production
client paint: no `next dev` double-render, no dev instrumentation, no server runtime.

## Matrix

`pattern × clip ∈ {on,off} × device ∈ {desktop, mobile}` — knobs in `matrix.ts`.

| slot | pattern (`id`) | gallery title | why |
|---|---|---|---|
| (a) | `gen-p4m` | Computer-generated · p4m | clip-heavy glyph clipped to fundamental region |
| (b) | `cm-seigaiha-equilateral-triangle` | Seigaiha -- … | overdraw; **uses no clip → clip-delta must be ≈ 0** (sanity check) |
| (c) | `gen-cmm-quatrefoil` | Talavera quatrefoil interlace | dense, path-complex fill |
| (d) | `gen-p6m-shamsa` | Shamsa rosette | high-symmetry hex (p6m, 12 ops) → highest node count |

Patterns are selected by their **unique** gallery button `title=` via an in-page
`element.click()` (works even on mobile where the panel is off-canvas). No `src/` change.

- **clip=off** injects `*[clip-path]{clip-path:none!important}` at document-start. CSS overrides
  SVG presentation attributes, so it removes the renderer's `<g clip-path="url(#fr-clip-…)">`
  attribute clips without editing components.
- **mobile** uses the `Pixel 5` device descriptor (isMobile, hasTouch, real DPR ≈ 2.75) **plus**
  CDP `Emulation.setCPUThrottlingRate(4)`.

## Probes & how each maps to a hypothesis

The clip/overdraw hypotheses are **paint/raster** costs. A container-transform pan only
composites a (possibly promoted) layer and is blind to them — so raster is measured with CDP
Tracing at the two paint-heavy moments, and the pan is kept only as a separate commit-cost signal.

| probe | capture | tests |
|---|---|---|
| **initial-render raster** | CDP `Tracing` around the target's first paint on a fresh page; sum `RasterTask`+`Paint` durations | clip (1), overdraw (2) |
| **switch raster + latency** | CDP `Tracing` around a warm baseline(p1)→target switch (the real M1 gallery path) | clip (1), overdraw (2), re-render (4) |
| `svgNodes` | in-page `#wallpaper *` element count — **isolates the pattern** from the panel's ~30 gallery swatch SVGs | node count (3) |
| `domNodes` / `layoutCount` / `recalcStyleCount` | CDP `Performance.getMetrics` after the target is stable (whole-document; `domNodes` is dominated by swatches — use `svgNodes` for the pattern, the cross-pattern `domNodes` delta still holds) | node count (3), re-render (4) |
| `fcpMs` | in-page `PerformanceObserver('paint')` (app-shell paint — secondary) | — |
| **composite/commit pan** | translate the SVG container ~200px over ~120 rAF frames; record frame deltas → p50/p95/max, count >16.7ms / >50ms | commit/compositing cost only — **not** paint/clip |

## Statistics

- `FRAME_K = 7` (domNodes, fcp, pan), `RASTER_K = 3` (raster + latency). Run 1 is discarded
  (warmup) everywhere; we report **median + IQR + min/max** over the rest. No single samples.
- The clip on→off delta is reported at the **initial-render and switch** moments (where clip
  actually costs), not the pan (≈0 there by construction).

## Caveats (also recorded in each result's `env.note`)

- The clip on→off delta is a **LOWER BOUND** on clip cost: removing the clip can *increase*
  painted area, partially offsetting the removed clip-stencil cost. The raster trace helps
  separate mask vs fill.
- CPU throttling does **not** throttle the GPU; DPR is set correctly so raster *area* is
  representative, but fill-rate-bound paint is under-estimated. Real-device validation
  (CDP over USB / device lab) is a separate follow-up.
- `panP95` is a composite/commit-cost signal, **not** a paint or clip indicator.

## Stage B (not started — separate gate)

Only if Stage A implicates node count or paint: add a `<pattern>`-based renderer behind a flag
and re-run this identical harness to compare.

## Panel probe: scripting vs render split

The panel probe also snapshots CDP `ScriptDuration` around the warm switch:

- `swScript` = ScriptDuration delta = the **React reconciliation + `innerHTML` parse** share.
- `swRender` = `swLat − swScript` = the **browser layout/paint** remainder.

Because `display:none` leaves React's tree identical (the panel still mounts; only the browser
skips its layout/paint), a **near-zero `swScript` shown−hidden delta with a large `swRender`
delta** pins the panel's switch cost on browser render, not on React reconciliation.

