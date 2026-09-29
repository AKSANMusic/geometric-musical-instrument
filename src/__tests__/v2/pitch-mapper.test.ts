import { describe, it, expect } from 'vitest';
import { PitchMapper, type ScaleContext } from '../../mapping/PitchMapper';
import type { GeometricEvent } from '../../domain/events';

describe('PitchMapper (V2)', () => {
  const heptatonicScale: ScaleContext = {
    tonicFreqHz: 440,
    ratios: [1.0, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8], // 7 degrees
    stabilities: [1.0, 0.5, 0.75, 0.7, 0.95, 0.65, 0.35],
    degreeNames: ['1', '2', '3', '4', '5', '6', '7'],
  };

  const sampleEvent = (sideIndex: number, ringIndex = 0, u = 0.5): GeometricEvent => ({
    id: `geo-test-${sideIndex}`,
    time: 1.0,
    source: 'manual',
    sideIndex,
    ringIndex,
    normalizedPosition: u,
    velocity: 0.8,
  });

  it('should preserve strictly 5 physical sides while mapping onto a 7-degree scale', () => {
    // Test all 5 sides (0 to 4)
    for (let side = 0; side < 5; side++) {
      const candidate = PitchMapper.mapToCandidate(sampleEvent(side), heptatonicScale, 'scaleDegree');
      expect(candidate.geometricEvent.sideIndex).toBe(side);
      expect(candidate.targetPitchHz).toBeGreaterThanOrEqual(440);
      expect(candidate.midiNoteFloat).toBeGreaterThanOrEqual(69);
      expect(candidate.brightness).toBeCloseTo(0.25, 2); // u = 0.5 center is warm fundamental (low spectral centroid)
    }
  });

  it('should calculate ponticello brightness at string ends', () => {
    const candidateAtEnd = PitchMapper.mapToCandidate(sampleEvent(0, 0, 0.05), heptatonicScale);
    expect(candidateAtEnd.brightness).toBeGreaterThan(0.8); // Ponticello (tips) is bright in high partials
  });

  it('should support physicalLength mapping mode (consonant Just Intonation)', () => {
    const side0 = PitchMapper.mapToCandidate(sampleEvent(0), heptatonicScale, 'physicalLength');
    const side3 = PitchMapper.mapToCandidate(sampleEvent(3), heptatonicScale, 'physicalLength');
    expect(side0.targetPitchHz).toBeCloseTo(440, 2); // 1/1
    expect(side3.targetPitchHz).toBeCloseTo(440 * 1.5, 2); // 3/2 Perfect 5th
  });

  it('should support chordTone mapping mode', () => {
    const side0 = PitchMapper.mapToCandidate(sampleEvent(0), heptatonicScale, 'chordTone');
    const side1 = PitchMapper.mapToCandidate(sampleEvent(1), heptatonicScale, 'chordTone');
    const side2 = PitchMapper.mapToCandidate(sampleEvent(2), heptatonicScale, 'chordTone');
    expect(side0.scaleDegree).toBe(0); // Root
    expect(side1.scaleDegree).toBe(2); // Third
    expect(side2.scaleDegree).toBe(4); // Fifth
  });

  it('should transpose frequency by octaves across concentric rings', () => {
    const ring0 = PitchMapper.mapToCandidate(sampleEvent(0, 0), heptatonicScale, 'scaleDegree', 'octaves');
    const ring1 = PitchMapper.mapToCandidate(sampleEvent(0, 1), heptatonicScale, 'scaleDegree', 'octaves');
    expect(ring1.targetPitchHz).toBeCloseTo(ring0.targetPitchHz * 2, 2);
  });
});
