import type { Song } from './songData';
import { estimateComplexity } from './songData';
import { Minigame, type ActiveNote } from './minigame';
import type { HitResult, PerformanceStats } from './scoreCalculator';

/**
 * Controller for the Wisdom "Bard Mode".
 * - Called when the player holds the Wisdom move button.
 * - Loads a Song (from Blockly), starts the FNF minigame, and tracks performance.
 * - Returns a healing/damage multiplier based on accuracy when done.
 */
export class BardMode {
  private minigame?: Minigame;
  private isActive = false;
  private performance?: PerformanceStats;

  constructor(
    private onNoteSpawned?: (note: ActiveNote) => void,
    private onNoteHit?: (note: ActiveNote, result: HitResult) => void,
    private onNoteMissed?: (note: ActiveNote) => void
  ) {}

  /**
   * Start the minigame with a given song.
   * Call this when the player holds the Wisdom move button.
   */
  async startHolding(song: Song) {
    const complexity = estimateComplexity(song);
    this.minigame = new Minigame(song, complexity);
    this.minigame.setCallbacks({
      onNoteSpawned: this.onNoteSpawned,
      onNoteHit: this.onNoteHit,
      onNoteMissed: this.onNoteMissed,
    });
    this.minigame.start();
    this.isActive = true;
  }

  /**
   * Update the minigame (call each frame/tick).
   */
  tick(): { spawned: ActiveNote[]; missed: ActiveNote[] } | null {
    if (!this.isActive || !this.minigame) return null;
    return this.minigame.tick();
  }

  /**
   * Stop the minigame and return performance stats.
   * Call this when the player releases the Wisdom move button.
   */
  stopHolding(): { performance: PerformanceStats; healingMultiplier: number } | null {
    if (!this.isActive || !this.minigame) return null;
    this.minigame.stop();
    this.performance = this.minigame.getPerformance();
    this.isActive = false;

    // The healing multiplier is the average accuracy
    const healingMultiplier = this.performance.averageMultiplier;
    return { performance: this.performance, healingMultiplier };
  }

  /**
   * Called when player presses an arrow key.
   */
  onInput(lane: 'left' | 'up' | 'down' | 'right'): HitResult | null {
    if (!this.isActive || !this.minigame) return null;
    return this.minigame.onInput(lane);
  }

  /**
   * Get the current minigame instance (for advanced usage like rendering).
   */
  getMinigame(): Minigame | null {
    return this.minigame || null;
  }

  /**
   * Check if minigame is currently running.
   */
  isRunning(): boolean {
    return this.isActive && !!this.minigame;
  }

  /**
   * Get the last performance stats (after stopHolding is called).
   */
  getLastPerformance(): PerformanceStats | null {
    return this.performance || null;
  }
}
