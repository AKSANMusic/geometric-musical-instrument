/**
 * DensityGovernor.ts — Sliding Window Note Budget & Event Throttling
 *
 * Implements REBUILD_SPEC_V2.md Section 5.1:
 * - Dynamically limits notes per second based on Energy [0, 100] and Complexity [0, 100].
 * - Prevents sonic mud, particle avalanches, and cacophony without killing expressive bursts.
 * - Converts excess high-stability notes into delicate ghost notes rather than harsh drops.
 */

export interface GovernorDecision {
  readonly allowed: boolean;
  readonly isGhost: boolean;
  readonly adjustedVelocity: number;
  readonly currentDensity: number; // Notes per second in current sliding window
  readonly budget: number;
}

export class DensityGovernor {
  private recentTimestamps: number[] = [];
  private windowDuration: number;
  private energy: number;
  private complexity: number;

  constructor(energy = 50, complexity = 50, windowDuration = 1.0) {
    this.energy = energy;
    this.complexity = complexity;
    this.windowDuration = windowDuration;
  }

  public setParameters(energy: number, complexity: number): void {
    this.energy = Math.max(0, Math.min(100, energy));
    this.complexity = Math.max(0, Math.min(100, complexity));
  }

  /**
   * Calculate maximum allowable notes per second.
   * Formula: 1.5 + (energy / 100) * 8.0 + (complexity / 100) * 6.0
   * Range: 1.5 (at 0/0) to 15.5 notes/sec (at 100/100).
   */
  public getBudget(): number {
    return 1.5 + (this.energy / 100) * 8.0 + (this.complexity / 100) * 6.0;
  }

  /**
   * Evaluate whether a candidate event should sound, be turned into a ghost note, or be suppressed.
   *
   * @param currentTime - Current timestamp in seconds (audio clock or physics time)
   * @param candidateVelocity - [0, 1] original intensity
   * @param candidateStability - [0, 1] harmonic stability (1 = tonic)
   */
  public evaluate(
    currentTime: number,
    candidateVelocity: number,
    candidateStability = 0.5,
  ): GovernorDecision {
    // Prune events outside sliding window
    const windowStart = currentTime - this.windowDuration;
    this.recentTimestamps = this.recentTimestamps.filter(t => t >= windowStart);

    const budget = this.getBudget();
    const currentDensity = this.recentTimestamps.length;

    // Below budget: fully allowed
    if (currentDensity < budget) {
      this.recentTimestamps.push(currentTime);
      return {
        allowed: true,
        isGhost: false,
        adjustedVelocity: candidateVelocity,
        currentDensity: currentDensity + 1,
        budget,
      };
    }

    // Over budget by slight amount (up to 1.3x):
    // Highly stable notes or high-complexity settings can become quiet ghost notes
    const overflowFactor = (currentDensity - budget) / Math.max(1, budget);

    if (overflowFactor < 0.4 && (candidateStability > 0.7 || this.complexity > 60)) {
      // Allow as delicate ghost note with attenuated velocity
      const ghostVelocity = Math.max(0.08, candidateVelocity * 0.35);
      this.recentTimestamps.push(currentTime);
      return {
        allowed: true,
        isGhost: true,
        adjustedVelocity: ghostVelocity,
        currentDensity: currentDensity + 1,
        budget,
      };
    }

    // Otherwise drop note
    return {
      allowed: false,
      isGhost: false,
      adjustedVelocity: 0,
      currentDensity,
      budget,
    };
  }

  public reset(): void {
    this.recentTimestamps = [];
  }

  public getCurrentDensity(): number {
    return this.recentTimestamps.length;
  }
}
