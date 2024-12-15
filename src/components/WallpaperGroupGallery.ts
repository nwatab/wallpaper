import { FundamentalRegion, WallpaperGroupType } from '@/types';
import { WallpaperGroup, P1Group } from '@/wallpaperGroups';
import { appState, setAppState } from '@/app';
import { Renderer, SVGRenderer } from '@/renderers';

export class WallpaperGroupGallery {
  private groups: { name: WallpaperGroupType; instance: WallpaperGroup }[] = [
    { name: 'p1', instance: new P1Group() },
    // 他の壁紙群を追加
  ];
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
    this.setupEventHandlers();
  }

  private render() {
    this.container.innerHTML = this.groups
      .map(
        ({ instance, name }, index) => `
        <div class="group-preview" data-group-index="${name}">
          ${this.renderGroupPreview(instance).outerHTML}
        </div>
      `,
      )
      .join('');
  }

  private renderGroupPreview(group: WallpaperGroup) {
    const svgSvgElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    svgSvgElement.setAttribute('viewBox', '0 0 1 1');
    const svgRenderer = new SVGRenderer(svgSvgElement);
    const groupPreview = new GroupPreview(svgRenderer);
    const fundamentalRegion = group.createFundamentalRegion(
      appState.selectedMotif,
    );
    groupPreview.render(fundamentalRegion);
    return svgSvgElement;
  }

  private setupEventHandlers() {
    const groupItems = this.container.querySelectorAll('.group-item');
    groupItems.forEach((element) => {
      element.addEventListener('click', () => {
        const selectedWallpaperGroupName = element.getAttribute(
          'data-group-index',
        ) as WallpaperGroupType;
        const group = this.groups.find(
          (group) => group.name === selectedWallpaperGroupName,
        )!;
        const selectedWallpaperGroup = group.instance;
        setAppState({ selectedWallpaperGroup });
      });
    });
  }
}

class GroupPreview {
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  render(fundamentalRegion: FundamentalRegion) {
    this.renderer.renderFundamentalRegion(fundamentalRegion);
  }
}
