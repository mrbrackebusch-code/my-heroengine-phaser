import { SongSpec } from './MusicEngine';

export const exampleSong: SongSpec = {
  tempo: 120,
  key: 'C',
  scale: 'major',
  swing: 0,
  structure: ['VERSE', 'CHORUS'],
  sections: {
    VERSE: {
      measures: 4,
      chords: { prog: ['I', 'V', 'vi', 'IV'], pattern: 'STRUM_8TH' },
      drums: { pattern: 'POP_BASIC', variant: 1 },
      melody: { motif: [1, 3, 5, 3], dur: ['4n', '4n', '4n', '4n'], mode: 'CHORD_TONES' },
    },
    CHORUS: {
      measures: 4,
      chords: { prog: ['I', 'V', 'vi', 'IV'], pattern: 'STRUM_8TH' },
      drums: { pattern: 'POP_BASIC', variant: 2 },
      melody: { motif: [5, 6, 5, 3], dur: ['8n', '8n', '4n', '4n'], mode: 'SCALE' },
    },
  },
  instruments: {
    melody: 'SYNTH_LEAD',
    chords: 'SYNTH_PAD',
    drums: 'DRUMKIT_1',
  },
};
