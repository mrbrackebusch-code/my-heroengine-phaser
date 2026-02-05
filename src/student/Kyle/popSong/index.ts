import { MusicEngine } from './MusicEngine';
import { exampleSong } from './exampleSong';

export const engine = new MusicEngine();

export async function initAndPlayExample() {
  await engine.initAudioOnce();
  engine.loadSong(exampleSong);
  engine.play();
}

export default engine;
