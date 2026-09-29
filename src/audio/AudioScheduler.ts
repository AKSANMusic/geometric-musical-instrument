/**
 * AudioScheduler.ts — High-Precision Look-Ahead Audio Clock Scheduler
 *
 * Implements REBUILD_SPEC_V2.md Section 1, 2 & 4:
 * Eliminates setTimeout for musical rhythms.
 * Drives playback using Web Audio's sample-accurate AudioContext.currentTime clock
 * with a 75ms look-ahead window and 25ms timer intervals.
 */

import type { MusicalEvent } from '../domain/events';
import { VoiceManager } from './VoiceManager';

export type EventDispatchCallback = (event: MusicalEvent) => void;

export class AudioScheduler {
  private ctx: AudioContext;
  private voiceManager: VoiceManager;
  private queue: MusicalEvent[] = [];
  private timerId: number | null = null;
  private lookaheadMs = 75; // Lookahead window in ms
  private intervalMs = 25;  // Check interval in ms
  private dispatchListeners: Set<EventDispatchCallback> = new Set();
  private isRunning = false;

  constructor(ctx: AudioContext, voiceManager: VoiceManager) {
    this.ctx = ctx;
    this.voiceManager = voiceManager;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timerId = window.setInterval(() => this.tick(), this.intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.queue = [];
  }

  public onDispatch(callback: EventDispatchCallback): () => void {
    this.dispatchListeners.add(callback);
    return () => this.dispatchListeners.delete(callback);
  }

  /**
   * Schedule a MusicalEvent.
   * If the event is immediate (timestamp <= currentTime + 0.01), it fires directly.
   * Otherwise it joins the priority queue sorted by timestamp.
   */
  public schedule(event: MusicalEvent): void {
    const now = this.ctx.currentTime;
    const lookaheadSec = this.lookaheadMs / 1000;

    if (event.time <= now + 0.01) {
      // Immediate trigger for real-time human gestures
      this.dispatchEvent(event);
      return;
    }

    if (event.time <= now + lookaheadSec) {
      // Within current lookahead window
      this.dispatchEvent(event);
      return;
    }

    // Insert into sorted queue (ascending order of time)
    let idx = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].time > event.time) {
        idx = i;
        break;
      }
    }
    this.queue.splice(idx, 0, event);
  }

  private tick(): void {
    if (!this.isRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    const lookaheadHorizon = now + this.lookaheadMs / 1000;

    while (this.queue.length > 0 && this.queue[0].time <= lookaheadHorizon) {
      const event = this.queue.shift()!;
      this.dispatchEvent(event);
    }
  }

  private dispatchEvent(event: MusicalEvent): void {
    this.voiceManager.trigger(event);
    for (const listener of this.dispatchListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in audio scheduler dispatch listener:', err);
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}
