import { describe, it, expect } from 'vitest';
import { toggleSets } from './shapeFamilies';
import snapshot from './__fixtures__/toggleSets.snapshot.json';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION-2 HARD GATE. Extracting memberPlacements() out of buildToggleSets is a
// refactor, NOT a purely additive change. This pins the toggle-set output (member
// groups, alignment matrices, and the placed shape-motif geometry) byte-for-byte
// against the snapshot captured from the pre-extraction implementation. If the
// extraction ever changes a single placed coordinate or alignment, this fails.
// ─────────────────────────────────────────────────────────────────────────────

describe('memberPlacements extraction equivalence', () => {
  it('toggleSets() output is byte-identical to the pre-refactor snapshot', () => {
    const live = toggleSets().map((s) => ({
      id: s.id,
      lattice: s.lattice,
      reference: s.reference,
      discriminator: s.discriminator,
      members: s.members.map((m) => ({
        group: m.group,
        alignXy: m.alignXy,
        placedMotif: m.placedMotif,
      })),
    }));
    expect(live).toEqual(snapshot);
  });
});
