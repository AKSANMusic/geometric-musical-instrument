/**
 * KarplusStrongVoice.ts — Physical Waveguide & Harmonic String Synthesis
 *
 * Implements REBUILD_SPEC_V2.md Section 6.1 & 6.2:
 * 1. Physical delay-loop waveguide tuned to exact target frequency with microtonal accuracy.
 * 2. Harmonic strike-position weighting:
 *    A_n = |sin(n * pi * u)| * exp(-0.15 * n)
 *    Pluck at center (u = 0.5) -> hollow, even harmonics cancelled (tasto).
 *    Pluck at ends (u = 0.05)  -> bright, rich in upper partials (ponticello).
 * 3. Wooden instrument body formant resonators (Air cavity 98Hz, Wood corpus 220Hz, Bridge hill 2400Hz).
 * 4. Articulation shaping (pluck, strike, sustain, bow, ghost).
 */

import type { MusicalEvent } from '../domain/events';

export class KarplusStrongVoice {
  private ctx: AudioContext;
  public readonly id: string;
  public readonly pitchHz: number;
  public readonly startTime: number;
  public ended = false;

  private burstSource: AudioBufferSourceNode | null = null;
  private delayNode: DelayNode | null = null;
  private loopFilter: BiquadFilterNode | null = null;
  private loopGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;

  // Body formant resonators
  private airResonance: BiquadFilterNode | null = null;
  private woodResonance: BiquadFilterNode | null = null;
  private bridgeResonance: BiquadFilterNode | null = null;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    event: MusicalEvent,
    voiceId: string,
  ) {
    this.ctx = ctx;
    this.id = voiceId;
    this.pitchHz = Math.max(20, Math.min(5000, event.pitchHz));
    const now = Math.max(ctx.currentTime, event.time);
    this.startTime = now;

    // 1. Calculate fundamental period for the delay line
    const period = 1.0 / this.pitchHz;

    // 2. Build Physical Delay Loop (Waveguide)
    this.delayNode = ctx.createDelay(0.1);
    this.delayNode.delayTime.setValueAtTime(period, now);

    this.loopFilter = ctx.createBiquadFilter();
    this.loopFilter.type = 'lowpass';
    // String damping: higher brightness keeps more high frequencies in the loop
    const dampingCutoff = Math.min(18000, this.pitchHz * (3.0 + 8.0 * event.brightness));
    this.loopFilter.frequency.setValueAtTime(dampingCutoff, now);
    this.loopFilter.Q.setValueAtTime(0.5, now);

    this.loopGain = ctx.createGain();
    // Decay time controlled by duration and frequency
    const decayConstant = Math.min(0.995, Math.pow(0.001, period / Math.max(0.2, event.duration)));
    this.loopGain.gain.setValueAtTime(decayConstant, now);

    // Feedback cycle: Delay -> Filter -> Gain -> Delay
    this.delayNode.connect(this.loopFilter);
    this.loopFilter.connect(this.loopGain);
    this.loopGain.connect(this.delayNode);

    // 3. Wooden Body Formant Resonators
    this.airResonance = ctx.createBiquadFilter();
    this.airResonance.type = 'peaking';
    this.airResonance.frequency.value = 98; // A0 air cavity
    this.airResonance.Q.value = 4.0;
    this.airResonance.gain.value = 3.5;

    this.woodResonance = ctx.createBiquadFilter();
    this.woodResonance.type = 'peaking';
    this.woodResonance.frequency.value = 220; // T1 wood corpus
    this.woodResonance.Q.value = 3.2;
    this.woodResonance.gain.value = 4.0;

    this.bridgeResonance = ctx.createBiquadFilter();
    this.bridgeResonance.type = 'peaking';
    this.bridgeResonance.frequency.value = 2400; // Bridge hill
    this.bridgeResonance.Q.value = 1.8;
    this.bridgeResonance.gain.value = 2.0;

    // 4. Voice Envelope and Panner
    this.voiceGain = ctx.createGain();
    const peakVelocity = Math.max(0.05, Math.min(1.0, event.velocity)) * 0.45;
    this.voiceGain.gain.setValueAtTime(0, now);

    // Articulation-specific envelope shaping
    if (event.articulation === 'ghost') {
      this.voiceGain.gain.linearRampToValueAtTime(peakVelocity * 0.35, now + 0.004);
      this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.3, event.duration));
    } else if (event.articulation === 'bow') {
      // Gentle bowing attack
      this.voiceGain.gain.linearRampToValueAtTime(peakVelocity, now + 0.08);
      this.voiceGain.gain.setValueAtTime(peakVelocity, now + Math.max(0.1, event.duration - 0.1));
      this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + event.duration + 0.15);
    } else {
      // Crisp pluck / strike attack
      this.voiceGain.gain.linearRampToValueAtTime(peakVelocity, now + 0.003);
      this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + event.duration + 0.08);
    }

    this.panner = ctx.createStereoPanner();
    this.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, event.pan)), now);

    // Connect body resonators in cascade to output
    this.delayNode.connect(this.airResonance);
    this.airResonance.connect(this.woodResonance);
    this.woodResonance.connect(this.bridgeResonance);
    this.bridgeResonance.connect(this.voiceGain);
    this.voiceGain.connect(this.panner);
    this.panner.connect(destination);

    // 5. Generate Physical Strike Impulse (with strike-position harmonic weighting)
    this.triggerExcitation(event, now);

    // Auto cleanup
    const stopTime = now + event.duration + 0.25;
    setTimeout(() => {
      this.stop();
    }, (stopTime - ctx.currentTime) * 1000);
  }

  /**
   * Synthesize physical excitation burst with harmonic strike position weighting:
   * A_n = |sin(n * pi * u)| * exp(-0.15 * n)
   */
  private triggerExcitation(event: MusicalEvent, startTime: number): void {
    const sampleRate = this.ctx.sampleRate;
    const burstDuration = Math.min(0.025, 2.5 / this.pitchHz); // 2.5 periods or max 25ms
    const numSamples = Math.floor(sampleRate * burstDuration);
    if (numSamples < 4) return;

    const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Strike position u derived from brightness or default center
    // event.brightness is in [0, 1]
    const u = Math.max(0.03, Math.min(0.97, 0.5 * (1 - event.brightness) + 0.03));
    const maxHarmonics = Math.min(24, Math.floor(sampleRate / (2 * this.pitchHz)));

    // Compute harmonic Fourier weights
    const weights: number[] = new Array(maxHarmonics + 1);
    let totalWeight = 0;
    for (let n = 1; n <= maxHarmonics; n++) {
      const an = Math.abs(Math.sin(n * Math.PI * u)) * Math.exp(-0.15 * n);
      weights[n] = an;
      totalWeight += an;
    }
    const norm = totalWeight > 0 ? 1.0 / totalWeight : 1.0;

    // Fill excitation buffer with weighted harmonic impulse
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (let n = 1; n <= maxHarmonics; n++) {
        sample += weights[n] * Math.sin(2 * Math.PI * n * this.pitchHz * t);
      }
      // Apply Hanning window to prevent clicks at burst boundary
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / numSamples));
      data[i] = sample * norm * window;
    }

    this.burstSource = this.ctx.createBufferSource();
    this.burstSource.buffer = buffer;
    if (this.delayNode) {
      this.burstSource.connect(this.delayNode);
    }
    this.burstSource.start(startTime);
  }

  /**
   * Smoothly re-excite string if common-tone retention is active.
   */
  public reExcite(event: MusicalEvent): void {
    if (this.ended || !this.ctx) return;
    const now = Math.max(this.ctx.currentTime, event.time);
    this.triggerExcitation(event, now);

    if (this.voiceGain) {
      const peakVelocity = Math.max(0.05, Math.min(1.0, event.velocity)) * 0.45;
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, now);
      this.voiceGain.gain.linearRampToValueAtTime(peakVelocity, now + 0.005);
      this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + event.duration + 0.08);
    }
  }

  /**
   * Stop and disconnect voice.
   */
  public stop(rampSeconds = 0.015): void {
    if (this.ended) return;
    this.ended = true;

    try {
      const now = this.ctx.currentTime;
      if (this.voiceGain) {
        this.voiceGain.gain.cancelScheduledValues(now);
        this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, now);
        this.voiceGain.gain.linearRampToValueAtTime(0.0001, now + rampSeconds);
      }

      setTimeout(() => {
        this.disconnect();
      }, rampSeconds * 1000 + 20);
    } catch {
      this.disconnect();
    }
  }

  private disconnect(): void {
    try {
      this.burstSource?.disconnect();
      this.delayNode?.disconnect();
      this.loopFilter?.disconnect();
      this.loopGain?.disconnect();
      this.airResonance?.disconnect();
      this.woodResonance?.disconnect();
      this.bridgeResonance?.disconnect();
      this.voiceGain?.disconnect();
      this.panner?.disconnect();
    } catch {
      // Disconnection cleanup
    }
  }
}
