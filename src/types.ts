// types.ts — Shared interfaces (API contract between all modules)

/** Immutable 2D vector */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** A single edge of a pentagon, mapping to a musical pitch */
export interface Edge {
  readonly index: number;
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly normal: Vec2;       // outward-pointing unit normal
  readonly length: number;
  readonly frequency: number;  // Hz — Just Intonation pitch
  readonly jiRatio: number;    // frequency-domain JI ratio (e.g. 9/8)
  readonly label: string;      // human-readable interval name
}

/** A single pentagon (one nesting level) */
export interface Pentagon {
  readonly vertices: ReadonlyArray<Vec2>;
  readonly edges: ReadonlyArray<Edge>;
  readonly circumradius: number;
  readonly level: number;      // 0 = outermost
}

/** Mutable particle state */
export interface ParticleState {
  pos: Vec2;
  vel: Vec2;
  readonly radius: number;
  readonly id: number;
}

/** Emitted when a particle strikes an edge */
export interface CollisionEvent {
  readonly particle: ParticleState;
  readonly edge: Edge;
  readonly pentagon: Pentagon;
  readonly impactPoint: Vec2;
  readonly impactParam: number;    // [0, 1] position along edge
  readonly impactSpeed: number;    // |v · n| at moment of impact
  readonly timestamp: number;      // simulation time in seconds
}

/** Musical note derived from a collision */
export interface NoteEvent {
  readonly frequency: number;
  readonly midiNote: number;
  readonly midiVelocity: number;   // [1, 127]
  readonly brightness: number;     // 0 = bright (ponticello), 1 = warm (tasto)
  readonly pentagonLevel: number;
  readonly edgeIndex: number;
  readonly timestamp: number;
  readonly pan: number;            // [-1, 1] stereo position
}

/** Global configuration */
export interface SequencerConfig {
  circumradius: number;
  baseFrequency: number;
  nestingLevels: number;
  scalingFactor: number;           // k (default 0.5 = octave)
  damping: number;                 // [0, 1] energy retention per bounce
  maxVoices: number;
  particleSpeed: number;           // initial |v|
  physicsTick: number;             // seconds per physics step
  minIOI: number;                  // minimum inter-onset interval in ms
  noteDuration: number;            // seconds
  scaleKey?: string;               // current scale key (e.g. 'majorPentatonic')
  rootKey?: string;                // current root note key (e.g. 'A')
  ballEnabled?: boolean;           // whether bouncing ball particle is active
  timbreKey?: string;              // acoustic instrument preset (e.g. 'santur')
  reverbMix?: number;              // [0, 1] wet reverb level
}

/** Vec2 utility functions */
export const vec2 = {
  add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; },
  sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; },
  scale(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s }; },
  dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; },
  len(v: Vec2): number { return Math.hypot(v.x, v.y); },
  normalize(v: Vec2): Vec2 {
    const l = Math.hypot(v.x, v.y);
    return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
  },
  rotate(v: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  },
} as const;
