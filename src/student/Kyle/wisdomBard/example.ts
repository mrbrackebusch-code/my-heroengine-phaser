/**
 * Example: Using the BardMode FNF minigame system
 *
 * This demonstrates the core API and game loop.
 */

import { BardMode } from './bardMode';
import type { Song } from './songData';
import type { ActiveNote } from './minigame';
import type { HitResult } from './scoreCalculator';

/**
 * Example: Create a simple test song
 */
function makeTestSong(): Song {
  return {
    title: "Test Song",
    bpm: 120,
    notes: [
      // 1 second in: press down
      { timeMs: 1000, lane: 'down' },
      // 1.5 seconds in: press left
      { timeMs: 1500, lane: 'left' },
      // 2 seconds in: press up
      { timeMs: 2000, lane: 'up' },
      // 2.5 seconds in: press right
      { timeMs: 2500, lane: 'right' },
      // 3 seconds in: press down again
      { timeMs: 3000, lane: 'down' },
      // 3.5 seconds in: press left
      { timeMs: 3500, lane: 'left' },
    ],
  };
}

/**
 * Example game loop showing how rendering/audio would integrate.
 */
function exampleGameLoop() {
  const song = makeTestSong();

  // Simulate rendering callbacks
  const bard = new BardMode(
    (note: ActiveNote) => {
      console.log(`[RENDER] Spawn note: ${note.note.lane} at ${note.note.timeMs}ms`);
    },
    (note: ActiveNote, result: HitResult) => {
      console.log(
        `[RENDER] Hit! Lane: ${note.note.lane}, Tier: ${result.tier}, ` +
        `Accuracy: ${result.accuracyPercent}%, Multiplier: ${result.healingMultiplier}`
      );
    },
    (note: ActiveNote) => {
      console.log(`[RENDER] Missed: ${note.note.lane} at ${note.note.timeMs}ms`);
    }
  );

  // Start minigame
  bard.startHolding(song);

  // Simulate game loop over ~4 seconds
  const gameLoopInterval = setInterval(() => {
    if (!bard.isRunning()) {
      clearInterval(gameLoopInterval);
      console.log("\n=== GAME OVER ===");
      const perf = bard.getLastPerformance();
      if (perf) {
        console.log(`Total Notes: ${perf.totalNotes}`);
        console.log(`Sick: ${perf.sickCount}, Mid: ${perf.midCount}, Bruh: ${perf.bruhCount}, Misses: ${perf.missCount}`);
        console.log(`Average Accuracy: ${perf.averageAccuracyPercent}%`);
        console.log(`Healing Multiplier: ${perf.averageMultiplier.toFixed(2)}`);
      }
      return;
    }

    // Tick the minigame
    const tick = bard.tick();
    if (tick) {
      // tick.spawned and tick.missed are already handled by callbacks above
    }

    // Simulate random arrow presses
    const lanes: Array<'left' | 'up' | 'down' | 'right'> = ['left', 'up', 'down', 'right'];
    if (Math.random() < 0.3) {
      const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
      console.log(`[INPUT] Player presses ${randomLane}`);
      bard.onInput(randomLane);
    }
  }, 100); // tick every 100ms

  // Stop after 4.5 seconds
  setTimeout(() => {
    console.log("\n[SONG END] Stopping minigame...");
    const result = bard.stopHolding();
    if (result) {
      console.log(`Final Healing Multiplier: ${result.healingMultiplier.toFixed(2)}`);
    }
  }, 4500);
}

/**
 * Simple usage example: quick check that system initializes
 */
export function testBardModeInitialization() {
  const song = makeTestSong();
  const bard = new BardMode();

  bard.startHolding(song);
  if (!bard.isRunning()) {
    throw new Error("Bard mode should be running!");
  }

  bard.tick();
  bard.onInput('down');

  const result = bard.stopHolding();
  if (!result) {
    throw new Error("stopHolding should return result!");
  }

  console.log("✓ BardMode initialization test passed");
  return true;
}

// Uncomment to run example:
// exampleGameLoop();
// testBardModeInitialization();
