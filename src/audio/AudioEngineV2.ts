/**
 * AudioEngineV2.ts — High-Level Audio Engine Subsystem
 *
 * Encapsulates the Web Audio graph:
 * [ Voices ] -> [ MasterLimiter (DC Blocker -> Soft Saturator -> Dual Compressors -> Master Gain) ] -> [ Destination ]
 * Driven by AudioScheduler and managed by VoiceManager.
 */

import { MasterLimiter } from './MasterLimiter';
import { VoiceManager } from './VoiceManager';
import { AudioScheduler } from './AudioScheduler';
import type { MusicalEvent } from '../domain/events';

export class AudioEngineV2 {
  private ctx: AudioContext | null = null;
  private limiter: MasterLimiter | null = null;
  private voiceManager: VoiceManager | null = null;
  private scheduler: AudioScheduler | null = null;
  private _isInitialized = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  get audioScheduler(): AudioScheduler | null {
    return this.scheduler;
  }

  get currentAudioTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * Initialize Web Audio context on user gesture.
   */
  public async init(): Promise<void> {
    if (this._isInitialized) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.limiter = new MasterLimiter(this.ctx);
    this.limiter.output.connect(this.ctx.destination);

    this.voiceManager = new VoiceManager(this.ctx, this.limiter.input, 12);
    this.scheduler = new AudioScheduler(this.ctx, this.voiceManager);
    this.scheduler.start();

    this._isInitialized = true;
  }

  /**
   * Schedule or immediately play a MusicalEvent.
   */
  public scheduleEvent(event: MusicalEvent): void {
    if (!this.scheduler) return;
    this.scheduler.schedule(event);
  }

  public setMasterVolume(volume: number): void {
    this.limiter?.setVolume(volume);
  }

  public getMasterVolume(): number {
    return this.limiter?.getVolume() ?? 0.8;
  }

  public getActiveVoiceCount(): number {
    return this.voiceManager?.getActiveCount() ?? 0;
  }

  public stopAll(): void {
    this.scheduler?.stop();
    this.voiceManager?.stopAll();
    if (this.scheduler && this.ctx) {
      this.scheduler.start();
    }
  }

  public async dispose(): Promise<void> {
    this.stopAll();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
    this._isInitialized = false;
  }
}
