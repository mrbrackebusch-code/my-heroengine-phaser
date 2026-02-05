import type { Song, Note, Lane } from './songData';
import { evaluateHit, type HitResult, computePerformance, type PerformanceStats } from './scoreCalculator';

/**
 * Active note instance being judged.
 */
export interface ActiveNote {
  note: Note;
  id: string; // unique id for tracking
  spawnTimeMs: number; // time when note was spawned (for rendering)
  hitTimeMs?: number; // time when player hit it (if hit)
  hitResult?: HitResult; // evaluation result if hit
  missed: boolean; // true if note passed without a hit
}

/**
 * Core timing and input engine for the FNF-style rhythm game.
 * Phaser-agnostic: handles note timing, hit detection, and scoring.
 * Rendering/audio should be driven by callbacks.
 */
export class Minigame {
  private running = false;
  private startTime = 0;
  private noteIndex = 0;
  private activeNotes: Map<string, ActiveNote> = new Map();
  private allHits: HitResult[] = [];
  private nextNoteId = 0;

  // Hit window: how far ahead to spawn notes (so they have time to scroll)
  // Adjust based on visual scroll speed desired.
  private readonly SPAWN_LEAD_MS = 2000; // spawn notes 2 seconds before they hit

  // Threshold: mark note as missed if it passes the hit window without being hit
  private readonly MISS_THRESHOLD_MS = 300; // notes disappear 300ms after hit zone

  private onNoteSpawned?: (note: ActiveNote) => void;
  private onNoteHit?: (note: ActiveNote, result: HitResult) => void;
  private onNoteMissed?: (note: ActiveNote) => void;

  constructor(public song: Song, public complexity: number) {}

  /**
   * Register callbacks for rendering/audio feedback.
   */
  setCallbacks(opts: {
    onNoteSpawned?: (note: ActiveNote) => void;
    onNoteHit?: (note: ActiveNote, result: HitResult) => void;
    onNoteMissed?: (note: ActiveNote) => void;
  }) {
    this.onNoteSpawned = opts.onNoteSpawned;
    this.onNoteHit = opts.onNoteHit;
    this.onNoteMissed = opts.onNoteMissed;
  }

  start() {
    this.running = true;
    this.startTime = Date.now();
    this.noteIndex = 0;
    this.activeNotes.clear();
    this.allHits = [];
    this.nextNoteId = 0;
  }

  stop() {
    this.running = false;
  }

  /**
   * Call each frame to update note lifecycle and spawn new notes.
   * Returns notes that should be spawned or marked as missed this frame.
   */
  tick(): { spawned: ActiveNote[]; missed: ActiveNote[] } {
    if (!this.running) return { spawned: [], missed: [] };

    const now = Date.now() - this.startTime;
    const spawned: ActiveNote[] = [];
    const missed: ActiveNote[] = [];

    // Spawn notes that are now within the lead time
    while (
      this.noteIndex < this.song.notes.length &&
      this.song.notes[this.noteIndex].timeMs <= now + this.SPAWN_LEAD_MS
    ) {
      const note = this.song.notes[this.noteIndex];
      const id = `note_${this.nextNoteId++}`;
      const activeNote: ActiveNote = {
        note,
        id,
        spawnTimeMs: now,
        missed: false,
      };
      this.activeNotes.set(id, activeNote);
      this.onNoteSpawned?.(activeNote);
      spawned.push(activeNote);
      this.noteIndex += 1;
    }

    // Check for notes that should be marked as missed
    const toRemove: string[] = [];
    for (const [id, activeNote] of this.activeNotes) {
      if (activeNote.hitTimeMs !== undefined || activeNote.missed) continue;

      // If note has passed the hit zone by MISS_THRESHOLD_MS, mark as missed
      const timeSinceNote = now - activeNote.note.timeMs;
      if (timeSinceNote > this.MISS_THRESHOLD_MS) {
        activeNote.missed = true;
        this.onNoteMissed?.(activeNote);
        missed.push(activeNote);
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.activeNotes.delete(id);
    }

    return { spawned, missed };
  }

  /**
   * Called when the player presses an arrow key.
   * Finds the closest unhandled note in that lane and evaluates it.
   */
  onInput(lane: Lane): HitResult | null {
    if (!this.running) return null;

    const now = Date.now() - this.startTime;

    // Find the closest unhandled note in this lane
    let bestNote: ActiveNote | null = null;
    let bestDistance = Infinity;

    for (const activeNote of this.activeNotes.values()) {
      if (activeNote.hitTimeMs !== undefined || activeNote.missed) continue;
      if (activeNote.note.lane !== lane) continue;

      const distance = Math.abs(now - activeNote.note.timeMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNote = activeNote;
      }
    }

    if (!bestNote) return null; // no note in this lane within reason

    // Evaluate the hit
    const timingOffset = now - bestNote.note.timeMs;
    const hitResult = evaluateHit(timingOffset);

    bestNote.hitTimeMs = now;
    bestNote.hitResult = hitResult;
    this.allHits.push(hitResult);

    this.onNoteHit?.(bestNote, hitResult);

    return hitResult;
  }

  /**
   * Get the overall performance stats (called after song ends).
   */
  getPerformance(): PerformanceStats {
    // Add any remaining active notes as misses
    for (const activeNote of this.activeNotes.values()) {
      if (activeNote.hitTimeMs === undefined && !activeNote.missed) {
        activeNote.missed = true;
        this.allHits.push({
          tier: "Garbage",
          accuracyPercent: 0,
          healingMultiplier: 0,
          timingOffsetMs: 0,
        });
      }
    }

    return computePerformance(this.allHits);
  }

  /**
   * Utility: get current elapsed time in the song.
   */
  getCurrentTimeMs(): number {
    if (!this.running) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Utility: get all active notes currently on screen.
   */
  getActiveNotes(): ActiveNote[] {
    return Array.from(this.activeNotes.values());
  }
}
