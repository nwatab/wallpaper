export const motifs: Record<string, string> = {
  // cell全体向け（p1の例）
  'motif-a': `
    <g>
      <rect x="0" y="0" width="1" height="1" fill="none" stroke="black" stroke-width="0.02"/>
      <path d="M 0 0 L 1 1 M 1 0 L 0 1" fill="none" stroke="black" stroke-width="0.02"/>
      <circle cx="0.5" cy="0.5" r="0.08" fill="black"/>
    </g>
  `,

  // 三角形 { (0,0),(1,0),(0,1) } の内側向け（p2の例）
  // 三角形外に出ないように要素を配置している
  'motif-b': `
    <g>
      <path d="M 0 0 L 1 0 L 0 1 Z" fill="none" stroke="black" stroke-width="0.02"/>
      <circle cx="0.18" cy="0.18" r="0.05" fill="black"/>
      <circle cx="0.55" cy="0.15" r="0.04" fill="black"/>
      <circle cx="0.15" cy="0.55" r="0.04" fill="black"/>
      <path d="M 0.2 0.25 L 0.55 0.25 L 0.25 0.55 Z" fill="none" stroke="black" stroke-width="0.02"/>
    </g>
  `,
};
