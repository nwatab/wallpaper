export class Matrix {
  private elements: number[];

  constructor(
    a11: number = 1,
    a21: number = 0,
    a12: number = 0,
    a22: number = 1,
    a13: number = 0,
    a23: number = 0,
  ) {
    this.elements = [a11, a21, a12, a22, a13, a23];
  }

  // 単位行列
  static identity(): Matrix {
    return new Matrix();
  }

  // 平行移動行列
  static translation(dx: number, dy: number): Matrix {
    return new Matrix(1, 0, 0, 1, dx, dy);
  }

  // スケーリング行列
  static scaling(sx: number, sy: number): Matrix {
    return new Matrix(sx, 0, 0, sy, 0, 0);
  }

  // 回転行列（ラジアン）
  static rotation(angle: number): Matrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Matrix(cos, sin, -sin, cos, 0, 0);
  }

  // シアー行列
  static shear(shx: number, shy: number): Matrix {
    return new Matrix(1, shx, shy, 1, 0, 0);
  }

  // 行列の乗算
  multiply(other: Matrix): Matrix {
    const [a11_1, a21_1, a12_1, a22_1, a13_1, a23_1] = this.elements;
    const [a11_2, a21_2, a12_2, a22_2, a13_2, a23_2] = other.elements;

    // 結果の行列要素計算
    const a11 = a11_1 * a11_2 + a12_1 * a21_2;
    const a21 = a21_1 * a11_2 + a22_1 * a21_2;
    const a12 = a11_1 * a12_2 + a12_1 * a22_2;
    const a22 = a21_1 * a12_2 + a22_1 * a22_2;
    const a13 = a11_1 * a13_2 + a12_1 * a23_2 + a13_1;
    const a23 = a21_1 * a13_2 + a22_1 * a23_2 + a23_1;

    return new Matrix(a11, a21, a12, a22, a13, a23);
  }

  // 点に変換を適用
  applyToPoint(point: [number, number]): [number, number] {
    const [a11, a21, a12, a22, a13, a23] = this.elements;
    const [x, y] = point;

    const newX = a11 * x + a12 * y + a13;
    const newY = a21 * x + a22 * y + a23;
    return [newX, newY];
  }

  // ベクトルに変換（平行移動なし）を適用
  applyToVector(vector: [number, number]): [number, number] {
    const [a11, a21, a12, a22] = this.elements;
    const [x, y] = vector;

    const newX = a11 * x + a12 * y;
    const newY = a21 * x + a22 * y;
    return [newX, newY];
  }

  // 逆行列の計算
  inverse(): Matrix | null {
    const [a11, a21, a12, a22, a13, a23] = this.elements;
    const det = a11 * a22 - a21 * a12;
    if (det === 0) {
      return null; // 逆行列なし
    }
    const a11Inv = a22 / det;
    const a21Inv = -a21 / det;
    const a12Inv = -a12 / det;
    const a22Inv = a11 / det;
    const a13Inv = (a12 * a23 - a22 * a13) / det;
    const a23Inv = (a21 * a13 - a11 * a23) / det;

    return new Matrix(a11Inv, a21Inv, a12Inv, a22Inv, a13Inv, a23Inv);
  }

  // 単位行列かどうか
  isIdentity(): boolean {
    const [a11, a21, a12, a22, a13, a23] = this.elements;
    return (
      a11 === 1 && a21 === 0 && a12 === 0 && a22 === 1 && a13 === 0 && a23 === 0
    );
  }

  // 行列の要素取得
  getElements(): {
    a11: number;
    a21: number;
    a12: number;
    a22: number;
    a13: number;
    a23: number;
  } {
    const [a11, a21, a12, a22, a13, a23] = this.elements;
    return {
      a11,
      a21,
      a12,
      a22,
      a13,
      a23,
    } as const;
  }

  // JSONシリアライズ用
  toJSON(): number[] {
    return this.elements;
  }
}
