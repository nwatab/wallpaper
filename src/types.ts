type FundamentalRegion =
  | {
      type: 'square';
      a: number;
    }
  | {
      type: 'recutangular';
      a: number;
      hbeight: number;
    }
  | {
      /** 平行四辺形 */
      type: 'oblique';
      a: number;
      b: number;
      theta: number;
    }
  | {
      /** 二等辺三角形 */
      type: 'isosceles_triangle';
      a: number;
      b: number;
    }
  | {
      /** 直角三角形 */
      type: 'right_triangle';
      a: number;
      b: number;
    }
  | {
      /** 正三角形 */
      type: 'equilateral_triangle';
      a: number;
    };

interface Group {}
