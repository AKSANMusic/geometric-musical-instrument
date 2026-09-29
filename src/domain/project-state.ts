/**
 * project-state.ts — Centralized Typed Project State & Seeded PRNG
 *
 * Implements:
 * 1. Single source of truth for the entire application (transport, geometry, harmony, sound, ui).
 * 2. Deterministic Seeded Pseudo-Random Number Generator (PRNG) for reproducible generative sessions.
 */

// ─── Seeded Deterministic PRNG (Mulberry32) ───────────────────────────────────

export class SeededRandom {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  public choice<T>(array: readonly T[]): T {
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }
}

// ─── Project State Interfaces ────────────────────────────────────────────────

export type ViewMode = 'play' | 'generate' | 'lab';
export type ExcitationMode = 'manual' | 'bounce' | 'orbit' | 'rain' | 'pulse' | 'swarm';
export type RingStrategy = 'octaves' | 'harmonics' | 'chordTones' | 'echoes' | 'counterpoint';
export type PitchMappingMode = 'physicalLength' | 'scaleDegree' | 'harmonicSeries' | 'chordTone' | 'modalFunction';

export interface TransportState {
  bpm: number;
  isPlaying: boolean;
  isPaused: boolean;
}

export interface GeometryState {
  readonly sidesCount: 5;       // Always strictly 5 sides for the Pentagon
  nestingLevels: number;        // Number of concentric rings (1 to 16)
  baseRadius: number;           // Outer ring radius in pixels
  scalingFactor: number;        // Spacing factor k
  ringStrategy: RingStrategy;
}

export interface InteractionState {
  excitationMode: ExcitationMode;
  particleCount: number;
  particleSpeed: number;
  damping: number;
  gravityStrength: number;
  attractionFieldEnabled: boolean;
}

export interface HarmonyState {
  rootNote: string;             // e.g. "D", "A", "C"
  scaleId: string;              // e.g. "shur", "homayoun", "majorPentatonic", "custom"
  customScaleCents?: number[];  // When custom or loaded from Scala
  musicalFreedom: number;       // [0, 100] Low = strict filtering & silence, High = free chromatic/microtonal
  tonalCenterStability: number; // [0, 1] Bias toward tonic resolution
  droneEnabled: boolean;
  droneVolume: number;
}

export interface GenerationState {
  phraseDurationSeconds: number;// 2.0 to 8.0 seconds
  energy: number;               // [0, 100]
  complexity: number;           // [0, 100]
  motifMemoryEnabled: boolean;
  motifRepetitionChance: number;// [0, 1]
  silenceProbability: number;   // [0, 1]
}

export interface SoundState {
  instrumentPreset: 'swamCello' | 'accordion' | 'santur' | 'celestialHarp';
  masterVolume: number;         // [0, 1]
  reverbMix: number;            // [0, 1]
  sustainDuration: number;      // Seconds
  bowPressure: number;          // Default bow force [0, 1]
  bellowsPressure: number;      // Default accordion pressure [0, 1]
  celloRangeEnabled: boolean;
}

export interface MidiState {
  enabled: boolean;
  mpeEnabled: boolean;
  selectedInputId: string;
  selectedOutputId: string;
  channel: number;
  pitchBendRangeSemitones: number;
}

export interface UIState {
  activeView: ViewMode;
  showCelloGuidelines: boolean;
  showBowTrail: boolean;
}

export interface ProjectState {
  readonly version: 2;
  randomSeed: number;
  transport: TransportState;
  geometry: GeometryState;
  interaction: InteractionState;
  harmony: HarmonyState;
  generation: GenerationState;
  sound: SoundState;
  midi: MidiState;
  ui: UIState;
}

export const DEFAULT_PROJECT_STATE: ProjectState = {
  version: 2,
  randomSeed: 42,
  transport: {
    bpm: 108,
    isPlaying: true,
    isPaused: false,
  },
  geometry: {
    sidesCount: 5,
    nestingLevels: 6,
    baseRadius: 320,
    scalingFactor: 0.88,
    ringStrategy: 'octaves',
  },
  interaction: {
    excitationMode: 'bounce',
    particleCount: 1,
    particleSpeed: 380,
    damping: 0.985,
    gravityStrength: 0,
    attractionFieldEnabled: false,
  },
  harmony: {
    rootNote: 'D',
    scaleId: 'shur',
    musicalFreedom: 45,
    tonalCenterStability: 0.85,
    droneEnabled: false,
    droneVolume: 0.45,
  },
  generation: {
    phraseDurationSeconds: 4.5,
    energy: 55,
    complexity: 40,
    motifMemoryEnabled: true,
    motifRepetitionChance: 0.65,
    silenceProbability: 0.25,
  },
  sound: {
    instrumentPreset: 'swamCello',
    masterVolume: 0.75,
    reverbMix: 0.35,
    sustainDuration: 1.8,
    bowPressure: 0.65,
    bellowsPressure: 0.70,
    celloRangeEnabled: true,
  },
  midi: {
    enabled: true,
    mpeEnabled: true,
    selectedInputId: 'none',
    selectedOutputId: 'none',
    channel: 1,
    pitchBendRangeSemitones: 2,
  },
  ui: {
    activeView: 'play',
    showCelloGuidelines: true,
    showBowTrail: true,
  },
};

// ─── Centralized Project Store ────────────────────────────────────────────────

export type StateListener = (state: Readonly<ProjectState>) => void;

export class ProjectStore {
  private state: ProjectState;
  private listeners: Set<StateListener> = new Set();
  public readonly rng: SeededRandom;

  constructor(initialState: ProjectState = DEFAULT_PROJECT_STATE) {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.rng = new SeededRandom(this.state.randomSeed);
  }

  public getState(): Readonly<ProjectState> {
    return this.state;
  }

  public update(updater: (draft: ProjectState) => void): void {
    updater(this.state);
    if (this.state.randomSeed !== undefined) {
      this.rng.setSeed(this.state.randomSeed);
    }
    this.notify();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }
}
