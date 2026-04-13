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

  // pg群向け: 基本領域 u∈[0,1], v∈[0,0.5] 内のモチーフ
  // グライド反射によって美しいパターンが生まれる矢印デザイン
  'motif-pg-arrow': `
    <g>
      <!-- 基本領域の境界 -->
      <rect x="0" y="0" width="1" height="0.5" fill="none" stroke="gray" stroke-width="0.01" opacity="0.3"/>
      
      <!-- メインの矢印 -->
      <path d="M 0.1 0.25 L 0.7 0.25 L 0.6 0.15 M 0.7 0.25 L 0.6 0.35" 
            fill="none" stroke="red" stroke-width="0.03" stroke-linecap="round"/>
      
      <!-- 矢印の胴体を太く -->
      <rect x="0.1" y="0.22" width="0.6" height="0.06" fill="red" rx="0.03"/>
      
      <!-- 矢印の先端 -->
      <path d="M 0.7 0.25 L 0.85 0.25 L 0.75 0.15 M 0.85 0.25 L 0.75 0.35 Z" 
            fill="red" stroke="red" stroke-width="0.02"/>
      
      <!-- 装飾的なドット -->
      <circle cx="0.2" cy="0.1" r="0.02" fill="blue"/>
      <circle cx="0.4" cy="0.1" r="0.02" fill="blue"/>
      <circle cx="0.6" cy="0.1" r="0.02" fill="blue"/>
      <circle cx="0.8" cy="0.1" r="0.02" fill="blue"/>
      
      <!-- 下部の装飾線 -->
      <path d="M 0.1 0.4 Q 0.3 0.45 0.5 0.4 Q 0.7 0.35 0.9 0.4" 
            fill="none" stroke="green" stroke-width="0.02"/>
      
      <!-- 小さな三角形の装飾 -->
      <path d="M 0.05 0.05 L 0.15 0.05 L 0.1 0.15 Z" fill="orange"/>
      <path d="M 0.85 0.45 L 0.95 0.45 L 0.9 0.35 Z" fill="orange"/>
    </g>
  `,
  // cm群向け: 正三角形 fundamental region（uv三角形）内の青海波
  // 注意: basis が斜交なので、xyで“円弧”に見せるには uv側で楕円弧にしておく
  // ここでは G = M^T M = [[1,-1/2],[-1/2,1]] の固有分解から
  // rx = r*sqrt(2), ry = r*sqrt(2/3), rotation = 45° を使用
  // cm群向け: 正三角形 fundamental region（uv三角形）内の青海波
  'motif-cm-seigaiha': `
  <g>
    <g fill="none" stroke="black" stroke-width="0.04"
       stroke-linecap="butt" stroke-linejoin="round">

      <!-- (0,0)中心：r1=0.431847, r2=0.587898, r3=0.743949, r4=0.90（等間隔 Δ=0.156051） -->
      <path d="M 0.431847 0
               A 0.610724 0.352602 45 0 1 0.431847 0.431847" />
      <path d="M 0.587898 0
               A 0.831413 0.480017 45 0 1 0.587898 0.587898" />
      <!-- 下側円弧端点(0.744949,0)より 0.001 だけ内側（ギリギリ乗らない） -->
      <path d="M 0.743949 0
               A 1.052103 0.607432 45 0 1 0.743949 0.743949" />

      <!-- 最外周（既存のまま） -->
      <path d="M 0.90 0
               A 1.272792 0.734847 45 0 1 0.90 0.90" />

      <!-- 下側中心(1/2,-sqrt(3)/2)側：r=0.90（既存のまま） -->
      <path d="M 0.255051 0
               A 1.272792 0.734847 45 0 0 0.744949 0" />
    </g>
  </g>
`,

  // pmm群向け: 基本領域 [0,0.5]x[0,0.5] 内のモチーフ
  // 2方向の反射で(0.5,0.5)を中心とした4弁の花模様が生まれる
  'motif-pmm-petal': `
  <g>
    <!-- Petal from lattice point (0,0) to cell centre (0.5,0.5),
         symmetric about the y=x diagonal.
         When reflected by the 4 pmm ops, four petals converge at each
         cell centre and four petal tips meet at each lattice point. -->
    <path d="M 0 0 Q 0.4 0.1 0.5 0.5 Q 0.1 0.4 0 0 Z"
          fill="#88aaee" stroke="#224488" stroke-width="0.015"/>
    <!-- Accent circle at cell centre (shared by all 4 copies) -->
    <circle cx="0.5" cy="0.5" r="0.06" fill="#cc4422"/>
    <!-- Accent circle at lattice point (shared between neighbouring cells) -->
    <circle cx="0" cy="0" r="0.04" fill="#224488"/>
  </g>
`,

  // pmg群向け: 基本領域 [0,0.5]x[0,0.5] 内のモチーフ
  // L字ブラケット形。垂直鏡映 (x=0.5) と水平グライド (y=0.5, 平行移動 0.5) の組み合わせを示す。
  //
  // 4つのオペレーションがユニットセルをタイルする様子:
  //
  //   Op1 (identity)  |  Op2 (mirror x=0.5)      ⌐  |  ¬
  //   ─────────────────────────────────────     ──────────
  //   Op4 (rot 180°)  |  Op3 (glide)             ┐  |  ┌
  //
  // アクセントドット (0.12, 0.41) は y 対称性を破り、グライドと純粋な水平鏡映の違いを可視化する。
  'motif-pmg': `
<g>
  <!-- L-bracket in fundamental region [0,0.5]x[0,0.5] -->
  <!-- horizontal top bar -->
  <line x1="0.07" y1="0.12" x2="0.43" y2="0.12" stroke="#1a1a2e" stroke-width="0.04" stroke-linecap="round"/>
  <!-- vertical bar at right end going down -->
  <line x1="0.43" y1="0.12" x2="0.43" y2="0.33" stroke="#1a1a2e" stroke-width="0.04" stroke-linecap="round"/>
  <!-- accent dot near bottom-left: breaks y-symmetry, marks orientation -->
  <circle cx="0.12" cy="0.41" r="0.03" fill="#cc4422"/>
</g>
`,

  // cm群向け: 千鳥格子 (houndstooth)
  // 基本領域: 直角二等辺三角形 (0,0)-(0,1)-(1,1)、y=x で鏡映 (SVG y-down)
  // 4つの黒三角形で千鳥格子の「歯」を構成する (y-up設計を y_svg=1-y_math で変換済み)
  'motif-cm-houndstooth': `
  <g>
    <path d="M 0 0.5 L 0.5 0.5 L 0 0 Z" fill="black"/>
    <path d="M 0.5 0.75 L 0.25 0.5 L 0 0.5 Z" fill="black"/>
    <path d="M 0.5 1 L 0.5 0.75 L 0 0.5 Z" fill="black"/>
    <path d="M 0 1 L 0.25 1 L 0 0.75 Z" fill="black"/>
  </g>
`,
};
