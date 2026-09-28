import type { Vec2, Edge, Pentagon } from '../types';
import {
  JI_SIDE_RATIOS, JI_FREQ_RATIOS, INTERVAL_LABELS,
  type ScaleDefinition,
} from './constants';

/**
 * Solve for lambda such that: SUM_i arcsin(lambda * r_i) = pi
 *
 * Uses bisection on (0, 1). The equation has a unique root because
 * f(0) = 0 < pi and f(1) = sum(arcsin(r_i)) > pi (verified numerically
 * to be ~4.967), and f is strictly monotone increasing.
 *
 * @param ratios - The side-length ratios (wavelength domain)
 * @param tol - Convergence tolerance
 * @returns lambda* (approximately 0.7362928962 for the default JI ratios)
 */
export function solveLambda(
  ratios: readonly number[] = JI_SIDE_RATIOS,
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
 * Build a single cyclic pentagon inscribed in a circle of radius R.
 *
 * @param R - Circumradius (pixels)
 * @param baseFreq - Root frequency in Hz
 * @param level - Nesting depth (0 = outermost)
 * @param scale - Optional scale definition (defaults to Major Pentatonic JI)
 * @returns A Pentagon with computed vertices, edges, normals, and frequencies
 */
export function buildPentagon(
  R: number,
  baseFreq: number,
  level: number,
  scale?: ScaleDefinition,
): Pentagon {
  const sideRatios = scale?.sideRatios ?? JI_SIDE_RATIOS;
  const freqRatios = scale?.freqRatios ?? JI_FREQ_RATIOS;
  const labels = scale?.labels ?? INTERVAL_LABELS;

  const lam = solveLambda(sideRatios);
  const centralAngles = sideRatios.map(r => 2 * Math.asin(lam * r));
  const N = sideRatios.length;

  // Place vertices on the circumscribed circle
  const vertices: Vec2[] = [];
  let angle = -Math.PI / 2; // start at top
  for (let i = 0; i < N; i++) {
    vertices.push({
      x: R * Math.cos(angle),
      y: R * Math.sin(angle),
    });
    angle += centralAngles[i];
  }

  // Compute centroid for outward-normal orientation
  const cx = vertices.reduce((s, v) => s + v.x, 0) / N;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / N;

  // Build edges
  const edges: Edge[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const p1 = vertices[i];
    const p2 = vertices[j];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const edgeLen = Math.hypot(dx, dy);

    // Outward normal: perpendicular to edge, pointing away from centroid
    let nx = dy / edgeLen;
    let ny = -dx / edgeLen;
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    if (nx * (mx - cx) + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }

    edges.push({
      index: i,
      p1,
      p2,
      normal: { x: nx, y: ny },
      length: edgeLen,
      frequency: baseFreq * freqRatios[i],
      jiRatio: freqRatios[i],
      label: labels[i] ?? `Deg ${i + 1}`,
    });
  }

  return { vertices, edges, circumradius: R, level };
}

/**
 * Generate nested pentagons via homothety (uniform scaling from center)
 * or harmonic linear spacing for high level counts (up to 12-16 levels).
 *
 * @param R - Outermost circumradius
 * @param baseFreq - Root frequency for outermost pentagon
 * @param levels - Number of concentric pentagons (1 to 16)
 * @param k - Scaling factor per level (0.5 = octave transposition, <= 0 for harmonic linear auto-fit)
 * @param scale - Optional scale definition
 */
export function buildNestedPentagons(
  R: number,
  baseFreq: number,
  levels: number,
  k = 0.5,
  scale?: ScaleDefinition,
): Pentagon[] {
  const pentagons: Pentagon[] = [];
  const minClearanceRadius = Math.max(22, R * 0.12);

  for (let n = 0; n < levels; n++) {
    let r: number;
    let f: number;

    if (k <= 0) {
      // Harmonic linear spacing: constant radial clearance between concentric pentagons.
      // Frequency follows the fundamental acoustic law of strings (f ∝ 1 / length).
      r = levels === 1 ? R : R - n * ((R - minClearanceRadius) / (levels - 1));
      f = baseFreq * (R / r);
    } else {
      // Classical geometric homothety
      r = R * Math.pow(k, n);
      f = baseFreq * Math.pow(1 / k, n);
    }

    pentagons.push(buildPentagon(r, f, n, scale));
  }
  return pentagons;
}

// ─── Robust Solver with Validation ───────────────────────────────────────────

export interface PolygonSolveResult {
  success: boolean;
  lambda?: number;
  radius: number;
  angles: number[];
  vertices: Array<{ x: number; y: number }>;
  edgeLengths: number[];
  residual: number;
  iterations: number;
  warnings: string[];
  error?: string;
}

/**
 * Robust polygon solver with full input validation.
 *
 * Validates:
 * - N >= 3
 * - All ratios are finite and positive
 * - Normalizes ratios so max = 1
 * - Verifies closure is achievable (sum of arcsin > PI)
 * - Returns structured result with convergence info
 */
export function solvePolygon(
  ratios: readonly number[],
  circumradius: number = 300,
  tol: number = 1e-12,
  maxIterations: number = 100,
): PolygonSolveResult {
  const warnings: string[] = [];
  const N = ratios.length;

  // Validate minimum vertex count
  if (N < 3) {
    return {
      success: false,
      radius: circumradius,
      angles: [],
      vertices: [],
      edgeLengths: [],
      residual: NaN,
      iterations: 0,
      warnings,
      error: `Polygon requires at least 3 sides, got ${N}`,
    };
  }

  // Validate all ratios are finite and positive
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(ratios[i]) || ratios[i] <= 0) {
      return {
        success: false,
        radius: circumradius,
        angles: [],
        vertices: [],
        edgeLengths: [],
        residual: NaN,
        iterations: 0,
        warnings,
        error: `Ratio at index ${i} is invalid: ${ratios[i]}. All ratios must be finite and positive.`,
      };
    }
  }

  // Normalize ratios so max = 1
  const maxRatio = Math.max(...ratios);
  const normalized = ratios.map(r => r / maxRatio);
  if (maxRatio !== 1) {
    warnings.push(`Ratios normalized by factor ${maxRatio.toFixed(6)} (max ratio was ${maxRatio})`);
  }

  // Verify closure is achievable
  const sumAtOne = normalized.reduce((sum, r) => sum + Math.asin(r), 0);
  if (sumAtOne <= Math.PI) {
    return {
      success: false,
      radius: circumradius,
      angles: [],
      vertices: [],
      edgeLengths: [],
      residual: sumAtOne - Math.PI,
      iterations: 0,
      warnings,
      error: `Polygon cannot close: sum of arcsin(r_i) = ${sumAtOne.toFixed(6)} ≤ π = ${Math.PI.toFixed(6)}`,
    };
  }

  // Check for near-degenerate edges (subtending < 5°)
  // We'll check after solving, but warn about very small ratios
  const minRatio = Math.min(...normalized);
  if (minRatio < 0.05) {
    warnings.push(`Very small ratio detected (${minRatio.toFixed(6)}). Polygon may have near-degenerate edges.`);
  }

  // Bisection solver
  let lo = 1e-10;
  let hi = 1 - 1e-10;
  let iterations = 0;

  const f = (lam: number): number =>
    normalized.reduce((sum, r) => sum + Math.asin(lam * r), 0) - Math.PI;

  for (iterations = 0; iterations < maxIterations; iterations++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo < tol) break;
  }

  const lambda = (lo + hi) / 2;
  const residual = Math.abs(f(lambda));

  // Compute central angles
  const angles = normalized.map(r => 2 * Math.asin(lambda * r));

  // Verify closure
  const angleSum = angles.reduce((s, a) => s + a, 0);
  if (Math.abs(angleSum - 2 * Math.PI) > 1e-6) {
    warnings.push(`Angle sum ${angleSum.toFixed(8)} deviates from 2π by ${Math.abs(angleSum - 2 * Math.PI).toExponential(2)}`);
  }

  // Check for near-degenerate edges
  const minAngleDeg = (Math.min(...angles) * 180) / Math.PI;
  if (minAngleDeg < 5) {
    warnings.push(`Smallest central angle is ${minAngleDeg.toFixed(2)}°. Edge may be visually indistinguishable.`);
  }

  // Place vertices
  const vertices: Array<{ x: number; y: number }> = [];
  let currentAngle = -Math.PI / 2;
  for (let i = 0; i < N; i++) {
    vertices.push({
      x: circumradius * Math.cos(currentAngle),
      y: circumradius * Math.sin(currentAngle),
    });
    currentAngle += angles[i];
  }

  // Compute edge lengths
  const edgeLengths: number[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    edgeLengths.push(
      Math.hypot(vertices[j].x - vertices[i].x, vertices[j].y - vertices[i].y),
    );
  }

  return {
    success: true,
    lambda,
    radius: circumradius,
    angles,
    vertices,
    edgeLengths,
    residual,
    iterations: iterations + 1,
    warnings,
  };
}
