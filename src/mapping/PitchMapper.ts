/**
 * PitchMapper.ts — Dedicated Decoupled Pitch Mapping Layer
 *
 * Solves the core geometric/musical problem:
 * The Pentagon ALWAYS has 5 physical sides, but musical scales have 5, 7, 12, or 24 degrees.
 * This module cleanly maps the 5 geometric sides onto arbitrary scales, tunings, and harmonic contexts.
 */

import type { GeometricEvent, CandidateMusicalIntent } from '../domain/events';
import type { PitchMappingMode } from '../domain/project-state';
import { RingModel } from '../geometry/RingModel';
import type { RingStrategy } from '../domain/project-state';

export interface ScaleContext {
  tonicFreqHz: number;
  ratios: readonly number[];        // Octave-normalized scale ratios (e.g. 7-note Shur or 12-TET)
  stabilities: readonly number[];   // Stability score per degree [0, 1] (1 = tonic)
  degreeNames: readonly string[];
}

export class PitchMapper {
  /**
   * Map a raw GeometricEvent into a CandidateMusicalIntent.
   */
  public static mapToCandidate(
    event: GeometricEvent,
    scaleContext: ScaleContext,
    mappingMode: PitchMappingMode = 'scaleDegree',
    ringStrategy: RingStrategy = 'octaves',
    totalRings = 6,
  ): CandidateMusicalIntent {
    const ringBehavior = RingModel.getBehavior(ringStrategy, event.ringIndex, totalRings);
    const sideIdx = Math.max(0, Math.min(4, event.sideIndex)); // 0 to 4
    const u = Math.max(0, Math.min(1, event.normalizedPosition));

    let pitchHz: number;
    let degreeIdx = 0;
    let octave = event.ringIndex;
    let stability = 0.5;

    const N = scaleContext.ratios.length;

    switch (mappingMode) {
      case 'physicalLength': {
        // Frequency proportional to Just Intonation length ratios (invariable 5-limit pentatonic)
        const pentatonicRatios = [1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
        const ratio = pentatonicRatios[sideIdx];
        pitchHz = scaleContext.tonicFreqHz * ratio * ringBehavior.frequencyMultiplier;
        degreeIdx = sideIdx % N;
        stability = scaleContext.stabilities[degreeIdx] ?? (sideIdx === 0 ? 1.0 : 0.6);
        break;
      }

      case 'harmonicSeries': {
        // Natural odd and even harmonics (1, 3, 5, 7, 9...)
        const harmonicNumbers = [1, 2, 3, 5, 7];
        const harmonic = harmonicNumbers[sideIdx];
        pitchHz = scaleContext.tonicFreqHz * harmonic * (event.ringIndex + 1);
        degreeIdx = sideIdx % N;
        stability = sideIdx === 0 ? 1.0 : 0.65;
        break;
      }

      case 'chordTone': {
        // Root (0), Third (2), Fifth (4), Seventh (6), Ninth (8)
        const chordIndices = [0, 2, 4, 6 % N, 1 % N];
        degreeIdx = chordIndices[sideIdx];
        const ratio = scaleContext.ratios[degreeIdx] || 1.0;
        pitchHz = scaleContext.tonicFreqHz * ratio * ringBehavior.frequencyMultiplier;
        stability = sideIdx === 0 ? 1.0 : sideIdx === 2 ? 0.9 : 0.7;
        break;
      }

      case 'modalFunction': {
        // 0: Tonic/Pillar, 1: Shahid/Focal, 2: Ist/Cadence, 3: Motaghayyer, 4: Dominant
        const modalOffsets = [0, 1, 2, 3, 4];
        degreeIdx = modalOffsets[sideIdx] % N;
        const ratio = scaleContext.ratios[degreeIdx] || 1.0;
        pitchHz = scaleContext.tonicFreqHz * ratio * ringBehavior.frequencyMultiplier;
        stability = sideIdx === 0 ? 1.0 : sideIdx === 2 ? 0.85 : 0.55;
        break;
      }

      case 'scaleDegree':
      default: {
        // Maps the 5 sides across the full scale evenly
        // For N=7: side 0->deg 0, side 1->deg 1, side 2->deg 3, side 3->deg 4, side 4->deg 6
        if (N <= 5) {
          degreeIdx = sideIdx % N;
        } else {
          // Distribute 5 sides across N degrees (tonic, third, fourth, fifth, leading)
          const distribution = [0, Math.floor(N * 0.25), Math.floor(N * 0.5), Math.floor(N * 0.7), N - 1];
          degreeIdx = distribution[sideIdx] % N;
        }
        const ratio = scaleContext.ratios[degreeIdx] || 1.0;
        pitchHz = scaleContext.tonicFreqHz * ratio * ringBehavior.frequencyMultiplier;
        stability = scaleContext.stabilities[degreeIdx] ?? 0.5;
        break;
      }
    }

    // Microtonal continuous cents variation along string length:
    // Plucking near the extreme tips subtly introduces expressive pitch bending (+/- 12 cents)
    const microBendCents = Math.sin((u - 0.5) * Math.PI) * 12.0;
    pitchHz *= Math.pow(2, microBendCents / 1200);

    const midiNoteFloat = 69 + 12 * Math.log2(pitchHz / 440);

    // Timbre / Brightness: Parabolic strike position model sin(pi * u)
    // Center (u=0.5) = warm fundamental (0.2), Tips (u=0, 1) = bright high harmonics (0.95)
    const brightness = 1.0 - 0.75 * Math.sin(Math.PI * u);

    // Stereo Panorama: Spread 5 sides symmetrically [-0.85, +0.85]
    const pan = (sideIdx / 2) - 1.0; // [-1.0, -0.5, 0.0, 0.5, 1.0]

    return {
      geometricEvent: event,
      targetPitchHz: pitchHz,
      midiNoteFloat,
      scaleDegree: degreeIdx,
      octave,
      stability,
      velocity: event.velocity * ringBehavior.defaultVelocityScale,
      duration: event.durationHint ?? (1.2 + 0.6 * (1 - event.ringIndex / totalRings)),
      brightness,
      pan: Math.max(-1, Math.min(1, pan * 0.85)),
    };
  }
}
