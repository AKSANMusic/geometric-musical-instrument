# Geometric Musical Instrument — Version 2 Rebuild Specification (REBUILD_SPEC_V2.md)
> **Authoritative Architectural Blueprint, Domain Contracts, and Implementation Specification**

---

## 1. Executive Summary & Design Vision

The **Geometric Musical Instrument V2** is an expressive, interactive instrument and generative acoustic engine centered on a **five-sided geometric soundboard (the Pentagon)**.

### Core Product Goal
> *Create a distinctive geometric musical instrument that makes producing pleasant, expressive, musically coherent results easy, immediate, playful, and different from conventional sequencers or synthesizers. The system must feel like an actual instrument, not merely a physics simulation that happens to trigger notes.*

### Foundational Principles
1. **The Pentagon is Invariable:** The soundboard is strictly a 5-sided geometric entity. Scales of 7, 12, 17, or 24 microtonal notes are mapped onto the 5 physical sides via a dedicated **Pitch Mapping Layer**. The geometry is never warped into an N-sided polygon simply because a scale has N degrees.
2. **Four Strict Architectural Layers:**
   - **Layer A: Geometry** (5 sides, circumscribed rings, vertices, string lengths, spatial relationships)
   - **Layer B: Interaction & Physics** (Plucks, swipes, holds, bowing gestures, bouncing particles, orbits, swarms)
   - **Layer C: Musical Intelligence** (HarmonicContext, DensityGovernor, PhraseEngine, MotifMemory, MusicalGate, Tension/Resolution, VoiceLeading)
   - **Layer D: Rendering** (AudioScheduler, VoiceManager, Physical String DSP, Web MIDI / MPE, High-DPI Visuals)
3. **One Canonical Pipeline:**
   $$\text{Gesture / Physics} \to \text{GeometricEvent} \to \text{CandidateIntent} \to \text{MusicalIntelligence} \to \text{MusicalEvent} \to \text{Rendering}$$
4. **Music-Clock Scheduling:** All audio events are scheduled on `AudioContext.currentTime` with a 50–100ms look-ahead window. Physics timestamps map directly to the audio clock. No `setTimeout` for musical rhythms.
5. **Deterministic Musicality:** Seeded pseudo-random number generator (PRNG) makes generative phrases reproducible.
6. **Layered Ergonomics:**
   - **PLAY Mode:** Immediate, intuitive, beautiful defaults (Mood, Energy, Motion, Complexity, Sound, Key).
   - **GENERATE Mode:** Generative controls (Excitation modes, Particle count, Phrase length, Musical Freedom).
   - **LAB Mode:** Deep microtonality, Scala `.scl` loader, MPE channels, DSP params, Voice-leading cost weights.

---

## 2. Repository Audit & Identified Deficiencies in V1

| Subsystem | V1 Status | Identified Issue | V2 Remedy |
| :--- | :--- | :--- | :--- |
| **Application Core** | Monolithic `src/app.ts` (>1,400 lines) | Overburdened with DOM, audio, canvas, MIDI, chords, and timers | Decompose into modular `app/`, `ui/`, `domain/`, `music/`, `audio/` |
| **Event Pipeline** | 3 competing models (`CollisionEvent`, `NoteEvent`, `MusicalEvent`) | Multiple modules recalculate cents, midi note, brightness, and pan | Single canonical pipeline: `GeometricEvent` $\to$ `CandidateIntent` $\to$ `MusicalEvent` |
| **Geometry vs Scale** | Conflated | Edge count was bound to scale length | Fixed 5-sided Pentagon; scale degree mapped via `PitchMapper` |
| **Musical Output** | Chaotic | Every physical collision immediately triggered a sound with no phrase or breathing | `MusicalGate`, `DensityGovernor`, `PhraseEngine`, `MotifMemory` filter and shape notes |
| **Audio Timing** | UI frame-bound / `setTimeout` | Strumming used `setTimeout`; frame drops caused rhythm jitter | `AudioScheduler` with sample-accurate look-ahead on `AudioContext.currentTime` |
| **Voice Allocation** | Decentralized | Split between `VoiceAllocator` and `activeKeyVoices`; duplicate voices for identical pitches | Centralized `VoiceManager` with stable `PitchIdentity` and true common-tone retention |
| **Synthesis** | Basic FM / partial waveguide | Strike position was only a filter cutoff | Karplus-Strong / Waveguide with true $\sin(n\pi u)$ harmonic strike position weighting |
| **Tuning System** | Hardcoded ratios | Inflexible to user microtonal scales | Pure TypeScript `ScalaParser` supporting standard `.scl` files + cents + ratios |
| **State Management** | Distributed in DOM & variables | No central state store; cannot save/load cleanly | Central `ProjectStore` with typed `ProjectState` and seeded PRNG |
| **Safety Master Chain** | Single gain node | Risk of speaker clipping on dense bursts | DC blocker $\to$ Soft Saturation $\to$ Compressor $\to$ Brickwall Limiter $\to$ Master Gain |

---

## 3. The Four-Layer Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER A: GEOMETRY                               │
│  - PentagonModel: Always 5 sides per ring (0 to 4)                     │
│  - RingModel: Concentric rings (Octaves, Harmonics, Echoes, Counterpt) │
│  - GeometrySolver: Physical string lengths & normal vectors            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LAYER B: INTERACTION & PHYSICS                       │
│  - PointerController: Tap, pluck, swipe, drag along side, hold/bow     │
│  - PhysicsEngine: Bounce, Orbit, Rain, Pulse, Swarm excitation modes    │
│  - AttractionFields: Harmonic gravity biasing particle motion          │
│  - Produces: GeometricEvent                                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    LAYER C: MUSICAL INTELLIGENCE                       │
│  - PitchMapper: PhysicalLength, ScaleDegree, ChordTone, ModalFunction  │
│  - HarmonicContext: Tonal center, scale, stability scoring             │
│  - DensityGovernor: Dynamic note budget based on energy & complexity   │
│  - PhraseEngine: 2-8s musical arcs (Initiation, Growth, Peak, Cadence) │
│  - MotifMemory: Pattern storage, transposition, rhythmic variation     │
│  - MusicalGate: Deliberate silence, cadence biasing, tension release   │
│  - VoiceLeading: Multi-voice assignment cost optimization              │
│  - MusicalFreedom: 0-100 slider controlling rule relaxation            │
│  - Produces: MusicalEvent                                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│        LAYER D1: AUDIO DSP        │ │      LAYER D2: MIDI & VISUAL      │
│ - AudioScheduler (Look-ahead)     │ │ - MidiOutput / MPEAllocator       │
│ - VoiceManager (Common-tone tie)  │ │ - Bend-before-note protocol       │
│ - Karplus-Strong String Engine    │ │ - InstrumentView (Canvas 60fps)   │
│ - Harmonic Pluck sin(n*pi*u)      │ │ - Three View Modes:               │
│ - Wooden Body Formant Resonators  │ │   [ PLAY | GENERATE | LAB ]       │
│ - Master Safety Limiter Chain     │ └───────────────────────────────────┘
└───────────────────────────────────┘
```

---

## 4. Universal Data Contracts (`src/domain/`)

### 4.1 `GeometricEvent`
```typescript
export type ExcitationSource = 'manual' | 'collision' | 'orbit' | 'rain' | 'pulse' | 'swarm';

export interface GeometricEvent {
  readonly id: string;
  readonly time: number;                // Simulation timestamp in seconds
  readonly source: ExcitationSource;
  readonly sideIndex: number;           // 0 to 4 (The 5 sides of the Pentagon)
  readonly ringIndex: number;           // 0 = outermost, 1, 2, ...
  readonly normalizedPosition: number;  // u in [0, 1] along the string
  readonly velocity: number;            // [0, 1] impact intensity
  readonly angle?: number;              // Angle of incidence
  readonly durationHint?: number;       // In seconds (for sustained holds)
}
```

### 4.2 `CandidateMusicalIntent`
```typescript
export interface CandidateMusicalIntent {
  readonly geometricEvent: GeometricEvent;
  readonly targetPitchHz: number;
  readonly midiNoteFloat: number;
  readonly scaleDegree: number;
  readonly octave: number;
  readonly stability: number;           // [0, 1] 1 = tonic/stable, 0 = dissonant/passing
  readonly velocity: number;            // [0, 1]
  readonly duration: number;            // In seconds
  readonly brightness: number;          // Spectral centroid weight
  readonly pan: number;                 // [-1, 1]
}
```

### 4.3 `MusicalEvent` (The ONLY Canonical Event to Rendering)
```typescript
export type ArticulationType = 'pluck' | 'strike' | 'sustain' | 'bow' | 'ghost';
export type MusicalRole = 'stable' | 'passing' | 'tension' | 'resolution' | 'ornament' | 'drone';

export interface MusicalEvent {
  readonly id: string;
  readonly time: number;                // Audio clock time (AudioContext.currentTime)
  readonly pitchHz: number;             // Authoritative frequency
  readonly midiNoteFloat: number;       // For MPE / MIDI display
  readonly velocity: number;            // [0, 1]
  readonly duration: number;            // In seconds
  readonly brightness: number;          // Derived from sin(n*pi*u) strike position
  readonly pan: number;                 // [-1, +1]
  readonly articulation: ArticulationType;
  readonly role: MusicalRole;
  readonly phraseId?: string;
  readonly voiceId?: string;
  readonly sourceEventId?: string;
  readonly commonToneRetained?: boolean;
}
```

---

## 5. Musical Intelligence Engine Specification

### 5.1 Density Governor
Controls note throughput per second based on the **Energy** and **Complexity** parameters:
- `noteBudgetPerSecond = 1.5 + (energy / 100) * 8.0 + (complexity / 100) * 6.0`
- If events exceed budget within sliding $1.0\text{s}$ window, low-energy candidate events are dropped or converted into soft ghost notes.

### 5.2 Phrase Engine & Cadence
- Phrase duration: 2.0 to 8.0 seconds (user-configurable).
- Phases:
  1. **Initiation (0–20%):** Low density, stable tonic pitches, gentle attacks.
  2. **Growth (20–60%):** Increasing density, exploration of higher rings, passing tones.
  3. **Peak / Climax (60–80%):** Maximum energy, velocity boost, highest harmonic tension allowed.
  4. **Resolution / Cadence (80–100%):** Energy drop, silence probability increases, pitches strongly biased toward tonic/fifth stability.

### 5.3 Motif Memory & Variation
- Stores the last 3–5 accepted melodic intervals and side sequences.
- Recalls motif with small variations:
  - Transposition (by scale degree)
  - Octave displacement
  - Rhythmic elongation ($\times 1.5$) or compression ($\times 0.75$)
  - Ghost note insertion

### 5.4 Musical Gate & Deliberate Silence
- Rejects candidate notes to let the music breathe.
- Rejection probability:
  $$P(\text{silence}) = (1 - \text{MusicalFreedom}/100) \times P_{\text{phrase}}(\text{phase}) \times \text{recentDensityPenalty}$$

---

## 6. Audio Synthesis & Physical Modeling (`src/audio/`)

### 6.1 Karplus-Strong & Waveguide Core
- Delay line with fractional delay interpolation for continuous cents resolution.
- Strike position harmonic weighting:
  $$A_n = |\sin(n \pi u)| \cdot e^{-0.15 n}$$
  where $u \in [0, 1]$ is normalized pluck position.
- Frequency-dependent loop damping:
  $$H(z) = \frac{1 + S z^{-1}}{2} \cdot \alpha$$

### 6.2 Wooden Body Formant Resonators
- Cello / acoustic body filter bank:
  - $A_0$ Air Cavity: $\sim 98\text{ Hz}$, $Q = 4.0$
  - $T_1$ Wood Corpus: $\sim 220\text{ Hz}$, $Q = 3.2$
  - Bridge Hill: $\sim 2400\text{ Hz}$, $Q = 1.8$

### 6.3 Master Safety Chain
```
Voice Sum ──▶ DC Blocker (Highpass 20Hz) ──▶ Soft Clipper (tanh) ──▶ Light Compressor ──▶ Brickwall Peak Limiter ──▶ Master Gain
```

---

## 7. User Interface Specification (3 Modes)

1. **PLAY Mode (Default):**
   - Clean, elegant interface.
   - Knobs/Sliders: **Mood** (Modal / Scale), **Energy** (0–100), **Motion** (Excitation mode), **Complexity** (0–100), **Musical Freedom** (0–100), **Sound** (Cello / Reed / Santur), **Tonal Center** (C, D, E...).
   - Large central interactive Pentagon canvas.
2. **GENERATE Mode:**
   - Excitation selector (Manual, Bounce, Orbit, Rain, Pulse, Swarm).
   - Particle count, physics gravity/friction, phrase duration, motif repetition probability.
3. **LAB Mode:**
   - Scala `.scl` file upload / text input.
   - MPE channel allocations and RPN configuration.
   - Voice-leading penalty weights.
   - Direct DSP parameters and audio/MIDI diagnostic log.

---

## 8. Implementation Verification & Test Strategy
- Geometry tests: Verify exact 5-sided invariant, stable indexing, normalized coordinates.
- Musical Intelligence tests: Density governor budget, phrase transitions, motif recall, stability scoring.
- Audio tests: Karplus-Strong frequency accuracy, fractional delay cents, strike position harmonic distribution.
- State tests: Deterministic seed replay, project save/load round-trip.
