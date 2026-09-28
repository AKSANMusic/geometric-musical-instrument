import type { Vec2, Edge, Pentagon, ParticleState } from '../types';

const EPSILON = 1e-9;

/**
 * Ray–segment intersection using Cramer's rule.
 *
 * Solves: p + t*v = a + u*(b - a)
 * Returns { t, u } where t > 0 is the travel time and u in [0,1]
 * is the fractional position along the segment, or null if no hit.
 */
export function raySegmentIntersect(
  px: number, py: number,
  vx: number, vy: number,
  ax: number, ay: number,
  bx: number, by: number,
): { t: number; u: number } | null {
  const dx = bx - ax;
  const dy = by - ay;

  // Cross product: v × d
  const denom = vx * dy - vy * dx;
  if (Math.abs(denom) < EPSILON) return null; // parallel or degenerate

  // Vector from ray origin to segment start: s = a - p
  const sx = ax - px;
  const sy = ay - py;

  // t = (s × d) / (v × d)  — time along ray
  const t = (sx * dy - sy * dx) / denom;

  // u = (s × v) / (v × d)  — position along segment [0,1]
  // Note: s × v = sx*vy - sy*vx (NOT vx*sy - vy*sx)
  const u = (sx * vy - sy * vx) / denom;

  if (t > EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return { t, u: Math.max(0, Math.min(1, u)) };
  }
  return null;
}

export interface RayHit {
  edge: Edge;
  pentagon: Pentagon;
  t: number;  // time to collision
  u: number;  // position along edge [0,1]
}

/**
 * Find the nearest collision for a particle against all edges
 * in all pentagons.
 *
 * For the outermost pentagon the particle bounces off the INSIDE;
 * for inner pentagons the particle bounces off the OUTSIDE.
 * Both are handled: we simply find the nearest intersection regardless.
 */
export function findNearestCollision(
  particle: ParticleState,
  pentagons: ReadonlyArray<Pentagon>,
  maxTime: number,
): RayHit | null {
  let best: RayHit | null = null;

  for (const pent of pentagons) {
    for (const edge of pent.edges) {
      const hit = raySegmentIntersect(
        particle.pos.x, particle.pos.y,
        particle.vel.x, particle.vel.y,
        edge.p1.x, edge.p1.y,
        edge.p2.x, edge.p2.y,
      );
      if (hit && hit.t < maxTime && (!best || hit.t < best.t)) {
        best = { edge, pentagon: pent, t: hit.t, u: hit.u };
      }
    }
  }
  return best;
}
