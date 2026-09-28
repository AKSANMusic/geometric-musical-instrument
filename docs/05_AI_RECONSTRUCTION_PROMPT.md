# AI Reconstruction & Autonomous Agent Blueprint

This document is engineered specifically for Large Language Models (LLMs), AI coding agents, and automated code synthesizers. It provides the strict architecture contracts, execution steps, type schemas, and verification suites necessary to reconstruct or modify this project from scratch without ambiguity.

---

## 1. System High-Level Topology

```
                  ┌──────────────────────────────────────────┐
                  │               Input Sources              │
                  │  - Canvas Mouse/Touch                    │
                  │  - Computer Keyboard (A-J Chords, 1-7 Mel)│
                  │  - External MIDI In Controller           │
                  │  - Physics Engine Collision Events       │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │             Mapping Engine               │
                  │  - MusicalEvent Canonical Normalizer     │
                  │  - PitchEngine (Hz, Cents, Microtonal)   │
                  │  - Instrument Range & Octave Folder      │
                  │  - Intelligent Voice Leading Optimizer   │
                  └────────────────────┬─────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       ▼                               ▼
       ┌──────────────────────────────┐ ┌──────────────────────────────┐
       │     Internal Audio Engine    │ │        MIDI/MPE Engine       │
       │ - VoiceAllocator (Stealing)  │ │ - MPEAllocator (Zone Map)    │
       │ - FMVoice Polyphonic Clust.  │ │ - Bend-Before-Note Dispatch  │
       │ - 20Hz DC-Blocker Biquad     │ │ - 14-Bit Pitch Bend Calc     │
       │ - Early Reflection Reverb    │ │ - Web MIDI API Sender        │
       └──────────────────────────────┘ └──────────────────────────────┘
                       ▲                               ▲
                       └───────────────┬───────────────┘
                                       │
                  ┌────────────────────┴─────────────────────┐
                  │        Visualization & Project State     │
                  │ - 60 FPS HTML5 Canvas Double-Buffering   │
                  │ - Zod-Validated JSON Schema Migration    │
                  └──────────────────────────────────────────┘
```

---

## 2. Universal Data Contracts

### 2.1 Canonical Musical Event (`MusicalEvent`)
Every signal in the codebase is represented as an immutable `MusicalEvent`:
```typescript
interface MusicalEvent {
  readonly id: string;               // e.g. "evt-1-1727548000000"
  readonly timestamp: number;        // audioContext.currentTime or seconds
  readonly type: 'noteOn' | 'noteOff' | 'pitchBend' | 'control' | 'system';
  readonly source: 'physics' | 'keyboard' | 'mouse' | 'midi-in' | 'chord-engine' | 'internal';
  
  // Pitch (Hz is authoritative, MIDI is secondary/display)
  readonly frequencyHz?: number;
  readonly midiNote?: number;
  readonly cents?: number;           // [-50, +50]
  readonly isMicrotonal?: boolean;
  readonly scaleDegree?: number;
  readonly register?: number;

  // Performance & Timbre
  readonly velocity?: number;        // [1, 127]
  readonly brightness?: number;      // [0, 1] (0 = ponticello, 1 = tasto)
  readonly pan?: number;             // [-1, +1]

  // Routing
  readonly channel?: number;
  readonly mpeChannel?: number;
  readonly audioEnabled?: boolean;
  readonly midiEnabled?: boolean;

  // Instrument Range
  readonly inRange?: boolean;
  readonly foldedOctaves?: number;
}
```

### 2.2 Canonical Pitch Descriptor (`PitchDescriptor`)
```typescript
interface PitchDescriptor {
  readonly frequency: number;
  readonly midiNote: number;
  readonly fractionalMidi: number;
  readonly centsOffset: number;
  readonly scaleDegree: number;
  readonly register: number;
  readonly label: string;
  readonly isMicrotonal: boolean;
}
```

---

## 3. Step-by-Step Implementation Sequence

If an AI agent needs to regenerate or re-implement this codebase:

1. **Step 1: Core Math & Geometry**
   - Implement `src/types.ts`: 2D vectors (`vec2`), immutable polygon structures (`Polygon`, `Edge`).
   - Implement `src/geometry/constants.ts`: Just Intonation ratios $[1, 9/8, 5/4, 3/2, 5/3]$.
   - Implement `src/geometry/solver.ts`: Bisection solver finding $\lambda$ for $\sum \arcsin(\lambda r_i) = \pi$, angle assignment, and outward normal vectors.

2. **Step 2: Physics Simulation (Continuous Collision Detection)**
   - Implement `src/physics/collision.ts`: 2D Cramer's rule ray-segment intersection solver returning $(t, u)$.
   - Implement `src/physics/engine.ts`: Sub-stepping loop, bounce reflections, anti-sticking normal offsets.

3. **Step 3: Pitch & Event Abstractions**
   - Implement `src/pitch/pitch-engine.ts`: Exact conversions between Hz, fractional MIDI, and 14-bit pitch bend.
   - Implement `src/events/musical-event.ts`: Canonical event definitions and factory methods.

4. **Step 4: MPE Channel Allocation**
   - Implement `src/midi/mpe-allocator.ts`: Lower/Upper zone channel manager, bend-before-note guarantee, RPN sensitivity configuration, channel exhaustion strategies (`steal-oldest`, `quantize`, `reject`).

5. **Step 5: Web Audio Synthesis & DSP**
   - Implement `src/audio/fm-synth.ts`: FM voice with carrier, modulator, dynamic modulation index $I(u)$, resonant lowpass filter, and clean ADSR envelopes.
   - Implement `src/audio/voice-allocator.ts`: De-bounce timer (`minIOI`), priority-based voice stealing, dynamic ducking.
   - Implement `src/audio/renderer.ts`: Master audio graph with 20Hz highpass DC-blocker.
   - Implement `src/audio/reverb.ts`: Acoustic convolution simulation.

6. **Step 6: Voice Leading & Harmonic Interaction**
   - Implement `src/audio/chord-engine.ts`: Accordion harmonic presets, minimal voice travel metric, sustained key holds.
   - Implement `src/audio/instrument-range.ts`: Acoustic boundary limits (Cello, Piano, Violin) and octave folding.

7. **Step 7: Canvas Double-Buffering & App Orchestration**
   - Implement `src/visualization/canvas-renderer.ts`: High-DPI canvas rendering, particle glow trails, polygon edge labels, impact flash waves.
   - Implement `src/app.ts`: Main animation loop, keyboard event listeners (`keydown`/`keyup`), MIDI port selection.

---

## 4. Verification & Testing Manifesto

Any reconstruction must pass these minimum verification criteria:
- **TypeScript Typecheck:** `npx tsc --noEmit` must return 0 errors under `strict: true`.
- **Unit & Integration Tests:** All test suites in `src/__tests__/` must execute with 100% pass rate:
  1. `geometry.test.ts`: Bisection convergence, angle sum closure $= 2\pi$.
  2. `solver-validation.test.ts`: Error handling for $N < 3$, non-finite ratios, degenerate angles.
  3. `physics.test.ts`: Continuous collision detection, reflection angles, energy conservation.
  4. `pitch-engine.test.ts`: Cents calculation, Koron quarter-tone detection, 14-bit pitch bend round-trips.
  5. `mpe-allocator.test.ts`: Bend-before-note message ordering, channel reuse, panic routines.
  6. `chord.test.ts`: Minimal voice travel distance, common tone retention.
  7. `instrument-range.test.ts`: Octave folding for out-of-range notes.
  8. `schemas-and-mapping.test.ts`: State serialization and migration.
