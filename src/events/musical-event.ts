/**
 * musical-event.ts — Canonical Musical Event Type
 *
 * The universal event format that flows through the entire system.
 * All event sources (physics collisions, keyboard input, MIDI input,
 * chord engine, mouse interaction) produce MusicalEvents.
 * All event consumers (audio engine, MIDI output, visualization, recording)
 * consume MusicalEvents.
 */

// ─── Event Types ─────────────────────────────────────────────────────────────

export type MusicalEventType =
  | 'noteOn'
  | 'noteOff'
  | 'pitchBend'
  | 'control'
  | 'system';

export type MusicalEventSource =
  | 'physics'      // Particle collision
  | 'keyboard'     // Computer keyboard
  | 'mouse'        // Canvas click/drag
  | 'midi-in'      // External MIDI controller
  | 'chord-engine' // Chord button/hotkey
  | 'internal';    // System-generated

// ─── Canonical Event ─────────────────────────────────────────────────────────

export interface MusicalEvent {
  /** Unique event identifier */
  readonly id: string;

  /** AudioContext.currentTime or performance.now()/1000 */
  readonly timestamp: number;

  /** Event type */
  readonly type: MusicalEventType;

  /** Event origin */
  readonly source: MusicalEventSource;

  // ─── Pitch ───────────────────────────────────────────────────────────

  /** Exact frequency in Hz (authoritative pitch value) */
  readonly frequencyHz?: number;

  /** Nearest 12-TET MIDI note number */
  readonly midiNote?: number;

  /** Cent deviation from nearest 12-TET note */
  readonly cents?: number;

  /** Scale degree (0-indexed) */
  readonly scaleDegree?: number;

  /** Octave register */
  readonly register?: number;

  // ─── Performance ─────────────────────────────────────────────────────

  /** MIDI velocity [1, 127] */
  readonly velocity?: number;

  /** Note duration in milliseconds (if known at trigger time) */
  readonly durationMs?: number;

  /** Brightness / timbre [0, 1] (0 = bright ponticello, 1 = warm tasto) */
  readonly brightness?: number;

  /** Stereo pan [-1, 1] */
  readonly pan?: number;

  // ─── Routing ─────────────────────────────────────────────────────────

  /** Standard MIDI channel (0-indexed) for non-MPE output */
  readonly channel?: number;

  /** MPE member channel (assigned by MPEAllocator) */
  readonly mpeChannel?: number;

  /** Whether this event should be sent to internal audio engine */
  readonly audioEnabled?: boolean;

  /** Whether this event should be sent to MIDI output */
  readonly midiEnabled?: boolean;

  // ─── Geometry Context ────────────────────────────────────────────────

  /** Pentagon ring level (0 = outermost) */
  readonly pentagonLevel?: number;

  /** Edge index within the polygon */
  readonly edgeIndex?: number;

  /** Impact position along edge [0, 1] */
  readonly impactParam?: number;

  // ─── Range Mapping ───────────────────────────────────────────────────

  /** Whether this note is within the target instrument range */
  readonly inRange?: boolean;

  /** Number of octaves shifted by range folding */
  readonly foldedOctaves?: number;

  // ─── Control Events ──────────────────────────────────────────────────

  /** MIDI CC number (for control events) */
  readonly controller?: number;

  /** Control value [0, 127] or normalized [0, 1] */
  readonly controlValue?: number;
}

// ─── Event Factory ───────────────────────────────────────────────────────────

let eventCounter = 0;

/** Generate a unique event ID */
export function generateEventId(): string {
  return `evt-${++eventCounter}-${Date.now()}`;
}

/** Reset event counter (for testing) */
export function resetEventCounter(): void {
  eventCounter = 0;
}

/**
 * Create a noteOn event with all required fields.
 */
export function createNoteOnEvent(
  source: MusicalEventSource,
  frequencyHz: number,
  velocity: number,
  timestamp: number,
  options: Partial<Omit<MusicalEvent, 'id' | 'type' | 'source' | 'timestamp' | 'frequencyHz' | 'velocity'>> = {},
): MusicalEvent {
  const exactMidi = 69 + 12 * Math.log2(frequencyHz / 440);
  const baseMidi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - baseMidi) * 100);

  return {
    id: generateEventId(),
    timestamp,
    type: 'noteOn',
    source,
    frequencyHz,
    midiNote: Math.max(0, Math.min(127, baseMidi)),
    cents,
    velocity: Math.max(1, Math.min(127, Math.round(velocity))),
    audioEnabled: true,
    midiEnabled: true,
    ...options,
  };
}

/**
 * Create a noteOff event.
 */
export function createNoteOffEvent(
  source: MusicalEventSource,
  midiNote: number,
  timestamp: number,
  channel?: number,
  mpeChannel?: number,
): MusicalEvent {
  return {
    id: generateEventId(),
    timestamp,
    type: 'noteOff',
    source,
    midiNote,
    channel,
    mpeChannel,
  };
}
