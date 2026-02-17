/**
 * Score calculator for FNF-style rhythm gameplay.
 * Maps hit accuracy to score tiers and healing multipliers.
 */

export type ScoreTier = "Sick" | "Mid" | "Bruh" | "Garbage";

export interface HitResult {
  tier: ScoreTier;
  accuracyPercent: number; // 0..100
  healingMultiplier: number; // 0..1
  timingOffsetMs: number; // distance from perfect hit (signed)
}

/**
 * Hit window definitions (milliseconds from perfect hit).
 * Negative = hit too early, Positive = hit too late.
 */
export const HIT_WINDOWS = {
  Sick: { min: -75, max: 75 }, // ±75ms = perfect
  Mid: { min: -150, max: 150 }, // ±150ms = good
  Bruh: { min: -225, max: 225 }, // ±225ms = ok
  Miss: 999999, // beyond hit window
};

/**
 * Accuracy multipliers for healing/damage scaling.
 */
export const ACCURACY_MULTIPLIERS: Record<ScoreTier, number> = {
  Sick: 1.0, // 100% effect
  Mid: 0.8, // 80% effect
  Bruh: 0.5, // 50% effect
  Garbage: 0.0, // 0% effect (miss)
};

/**
 * Evaluate a hit based on timing offset.
 * Returns the score tier and healing multiplier.
 */
export function evaluateHit(timingOffsetMs: number): HitResult {
  const absOffset = Math.abs(timingOffsetMs);

  let tier: ScoreTier;
  if (absOffset <= HIT_WINDOWS.Sick.max) {
    tier = "Sick";
  } else if (absOffset <= HIT_WINDOWS.Mid.max) {
    tier = "Mid";
  } else if (absOffset <= HIT_WINDOWS.Bruh.max) {
    tier = "Bruh";
  } else {
    tier = "Garbage";
  }

  const multiplier = ACCURACY_MULTIPLIERS[tier];
  const accuracyPercent = tier === "Garbage" ? 0 : Math.round(multiplier * 100);

  return {
    tier,
    accuracyPercent,
    healingMultiplier: multiplier,
    timingOffsetMs,
  };
}

/**
 * Compute overall performance from multiple hits.
 */
export interface PerformanceStats {
  totalNotes: number;
  sickCount: number;
  midCount: number;
  bruhCount: number;
  missCount: number;
  averageMultiplier: number; // 0..1
  averageAccuracyPercent: number; // 0..100
}

export function computePerformance(hits: HitResult[]): PerformanceStats {
  const stats: PerformanceStats = {
    totalNotes: hits.length,
    sickCount: 0,
    midCount: 0,
    bruhCount: 0,
    missCount: 0,
    averageMultiplier: 0,
    averageAccuracyPercent: 0,
  };

  if (hits.length === 0) return stats;

  let totalMultiplier = 0;
  for (const hit of hits) {
    totalMultiplier += hit.healingMultiplier;
    if (hit.tier === "Sick") stats.sickCount += 1;
    else if (hit.tier === "Mid") stats.midCount += 1;
    else if (hit.tier === "Bruh") stats.bruhCount += 1;
    else if (hit.tier === "Garbage") stats.missCount += 1;
  }

  stats.averageMultiplier = totalMultiplier / hits.length;
  stats.averageAccuracyPercent = Math.round(stats.averageMultiplier * 100);

  return stats;
}
