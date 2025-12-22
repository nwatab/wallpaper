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

  // pm群向け: 基本領域 u∈[0,0.5], v∈[0,1] 内のモチーフ
  // 垂直反射によって美しいパターンが生まれるデザイン
  'motif-pm-leaf': `
    <g>
      <!-- 基本領域の境界 -->
      <rect x="0" y="0" width="0.5" height="1" fill="none" stroke="gray" stroke-width="0.01" opacity="0.3"/>
      
      <!-- 葉っぱ型のモチーフ -->
      <path d="M 0.1 0.2 Q 0.4 0.15 0.45 0.4 Q 0.4 0.65 0.1 0.6 Q 0.25 0.4 0.1 0.2" 
            fill="lightgreen" stroke="darkgreen" stroke-width="0.02"/>
      
      <!-- 葉の中心線 -->
      <path d="M 0.1 0.2 Q 0.275 0.4 0.1 0.6" 
            fill="none" stroke="darkgreen" stroke-width="0.015"/>
      
      <!-- 小さな花 -->
      <circle cx="0.2" cy="0.8" r="0.03" fill="pink" stroke="red" stroke-width="0.01"/>
      <circle cx="0.15" cy="0.82" r="0.015" fill="yellow"/>
      <circle cx="0.25" cy="0.82" r="0.015" fill="yellow"/>
      <circle cx="0.2" cy="0.75" r="0.015" fill="yellow"/>
      <circle cx="0.2" cy="0.85" r="0.015" fill="yellow"/>
      
      <!-- 装飾的な曲線 -->
      <path d="M 0.05 0.1 Q 0.3 0.05 0.4 0.1" 
            fill="none" stroke="blue" stroke-width="0.02"/>
      <path d="M 0.05 0.9 Q 0.3 0.95 0.4 0.9" 
            fill="none" stroke="blue" stroke-width="0.02"/>
    </g>
  `,
};
