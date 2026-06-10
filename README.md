Wallpaper group design tool

## Tests

```bash
pnpm test          # Vitest pure-TS suite (engine, conformal math, exports)
pnpm lint          # ESLint
pnpm build         # production build
```

### Warp regression guards

The Warp (WebGL) render is guarded at two levels. Both are independent oracles: they compare the
**gallery (SVG)** render against the **warp (GL)** render from rendered pixels / Node invariants —
never reconstructed from the shader's own `B`/cell-uv (which would launder a basis bug).

**`warp-affine-D.spec.ts` — the authoritative arbiter (real browser; Playwright).**
Requires a headless Chromium, so it does **NOT** run in the Node-only Vitest CI — run it locally /
in a browser-capable CI job whenever the warp render path changes (`glRenderer.ts`, `shader.ts`,
`latticeOverlay.ts`, `WarpPane.tsx`, the cell bake, or the lattice math).

```bash
pnpm install                 # @playwright/test + pngjs (devDeps)
pnpm test:e2e:install        # one-time: download Chromium
pnpm test:e2e                # boots `next dev`, runs e2e/ (non-square 1280×720 viewport on purpose)
```

It tiles a **chiral F** (dev-only `motif-dev-f`, dead-code-eliminated from prod) on
`{rect, oblique 70°, hex 60°}` and measures the 2×2 affine **D** mapping gallery-F → warp-F from
stroke orientations:
- **rotation-swept arbiter** — for every base × rotation `{0,30,45,90}`, asserts **D → I**
  (no residual shear) and **det = +1** via `matchFlip` = identity (no reflection). This is the
  green-bar definition of "warp faithfully reproduces the gallery".
- **teeth** — injects a known anisotropy (`__warpInjectAniso`, dev-only) and asserts the oracle
  reports **D ≠ I** past its own gate, proving it is not vacuous.
- `warp-flip-axis.spec.ts` corroborates chirality (mod-360 `matchFlip` = identity on all bases).
- `warp-path-diff.spec.ts` (low-value, flagged) guards that the empty 0/8 and 1-card pipelines
  share one render path.

**`warp-parity.test.ts` — the fast Node guard (Vitest CI).**
Pure-TS, runs in the normal `pnpm test` suite. Encodes the y-frame invariant the affine-D arbiter
proved on pixels: the two y-flips around the `B⁻¹` sampling must be balanced **per side** of it
(world-side even AND uv-side even), so they cancel without conjugating `B⁻¹`. (The retired
"total flips even" check only tracked the determinant and missed the frame split — see the test's
header.) This catches a re-introduced split flag instantly, without a browser.

`e2e/` is excluded from Vitest / `tsc` / ESLint config; the dev hooks it reads
(`window.__warpDebug`, `__warpInjectAniso`) are gated to non-production builds.
