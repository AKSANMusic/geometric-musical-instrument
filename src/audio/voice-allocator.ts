import type { NoteEvent } from '../types';
import { FMVoice, INSTRUMENT_PRESETS, type InstrumentPreset } from './fm-synth';

/**
 * Polyphony manager with voice stealing, amplitude ducking, and acoustic preset routing.
 */
export class VoiceAllocator {
  private voices: FMVoice[] = [];
  private nextId = 0;
  private lastOnset = new Map<string, number>(); // "level-edge" → timestamp ms
  private ctx: AudioContext;
  private destination: AudioNode;
  private maxVoices: number;
  private minIOI: number;
  private noteDuration: number;
  public currentPreset: InstrumentPreset;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    maxVoices = 32,
    minIOI = 20,
    noteDuration = 1.8,
    presetKey = 'santur',
  ) {
    this.ctx = ctx;
    this.destination = destination;
    this.maxVoices = maxVoices;
    this.minIOI = minIOI;
    this.noteDuration = noteDuration;
    this.currentPreset = INSTRUMENT_PRESETS[presetKey] || INSTRUMENT_PRESETS.santur;
  }

  /** Set base note sustain duration */
  setNoteDuration(duration: number): void {
    this.noteDuration = Math.max(0.3, Math.min(5.0, duration));
  }

  /** Change active acoustic instrument preset */
  setPreset(presetKey: string): void {
    if (INSTRUMENT_PRESETS[presetKey]) {
      this.currentPreset = INSTRUMENT_PRESETS[presetKey];
    }
  }

  /**
   * Attempt to play a note. Returns the created FMVoice if triggered, or null if de-bounced.
   */
  trigger(note: NoteEvent, scheduledTime?: number): FMVoice | null {
    // --- De-bounce ---
    const key = `${note.pentagonLevel}-${note.edgeIndex}`;
    const nowMs = note.timestamp * 1000;
    const lastMs = this.lastOnset.get(key) ?? -Infinity;
    if (nowMs - lastMs < this.minIOI) {
      return null; // too soon
    }
    this.lastOnset.set(key, nowMs);

    // --- Prune ended voices ---
    this.voices = this.voices.filter(v => !v.ended);

    // --- Voice stealing using priority scoring ---
    if (this.voices.length >= this.maxVoices) {
      this.stealVoice();
    }

    // --- Smooth amplitude ducking under dense chords ---
    const activeCount = this.voices.length;
    const duckThreshold = Math.floor(this.maxVoices * 0.7);
    let gainMul = 1;
    if (activeCount > duckThreshold) {
      gainMul = Math.max(
        0.35,
        1 - (activeCount - duckThreshold) / (this.maxVoices - duckThreshold),
      );
    }

    // --- Create voice ---
    const voice = new FMVoice(
      this.ctx,
      this.destination,
      note,
      this.noteDuration,
      this.nextId++,
      gainMul,
      this.currentPreset,
      scheduledTime,
    );
    this.voices.push(voice);
    return voice;
  }

  /** Release a specific voice smoothly (for keyup / note-off) */
  releaseVoice(voice: FMVoice, releaseSec?: number): void {
    voice.release(releaseSec);
  }

  /**
   * Priority-based voice stealing:
   * Steals the voice with the lowest priority score rather than just the oldest.
   * Protects bass fundamentals and newly struck attack transients.
   */
  private stealVoice(): void {
    if (this.voices.length === 0) return;
    const now = this.ctx.currentTime;
    let victimIdx = 0;
    let lowestScore = Infinity;

    for (let i = 0; i < this.voices.length; i++) {
      const score = this.voices[i].getPriorityScore(now);
      if (score < lowestScore) {
        lowestScore = score;
        victimIdx = i;
      }
    }

    this.voices[victimIdx].stop();
    this.voices.splice(victimIdx, 1);
  }

  /** Backward-compatible alias for stealVoice */
  private stealOldest(): void {
    this.stealVoice();
  }

  /** Get current active voice count. */
  get activeVoices(): number {
    this.voices = this.voices.filter(v => !v.ended);
    return this.voices.length;
  }

  /** Stop all voices. */
  stopAll(): void {
    for (const v of this.voices) v.stop();
    this.voices = [];
    this.lastOnset.clear();
  }
}
