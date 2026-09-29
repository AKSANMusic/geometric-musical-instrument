/**
 * midi-manager.ts — Standard Web MIDI API Manager for Pentagon & Heptagon Sequencer
 *
 * Capabilities:
 * 1. Web MIDI Enumeration & Dynamic Hot-Plugging (statechange detection)
 * 2. Standard MIDI OUT:
 *    - Note On / Note Off transmission
 *    - Microtonal Pitch Bend calculations (±2 semitone / 200 cents pitch bend for Just Intonation & Koron intervals)
 *    - Control Change (CC 7 volume, CC 1 modulation/reverb)
 * 3. Standard MIDI IN:
 *    - Note On plucking of corresponding geometric strings / concentric rings
 *    - CC 7 (Volume), CC 1 (Reverb / Mod), CC 64 (Sustain Pedal)
 * 4. Bidirectional activity callbacks (LED visual indicator)
 */

import type { MIDIAccess, MIDIInput, MIDIOutput, MIDIMessageEvent } from './midi-types';
import {
  foldFrequencyToRange,
  isFrequencyInRange,
  type InstrumentRangeConfig,
} from '../audio/instrument-range';
import {
  MPEAllocator,
  type MPEConfig,
  DEFAULT_MPE_CONFIG,
} from './mpe-allocator';

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: string;
}

export type MidiInNoteHandler = (
  midiNote: number,
  velocity: number,
  channel: number,
) => void;

export type MidiInCCHandler = (
  controller: number,
  value: number,
  channel: number,
) => void;

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedInputId: string = 'all'; // 'all', 'none', or specific ID
  private selectedOutputId: string = 'none'; // 'none' or specific ID
  private channel = 0; // 0-indexed (0 = MIDI Channel 1)
  private sendPitchBend = true;
  private isSupported = false;

  // MPE (MIDI Polyphonic Expression) support
  private mpeAllocator: MPEAllocator = new MPEAllocator();
  private mpeEnabled = false;

  // Active note-off scheduled timers (key: `channel-note` or `mpe-noteId`)
  private noteOffTimers = new Map<string, number>();

  // Range Constraint Configuration (e.g. SWAM Cello C2-G5)
  public rangeConfig?: InstrumentRangeConfig;

  // Event handlers
  public onNoteIn: MidiInNoteHandler | null = null;
  public onCCIn: MidiInCCHandler | null = null;
  public onPortsChanged: (() => void) | null = null;
  public onActivity: ((direction: 'in' | 'out') => void) | null = null;

  constructor() {
    this.isSupported =
      typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public get supported(): boolean {
    return this.isSupported;
  }

  /**
   * Request Web MIDI Access and setup event listeners.
   */
  async init(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Web MIDI API is not supported in this browser.');
      return false;
    }

    try {
      const nav = navigator as unknown as {
        requestMIDIAccess: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
      };
      this.midiAccess = await nav.requestMIDIAccess({ sysex: false });

      // Listen for hardware plug / unplug
      this.midiAccess.onstatechange = () => {
        this.bindInputs();
        this.onPortsChanged?.();
      };

      this.bindInputs();
      return true;
    } catch (err) {
      console.warn('Failed to access Web MIDI API:', err);
      return false;
    }
  }

  /** Get list of available MIDI Input devices */
  getInputs(): MidiPortInfo[] {
    if (!this.midiAccess) return [];
    const inputs: MidiPortInfo[] = [];
    this.midiAccess.inputs.forEach((input: MIDIInput) => {
      inputs.push({
        id: input.id,
        name: input.name || `MIDI Input (${input.id})`,
        manufacturer: input.manufacturer,
        state: input.state,
      });
    });
    return inputs;
  }

  /** Get list of available MIDI Output devices */
  getOutputs(): MidiPortInfo[] {
    if (!this.midiAccess) return [];
    const outputs: MidiPortInfo[] = [];
    this.midiAccess.outputs.forEach((output: MIDIOutput) => {
      outputs.push({
        id: output.id,
        name: output.name || `MIDI Output (${output.id})`,
        manufacturer: output.manufacturer,
        state: output.state,
      });
    });
    return outputs;
  }

  /** Set active MIDI input port */
  setInput(id: string): void {
    this.selectedInputId = id;
    this.bindInputs();
  }

  /** Set active MIDI output port */
  setOutput(id: string): void {
    this.selectedOutputId = id;
  }

  /** Set MIDI channel (1 to 16) */
  setChannel(ch: number): void {
    this.channel = Math.max(0, Math.min(15, ch - 1));
  }

  /** Enable/disable microtonal pitch-bend sending */
  setPitchBendEnabled(enabled: boolean): void {
    this.sendPitchBend = enabled;
  }

  /**
   * Calculate standard 14-bit pitch bend for exact Just Intonation frequency.
   * Assumes standard ±2 semitone (±200 cents) pitch bend range.
   */
  public static calculatePitchBend(
    targetFrequency: number,
    baseMidiNote: number,
  ): { lsb: number; msb: number; cents: number } {
    const exactMidi = 69 + 12 * Math.log2(targetFrequency / 440);
    const centsOffset = (exactMidi - baseMidiNote) * 100;

    // Clamp to ±200 cents
    const clampedCents = Math.max(-200, Math.min(200, centsOffset));
    // Center is 8192 (0x2000). Range is 0 to 16383.
    const normalizedBend = Math.round(8192 + (clampedCents / 200) * 8191);
    const bendValue = Math.max(0, Math.min(16383, normalizedBend));

    return {
      lsb: bendValue & 0x7f,
      msb: (bendValue >> 7) & 0x7f,
      cents: centsOffset,
    };
  }

  /** Set active instrument range constraint configuration */
  setRangeConfig(config?: InstrumentRangeConfig): void {
    this.rangeConfig = config;
  }

  /** Enable/disable MPE (MIDI Polyphonic Expression) mode */
  setMpeEnabled(enabled: boolean): void {
    this.mpeEnabled = enabled;
  }

  /** Check if MPE mode is enabled */
  getMpeEnabled(): boolean {
    return this.mpeEnabled;
  }

  /** Configure MPE parameters (zone, exhaustion policy, bend range) */
  setMpeConfig(config: Partial<MPEConfig>): void {
    this.mpeAllocator.setConfig(config);
  }

  /** Get active MPE allocator */
  getMpeAllocator(): MPEAllocator {
    return this.mpeAllocator;
  }

  /** Send RPN pitch-bend range messages to all MPE member channels */
  sendMpeRPN(): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    const messages = this.mpeAllocator.buildRPNMessages();
    for (const msg of messages) {
      output.send(msg.data);
    }
    this.onActivity?.('out');
  }

  /**
   * Send MIDI Note On to selected output port, with microtonal pitch bend
   * and target instrument range constraint (e.g. SWAM Cello C2-G5).
   *
   * In MPE mode, allocates an isolated member channel per note to guarantee
   * independent microtonal tuning without detuning other active notes.
   */
  sendNoteOn(
    frequency: number,
    velocity: number = 100,
    durationSeconds: number = 1.0,
  ): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;

    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    let targetFreq = frequency;
    let targetMidiNote = Math.round(69 + 12 * Math.log2(frequency / 440));

    // Apply Instrument Range Constraint if active (e.g. SWAM Cello C2-G5)
    if (this.rangeConfig?.enabled) {
      const { minMidi, maxMidi, behavior } = this.rangeConfig;
      if (behavior === 'mute') {
        if (!isFrequencyInRange(targetFreq, minMidi, maxMidi)) {
          return; // Out of playable register — mute MIDI output to protect instrument!
        }
      } else {
        // 'fold' or 'auto-fit': smart octave transposition into playable register
        const folded = foldFrequencyToRange(targetFreq, minMidi, maxMidi);
        targetFreq = folded.frequency;
        targetMidiNote = folded.midiNote;
      }
    }

    const clampedNote = Math.max(0, Math.min(127, targetMidiNote));
    const clampedVel = Math.max(1, Math.min(127, Math.round(velocity)));

    // ─── MPE Polyphonic Microtonal Routing ─────────────────────────────
    if (this.mpeEnabled) {
      const noteId = `mpe-${clampedNote}-${Date.now()}-${Math.random()}`;
      const allocResult = this.mpeAllocator.allocate(noteId, targetFreq, clampedVel);

      if (allocResult.success) {
        for (const msg of allocResult.messages) {
          output.send(msg.data);
        }
        this.onActivity?.('out');

        const timer = setTimeout(() => {
          this.releaseMpeNote(noteId);
          this.noteOffTimers.delete(noteId);
        }, Math.max(50, durationSeconds * 1000));

        this.noteOffTimers.set(noteId, timer as unknown as number);
      }
      return;
    }

    // ─── Standard MIDI 1.0 Single-Channel Routing ───────────────────────
    const ch = this.channel;

    // Send microtonal Pitch Bend if enabled (calculated against exact target frequency)
    if (this.sendPitchBend) {
      const { lsb, msb } = MidiManager.calculatePitchBend(targetFreq, clampedNote);
      output.send([0xe0 | ch, lsb, msb]);
    }

    // Send Note On
    output.send([0x90 | ch, clampedNote, clampedVel]);
    this.onActivity?.('out');

    // Cancel existing note-off timer for this note if re-triggered
    const timerKey = `${ch}-${clampedNote}`;
    const existingTimer = this.noteOffTimers.get(timerKey);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Schedule Note Off
    const timer = setTimeout(() => {
      this.sendNoteOff(clampedNote);
      this.noteOffTimers.delete(timerKey);
    }, Math.max(50, durationSeconds * 1000));

    this.noteOffTimers.set(timerKey, timer as unknown as number);
  }

  /**
   * Release an MPE note and reset its channel pitch bend
   */
  private releaseMpeNote(noteId: string): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    const releaseResult = this.mpeAllocator.release(noteId);
    if (releaseResult.success) {
      for (const msg of releaseResult.messages) {
        output.send(msg.data);
      }
      this.onActivity?.('out');
    }
  }

  /**
   * Send MIDI Note Off
   */
  sendNoteOff(midiNote: number): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    const clampedNote = Math.max(0, Math.min(127, midiNote));
    output.send([0x80 | this.channel, clampedNote, 0]);
    this.onActivity?.('out');
  }

  /**
   * Send MIDI Control Change (CC)
   */
  sendControlChange(controller: number, value: number): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    output.send([
      0xb0 | this.channel,
      controller & 0x7f,
      Math.max(0, Math.min(127, value)),
    ]);
    this.onActivity?.('out');
  }

  /**
   * Send All Notes Off / Panic to selected output
   */
  panic(): void {
    if (!this.midiAccess || this.selectedOutputId === 'none') return;
    const output = this.midiAccess.outputs.get(this.selectedOutputId);
    if (!output) return;

    // Clear all pending note-off timers
    for (const timer of this.noteOffTimers.values()) {
      clearTimeout(timer);
    }
    this.noteOffTimers.clear();

    if (this.mpeEnabled) {
      const panicMsgs = this.mpeAllocator.panic();
      for (const msg of panicMsgs) {
        output.send(msg.data);
      }
      this.onActivity?.('out');
      return;
    }

    // CC 123: All Notes Off, CC 120: All Sound Off
    output.send([0xb0 | this.channel, 120, 0]);
    output.send([0xb0 | this.channel, 123, 0]);
    this.onActivity?.('out');
  }

  /**
   * Wire MIDI message listener to selected input ports
   */
  private bindInputs(): void {
    if (!this.midiAccess) return;

    this.midiAccess.inputs.forEach((input: MIDIInput) => {
      const shouldListen =
        this.selectedInputId === 'all' || this.selectedInputId === input.id;

      if (shouldListen) {
        input.onmidimessage = this.handleMidiMessage.bind(this);
      } else {
        input.onmidimessage = null;
      }
    });
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const command = status >> 4;
    const channel = status & 0x0f;

    // Note On (command 0x9) with velocity > 0
    if (command === 0x09 && data.length >= 3) {
      const note = data[1];
      const velocity = data[2];
      if (velocity > 0) {
        this.onActivity?.('in');
        this.onNoteIn?.(note, velocity, channel);
      } else {
        // Note On with vel=0 is treated as Note Off
        this.onActivity?.('in');
      }
    }
    // Note Off (command 0x08)
    else if (command === 0x08) {
      this.onActivity?.('in');
    }
    // Control Change (command 0x0B)
    else if (command === 0x0b && data.length >= 3) {
      const cc = data[1];
      const value = data[2];
      this.onActivity?.('in');
      this.onCCIn?.(cc, value, channel);
    }
  }

  /**
   * Handle canonical MusicalEvent from the V2 pipeline
   */
  public handleMusicalEvent(event: { pitchHz: number; velocity: number; duration: number }): void {
    const midiVelocity = Math.max(1, Math.min(127, Math.round(event.velocity * 127)));
    this.sendNoteOn(event.pitchHz, midiVelocity, event.duration);
  }
}
