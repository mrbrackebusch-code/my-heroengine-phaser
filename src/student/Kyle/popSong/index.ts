import { MusicEngine } from './MusicEngine.js';
import { exampleSong } from './exampleSong.js';

export const engine = new MusicEngine();

export async function initAndPlayExample() {
  await engine.initAudioOnce();
  await engine.loadSong(exampleSong);
  engine.play();
}

export default engine;
