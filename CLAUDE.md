## Commands

```bash
npm run dev      # start Next.js dev server
npm run build    # production build
npm run lint     # ESLint
```

No test runner is configured.

## What This Project Does

A wallpaper group theory design simulator — it generates SVG wallpaper patterns by tiling a motif according to one of the 17 crystallographic wallpaper groups.

## Architecture: Fundamental Region → Unit Cell → Wallpaper

The pipeline mirrors the mathematical decomposition of a wallpaper group $G \cong P \ltimes L$ where $P$ is the point group (symmetry ops within a cell) and $L \cong \mathbb{Z}^2$ is the translation lattice.

The core pipeline lives in `src/wallpaper/`:

**Definitions:**

- **Fundamental Region**: The smallest region whose orbit under the wallpaper group fills the plane. Defined as a polygon in XY space (`regionXy`).
- **Unit Cell**: One translational period of the pattern — the parallelogram spanned by basis vectors **a** and **b**. Contains one or more copies of the fundamental region related by point group ops.
- **Point Group Ops** (`opsInCellXy`): The coset representatives of the lattice in the wallpaper group — isometries (rotations, reflections, glides) that map the fundamental region to fill the unit cell.
- **Motif**: An SVG design drawn in the fundamental region's XY space.
- **UnitTemplate**: Hand-authored data defining a specific wallpaper pattern variant.

```text
UnitTemplate (basis, regionXy, opsInCellXy, motifId)
    │
    │ Tile   (src/wallpaper/engine/tiling.ts)
    │         For each lattice cell (i,j) and each point group op g_k:
    │         transform = pose ∘ translate(i·a + j·b) ∘ g_k
    ▼
OrbitElement[] (affine transforms covering the viewport)
    │
    │ Render  (src/wallpaper/engine/render.ts)
    ▼
SVG string   (src/wallpaper/renderSvg.ts)  ← public API
```

**Key types** (`src/wallpaper/types.ts`):

- `UnitTemplate` — authored data: lattice `basis` (XY), `regionXy`, `opsInCellXy`, `motifId`
- `CompiledUnit` — the geometric core extracted from a template (basis, ops, region)
- `OrbitElement` — a single affine transform to apply to the motif SVG
- `Affine2D` — SVG `matrix(a b c d e f)` convention

**Coordinate system**: Everything is in XY (Euclidean) space. Lattice coordinates (i,j) are used only internally in the tiling step to enumerate cells — the lattice translation for cell (i,j) is simply the vector `i·a + j·b` in XY.

**Motifs** (`src/wallpaper/motifs.ts`): a map from `motifId` string → raw SVG string fragment, drawn in XY coordinates matching the fundamental region.

**Unit templates** (`src/wallpaper/unitTemplates.ts`): hand-authored `UnitTemplate` entries for each group variant (p1, p2, pm, pg, cm, …). Symmetry ops are expressed directly as Euclidean isometries (rotations about points, reflections across axes, glide reflections).

**Affine math** (`src/wallpaper/affine.ts`): pure functions — `compose`, `invert`, `applyToPoint`, `rotateDeg`, `scaleUniform`, `translateXy`, `toSvgMatrix`.

## Code Style Notes

- All engine code is pure functions (no classes, no mutation)
- `compose(m2, m1)` means m2 ∘ m1 (m1 applied first)
- SVG uses a Y-down coordinate system; rotations follow accordingly
