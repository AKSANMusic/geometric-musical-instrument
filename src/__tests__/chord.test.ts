import { describe, it, expect } from 'vitest';
import { CHORD_PRESETS, STRUM_DELAYS, type StrumMode } from '../audio/chord-engine';
import { buildNestedPentagons } from '../geometry/solver';

describe('Chord Engine', () => {
  const pentagons = buildNestedPentagons(300, 440, 12, -1);

  it('should have all expected geometric chord presets', () => {
    expect(CHORD_PRESETS.length).toBeGreaterThanOrEqual(8);
    const ids = CHORD_PRESETS.map(c => c.id);
    expect(ids).toContain('tonic-triad');
    expect(ids).toContain('sus2');
    expect(ids).toContain('sus4-6th');
    expect(ids).toContain('pentachord-cluster');
    expect(ids).toContain('power-fifth');
    expect(ids).toContain('radial-root-cascade');
    expect(ids).toContain('radial-fifth-shimmer');
    expect(ids).toContain('geometric-open-spread');
  });

  it('Tonic Triad should voice edges 0 (root), 2 (third), and 3 (fifth)', () => {
    const triad = CHORD_PRESETS.find(c => c.id === 'tonic-triad')!;
    const notes = triad.getVoicing(pentagons, 0);
    expect(notes).toHaveLength(3);
    expect(notes.map(n => n.edgeIndex)).toEqual([0, 2, 3]);
    expect(notes.every(n => n.level === 0)).toBe(true);
  });

  it('Pentachord Cluster should voice all 5 edges', () => {
    const cluster = CHORD_PRESETS.find(c => c.id === 'pentachord-cluster')!;
    const notes = cluster.getVoicing(pentagons, 1);
    expect(notes).toHaveLength(5);
    expect(notes.map(n => n.edgeIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(notes.every(n => n.level === 1)).toBe(true);
  });

  it('Radial Root Cascade should voice Edge 0 across all concentric rings', () => {
    const cascade = CHORD_PRESETS.find(c => c.id === 'radial-root-cascade')!;
    const notes = cascade.getVoicing(pentagons, 'all');
    expect(notes).toHaveLength(12);
    expect(notes.every(n => n.edgeIndex === 0)).toBe(true);
    for (let i = 0; i < 12; i++) {
      expect(notes[i].level).toBe(i);
    }
  });

  it('Radial Fifth Shimmer should voice Edge 3 across all concentric rings', () => {
    const fifths = CHORD_PRESETS.find(c => c.id === 'radial-fifth-shimmer')!;
    const notes = fifths.getVoicing(pentagons, 'all');
    expect(notes).toHaveLength(12);
    expect(notes.every(n => n.edgeIndex === 3)).toBe(true);
  });

  it('Geometric Open Voicing should spread notes across outer, mid, and inner rings', () => {
    const spread = CHORD_PRESETS.find(c => c.id === 'geometric-open-spread')!;
    const notes = spread.getVoicing(pentagons, 'all');
    expect(notes).toHaveLength(4);
    // Bass on ring 0, middle fifth on ring 1, third on ring 2, top on ring 3
    expect(notes[0].level).toBe(0);
    expect(notes[0].edgeIndex).toBe(0);
    expect(notes[1].level).toBe(1);
    expect(notes[1].edgeIndex).toBe(3);
  });

  it('should define valid strumming delay times', () => {
    const modes: StrumMode[] = ['block', 'fast-strum', 'slow-strum', 'down-strum', 'cascade'];
    for (const mode of modes) {
      expect(STRUM_DELAYS[mode]).toBeGreaterThanOrEqual(0);
    }
    expect(STRUM_DELAYS.block).toBe(0);
    expect(STRUM_DELAYS['fast-strum']).toBeLessThan(STRUM_DELAYS['slow-strum']);
  });

  it('should map keyboard hotkeys to corresponding geometric chords', async () => {
    const { findChordByHotkey } = await import('../audio/chord-engine');
    expect(findChordByHotkey('Q')?.id).toBe('tonic-triad');
    expect(findChordByHotkey('q')?.id).toBe('tonic-triad'); // case-insensitive
    expect(findChordByHotkey('W')?.id).toBe('sus2');
    expect(findChordByHotkey('O')?.id).toBe('radial-root-cascade'); // octave cascade
  });

  describe('Circle of Fifths Progression', () => {
    it('should correctly traverse clockwise by Perfect Fifths', async () => {
      const { CIRCLE_OF_FIFTHS, getNextFifth } = await import('../geometry/constants');
      expect(CIRCLE_OF_FIFTHS).toHaveLength(12);
      expect(getNextFifth('C')).toBe('G');
      expect(getNextFifth('G')).toBe('D');
      expect(getNextFifth('D')).toBe('A');
      expect(getNextFifth('A')).toBe('E');
      expect(getNextFifth('F')).toBe('C'); // cycle wraps around
    });

    it('should correctly traverse counter-clockwise by Fourths', async () => {
      const { getPreviousFifth } = await import('../geometry/constants');
      expect(getPreviousFifth('C')).toBe('F');
      expect(getPreviousFifth('E')).toBe('A');
      expect(getPreviousFifth('A')).toBe('D');
      expect(getPreviousFifth('D')).toBe('G');
    });

    it('should correctly define the Inner Ring of Relative Minors for all 12 keys', async () => {
      const { CIRCLE_OF_FIFTHS_PAIRS, getRelativeMinor, getRelativeMajor } = await import('../geometry/constants');
      expect(CIRCLE_OF_FIFTHS_PAIRS).toHaveLength(12);

      // C Major relative minor is A minor
      expect(getRelativeMinor('C')).toBe('A');
      expect(getRelativeMajor('A')).toBe('C');

      // A Major relative minor is F# minor
      expect(getRelativeMinor('A')).toBe('Fs');
      expect(getRelativeMajor('Fs')).toBe('A');

      // G Major relative minor is E minor
      expect(getRelativeMinor('G')).toBe('E');
      expect(getRelativeMajor('E')).toBe('G');

      // F Major relative minor is D minor
      expect(getRelativeMinor('F')).toBe('D');
      expect(getRelativeMajor('D')).toBe('F');

      // Check all 12 pairs exist and have valid labels
      for (const pair of CIRCLE_OF_FIFTHS_PAIRS) {
        expect(pair.majorLabel).toBeDefined();
        expect(pair.minorLabel).toContain('m');
      }
    });
  });

  describe('Heptagon Chord Adaptations (7-note scales)', () => {
    it('should map Tonic Triad to edges [0, 2, 4] for heptagons', async () => {
      const { SCALES } = await import('../geometry/constants');
      const heptagons = buildNestedPentagons(300, 440, 3, -1, SCALES.shur);
      expect(heptagons[0].edges).toHaveLength(7);

      const triad = CHORD_PRESETS.find(c => c.id === 'tonic-triad')!;
      const notes = triad.getVoicing(heptagons, 0);
      expect(notes).toHaveLength(3);
      // In 7-note scales, degree 5 is at edge index 4!
      expect(notes.map(n => n.edgeIndex)).toEqual([0, 2, 4]);
    });

    it('should map Full Cluster to all 7 edges for heptagons', async () => {
      const { SCALES } = await import('../geometry/constants');
      const heptagons = buildNestedPentagons(300, 440, 3, -1, SCALES.chahargah);
      const cluster = CHORD_PRESETS.find(c => c.id === 'pentachord-cluster')!;
      const notes = cluster.getVoicing(heptagons, 0);
      expect(notes).toHaveLength(7);
      expect(notes.map(n => n.edgeIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('should map Power Fifth to edges [0, 4] for heptagons', async () => {
      const { SCALES } = await import('../geometry/constants');
      const heptagons = buildNestedPentagons(300, 440, 3, -1, SCALES.bayati);
      const power = CHORD_PRESETS.find(c => c.id === 'power-fifth')!;
      const notes = power.getVoicing(heptagons, 0);
      expect(notes.map(n => n.edgeIndex)).toEqual([0, 4]);
    });
  });

  describe('Accordion Degree Chords & Voice Leading', () => {
    it('should provide all 7 diatonic/modal degrees with hotkeys A, S, D, F, G, H, J', async () => {
      const { ACCORDION_DEGREE_CHORDS, findChordByHotkey } = await import('../audio/chord-engine');
      expect(ACCORDION_DEGREE_CHORDS).toHaveLength(7);

      expect(findChordByHotkey('A')?.id).toBe('deg-1');
      expect(findChordByHotkey('S')?.id).toBe('deg-2');
      expect(findChordByHotkey('D')?.id).toBe('deg-3');
      expect(findChordByHotkey('F')?.id).toBe('deg-4');
      expect(findChordByHotkey('G')?.id).toBe('deg-5');
      expect(findChordByHotkey('H')?.id).toBe('deg-6');
      expect(findChordByHotkey('J')?.id).toBe('deg-7');
    });

    it('should calculate smooth voice leading across concentric rings', async () => {
      const { voiceLeadingManager } = await import('../audio/chord-engine');
      voiceLeadingManager.reset();
      voiceLeadingManager.enabled = true;

      // Play Degree I [0, 2, 4] on ring network
      const voicing1 = voiceLeadingManager.resolveVoicing([0, 2, 4], pentagons, 'all');
      expect(voicing1).toHaveLength(3);

      // Now transition to Degree IV [3, 5, 0]
      // Root note (0) is a common tone — voice leading should keep it close or identical
      const voicing2 = voiceLeadingManager.resolveVoicing([3, 5, 0], pentagons, 'all');
      expect(voicing2).toHaveLength(3);

      // Verify all voices stay within reasonable ring levels (no extreme jumps)
      for (const v of voicing2) {
        expect(v.level).toBeLessThan(6);
      }
    });

    it('should correctly analyze frequencies against 12-TET piano and detect microtonal Koron', async () => {
      const { analyzeFrequencyAgainstPiano } = await import('../audio/chord-engine');

      // Exact A4 (440 Hz)
      const a4 = analyzeFrequencyAgainstPiano(440);
      expect(a4.pianoKey).toBe('A4');
      expect(Math.abs(a4.centsOffset)).toBeLessThan(2);
      expect(a4.isMicrotonal).toBe(false);

      // Pure Just Intonation Major Third (550 Hz, 5/4 above 440) -> 386 cents (+14c flat of equal tempered C#5 554.37)
      const cSharpPure = analyzeFrequencyAgainstPiano(550);
      expect(cSharpPure.pianoKey).toBe('C#5');
      expect(cSharpPure.centsOffset).toBe(-14);

      // Persian Koron neutral interval (~302 Hz, halfway between D4 and D#4, MIDI 62.5) -> ~50 cents
      const koronNote = analyzeFrequencyAgainstPiano(302);
      expect(koronNote.isMicrotonal).toBe(true);
      expect(koronNote.centsLabel).toContain('Koron');
    });

    it('should generate detailed note breakdown for chord cards', async () => {
      const { getChordNoteBreakdown, ACCORDION_DEGREE_CHORDS } = await import('../audio/chord-engine');
      const deg1 = ACCORDION_DEGREE_CHORDS[0];
      const breakdown = getChordNoteBreakdown(deg1, pentagons, 0);

      expect(breakdown).toHaveLength(3);
      for (const note of breakdown) {
        expect(note.frequency).toBeGreaterThan(0);
        expect(note.pianoKey).toBeDefined();
        expect(note.ring).toBe(0);
      }
    });
  });
});


