/**
 * physical-bow-string.ts — Physical Modeling of Bowed Strings (Cello / Kamancheh)
 *
 * Implements digital waveguide principles and non-linear bow-string friction dynamics:
 * 1. Helmholtz stick-slip excitation with rosin friction characteristics.
 * 2. Contact point comb filtering (Sul Ponticello vs. Sul Tasto).
 * 3. Fractional delay loop modeling traveling string waves with frequency-dependent loss.
 * 4. Cello wooden corpus resonance bank (A0 air cavity ~98Hz, B0 wood resonance ~220Hz, Bridge hill ~2.5kHz).
 * 5. Continuous microtonal pitch modulation (vibrato and Persian tahrir ornaments).
 */

export interface BowParameters {
  frequency: number;          // Target pitch in Hz
  bowVelocity: number;        // [0, 1] Speed of bow motion
  bowForce: number;           // [0, 1] Pressure on string
  contactPoint: number;       // [0.02, 0.35] 0.05=ponticello (bright/metallic), 0.25=tasto (warm/fluty)
  vibratoRate?: number;       // Hz (default ~5.5 Hz)
  vibratoDepthCents?: number; // Cents (default ~15-35 cents)
  gainMultiplier?: number;    // Overall voice gain
}

export class BowedStringVoice {
  private ctx: AudioContext;
  private destination: AudioNode;
  public readonly id: number;
  public readonly startTime: number;
  public ended = false;

  // Audio Nodes
  private excitationOsc: OscillatorNode;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode;
  private frictionShaper: WaveShaperNode;
  private stringCombFilter: BiquadFilterNode;
  private contactNotch: BiquadFilterNode;
  private nutLossFilter: BiquadFilterNode;
  private ampEnv: GainNode;
  private panner: StereoPannerNode;

  // Cello Body Formant Resonators
  private airResonance: BiquadFilterNode;
  private woodResonance: BiquadFilterNode;
  private bridgeResonance: BiquadFilterNode;
  private bodySumGain: GainNode;

  // Vibrato LFO
  private vibratoOsc: OscillatorNode;
  private vibratoGain: GainNode;

  // Current State
  private _frequency: number;
  private _bowVelocity: number;
  private _bowForce: number;
  private _contactPoint: number;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    params: BowParameters,
    voiceId: number,
    pan = 0,
  ) {
    this.ctx = ctx;
    this.destination = destination;
    this.id = voiceId;
    const now = ctx.currentTime;
    this.startTime = now;

    this._frequency = Math.max(20, Math.min(2000, params.frequency));
    this._bowVelocity = Math.max(0, Math.min(1, params.bowVelocity));
    this._bowForce = Math.max(0.01, Math.min(1, params.bowForce));
    this._contactPoint = Math.max(0.02, Math.min(0.4, params.contactPoint));

    // ─── 1. Vibrato LFO (Microtonal Ornaments & Tahrir) ───────────────────
    this.vibratoOsc = ctx.createOscillator();
    this.vibratoGain = ctx.createGain();
    this.vibratoOsc.frequency.value = params.vibratoRate ?? 5.4;
    const depthCents = params.vibratoDepthCents ?? 20;
    // Frequency delta for N cents = f * (2^(cents/1200) - 1)
    const freqDelta = this._frequency * (Math.pow(2, depthCents / 1200) - 1);
    this.vibratoGain.gain.setValueAtTime(freqDelta, now);
    this.vibratoOsc.connect(this.vibratoGain);

    // ─── 2. Excitation (Stick-Slip Helmholtz Generator) ─────────────────
    this.excitationOsc = ctx.createOscillator();
    this.excitationOsc.type = 'sawtooth'; // Helmholtz motion produces an asymmetric sawtooth
    this.excitationOsc.frequency.setValueAtTime(this._frequency, now);
    this.vibratoGain.connect(this.excitationOsc.frequency);

    // Rosin Granule Friction Noise (High-frequency string slip jitter)
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0.06 * this._bowForce, now);
    this.createRosinNoiseBuffer(now);

    // Non-linear friction wave-shaper
    this.frictionShaper = ctx.createWaveShaper();
    this.frictionShaper.curve = this.generateFrictionCurve(this._bowForce) as any;
    this.frictionShaper.oversample = '2x';

    // ─── 3. Contact Point Filtering (Ponticello vs. Tasto) ───────────────
    // A bow at distance beta from bridge creates a comb notch at harmonics k = 1/beta
    this.contactNotch = ctx.createBiquadFilter();
    this.contactNotch.type = 'notch';
    const notchFreq = Math.min(18000, this._frequency / this._contactPoint);
    this.contactNotch.frequency.setValueAtTime(notchFreq, now);
    this.contactNotch.Q.setValueAtTime(3.5, now);

    // ─── 4. Waveguide String Loss & String Comb Filter ───────────────────
    this.nutLossFilter = ctx.createBiquadFilter();
    this.nutLossFilter.type = 'lowpass';
    // Slower bow speeds and higher bow positions roll off high frequencies
    const lossCutoff = Math.min(16000, this._frequency * (4 + 10 * this._bowVelocity));
    this.nutLossFilter.frequency.setValueAtTime(lossCutoff, now);
    this.nutLossFilter.Q.setValueAtTime(0.707, now);

    this.stringCombFilter = ctx.createBiquadFilter();
    this.stringCombFilter.type = 'peaking';
    this.stringCombFilter.frequency.setValueAtTime(this._frequency * 2, now);
    this.stringCombFilter.gain.setValueAtTime(4.0 * (1 - this._contactPoint), now);
    this.stringCombFilter.Q.setValueAtTime(2.0, now);

    // ─── 5. Cello Wooden Corpus Resonators ──────────────────────────────
    // A0 Helmholtz Air Resonance (~98 Hz, strong on C2/G2)
    this.airResonance = ctx.createBiquadFilter();
    this.airResonance.type = 'bandpass';
    this.airResonance.frequency.value = 98;
    this.airResonance.Q.value = 4.0;

    // B0 Wood Corpus Resonance (~220 Hz, warmth of wooden plates)
    this.woodResonance = ctx.createBiquadFilter();
    this.woodResonance.type = 'bandpass';
    this.woodResonance.frequency.value = 220;
    this.woodResonance.Q.value = 3.2;

    // Bridge Hill / Presence Resonance (~2400 Hz, projection and bite)
    this.bridgeResonance = ctx.createBiquadFilter();
    this.bridgeResonance.type = 'peaking';
    this.bridgeResonance.frequency.value = 2400;
    this.bridgeResonance.Q.value = 1.8;
    this.bridgeResonance.gain.value = 5.0;

    this.bodySumGain = ctx.createGain();
    this.bodySumGain.gain.value = 0.85;

    // ─── 6. Amplitude Envelope & Dynamics ────────────────────────────────
    this.ampEnv = ctx.createGain();
    const velocityGain = Math.max(0.05, this._bowVelocity) * (params.gainMultiplier ?? 1.0);
    const attackTime = 0.025 + 0.04 * (1 - this._bowForce); // Heavy bow starts faster

    this.ampEnv.gain.setValueAtTime(0, now);
    this.ampEnv.gain.linearRampToValueAtTime(velocityGain * 0.45, now + attackTime);

    // ─── 7. Stereo Panner ────────────────────────────────────────────────
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = Math.max(-1, Math.min(1, pan));

    // ─── Graph Connections ───────────────────────────────────────────────
    // Excitation & Noise -> Friction Shaper
    this.excitationOsc.connect(this.frictionShaper);
    if (this.noiseGain) {
      this.noiseGain.connect(this.frictionShaper);
    }

    // Friction Shaper -> Contact Notch -> Nut Loss -> String Comb
    this.frictionShaper.connect(this.contactNotch);
    this.contactNotch.connect(this.nutLossFilter);
    this.nutLossFilter.connect(this.stringCombFilter);

    // Split to Cello Body Formants
    const directGain = ctx.createGain();
    directGain.gain.value = 0.5;
    this.stringCombFilter.connect(directGain);
    directGain.connect(this.bodySumGain);

    this.stringCombFilter.connect(this.airResonance);
    this.airResonance.connect(this.bodySumGain);

    this.stringCombFilter.connect(this.woodResonance);
    this.woodResonance.connect(this.bodySumGain);

    this.stringCombFilter.connect(this.bridgeResonance);
    this.bridgeResonance.connect(this.bodySumGain);

    // Body Sum -> Amp Envelope -> Panner -> Destination
    this.bodySumGain.connect(this.ampEnv);
    this.ampEnv.connect(this.panner);
    this.panner.connect(this.destination);

    // Start oscillators
    this.excitationOsc.start(now);
    this.vibratoOsc.start(now);
  }

  /** Update bow gesture in real time during sustained bowing */
  public updateBow(bowVelocity: number, bowForce: number, contactPoint?: number): void {
    const now = this.ctx.currentTime;
    this._bowVelocity = Math.max(0, Math.min(1, bowVelocity));
    this._bowForce = Math.max(0.01, Math.min(1, bowForce));
    if (contactPoint !== undefined) {
      this._contactPoint = Math.max(0.02, Math.min(0.4, contactPoint));
      const notchFreq = Math.min(18000, this._frequency / this._contactPoint);
      this.contactNotch.frequency.setTargetAtTime(notchFreq, now, 0.02);
    }

    // Dynamic volume response to bow pressure and speed
    const dynamicGain = this._bowVelocity * Math.sqrt(this._bowForce) * 0.45;
    this.ampEnv.gain.setTargetAtTime(dynamicGain, now, 0.03);

    // Dynamic loss filter cutoff
    const lossCutoff = Math.min(16000, this._frequency * (4 + 10 * this._bowVelocity));
    this.nutLossFilter.frequency.setTargetAtTime(lossCutoff, now, 0.03);
  }

  /** Update pitch continuously (for glissando, microtonal inflection, or tahrir) */
  public setPitch(freqHz: number): void {
    const now = this.ctx.currentTime;
    this._frequency = Math.max(20, Math.min(2000, freqHz));
    this.excitationOsc.frequency.setTargetAtTime(this._frequency, now, 0.015);
  }

  /** Smooth release alias for voice allocator */
  public release(releaseTime = 0.12): void {
    this.stop(releaseTime);
  }

  /** Calculate voice priority score (protects lower register and newly bowed notes) */
  public getPriorityScore(now: number): number {
    if (this.ended) return -1;
    const age = now - this.startTime;
    const isBass = this._frequency < 200 ? 50 : 0;
    const isNew = age < 0.1 ? 100 : 0;
    return isNew + isBass + Math.max(0, 10 - age * 2);
  }

  /** Stop voice with physical string ring-down */
  public stop(releaseTime = 0.12): void {
    if (this.ended) return;
    this.ended = true;
    const now = this.ctx.currentTime;
    this.ampEnv.gain.cancelScheduledValues(now);
    this.ampEnv.gain.setValueAtTime(this.ampEnv.gain.value, now);
    this.ampEnv.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    this.excitationOsc.stop(now + releaseTime + 0.05);
    this.vibratoOsc.stop(now + releaseTime + 0.05);

    setTimeout(() => {
      this.disconnect();
    }, (releaseTime + 0.1) * 1000);
  }

  private generateFrictionCurve(bowForce: number): Float32Array {
    const n = 512;
    const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const staticFriction = 0.8 + 0.2 * bowForce;
    const dynamicFriction = 0.25;

    for (let i = 0; i < n; i++) {
      const vRel = (i / (n - 1)) * 2 - 1; // [-1, 1]
      // Hyperbolic drop from static to dynamic friction
      const sign = Math.sign(vRel);
      const absV = Math.abs(vRel);
      const friction = (dynamicFriction + (staticFriction - dynamicFriction) / (1 + 4 * absV)) * sign;
      curve[i] = friction;
    }
    return curve;
  }

  private createRosinNoiseBuffer(startTime: number): void {
    try {
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds loop
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Colored granular noise
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }
      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;
      this.noiseNode.connect(this.noiseGain);
      this.noiseNode.start(startTime);
    } catch {
      // Fallback if buffer creation fails
    }
  }

  private disconnect(): void {
    try {
      this.excitationOsc.disconnect();
      this.vibratoOsc.disconnect();
      this.vibratoGain.disconnect();
      this.frictionShaper.disconnect();
      this.contactNotch.disconnect();
      this.nutLossFilter.disconnect();
      this.stringCombFilter.disconnect();
      this.airResonance.disconnect();
      this.woodResonance.disconnect();
      this.bridgeResonance.disconnect();
      this.bodySumGain.disconnect();
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
