export class Vector2D {
  constructor(public x: number, public y: number) {}

  /**
   * Vector addition.
   * @param other The vector to add.
   * @returns A new vector which is the sum of this vector and the given vector.
   */
  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }
  /**
   * Scalar multiplication.
   * @param scalar The scalar to multiply with.
   * @returns A new vector which is the result of multiplying this vector by the given scalar.
   */
  scale(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Normalizes the vector. If the vector is zero-length, returns null.
   * @returns A new vector which is the normalized version of this vector, or null if this vector is zero-length.
   */
  normalize(): Vector2D | null {
    const len = this.length();
    if (len === 0) {
      return null;
    }
    return new Vector2D(this.x / len, this.y / len);
  }
  dot(other: Vector2D): number {
    return this.x * other.x + this.y * other.y;
  }
  angle(other: Vector2D): number | null {
    if (this.length() === 0 || other.length() === 0) {
      return null;
    }
    return Math.acos(this.dot(other) / (this.length() * other.length()));
  }
  getElements(): [number, number] {
    return [this.x, this.y];
  }
  projectToX(): number {
    return this.x;
  }
  projectToY(): number {
    return this.y;
  }
}
