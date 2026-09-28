import { describe, it, expect } from 'vitest';
import { solvePolygon } from '../geometry/solver';

describe('solvePolygon (robust solver)', () => {
  describe('input validation', () => {
    it('should reject N < 3', () => {
      const result = solvePolygon([1, 1]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 3');
    });

    it('should reject negative ratios', () => {
      const result = solvePolygon([1, -0.5, 0.8]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should reject NaN ratios', () => {
      const result = solvePolygon([1, NaN, 0.8]);
      expect(result.success).toBe(false);
    });

    it('should reject Infinity ratios', () => {
      const result = solvePolygon([1, Infinity, 0.8]);
      expect(result.success).toBe(false);
    });

    it('should reject zero ratios', () => {
      const result = solvePolygon([1, 0, 0.8]);
      expect(result.success).toBe(false);
    });
  });

  describe('valid polygons', () => {
    it('should solve equilateral triangle (N=3, equal ratios)', () => {
      const result = solvePolygon([1, 1, 1]);
      expect(result.success).toBe(true);
      expect(result.angles.length).toBe(3);
      // All angles should be equal: 2π/3
      for (const angle of result.angles) {
        expect(angle).toBeCloseTo(2 * Math.PI / 3, 6);
      }
    });

    it('should solve regular pentagon (N=5, equal ratios)', () => {
      const result = solvePolygon([1, 1, 1, 1, 1]);
      expect(result.success).toBe(true);
      for (const angle of result.angles) {
        expect(angle).toBeCloseTo(2 * Math.PI / 5, 6);
      }
    });

    it('should solve JI pentatonic (default ratios)', () => {
      const result = solvePolygon([1, 8 / 9, 4 / 5, 2 / 3, 3 / 5]);
      expect(result.success).toBe(true);
      expect(result.lambda).toBeCloseTo(0.7362928962, 6);
      expect(result.residual).toBeLessThan(1e-10);
    });

    it('should solve 7-sided polygon (heptagon for dastgah)', () => {
      // Shur scale ratios
      const result = solvePolygon([1, 11 / 12, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9]);
      expect(result.success).toBe(true);
      expect(result.angles.length).toBe(7);
      expect(result.vertices.length).toBe(7);
    });

    it('should normalize ratios > 1', () => {
      // Ratios > 1 should be normalized without error
      // Use a pentagon (N=5) so the polygon can close
      const result = solvePolygon([2, 1.8, 1.6, 1.4, 1.2]);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('normalized');
    });

    it('should warn about near-degenerate edges', () => {
      // One very small ratio
      const result = solvePolygon([1, 1, 0.01]);
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('degenerate') || w.includes('small'))).toBe(true);
    });
  });

  describe('closure verification', () => {
    it('should verify angle sum equals 2π', () => {
      const result = solvePolygon([1, 8 / 9, 4 / 5, 2 / 3, 3 / 5]);
      expect(result.success).toBe(true);
      const sum = result.angles.reduce((s, a) => s + a, 0);
      expect(sum).toBeCloseTo(2 * Math.PI, 8);
    });

    it('should verify all vertices lie on circumscribed circle', () => {
      const R = 250;
      const result = solvePolygon([1, 8 / 9, 4 / 5, 2 / 3, 3 / 5], R);
      expect(result.success).toBe(true);
      for (const v of result.vertices) {
        const dist = Math.hypot(v.x, v.y);
        expect(dist).toBeCloseTo(R, 6);
      }
    });

    it('should return edge lengths proportional to input ratios', () => {
      const result = solvePolygon([1, 0.9, 0.8, 0.7, 0.6]);
      expect(result.success).toBe(true);
      // Edge 0 should be longest, edge 4 shortest
      expect(result.edgeLengths[0]).toBeGreaterThan(result.edgeLengths[1]);
      expect(result.edgeLengths[1]).toBeGreaterThan(result.edgeLengths[2]);
      expect(result.edgeLengths[2]).toBeGreaterThan(result.edgeLengths[3]);
      expect(result.edgeLengths[3]).toBeGreaterThan(result.edgeLengths[4]);
      // Verify proportionality
      const ratio01 = result.edgeLengths[0] / result.edgeLengths[1];
      expect(ratio01).toBeCloseTo(1 / 0.9, 3);
    });
  });

  describe('convergence', () => {
    it('should converge within reasonable iterations', () => {
      const result = solvePolygon([1, 8 / 9, 4 / 5, 2 / 3, 3 / 5]);
      expect(result.iterations).toBeLessThan(60);
    });

    it('should achieve residual < 1e-10', () => {
      const result = solvePolygon([1, 8 / 9, 4 / 5, 2 / 3, 3 / 5]);
      expect(result.residual).toBeLessThan(1e-10);
    });
  });
});
