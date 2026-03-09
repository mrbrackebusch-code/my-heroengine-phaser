import Phaser from 'phaser';
import { ArenaEntrance } from './arenaEntrance';
import { CombatArenaFloor } from './combatArenaFloor';
import { getLocalArenaIdentity, type LocalArenaIdentity } from './arenaLocalPlayer';

export class ArenaJoinButton {
  private scene: Phaser.Scene;
  private entrance: ArenaEntrance;
  private combatArena: CombatArenaFloor;
  private buttonBg: Phaser.GameObjects.Rectangle | null = null;
  private buttonText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private clickZone: Phaser.GameObjects.Zone | null = null;
  private updateHandler?: () => void;

  constructor(scene: Phaser.Scene, entrance: ArenaEntrance, combatArena: CombatArenaFloor) {
    this.scene = scene;
    this.entrance = entrance;
    this.combatArena = combatArena;
  }

  create(): void {
    const x = 88;
    const y = 50;
    const width = 104;
    const height = 30;

    this.buttonBg = this.scene.add.rectangle(x, y, width, height, 0x18181e, 0.95)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setScrollFactor(0)
      .setDepth(10002);

    this.buttonText = this.scene.add.text(x, y, '1v1', {
      color: '#d8ecff',
      fontSize: '12px',
      fontStyle: 'bold',
      fontFamily: 'monospace',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10003);

    this.statusText = this.scene.add.text(x, y + 22, '', {
      color: '#d1d5db',
      fontSize: '10px',
      fontFamily: 'monospace',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10003);

    this.clickZone = this.scene.add.zone(x, y, width, height)
      .setScrollFactor(0)
      .setDepth(10004)
      .setInteractive({ useHandCursor: true });

    this.clickZone.on('pointerdown', () => this.handleButtonClick());
    this.clickZone.on('pointerover', () => {
      this.buttonBg?.setFillStyle(0x24242e, 0.95);
      this.buttonBg?.setStrokeStyle(1, 0xffffff, 0.25);
    });
    this.clickZone.on('pointerout', () => {
      this.buttonBg?.setFillStyle(0x18181e, 0.95);
      this.buttonBg?.setStrokeStyle(1, 0xffffff, 0.25);
    });

    this.updateHandler = () => this.refreshStatus();
    this.scene.events.on('update', this.updateHandler);
    this.refreshStatus();
  }

  destroy(): void {
    if (this.updateHandler) {
      this.scene.events.off('update', this.updateHandler);
      this.updateHandler = undefined;
    }

    if (this.buttonBg) this.buttonBg.destroy();
    if (this.buttonText) this.buttonText.destroy();
    if (this.statusText) this.statusText.destroy();
    if (this.clickZone) this.clickZone.destroy();

    this.buttonBg = null;
    this.buttonText = null;
    this.statusText = null;
    this.clickZone = null;
  }

  private refreshStatus(): void {
    if (!this.statusText) return;

    const identity = this.getLocalIdentity();
    if (!identity) {
      this.statusText.setText('Waiting for local player connection...');
      return;
    }

    const inEntrance = !!this.entrance.getPlayer(identity.playerId);
    const inArena = !!this.combatArena.getPlayer(identity.playerId);

    if (inArena) {
      this.statusText.setText(`${identity.displayName} is in arena`);
      return;
    }

    if (inEntrance) {
      this.statusText.setText(`${identity.displayName} is in waiting lobby`);
      return;
    }

    this.statusText.setText(`Ready to join lobby: ${identity.displayName}`);
  }

  private handleButtonClick(): void {
    this.joinLocalPlayer();
    this.closeArenaLiveTestOverlay();
  }

  private closeArenaLiveTestOverlay(): void {
    const anyScene = this.scene as any;
    const overlay = anyScene.__danielArenaOverlay as { togglePanelVisibility?: () => void } | undefined;
    if (!overlay) return;

    overlay.togglePanelVisibility?.();
  }

  private joinLocalPlayer(): void {
    const identity = this.getLocalIdentity();
    if (!identity) return;

    const existingArenaPlayer = this.combatArena.getPlayer(identity.playerId);
    if (existingArenaPlayer) {
      this.refreshStatus();
      return;
    }

    const existingEntrancePlayer = this.entrance.getPlayer(identity.playerId);
    if (!existingEntrancePlayer) {
      this.entrance.playerArrivesAtEntrance(identity.playerId, identity.displayName);
    }

    // Join waiting lobby first; combat arena entry should happen only when match flow starts.
    this.entrance.playerEntersArena(identity.playerId);
    this.refreshStatus();
  }

  private getLocalIdentity(): LocalArenaIdentity | null {
    return getLocalArenaIdentity();
  }
}
