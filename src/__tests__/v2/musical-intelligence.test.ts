import { describe, it, expect, beforeEach } from 'vitest';
import { HarmonicContext, BUILTIN_SCALES } from '../../music/HarmonicContext';
import { DensityGovernor } from '../../music/DensityGovernor';
import { PhraseEngine } from '../../music/PhraseEngine';
import { MotifMemory } from '../../music/MotifMemory';
import { VoiceLeadingOptimizer } from '../../music/VoiceLeading';
import { MusicalGate } from '../../music/MusicalGate';
import { PitchMapper } from '../../mapping/PitchMapper';
import type { GeometricEvent } from '../../domain/events';

describe('Musical Intelligence Layer (V2)', () => {
  describe('HarmonicContext', () => {
    let hc: HarmonicContext;

    beforeEach(() => {
      hc = new HarmonicContext('D4', 'shur');
    });

    it('should initialize with correct tonic frequency for D4', () => {
      expect(hc.getTonicFrequency()).toBeCloseTo(293.66, 2);
    });

    it('should evaluate tonic stability near 1.0', () => {
      const tonicStability = hc.evaluateStability(293.66);
      expect(tonicStability).toBeGreaterThan(0.85);
    });

    it('should degrade stability for out-of-scale dissonant frequencies', () => {
      // Triton (sqrt(2) * 293.66)
      const tritoneStability = hc.evaluateStability(293.66 * Math.SQRT2);
      const tonicStability = hc.evaluateStability(293.66);
      expect(tritoneStability).toBeLessThan(tonicStability);
    });

    it('should snap dissonant pitches to tonic or fifth in snapToResolution', () => {
      const snapped = hc.snapToResolution(300); // Near D4
      expect(snapped).toBeCloseTo(293.66, 1);
    });
  });

  describe('DensityGovernor', () => {
    it('should compute note budget from energy and complexity', () => {
      const gov = new DensityGovernor(0, 0); // 1.5 + 0 + 0 = 1.5 notes/sec
      expect(gov.getBudget()).toBeCloseTo(1.5, 2);

      const govMax = new DensityGovernor(100, 100); // 1.5 + 8 + 6 = 15.5 notes/sec
      expect(govMax.getBudget()).toBeCloseTo(15.5, 2);
    });

    it('should allow notes within budget and reject or ghost notes when flooded', () => {
      const gov = new DensityGovernor(10, 10, 1.0); // Budget ~ 2.9 notes/sec
      const t = 1.0;

      // First 2 notes allowed
      const d1 = gov.evaluate(t + 0.01, 0.8, 0.5);
      const d2 = gov.evaluate(t + 0.05, 0.8, 0.5);
      expect(d1.allowed).toBe(true);
      expect(d2.allowed).toBe(true);

      // Flooding with rapid notes
      let droppedOrGhost = false;
      for (let i = 0; i < 10; i++) {
        const dec = gov.evaluate(t + 0.1 + i * 0.02, 0.8, 0.2);
        if (!dec.allowed || dec.isGhost) {
          droppedOrGhost = true;
          break;
        }
      }
      expect(droppedOrGhost).toBe(true);
    });
  });

  describe('PhraseEngine', () => {
    let pe: PhraseEngine;

    beforeEach(() => {
      pe = new PhraseEngine(4.0, 0); // 4 second phrase duration
    });

    it('should progress through initiation, growth, peak, and cadence phases', () => {
      const c1 = pe.getContext(0.2); // 5% -> initiation
      expect(c1.phase).toBe('initiation');
      expect(c1.velocityMultiplier).toBeLessThan(1.0);

      const c2 = pe.getContext(1.6); // 40% -> growth
      expect(c2.phase).toBe('growth');

      const c3 = pe.getContext(2.8); // 70% -> peak
      expect(c3.phase).toBe('peak');
      expect(c3.velocityMultiplier).toBeGreaterThan(1.1);

      const c4 = pe.getContext(3.8); // 95% -> cadence
      expect(c4.phase).toBe('cadence');
      expect(c4.cadenceBias).toBeGreaterThan(0.6);
      expect(c4.breathSilenceBonus).toBeGreaterThan(0.2);
    });
  });

  describe('MotifMemory', () => {
    it('should record motif notes and generate coherent musical variations', () => {
      const motif = new MotifMemory(5, 12345);
      const hc = new HarmonicContext('A4', 'majorPentatonic');
      const sc = hc.toScaleContext();

      // Record 3 notes
      for (let s = 0; s < 3; s++) {
        const geo: GeometricEvent = {
          id: `geo-${s}`,
          time: s * 0.3,
          source: 'manual',
          sideIndex: s,
          ringIndex: 0,
          normalizedPosition: 0.5,
          velocity: 0.8,
        };
        const candidate = PitchMapper.mapToCandidate(geo, sc);
        motif.record(candidate, s * 0.3);
      }

      expect(motif.hasMotif()).toBe(true);
      expect(motif.getMotif().length).toBe(3);

      const variation = motif.generateVariation();
      expect(variation.length).toBe(3);
    });
  });

  describe('VoiceLeadingOptimizer', () => {
    let vlo: VoiceLeadingOptimizer;

    beforeEach(() => {
      vlo = new VoiceLeadingOptimizer(4);
    });

    it('should detect and reward exact common-tone matches', () => {
      const activeVoices = [
        { voiceId: 'voice-1', pitchHz: 440, midiNoteFloat: 69, lastTriggerTime: 1.0 },
      ];

      const res = vlo.assignVoice(440, 69, activeVoices, 1.5);
      expect(res.isCommonTone).toBe(true);
      expect(res.voiceId).toBe('voice-1');
      expect(res.cost).toBeLessThan(0); // Bonus
    });

    it('should allocate new voice when under polyphony limit', () => {
      const activeVoices = [
        { voiceId: 'voice-1', pitchHz: 440, midiNoteFloat: 69, lastTriggerTime: 1.0 },
      ];

      const res = vlo.assignVoice(550, 72.8, activeVoices, 1.5);
      expect(res.isNewVoice).toBe(true);
      expect(res.isCommonTone).toBe(false);
    });
  });

  describe('MusicalGate (Full Pipeline)', () => {
    it('should filter candidate intents into final musical events', () => {
      const hc = new HarmonicContext('D4', 'majorPentatonic');
      const gate = new MusicalGate(hc, {
        musicalFreedom: 60,
        phraseDurationSeconds: 4.0,
        energy: 60,
        complexity: 50,
        silenceBaseProbability: 0.05,
      });

      const sc = hc.toScaleContext();
      const geo: GeometricEvent = {
        id: 'geo-gate-1',
        time: 1.0,
        source: 'manual',
        sideIndex: 0,
        ringIndex: 0,
        normalizedPosition: 0.5,
        velocity: 0.8,
      };

      const candidate = PitchMapper.mapToCandidate(geo, sc);
      const musicalEvent = gate.process(candidate, [], 1.0);

      expect(musicalEvent).not.toBeNull();
      if (musicalEvent) {
        expect(musicalEvent.pitchHz).toBeGreaterThan(100);
        expect(musicalEvent.velocity).toBeGreaterThan(0);
        expect(musicalEvent.articulation).toBeDefined();
        expect(musicalEvent.role).toBeDefined();
        expect(musicalEvent.phraseId).toBeDefined();
      }
    });
  });
});
