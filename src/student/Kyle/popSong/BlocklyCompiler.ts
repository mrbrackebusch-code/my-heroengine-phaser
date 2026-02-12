/**
 * Blockly → SongSpec JSON Compiler
 * Walks a Blockly workspace and generates a SongSpec for the MusicEngine
 */

import Blockly from 'blockly';
import type { SongSpec } from './MusicEngine.js';

export function compileBlocklyToSongSpec(workspace: Blockly.Workspace): SongSpec {
  // Start with defaults
  let spec: SongSpec = {
    tempo: 120,
    key: 'C',
    scale: 'major',
    structure: [],
    sections: {},
  };

  const topBlocks = workspace.getTopBlocks();

  // Collect all directives from blocks
  const directives: Record<string, any> = {};
  const sections: Record<string, any> = {};
  let structure: string[] = [];

  for (const block of topBlocks) {
    const type = block.type;

    if (type === 'popsong_set_tempo') {
      spec.tempo = parseInt(block.getFieldValue('BPM'));
    } else if (type === 'popsong_set_key') {
      spec.key = block.getFieldValue('KEY');
    } else if (type === 'popsong_set_scale') {
      spec.scale = block.getFieldValue('SCALE') as 'major' | 'minor';
    } else if (type === 'popsong_song_structure') {
      const structStr = block.getFieldValue('STRUCTURE');
      structure = structStr.split(',').map((s) => s.trim());
    } else if (type === 'popsong_define_section') {
      const sectionName = block.getFieldValue('NAME');
      const measures = parseInt(block.getFieldValue('MEASURES'));
      const tracksInput = block.getInput('TRACKS');

      // Collect track blocks within this section
      const chords = { prog: [], pattern: 'HOLD' };
      const drums = { pattern: 'POP_BASIC', variant: 1 };
      const melody = { motif: [], dur: [], mode: 'SCALE' };

      if (tracksInput && tracksInput.connection && tracksInput.connection.targetBlock()) {
        let trackBlock = tracksInput.connection.targetBlock();
        while (trackBlock) {
          if (trackBlock.type === 'popsong_chord_progression') {
            const prog = [];
            for (let i = 1; i <= 4; i++) {
              const chord = trackBlock.getFieldValue(`CHORD${i}`);
              if (chord) prog.push(chord);
            }
            chords.prog = prog;
          } else if (trackBlock.type === 'popsong_chord_pattern') {
            chords.pattern = trackBlock.getFieldValue('PATTERN');
          } else if (trackBlock.type === 'popsong_drum_pattern') {
            drums.pattern = trackBlock.getFieldValue('PATTERN');
            drums.variant = parseInt(trackBlock.getFieldValue('VARIANT'));
          } else if (trackBlock.type === 'popsong_melody_motif') {
            const motifStr = trackBlock.getFieldValue('MOTIF');
            melody.motif = motifStr.split(',').map((m) => {
              m = m.trim().toUpperCase();
              return m === 'R' ? 'R' : parseInt(m);
            });
          } else if (trackBlock.type === 'popsong_melody_durations') {
            const durStr = trackBlock.getFieldValue('DURS');
            melody.dur = durStr.split(',').map((d) => d.trim());
          } else if (trackBlock.type === 'popsong_melody_mode') {
            melody.mode = trackBlock.getFieldValue('MODE');
          }

          // Move to next track block
          const nextConnection = trackBlock.nextConnection;
          trackBlock = nextConnection ? nextConnection.targetBlock() : null;
        }
      }

      // Build section
      sections[sectionName] = {
        measures,
        chords: chords.prog.length > 0 ? chords : undefined,
        drums,
        melody: melody.motif.length > 0 ? melody : undefined,
      };
    }
  }

  // Apply structure if defined
  if (structure.length > 0) {
    spec.structure = structure;
  } else {
    // Default: use first section
    spec.structure = Object.keys(sections).slice(0, 1);
  }

  spec.sections = sections;

  // Validate defaults
  if (!spec.sections[spec.structure[0]]) {
    // Fallback: create a default section
    spec.sections['VERSE'] = {
      measures: 4,
      chords: { prog: ['I', 'V', 'vi', 'IV'], pattern: 'HOLD' },
      drums: { pattern: 'POP_BASIC', variant: 1 },
      melody: { motif: [1, 3, 5, 3], dur: ['4n', '4n', '4n', '4n'], mode: 'SCALE' },
    };
    spec.structure = ['VERSE'];
  }

  return spec;
}

/**
 * Load a JSON SongSpec and create Blockly blocks to represent it.
 * (Optional: useful for round-tripping. Not yet fully implemented.)
 */
export function loadSongSpecToBlockly(workspace: Blockly.Workspace, spec: SongSpec): void {
  workspace.clear();

  // Create tempo block
  const tempoBlock = workspace.newBlock('popsong_set_tempo');
  if (tempoBlock) tempoBlock.setFieldValue(String(spec.tempo), 'BPM');

  // Create key block
  const keyBlock = workspace.newBlock('popsong_set_key');
  if (keyBlock) keyBlock.setFieldValue(spec.key, 'KEY');

  // Create scale block
  const scaleBlock = workspace.newBlock('popsong_set_scale');
  if (scaleBlock) scaleBlock.setFieldValue(spec.scale, 'SCALE');

  // Create structure block
  const structBlock = workspace.newBlock('popsong_song_structure');
  if (structBlock) structBlock.setFieldValue(spec.structure.join(','), 'STRUCTURE');

  // Create section blocks
  for (const [sectionName, sectionDef] of Object.entries(spec.sections)) {
    const defBlock = workspace.newBlock('popsong_define_section');
    if (defBlock) {
      defBlock.setFieldValue(sectionName, 'NAME');
      defBlock.setFieldValue(String(sectionDef.measures || 4), 'MEASURES');
    }
    // TODO: recursively add track blocks (chords, drums, melody) to section
  }
}
