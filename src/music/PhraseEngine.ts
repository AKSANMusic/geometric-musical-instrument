/**
 * PhraseEngine.ts — Musical Breathing & Phrase Arc State Machine
 *
 * Implements REBUILD_SPEC_V2.md Section 5.2:
 * Shapes note events into recognizable, breathing 2–8 second musical phrases:
 * 1. Initiation (0–20%): Gentle attacks, tonic-centric grounding.
 * 2. Growth (20–60%): Rising velocity, exploration of higher registers.
 * 3. Peak / Climax (60–80%): Highest dynamic energy and harmonic tension tolerance.
 * 4. Cadence / Resolution (80–100%): Decrescendo, silence breathing, strong bias toward tonic/fifth.
 */

export type PhrasePhase = 'initiation' | 'growth' | 'peak' | 'cadence';

export interface PhraseContext {
  readonly phraseId: string;
  readonly phase: PhrasePhase;
  readonly phraseProgress: number;     // [0, 1] within current phrase cycle
  readonly velocityMultiplier: number; // Applied to note velocity
  readonly tensionTolerance: number;  // [0, 1] higher = more dissonance accepted
  readonly cadenceBias: number;       // [0, 1] higher = stronger snap to tonic/fifth
  readonly breathSilenceBonus: number;// [0, 1] extra probability of deliberate silence
  readonly preferredRingBias: number; // Bias toward outer (0) vs inner rings
}

export class PhraseEngine {
  private phraseDuration: number;     // In seconds (2.0 to 8.0)
  private phraseStartTime: number;
  private phraseIndex: number;

  constructor(phraseDuration = 4.0, startTime = 0) {
    this.phraseDuration = Math.max(2.0, Math.min(8.0, phraseDuration));
    this.phraseStartTime = startTime;
    this.phraseIndex = 0;
  }

  public setPhraseDuration(durationSeconds: number): void {
    this.phraseDuration = Math.max(2.0, Math.min(8.0, durationSeconds));
  }

  public getPhraseDuration(): number {
    return this.phraseDuration;
  }

  public reset(startTime = 0): void {
    this.phraseStartTime = startTime;
    this.phraseIndex = 0;
  }

  /**
   * Evaluate the phrase context at the given audio/simulation time.
   */
  public getContext(time: number): PhraseContext {
    const elapsed = Math.max(0, time - this.phraseStartTime);
    const cycleCount = Math.floor(elapsed / this.phraseDuration);
    if (cycleCount !== this.phraseIndex) {
      this.phraseIndex = cycleCount;
    }

    const phraseTime = elapsed % this.phraseDuration;
    const progress = Math.max(0, Math.min(1, phraseTime / this.phraseDuration));

    let phase: PhrasePhase;
    let velocityMultiplier: number;
    let tensionTolerance: number;
    let cadenceBias: number;
    let breathSilenceBonus: number;
    let preferredRingBias: number;

    if (progress < 0.2) {
      // ─── Initiation Phase (0% - 20%) ───
      phase = 'initiation';
      const localP = progress / 0.2;
      velocityMultiplier = 0.65 + localP * 0.25; // 0.65 -> 0.90
      tensionTolerance = 0.3;                    // Conservative harmony
      cadenceBias = 0.5;                         // Grounded near root
      breathSilenceBonus = 0.1;
      preferredRingBias = 0.2;                   // Prefer low/outer rings
    } else if (progress < 0.6) {
      // ─── Growth Phase (20% - 60%) ───
      phase = 'growth';
      const localP = (progress - 0.2) / 0.4;
      velocityMultiplier = 0.90 + localP * 0.25; // 0.90 -> 1.15
      tensionTolerance = 0.4 + localP * 0.4;     // Gradually allow more tension
      cadenceBias = 0.1;                         // Free exploration
      breathSilenceBonus = 0.05;
      preferredRingBias = 0.5;                   // Mid/upper rings
    } else if (progress < 0.8) {
      // ─── Peak / Climax Phase (60% - 80%) ───
      phase = 'peak';
      velocityMultiplier = 1.25;                 // Powerful attack
      tensionTolerance = 0.95;                   // Maximum harmonic tension tolerated
      cadenceBias = 0.0;                         // No cadence constraint
      breathSilenceBonus = 0.0;                  // Sustained presence
      preferredRingBias = 0.8;                   // High energetic rings
    } else {
      // ─── Cadence / Resolution Phase (80% - 100%) ───
      phase = 'cadence';
      const localP = (progress - 0.8) / 0.2;
      velocityMultiplier = 1.1 - localP * 0.45;  // Decrescendo 1.10 -> 0.65
      tensionTolerance = Math.max(0.1, 0.5 - localP * 0.4); // Very low tension tolerated
      cadenceBias = 0.6 + localP * 0.4;          // Strong snap to tonic/fifth
      breathSilenceBonus = 0.3 + localP * 0.4;   // Create silence for the breath
      preferredRingBias = 0.1;                   // Return to root/outer ring
    }

    return {
      phraseId: `phrase-${this.phraseIndex}`,
      phase,
      phraseProgress: progress,
      velocityMultiplier,
      tensionTolerance,
      cadenceBias,
      breathSilenceBonus,
      preferredRingBias,
    };
  }
}
