import { describe, it, expect } from 'vitest';
import {
  noteNameToMidi,
  midiToNoteName,
  midiToFrequency,
  frequencyToMidi,
  INSTRUMENT_PRESETS,
  foldFrequencyToRange,
  isFrequencyInRange,
  computeAutoFitRangeParameters,
} from '../audio/instrument-range';

describe('Instrument Range Mapping Engine', () => {
  it('should parse note names to exact MIDI numbers', () => {
    expect(noteNameToMidi('C2')).toBe(36);
    expect(noteNameToMidi('G5')).toBe(79);
    expect(noteNameToMidi('A4')).toBe(69);
    expect(noteNameToMidi('C1')).toBe(24);
    expect(noteNameToMidi('E7')).toBe(100);
    expect(noteNameToMidi('F#3')).toBe(54);
    expect(noteNameToMidi('Bb4')).toBe(70);
  });

  it('should format MIDI numbers to note names', () => {
    expect(midiToNoteName(36)).toBe('C2');
    expect(midiToNoteName(79)).toBe('G5');
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(21)).toBe('A0');
    expect(midiToNoteName(108)).toBe('C8');
  });

  it('should convert between MIDI and fundamental frequencies correctly', () => {
    // A4 = 440 Hz = MIDI 69
    expect(midiToFrequency(69)).toBeCloseTo(440, 1);
    expect(frequencyToMidi(440)).toBeCloseTo(69, 1);

    // C2 = ~65.41 Hz = MIDI 36
    expect(midiToFrequency(36)).toBeCloseTo(65.41, 1);
    expect(frequencyToMidi(65.41)).toBeCloseTo(36, 1);

    // G5 = ~783.99 Hz = MIDI 79
    expect(midiToFrequency(79)).toBeCloseTo(783.99, 1);
  });

  it('should include SWAM Cello preset with C2 (36) to G5 (79) range', () => {
    const cello = INSTRUMENT_PRESETS.find(p => p.id === 'swam-cello');
    expect(cello).toBeDefined();
    expect(cello?.minNote).toBe('C2');
    expect(cello?.maxNote).toBe('G5');
    expect(cello?.minMidi).toBe(36);
    expect(cello?.maxMidi).toBe(79);
    expect(cello?.farsiName).toContain('ویولنسل');
  });

  it('should correctly check if frequency is within range', () => {
    // Cello range: 36 to 79 (approx 65.4 Hz to 784 Hz)
    expect(isFrequencyInRange(65.41, 36, 79)).toBe(true);  // C2
    expect(isFrequencyInRange(440.0, 36, 79)).toBe(true);  // A4
    expect(isFrequencyInRange(783.99, 36, 79)).toBe(true); // G5

    expect(isFrequencyInRange(32.7, 36, 79)).toBe(false);  // C1 (too low for cello)
    expect(isFrequencyInRange(1046.5, 36, 79)).toBe(false); // C6 (too high for cello)
  });

  it('should smartly fold out-of-range notes by octaves into playable register', () => {
    const minMidi = 36; // C2
    const maxMidi = 79; // G5

    // 1. C1 (32.7 Hz, MIDI 24) is below cello range -> folds up 1 octave to C2 (65.4 Hz, MIDI 36)
    const foldedLow = foldFrequencyToRange(32.7, minMidi, maxMidi);
    expect(foldedLow.inRange).toBe(true);
    expect(foldedLow.midiNote).toBe(36);
    expect(foldedLow.foldedOctaves).toBe(1);
    expect(foldedLow.frequency).toBeCloseTo(65.4, 0);

    // 2. C6 (1046.5 Hz, MIDI 84) is above cello range -> folds down 1 octave to C5 (523.25 Hz, MIDI 72)
    const foldedHigh = foldFrequencyToRange(1046.5, minMidi, maxMidi);
    expect(foldedHigh.inRange).toBe(true);
    expect(foldedHigh.midiNote).toBe(72);
    expect(foldedHigh.foldedOctaves).toBe(-1);
    expect(foldedHigh.frequency).toBeCloseTo(523.25, 0);

    // 3. E4 (329.6 Hz, MIDI 64) is already in range -> untouched
    const normal = foldFrequencyToRange(329.6, minMidi, maxMidi);
    expect(normal.inRange).toBe(true);
    expect(normal.midiNote).toBe(64);
    expect(normal.foldedOctaves).toBe(0);
    expect(normal.frequency).toBe(329.6);
  });

  it('should compute auto-fit range parameters to distribute rings across instrument register', () => {
    const { baseFrequency, scalingFactor } = computeAutoFitRangeParameters(36, 79, 6);
    // Base frequency should equal min frequency (C2 ~ 65.41 Hz)
    expect(baseFrequency).toBeCloseTo(65.41, 1);
    // Scaling factor k should be strictly between 0.4 and 0.95
    expect(scalingFactor).toBeGreaterThan(0.4);
    expect(scalingFactor).toBeLessThan(0.95);
  });
});
