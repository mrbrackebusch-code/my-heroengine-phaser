import Phaser from 'phaser';

export type LocalArenaIdentity = {
  netPid: number;
  playerId: string;
  displayName: string;
};

type ArenaSpawnPoint = {
  x: number;
  y: number;
};

export const ARENA_FLOOR_COLUMN = 4;
export const ARENA_FLOOR_ROW = 15;
let lastArenaTransferAtMs = 0;

export function getLocalArenaIdentity(): LocalArenaIdentity | null {
  const g: any = globalThis as any;
  const net: any = g.__net;
  const pid = net && typeof net.playerId === 'number' ? (net.playerId | 0) : 0;
  if (pid <= 0) return null;

  const names = g.__playerNames as Record<string, string> | undefined;
  const rawName = names ? names[String(pid)] : '';
  const displayName = typeof rawName === 'string' && rawName.trim().length > 0
    ? rawName.trim()
    : `Player ${pid}`;

  return {
    netPid: pid,
    playerId: `net_${pid}`,
    displayName,
  };
}

function findLocalHeroSprite(netPid: number): any | null {
  const g: any = globalThis as any;
  const spritesNs: any = g.sprites;
  if (!spritesNs || typeof spritesNs.allSprites !== 'function') return null;

  const allSprites: any[] = spritesNs.allSprites();
  if (!Array.isArray(allSprites)) return null;

  for (const sprite of allSprites) {
    if (!sprite) continue;
    let owner = 0;
    try {
      owner = (spritesNs.readDataNumber(sprite, 'owner') | 0);
    } catch {
      owner = 0;
    }

    if (owner === netPid) {
      return sprite;
    }
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getArenaSpawnPoint(scene: Phaser.Scene, slotSeed: number): ArenaSpawnPoint {
  const worldBounds = scene?.physics?.world?.bounds;
  const left = worldBounds ? worldBounds.left : 0;
  const top = worldBounds ? worldBounds.top : 0;
  const width = worldBounds ? worldBounds.width : 1536;
  const height = worldBounds ? worldBounds.height : 864;

  const centerX = left + (width * 0.5);
  const centerY = top + (height * 0.5);

  const zoneRadiusX = Math.max(220, Math.floor(width * 0.24));
  const zoneRadiusY = Math.max(180, Math.floor(height * 0.24));
  const margin = 96;

  const slots = [
    { x: centerX - zoneRadiusX, y: centerY - zoneRadiusY },
    { x: centerX + zoneRadiusX, y: centerY - zoneRadiusY },
    { x: centerX - zoneRadiusX, y: centerY + zoneRadiusY },
    { x: centerX + zoneRadiusX, y: centerY + zoneRadiusY },
    { x: centerX, y: centerY - zoneRadiusY },
    { x: centerX, y: centerY + zoneRadiusY },
  ];

  const index = Math.abs(slotSeed | 0) % slots.length;
  const pick = slots[index];

  return {
    x: Math.floor(clamp(pick.x, left + margin, left + width - margin)),
    y: Math.floor(clamp(pick.y, top + margin, top + height - margin)),
  };
}

function getArenaTileWorldPosition(scene: Phaser.Scene, col: number, row: number): ArenaSpawnPoint {
  const g: any = globalThis as any;
  const internals: any = g.__HeroEnginePhaserInternals;
  const tileSize = internals && typeof internals.getWorldTileSize === 'function'
    ? Math.max(1, internals.getWorldTileSize() | 0)
    : 32;

  const worldBounds = scene?.physics?.world?.bounds;
  const left = worldBounds ? worldBounds.left : 0;
  const top = worldBounds ? worldBounds.top : 0;

  return {
    x: Math.floor(left + (col * tileSize) + Math.floor(tileSize / 2)),
    y: Math.floor(top + (row * tileSize) + Math.floor(tileSize / 2)),
  };
}

function tileOffsetsForPlayerSlot(slot: number): { dc: number; dr: number } {
  const offsets = [
    { dc: 0, dr: 0 },
    { dc: 10, dr: 0 },
    { dc: -10, dr: 0 },
    { dc: 0, dr: 8 },
    { dc: 0, dr: -8 },
    { dc: 6, dr: 6 },
    { dc: -6, dr: 6 },
    { dc: 6, dr: -6 },
    { dc: -6, dr: -6 },
  ];
  return offsets[Math.abs(slot | 0) % offsets.length];
}

function parsePidFromArenaPlayerId(playerId: string): number {
  const s = String(playerId || '');
  if (!s.startsWith('net_')) return 0;
  const pid = Number(s.slice(4));
  return Number.isFinite(pid) ? (pid | 0) : 0;
}

function findHeroSpriteByPid(netPid: number): any | null {
  const g: any = globalThis as any;
  const spritesNs: any = g.sprites;
  if (!spritesNs || typeof spritesNs.allSprites !== 'function') return null;

  const allSprites: any[] = spritesNs.allSprites();
  if (!Array.isArray(allSprites)) return null;

  for (const sprite of allSprites) {
    if (!sprite) continue;
    let owner = 0;
    try {
      owner = (spritesNs.readDataNumber(sprite, 'owner') | 0);
    } catch {
      owner = 0;
    }
    if (owner === netPid) return sprite;
  }

  return null;
}

function setHeroPosition(sprite: any, x: number, y: number): void {
  if (!sprite) return;
  if (typeof sprite.setPosition === 'function') {
    sprite.setPosition(x, y);
  } else {
    sprite.x = x;
    sprite.y = y;
  }
  if (typeof sprite.vx === 'number') sprite.vx = 0;
  if (typeof sprite.vy === 'number') sprite.vy = 0;
}

function spreadReadyPlayersOnArenaTiles(scene: Phaser.Scene, readyPlayerIds: string[]): void {
  const pids = readyPlayerIds
    .map((id) => parsePidFromArenaPlayerId(id))
    .filter((pid) => pid > 0)
    .sort((a, b) => a - b);

  pids.forEach((pid, index) => {
    const offset = tileOffsetsForPlayerSlot(index);
    const spawn = getArenaTileWorldPosition(
      scene,
      ARENA_FLOOR_COLUMN + offset.dc,
      ARENA_FLOOR_ROW + offset.dr
    );
    const sprite = findHeroSpriteByPid(pid);
    setHeroPosition(sprite, spawn.x, spawn.y);
  });
}

export function teleportLocalHeroToArenaTile(scene: Phaser.Scene, col: number, row: number): boolean {
  const identity = getLocalArenaIdentity();
  if (!identity) return false;

  const hero = findLocalHeroSprite(identity.netPid);
  if (!hero) return false;

  const target = getArenaTileWorldPosition(scene, col, row);

  setHeroPosition(hero, target.x, target.y);

  return true;
}

export function sendReadyPlayersToCombatArenaFloor(scene: Phaser.Scene, readyPlayerIds: string[]): boolean {
  const identity = getLocalArenaIdentity();
  if (!identity) return false;
  if (!readyPlayerIds.includes(identity.playerId)) return false;

  const now = Date.now();
  if ((now - lastArenaTransferAtMs) < 1500) {
    return false;
  }
  lastArenaTransferAtMs = now;

  const g: any = globalThis as any;
  const isHost = g.__isHost === true;

  // Keep arena fights on the current map so visuals remain the same and stable.
  // We only reposition players to the arena tile region.

  setTimeout(() => {
    if (isHost) {
      spreadReadyPlayersOnArenaTiles(scene, readyPlayerIds);
    }
    teleportLocalHeroToArenaTile(scene, ARENA_FLOOR_COLUMN, ARENA_FLOOR_ROW);
  }, 160);

  return true;
}

export function teleportLocalHeroToArena(scene: Phaser.Scene): boolean {
  return teleportLocalHeroToArenaTile(scene, ARENA_FLOOR_COLUMN, ARENA_FLOOR_ROW);
}
