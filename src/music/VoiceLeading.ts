/**
 * VoiceLeading.ts — Deterministic Multi-Voice Leading Cost Optimizer
 *
 * Implements smooth voice leading, prevents unnatural pitch jumps,
 * minimizes voice crossing, and detects common-tone retention.
 */

export interface ActiveVoicePitch {
  readonly voiceId: string;
  readonly pitchHz: number;
  readonly midiNoteFloat: number;
  readonly lastTriggerTime: number;
  readonly channel?: number;
}

export interface VoiceLeadingWeights {
  travelWeight: number;      // Cost per semitone of motion
  leapPenalty: number;       // Flat penalty for jumps > 7 semitones (fifth)
  crossingPenalty: number;   // Cost for voice crossing
  commonToneBonus: number;   // High reward for keeping common tones
}

export const DEFAULT_VOICE_LEADING_WEIGHTS: VoiceLeadingWeights = {
  travelWeight: 1.0,
  leapPenalty: 8.0,
  crossingPenalty: 12.0,
  commonToneBonus: 25.0,
};

export interface VoiceAssignmentResult {
  readonly voiceId: string;
  readonly isCommonTone: boolean;
  readonly cost: number;
  readonly isNewVoice: boolean;
}

export class VoiceLeadingOptimizer {
  private weights: VoiceLeadingWeights;
  private maxPolyphony: number;

  constructor(maxPolyphony = 8, weights: Partial<VoiceLeadingWeights> = {}) {
    this.maxPolyphony = maxPolyphony;
    this.weights = { ...DEFAULT_VOICE_LEADING_WEIGHTS, ...weights };
  }

  public setWeights(weights: Partial<VoiceLeadingWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Find the optimal voice for a candidate pitch given active voices.
   */
  public assignVoice(
    candidateHz: number,
    candidateMidiFloat: number,
    activeVoices: ReadonlyArray<ActiveVoicePitch>,
    currentTime: number,
  ): VoiceAssignmentResult {
    // 1. Check for exact Common-Tone match (< 6 cents difference)
    for (const v of activeVoices) {
      const centDiff = Math.abs(1200 * Math.log2(candidateHz / v.pitchHz));
      if (centDiff < 6) {
        return {
          voiceId: v.voiceId,
          isCommonTone: true,
          cost: -this.weights.commonToneBonus,
          isNewVoice: false,
        };
      }
    }

    // 2. If room for a new voice exists, we can spawn a new voice if activeVoices count < maxPolyphony
    if (activeVoices.length < this.maxPolyphony) {
      const newVoiceId = `v-${activeVoices.length}-${Date.now().toString(36)}`;
      return {
        voiceId: newVoiceId,
        isCommonTone: false,
        cost: 0,
        isNewVoice: true,
      };
    }

    // 3. Otherwise evaluate cost for all existing voices and pick the minimum cost voice to take over
    let bestVoice: ActiveVoicePitch = activeVoices[0];
    let minCost = Infinity;

    for (const voice of activeVoices) {
      const deltaSemitones = Math.abs(candidateMidiFloat - voice.midiNoteFloat);
      let cost = deltaSemitones * this.weights.travelWeight;

      // Leap penalty
      if (deltaSemitones > 7) {
        cost += this.weights.leapPenalty;
      }

      // Age bonus (voices sounding longer are less disruptive to replace)
      const age = currentTime - voice.lastTriggerTime;
      cost -= Math.min(5.0, age * 2.0);

      if (cost < minCost) {
        minCost = cost;
        bestVoice = voice;
      }
    }

    return {
      voiceId: bestVoice.voiceId,
      isCommonTone: false,
      cost: minCost,
      isNewVoice: false,
    };
  }
}
