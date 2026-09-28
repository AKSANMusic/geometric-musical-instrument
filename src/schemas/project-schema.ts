/**
 * project-schema.ts — Versioned Schemas, Contracts & Migration Engine
 *
 * Provides strict TypeScript contracts and migration helpers for:
 * 1. Project State (Geometry, Tuning, Mapping, Physics, Audio, MIDI, Range)
 * 2. Tuning Definition (Persian/Turkish/Western/Just Intonation/Cents)
 * 3. MIDI Routing (MPE, Single-channel, RPN, Exhaustion policies)
 * 4. Target Instrument Range (SWAM Cello, Violin, Tar, Custom)
 */

import type { MPEZone, ChannelExhaustionPolicy } from '../midi/mpe-allocator';
import type { RangeBehavior } from '../audio/instrument-range';
import type { VelocityCurve, TimbreCurve } from '../mapping/mapping-engine';

// ─── 1. Tuning Definition Schema ─────────────────────────────────────────────

export type TuningType = 'just-intonation' | 'equal-temperament' | 'cent-table' | 'pythagorean';

export interface TuningDefinitionSchema {
  readonly id: string;
  readonly name: string;
  readonly farsiName?: string;
  readonly tuningType: TuningType;
  /** Ratios relative to tonic or cent offsets */
  readonly ratios?: readonly number[];
  readonly centOffsets?: readonly number[];
  readonly octaveRatio: number; // usually 2.0
  readonly tonic: string;       // e.g. "A4" or "C4"
  readonly tonicFrequency: number;
  readonly microtonalDegrees?: readonly number[];
  readonly description?: string;
}

// ─── 2. MIDI Routing Schema ──────────────────────────────────────────────────

export type MidiMode = 'standard-1.0' | 'mpe';

export interface MidiRoutingSchema {
  readonly outputPortId: string | null;
  readonly inputPortId: string | null;
  readonly mode: MidiMode;
  readonly channel: number;               // 0..15 (for standard 1.0)
  readonly pitchBendEnabled: boolean;
  readonly pitchBendRangeSemitones: number;
  readonly mpeZone: MPEZone;
  readonly mpeExhaustionPolicy: ChannelExhaustionPolicy;
  readonly sendRPN: boolean;
}

// ─── 3. Target Instrument Range Schema ───────────────────────────────────────

export interface TargetInstrumentRangeSchema {
  readonly enabled: boolean;
  readonly presetId: string;
  readonly name: string;
  readonly farsiName?: string;
  readonly minMidi: number;
  readonly maxMidi: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly behavior: RangeBehavior;
  readonly voiceLeadingConstraints?: {
    readonly preserveBass: boolean;
    readonly preventCrossing: boolean;
    readonly maxSearchDepth: number;
  };
}

// ─── 4. Project State Schema (Version 1.0.0) ─────────────────────────────────

export interface ProjectStateSchema {
  readonly schemaVersion: '1.0.0';
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly randomSeed: number;

  readonly geometry: {
    readonly scaleKey: string;
    readonly rootKey: string;
    readonly circumradius: number;
    readonly nestingLevels: number;
    readonly scalingFactor: number;
  };

  readonly physics: {
    readonly enabled: boolean;
    readonly damping: number;
    readonly particleSpeed: number;
    readonly physicsTick: number;
    readonly maxBouncesPerStep: number;
  };

  readonly audio: {
    readonly maxVoices: number;
    readonly minIOI: number;
    readonly noteDuration: number;
    readonly timbreKey: string;
    readonly reverbMix: number;
    readonly masterVolume: number;
  };

  readonly mapping: {
    readonly velocityCurve: VelocityCurve;
    readonly timbreCurve: TimbreCurve;
    readonly maxImpactSpeed: number;
  };

  readonly midi: MidiRoutingSchema;
  readonly range: TargetInstrumentRangeSchema;
  readonly tuning?: TuningDefinitionSchema;

  readonly uiState?: {
    readonly selectedTab?: string;
    readonly zoomLevel?: number;
    readonly performanceMode?: boolean;
  };
}

// ─── Default Schema Factories ────────────────────────────────────────────────

export function createDefaultMidiRouting(): MidiRoutingSchema {
  return {
    outputPortId: null,
    inputPortId: null,
    mode: 'mpe',
    channel: 0,
    pitchBendEnabled: true,
    pitchBendRangeSemitones: 2,
    mpeZone: 'lower',
    mpeExhaustionPolicy: 'steal-oldest',
    sendRPN: true,
  };
}

export function createDefaultRangeSchema(): TargetInstrumentRangeSchema {
  return {
    enabled: true,
    presetId: 'swam-cello',
    name: 'SWAM Cello / Orchestra Cello',
    farsiName: 'ویولنسل (SWAM Cello)',
    minMidi: 36, // C2
    maxMidi: 79, // G5
    minFrequency: 65.41,
    maxFrequency: 783.99,
    behavior: 'fold',
    voiceLeadingConstraints: {
      preserveBass: true,
      preventCrossing: true,
      maxSearchDepth: 6,
    },
  };
}

export function createDefaultProjectState(name = 'New Preset'): ProjectStateSchema {
  const now = Date.now();
  return {
    schemaVersion: '1.0.0',
    name,
    createdAt: now,
    updatedAt: now,
    randomSeed: Math.floor(Math.random() * 1000000),
    geometry: {
      scaleKey: 'shur',
      rootKey: 'A',
      circumradius: 300,
      nestingLevels: 12,
      scalingFactor: -1, // harmonic linear
    },
    physics: {
      enabled: true,
      damping: 0.985,
      particleSpeed: 250,
      physicsTick: 1 / 240,
      maxBouncesPerStep: 20,
    },
    audio: {
      maxVoices: 32,
      minIOI: 20,
      noteDuration: 1.8,
      timbreKey: 'santur',
      reverbMix: 0.38,
      masterVolume: 0.7,
    },
    mapping: {
      velocityCurve: 'logarithmic',
      timbreCurve: 'parabolic-center',
      maxImpactSpeed: 500,
    },
    midi: createDefaultMidiRouting(),
    range: createDefaultRangeSchema(),
    uiState: {
      performanceMode: false,
    },
  };
}

// ─── Validation & Migrations ─────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a project state object against schema constraints.
 */
export function validateProjectState(state: unknown): ValidationResult {
  const errors: string[] = [];
  if (!state || typeof state !== 'object') {
    return { valid: false, errors: ['Project state must be an object'] };
  }

  const s = state as Record<string, unknown>;

  if (s.schemaVersion !== '1.0.0') {
    errors.push(`Unsupported schemaVersion: ${s.schemaVersion}. Expected '1.0.0'.`);
  }

  if (!s.geometry || typeof s.geometry !== 'object') {
    errors.push('Missing or invalid geometry block');
  }

  if (!s.audio || typeof s.audio !== 'object') {
    errors.push('Missing or invalid audio block');
  }

  if (!s.midi || typeof s.midi !== 'object') {
    errors.push('Missing or invalid midi block');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate legacy or unversioned project state to version 1.0.0.
 */
export function migrateProjectState(raw: unknown): ProjectStateSchema {
  if (!raw || typeof raw !== 'object') {
    return createDefaultProjectState();
  }

  const legacy = raw as Record<string, unknown>;

  // If already at 1.0.0, validate and return
  if (legacy.schemaVersion === '1.0.0') {
    const val = validateProjectState(legacy);
    if (val.valid) {
      return legacy as unknown as ProjectStateSchema;
    }
  }

  // Perform migration from unversioned / partial legacy state
  const defaultState = createDefaultProjectState((legacy.name as string) || 'Migrated Preset');

  const legacyGeo = (legacy.geometry as Record<string, unknown>) || {};
  const legacyAudio = (legacy.audio as Record<string, unknown>) || {};
  const legacyPhysics = (legacy.physics as Record<string, unknown>) || {};
  const legacyMidi = (legacy.midi as Record<string, unknown>) || {};
  const legacyRange = (legacy.range as Record<string, unknown>) || {};

  return {
    schemaVersion: '1.0.0',
    name: (legacy.name as string) || defaultState.name,
    createdAt: (legacy.createdAt as number) || Date.now(),
    updatedAt: Date.now(),
    randomSeed: (legacy.randomSeed as number) || defaultState.randomSeed,
    geometry: {
      scaleKey: (legacyGeo.scaleKey as string) || (legacy.scaleKey as string) || defaultState.geometry.scaleKey,
      rootKey: (legacyGeo.rootKey as string) || (legacy.rootKey as string) || defaultState.geometry.rootKey,
      circumradius: Number(legacyGeo.circumradius ?? legacy.circumradius ?? defaultState.geometry.circumradius),
      nestingLevels: Number(legacyGeo.nestingLevels ?? legacy.nestingLevels ?? defaultState.geometry.nestingLevels),
      scalingFactor: Number(legacyGeo.scalingFactor ?? legacy.scalingFactor ?? defaultState.geometry.scalingFactor),
    },
    physics: {
      enabled: Boolean(legacyPhysics.enabled ?? legacy.ballEnabled ?? defaultState.physics.enabled),
      damping: Number(legacyPhysics.damping ?? legacy.damping ?? defaultState.physics.damping),
      particleSpeed: Number(legacyPhysics.particleSpeed ?? legacy.particleSpeed ?? defaultState.physics.particleSpeed),
      physicsTick: Number(legacyPhysics.physicsTick ?? legacy.physicsTick ?? defaultState.physics.physicsTick),
      maxBouncesPerStep: Number(legacyPhysics.maxBouncesPerStep ?? defaultState.physics.maxBouncesPerStep),
    },
    audio: {
      maxVoices: Number(legacyAudio.maxVoices ?? legacy.maxVoices ?? defaultState.audio.maxVoices),
      minIOI: Number(legacyAudio.minIOI ?? legacy.minIOI ?? defaultState.audio.minIOI),
      noteDuration: Number(legacyAudio.noteDuration ?? legacy.noteDuration ?? defaultState.audio.noteDuration),
      timbreKey: (legacyAudio.timbreKey as string) || (legacy.timbreKey as string) || defaultState.audio.timbreKey,
      reverbMix: Number(legacyAudio.reverbMix ?? legacy.reverbMix ?? defaultState.audio.reverbMix),
      masterVolume: Number(legacyAudio.masterVolume ?? defaultState.audio.masterVolume),
    },
    mapping: defaultState.mapping,
    midi: {
      ...defaultState.midi,
      outputPortId: (legacyMidi.outputPortId as string) || null,
      channel: Number(legacyMidi.channel ?? defaultState.midi.channel),
      mode: (legacyMidi.mode as MidiMode) || defaultState.midi.mode,
    },
    range: {
      ...defaultState.range,
      enabled: Boolean(legacyRange.enabled ?? defaultState.range.enabled),
      presetId: (legacyRange.presetId as string) || defaultState.range.presetId,
      minMidi: Number(legacyRange.minMidi ?? defaultState.range.minMidi),
      maxMidi: Number(legacyRange.maxMidi ?? defaultState.range.maxMidi),
    },
    uiState: defaultState.uiState,
  };
}
