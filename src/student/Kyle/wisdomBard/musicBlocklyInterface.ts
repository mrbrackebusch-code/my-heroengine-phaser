import type { Song } from './songData';

/**
 * Parse Blockly-exported data (JSON or object) into a `Song` object.
 * The exact mapping depends on your Blockly workspace schema — implement the mapping here.
 *
 * Expected: either a JSON string or an object with fields like { title, bpm, notes: [{timeMs,lane}] }
 */
export async function parseBlocklyToSong(blocklyData: string | object): Promise<Song> {
  const raw = typeof blocklyData === 'string' ? JSON.parse(blocklyData) : (blocklyData as any);
  const song: Song = {
    title: raw?.title || 'Untitled',
    bpm: raw?.bpm || 120,
    notes: Array.isArray(raw?.notes) ? raw.notes.map((n: any) => ({ timeMs: Number(n.timeMs || n.t || 0), lane: n.lane || n.direction || 'down' })) : [],
    metadata: raw?.metadata || {},
  };
  return song;
}
