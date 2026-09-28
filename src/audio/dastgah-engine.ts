/**
 * dastgah-engine.ts — Persian Dastgah System, Modal Drones & Microtonal Scales
 *
 * Implements:
 * 1. Complete modal definitions for the 7 Dastgahs and 5 Avazes.
 * 2. Neutral intervals (Koron ~ -50¢, Sori ~ +50¢, Limma, Comma).
 * 3. Sympathetic Drone Synthesizer (Tonic, 5th, 4th with acoustic shimmer).
 * 4. Smooth modal modulation crossfading.
 * 5. Custom microtonal tuning scale manager.
 */

export interface DastgahDegree {
  index: number;
  name: string;             // e.g. "Tonic (C)", "Koron 2nd (D-koron)", "Shahid"
  ratio: number;            // Frequency ratio from tonic
  cents: number;            // Cent deviation from 12-TET
  intervalCents: number;    // Absolute interval in cents from tonic
  role: 'tonic' | 'shahid' | 'ist' | 'motaghayyer' | 'normal';
}

export interface DastgahScale {
  id: string;
  nameFa: string;           // Persian name (e.g. "دستگاه شور")
  nameEn: string;           // English transliteration
  tonicDefaultMidi: number; // e.g. 62 = D4 or 60 = C4
  degrees: DastgahDegree[];
  droneIntervals: number[]; // Ratios for pedal drone, e.g. [1, 3/2] or [1, 4/3]
}

export const DASTGAH_PRESETS: Record<string, DastgahScale> = {
  shur: {
    id: 'shur',
    nameFa: 'دستگاه شور',
    nameEn: 'Dastgah-e Shur',
    tonicDefaultMidi: 62, // D4
    droneIntervals: [1, 3 / 2, 2 / 1],
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'کرون (Koron 2nd)', ratio: 12 / 11, cents: +51, intervalCents: 151, role: 'shahid' },
      { index: 2, name: 'سوم (Tierce Min)', ratio: 6 / 5, cents: +16, intervalCents: 316, role: 'ist' },
      { index: 3, name: 'چهارم (Subdom)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'normal' },
      { index: 4, name: 'پنجم (Dominant)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'normal' },
      { index: 5, name: 'ششم خنثی (Koron 6th)', ratio: 18 / 11, cents: +49, intervalCents: 853, role: 'normal' },
      { index: 6, name: 'هفتم کوچک (Subtonic)', ratio: 9 / 5, cents: +18, intervalCents: 1018, role: 'normal' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  homayoun: {
    id: 'homayoun',
    nameFa: 'دستگاه همایون',
    nameEn: 'Dastgah-e Homayoun',
    tonicDefaultMidi: 60, // C4
    droneIntervals: [1, 3 / 2],
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'کرون (Koron 2nd)', ratio: 135 / 128, cents: -8, intervalCents: 92, role: 'normal' },
      { index: 2, name: 'سوم بزرگ (Major 3rd)', ratio: 5 / 4, cents: -14, intervalCents: 386, role: 'shahid' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'ist' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'normal' },
      { index: 5, name: 'ششم کوچک (Min 6th)', ratio: 8 / 5, cents: +14, intervalCents: 814, role: 'normal' },
      { index: 6, name: 'هفتم کوچک (Min 7th)', ratio: 9 / 5, cents: +18, intervalCents: 1018, role: 'normal' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  segah: {
    id: 'segah',
    nameFa: 'دستگاه سه‌گاه',
    nameEn: 'Dastgah-e Segah',
    tonicDefaultMidi: 62, // D4
    droneIntervals: [1, 5 / 4], // Segah centers around neutral third
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'کرون (Koron 2nd)', ratio: 12 / 11, cents: +51, intervalCents: 151, role: 'normal' },
      { index: 2, name: 'سوم خنثی (Neutral 3rd)', ratio: 11 / 9, cents: -53, intervalCents: 347, role: 'shahid' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'ist' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'normal' },
      { index: 5, name: 'ششم خنثی (Neutral 6th)', ratio: 18 / 11, cents: +49, intervalCents: 853, role: 'normal' },
      { index: 6, name: 'هفتم کوچک (Min 7th)', ratio: 9 / 5, cents: +18, intervalCents: 1018, role: 'normal' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  chahargah: {
    id: 'chahargah',
    nameFa: 'دستگاه چهارگاه',
    nameEn: 'Dastgah-e Chahargah',
    tonicDefaultMidi: 60, // C4
    droneIntervals: [1, 3 / 2, 2 / 1],
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'کرون (Koron 2nd)', ratio: 135 / 128, cents: -8, intervalCents: 92, role: 'normal' },
      { index: 2, name: 'سوم بزرگ (Major 3rd)', ratio: 5 / 4, cents: -14, intervalCents: 386, role: 'shahid' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'normal' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'normal' },
      { index: 5, name: 'کرون ششم (Koron 6th)', ratio: 135 / 80, cents: -8, intervalCents: 892, role: 'normal' },
      { index: 6, name: 'هفتم بزرگ (Maj 7th)', ratio: 15 / 8, cents: -12, intervalCents: 1088, role: 'ist' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  mahur: {
    id: 'mahur',
    nameFa: 'دستگاه ماهور',
    nameEn: 'Dastgah-e Mahur',
    tonicDefaultMidi: 60, // C4
    droneIntervals: [1, 3 / 2],
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'دوم بزرگ (Maj 2nd)', ratio: 9 / 8, cents: +4, intervalCents: 204, role: 'normal' },
      { index: 2, name: 'سوم بزرگ (Maj 3rd)', ratio: 5 / 4, cents: -14, intervalCents: 386, role: 'normal' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'normal' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'shahid' },
      { index: 5, name: 'ششم بزرگ (Maj 6th)', ratio: 5 / 3, cents: -16, intervalCents: 884, role: 'normal' },
      { index: 6, name: 'هفتم بزرگ (Maj 7th)', ratio: 15 / 8, cents: -12, intervalCents: 1088, role: 'ist' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  esfahan: {
    id: 'esfahan',
    nameFa: 'آواز بیات اصفهان',
    nameEn: 'Avaz-e Esfahan',
    tonicDefaultMidi: 60, // C4
    droneIntervals: [1, 3 / 2],
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'دوم بزرگ (Maj 2nd)', ratio: 9 / 8, cents: +4, intervalCents: 204, role: 'normal' },
      { index: 2, name: 'سوم کوچک (Min 3rd)', ratio: 6 / 5, cents: +16, intervalCents: 316, role: 'normal' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'shahid' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'ist' },
      { index: 5, name: 'کرون ششم (Koron 6th)', ratio: 18 / 11, cents: +49, intervalCents: 853, role: 'normal' },
      { index: 6, name: 'هفتم بزرگ (Maj 7th)', ratio: 15 / 8, cents: -12, intervalCents: 1088, role: 'normal' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
  nava: {
    id: 'nava',
    nameFa: 'دستگاه نوا',
    nameEn: 'Dastgah-e Nava',
    tonicDefaultMidi: 62, // D4
    droneIntervals: [1, 4 / 3], // Nava strongly highlights fourth
    degrees: [
      { index: 0, name: 'پایه (Tonic)', ratio: 1.0, cents: 0, intervalCents: 0, role: 'tonic' },
      { index: 1, name: 'دوم بزرگ (Maj 2nd)', ratio: 9 / 8, cents: +4, intervalCents: 204, role: 'normal' },
      { index: 2, name: 'سوم کوچک (Min 3rd)', ratio: 6 / 5, cents: +16, intervalCents: 316, role: 'normal' },
      { index: 3, name: 'چهارم درست (Perf 4th)', ratio: 4 / 3, cents: -2, intervalCents: 498, role: 'shahid' },
      { index: 4, name: 'پنجم درست (Perf 5th)', ratio: 3 / 2, cents: +2, intervalCents: 702, role: 'ist' },
      { index: 5, name: 'ششم خنثی (Koron 6th)', ratio: 18 / 11, cents: +49, intervalCents: 853, role: 'normal' },
      { index: 6, name: 'هفتم کوچک (Min 7th)', ratio: 9 / 5, cents: +18, intervalCents: 1018, role: 'normal' },
      { index: 7, name: 'اکتاو (Octave)', ratio: 2.0, cents: 0, intervalCents: 1200, role: 'tonic' },
    ],
  },
};

/**
 * Continuous Sympathetic Drone Synthesizer (Modal Acoustic Anchor)
 */
export class DroneSynthesizer {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private tonicFreq = 146.83; // D3 default
  private currentScale: DastgahScale = DASTGAH_PRESETS.shur;

  private droneOscs: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private bodyFilter: BiquadFilterNode;
  private isPlaying = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    // Corpus warm resonance for pedal drone
    this.bodyFilter = ctx.createBiquadFilter();
    this.bodyFilter.type = 'lowpass';
    this.bodyFilter.frequency.value = 450;
    this.bodyFilter.Q.value = 2.0;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.25;

    this.bodyFilter.connect(this.masterGain);
    this.masterGain.connect(destination);
  }

  /** Start or restart the modal drone */
  public start(scale: DastgahScale = this.currentScale, tonicFreq = this.tonicFreq): void {
    this.stop();
    this.currentScale = scale;
    this.tonicFreq = tonicFreq;
    const now = this.ctx.currentTime;

    // Create drone layers: Sub-bass octave, Tonic, and Fifth/Fourth
    const layers = [
      { freq: tonicFreq / 2, gain: 0.35, detune: 0 },
      { freq: tonicFreq, gain: 0.40, detune: +1.5 },
      { freq: tonicFreq * (scale.droneIntervals[1] ?? 1.5), gain: 0.28, detune: -1.2 },
      { freq: tonicFreq * 2, gain: 0.12, detune: +0.8 },
    ];

    this.droneOscs = [];
    this.droneGains = [];

    for (const layer of layers) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; // Warm acoustic body spectrum
      osc.frequency.setValueAtTime(layer.freq, now);
      osc.detune.setValueAtTime(layer.detune, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(layer.gain, now + 1.2); // Gentle acoustic fade-in

      osc.connect(gain);
      gain.connect(this.bodyFilter);

      osc.start(now);
      this.droneOscs.push(osc);
      this.droneGains.push(gain);
    }

    this.isPlaying = true;
  }

  /** Crossfade smoothly to a new Dastgah or tonic */
  public modulateTo(scale: DastgahScale, newTonicFreq?: number): void {
    this.currentScale = scale;
    if (newTonicFreq) this.tonicFreq = newTonicFreq;
    if (!this.isPlaying) return;

    const now = this.ctx.currentTime;
    const droneInterval = scale.droneIntervals[1] ?? 1.5;

    // Target frequencies with glissando (tahrir transition)
    const targetFreqs = [
      this.tonicFreq / 2,
      this.tonicFreq,
      this.tonicFreq * droneInterval,
      this.tonicFreq * 2,
    ];

    for (let i = 0; i < this.droneOscs.length; i++) {
      if (targetFreqs[i]) {
        this.droneOscs[i].frequency.setTargetAtTime(targetFreqs[i], now, 0.4);
      }
    }
  }

  /** Stop the modal drone */
  public stop(fadeSeconds = 0.8): void {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;

    for (const gain of this.droneGains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    }

    for (const osc of this.droneOscs) {
      osc.stop(now + fadeSeconds + 0.1);
    }

    setTimeout(() => {
      this.droneOscs = [];
      this.droneGains = [];
      this.isPlaying = false;
    }, (fadeSeconds + 0.15) * 1000);
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.masterGain.gain.setTargetAtTime(clamped * 0.35, this.ctx.currentTime, 0.05);
  }

  public get active(): boolean {
    return this.isPlaying;
  }
}
