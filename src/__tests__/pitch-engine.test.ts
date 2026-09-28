import { describe, it, expect } from 'vitest';
import {
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
  frequencyToCents,
  calculatePitchBend,
  buildPitchDescriptor,
} from '../pitch/pitch-engine';

describe('PitchEngine', () => {
  describe('frequencyToMidi', () => {
    it('should return 69 for 440 Hz (A4)', () => {
      expect(frequencyToMidi(440)).toBe(69);
    });

    it('should return 60 for ~261.63 Hz (C4)', () => {
      expect(Math.round(frequencyToMidi(261.63))).toBe(60);
    });

    it('should return 0 for non-positive frequency', () => {
      expect(frequencyToMidi(0)).toBe(0);
      expect(frequencyToMidi(-100)).toBe(0);
    });

    it('should handle fractional MIDI for microtonal frequencies', () => {
      // 440 * 12/11 ≈ 480 Hz (koron second, ~150.6 cents above A4)
      const koronFreq = 440 * (12 / 11);
      const midi = frequencyToMidi(koronFreq);
      // Should be between 69 and 71 (between A4 and B4)
      expect(midi).toBeGreaterThan(69);
      expect(midi).toBeLessThan(71);
    });
  });

  describe('midiToFrequency', () => {
    it('should return 440 for MIDI 69', () => {
      expect(midiToFrequency(69)).toBeCloseTo(440, 2);
    });

    it('should return ~261.63 for MIDI 60', () => {
      expect(midiToFrequency(60)).toBeCloseTo(261.63, 0);
    });

    it('should be inverse of frequencyToMidi', () => {
      const freq = 523.25;
      expect(midiToFrequency(frequencyToMidi(freq))).toBeCloseTo(freq, 2);
    });
  });

  describe('midiToNoteName', () => {
    it('should return A4 for MIDI 69', () => {
      expect(midiToNoteName(69)).toBe('A4');
    });

    it('should return C4 for MIDI 60', () => {
      expect(midiToNoteName(60)).toBe('C4');
    });

    it('should clamp to valid range', () => {
      expect(midiToNoteName(-5)).toBe('C-1');
      expect(midiToNoteName(200)).toBe('G9');
    });
  });

  describe('frequencyToCents', () => {
    it('should return 0 for exact 12-TET frequencies', () => {
      expect(frequencyToCents(440)).toBe(0);
    });

    it('should detect koron interval (~+51 cents)', () => {
      // 440 * 12/11 ≈ 480 Hz
      const koronFreq = 440 * (12 / 11);
      const cents = frequencyToCents(koronFreq);
      // Koron is ~150.6 cents above A4, nearest note is A#4 (100 cents)
      // So offset from B♭4 should be about +51 cents
      expect(Math.abs(cents)).toBeGreaterThan(20); // Definitely microtonal
    });
  });

  describe('calculatePitchBend', () => {
    it('should return center (8192) for exact MIDI match', () => {
      const result = calculatePitchBend(440, 69);
      expect(result.bend14).toBe(8192);
      expect(result.lsb).toBe(0);
      expect(result.msb).toBe(64);
    });

    it('should return above center for sharp pitch', () => {
      // 50 cents sharp = quarter of ±200 cent range
      const sharpFreq = 440 * Math.pow(2, 50 / 1200);
      const result = calculatePitchBend(sharpFreq, 69);
      expect(result.bend14).toBeGreaterThan(8192);
    });

    it('should clamp to valid range', () => {
      // Way too sharp for ±2 semitone range
      const result = calculatePitchBend(880, 69); // +1200 cents
      expect(result.bend14).toBeLessThanOrEqual(16383);
    });

    it('should respect custom bend range', () => {
      // With ±4 semitone range, same offset produces smaller bend value
      const freq = 440 * Math.pow(2, 100 / 1200); // +100 cents
      const r2 = calculatePitchBend(freq, 69, 2);
      const r4 = calculatePitchBend(freq, 69, 4);
      // With wider range, the bend value should be closer to center
      expect(Math.abs(r4.bend14 - 8192)).toBeLessThan(Math.abs(r2.bend14 - 8192));
    });
  });

  describe('buildPitchDescriptor', () => {
    it('should build complete descriptor for A4', () => {
      const pd = buildPitchDescriptor(440);
      expect(pd.frequency).toBe(440);
      expect(pd.midiNote).toBe(69);
      expect(pd.centsOffset).toBe(0);
      expect(pd.isMicrotonal).toBe(false);
      expect(pd.label).toBe('A4');
    });

    it('should detect microtonal frequencies', () => {
      const pd = buildPitchDescriptor(440 * (12 / 11)); // Koron
      expect(pd.isMicrotonal).toBe(true);
      expect(pd.label).toContain('¢');
    });

    it('should find correct scale degree', () => {
      // Major pentatonic: [1, 9/8, 5/4, 3/2, 5/3]
      const ratios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
      const pd = buildPitchDescriptor(440 * 1.5, 440, ratios); // Perfect fifth
      expect(pd.scaleDegree).toBe(3); // Index 3 = 3/2
    });

    it('should compute register from tonic', () => {
      const pd = buildPitchDescriptor(880, 440); // One octave up
      expect(pd.register).toBe(1);
    });
  });
});
