import { describe, it, expect } from 'vitest';
import { solveLambda, buildPentagon, buildNestedPentagons } from '../geometry/solver';
import { JI_SIDE_RATIOS, JI_FREQ_RATIOS } from '../geometry/constants';

describe('Geometry Solver', () => {
  describe('solveLambda', () => {
    it('should converge to the known solution λ* ≈ 0.7362928962', () => {
      const lam = solveLambda();
      expect(lam).toBeCloseTo(0.7362928962, 8);
    });

    it('should satisfy the closure equation: Σ arcsin(λ·rᵢ) = π', () => {
      const lam = solveLambda();
      const sum = JI_SIDE_RATIOS.reduce(
        (acc, r) => acc + Math.asin(lam * r),
        0,
      );
      expect(sum).toBeCloseTo(Math.PI, 10);
    });
  });

  describe('buildPentagon', () => {
    const pent = buildPentagon(1, 440, 0);

    it('should produce exactly 5 vertices', () => {
      expect(pent.vertices).toHaveLength(5);
    });

    it('should produce exactly 5 edges', () => {
      expect(pent.edges).toHaveLength(5);
    });

    it('should have all vertices on the circumscribed circle (R=1)', () => {
      for (const v of pent.vertices) {
        const dist = Math.hypot(v.x, v.y);
        expect(dist).toBeCloseTo(1.0, 8);
      }
    });

    it('should have side lengths proportional to JI ratios', () => {
      const lengths = pent.edges.map(e => e.length);
      const longest = lengths[0]; // side ratio 1 should be longest
      for (let i = 0; i < 5; i++) {
        const ratio = lengths[i] / longest;
        expect(ratio).toBeCloseTo(JI_SIDE_RATIOS[i], 8);
      }
    });

    it('should have internal angles summing to 540°', () => {
      const vertices = pent.vertices;
      let angleSum = 0;
      for (let i = 0; i < 5; i++) {
        const prev = vertices[(i - 1 + 5) % 5];
        const curr = vertices[i];
        const next = vertices[(i + 1) % 5];
        const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
        const v2 = { x: next.x - curr.x, y: next.y - curr.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const cross = v1.x * v2.y - v1.y * v2.x;
        const angle = Math.atan2(Math.abs(cross), dot);
        angleSum += angle;
      }
      expect(angleSum * (180 / Math.PI)).toBeCloseTo(540, 4);
    });

    it('should assign correct JI frequencies to edges', () => {
      for (let i = 0; i < 5; i++) {
        const expectedFreq = 440 * JI_FREQ_RATIOS[i];
        expect(pent.edges[i].frequency).toBeCloseTo(expectedFreq, 6);
      }
    });

    it('should have unit-length outward normals', () => {
      for (const edge of pent.edges) {
        const len = Math.hypot(edge.normal.x, edge.normal.y);
        expect(len).toBeCloseTo(1, 10);
      }
    });

    it('should have outward-pointing normals (dot with centroid→midpoint > 0)', () => {
      const cx = pent.vertices.reduce((s, v) => s + v.x, 0) / 5;
      const cy = pent.vertices.reduce((s, v) => s + v.y, 0) / 5;
      for (const edge of pent.edges) {
        const mx = (edge.p1.x + edge.p2.x) / 2;
        const my = (edge.p1.y + edge.p2.y) / 2;
        const dot =
          edge.normal.x * (mx - cx) + edge.normal.y * (my - cy);
        expect(dot).toBeGreaterThan(0);
      }
    });
  });

  describe('buildNestedPentagons', () => {
    it('should produce the requested number of nesting levels', () => {
      const result = buildNestedPentagons(100, 440, 3, 0.5);
      expect(result).toHaveLength(3);
    });

    it('should scale circumradius by k per level', () => {
      const k = 0.5;
      const result = buildNestedPentagons(100, 440, 3, k);
      for (let i = 0; i < 3; i++) {
        expect(result[i].circumradius).toBeCloseTo(100 * Math.pow(k, i), 6);
      }
    });

    it('should transpose frequencies by 1/k per level', () => {
      const k = 0.5;
      const result = buildNestedPentagons(100, 440, 3, k);
      // Edge 0 frequencies: 440, 880, 1760
      for (let i = 0; i < 3; i++) {
        const expectedFreq = 440 * Math.pow(1 / k, i);
        expect(result[i].edges[0].frequency).toBeCloseTo(expectedFreq, 4);
      }
    });

    it('inner pentagons should be strictly smaller', () => {
      const result = buildNestedPentagons(100, 440, 4, 0.5);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].circumradius).toBeLessThan(result[i - 1].circumradius);
      }
    });

    it('should support alternative scales (e.g. Japanese In scale)', async () => {
      const { SCALES } = await import('../geometry/constants');
      const pent = buildPentagon(100, 440, 0, SCALES.japanese);
      expect(pent.edges).toHaveLength(5);
      expect(pent.edges[0].label).toContain('Root');
      expect(pent.edges[1].label).toContain('Min 2nd');
      expect(pent.edges[1].frequency).toBeCloseTo(440 * (16 / 15), 4);
    });

    it('should support 12 nested pentagons with harmonic linear spacing', () => {
      const result = buildNestedPentagons(300, 440, 12, -1);
      expect(result).toHaveLength(12);
      expect(result[0].circumradius).toBeCloseTo(300, 4);
      // Innermost radius should be >= 20px for clear visibility and clickability
      expect(result[11].circumradius).toBeGreaterThanOrEqual(20);
      // Radii should decrease monotonically
      for (let i = 1; i < result.length; i++) {
        expect(result[i].circumradius).toBeLessThan(result[i - 1].circumradius);
        // Frequency should increase as radius decreases (f ∝ 1/r)
        expect(result[i].edges[0].frequency).toBeGreaterThan(result[i - 1].edges[0].frequency);
      }
    });

    it('should construct valid 7-sided cyclic polygons (heptagons) for Persian Dastgahs', async () => {
      const { SCALES } = await import('../geometry/constants');
      expect(SCALES.shur).toBeDefined();
      expect(SCALES.chahargah).toBeDefined();
      expect(SCALES.segah).toBeDefined();

      const shurPoly = buildPentagon(200, 440, 0, SCALES.shur);
      expect(shurPoly.vertices).toHaveLength(7);
      expect(shurPoly.edges).toHaveLength(7);

      // Verify all 7 vertices lie on circumradius
      for (const v of shurPoly.vertices) {
        expect(Math.hypot(v.x, v.y)).toBeCloseTo(200, 6);
      }

      // Verify internal angles sum to (7 - 2) * 180 = 900 degrees
      const vertices = shurPoly.vertices;
      let angleSum = 0;
      for (let i = 0; i < 7; i++) {
        const prev = vertices[(i - 1 + 7) % 7];
        const curr = vertices[i];
        const next = vertices[(i + 1) % 7];
        const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
        const v2 = { x: next.x - curr.x, y: next.y - curr.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const cross = v1.x * v2.y - v1.y * v2.x;
        angleSum += Math.atan2(Math.abs(cross), dot);
      }
      expect(angleSum * (180 / Math.PI)).toBeCloseTo(900, 3);

      // Microtonal Koron pitch check: Shur 2nd is Koron (12/11)
      expect(shurPoly.edges[1].frequency).toBeCloseTo(440 * (12 / 11), 4);
      expect(shurPoly.edges[1].label).toContain('Koron');
    });

    it('should construct valid heptagons for Turkish Makams and Western modes', async () => {
      const { SCALES } = await import('../geometry/constants');
      const bayati = buildPentagon(200, 440, 0, SCALES.bayati);
      expect(bayati.edges).toHaveLength(7);

      const dorian = buildPentagon(200, 440, 0, SCALES.dorian);
      expect(dorian.edges).toHaveLength(7);
      // Dorian has natural 6th (5/3) and min 7th (9/5)
      expect(dorian.edges[5].frequency).toBeCloseTo(440 * (5 / 3), 4);
      expect(dorian.edges[6].frequency).toBeCloseTo(440 * (9 / 5), 4);

      const lydian = buildPentagon(200, 440, 0, SCALES.lydian);
      expect(lydian.edges[3].frequency).toBeCloseTo(440 * (45 / 32), 4); // Augmented 4th
    });
  });
});
