PopSong student module

Files:
- `MusicEngine.ts` — minimal Tone.js-backed music engine with `initAudioOnce()`, `loadSong()`, `play()`, `pause()`, `stop()`, and `getPlayhead()`.
- `exampleSong.ts` — a small SongSpec used to test playback.
- `index.ts` — helper to initialize and play the example.

How to test in the browser:

1. In a user gesture handler (click), call `await import('./student/Kyle/popSong').then(m => m.initAndPlayExample())` from your app code.
2. Alternatively, if you have a Phaser Scene and want on-screen controls, import and call `addTransportControls` from `PhaserDemo.ts` in your scene's `create()`:

```ts
import { addTransportControls } from './student/Kyle/popSong/PhaserDemo';

// inside your Phaser.Scene.create():
addTransportControls(this, 16, 16);
```

Notes & next steps:
- This is a minimal student-side scaffold. It purposely avoids editing core code.
- `KyleNeeds.md` should be updated if you want to add a registration hook so core auto-discovers this module.

If you want a quick manual HTML test that doesn't touch Phaser, ask and I'll add a `demo.html` that imports the module and exposes a click-to-start button.
