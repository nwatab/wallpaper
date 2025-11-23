import { Motif, Vector2D } from '@/lib/models';

export type FundamentalRegion = {
  motifs: Motif[];
  tileVectors: [Vector2D, Vector2D];
  regionType:
    | 'Parallelogram'
    | 'Rectangle'
    | 'Square'
    | 'HexagonalParallelogram';
};
