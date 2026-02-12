/**
 * PopSong Blockly Block Definitions
 * Defines visual blocks for students to compose songs without raw code.
 * 
 * Blocks are grouped by category:
 * - Settings (tempo, key, scale)
 * - Structure (sections, song layout)
 * - Chords (progressions, patterns)
 * - Drums (patterns, variants)
 * - Melody (motifs, durations, modes)
 */

import Blockly from 'blockly';

const jsonGenerator = new Blockly.CodeGenerator('json');

// ============================================================
// SONG SETTINGS BLOCKS
// ============================================================

Blockly.Blocks['popsong_set_tempo'] = {
  init() {
    this.appendDummyInput()
      .appendField('Set Tempo')
      .appendField(new Blockly.FieldNumber(120, 60, 200, 1), 'BPM')
      .appendField('BPM');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(0);
    this.setTooltip('Set song tempo in beats per minute');
  },
};

jsonGenerator.forBlock['popsong_set_tempo'] = (block) => {
  const bpm = block.getFieldValue('BPM');
  return JSON.stringify({ _type: 'set_tempo', tempo: parseInt(bpm) });
};

Blockly.Blocks['popsong_set_key'] = {
  init() {
    const keys = [
      ['C', 'C'],
      ['D', 'D'],
      ['E', 'E'],
      ['F', 'F'],
      ['G', 'G'],
      ['A', 'A'],
      ['B', 'B'],
    ];
    this.appendDummyInput()
      .appendField('Set Key')
      .appendField(new Blockly.FieldDropdown(keys), 'KEY');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(0);
    this.setTooltip('Set the key of the song');
  },
};

jsonGenerator.forBlock['popsong_set_key'] = (block) => {
  const key = block.getFieldValue('KEY');
  return JSON.stringify({ _type: 'set_key', key });
};

Blockly.Blocks['popsong_set_scale'] = {
  init() {
    const scales = [
      ['Major', 'major'],
      ['Minor', 'minor'],
    ];
    this.appendDummyInput()
      .appendField('Set Scale')
      .appendField(new Blockly.FieldDropdown(scales), 'SCALE');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(0);
    this.setTooltip('Set major or minor scale');
  },
};

jsonGenerator.forBlock['popsong_set_scale'] = (block) => {
  const scale = block.getFieldValue('SCALE');
  return JSON.stringify({ _type: 'set_scale', scale });
};

// ============================================================
// STRUCTURE BLOCKS
// ============================================================

Blockly.Blocks['popsong_define_section'] = {
  init() {
    this.appendDummyInput()
      .appendField('Define Section')
      .appendField(new Blockly.FieldTextInput('Verse'), 'NAME');
    this.appendDummyInput()
      .appendField('Measures:')
      .appendField(new Blockly.FieldNumber(4, 1, 32, 1), 'MEASURES');
    this.appendStatementInput('TRACKS')
      .setCheck(null)
      .appendField('Tracks:');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(120);
    this.setTooltip('Define a song section (Verse, Chorus, Bridge, etc.)');
  },
};

jsonGenerator.forBlock['popsong_define_section'] = (block) => {
  const name = block.getFieldValue('NAME');
  const measures = block.getFieldValue('MEASURES');
  const tracks = jsonGenerator.statementToCode(block, 'TRACKS');
  return JSON.stringify({
    _type: 'define_section',
    name,
    measures: parseInt(measures),
    tracks,
  });
};

Blockly.Blocks['popsong_song_structure'] = {
  init() {
    this.appendDummyInput().appendField('Song Structure:');
    this.appendDummyInput()
      .appendField(new Blockly.FieldTextInput('VERSE,CHORUS,VERSE,CHORUS'), 'STRUCTURE');
    this.appendField('(comma-separated)');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(120);
    this.setTooltip('Define the order of sections (e.g., VERSE,CHORUS,VERSE,CHORUS)');
  },
};

jsonGenerator.forBlock['popsong_song_structure'] = (block) => {
  const structure = block.getFieldValue('STRUCTURE');
  const parts = structure.split(',').map((s) => s.trim());
  return JSON.stringify({ _type: 'song_structure', structure: parts });
};

// ============================================================
// CHORD BLOCKS
// ============================================================

Blockly.Blocks['popsong_chord_progression'] = {
  init() {
    const chords = [
      ['I', 'I'],
      ['ii', 'ii'],
      ['iii', 'iii'],
      ['IV', 'IV'],
      ['V', 'V'],
      ['vi', 'vi'],
      ['vii°', 'vii°'],
    ];
    this.appendDummyInput().appendField('Chord Progression:');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown(chords), 'CHORD1')
      .appendField(',', null)
      .appendField(new Blockly.FieldDropdown(chords), 'CHORD2')
      .appendField(',', null)
      .appendField(new Blockly.FieldDropdown(chords), 'CHORD3')
      .appendField(',', null)
      .appendField(new Blockly.FieldDropdown(chords), 'CHORD4');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(240);
    this.setTooltip('Define a chord progression using Roman numerals');
  },
};

jsonGenerator.forBlock['popsong_chord_progression'] = (block) => {
  const c1 = block.getFieldValue('CHORD1');
  const c2 = block.getFieldValue('CHORD2');
  const c3 = block.getFieldValue('CHORD3');
  const c4 = block.getFieldValue('CHORD4');
  return JSON.stringify({
    _type: 'chord_progression',
    prog: [c1, c2, c3, c4],
  });
};

Blockly.Blocks['popsong_chord_pattern'] = {
  init() {
    const patterns = [
      ['Hold (whole)', 'HOLD'],
      ['Strum 8th', 'STRUM_8TH'],
      ['Arp Up', 'ARP_UP_8TH'],
      ['Arp Down', 'ARP_DOWN_8TH'],
      ['Bass+Chord', 'BASS_CHORD'],
    ];
    this.appendDummyInput()
      .appendField('Chord Pattern:')
      .appendField(new Blockly.FieldDropdown(patterns), 'PATTERN');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(240);
    this.setTooltip('Choose how chords are played');
  },
};

jsonGenerator.forBlock['popsong_chord_pattern'] = (block) => {
  const pattern = block.getFieldValue('PATTERN');
  return JSON.stringify({ _type: 'chord_pattern', pattern });
};

// ============================================================
// DRUM BLOCKS
// ============================================================

Blockly.Blocks['popsong_drum_pattern'] = {
  init() {
    const patterns = [
      ['Pop Basic', 'POP_BASIC'],
      ['Four on Floor', 'FOUR_ON_FLOOR'],
      ['Half-time', 'HALF_TIME'],
      ['Breakbeat', 'BREAKBEAT'],
      ['Swing', 'SWING'],
    ];
    this.appendDummyInput()
      .appendField('Drum Pattern:')
      .appendField(new Blockly.FieldDropdown(patterns), 'PATTERN');
    this.appendDummyInput()
      .appendField('Intensity:')
      .appendField(new Blockly.FieldSlider(1, 1, 3, 1), 'VARIANT');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(180);
    this.setTooltip('Choose a drum pattern and intensity (1=basic, 3=busy)');
  },
};

jsonGenerator.forBlock['popsong_drum_pattern'] = (block) => {
  const pattern = block.getFieldValue('PATTERN');
  const variant = block.getFieldValue('VARIANT');
  return JSON.stringify({
    _type: 'drum_pattern',
    pattern,
    variant: parseInt(variant),
  });
};

// ============================================================
// MELODY BLOCKS
// ============================================================

Blockly.Blocks['popsong_melody_motif'] = {
  init() {
    this.appendDummyInput()
      .appendField('Melody Motif:')
      .appendField(new Blockly.FieldTextInput('1,3,5,3'), 'MOTIF');
    this.appendField('(scale degrees 1–7, or R for rest)');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(60);
    this.setTooltip('Enter scale degree motif (e.g., 1,3,5,3)');
  },
};

jsonGenerator.forBlock['popsong_melody_motif'] = (block) => {
  const motifStr = block.getFieldValue('MOTIF');
  const motif = motifStr.split(',').map((m) => {
    m = m.trim().toUpperCase();
    return m === 'R' ? 'R' : parseInt(m);
  });
  return JSON.stringify({ _type: 'melody_motif', motif });
};

Blockly.Blocks['popsong_melody_durations'] = {
  init() {
    this.appendDummyInput()
      .appendField('Durations:')
      .appendField(new Blockly.FieldTextInput('4n,4n,4n,4n'), 'DURS');
    this.appendField('(4n,8n,16n)');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(60);
    this.setTooltip('Enter note durations (4n=quarter, 8n=eighth, 16n=sixteenth)');
  },
};

jsonGenerator.forBlock['popsong_melody_durations'] = (block) => {
  const durs = block.getFieldValue('DURS').split(',').map((d) => d.trim());
  return JSON.stringify({ _type: 'melody_durations', dur: durs });
};

Blockly.Blocks['popsong_melody_mode'] = {
  init() {
    const modes = [
      ['Scale (all notes)', 'SCALE'],
      ['Chord Tones Only', 'CHORD_TONES'],
    ];
    this.appendDummyInput()
      .appendField('Melody Mode:')
      .appendField(new Blockly.FieldDropdown(modes), 'MODE');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(60);
    this.setTooltip('Choose how melody notes snap to chords or scale');
  },
};

jsonGenerator.forBlock['popsong_melody_mode'] = (block) => {
  const mode = block.getFieldValue('MODE');
  return JSON.stringify({ _type: 'melody_mode', mode });
};

// ============================================================
// TOP-LEVEL SONG BLOCK
// ============================================================

Blockly.Blocks['popsong_song'] = {
  init() {
    this.appendDummyInput().appendField('Pop Song');
    this.appendStatementInput('BODY')
      .setCheck(null)
      .appendField('Build Song:');
    this.setColour(200);
    this.setTooltip('Create a song from blocks');
  },
};

jsonGenerator.forBlock['popsong_song'] = (block) => {
  const body = jsonGenerator.statementToCode(block, 'BODY');
  return body || '{}';
};

export { jsonGenerator };
