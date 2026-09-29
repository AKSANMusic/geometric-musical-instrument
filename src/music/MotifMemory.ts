/**
 * MotifMemory.ts — Musical Pattern Buffer & Generative Variation Engine
 *
 * Implements REBUILD_SPEC_V2.md Section 5.3:
 * Records successful melodic steps (intervals, side indices, relative timing)
 * and generates coherent musical variations (transposition, octave shift, rhythmic stretch)
 * to provide thematic continuity and human-like motif recall.
 */

import { SeededRandom } from '../domain/project-state';
import type { CandidateMusicalIntent } from '../domain/events';

export interface MotifNote {
  readonly sideIndex: number;
  readonly ringIndex: number;
  readonly scaleDegree: number;
  readonly deltaPitchCents: number;   // Relative to previous note
  readonly relativeDeltaTime: number; // Time in seconds since previous note
  readonly velocity: number;
  readonly brightness: number;
}

export class MotifMemory {
  private buffer: MotifNote[] = [];
  private maxCapacity: number;
  private lastNoteTime: number | null = null;
  private lastPitchHz: number | null = null;
  private rng: SeededRandom;

  constructor(maxCapacity = 5, seed = 42) {
    this.maxCapacity = Math.max(3, maxCapacity);
    this.rng = new SeededRandom(seed);
  }

  public setSeed(seed: number): void {
    this.rng.setSeed(seed);
  }

  public record(intent: CandidateMusicalIntent, currentTime: number): void {
    const deltaTime = this.lastNoteTime !== null ? Math.max(0.02, currentTime - this.lastNoteTime) : 0.25;
    const deltaCents = this.lastPitchHz !== null && this.lastPitchHz > 0
      ? 1200 * Math.log2(intent.targetPitchHz / this.lastPitchHz)
      : 0;

    this.lastNoteTime = currentTime;
    this.lastPitchHz = intent.targetPitchHz;

    const note: MotifNote = {
      sideIndex: intent.geometricEvent.sideIndex,
      ringIndex: intent.geometricEvent.ringIndex,
      scaleDegree: intent.scaleDegree,
      deltaPitchCents: deltaCents,
      relativeDeltaTime: Math.min(2.0, deltaTime),
      velocity: intent.velocity,
      brightness: intent.brightness,
    };

    this.buffer.push(note);
    if (this.buffer.length > this.maxCapacity) {
      this.buffer.shift();
    }
  }

  public getMotif(): ReadonlyArray<MotifNote> {
    return this.buffer;
  }

  public hasMotif(): boolean {
    return this.buffer.length >= 3;
  }

  /**
   * Produce a modified variation of the recorded motif:
   * - transposition: scale degree offset (+1, -1, +2)
   * - rhythmic scaling: 0.75x or 1.5x
   * - octave displacement: 0, +1, or -1
   */
  public generateVariation(): MotifNote[] {
    if (this.buffer.length === 0) return [];

    const degreeShift = this.rng.choice([-1, 0, 1, 2]);
    const timeScale = this.rng.choice([0.75, 1.0, 1.25, 1.5]);
    const octaveShift = this.rng.choice([0, 0, 1, -1]);

    return this.buffer.map(note => ({
      ...note,
      scaleDegree: Math.max(0, note.scaleDegree + degreeShift),
      ringIndex: Math.max(0, note.ringIndex + octaveShift),
      relativeDeltaTime: Math.max(0.05, note.relativeDeltaTime * timeScale),
      velocity: Math.max(0.1, Math.min(1.0, note.velocity * this.rng.nextRange(0.85, 1.15))),
    }));
  }

  public clear(): void {
    this.buffer = [];
    this.lastNoteTime = null;
    this.lastPitchHz = null;
  }
}
