import { Motif } from '@/models';
import { FundamentalRegion } from '@/types';
export interface Renderer {
  renderMotif(motif: Motif): void;
  renderFundamentalRegion(fundamentalRegion: FundamentalRegion): void;
}
