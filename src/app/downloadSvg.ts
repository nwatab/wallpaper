// Trigger a browser download of an SVG string. The ONLY DOM-touching part of export — the
// SVG building lives in pure, tested functions (src/wallpaper/export/exportSvg.ts).
export const downloadSvg = (svg: string, filename: string): void => {
  const name = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
