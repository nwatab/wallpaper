import './styles/index.css';

window.onload = () => {
  // Get the main content element and its size
  const mainContent = document.getElementById('mainContent');
  if (!mainContent) throw new Error('Main content element not found.');

  const mainContentWidth = mainContent.clientWidth;
  const mainContentHeight = mainContent.clientHeight;
  console.log(mainContentHeight);

  // Get the source SVG and wallpaper SVG elements
  const sourceSvg = document.querySelector('#source-svg');
  if (!sourceSvg) throw new Error('Source SVG element not found.');

  const wallpaperSvg = document.querySelector('#wallpaper_svg');
  if (!wallpaperSvg) throw new Error('Wallpaper SVG element not found.');

  const defs = wallpaperSvg.querySelector('defs');
  if (!defs) throw new Error('SVG defs element not found.');

  // Clone the motif group from the source SVG
  const sourceGroup = sourceSvg.querySelector('#source-group');
  if (!sourceGroup) throw new Error('Source group not found in source SVG.');

  const motifGroup = sourceGroup.cloneNode(true) as SVGGElement;
  motifGroup.setAttribute('id', 'motif_group');
  defs.appendChild(motifGroup);

  // Get the size of the motif
  const bbox = motifGroup.getBBox();
  const motifWidth = bbox.width;
  const motifHeight = bbox.height;

  // Set the desired display size for each motif
  const motifDisplaySize = 64; // Adjust as needed

  // Calculate scaling factors to scale the motif to the desired display size
  const scaleFactorX = motifDisplaySize / motifWidth;
  const scaleFactorY = motifDisplaySize / motifHeight;

  // Calculate the number of motifs needed to fill the main content area
  const cols = Math.ceil(mainContentWidth / motifDisplaySize);
  const rows = Math.ceil(mainContentHeight / motifDisplaySize);

  // Create and position the motif instances using <use>
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const useEl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use',
      );
      useEl.setAttribute('href', '#motif_group');
      useEl.setAttribute(
        'transform',
        `translate(${x * motifDisplaySize}, ${
          y * motifDisplaySize
        }) scale(${scaleFactorX}, ${scaleFactorY})`,
      );
      wallpaperSvg.appendChild(useEl);
    }
  }

  // Set the viewBox to encompass all the motifs
  const viewBoxWidth = cols * motifDisplaySize;
  const viewBoxHeight = rows * motifDisplaySize;
  wallpaperSvg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
};
