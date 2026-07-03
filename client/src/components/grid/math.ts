/**
 * Periodic space math utilities.
 * Based on Seth Thompson's "Infinite Image Grids are Flat Toruses" article.
 *
 * Core concepts:
 * - Euclidean modulo (always positive remainder)
 * - Periodic boundary operator (maps any real number into a periodic interval)
 * - Shortest connection (finds minimal path in periodic space)
 */

/**
 * Euclidean modulo — always returns a positive remainder.
 * JavaScript's % is a truncated modulo that can return negative values.
 * mod(-1, 5) = 4 (not -1)
 */
export const mod = (x: number, n: number): number => ((x % n) + n) % n;

/**
 * Periodic boundary operator.
 * Maps any real number x into the half-open interval [a, b).
 * Intuitively: adds or subtracts (b-a) until x is in range.
 *
 * boundaryOp(x, a, b) = a + mod(x - a, b - a)
 *
 * When a=0: boundaryOp(x, 0, n) = mod(x, n) — equivalent to simple modulo.
 */
export const boundaryOp = (x: number, a: number, b: number): number =>
  a + mod(x - a, b - a);

/**
 * Shortest connection in periodic space.
 * Finds the minimal displacement vector from x to y in a periodic space of width w.
 *
 * In periodic space, every point has infinite equivalents.
 * The shortest path from x to y might cross a periodic boundary.
 *
 * Formula: boundaryOp(y - x, -w/2, w/2)
 *
 * This maps the displacement (y-x) into the interval [-w/2, w/2),
 * which represents the maximum travel in either direction before
 * the other way around becomes shorter.
 */
export const getShortestConnection = (x: number, y: number, w: number): number =>
  boundaryOp(y - x, -w / 2, w / 2);
