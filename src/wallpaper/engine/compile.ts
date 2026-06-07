import type { UnitTemplate, CompiledUnit } from '../types';
import { basisToMatrix, conjugateByBasis } from '../affine';
import { getGroup } from '../groups';

/**
 * Extract the geometric core from a UnitTemplate.
 *
 * The symmetry ops live on the wallpaper group (groups.ts) as coset reps in
 * fractional (lattice-basis) coordinates. Here we conjugate them by the template's
 * concrete basis to get the XY ops the tiling engine applies:
 *   opXY = B ∘ opFrac ∘ B⁻¹.
 * This keeps the group swappable data — templates reference a group rather than
 * inlining per-pattern matrices.
 */
export const compileUnit = (template: UnitTemplate): CompiledUnit => {
  const group = getGroup(template.group);
  const basisMatrix = basisToMatrix(template.basis);
  const opsInCellXy = group.cosetReps.map((op) =>
    conjugateByBasis(basisMatrix, op),
  );
  return {
    basis: template.basis,
    opsInCellXy,
    regionXy: template.regionXy,
  };
};
