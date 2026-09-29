/**
 * events.ts — Canonical Event Pipeline Types for Version 2
 *
 * Pipeline Flow:
 * Gesture / Physics -> GeometricEvent -> CandidateMusicalIntent -> MusicalIntelligence -> MusicalEvent -> Audio / MIDI / Visual Feedback
 */

export type ExcitationSource =
  | 'manual'       // Direct tap/pluck on pentagon string
  | 'collision'    // Particle collision with side
  | 'orbit'        // Continuous orbital motion excitation
  | 'rain'         // Generative rhythmic drops
  | 'pulse'        // Periodic rhythmic impulse
  | 'swarm';       // Multi-particle swarm dynamics

export interface GeometricEvent {
  readonly id: string;
  readonly time: number;                // Physics/interaction simulation timestamp in seconds
  readonly source: ExcitationSource;
  readonly sideIndex: number;           // 0 to 4 (The 5 sides of the Pentagon)
  readonly ringIndex: number;           // 0 = outermost, 1, 2, ...
  readonly normalizedPosition: number;  // u in [0, 1] along the string
  readonly velocity: number;            // [0, 1] impact intensity
  readonly angle?: number;              // Angle of impact/incidence in radians
  readonly durationHint?: number;       // Duration in seconds (e.g. for sustained hold/bow)
}

export interface CandidateMusicalIntent {
  readonly geometricEvent: GeometricEvent;
  readonly targetPitchHz: number;
  readonly midiNoteFloat: number;
  readonly scaleDegree: number;
  readonly octave: number;
  readonly stability: number;           // [0, 1] 1 = tonic/stable, 0 = dissonant/passing
  readonly velocity: number;            // [0, 1]
  readonly duration: number;            // Duration in seconds
  readonly brightness: number;          // [0, 1] spectral centroid derived from strike position
  readonly pan: number;                 // [-1, +1] stereo panorama position
}

export type ArticulationType = 'pluck' | 'strike' | 'sustain' | 'bow' | 'ghost';

export type MusicalRole =
  | 'stable'       // Tonic, 5th, or fundamental pillar
  | 'passing'      // Intermediate scale step moving along melody
  | 'tension'      // Dissonant, leading tone, or expressive neutral microtone
  | 'resolution'   // Resolving cadence tone
  | 'ornament'     // Grace note, tahrir, or rapid trill
  | 'drone';       // Constant modal pedal anchor

/**
 * The ONLY canonical musical event delivered to audio synthesis, MIDI, MPE, and UI monitors.
 */
export interface MusicalEvent {
  readonly id: string;
  readonly time: number;                // Audio clock time (AudioContext.currentTime)
  readonly pitchHz: number;             // Exact target frequency in Hz (authoritative)
  readonly midiNoteFloat: number;       // Continuous MIDI note number (e.g. 69.5)
  readonly velocity: number;            // [0, 1]
  readonly duration: number;            // Seconds to sustain
  readonly brightness: number;          // [0, 1] harmonic richness
  readonly pan: number;                 // [-1, +1] stereo pan
  readonly articulation: ArticulationType;
  readonly role: MusicalRole;
  readonly phraseId?: string;
  readonly voiceId?: string;
  readonly sourceEventId?: string;
  readonly commonToneRetained?: boolean;
}

let eventIdCounter = 0;

export function generateEventId(prefix = 'evt'): string {
  return `${prefix}-${++eventIdCounter}-${Date.now()}`;
}

export function resetEventIdCounter(): void {
  eventIdCounter = 0;
}
