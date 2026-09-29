# Geometric Musical Instrument & Generative Engine (Version 2)
> **ساز موسیقی هندسی و موتور زایشی نسخه ۲ — بر پایه ۵ ضلعی نامنظم محاطی، هوش موسیقایی، سنتز فیزیکی تار و MPE**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)](https://vitejs.dev/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Waveguide%20DSP-orange.svg)](https://www.w3.org/TR/webaudio/)
[![MPE Ready](https://img.shields.io/badge/MIDI-MPE%2014--Bit-success.svg)](https://www.midi.org/)
[![Tests](https://img.shields.io/badge/Tests-190%20Passing-brightgreen.svg)]()

An expressive geometric musical instrument and generative acoustic engine centered on an **invariable five-sided soundboard (the Pentagon)**.

The instrument makes producing pleasant, expressive, and musically coherent results immediate and playful. It bridges physical acoustic simulation, intelligent musical phrasing, Just Intonation / Persian Dastgah microtonality, and sample-accurate Web Audio look-ahead scheduling.

---

## 🌟 Foundational Principles & V2 Architectural Pillars

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
│  - ExcitationEngine: Bounce, Orbit, Rain, Pulse, Swarm excitation      │
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

### 1. ⬠ Invariable 5-Sided Soundboard
The physical soundboard consists strictly of **5 primary sides per ring**. Scales of any size (5, 7, 12, 17, 24 microtonal notes) are mapped onto the 5 physical sides via a dedicated **Pitch Mapping Layer**. The geometry is never dynamically warped into an $N$-sided polygon, preserving the physical metaphor of the 5-stringed soundboard.

### 2. 🧠 Musical Intelligence & Breathing Phrases
- **Density Governor:** Sliding-window budget ($1.5$ to $15.5\text{ notes/sec}$) dynamically calculated from Energy and Complexity sliders, preventing sonic clutter while converting excess notes into delicate ghost notes.
- **Phrase Engine:** 2.0 to 8.0 second musical cycles traversing 4 distinct phases:
  1. *Initiation (0–20%):* Low density, tonic-grounded, gentle attacks.
  2. *Growth (20–60%):* Increasing density, rising velocity, higher registers.
  3. *Peak (60–80%):* Climax, maximum dynamic energy, harmonic tension tolerated.
  4. *Cadence (80–100%):* Decrescendo, deliberate silence, strong pull toward tonic/fifth resolution.
- **Motif Memory:** Stores thematic intervals and generates coherent musical variations (transposition, rhythmic elongation, octave displacement).
- **Musical Freedom (0–100):** Continuously adjusts the balance between strict modal/tonal phrasing and raw physics.

### 3. 🎻 Physical Modeling String Synthesis & Safety Limiter
- **Waveguide Delay-Line Loop:** Fractional delay line tuned to microtonal cent accuracy.
- **Strike Position Harmonic Weighting:** Plucking at position $u \in [0, 1]$ modulates harmonic amplitudes:
  $$A_n = |\sin(n \pi u)| \cdot e^{-0.15 n}$$
  Plucking at the center ($u = 0.5$) cancels even harmonics (warm, hollow flautando); plucking near the tips ($u \approx 0.05$) excites brilliant upper partials (sul ponticello).
- **Wooden Corpus Formant Resonators:** Triple peaking filter bank modeling an acoustic instrument body ($A_0$ air cavity at $98\text{ Hz}$, $T_1$ wood corpus at $220\text{ Hz}$, bridge resonance at $2400\text{ Hz}$).
- **Master Safety Limiter Chain:**
  $$\text{Voice Sum} \to \text{DC Blocker (20Hz)} \to \text{Soft Clipper (tanh)} \to \text{Dual Compressors} \to \text{Peak Limiter} \to \text{Output}$$

### 4. ⏱️ Sample-Accurate Look-Ahead Audio Scheduler
All musical events are dispatched via `AudioScheduler` referencing `AudioContext.currentTime` with a 75ms look-ahead window. Eliminates `setTimeout` for musical rhythms, guaranteeing rock-solid groove even during heavy UI rendering.

### 5. 🔬 Scala (.scl) Microtonal Tuning Importer
Full support for importing Huygens-Fokker `.scl` files. Enables microtonal exploration across historical, ethnic, and experimental temperaments (Persian Dastgah, Turkish Makam, 17-EDO, Bohlen-Pierce, Just Intonation).

### 6. 🎛️ Three-Tier UX: PLAY | GENERATE | LAB
- **PLAY Mode:** Immediate, clean performance view. Quick access to Mood (Scale), Energy, Motion, Complexity, Musical Freedom, Instrument, and Key, alongside the Left-Hand Accordion & Dastgah Drone console.
- **GENERATE Mode:** Deep generative physics parameters (Bounce, Orbit, Rain, Pulse, Swarm, particle counts, friction, phrase duration, motif repetition).
- **LAB Mode:** Scala `.scl` file upload/paste, voice-leading cost weight adjustment, MPE channel routing status, and live audio telemetry.

---

## 🎮 Interactive Controls & Performance Hotkeys

| Key / Control | Action | Function |
| :---: | :---: | :--- |
| **Mouse Pluck** | Click / Tap on String | Plucks the string at position $u \in [0, 1]$ with harmonic strike weighting |
| **Mouse Swipe** | Drag across Strings | Strums concentric pentagon sides in rapid arpeggiation |
| **Mouse Bow** | Press & Hold on String | Sustained acoustic bowing with continuous resonance |
| `A`–`J` | Accordion Console | Plays modal chords / drone anchors (Tonic, 4th, 5th, Koron 2nd, Neutral 3rd, Koron 6th, Bass) |
| `Spacebar` | Pause / Resume | Toggles generative simulation and phrase clock |
| `R` | Reset | Clears active voices, resets density governor and phrase engine |

---

## 🛠️ Verification & Test Suite

The project includes **190 automated unit tests** across 15 suites covering geometry, physical CCD collision detection, pitch calculation, MPE channel allocation, voice leading, phrase engines, density governors, Scala parsing, and audio DSP:

```bash
# Run complete test suite
npm test

# Type-check without emit
npx tsc --noEmit

# Build production bundle
npm run build
```

---

## 📜 Architecture Documentation

- [REBUILD_SPEC_V2.md](./REBUILD_SPEC_V2.md) — Authoritative Version 2 Architecture & Domain Specification
- [docs/01_THEORY_AND_MATHEMATICS.md](./docs/01_THEORY_AND_MATHEMATICS.md) — Mathematical foundations of cyclic polygons and physics
- [docs/02_AUDIO_DSP_AND_SYNTHESIS.md](./docs/02_AUDIO_DSP_AND_SYNTHESIS.md) — Audio DSP and physical string waveguide modeling
- [docs/03_MIDI_MPE_SPECIFICATION.md](./docs/03_MIDI_MPE_SPECIFICATION.md) — 14-bit pitch bend, MPE channels, and RPN configuration
- [docs/04_CHORD_HARMONY_AND_VOICE_LEADING.md](./docs/04_CHORD_HARMONY_AND_VOICE_LEADING.md) — Voice leading cost optimization and modal harmony
