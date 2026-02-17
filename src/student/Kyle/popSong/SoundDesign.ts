/**
 * PopSong Sound Design Module
 * Provides high-quality Tone.js synthesizers and drum voices
 * for the Pop Song system (drums, chords, melody, bass).
 */

import * as Tone from 'tone';

export interface InstrumentKit {
  melodySynth: Tone.Synth;
  chordsSynth: Tone.PolySynth;
  bassSynth: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.MetalSynth;
  clapReverb: Tone.Reverb;
  masterGain: Tone.Gain;
}

/**
 * Create a polished melody lead synth
 * Bright, punchy, with slight vibrato for character
 */
function createMelodySynth(masterGain: Tone.Gain): Tone.Synth {
  const synth = new Tone.Synth({
    oscillator: {
      type: 'square',
    },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.4,
      release: 0.2,
    },
  });

  // Add vibrato LFO for expression
  const vibrato = new Tone.LFO({
    frequency: 5,
    amplitude: 0.05,
  });
  vibrato.connect(synth.frequency);
  vibrato.start();

  synth.connect(masterGain);
  return synth;
}

/**
 * Create a lush chord pad synthesizer
 * Warm, wide, sustains well
 */
function createChordsSynth(masterGain: Tone.Gain): Tone.PolySynth {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: 'triangle',
    },
    envelope: {
      attack: 0.08,
      decay: 0.3,
      sustain: 0.7,
      release: 0.5,
    },
  });

  synth.connect(masterGain);
  return synth;
}

/**
 * Create a punchy bass synth for low-end support
 * Follows chord progressions, adds groove
 */
function createBassSynth(masterGain: Tone.Gain): Tone.MonoSynth {
  const synth = new Tone.MonoSynth({
    oscillator: {
      type: 'sawtooth',
    },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.3,
      release: 0.1,
    },
    filter: {
      Q: 6,
      type: 'lowpass',
      frequency: 2000,
    },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.08,
      sustain: 0,
      release: 0.01,
      baseFrequency: 200,
      octaves: 2,
    },
  });

  synth.connect(masterGain);
  return synth;
}

/**
 * Create a punchy kick drum
 * 808-style with pitch bend
 */
function createKick(masterGain: Tone.Gain): Tone.MembraneSynth {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 6,
    oscillator: {
      type: 'sine',
    },
    envelope: {
      attack: 0.001,
      decay: 0.5,
      sustain: 0.1,
      release: 0.4,
    },
  });

  kick.connect(masterGain);
  return kick;
}

/**
 * Create a punchy snare drum
 * White noise with fast envelope
 */
function createSnare(masterGain: Tone.Gain): Tone.NoiseSynth {
  const snare = new Tone.NoiseSynth({
    noise: {
      type: 'white',
    },
    envelope: {
      attack: 0.001,
      decay: 0.15,
      sustain: 0,
      release: 0.04,
    },
  });

  // Add a small EQ to brighten snare
  const filter = new Tone.Filter({
    frequency: 8000,
    type: 'highpass',
  });
  snare.connect(filter);
  filter.connect(masterGain);

  return snare;
}

/**
 * Create hi-hat: short metallic burst
 */
function createHihat(masterGain: Tone.Gain): Tone.MetalSynth {
  const hihat = new Tone.MetalSynth({
    envelope: {
      attack: 0.001,
      decay: 0.08,
      release: 0.01,
    },
    harmonicity: 12,
    resonance: 3000,
    volume: -15,
  });

  hihat.connect(masterGain);
  return hihat;
}

/**
 * Create a reverb for drum processing
 * Adds space to kit
 */
function createDrumReverb(): Tone.Reverb {
  return new Tone.Reverb({
    decay: 1.5,
    preDelay: 0.01,
  });
}

/**
 * Main factory: create all instruments and return as kit
 */
export async function createInstrumentKit(): Promise<InstrumentKit> {
  // Ensure audio context is started
  await Tone.start();

  // Master gain for overall volume control
  const masterGain = new Tone.Gain(0.8).toDestination();

  // Create all instruments
  const melodySynth = createMelodySynth(masterGain);
  const chordsSynth = createChordsSynth(masterGain);
  const bassSynth = createBassSynth(masterGain);
  const kick = createKick(masterGain);
  const snare = createSnare(masterGain);
  const hihat = createHihat(masterGain);

  // Reverb for drums (optional send)
  const clapReverb = createDrumReverb();

  return {
    melodySynth,
    chordsSynth,
    bassSynth,
    kick,
    snare,
    hihat,
    clapReverb,
    masterGain,
  };
}

/**
 * Dispose all instruments safely
 */
export function disposeInstrumentKit(kit: InstrumentKit): void {
  try {
    kit.melodySynth.dispose();
    kit.chordsSynth.dispose();
    kit.bassSynth.dispose();
    kit.kick.dispose();
    kit.snare.dispose();
    kit.hihat.dispose();
    kit.clapReverb.dispose();
  } catch (e) {
    console.warn('[SoundDesign] Error disposing instruments:', e);
  }
}
