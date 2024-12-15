import { Renderer } from './Renderer';
import { Circle, Matrix, Motif, Rectangle, Shape } from '@/models';
import { Vector2D } from '@/models';
import { FundamentalRegion } from '@/types';

export class SVGRenderer implements Renderer {
  private svgContainer: SVGSVGElement;

  constructor(svgContainer: SVGSVGElement) {
    this.svgContainer = svgContainer;
  }

  setTileSize(tileSize: number): void {
    // ロジカルなサイズが1x1の場合
    this.svgContainer.setAttribute('viewBox', '0 0 1 1');
    this.svgContainer.setAttribute('width', `${tileSize}px`);
    this.svgContainer.setAttribute('height', `${tileSize}px`);
    // アスペクト比を維持
    this.svgContainer.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  renderMotif(motif: Motif): void {
    motif.shapes.forEach((shape) => {
      const element = this.renderShape(shape);
      this.svgContainer.appendChild(element);
    });
  }

  renderFundamentalRegion(fundamentalRegion: FundamentalRegion): void {
    const group = this.createGroupFromFundamentalRegion(fundamentalRegion);
    this.svgContainer.appendChild(group);
  }

  renderTilesWithDefs(
    fundamentalRegion: FundamentalRegion,
    tileVectors: Vector2D[],
    id: string = 'fundamental-region',
  ): void {
    // 1. <defs> 要素を取得または作成
    const defs = this.getOrCreateDefsElement();

    // 既に同じ id の定義が存在する場合は削除
    const existingDef = defs.querySelector(`#${id}`);
    if (existingDef) {
      defs.removeChild(existingDef);
    }

    // 2. fundamentalRegion を <defs> 内に定義
    const group = this.createGroupFromFundamentalRegion(fundamentalRegion);
    group.setAttribute('id', id);
    defs.appendChild(group);

    // 3. tileVectors に基づいて <use> 要素を配置
    tileVectors.forEach((vector) => {
      const useElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use',
      );
      useElement.setAttributeNS(
        'http://www.w3.org/1999/xlink',
        'href',
        `#${id}`,
      );

      const transform = `translate(${vector.x}, ${vector.y}) scale(64)`;
      useElement.setAttribute('transform', transform);

      this.svgContainer.appendChild(useElement);
    });
  }

  private createGroupFromFundamentalRegion(
    fundamentalRegion: FundamentalRegion,
  ): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    fundamentalRegion.motifs.forEach((motif) => {
      motif.shapes.forEach((shape) => {
        const svgElement = this.renderShape(shape);
        group.appendChild(svgElement);
      });
    });

    return group;
  }

  private renderRectangle(rect: Rectangle): SVGRectElement {
    const svgRect = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect',
    );
    svgRect.setAttribute('x', rect.x.toString());
    svgRect.setAttribute('y', rect.y.toString());
    svgRect.setAttribute('width', rect.width.toString());
    svgRect.setAttribute('height', rect.height.toString());
    svgRect.setAttribute('fill', rect.fill);

    if (!rect.transformMatrix.isIdentity()) {
      const transformAttr = this.matrixToTransformAttribute(
        rect.transformMatrix,
      );
      svgRect.setAttribute('transform', transformAttr);
    }
    return svgRect;
  }

  private renderShape(shape: Shape) {
    if (shape instanceof Rectangle) {
      return this.renderRectangle(shape);
    } else if (shape instanceof Circle) {
      return this.renderCircle(shape);
    } else {
      throw new Error('Unsupported shape type');
    }
  }

  private renderCircle(circle: Circle): SVGCircleElement {
    const svgCircle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    svgCircle.setAttribute('cx', circle.cx.toString());
    svgCircle.setAttribute('cy', circle.cy.toString());
    svgCircle.setAttribute('r', circle.r.toString());
    svgCircle.setAttribute('fill', circle.fill);

    if (!circle.transformMatrix.isIdentity()) {
      const transformAttr = this.matrixToTransformAttribute(
        circle.transformMatrix,
      );
      svgCircle.setAttribute('transform', transformAttr);
    }
    return svgCircle;
  }

  private matrixToTransformAttribute(matrix: Matrix): string {
    const {
      a11: a,
      a21: b,
      a12: c,
      a22: d,
      a13: e,
      a23: f,
    } = matrix.getElements();
    return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  }

  // <defs> 要素を取得または作成
  private getOrCreateDefsElement(): SVGDefsElement {
    let defs = this.svgContainer.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgContainer.prepend(defs);
    }
    return defs;
  }

  // 描画をクリア
  clear(): void {
    while (this.svgContainer.firstChild) {
      this.svgContainer.removeChild(this.svgContainer.firstChild);
    }
  }
}
