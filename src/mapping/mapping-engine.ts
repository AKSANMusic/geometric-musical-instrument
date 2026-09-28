/**
 * mapping-engine.ts — Geometry-to-Music & Event Mapping Engine
 *
 * Implements decoupled, configurable mapping strategies between:
 * - Geometric properties (edge length, central angle, vertex index, radius)
 * - Musical dimensions (frequency, pitch class, scale degree, register)
 * - Physical dynamics (impact speed, collision parameter u)
 * - Performance attributes (velocity, brightness/timbre, duration, stereo pan)
 *
 * Fully decoupled from rendering and audio synthesis.
 */

import type { Edge, Pentagon, CollisionEvent } from '../types';
import type { MusicalEvent } from '../events/musical-event';
import { generateEventId } from '../events/musical-event';

// ─── Mapping Configuration ───────────────────────────────────────────────────

export type VelocityCurve = 'logarithmic' | 'linear' | 'exponential';
export type TimbreCurve = 'parabolic-center' | 'linear-sweep' | 'constant';

export interface MappingConfig {
  /** Maximum expected impact speed in px/s for velocity normalization */
  maxImpactSpeed: number;
  /** Logarithmic velocity compression factor beta (default 10) */
  velocityCompressionBeta: number;
  /** Velocity mapping curve type */
  velocityCurve: VelocityCurve;
  /** Timbre mapping along the edge */
  timbreCurve: TimbreCurve;
  /** Minimum velocity clamp [1..127] */
  minVelocity: number;
  /** Maximum velocity clamp [1..127] */
  maxVelocity: number;
  /** Default note duration in seconds */
  defaultDurationSec: number;
}

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  maxImpactSpeed: 500,
  velocityCompressionBeta: 10,
  velocityCurve: 'logarithmic',
  timbreCurve: 'parabolic-center',
  minVelocity: 1,
  maxVelocity: 127,
  defaultDurationSec: 1.0,
};

// ─── Dynamic Velocity Mapping ────────────────────────────────────────────────

/**
 * Maps physical impact speed to MIDI velocity using configurable curve.
 */
export function mapSpeedToVelocity(
  speed: number,
  config: MappingConfig = DEFAULT_MAPPING_CONFIG,
): number {
  const norm = Math.max(0, Math.min(1, speed / config.maxImpactSpeed));

  let val: number;
  switch (config.velocityCurve) {
    case 'linear':
      val = norm;
      break;
    case 'exponential':
      val = norm * norm;
      break;
    case 'logarithmic':
    default: {
      const b = config.velocityCompressionBeta;
      val = Math.log(1 + b * norm) / Math.log(1 + b);
      break;
    }
  }

  const scaled = Math.round(config.minVelocity + val * (config.maxVelocity - config.minVelocity));
  return Math.max(config.minVelocity, Math.min(config.maxVelocity, scaled));
}

// ─── Timbre / Brightness Mapping ─────────────────────────────────────────────

/**
 * Maps strike parameter u in [0, 1] along edge to brightness / timbre in [0, 1].
 * - Parabolic center: 1 at midpoint (warm/tasto), 0 at extremities (bright/ponticello).
 */
export function mapParamToBrightness(
  u: number,
  curve: TimbreCurve = 'parabolic-center',
): number {
  const clampedU = Math.max(0, Math.min(1, u));
  switch (curve) {
    case 'linear-sweep':
      return clampedU;
    case 'constant':
      return 0.7;
    case 'parabolic-center':
    default:
      // 1 - 4 * (u - 0.5)^2 -> 1 at u=0.5, 0 at u=0 and u=1
      return Math.max(0, Math.min(1, 1 - 4 * Math.pow(clampedU - 0.5, 2)));
  }
}

// ─── Stereo Pan Mapping ──────────────────────────────────────────────────────

/**
 * Maps edge index across a polygon ring to a stereo pan value in [-1, +1].
 */
export function mapEdgeToPan(edgeIndex: number, totalEdges: number): number {
  if (totalEdges <= 1) return 0;
  return (2 * edgeIndex) / (totalEdges - 1) - 1;
}

// ─── Radius to Register Mapping ──────────────────────────────────────────────

/**
 * Maps concentric ring level to an octave/register offset.
 * Ring 0 is outermost (base register 0), inner rings ascend in register.
 */
export function mapRadiusToRegister(ringLevel: number, levelsPerOctave = 1): number {
  return Math.floor(ringLevel / levelsPerOctave);
}

// ─── Comprehensive Collision to Canonical Event Mapping ──────────────────────

/**
 * Maps a physics CollisionEvent into a canonical MusicalEvent.
 */
export function mapCollisionToMusicalEvent(
  event: CollisionEvent,
  config: MappingConfig = DEFAULT_MAPPING_CONFIG,
): MusicalEvent {
  const freq = event.edge.frequency;
  const exactMidi = 69 + 12 * Math.log2(freq / 440);
  const baseMidi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - baseMidi) * 100);

  const velocity = mapSpeedToVelocity(event.impactSpeed, config);
  const brightness = mapParamToBrightness(event.impactParam, config.timbreCurve);
  const pan = mapEdgeToPan(event.edge.index, event.pentagon.edges.length);
  const register = mapRadiusToRegister(event.pentagon.level);

  return {
    id: generateEventId(),
    timestamp: event.timestamp,
    type: 'noteOn',
    source: 'physics',
    frequencyHz: freq,
    midiNote: Math.max(0, Math.min(127, baseMidi)),
    cents,
    scaleDegree: event.edge.index,
    register,
    velocity,
    brightness,
    pan,
    durationMs: config.defaultDurationSec * 1000,
    pentagonLevel: event.pentagon.level,
    edgeIndex: event.edge.index,
    impactParam: event.impactParam,
    audioEnabled: true,
    midiEnabled: true,
  };
}
