/**
 * reverb.ts — Lush Algorithmic Acoustic Reverb & Wooden Soundboard Simulation
 *
 * Implements:
 * 1. Wooden Soundboard Formant EQ (box resonance around 320Hz with soft high shelf)
 * 2. Algorithmic Convolution Reverb (early reflections + diffused exponential decay)
 * 3. Equal-power Dry/Wet mixing
 */

export class ReverbEffect {
  private ctx: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private convolver: ConvolverNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private soundboardEQ: BiquadFilterNode;
  private highDampFilter: BiquadFilterNode;

  constructor(ctx: AudioContext, wetMix = 0.38) {
    this.ctx = ctx;
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    // Wooden soundboard resonance (body warmth)
    this.soundboardEQ = ctx.createBiquadFilter();
    this.soundboardEQ.type = 'peaking';
    this.soundboardEQ.frequency.value = 320;
    this.soundboardEQ.Q.value = 1.1;
    this.soundboardEQ.gain.value = 3.5;

    // High frequency acoustic air damping
    this.highDampFilter = ctx.createBiquadFilter();
    this.highDampFilter.type = 'lowpass';
    this.highDampFilter.frequency.value = 6500;

    // Convolver node for acoustic chamber
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.buildImpulseBuffer(2.4, 2.2);

    // Routing:
    // Dry path:
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path: input -> soundboardEQ -> highDamp -> convolver -> wetGain -> output
    this.inputNode.connect(this.soundboardEQ);
    this.soundboardEQ.connect(this.highDampFilter);
    this.highDampFilter.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    this.setMix(wetMix);
  }

  public get input(): AudioNode {
    return this.inputNode;
  }

  public connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  public setMix(mix: number): void {
    const clamped = Math.max(0, Math.min(1, mix));
    // Equal-power crossfade curve
    this.dryGain.gain.value = Math.cos(clamped * 0.5 * Math.PI);
    this.wetGain.gain.value = Math.sin(clamped * 0.5 * Math.PI) * 0.95;
  }

  private buildImpulseBuffer(durationSeconds: number, decayRate: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSeconds);
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Warm multi-tap acoustic early reflections (in milliseconds)
    const earlyTaps = [
      { ms: 14, gain: 0.55, pan: -0.4 },
      { ms: 24, gain: 0.45, pan: 0.5 },
      { ms: 38, gain: 0.38, pan: -0.5 },
      { ms: 52, gain: 0.30, pan: 0.3 },
      { ms: 72, gain: 0.24, pan: -0.2 },
      { ms: 95, gain: 0.18, pan: 0.4 },
    ];

    for (const tap of earlyTaps) {
      const idx = Math.floor((tap.ms / 1000) * sampleRate);
      if (idx < length) {
        left[idx] += tap.gain * (1 - tap.pan * 0.5);
        right[idx] += tap.gain * (1 + tap.pan * 0.5);
      }
    }

    // Diffuse tail with frequency-dependent damping (lows sustain, highs absorb like real wood)
    let filterL = 0;
    let filterR = 0;
    const dampFactor = 0.28; // One-pole lowpass filter removes harsh digital sizzle

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * decayRate);
      const attack = Math.min(1, t * 180);

      const rawL = (Math.random() * 2 - 1) * decay * attack;
      const rawR = (Math.random() * 2 - 1) * decay * attack;

      // Filtered diffuse noise
      filterL += dampFactor * (rawL - filterL);
      filterR += dampFactor * (rawR - filterR);

      left[i] += filterL * 0.82;
      right[i] += filterR * 0.82;
    }

    return buffer;
  }
}
