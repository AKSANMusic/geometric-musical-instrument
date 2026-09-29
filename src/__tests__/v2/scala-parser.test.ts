import { describe, it, expect } from 'vitest';
import { ScalaParser } from '../../tuning/ScalaParser';

describe('ScalaParser (V2)', () => {
  it('should parse simple 5-limit pentatonic scl file with ratios and cents', () => {
    const scl = `! pentatonic.scl
!
Ancient Pentatonic
5
!
9/8
5/4
3/2
5/3
2/1
`;
    const scale = ScalaParser.parse(scl);
    expect(scale.count).toBe(5);
    expect(scale.description).toBe('Ancient Pentatonic');
    expect(scale.degrees.length).toBe(5);
    expect(scale.degrees[0].ratio).toBeCloseTo(9 / 8, 5);
    expect(scale.degrees[1].ratio).toBeCloseTo(5 / 4, 5);
    expect(scale.degrees[2].ratio).toBeCloseTo(3 / 2, 5);
    expect(scale.degrees[3].ratio).toBeCloseTo(5 / 3, 5);
    expect(scale.degrees[4].ratio).toBe(2.0);
    expect(scale.formalOctaveRatio).toBe(2.0);
    expect(scale.formalOctaveCents).toBeCloseTo(1200, 1);
  });

  it('should parse 7-note Shur scale with Koron microtonal cents', () => {
    const shurScl = `! shur.scl
Persian Dastgah Shur
7
150.6
294.13
498.04
701.96
852.56
996.09
1200.0
`;
    const scale = ScalaParser.parse(shurScl);
    expect(scale.count).toBe(7);
    expect(scale.degrees[0].cents).toBeCloseTo(150.6, 2);
    expect(scale.degrees[0].ratio).toBeGreaterThan(1.0);
    expect(scale.degrees[6].cents).toBe(1200.0);
    expect(scale.formalOctaveRatio).toBeCloseTo(2.0, 4);
  });

  it('should handle integer octave representation (e.g. "2" for 2/1)', () => {
    const scl = `Simple Scale
2
3/2
2
`;
    const scale = ScalaParser.parse(scl);
    expect(scale.count).toBe(2);
    expect(scale.degrees[1].ratio).toBe(2.0);
    expect(scale.formalOctaveRatio).toBe(2.0);
  });

  it('should throw error for mismatched note count', () => {
    const invalidScl = `Description
5
9/8
5/4
`;
    expect(() => ScalaParser.parse(invalidScl)).toThrow(/mismatch/i);
  });

  it('should throw error for invalid ratio denominator', () => {
    const badRatio = `Description
1
9/0
`;
    expect(() => ScalaParser.parse(badRatio)).toThrow(/invalid/i);
  });
});
