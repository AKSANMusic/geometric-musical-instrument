/**
 * accordion-reed.ts — Physical Modeling of Accordion Reeds & Bellows Dynamics
 *
 * Implements:
 * 1. Aerodynamic free-reed non-linear excitation.
 * 2. Dual-reed acoustic coupling with adjustable Musette detune (beating tremolo).
 * 3. Dynamic Bellows Pressure modulation (expression, swell, and bellows shake).
 * 4. Resonant acoustic reed chamber (cassotto) formant shaping.
 * 5. Mechanical reed choke on release.
 */

export interface AccordionReedParams {
  frequency: number;          // Fundamental pitch in Hz
  bellowsPressure: number;    // [0, 1] Bellows air pressure
  musetteDetuneCents?: number;// Cents detuning between dual reeds (default ~7 cents for sweet tremolo)
  cassottoTone?: boolean;     // True for mellow chamber tone, false for bright open tone
  pan?: number;               // Stereo position [-1, 1]
  gainMultiplier?: number;
}

export class AccordionReedVoice {
  private ctx: AudioContext;
  private destination: AudioNode;
  public readonly id: number;
  public readonly startTime: number;
  public ended = false;

  // Dual Reed Oscillators
  private reed1Osc: OscillatorNode;
  private reed2Osc: OscillatorNode;
  private reed1Gain: GainNode;
  private reed2Gain: GainNode;

  // Aerodynamic Non-Linear WaveShaper
  private pressureShaper: WaveShaperNode;

  // Cassotto / Tone Chamber Formant Filters
  private chamberFilter: BiquadFilterNode;
  private airHissFilter: BiquadFilterNode;
  private airHissGain: GainNode;
  private noiseNode: AudioBufferSourceNode | null = null;

  // Amplitude Envelope & Spatial
  private ampEnv: GainNode;
  private panner: StereoPannerNode;

  // State
  private _frequency: number;
  private _bellowsPressure: number;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    params: AccordionReedParams,
    voiceId: number,
  ) {
    this.ctx = ctx;
    this.destination = destination;
    this.id = voiceId;
    const now = ctx.currentTime;
    this.startTime = now;

    this._frequency = Math.max(30, Math.min(2500, params.frequency));
    this._bellowsPressure = Math.max(0.01, Math.min(1, params.bellowsPressure));

    const detuneCents = params.musetteDetuneCents ?? 7.0;

    // ─── 1. Dual Reed Oscillators (Musette Coupler) ───────────────────────
    // Primary reed (Center)
    this.reed1Osc = ctx.createOscillator();
    this.reed1Osc.type = 'sawtooth'; // Aerodynamic slit creates rich harmonic spectrum
    this.reed1Osc.frequency.setValueAtTime(this._frequency, now);

    // Secondary reed (Detuned for beating acoustic warmth)
    this.reed2Osc = ctx.createOscillator();
    this.reed2Osc.type = 'sawtooth';
    const detunedFreq = this._frequency * Math.pow(2, detuneCents / 1200);
    this.reed2Osc.frequency.setValueAtTime(detunedFreq, now);

    this.reed1Gain = ctx.createGain();
    this.reed2Gain = ctx.createGain();
    this.reed1Gain.gain.value = 0.5;
    this.reed2Gain.gain.value = 0.45;

    // ─── 2. Non-linear Aerodynamic Pressure Shaper ───────────────────────
    // Reed opening saturates non-linearly with increased bellows airflow
    this.pressureShaper = ctx.createWaveShaper();
    this.pressureShaper.curve = this.generateReedSaturationCurve() as any;
    this.pressureShaper.oversample = '2x';

    // ─── 3. Tone Chamber (Cassotto) Filter ────────────────────────────────
    this.chamberFilter = ctx.createBiquadFilter();
    if (params.cassottoTone) {
      // Mellow, enclosed wooden tone chamber
      this.chamberFilter.type = 'lowpass';
      this.chamberFilter.frequency.setValueAtTime(Math.min(3200, this._frequency * 4.5), now);
      this.chamberFilter.Q.setValueAtTime(1.5, now);
    } else {
      // Standard open accordion grill with presence boost
      this.chamberFilter.type = 'peaking';
      this.chamberFilter.frequency.setValueAtTime(Math.min(4500, this._frequency * 3.0), now);
      this.chamberFilter.gain.setValueAtTime(3.5, now);
      this.chamberFilter.Q.setValueAtTime(1.2, now);
    }

    // ─── 4. Bellows Airflow Hiss ─────────────────────────────────────────
    this.airHissFilter = ctx.createBiquadFilter();
    this.airHissFilter.type = 'bandpass';
    this.airHissFilter.frequency.value = 1800;
    this.airHissFilter.Q.value = 2.0;

    this.airHissGain = ctx.createGain();
    this.airHissGain.gain.setValueAtTime(0.015 * this._bellowsPressure, now);
    this.createAirHissBuffer(now);

    // ─── 5. Envelope & Panning ───────────────────────────────────────────
    this.ampEnv = ctx.createGain();
    const targetGain = Math.pow(this._bellowsPressure, 1.4) * 0.4 * (params.gainMultiplier ?? 1.0);
    const attack = 0.015; // Quick reed tongue excitation

    this.ampEnv.gain.setValueAtTime(0, now);
    this.ampEnv.gain.linearRampToValueAtTime(targetGain, now + attack);

    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = Math.max(-1, Math.min(1, params.pan ?? 0));

    // ─── Audio Graph Wiring ──────────────────────────────────────────────
    this.reed1Osc.connect(this.reed1Gain);
    this.reed2Osc.connect(this.reed2Gain);

    this.reed1Gain.connect(this.pressureShaper);
    this.reed2Gain.connect(this.pressureShaper);

    this.pressureShaper.connect(this.chamberFilter);
    this.chamberFilter.connect(this.ampEnv);

    if (this.airHissGain) {
      this.airHissGain.connect(this.ampEnv);
    }

    this.ampEnv.connect(this.panner);
    this.panner.connect(this.destination);

    // Start oscillators
    this.reed1Osc.start(now);
    this.reed2Osc.start(now);
  }

  /** Update bellows pressure dynamically during sustained chord */
  public setBellowsPressure(pressure: number): void {
    const now = this.ctx.currentTime;
    this._bellowsPressure = Math.max(0.01, Math.min(1, pressure));
    const targetGain = Math.pow(this._bellowsPressure, 1.4) * 0.4;
    this.ampEnv.gain.setTargetAtTime(targetGain, now, 0.03);
    this.airHissGain.gain.setTargetAtTime(0.015 * this._bellowsPressure, now, 0.03);
  }

  /** Smooth release alias for voice allocator */
  public release(releaseTime = 0.04): void {
    this.stop(releaseTime);
  }

  /** Calculate voice priority score */
  public getPriorityScore(now: number): number {
    if (this.ended) return -1;
    const age = now - this.startTime;
    const isBass = this._frequency < 180 ? 60 : 0;
    const isNew = age < 0.1 ? 80 : 0;
    return isNew + isBass + Math.max(0, 10 - age * 2);
  }

  /** Release voice with mechanical reed damping */
  public stop(releaseTime = 0.04): void {
    if (this.ended) return;
    this.ended = true;
    const now = this.ctx.currentTime;
    this.ampEnv.gain.cancelScheduledValues(now);
    this.ampEnv.gain.setValueAtTime(this.ampEnv.gain.value, now);
    this.ampEnv.gain.linearRampToValueAtTime(0, now + releaseTime);

    this.reed1Osc.stop(now + releaseTime + 0.02);
    this.reed2Osc.stop(now + releaseTime + 0.02);

    setTimeout(() => {
      this.disconnect();
    }, (releaseTime + 0.05) * 1000);
  }

  private generateReedSaturationCurve(): Float32Array {
    const n = 512;
    const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      // Soft saturation with asymmetric air pressure resistance
      curve[i] = Math.tanh(1.8 * x) + 0.1 * Math.sin(Math.PI * x);
    }
    return curve;
  }

  private createAirHissBuffer(startTime: number): void {
    try {
      const bufferSize = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;
      this.noiseNode.connect(this.airHissFilter);
      this.airHissFilter.connect(this.airHissGain);
      this.noiseNode.start(startTime);
    } catch {
      // Ignored if buffer fails
    }
  }

  private disconnect(): void {
    try {
      this.reed1Osc.disconnect();
      this.reed2Osc.disconnect();
      this.reed1Gain.disconnect();
      this.reed2Gain.disconnect();
      this.pressureShaper.disconnect();
      this.chamberFilter.disconnect();
      this.airHissFilter.disconnect();
      this.airHissGain.disconnect();
      this.ampEnv.disconnect();
      this.panner.disconnect();
      if (this.noiseNode) {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      }
    } catch {
      // Already disconnected
    }
  }
}
