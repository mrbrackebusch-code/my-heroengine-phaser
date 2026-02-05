import * as Tone from 'tone';

export type SongSpec = {
  tempo: number;
  key: string;
  scale: 'major' | 'minor';
  swing?: number;
  structure: string[];
  sections: Record<string, any>;
  instruments?: Record<string, string>;
};

export class MusicEngine {
  private songSpec?: SongSpec;
  private sequences: Array<any> = [];
  private started = false;

  async initAudioOnce(): Promise<void> {
    if (!this.started) {
      await Tone.start();
      this.started = true;
      console.log('[MusicEngine] Audio started');
    }
  }

  loadSong(spec: SongSpec) {
    this.stop();
    this.songSpec = spec;
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = spec.tempo || 120;

    // Build simple instruments
    const melodySynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
    }).toDestination();

    const chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 },
    }).toDestination();

    const kick = new Tone.MembraneSynth().toDestination();
    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
    }).toDestination();
    const hat = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.08, release: 0.01 } }).toDestination();

    // We'll expand each track into Parts scheduled on the Transport
    const firstSectionName = spec.structure[0];
    const section = spec.sections[firstSectionName];

    // --- Drums: 16-step grid patterns ---
    const drumSteps = this.resolveDrumPattern(section?.drums?.pattern || 'POP_BASIC');
    const drumEvents = drumSteps.map((hit, i) => {
      return { time: `${Math.floor(i / 16)}:${(i % 16) / 4}:0`, stepIndex: i, hit };
    });

    // Simpler: use a 16-step Sequence looping at '16n'
    const drumSeq = new Tone.Sequence((time, step) => {
      const hit = drumSteps[Number(step) % drumSteps.length];
      if (hit === 'K') kick.triggerAttackRelease('C2', '8n', time);
      else if (hit === 'S') snare.triggerAttackRelease('8n', time);
      else if (hit === 'H') hat.triggerAttackRelease('16n', time);
    }, drumSteps.map((_, i) => i), '16n');
    drumSeq.start(0);

    // --- Chords: expand progression into chord arrays and support basic patterns ---
    const prog: string[] = section?.chords?.prog || ['I', 'V', 'vi', 'IV'];
    const measuresPerChord = section?.chords?.measuresPerChord || 1;
    const scaleNotes = this.getScaleNotes(spec.key || 'C', spec.scale || 'major');
    const chordsArray = prog.map((r) => this.romanToChord(r, scaleNotes, 3));

    // Build chord events across measures (assume 4/4 measures from spec.sections[*].measures)
    const measuresPerSection = section?.measures || 4;
    const chordEvents: Array<{ time: string; pitches: string[] }> = [];
    for (let m = 0; m < measuresPerSection; m++) {
      const chordIdx = Math.floor(m / measuresPerChord) % chordsArray.length;
      const measureStart = `${m}:0:0`;
      chordEvents.push({ time: measureStart, pitches: chordsArray[chordIdx] });
      // if STRUM_8TH, schedule arpeggiation within measure via small offsets
      if ((section?.chords?.pattern || '').includes('STRUM')) {
        // schedule root->third->fifth at 8n offsets
        const [r, t, f] = chordsArray[chordIdx];
        Tone.Transport.schedule((time) => chordsSynth.triggerAttackRelease(r, '8n', time, 0.8), measureStart);
        Tone.Transport.schedule((time) => chordsSynth.triggerAttackRelease(t, '8n', time, 0.8), `${measureStart} + 8n`);
        Tone.Transport.schedule((time) => chordsSynth.triggerAttackRelease(f, '8n', time, 0.8), `${measureStart} + 4n`);
      }
    }

    // If not using STRUM pattern, play full triad at measure start
    if (!((section?.chords?.pattern || '').includes('STRUM'))) {
      for (const ev of chordEvents) {
        Tone.Transport.schedule((time) => chordsSynth.triggerAttackRelease(ev.pitches, '1m', time, 0.7), ev.time);
      }
    }

    // --- Melody: motif repeated across measures ---
    const motif: (number | 'R')[] = section?.melody?.motif || [1, 3, 5, 3];
    const durs: string[] = section?.melody?.dur || ['4n', '4n', '4n', '4n'];
    const melodyMode = section?.melody?.mode || 'SCALE';

    // Build melody events for one section and schedule them across the section measures
    const melodyEvents: Array<{ time: string; note?: string; dur: string }> = [];
    for (let m = 0; m < measuresPerSection; m++) {
      let beatOffset = `${m}:0:0`;
      let accum = 0; // sixteenth subdivisions tracking
      for (let i = 0; i < motif.length; i++) {
        const stepDur = Tone.Time(durs[i % durs.length]).toNotation();
        const timeString = `${m}:${Math.floor(accum / 4)}:${(accum % 4) * 1}`; // rough conversion
        const deg = motif[i];
        if (deg === 'R' || deg === 0) {
          // rest
          melodyEvents.push({ time: timeString, note: undefined, dur: durs[i % durs.length] });
        } else {
          let note = this.degreeToNote(Number(deg), scaleNotes, 4);
          if (melodyMode === 'CHORD_TONES') {
            // snap to nearest chord tone of the current chord in this measure
            const chordIdx = Math.floor(m / measuresPerChord) % chordsArray.length;
            const chord = chordsArray[chordIdx];
            // choose closest by simple match to degree root/third/fifth
            note = chord[0];
          }
          melodyEvents.push({ time: timeString, note, dur: durs[i % durs.length] });
        }
        accum += Tone.Time(durs[i % durs.length]).toTicks();
      }
    }

    // Schedule melody events
    for (const ev of melodyEvents) {
      if (ev.note) {
        Tone.Transport.schedule((time) => melodySynth.triggerAttackRelease(ev.note as string, ev.dur, time, 0.9), ev.time);
      }
    }

    // Keep references for disposal
    this.sequences = [drumSeq, /* chord events scheduled on Transport */ melodyEvents];

    // Metronome tick (no-op by default; UI can call getPlayhead)
    const tick = new Tone.Loop((time) => {}, '4n');
    tick.start(0);
    this.sequences.push(tick);

    if (Tone.Transport.state !== 'started') Tone.Transport.start();
  }

  play() {
    if (Tone.Transport.state !== 'started') Tone.Transport.start();
  }

  pause() {
    if (Tone.Transport.state === 'started') Tone.Transport.pause();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    for (const s of this.sequences) {
      try { s.dispose?.(); } catch (e) {}
    }
    this.sequences = [];
  }

  getPlayhead(): string {
    return Tone.Transport.position;
  }

  // --- Helpers: scale / chord generation ---
  private chromatic(): string[] {
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  }

  private normalizeKey(key: string): string {
    // map flats to sharps for our chromatic array
    const map: Record<string, string> = { 'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#' };
    return (map[key] || key).replace('maj', '').replace('minor', '');
  }

  private getScaleNotes(key: string, scale: 'major' | 'minor') {
    const chrom = this.chromatic();
    const k = this.normalizeKey(key);
    const root = chrom.indexOf(k) >= 0 ? chrom.indexOf(k) : 0;
    const intervals = scale === 'major' ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10];
    return intervals.map(i => chrom[(root + i) % 12]);
  }

  private romanToChord(roman: string, scaleNotes: string[], octave = 3): string[] {
    const map: Record<string, number> = { 'I':0, 'ii':1, 'iii':2, 'IV':3, 'V':4, 'vi':5, 'vii°':6 };
    const deg = map[roman] ?? 0;
    const root = scaleNotes[deg % 7] + octave.toString();
    const third = scaleNotes[(deg + 2) % 7] + octave.toString();
    const fifth = scaleNotes[(deg + 4) % 7] + octave.toString();
    return [root, third, fifth];
  }

  private degreeToNote(deg: number, scaleNotes: string[], octave = 4): string {
    const idx = ((deg - 1) % 7 + 7) % 7;
    return scaleNotes[idx] + octave.toString();
  }

  private resolveDrumPattern(name: string): string[] {
    // return 16-step pattern using 'K'=kick, 'S'=snare, 'H'=hat, '.'=rest
    const patterns: Record<string, string[]> = {
      POP_BASIC: [
        'K', '.', '.', '.',  // 1
        '.', 'S', '.', '.',  // e +
        'K', '.', '.', '.',  // 3
        '.', 'S', '.', 'H'   // 4
      ],
      FOUR_ON_FLOOR: [ 'K','.','.','.','K','.','.','.','K','.','.','.','K','.','.','.'],
      HALF_TIME: [ 'K','.','.','.','.','.','.','.','K','.','.','.','.','.','.','.']
    };
    return patterns[name] || patterns['POP_BASIC'];
  }
}
