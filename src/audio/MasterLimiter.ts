/**
 * MasterLimiter.ts — Studio-Grade Master Safety & Conditioning Chain
 *
 * Implements REBUILD_SPEC_V2.md Section 6.3:
 * Voice Sum -> DC Blocker (20Hz Highpass) -> Soft Saturator (tanh) -> Compressor -> Brickwall Peak Limiter -> Master Gain
 *
 * Prevents speaker blowout, eliminates digital distortion, stops DC drift,
 * and maintains warm acoustic dynamics during dense polyphonic bursts.
 */

export class MasterLimiter {
  private ctx: AudioContext;
  public readonly input: GainNode;
  public readonly output: GainNode;

  private dcBlocker: BiquadFilterNode;
  private saturator: WaveShaperNode;
  private compressor: DynamicsCompressorNode;
  private brickwallLimiter: DynamicsCompressorNode;
  private masterGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // 1. Input summing node
    this.input = ctx.createGain();
    this.input.gain.value = 1.0;

    // 2. DC Blocker: high-pass filter at 20Hz (removes non-zero offsets)
    this.dcBlocker = ctx.createBiquadFilter();
    this.dcBlocker.type = 'highpass';
    this.dcBlocker.frequency.value = 20;
    this.dcBlocker.Q.value = 0.707;

    // 3. Soft Saturator: hyperbolic tangent curve for gentle analog tape-like saturation
    this.saturator = ctx.createWaveShaper();
    this.saturator.curve = this.createSaturationCurve(1024) as any;
    this.saturator.oversample = '2x';

    // 4. Primary Musical Dynamics Compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12.0; // dB
    this.compressor.knee.value = 8.0;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.005;   // 5 ms
    this.compressor.release.value = 0.120;  // 120 ms

    // 5. Fast Brickwall Peak Limiter
    this.brickwallLimiter = ctx.createDynamicsCompressor();
    this.brickwallLimiter.threshold.value = -1.0; // -1 dB ceiling
    this.brickwallLimiter.knee.value = 0.0;        // Hard knee
    this.brickwallLimiter.ratio.value = 20.0;      // Infinite/brickwall ratio
    this.brickwallLimiter.attack.value = 0.001;    // 1 ms
    this.brickwallLimiter.release.value = 0.050;   // 50 ms

    // 6. Master Volume Output Gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.output = this.masterGain;

    // Connect chain
    this.input.connect(this.dcBlocker);
    this.dcBlocker.connect(this.saturator);
    this.saturator.connect(this.compressor);
    this.compressor.connect(this.brickwallLimiter);
    this.brickwallLimiter.connect(this.masterGain);
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1.0, volume));
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
  }

  public getVolume(): number {
    return this.masterGain.gain.value;
  }

  /**
   * Generates a smooth tanh-like sigmoid transfer curve.
   */
  private createSaturationCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1; // [-1, +1]
      // Soft saturation: x / (1 + |x|) or tanh approximation
      curve[i] = Math.tanh(1.2 * x);
    }
    return curve;
  }
}
