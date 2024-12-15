import { Motif } from '@/models';
import { randomSquareMotif } from '@/assets';
import { setAppState } from '@/app';
import { Renderer, SVGRenderer } from '@/renderers';

export class MotifGallery {
  private motifs: Motif[] = [randomSquareMotif];
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
    this.setupEventHandlers();
  }

  private render() {
    // モチーフを表示するHTMLを生成
    this.container.innerHTML = this.motifs
      .map(
        (motif, index) => `
        <div class="motif-preview" data-motif-index="${index}">
          ${this.renderMotifPreview(motif).outerHTML}
        </div>
      `,
      )
      .join('');
  }

  private renderMotifPreview(motif: Motif): SVGSVGElement {
    const svgSvgElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    svgSvgElement.setAttribute('viewBox', '0 0 1 1');
    const svgRenderer = new SVGRenderer(svgSvgElement);
    const motifPreview = new MotifPreview(svgRenderer);
    motifPreview.render(motif);
    return svgSvgElement;
  }

  private setupEventHandlers() {
    const motifItems = this.container.querySelectorAll('.motif-preview');
    motifItems.forEach((element) => {
      element.addEventListener('click', () => {
        const index = element.getAttribute('data-motif-index')!;
        const selectedMotif = this.motifs[parseInt(index)];
        // 状態を更新
        setAppState({ selectedMotif });
      });
    });
  }
}

class MotifPreview {
  private renderer: Renderer;
  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }
  render(motif: Motif) {
    this.renderer.renderMotif(motif);
  }
}
