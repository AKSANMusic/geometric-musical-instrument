import type { CollisionEvent, NoteEvent, Edge } from '../types';
import { collisionToNote } from './note-mapper';
import { VoiceAllocator, type PlayableVoice } from './voice-allocator';
import { ReverbEffect } from './reverb';
import { BowedStringVoice } from './physical-bow-string';
import { DroneSynthesizer, DASTGAH_PRESETS, type DastgahScale } from './dastgah-engine';

/**
 * Top-level audio renderer: receives CollisionEvents, converts to NoteEvents,
 * and routes them through the physical voice allocator, wooden soundboard EQ,
 * continuous modal drone synthesizer, and lush stereo acoustic convolution reverb.
 */
export class AudioRenderer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverb: ReverbEffect | null = null;
  private allocator: VoiceAllocator | null = null;
  private drone: DroneSynthesizer | null = null;
  private activeKeyVoices = new Map<string, PlayableVoice[]>();
  private activeBowingVoice: BowedStringVoice | null = null;
  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the Web Audio context. Must be called from a user gesture.
   */
  async init(
    maxVoices = 32,
    minIOI = 20,
    noteDuration = 1.8,
    reverbMix = 0.38,
    presetKey = 'swamCello',
  ): Promise<void> {
    if (this._initialized) return;

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    // 20Hz DC-blocking filter to prevent subsonic rumble and DC offset
    const dcBlocker = this.ctx.createBiquadFilter();
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 20;
    dcBlocker.Q.value = 0.707;

    this.masterGain.connect(dcBlocker);
    dcBlocker.connect(this.ctx.destination);

    // Lush acoustic reverb & wooden body simulation
    this.reverb = new ReverbEffect(this.ctx, reverbMix);
    this.reverb.connect(this.masterGain);

    this.allocator = new VoiceAllocator(
      this.ctx,
      this.reverb.input,
      maxVoices,
      minIOI,
      noteDuration,
      presetKey,
    );

    // Modal drone generator connected to master reverb
    this.drone = new DroneSynthesizer(this.ctx, this.reverb.input);

    this._initialized = true;
  }

  /** Expose the active AudioContext (for sample-accurate timing) */
  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Process a batch of collision events from the physics engine.
   */
  processCollisions(events: CollisionEvent[]): NoteEvent[] {
    if (!this.allocator) return [];
    const notes: NoteEvent[] = [];
    for (const event of events) {
      const note = collisionToNote(event);
      if (this.allocator.trigger(note)) {
        notes.push(note);
      }
    }
    return notes;
  }

  /**
   * Manually pluck/play a note on a specific edge.
   */
  triggerManualNote(
    edge: Edge,
    pentagonLevel: number,
    param: number,
    velocity = 95,
    totalEdges = 5,
    scheduledTime?: number,
  ): NoteEvent | null {
    if (!this.allocator) return null;

    const freq = edge.frequency;
    const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    // Parabolic timbre curve: warm at center (1), bright at tips (0)
    const brightness = 1 - 4 * (param - 0.5) ** 2;
    const maxIdx = Math.max(1, totalEdges - 1);
    const pan = (2 * edge.index) / maxIdx - 1;

    const noteTimestamp = scheduledTime !== undefined
      ? scheduledTime
      : (this.ctx ? this.ctx.currentTime : performance.now() / 1000);

    const note: NoteEvent = {
      frequency: freq,
      midiNote,
      midiVelocity: Math.min(127, Math.max(1, velocity)),
      brightness: Math.max(0, Math.min(1, brightness)),
      pentagonLevel,
      edgeIndex: edge.index,
      timestamp: noteTimestamp,
      pan,
    };

    if (this.allocator.trigger(note, scheduledTime)) {
      return note;
    }
    return null;
  }

  /**
   * Start a sustained note held down by a key or chord button.
   */
  startKeyNote(
    keyId: string,
    edge: Edge,
    pentagonLevel: number,
    param = 0.5,
    velocity = 95,
    totalEdges = 5,
    scheduledTime?: number,
  ): NoteEvent | null {
    if (!this.allocator) return null;

    const freq = edge.frequency;
    const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    const brightness = 1 - 4 * (param - 0.5) ** 2;
    const maxIdx = Math.max(1, totalEdges - 1);
    const pan = (2 * edge.index) / maxIdx - 1;

    const noteTimestamp = scheduledTime !== undefined
      ? scheduledTime
      : (this.ctx ? this.ctx.currentTime : performance.now() / 1000);

    const note: NoteEvent = {
      frequency: freq,
      midiNote,
      midiVelocity: Math.min(127, Math.max(1, velocity)),
      brightness: Math.max(0, Math.min(1, brightness)),
      pentagonLevel,
      edgeIndex: edge.index,
      timestamp: noteTimestamp,
      pan,
    };

    const voice = this.allocator.trigger(note, scheduledTime);
    if (voice) {
      const list = this.activeKeyVoices.get(keyId) || [];
      list.push(voice);
      this.activeKeyVoices.set(keyId, list);
      return note;
    }
    return null;
  }

  /**
   * Smoothly release all voices associated with a held key or chord.
   */
  stopKeyNote(keyId: string, releaseSec?: number): void {
    const list = this.activeKeyVoices.get(keyId);
    if (!list) return;
    for (const v of list) {
      v.release(releaseSec);
    }
    this.activeKeyVoices.delete(keyId);
  }

  /** Release all currently held key notes */
  stopAllKeyNotes(): void {
    for (const list of this.activeKeyVoices.values()) {
      for (const v of list) {
        v.release();
      }
    }
    this.activeKeyVoices.clear();
  }

  // ─── Modal Drone Management ───────────────────────────────────────────────

  /** Start or toggle the modal drone with specific Dastgah */
  startDrone(scaleId = 'shur', tonicFreq = 146.83): void {
    const scale = DASTGAH_PRESETS[scaleId] || DASTGAH_PRESETS.shur;
    this.drone?.start(scale, tonicFreq);
  }

  /** Stop the modal drone */
  stopDrone(fadeSec = 0.8): void {
    this.drone?.stop(fadeSec);
  }

  /** Modulate the drone to a new Dastgah scale smoothly */
  modulateDrone(scaleId: string, tonicFreq?: number): void {
    const scale = DASTGAH_PRESETS[scaleId] || DASTGAH_PRESETS.shur;
    this.drone?.modulateTo(scale, tonicFreq);
  }

  /** Check if drone is currently playing */
  get isDroneActive(): boolean {
    return this.drone?.active ?? false;
  }

  /** Set drone volume [0, 1] */
  setDroneVolume(vol: number): void {
    this.drone?.setVolume(vol);
  }

  // ─── Direct Bowing Gesture ────────────────────────────────────────────────

  /**
   * Direct acoustic bowing of an edge (mouse drag or MPE touch).
   */
  startBowing(
    freqHz: number,
    bowSpeed = 0.5,
    bowForce = 0.6,
    contactPoint = 0.15,
    pan = 0,
  ): void {
    if (!this.ctx || !this.reverb) return;
    if (this.activeBowingVoice && !this.activeBowingVoice.ended) {
      this.activeBowingVoice.updateBow(bowSpeed, bowForce, contactPoint);
      this.activeBowingVoice.setPitch(freqHz);
      return;
    }

    this.activeBowingVoice = new BowedStringVoice(
      this.ctx,
      this.reverb.input,
      {
        frequency: freqHz,
        bowVelocity: bowSpeed,
        bowForce,
        contactPoint,
        vibratoRate: 5.2,
        vibratoDepthCents: 25,
      },
      9999,
      pan,
    );
  }

  /** Update current bow position, pressure, and speed */
  updateBowing(bowSpeed: number, bowForce: number, contactPoint?: number): void {
    this.activeBowingVoice?.updateBow(bowSpeed, bowForce, contactPoint);
  }

  /** Stop the active bow gesture */
  stopBowing(releaseSec = 0.12): void {
    if (this.activeBowingVoice) {
      this.activeBowingVoice.stop(releaseSec);
      this.activeBowingVoice = null;
    }
  }

  // ─── Global Parameters ───────────────────────────────────────────────────

  /** Set reverb wet mix level [0, 1] */
  setReverbMix(mix: number): void {
    this.reverb?.setMix(mix);
  }

  /** Set note sustain duration in seconds */
  setNoteDuration(duration: number): void {
    this.allocator?.setNoteDuration(duration);
  }

  /** Switch acoustic instrument preset */
  setInstrumentPreset(presetKey: string): void {
    this.allocator?.setPreset(presetKey);
  }

  /** Set master volume (0 to 1). Uses ramped transition to prevent zipper noise. */
  setVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, vol));
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
    }
  }

  /** Get active voice count. */
  get activeVoices(): number {
    return (this.allocator?.activeVoices ?? 0) + (this.isDroneActive ? 1 : 0);
  }

  /** Stop all audio. */
  stopAll(): void {
    this.allocator?.stopAll();
    this.stopDrone(0.2);
    this.stopBowing(0.05);
  }

  /** Close the audio context entirely. */
  async dispose(): Promise<void> {
    this.stopAll();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
    this._initialized = false;
  }
}
