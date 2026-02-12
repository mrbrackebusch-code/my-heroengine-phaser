/**
 * Initialize PopSong Blockly Blocks
 * Registers all block definitions with Blockly
 */

export function initBlocklyBlocks() {
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

  // ============================================================
  // DRUM BLOCKS
  // ============================================================

  Blockly.Blocks['popsong_drum_pattern'] = {
    init() {
      const patterns = [
        ['Pop Basic', 'POP_BASIC'],
        ['Four on Floor', 'FOUR_ON_FLOOR'],
        ['Half-time', 'HALF_TIME'],
      ];
      this.appendDummyInput()
        .appendField('Drum Pattern:')
        .appendField(new Blockly.FieldDropdown(patterns), 'PATTERN');
      this.appendDummyInput()
        .appendField('Intensity:')
        .appendField(new Blockly.FieldNumber(1, 1, 3, 1), 'VARIANT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(180);
      this.setTooltip('Choose a drum pattern and intensity (1=basic, 3=busy)');
    },
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
}
