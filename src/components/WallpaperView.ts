import { appState, subscribe } from '@/app';
import { Tiling } from '@/tiling';
import { SVGRenderer } from '@/renderers';
import { Motif } from '@/models';

export class WallpaperView {
  private container: SVGSVGElement;
  private renderer: SVGRenderer;
  private resizeTimeout: number | undefined;

  constructor(containerId: string) {
    const svgElement = document.querySelector<SVGSVGElement>(`#${containerId}`);
    if (!svgElement) {
      throw new Error(`SVG element with id ${containerId} not found.`);
    }
    this.container = svgElement;
    this.renderer = new SVGRenderer(this.container);
    // 状態変更時に壁紙を再描画するようにリスナーを登録
    subscribe(() => this.render());
    window.addEventListener('resize', () => this.onWindowResize());
  }
  private onWindowResize(): void {
    // デバウンス処理：前回のタイムアウトをクリア
    if (this.resizeTimeout !== undefined) {
      clearTimeout(this.resizeTimeout);
    }
    // 350ms 後に再描画
    this.resizeTimeout = window.setTimeout(() => {
      this.render();
      this.resizeTimeout = undefined;
    }, 350);
  }

  private render() {
    const { selectedMotif, selectedWallpaperGroup } = appState;

    if (!selectedMotif || !selectedWallpaperGroup) {
      // 必要な情報が揃っていない場合は表示しない
      this.container.innerHTML =
        '<p>Please select a motif and a wallpaper group.</p>';
      return;
    }

    // 1. タイルベクトルを計算・取得
    selectedWallpaperGroup.computeTileVectors(selectedMotif);

    // 2. ファンダメンタル・リージョンを生成
    const fundamentalRegion =
      selectedWallpaperGroup.createFundamentalRegion(selectedMotif);
    // 3. タイリングを行い、壁紙全体を生成
    const tiling = new Tiling(window.innerWidth, window.innerHeight);

    const [tileVectorA, tileVectorB] = fundamentalRegion.tileVectors.map((v) =>
      v.scale(64),
    );
    const tileVectors = tiling.generateWallpaperMotif(tileVectorA, tileVectorB);

    // 4. 描画を実行
    this.renderer.clear(); // 既存の描画をクリア
    this.renderer.renderTilesWithDefs(fundamentalRegion, tileVectors);
  }
}
