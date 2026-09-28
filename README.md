# Geometric Musical Instrument & MIDI/MPE Generator
> **ساز موسیقی هندسی و مولد MIDI/MPE بر پایه چندضلعی‌های محاطی، کوک میکروتونال و فیزیک برخورد**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)](https://vitejs.dev/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-240Hz%20Physics-orange.svg)](https://www.w3.org/TR/webaudio/)
[![MPE Ready](https://img.shields.io/badge/MIDI-MPE%2014--Bit-success.svg)](https://www.midi.org/)
[![Tests](https://img.shields.io/badge/Tests-153%20Passing-brightgreen.svg)]()

An interactive, microtonal musical instrument and real-time algorithmic MIDI/MPE generator. The instrument transforms dynamic geometric motion, irregular cyclic polygon collisions, and harmonic ratios into microtonal acoustics, intelligent voice leading, and high-resolution MIDI output for hardware synthesizers, virtual instruments (VST/AU), and DAWs.

---

## 🌟 Key Capabilities & Architectural Pillars

### 1. 📐 Computational Geometry & Irregular Cyclic Polygons
- **Cyclic Polygon Solver:** Inscribes arbitrary $N$-sided polygons in concentric circles where edge lengths represent musical wavelength ratios.
- **Ptolemy / Bisection Solver:** Solves the non-linear transcendental closure equation $\sum_{i=1}^N \arcsin(\lambda r_i) = \pi$ to double precision ($10^{-12}$).
- **Concentric Homothety:** Nested concentric polygons scaled by factor $k = 0.5$ produce octave transpositions per ring.

### 2. 🎛️ Microtonal Pitch Engine & Eastern Modal Systems
- **Just Intonation & Persian Dastgah:** Native support for pure harmonic ratios and microtonal neutral intervals (Koron $\text{p}$ / Sori $\text{t}$ in Dastgah-e Shur, Mahur, Homayoun, Segah).
- **Exact Cent Resolution:** High-precision cent calculations with automatic detection of microtonal deviations ($|\Delta\text{cents}| \ge 20$).

### 3. 🎹 Accordion-Style Harmony & Smooth Voice Leading
- **Physical Key-Hold Sustains:** Pressing chord keys (`A`–`J`) sustains notes continuously (like accordion bellows or organ reeds), dissolving smoothly when transitioning.
- **Minimal Voice Travel Optimization:** An intelligent voice-leading algorithm calculates optimal octave inversions and voice assignments that minimize $\sum |\Delta\text{pitch}|$, preventing disjointed harmonic leaps.
- **Common-Tone Retention:** Sustained common tones between adjacent chords are tied over without jarring re-triggers.

### 4. 🎻 Instrument Range Constraints & Octave Folding
- **Target Instrument Confinement:** Restricts output to physical instrument tessituras (e.g. Cello: $C_2$ $65.4\text{ Hz}$ to $G_5$ $784\text{ Hz}$).
- **Automatic Octave Folding:** Transposes out-of-range notes by exact octaves ($f \cdot 2^{\pm n}$) to preserve harmonic degree and microtonal inflection within playable range.

### 5. ⚡ MPE (MIDI Polyphonic Expression) & 14-Bit Pitch Bend
- **Channel-Per-Note Isolation:** Solves the polyphonic microtonal MIDI limitation by allocating member channels (Channels 2–15 in Lower Zone), isolating pitch bend per note.
- **Bend-Before-Note Invariant:** Guarantees that 14-bit pitch bend (`0xEn`) messages precede `NoteOn` (`0x9n`), eliminating audible pitch-swoop artifacts.
- **Channel Exhaustion Policies:** Supports `steal-oldest`, `quantize` (12-TET master fallback), `reject`, and `internal-only` strategies.

### 6. 🔊 Web Audio DSP & Physical Modeling
- **FM Synthesis Voice:** 2-operator FM cluster with dynamic modulation index $I(u)$ mapped to the physical collision impact parameter $u \in [0, 1]$ (center = warm/tasto, edge = bright/ponticello).
- **Acoustic Body & Spatialization:** Stereo panning across polygon edges, resonant lowpass filtering, early reflection convolution reverb, and a 20Hz DC-blocker.

---

## 🎮 Live Performance & Interactive Controls

| Category | Key / Action | Function |
| :--- | :---: | :--- |
| **Chords (Left Hand)** | `A` | **Tonic Major / Root Chord** (1/1, 5/4, 3/2) |
| | `S` | **Subdominant Chord** (4/3, 5/3, 2/1) |
| | `D` | **Dominant Chord** (3/2, 15/8, 9/4) |
| | `F` | **Relative Minor Chord** (5/3, 1/1, 5/4) |
| | `G` | **Koron Modal Chord** (Dastgah Shur: 1/1, 12/11, 3/2) |
| | `H` | **Extended 7th Chord** |
| | `J` | **Deep Pedal Bass Chord** |
| **Melody (Right Hand)** | `1`–`7` | **Soprano Melody Notes** (High register lead over chords) |
| **Physics Interaction** | **Click & Drag** | Launch new energetic particles with directional impulse |
| | **Spacebar** | Pause / Resume physics simulation |
| | `R` | Reset particle states and clear active voices |
| **Audio Controls** | `M` | Master Mute / Unmute toggle |
| | `[` / `]` | Decrease / Increase master volume |
| **Range Filter** | `C` | Toggle **Cello Range Confinement** ($C_2$–$G_5$) |

---

## 📁 Repository Structure

```
├── docs/                                  # In-depth architectural & AI documentation
│   ├── 01_THEORY_AND_MATHEMATICS.md       # Cyclic polygons, bisection solver, CCD physics
│   ├── 02_AUDIO_DSP_AND_SYNTHESIS.md      # Web Audio graph, FM synthesis, voice allocator
│   ├── 03_MIDI_MPE_SPECIFICATION.md       # MPE protocols, 14-bit pitch bend, bend-before-note
│   ├── 04_CHORD_HARMONY_AND_VOICE_LEADING.md # Accordion mechanics, voice leading, range folding
│   └── 05_AI_RECONSTRUCTION_PROMPT.md     # Complete LLM/AI blueprint for rebuilding codebase
├── src/
│   ├── __tests__/                         # Comprehensive Vitest test suites (153 tests)
│   ├── audio/                             # DSP, synthesis, voice allocation, reverb
│   │   ├── chord-engine.ts                # Harmonic presets & voice leading engine
│   │   ├── fm-synth.ts                    # FM voice cluster with dynamic timbre
│   │   ├── instrument-range.ts            # Acoustic tessituras & octave folding
│   │   ├── renderer.ts                    # Master audio graph & DC blocker
│   │   ├── reverb.ts                      # Early reflection synthetic reverb
│   │   └── voice-allocator.ts             # De-bounce & priority voice stealing
│   ├── events/                            # Canonical event layer
│   │   └── musical-event.ts               # Universal MusicalEvent contract
│   ├── geometry/                          # Computational geometry
│   │   ├── constants.ts                   # Just Intonation & modal ratios
│   │   └── solver.ts                      # Bisection solver & validation
│   ├── mapping/                           # Event mapping & normalization
│   ├── midi/                              # MIDI & MPE drivers
│   │   ├── midi-manager.ts                # Web MIDI API interface
│   │   ├── midi-types.ts                  # MIDI types & interfaces
│   │   └── mpe-allocator.ts               # MPE Channel Allocator & RPN sender
│   ├── physics/                           # Continuous collision detection engine
│   │   ├── collision.ts                   # 2D Cramer's rule ray-segment intersection
│   │   └── engine.ts                      # Sub-stepping physics loop
│   ├── pitch/                             # Pitch descriptor & cent math
│   │   └── pitch-engine.ts                # Hz ↔ MIDI ↔ 14-bit pitch bend
│   ├── schemas/                           # State validation & project schemas
│   │   └── project-schema.ts              # Zod schemas & migration
│   ├── visualization/                     # High-DPI Canvas rendering
│   │   ├── canvas-renderer.ts             # Double-buffered canvas graphics
│   │   └── range-keyboard.ts              # Interactive range visualizer
│   ├── app.ts                             # Orchestration & lifecycle manager
│   ├── config.ts                          # Default sequencer parameters
│   └── types.ts                           # Shared TypeScript interfaces
├── index.html                             # Main application UI & layout
├── REVERSE_ENGINEERING_SPEC.md            # Comprehensive reverse engineering specification
├── tsconfig.json                          # TypeScript configuration
└── vite.config.ts                         # Vite configuration
```

---

## 🚀 Quick Start & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- Modern web browser with Web Audio API and Web MIDI API support (Chrome, Edge, Brave)

### Installation
```bash
# Clone the repository
git clone https://github.com/AKSANMusic/geometric-musical-instrument.git
cd geometric-musical-instrument

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```
Open your browser at `http://localhost:5173`. Click the canvas once to unlock the Web Audio context.

### Running Test Suite
```bash
# Run Vitest test runner across all 153 tests
npm test

# Run tests in continuous watch mode
npm run test:watch
```

### Production Build
```bash
# Build optimized production bundle to dist/
npm run build
```

---

## 🤖 AI & LLM Machine-Readability

This repository is optimized for autonomous AI agents, LLMs, and code synthesis tools:
- **Architecture Blueprints:** Refer to [`docs/05_AI_RECONSTRUCTION_PROMPT.md`](docs/05_AI_RECONSTRUCTION_PROMPT.md) for strict data contracts, state machines, and generation sequences.
- **Mathematical Formulations:** Refer to [`docs/01_THEORY_AND_MATHEMATICS.md`](docs/01_THEORY_AND_MATHEMATICS.md) for exact LaTeX equations.
- **Hardware/DAW Protocol:** Refer to [`docs/03_MIDI_MPE_SPECIFICATION.md`](docs/03_MIDI_MPE_SPECIFICATION.md) for byte-level MIDI message structures.

---

## 📄 License
This project is open-source under the MIT License.
