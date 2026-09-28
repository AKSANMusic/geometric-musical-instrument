import { describe, it, expect, vi } from 'vitest';
import { MidiManager } from '../midi/midi-manager';
import type { MIDIOutput, MIDIInput } from '../midi/midi-types';

describe('MIDI Manager', () => {
  describe('Pitch Bend Calculations (Microtonal Just Intonation & Koron)', () => {
    it('should calculate exact center pitch bend (8192) when note matches 12-TET pitch', () => {
      // A4 = 440 Hz -> MIDI 69 exact
      const bend = MidiManager.calculatePitchBend(440, 69);
      expect(bend.cents).toBeCloseTo(0, 4);
      // Normalized bend should be exactly center 8192 (0x2000)
      const fullValue = (bend.msb << 7) | bend.lsb;
      expect(fullValue).toBe(8192);
      expect(bend.lsb).toBe(0);
      expect(bend.msb).toBe(64);
    });

    it('should calculate accurate microtonal bend for Persian Koron interval (12/11)', () => {
      // Persian Koron: 440 * (12/11) = 480 Hz (exact MIDI note 70.506)
      const freq = 440 * (12 / 11);
      const midiNote = Math.round(69 + 12 * Math.log2(freq / 440)); // rounds to 71 (B4)
      const bend = MidiManager.calculatePitchBend(freq, midiNote);

      expect(bend.cents).toBeCloseTo(-49.4, 1);
      const fullValue = (bend.msb << 7) | bend.lsb;
      // Below 8192 since it is tuned down ~49.4 cents from B4
      expect(fullValue).toBeLessThan(8192);
      expect(fullValue).toBeGreaterThanOrEqual(0);

      // Also verify when based on note 70 (A#4) it bends up by +50.6 cents
      const bendFrom70 = MidiManager.calculatePitchBend(freq, 70);
      expect(bendFrom70.cents).toBeCloseTo(50.6, 1);
      const fullValueFrom70 = (bendFrom70.msb << 7) | bendFrom70.lsb;
      expect(fullValueFrom70).toBeGreaterThan(8192);
    });

    it('should calculate accurate microtonal bend for Segah neutral third (11/9)', () => {
      // Segah neutral 3rd: 440 * (11/9) = 537.77 Hz
      // 12-TET C5 is 523.25 Hz (+47.4 cents)
      const freq = 440 * (11 / 9);
      const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
      const bend = MidiManager.calculatePitchBend(freq, midiNote);

      expect(bend.cents).toBeCloseTo(47.4, 1);
      const fullValue = (bend.msb << 7) | bend.lsb;
      expect(fullValue).toBeGreaterThan(8192);
    });

    it('should clamp extreme pitch bends within 14-bit MIDI range [0, 16383]', () => {
      // Large deviation
      const bendHigh = MidiManager.calculatePitchBend(600, 69); // far above
      const valueHigh = (bendHigh.msb << 7) | bendHigh.lsb;
      expect(valueHigh).toBeLessThanOrEqual(16383);

      const bendLow = MidiManager.calculatePitchBend(300, 69); // far below
      const valueLow = (bendLow.msb << 7) | bendLow.lsb;
      expect(valueLow).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Standard MIDI Transmission & Message Formatting', () => {
    it('should clamp channel numbers between 0 and 15 (Channels 1-16)', () => {
      const manager = new MidiManager();
      manager.setChannel(1); // Ch 1 -> 0
      manager.setChannel(16); // Ch 16 -> 15
      manager.setChannel(25); // Should clamp to 15
      manager.setChannel(-3); // Should clamp to 0
    });

    it('should send standard Note On and Pitch Bend bytes to output port', () => {
      const manager = new MidiManager();
      const sentBytes: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'mock-synth',
        name: 'Hardware Synth',
        state: 'connected',
        send: vi.fn((data: number[] | Uint8Array) => {
          sentBytes.push(Array.from(data));
        }),
      };

      // Mock internal midiAccess outputs
      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('mock-synth', mockOutput);

      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('mock-synth');
      manager.setChannel(1); // Channel 1 -> status 0x90 Note On, 0xE0 Pitch Bend
      manager.setPitchBendEnabled(true);

      // Send Note for A4 (440Hz)
      manager.sendNoteOn(440, 100, 0.5);

      // Verify Pitch Bend and Note On messages sent
      expect(mockOutput.send).toHaveBeenCalledTimes(2);

      // 1. Pitch Bend message: [0xE0 | 0, lsb, msb]
      expect(sentBytes[0][0]).toBe(0xe0);
      expect(sentBytes[0][1]).toBe(0);  // lsb for center 8192
      expect(sentBytes[0][2]).toBe(64); // msb for center 8192

      // 2. Note On message: [0x90 | 0, 69, 100]
      expect(sentBytes[1][0]).toBe(0x90);
      expect(sentBytes[1][1]).toBe(69);
      expect(sentBytes[1][2]).toBe(100);
    });

    it('should send standard Note Off message', () => {
      const manager = new MidiManager();
      const sentBytes: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'mock-daw',
        name: 'Ableton Live',
        state: 'connected',
        send: vi.fn((data: number[] | Uint8Array) => {
          sentBytes.push(Array.from(data));
        }),
      };

      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('mock-daw', mockOutput);
      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('mock-daw');
      manager.setChannel(2); // Channel 2 -> status 0x81 Note Off
      manager.sendNoteOff(60); // Middle C

      expect(sentBytes[0][0]).toBe(0x81);
      expect(sentBytes[0][1]).toBe(60);
      expect(sentBytes[0][2]).toBe(0);
    });

    it('should send Control Change (CC) messages', () => {
      const manager = new MidiManager();
      const sentBytes: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'mock-port',
        name: 'Virtual MIDI',
        state: 'connected',
        send: vi.fn((data: number[] | Uint8Array) => {
          sentBytes.push(Array.from(data));
        }),
      };

      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('mock-port', mockOutput);
      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('mock-port');
      manager.setChannel(1); // Ch 1 -> 0xB0

      // CC 7 (Volume) at value 110
      manager.sendControlChange(7, 110);
      expect(sentBytes[0]).toEqual([0xb0, 7, 110]);

      // CC 1 (Modulation Wheel) at value 64
      manager.sendControlChange(1, 64);
      expect(sentBytes[1]).toEqual([0xb0, 1, 64]);
    });

    it('should send Panic / All Notes Off messages', () => {
      const manager = new MidiManager();
      const sentBytes: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'mock-port',
        name: 'Virtual MIDI',
        state: 'connected',
        send: vi.fn((data: number[] | Uint8Array) => {
          sentBytes.push(Array.from(data));
        }),
      };

      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('mock-port', mockOutput);
      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('mock-port');
      manager.setChannel(1);
      manager.panic();

      // Should send CC 120 (All Sound Off) and CC 123 (All Notes Off)
      expect(sentBytes).toEqual([
        [0xb0, 120, 0],
        [0xb0, 123, 0],
      ]);
    });
  });

  describe('Standard MIDI IN Message Parsing', () => {
    it('should trigger onNoteIn on incoming Note On messages', () => {
      const manager = new MidiManager();
      const receivedNotes: Array<{ note: number; vel: number; ch: number }> = [];

      manager.onNoteIn = (note, vel, ch) => {
        receivedNotes.push({ note, vel, ch });
      };

      const mockInput: MIDIInput = {
        id: 'keyboard-in',
        name: 'USB Keyboard',
        state: 'connected',
        onmidimessage: null,
      };

      const inputsMap = new Map<string, MIDIInput>();
      inputsMap.set('keyboard-in', mockInput);
      (manager as unknown as { midiAccess: { inputs: Map<string, MIDIInput> } }).midiAccess = {
        inputs: inputsMap,
      };

      manager.setInput('keyboard-in');
      expect(mockInput.onmidimessage).toBeDefined();

      // Simulate Note On: [0x90, 60, 115] (Middle C on Ch 1, velocity 115)
      mockInput.onmidimessage!({
        data: new Uint8Array([0x90, 60, 115]),
      });

      expect(receivedNotes).toHaveLength(1);
      expect(receivedNotes[0]).toEqual({ note: 60, vel: 115, ch: 0 });
    });

    it('should trigger onCCIn on incoming Control Change messages', () => {
      const manager = new MidiManager();
      const receivedCC: Array<{ cc: number; val: number; ch: number }> = [];

      manager.onCCIn = (cc, val, ch) => {
        receivedCC.push({ cc, val, ch });
      };

      const mockInput: MIDIInput = {
        id: 'keyboard-in',
        name: 'USB Keyboard',
        state: 'connected',
        onmidimessage: null,
      };

      const inputsMap = new Map<string, MIDIInput>();
      inputsMap.set('keyboard-in', mockInput);
      (manager as unknown as { midiAccess: { inputs: Map<string, MIDIInput> } }).midiAccess = {
        inputs: inputsMap,
      };

      manager.setInput('keyboard-in');

      // Simulate CC 1 (Modulation Wheel) value 90
      mockInput.onmidimessage!({
        data: new Uint8Array([0xb0, 1, 90]),
      });

      expect(receivedCC).toHaveLength(1);
      expect(receivedCC[0]).toEqual({ cc: 1, val: 90, ch: 0 });
    });
  });

  describe('Instrument Range Constraint (SWAM Cello C2-G5)', () => {
    it('should smart-fold out-of-range MIDI notes into target instrument register', () => {
      const manager = new MidiManager();
      const sentPackets: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'swam-out',
        name: 'SWAM Cello VST',
        state: 'connected',
        send: vi.fn((bytes: number[]) => {
          sentPackets.push(Array.from(bytes));
        }),
      };

      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('swam-out', mockOutput);
      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('swam-out');
      // Set SWAM Cello range: C2 (36) to G5 (79) with behavior 'fold'
      manager.setRangeConfig({
        enabled: true,
        presetId: 'swam-cello',
        minMidi: 36,
        maxMidi: 79,
        behavior: 'fold',
      });

      // Try to send C1 (~32.7 Hz, MIDI 24 - below cello range)
      manager.sendNoteOn(32.7, 100, 1.0);

      // Should have folded up 1 octave to C2 (MIDI 36)
      const noteOnPackets = sentPackets.filter(p => (p[0] & 0xf0) === 0x90);
      expect(noteOnPackets.length).toBeGreaterThan(0);
      const lastNoteOn = noteOnPackets[noteOnPackets.length - 1];
      expect(lastNoteOn[1]).toBe(36); // C2
    });

    it('should mute out-of-range notes when behavior is set to mute', () => {
      const manager = new MidiManager();
      const sentPackets: number[][] = [];

      const mockOutput: MIDIOutput = {
        id: 'swam-out',
        name: 'SWAM Cello VST',
        state: 'connected',
        send: vi.fn((bytes: number[]) => {
          sentPackets.push(Array.from(bytes));
        }),
      };

      const outputsMap = new Map<string, MIDIOutput>();
      outputsMap.set('swam-out', mockOutput);
      (manager as unknown as { midiAccess: { outputs: Map<string, MIDIOutput> } }).midiAccess = {
        outputs: outputsMap,
      };

      manager.setOutput('swam-out');
      // Set SWAM Cello range with behavior 'mute'
      manager.setRangeConfig({
        enabled: true,
        presetId: 'swam-cello',
        minMidi: 36,
        maxMidi: 79,
        behavior: 'mute',
      });

      // Send C1 (~32.7 Hz) — out of range
      manager.sendNoteOn(32.7, 100, 1.0);

      // Should be completely muted (no Note On sent)
      const noteOnPackets = sentPackets.filter(p => (p[0] & 0xf0) === 0x90);
      expect(noteOnPackets).toHaveLength(0);

      // Now send D3 (~146.8 Hz, MIDI 50) — inside cello range
      manager.sendNoteOn(146.8, 100, 1.0);
      const validNoteOn = sentPackets.filter(p => (p[0] & 0xf0) === 0x90);
      expect(validNoteOn).toHaveLength(1);
      expect(validNoteOn[0][1]).toBe(50); // D3
    });
  });
});

