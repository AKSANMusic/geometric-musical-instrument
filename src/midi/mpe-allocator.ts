/**
 * mpe-allocator.ts — MPE (MIDI Polyphonic Expression) Channel Allocator
 *
 * Solves the critical polyphonic microtonal MIDI problem:
 * Standard MIDI pitch bend is channel-wide — sending a new bend detunes
 * all sustaining notes on the same channel. MPE allocates one channel per note
 * within a configurable zone, enabling independent per-note pitch bend.
 *
 * Supports:
 * - Lower Zone (master ch 1, members 2-16) and Upper Zone (master ch 16, members 15-1)
 * - Channel-per-note allocation with round-robin reuse
 * - Configurable exhaustion policy (steal-oldest, reject, quantize)
 * - Bend-before-note ordering
 * - Automatic pitch-bend reset on note release
 * - RPN pitch bend range configuration
 * - Panic / all-notes-off
 */

import type { MIDIOutput } from './midi-types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MPEZone = 'lower' | 'upper';

export type ChannelExhaustionPolicy =
  | 'steal-oldest'    // Kill the oldest note and reuse its channel
  | 'reject'          // Silently drop the new note
  | 'quantize'        // Send without microtonal deviation (nearest 12-TET)
  | 'internal-only';  // Route to internal audio only, skip MIDI

export interface MPEConfig {
  enabled: boolean;
  zone: MPEZone;
  pitchBendRangeSemitones: number;  // ±N semitones (default 2)
  exhaustionPolicy: ChannelExhaustionPolicy;
}

export interface MPEAllocation {
  noteId: string;
  channel: number;          // 0-indexed MIDI channel
  midiNote: number;         // Base MIDI note (nearest 12-TET)
  frequency: number;        // Exact target frequency in Hz
  velocity: number;
  timestamp: number;        // Allocation time (performance.now())
}

export interface MPEAllocateResult {
  success: boolean;
  allocation?: MPEAllocation;
  policy?: ChannelExhaustionPolicy;  // Which policy was applied if exhausted
  stolenNoteId?: string;             // ID of note that was killed
  messages: MPEMessage[];            // Ordered MIDI messages to send
}

export interface MPEReleaseResult {
  success: boolean;
  messages: MPEMessage[];
}

export interface MPEMessage {
  data: number[];
  description: string;
}

export const DEFAULT_MPE_CONFIG: MPEConfig = {
  enabled: true,
  zone: 'lower',
  pitchBendRangeSemitones: 2,
  exhaustionPolicy: 'steal-oldest',
};

// ─── MPE Channel Allocator ───────────────────────────────────────────────────

export class MPEAllocator {
  private config: MPEConfig;
  private activeNotes: Map<string, MPEAllocation> = new Map();
  private channelOrder: number[] = []; // Round-robin order for fair reuse

  constructor(config: MPEConfig = DEFAULT_MPE_CONFIG) {
    this.config = { ...config };
    this.channelOrder = this.buildMemberChannels();
  }

  // ─── Configuration ─────────────────────────────────────────────────────

  /** Get the master channel (0-indexed) */
  get masterChannel(): number {
    return this.config.zone === 'lower' ? 0 : 15;
  }

  /** Get all member channels (0-indexed) */
  get memberChannels(): number[] {
    return [...this.channelOrder];
  }

  /** Get the maximum number of simultaneous microtonal notes */
  get capacity(): number {
    return this.channelOrder.length;
  }

  /** Get current active note count */
  get activeCount(): number {
    return this.activeNotes.size;
  }

  /** Get current configuration */
  getConfig(): Readonly<MPEConfig> {
    return { ...this.config };
  }

  /** Update configuration (rebuilds channel map) */
  setConfig(config: Partial<MPEConfig>): void {
    this.config = { ...this.config, ...config };
    this.channelOrder = this.buildMemberChannels();
  }

  // ─── Allocation ────────────────────────────────────────────────────────

  /**
   * Allocate a channel for a new note with microtonal pitch bend.
   *
   * Returns ordered MIDI messages: pitch bend FIRST, then note-on.
   * This ordering ensures the DAW/VST receives the correct pitch
   * before the note sounds.
   */
  allocate(
    noteId: string,
    frequency: number,
    velocity: number,
    timestamp: number = performance.now(),
  ): MPEAllocateResult {
    if (!this.config.enabled) {
      return { success: false, messages: [], policy: 'reject' };
    }

    // Calculate base MIDI note and cents offset
    const exactMidi = 69 + 12 * Math.log2(frequency / 440);
    const baseMidi = Math.round(exactMidi);
    const clampedMidi = Math.max(0, Math.min(127, baseMidi));
    const clampedVel = Math.max(1, Math.min(127, Math.round(velocity)));

    // Find a free member channel
    let channel = this.findFreeChannel();
    let stolenNoteId: string | undefined;

    if (channel === null) {
      // All channels occupied — apply exhaustion policy
      switch (this.config.exhaustionPolicy) {
        case 'reject':
          return { success: false, messages: [], policy: 'reject' };

        case 'quantize': {
          // Use master channel with no pitch bend (12-TET only)
          const masterCh = this.masterChannel;
          const messages: MPEMessage[] = [
            {
              data: [0xe0 | masterCh, 0x00, 0x40], // Center pitch bend
              description: `PitchBend center on master ch ${masterCh + 1}`,
            },
            {
              data: [0x90 | masterCh, clampedMidi, clampedVel],
              description: `NoteOn ${clampedMidi} vel=${clampedVel} on master ch ${masterCh + 1} (quantized)`,
            },
          ];
          return { success: true, messages, policy: 'quantize' };
        }

        case 'internal-only':
          return { success: false, messages: [], policy: 'internal-only' };

        case 'steal-oldest':
        default: {
          // Find and kill the oldest note
          const oldest = this.findOldestNote();
          if (!oldest) {
            return { success: false, messages: [], policy: 'reject' };
          }
          stolenNoteId = oldest.noteId;
          channel = oldest.channel;

          // Generate note-off + bend reset for stolen note
          const releaseResult = this.release(oldest.noteId);
          // Channel is now free
          break;
        }
      }
    }

    if (channel === null) {
      return { success: false, messages: [], policy: 'reject' };
    }

    // Calculate 14-bit pitch bend
    const centsOffset = (exactMidi - clampedMidi) * 100;
    const bendRange = this.config.pitchBendRangeSemitones * 100; // in cents
    const clampedCents = Math.max(-bendRange, Math.min(bendRange, centsOffset));
    const normalizedBend = Math.round(8192 + (clampedCents / bendRange) * 8191);
    const bend14 = Math.max(0, Math.min(16383, normalizedBend));
    const lsb = bend14 & 0x7f;
    const msb = (bend14 >> 7) & 0x7f;

    // Record allocation
    const allocation: MPEAllocation = {
      noteId,
      channel,
      midiNote: clampedMidi,
      frequency,
      velocity: clampedVel,
      timestamp,
    };
    this.activeNotes.set(noteId, allocation);

    // Build ordered messages: BEND FIRST, then NOTE ON
    const messages: MPEMessage[] = [
      {
        data: [0xe0 | channel, lsb, msb],
        description: `PitchBend ${clampedCents.toFixed(1)}¢ on ch ${channel + 1}`,
      },
      {
        data: [0x90 | channel, clampedMidi, clampedVel],
        description: `NoteOn ${clampedMidi} vel=${clampedVel} on ch ${channel + 1}`,
      },
    ];

    return {
      success: true,
      allocation,
      messages,
      stolenNoteId,
    };
  }

  /**
   * Release a note and free its channel.
   *
   * Sends note-off and resets pitch bend to center.
   */
  release(noteId: string): MPEReleaseResult {
    const allocation = this.activeNotes.get(noteId);
    if (!allocation) {
      return { success: false, messages: [] };
    }

    this.activeNotes.delete(noteId);

    const messages: MPEMessage[] = [
      {
        data: [0x80 | allocation.channel, allocation.midiNote, 0],
        description: `NoteOff ${allocation.midiNote} on ch ${allocation.channel + 1}`,
      },
      {
        data: [0xe0 | allocation.channel, 0x00, 0x40], // Reset bend to center
        description: `PitchBend reset on ch ${allocation.channel + 1}`,
      },
    ];

    return { success: true, messages };
  }

  /**
   * Generate RPN messages to configure pitch-bend range on all member channels.
   * Should be sent once when connecting to a DAW/VST.
   */
  buildRPNMessages(): MPEMessage[] {
    const messages: MPEMessage[] = [];
    const range = this.config.pitchBendRangeSemitones;

    for (const ch of this.channelOrder) {
      // RPN 0: Pitch Bend Sensitivity
      messages.push(
        { data: [0xb0 | ch, 101, 0], description: `RPN MSB=0 on ch ${ch + 1}` },
        { data: [0xb0 | ch, 100, 0], description: `RPN LSB=0 on ch ${ch + 1}` },
        { data: [0xb0 | ch, 6, range], description: `PB range ${range} semitones on ch ${ch + 1}` },
        { data: [0xb0 | ch, 38, 0], description: `PB range fine=0 on ch ${ch + 1}` },
      );
    }

    return messages;
  }

  /**
   * Send panic: all notes off on all member channels.
   */
  panic(): MPEMessage[] {
    const messages: MPEMessage[] = [];

    for (const ch of this.channelOrder) {
      messages.push(
        { data: [0xb0 | ch, 120, 0], description: `All Sound Off ch ${ch + 1}` },
        { data: [0xb0 | ch, 123, 0], description: `All Notes Off ch ${ch + 1}` },
      );
    }

    // Also panic master channel
    const master = this.masterChannel;
    messages.push(
      { data: [0xb0 | master, 120, 0], description: `All Sound Off master ch ${master + 1}` },
      { data: [0xb0 | master, 123, 0], description: `All Notes Off master ch ${master + 1}` },
    );

    this.activeNotes.clear();
    return messages;
  }

  /**
   * Check if a specific note is currently allocated.
   */
  isActive(noteId: string): boolean {
    return this.activeNotes.has(noteId);
  }

  /**
   * Get allocation info for a specific note.
   */
  getAllocation(noteId: string): MPEAllocation | undefined {
    return this.activeNotes.get(noteId);
  }

  /**
   * Get all currently active allocations.
   */
  getAllActive(): MPEAllocation[] {
    return Array.from(this.activeNotes.values());
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private buildMemberChannels(): number[] {
    if (this.config.zone === 'lower') {
      // Lower zone: master = ch 0 (1), members = ch 1-14 (2-15)
      // Channel 9 (10) is drum channel in GM — skip it
      return [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14];
    } else {
      // Upper zone: master = ch 15 (16), members = ch 14-1 (15-2)
      return [14, 13, 12, 11, 10, 8, 7, 6, 5, 4, 3, 2, 1];
    }
  }

  private findFreeChannel(): number | null {
    const usedChannels = new Set(
      Array.from(this.activeNotes.values()).map(a => a.channel),
    );

    for (const ch of this.channelOrder) {
      if (!usedChannels.has(ch)) {
        return ch;
      }
    }
    return null;
  }

  private findOldestNote(): MPEAllocation | null {
    let oldest: MPEAllocation | null = null;
    for (const alloc of this.activeNotes.values()) {
      if (!oldest || alloc.timestamp < oldest.timestamp) {
        oldest = alloc;
      }
    }
    return oldest;
  }
}
