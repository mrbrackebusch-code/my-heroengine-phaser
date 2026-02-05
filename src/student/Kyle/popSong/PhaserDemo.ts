// Small Phaser UI helper to add play/pause/stop controls that call the PopSong engine.
// Keep this entirely inside the student folder to avoid touching core game code.

export function addTransportControls(scene: any, x = 16, y = 16) {
  const pad = 6;
  const style = { font: '14px Arial', color: '#ffffff', backgroundColor: '#222' };

  const play = scene.add.text(x, y, 'Play', style).setInteractive({ useHandCursor: true });
  const pause = scene.add.text(x + 60, y, 'Pause', style).setInteractive({ useHandCursor: true });
  const stop = scene.add.text(x + 140, y, 'Stop', style).setInteractive({ useHandCursor: true });

  play.on('pointerdown', async () => {
    const mod = await import('./index');
    // Ensure audio started from a user gesture
    try {
      await mod.initAndPlayExample();
    } catch (e) {
      // Fallback: try explicit init then play
      await mod.engine.initAudioOnce?.();
      mod.engine.loadSong?.(mod.engine['songSpec'] || mod.engine);
      mod.engine.play?.();
    }
  });

  pause.on('pointerdown', async () => {
    const mod = await import('./index');
    mod.engine.pause?.();
  });

  stop.on('pointerdown', async () => {
    const mod = await import('./index');
    mod.engine.stop?.();
  });

  return { play, pause, stop };
}
