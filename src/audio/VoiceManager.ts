/**
 * VoiceManager.ts — Centralized Polyphonic Voice Manager & Pitch Identity Tracker
 *
 * Implements REBUILD_SPEC_V2.md Section 6:
 * - Polyphony allocation with graceful stealing (15ms click-free crossfade).
 * - Stable PitchIdentity tracking with common-tone retention.
 * - Bridges VoiceLeading decisions with physical synthesis instances.
 */

import type { MusicalEvent } from '../domain/events';
import { KarplusStrongVoice } from './KarplusStrongVoice';
import type { ActiveVoicePitch } from '../music/VoiceLeading';

export class VoiceManager {
  private ctx: AudioContext;
  private destination: AudioNode;
  private maxVoices: number;
  private activeVoices: Map<string, KarplusStrongVoice> = new Map();

  constructor(ctx: AudioContext, destination: AudioNode, maxVoices = 12) {
    this.ctx = ctx;
    this.destination = destination;
    this.maxVoices = maxVoices;
  }

  public setMaxVoices(max: number): void {
    this.maxVoices = Math.max(2, Math.min(32, max));
  }

  /**
   * Return lightweight representation of active voices for VoiceLeading cost calculations.
   */
  public getActiveVoicePitches(): ActiveVoicePitch[] {
    this.pruneEnded();
    const list: ActiveVoicePitch[] = [];
    for (const [id, voice] of this.activeVoices.entries()) {
      list.push({
        voiceId: id,
        pitchHz: voice.pitchHz,
        midiNoteFloat: 69 + 12 * Math.log2(voice.pitchHz / 440),
        lastTriggerTime: voice.startTime,
      });
    }
    return list;
  }

  /**
   * Play or re-excite a musical event.
   */
  public trigger(event: MusicalEvent): void {
    this.pruneEnded();

    // 1. Check for common-tone retention
    if (event.commonToneRetained && event.voiceId && this.activeVoices.has(event.voiceId)) {
      const existingVoice = this.activeVoices.get(event.voiceId)!;
      existingVoice.reExcite(event);
      return;
    }

    // 2. Check if pitch already exists in another voice (< 5 cents)
    for (const [id, voice] of this.activeVoices.entries()) {
      const centsDiff = Math.abs(1200 * Math.log2(event.pitchHz / voice.pitchHz));
      if (centsDiff < 5) {
        voice.reExcite(event);
        return;
      }
    }

    // 3. Check polyphony limit & steal oldest if necessary
    if (this.activeVoices.size >= this.maxVoices) {
      this.stealOldest();
    }

    // 4. Instantiate new physical modeling voice
    const voiceId = event.voiceId || `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newVoice = new KarplusStrongVoice(this.ctx, this.destination, event, voiceId);
    this.activeVoices.set(voiceId, newVoice);
  }

  /**
   * Smoothly steal the oldest active voice.
   */
  private stealOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, voice] of this.activeVoices.entries()) {
      if (voice.startTime < oldestTime) {
        oldestTime = voice.startTime;
        oldestId = id;
      }
    }

    if (oldestId) {
      const victim = this.activeVoices.get(oldestId)!;
      victim.stop(0.015);
      this.activeVoices.delete(oldestId);
    }
  }

  private pruneEnded(): void {
    for (const [id, voice] of this.activeVoices.entries()) {
      if (voice.ended) {
        this.activeVoices.delete(id);
      }
    }
  }

  public getActiveCount(): number {
    this.pruneEnded();
    return this.activeVoices.size;
  }

  public stopAll(): void {
    for (const voice of this.activeVoices.values()) {
      voice.stop(0.02);
    }
    this.activeVoices.clear();
  }
}
