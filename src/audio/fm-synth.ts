/**
 * fm-synth.ts — Physical Modeling & Dynamic FM Acoustic String Voice
 *
 * Implements:
 * 1. Dual detuned acoustic string pairing (natural unison shimmer / chorus)
 * 2. Dynamic transient FM pluck: High brightness on attack transient (mezrab strike),
 *    decaying rapidly to pure, warm, singing fundamental.
 * 3. Dynamic acoustic string damping filter (exponential cutoff decay)
 * 4. Frequency-proportional natural decay (lower bass rings ring longer)
 */

import type { NoteEvent } from '../types';

export interface InstrumentPreset {
  id: string;
  name: string;
  carrierType: OscillatorType;
  subCarrierType: OscillatorType;
  subCarrierDetune: number;      // cents (e.g. +2.5 cents for santur pair shimmer)
  subCarrierMix: number;         // volume ratio of second string
  modRatio: number;              // C:M frequency ratio
  peakModScale: number;          // FM index at peak pluck impact
  sustainModRatio: number;       // FM index retained during sustained ring
  pluckDecayMs: number;          // Transient strike decay time in ms
  filterPeakRatio: number;       // Cutoff frequency multiplier at impact
  filterBaseRatio: number;       // Cutoff frequency multiplier at sustain
  filterQ: number;               // Filter resonance
  attackSeconds: number;         // Strike onset time
  isSustained?: boolean;         // True for accordion/cello: holds tone while key is pressed!
  sustainLevel?: number;         // Amplitude ratio [0..1] maintained during key hold
  releaseSeconds?: number;       // Fade-out decay time when key is released
}

export const INSTRUMENT_PRESETS: Record<string, InstrumentPreset> = {
  accordion: {
    id: 'accordion',
    name: 'آکاردئون آکوستیک (Acoustic Accordion)',
    carrierType: 'triangle',
    subCarrierType: 'sawtooth',
    subCarrierDetune: 5.6,        // Classic French Musette dual-reed tremolo shimmer
    subCarrierMix: 0.38,
    modRatio: 1.0,
    peakModScale: 1.4,
    sustainModRatio: 0.30,
    pluckDecayMs: 40,
    filterPeakRatio: 4.8,
    filterBaseRatio: 2.6,
    filterQ: 1.4,
    attackSeconds: 0.020,         // Gentle acoustic bellows air pressure build
    isSustained: true,
    sustainLevel: 0.75,           // Holds continuous rich harmony while key is pressed
    releaseSeconds: 0.20,         // Natural bellows air release on keyup
  },
  swamCello: {
    id: 'swamCello',
    name: 'ویولنسل آرشه‌ای (SWAM Cello & Strings)',
    carrierType: 'sawtooth',
    subCarrierType: 'triangle',
    subCarrierDetune: 2.2,
    subCarrierMix: 0.42,
    modRatio: 1.0,
    peakModScale: 0.9,
    sustainModRatio: 0.22,
    pluckDecayMs: 70,
    filterPeakRatio: 3.8,
    filterBaseRatio: 2.2,
    filterQ: 2.4,                 // Warm wooden cello body formant
    attackSeconds: 0.035,         // Rosined horsehair bow attack
    isSustained: true,
    sustainLevel: 0.80,
    releaseSeconds: 0.25,
  },
  santur: {
    id: 'santur',
    name: 'سنتور و قانون (Santur & Kanun)',
    carrierType: 'sine',
    subCarrierType: 'triangle',
    subCarrierDetune: 3.2,        // Natural acoustic 3-string course shimmer
    subCarrierMix: 0.35,
    modRatio: 2.0,
    peakModScale: 3.2,
    sustainModRatio: 0.10,
    pluckDecayMs: 55,
    filterPeakRatio: 6.0,
    filterBaseRatio: 2.2,
    filterQ: 2.0,
    attackSeconds: 0.003,
    isSustained: false,
    releaseSeconds: 0.30,
  },
  celestialHarp: {
    id: 'celestialHarp',
    name: 'چنگ آسمانی (Celestial Harp)',
    carrierType: 'sine',
    subCarrierType: 'sine',
    subCarrierDetune: -1.8,
    subCarrierMix: 0.35,
    modRatio: 1.0,
    peakModScale: 1.6,
    sustainModRatio: 0.04,
    pluckDecayMs: 90,
    filterPeakRatio: 4.2,
    filterBaseRatio: 1.8,
    filterQ: 1.0,
    attackSeconds: 0.010,
    isSustained: false,
    releaseSeconds: 0.40,
  },
  silkLute: {
    id: 'silkLute',
    name: 'تار و تنبور (Silk Lute & Tanbur)',
    carrierType: 'triangle',
    subCarrierType: 'sine',
    subCarrierDetune: 3.2,
    subCarrierMix: 0.36,
    modRatio: 3.0,
    peakModScale: 2.8,
    sustainModRatio: 0.18,
    pluckDecayMs: 45,
    filterPeakRatio: 5.5,
    filterBaseRatio: 2.5,
    filterQ: 2.4,
    attackSeconds: 0.004,
    isSustained: false,
    releaseSeconds: 0.25,
  },
  ambientBell: {
    id: 'ambientBell',
    name: 'پیانو و بلز بلورین (Ambient Glass Bell)',
    carrierType: 'sine',
    subCarrierType: 'sine',
    subCarrierDetune: 1.5,
    subCarrierMix: 0.28,
    modRatio: 2.756,             // inharmonic bell-like spectrum
    peakModScale: 3.8,
    sustainModRatio: 0.08,
    pluckDecayMs: 130,
    filterPeakRatio: 7.5,
    filterBaseRatio: 2.0,
    filterQ: 1.6,
    attackSeconds: 0.006,
    isSustained: false,
    releaseSeconds: 0.50,
  },
};

export class FMVoice {
  private carrier1: OscillatorNode;
  private carrier2: OscillatorNode;
  private subGain: GainNode;
  private modulator: OscillatorNode;
  private modGain: GainNode;
  private filter: BiquadFilterNode;
  private ampEnv: GainNode;
  private panner: StereoPannerNode;
  private ctx: AudioContext;

  public readonly id: number;
  public readonly startTime: number;
  public readonly note: NoteEvent;
  public readonly actualDuration: number;
  public readonly peakGain: number;
  public readonly preset: InstrumentPreset;
  public ended = false;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    note: NoteEvent,
    duration: number,
    voiceId: number,
    gainMultiplier = 1,
    preset: InstrumentPreset = INSTRUMENT_PRESETS.santur,
    scheduledStartTime?: number,
  ) {
    this.ctx = ctx;
    this.id = voiceId;
    this.note = note;
    this.preset = preset;

    const ctxNow = ctx.currentTime;
    const start = (scheduledStartTime !== undefined && scheduledStartTime > ctxNow) ? scheduledStartTime : ctxNow;
    this.startTime = start;

    // Physical acoustic duration scaling: Lower frequencies sustain longer
    const pitchScale = Math.max(0.7, Math.min(1.7, Math.sqrt(440 / Math.max(80, note.frequency))));
    const actualDuration = duration * pitchScale;
    this.actualDuration = actualDuration;

    // --- Carrier 1 (Primary string/reed) ---
    this.carrier1 = ctx.createOscillator();
    this.carrier1.type = preset.carrierType;
    this.carrier1.frequency.setValueAtTime(note.frequency, start);

    // --- Carrier 2 (Acoustic Unison Pair with micro-detune) ---
    this.carrier2 = ctx.createOscillator();
    this.carrier2.type = preset.subCarrierType;
    this.carrier2.frequency.setValueAtTime(note.frequency, start);
    this.carrier2.detune.setValueAtTime(preset.subCarrierDetune, start);

    this.subGain = ctx.createGain();
    this.subGain.gain.setValueAtTime(preset.subCarrierMix, start);
    this.carrier2.connect(this.subGain);

    // --- Dynamic Transient FM Modulator ---
    this.modulator = ctx.createOscillator();
    this.modGain = ctx.createGain();

    // Modulator frequency is harmonic multiple of carrier
    this.modulator.frequency.setValueAtTime(note.frequency * preset.modRatio, start);

    // Modulation index: dynamic envelope with quick pluck decay
    const strikeBrightness = Math.max(0.2, 1 - 0.7 * note.brightness);
    const peakMod = preset.peakModScale * strikeBrightness;
    const sustainMod = peakMod * preset.sustainModRatio;
    const pluckDecaySec = preset.pluckDecayMs / 1000;

    const initialModGain = note.frequency * peakMod;
    const sustainModGain = Math.max(1, note.frequency * sustainMod);

    this.modGain.gain.setValueAtTime(initialModGain, start);
    this.modGain.gain.exponentialRampToValueAtTime(
      sustainModGain,
      start + preset.attackSeconds + pluckDecaySec,
    );

    this.modulator.connect(this.modGain);
    this.modGain.connect(this.carrier1.frequency);
    this.modGain.connect(this.carrier2.frequency);

    // --- Dynamic Damping Filter ---
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.setValueAtTime(preset.filterQ, start);

    const peakCutoff = Math.min(18000, note.frequency * preset.filterPeakRatio * (1 + 0.5 * (1 - note.brightness)));
    const baseCutoff = Math.max(200, note.frequency * preset.filterBaseRatio);

    this.filter.frequency.setValueAtTime(peakCutoff, start);
    this.filter.frequency.exponentialRampToValueAtTime(
      baseCutoff,
      start + Math.min(actualDuration, 0.45),
    );

    // --- Amplitude Envelope with Sustain/Release support ---
    this.ampEnv = ctx.createGain();
    const velocity = (note.midiVelocity / 127) * gainMultiplier;
    const attack = preset.attackSeconds;
    const peakGain = velocity * 0.28;
    this.peakGain = peakGain;

    this.ampEnv.gain.setValueAtTime(0, start);
    this.ampEnv.gain.linearRampToValueAtTime(peakGain, start + attack);
    this.ampEnv.gain.setValueAtTime(peakGain, start + attack);

    if (preset.isSustained) {
      // Sustained instruments (Accordion, Cello):
      // Holds continuous rich tone while key is held down!
      const sustainGain = peakGain * (preset.sustainLevel ?? 0.75);
      this.ampEnv.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, sustainGain),
        start + attack + 0.12,
      );
    } else {
      // Plucked/percussive instruments (Santur, Harp, Lute):
      // Natural exponential release curve
      this.ampEnv.gain.exponentialRampToValueAtTime(0.0001, start + actualDuration);
    }

    // --- Stereo Panner ---
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = note.pan;

    // --- Connect Graph ---
    this.carrier1.connect(this.filter);
    this.subGain.connect(this.filter);
    this.filter.connect(this.ampEnv);
    this.ampEnv.connect(this.panner);
    this.panner.connect(destination);

    // --- Start & Schedule Lifecycle ---
    this.carrier1.start(start);
    this.carrier2.start(start);
    this.modulator.start(start);

    if (!preset.isSustained) {
      // Auto-stop for percussive instruments
      const stopTime = start + actualDuration + 0.08;
      this.carrier1.stop(stopTime);
      this.carrier2.stop(stopTime);
      this.modulator.stop(stopTime);
    }

    this.carrier1.onended = () => {
      this.ended = true;
      this.disconnect();
    };
  }

  /**
   * Release voice smoothly on keyup / note-off.
   * Enables authentic accordion bellows breathing, legato cello bowing, and natural dampening.
   */
  public release(releaseSec?: number): void {
    if (this.ended) return;
    try {
      const now = this.ctx.currentTime;
      const relTime = releaseSec ?? this.preset.releaseSeconds ?? 0.22;
      this.ampEnv.gain.cancelScheduledValues(now);
      this.ampEnv.gain.setValueAtTime(Math.max(0.0001, this.ampEnv.gain.value), now);
      this.ampEnv.gain.exponentialRampToValueAtTime(0.0001, now + relTime);

      const stopTime = now + relTime + 0.06;
      this.carrier1.stop(stopTime);
      this.carrier2.stop(stopTime);
      this.modulator.stop(stopTime);

      setTimeout(() => {
        this.ended = true;
        this.disconnect();
      }, (relTime + 0.1) * 1000);
    } catch {
      // Already stopped
    }
  }

  /**
   * Calculate a voice priority score for intelligent voice stealing.
   * Lower score = lower priority (safe to steal).
   * Takes into account:
   * 1. Estimated current amplitude envelope
   * 2. Bass / fundamental importance (low frequencies preserved)
   * 3. Attack transient protection (recent strikes given immunity bonus)
   */
  public getPriorityScore(now: number): number {
    const age = Math.max(0, now - this.startTime);
    const progress = Math.min(1, age / this.actualDuration);
    // Estimated decay curve
    const ampRatio = Math.max(0.001, Math.exp(-progress * 4));
    const currentAmp = this.peakGain * ampRatio;

    // Bass protection: fundamentals < 220Hz are harmonic anchors
    const bassMultiplier = this.note.frequency < 160 ? 2.5 : (this.note.frequency < 330 ? 1.8 : 1.0);

    // Attack transient bonus: keep strikes younger than 100ms
    const transientBonus = age < 0.1 ? 400 : 0;

    return currentAmp * 1000 * bassMultiplier + transientBonus;
  }

  /** Force-stop this voice immediately without clicking */
  stop(): void {
    try {
      const now = this.ctx.currentTime;
      this.ampEnv.gain.cancelScheduledValues(now);
      this.ampEnv.gain.setValueAtTime(this.ampEnv.gain.value, now);
      this.ampEnv.gain.linearRampToValueAtTime(0, now + 0.015);
      this.carrier1.stop(now + 0.02);
      this.carrier2.stop(now + 0.02);
      this.modulator.stop(now + 0.02);
    } catch {
      // Already stopped
    }
  }

  private disconnect(): void {
    try {
      this.carrier1.disconnect();
      this.carrier2.disconnect();
      this.subGain.disconnect();
      this.modulator.disconnect();
      this.modGain.disconnect();
      this.filter.disconnect();
      this.ampEnv.disconnect();
      this.panner.disconnect();
    } catch {
      // Already disconnected
    }
  }
}
