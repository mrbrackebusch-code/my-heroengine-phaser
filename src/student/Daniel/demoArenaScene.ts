import Phaser from 'phaser';
import { ArenaEntrance } from './arenaEntrance';

export default class DemoArenaScene extends Phaser.Scene {
  private arena: ArenaEntrance;
  private uiTexts: { [k: string]: Phaser.GameObjects.Text } = {};

  constructor() {
    super({ key: 'DemoArenaScene' });
    this.arena = new ArenaEntrance();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1e1e2f');

    // Door area
    this.add.rectangle(400, 90, 320, 80, 0x223344).setStrokeStyle(2, 0xffffff);
    this.add.text(400, 90, 'Combat Area', { color: '#fff', fontSize: '20px' }).setOrigin(0.5);

    // Player panels
    this.createPlayerPanel('p1', 'Alice', 200);
    this.createPlayerPanel('p2', 'Bob', 520);

    // Countdown text
    this.uiTexts.countdown = this.add.text(400, 180, 'Countdown: -', { color: '#ffeb3b', fontSize: '22px' }).setOrigin(0.5);

    // Status area
    this.uiTexts.status = this.add.text(400, 220, 'Status: idle', { color: '#ffffff', fontSize: '16px' }).setOrigin(0.5);

    // Wire a simple tick callback
    const tick = (count: number) => {
      this.uiTexts.countdown.setText(`Countdown: ${count}`);
      if (count <= 0) {
        this.time.delayedCall(200, () => this.updateAllUI());
      }
    };

    // Expose a start button for manual start (in case both players are ready)
    this.add.text(400, 260, 'Start Countdown', { color: '#000', backgroundColor: '#8bc34a', padding: { x: 8, y: 6 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const ok = this.arena.startCountdown(tick);
        this.uiTexts.status.setText(ok ? 'Status: Countdown started' : 'Status: Cannot start (need 2 ready)');
      });

    this.updateAllUI();
  }

  private createPlayerPanel(id: string, name: string, x: number) {
    const y = 360;
    this.add.rectangle(x, y, 260, 220, 0x2a2a3a).setStrokeStyle(1, 0x999999);
    this.add.text(x - 100, y - 80, name, { color: '#fff', fontSize: '18px' });

    // Buttons: Arrive, Enter, Ready, Not Ready, Leave
    const makeBtn = (label: string, dy: number, cb: () => void) => {
      const t = this.add.text(x + 20, y - 60 + dy, label, { color: '#000', backgroundColor: '#e0e0e0', padding: { x: 6, y: 4 } })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          cb();
          this.updateAllUI();
        });
      return t;
    };

    makeBtn('Arrive', 0, () => this.arena.playerArrivesAtEntrance(id, name));
    makeBtn('Enter', 36, () => this.arena.playerEntersArena(id));
    makeBtn('Ready', 72, () => this.arena.playerReady(id));
    makeBtn('Not Ready', 108, () => this.arena.playerNotReady(id));
    makeBtn('Leave', 144, () => this.arena.playerLeavesEntrance(id));

    // Player state text
    this.uiTexts[`${id}_state`] = this.add.text(x - 40, y + 40, 'state: -', { color: '#ffffff', fontSize: '14px' });
  }

  private updateAllUI() {
    ['p1', 'p2'].forEach((id) => {
      const t = this.uiTexts[`${id}_state`];
      const p = this.arena.getPlayer(id);
      if (p) {
        t.setText(`state: ${p.status} ${p.isReady ? '(READY)' : ''}`);
      } else {
        t.setText('state: not present');
      }
    });

    const count = this.arena.getWaitingPlayerCount();
    this.uiTexts.status.setText(`Status: ${count} waiting`);
    this.uiTexts.countdown.setText(`Countdown: ${this.arena.getCurrentCountdown()}`);
  }
}
