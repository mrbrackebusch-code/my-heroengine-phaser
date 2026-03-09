/**
 * Arena Door System
 * Renders a clickable door in the game world that leads to the combat arena
 */

import Phaser from 'phaser';
import { ArenaEntrance } from './arenaEntrance';

export class ArenaDoor {
  private doorX: number = 400;
  private doorY: number = 200;
  private doorWidth: number = 80;
  private doorHeight: number = 120;
  private doorGraphics: Phaser.GameObjects.Rectangle | null = null;
  private doorText: Phaser.GameObjects.Text | null = null;
  private arena: ArenaEntrance;
  private scene: Phaser.Scene;
  private clickZone: Phaser.GameObjects.Zone | null = null;

  constructor(
    scene: Phaser.Scene,
    arena: ArenaEntrance,
    posX: number = 400,
    posY: number = 200
  ) {
    this.scene = scene;
    this.arena = arena;
    this.doorX = posX;
    this.doorY = posY;
  }

  /**
   * Create the door visuals and interact zone in the scene
   */
  create(): void {
    // Draw door rectangle
    this.doorGraphics = this.scene.add.rectangle(
      this.doorX,
      this.doorY,
      this.doorWidth,
      this.doorHeight,
      0x8B4513
    ).setStrokeStyle(3, 0xD2691E);

    // Add door label
    this.doorText = this.scene.add.text(
      this.doorX,
      this.doorY - 20,
      'Combat Area',
      { color: '#ffffff', fontSize: '16px', fontStyle: 'bold' }
    ).setOrigin(0.5);

    // Create clickable zone slightly larger than door
    this.clickZone = this.scene.add.zone(
      this.doorX,
      this.doorY,
      this.doorWidth + 20,
      this.doorHeight + 20
    ).setInteractive({ useHandCursor: true });

    this.clickZone.on('pointerdown', () => this.onDoorClick());
  }

  /**
   * Handle door click
   */
  private onDoorClick(): void {
    console.log('[DOOR] Player clicked on Combat Area door');
    // Log current entrance state
    const players = this.arena.getPlayersWaiting();
    const ready = this.arena.areAllPlayersReady();
    console.log(`[DOOR] ${players.length} players waiting, all ready: ${ready}`);
  }

  /**
   * Set door position
   */
  setPosition(x: number, y: number): void {
    this.doorX = x;
    this.doorY = y;
    if (this.doorGraphics) this.doorGraphics.setPosition(x, y);
    if (this.doorText) this.doorText.setPosition(x, y - 20);
    if (this.clickZone) this.clickZone.setPosition(x, y);
  }

  /**
   * Show/hide door
   */
  setVisible(visible: boolean): void {
    if (this.doorGraphics) this.doorGraphics.setVisible(visible);
    if (this.doorText) this.doorText.setVisible(visible);
  }

  /**
   * Destroy door
   */
  destroy(): void {
    if (this.doorGraphics) this.doorGraphics.destroy();
    if (this.doorText) this.doorText.destroy();
    if (this.clickZone) this.clickZone.destroy();
  }
}
