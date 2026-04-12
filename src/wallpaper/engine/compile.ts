import type { UnitTemplate, CompiledUnit } from '../types';

/**
 * Extract the geometric core from a UnitTemplate.
 * With XY-native templates, this is a trivial reshape — no coordinate
 * conversion needed. Kept as a separate step to decouple template
 * metadata (id, label, motifId) from the tiling engine.
 */
export const compileUnit = (template: UnitTemplate): CompiledUnit => ({
  basis: template.basis,
  opsInCellXy: template.opsInCellXy,
  regionXy: template.regionXy,
});
