import { Motif } from '@/lib/models';
import { FundamentalRegion } from '@/lib/types';
export interface Renderer {
  renderMotif(motif: Motif): void;
  renderFundamentalRegion(fundamentalRegion: FundamentalRegion): void;
}
