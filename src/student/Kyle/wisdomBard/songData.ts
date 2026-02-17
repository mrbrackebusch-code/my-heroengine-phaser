export type Lane = 'left' | 'up' | 'down' | 'right';

export type Note = {
  timeMs: number; // absolute time from song start in ms
  lane: Lane;
  durationMs?: number; // for hold notes (optional)
};

export type Song = {
  title?: string;
  bpm: number;
  notes: Note[];
  metadata?: Record<string, any>;
  complexity?: number; // 0..1 estimated complexity
};

/**
 * Simple heuristic: combine note density and bpm into a 0..1 complexity value.
 * Higher complexity = harder song = higher potential reward.
 */
export function estimateComplexity(song: Song): number {
  if (!song || !song.notes || song.notes.length === 0) return 0;
  const durationMs = Math.max(...song.notes.map(n => n.timeMs)) || 60000;
  const minutes = Math.max(1, durationMs / 60000);
  const noteDensity = song.notes.length / minutes; // notes per minute
  const densityScore = Math.min(1, noteDensity / 240); // 240 notes/min is very dense
  const bpmScore = Math.min(1, song.bpm / 240);
  const complexity = Math.min(1, (densityScore * 0.7) + (bpmScore * 0.3));
  song.complexity = complexity;
  return complexity;
}
