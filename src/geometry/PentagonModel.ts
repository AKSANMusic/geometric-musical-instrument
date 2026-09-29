/**
 * PentagonModel.ts — Invariable 5-Sided Geometric Musical Object
 *
 * Enforces the core architectural invariant:
 * The instrument geometry ALWAYS consists of strictly 5 primary sides per ring,
 * regardless of whether the musical scale contains 5, 7, 12, or 24 notes.
 */

import type { Vec2 } from '../types';
import { vec2 } from '../types';

export interface PentagonEdge {
  readonly index: number;           // 0 to 4
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly normal: Vec2;           // Outward-pointing unit normal
  readonly length: number;
  readonly centralAngle: number;   // Angle subtended at circle center
}

export interface PentagonRing {
  readonly level: number;          // 0 = outermost
  readonly circumradius: number;
  readonly vertices: ReadonlyArray<Vec2>; // Exactly 5 vertices
  readonly edges: ReadonlyArray<PentagonEdge>; // Exactly 5 edges
  readonly centroid: Vec2;
}

export type Pentagon = PentagonRing;

/** Standard Just Intonation side length proportions for the cyclic pentagon */
export const PENTAGON_SIDE_RATIOS: readonly number[] = [1, 8 / 9, 4 / 5, 2 / 3, 3 / 5];

/**
 * Solve lambda parameter for cyclic polygon closure: SUM arcsin(lambda * r_i) = PI
 */
export function solvePentagonLambda(
  ratios: readonly number[] = PENTAGON_SIDE_RATIOS,
  tol = 1e-12,
): number {
  let lo = 1e-10;
  let hi = 1 - 1e-10;
  const f = (lam: number): number =>
    ratios.reduce((sum, r) => sum + Math.asin(lam * r), 0) - Math.PI;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo < tol) break;
  }
  return (lo + hi) / 2;
}

/**
 * Build a strictly 5-sided cyclic pentagon inscribed in radius R.
 */
export function buildPentagonRing(
  radius: number,
  level: number,
  ratios: readonly number[] = PENTAGON_SIDE_RATIOS,
): PentagonRing {
  if (ratios.length !== 5) {
    throw new Error(`PentagonModel invariant violated: expected 5 side ratios, got ${ratios.length}`);
  }

  const lambda = solvePentagonLambda(ratios);
  const centralAngles = ratios.map(r => 2 * Math.asin(lambda * r));

  // 1. Place exactly 5 vertices along circle
  const vertices: Vec2[] = [];
  let angle = -Math.PI / 2; // Start at top vertex
  for (let i = 0; i < 5; i++) {
    vertices.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
    angle += centralAngles[i];
  }

  const centroid: Vec2 = {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / 5,
    y: vertices.reduce((sum, v) => sum + v.y, 0) / 5,
  };

  // 2. Build exactly 5 edges
  const edges: PentagonEdge[] = [];
  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    const p1 = vertices[i];
    const p2 = vertices[j];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);

    // Compute outward normal pointing away from centroid
    let nx = dy / len;
    let ny = -dx / len;
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    if (nx * (mx - centroid.x) + ny * (my - centroid.y) < 0) {
      nx = -nx;
      ny = -ny;
    }

    edges.push({
      index: i,
      p1,
      p2,
      normal: { x: nx, y: ny },
      length: len,
      centralAngle: centralAngles[i],
    });
  }

  return {
    level,
    circumradius: radius,
    vertices,
    edges,
    centroid,
  };
}

/**
 * Generate concentric pentagonal rings using configurable scaling.
 */
export function buildConcentricPentagons(
  baseRadius: number,
  nestingLevels: number,
  scalingFactor = 0.88,
): PentagonRing[] {
  const rings: PentagonRing[] = [];
  for (let level = 0; level < nestingLevels; level++) {
    const r = baseRadius * Math.pow(scalingFactor, level);
    rings.push(buildPentagonRing(r, level));
  }
  return rings;
}
