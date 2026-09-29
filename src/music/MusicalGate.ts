/**
 * MusicalGate.ts — Central Musical Intelligence Orchestrator
 *
 * Integrates:
 * - HarmonicContext (tonal center, scale, stability)
 * - DensityGovernor (sliding window note budget)
 * - PhraseEngine (phrase phase, velocity shaping, cadence bias)
 * - MotifMemory (thematic pattern tracking)
 * - VoiceLeadingOptimizer (voice allocation and common-tone detection)
 * - MusicalFreedom slider (0 = strict classical/modal filter, 100 = unconstrained physics)
 *
 * Implements the single canonical transformation:
 * CandidateMusicalIntent -> MusicalEvent (or null if gated)
 */

import type {
  CandidateMusicalIntent,
  MusicalEvent,
  MusicalRole,
  ArticulationType,
} from '../domain/events';
import { generateEventId } from '../domain/events';
import { HarmonicContext } from './HarmonicContext';
import { DensityGovernor } from './DensityGovernor';
import { PhraseEngine } from './PhraseEngine';
import { MotifMemory } from './MotifMemory';
import { VoiceLeadingOptimizer, type ActiveVoicePitch } from './VoiceLeading';
import { SeededRandom } from '../domain/project-state';

export interface MusicalGateConfig {
  musicalFreedom: number;         // [0, 100]
  phraseDurationSeconds: number;  // 2.0 to 8.0
  energy: number;                 // [0, 100]
  complexity: number;             // [0, 100]
  silenceBaseProbability: number; // [0, 1]
}

export class MusicalGate {
  private harmonicContext: HarmonicContext;
  private densityGovernor: DensityGovernor;
  private phraseEngine: PhraseEngine;
  private motifMemory: MotifMemory;
  private voiceLeading: VoiceLeadingOptimizer;
  private rng: SeededRandom;
  private config: MusicalGateConfig;

  constructor(
    harmonicContext: HarmonicContext,
    config: Partial<MusicalGateConfig> = {},
    seed = 101,
  ) {
    this.harmonicContext = harmonicContext;
    this.config = {
      musicalFreedom: 50,
      phraseDurationSeconds: 4.0,
      energy: 50,
      complexity: 50,
      silenceBaseProbability: 0.15,
      ...config,
    };

    this.densityGovernor = new DensityGovernor(this.config.energy, this.config.complexity);
    this.phraseEngine = new PhraseEngine(this.config.phraseDurationSeconds);
    this.motifMemory = new MotifMemory(5, seed);
    this.voiceLeading = new VoiceLeadingOptimizer(8);
    this.rng = new SeededRandom(seed);
  }

  public updateConfig(newConfig: Partial<MusicalGateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.energy !== undefined || newConfig.complexity !== undefined) {
      this.densityGovernor.setParameters(this.config.energy, this.config.complexity);
    }
    if (newConfig.phraseDurationSeconds !== undefined) {
      this.phraseEngine.setPhraseDuration(this.config.phraseDurationSeconds);
    }
  }

  public getHarmonicContext(): HarmonicContext {
    return this.harmonicContext;
  }

  public getPhraseEngine(): PhraseEngine {
    return this.phraseEngine;
  }

  public getDensityGovernor(): DensityGovernor {
    return this.densityGovernor;
  }

  public getMotifMemory(): MotifMemory {
    return this.motifMemory;
  }

  /**
   * Main gate pipeline: transforms a CandidateMusicalIntent into a final MusicalEvent,
   * or returns null if deliberate silence or density governor drops it.
   */
  public process(
    candidate: CandidateMusicalIntent,
    activeVoices: ReadonlyArray<ActiveVoicePitch> = [],
    currentTime: number = candidate.geometricEvent.time,
  ): MusicalEvent | null {
    const freedom = this.config.musicalFreedom / 100; // 0 to 1

    // 1. Evaluate Phrase context
    const phrase = this.phraseEngine.getContext(currentTime);

    // 2. Deliberate silence / breathing probability
    // At freedom = 1.0 (100%), silence probability is near zero.
    // At freedom = 0.0 (0%), silence probability is governed strictly by phrase breath and density.
    const currentDensity = this.densityGovernor.getCurrentDensity();
    const densityPenalty = Math.min(1.0, currentDensity / Math.max(1, this.densityGovernor.getBudget()));
    const silenceProb = (1 - freedom) * (this.config.silenceBaseProbability + phrase.breathSilenceBonus) * (0.5 + 0.5 * densityPenalty);

    if (this.rng.next() < silenceProb && freedom < 0.95) {
      return null; // Breath of silence
    }

    // 3. Density Governor evaluation
    const govDecision = this.densityGovernor.evaluate(currentTime, candidate.velocity, candidate.stability);
    if (!govDecision.allowed && freedom < 0.9) {
      return null; // Suppressed to prevent acoustic clutter
    }

    // 4. Harmonic resolution / Cadence snapping
    let finalPitchHz = candidate.targetPitchHz;
    let role: MusicalRole = 'passing';

    if (candidate.stability >= 0.85) {
      role = 'stable';
    } else if (candidate.stability < 0.4) {
      role = 'tension';
    }

    // If in cadence phase with high cadence bias and freedom < 80%, snap resolving notes to stable pitches
    if (phrase.cadenceBias > 0.4 && freedom < 0.8 && role === 'tension') {
      finalPitchHz = this.harmonicContext.snapToResolution(candidate.targetPitchHz);
      role = 'resolution';
    }

    // Calculate final fractional MIDI note
    const finalMidiFloat = 69 + 12 * Math.log2(finalPitchHz / 440);

    // 5. Dynamic envelope shaping from phrase and governor
    let velocity = govDecision.adjustedVelocity * phrase.velocityMultiplier;
    velocity = Math.max(0.05, Math.min(1.0, velocity));

    // 6. Voice leading and common tone assignment
    const voiceResult = this.voiceLeading.assignVoice(finalPitchHz, finalMidiFloat, activeVoices, currentTime);

    // 7. Articulation selection
    let articulation: ArticulationType = 'pluck';
    if (govDecision.isGhost) {
      articulation = 'ghost';
      role = 'ornament';
    } else if (candidate.geometricEvent.durationHint && candidate.geometricEvent.durationHint > 0.8) {
      articulation = 'bow';
    } else if (candidate.duration > 1.2) {
      articulation = 'sustain';
    }

    // Record in MotifMemory if note is prominent
    if (!govDecision.isGhost && velocity > 0.3) {
      this.motifMemory.record(candidate, currentTime);
    }

    return {
      id: generateEventId('mus'),
      time: currentTime,
      pitchHz: finalPitchHz,
      midiNoteFloat: finalMidiFloat,
      velocity,
      duration: candidate.duration,
      brightness: candidate.brightness,
      pan: candidate.pan,
      articulation,
      role,
      phraseId: phrase.phraseId,
      voiceId: voiceResult.voiceId,
      sourceEventId: candidate.geometricEvent.id,
      commonToneRetained: voiceResult.isCommonTone,
    };
  }

  public reset(startTime = 0): void {
    this.densityGovernor.reset();
    this.phraseEngine.reset(startTime);
    this.motifMemory.clear();
  }
}
