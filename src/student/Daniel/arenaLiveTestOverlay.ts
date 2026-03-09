import Phaser from 'phaser';
import { CombatArenaFloor } from './combatArenaFloor';
import { ArenaEntrance } from './arenaEntrance';
import { PostCombatManager } from './postCombatManager';
import { getArenaSpawnPoint, getLocalArenaIdentity } from './arenaLocalPlayer';

type Mode = '1v1' | '2v2' | 'none';
const ARENA_OVERLAY_DEPTH = 2000000000;
const OVERLAY_WIDTH = 360;
const OVERLAY_HEIGHT = 304;
const READY_FLAG_UI_SEL = 1000000;
const ACTION_SEQ_MOD = 100000;
const ACTION_SEQ_MULT = 100;

const ACTION_CODE_BY_LABEL: Record<string, number> = {
  'Setup 1v1': 1,
  'Setup 2v2': 2,
  'Ready': 3,
  'Start Combat': 4,
  'End Game?': 5,
  'Reset': 6,
  'Vote Rematch All': 7,
  'Vote Exit All': 8,
  'Team Change All': 9,
  'Selectors Pick': 10,
  'Start Countdown (auto)': 11,
  'All Ready -> Countdown': 12,
};

const ACTION_LABEL_BY_CODE: Record<number, string> = Object.keys(ACTION_CODE_BY_LABEL)
  .reduce((acc, label) => {
    acc[ACTION_CODE_BY_LABEL[label]] = label;
    return acc;
  }, {} as Record<number, string>);

export class ArenaLiveTestOverlay {
  private scene: Phaser.Scene;
  private combatArena: CombatArenaFloor;
  private entrance: ArenaEntrance;
  private postCombat: PostCombatManager;
  private root: Phaser.GameObjects.Container | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private currentMode: Mode = 'none';
  private currentSessionId: string | null = null;
  private updateHandler?: () => void;
  private manuallyHidden: boolean = false;
  private voteRematchButton: Phaser.GameObjects.Text | null = null;
  private voteExitButton: Phaser.GameObjects.Text | null = null;
  private teamChangeButton: Phaser.GameObjects.Text | null = null;
  private selectorsButton: Phaser.GameObjects.Text | null = null;
  private readyButton: Phaser.GameObjects.Text | null = null;
  private endCombatButton: Phaser.GameObjects.Text | null = null;
  private lastActionLine: string = 'Last action: none';
  private latestSyncedMarkers: Array<{ pid: number; ready: boolean; actionCode: number; seq: number }> = [];
  private lastAppliedGlobalModeSeq: number = -1;
  private lastAppliedGlobalModeAction: number = 0;

  constructor(
    scene: Phaser.Scene,
    combatArena: CombatArenaFloor,
    entrance: ArenaEntrance,
    postCombat: PostCombatManager
  ) {
    this.scene = scene;
    this.combatArena = combatArena;
    this.entrance = entrance;
    this.postCombat = postCombat;
  }

  create(): void {
    const panel = this.scene.add.rectangle(OVERLAY_WIDTH / 2, OVERLAY_HEIGHT / 2, OVERLAY_WIDTH, OVERLAY_HEIGHT, 0x000000, 0.82)
      .setStrokeStyle(2, 0x6b7280)
      .setScrollFactor(0)
      .setDepth(ARENA_OVERLAY_DEPTH);

    const title = this.scene.add.text(OVERLAY_WIDTH / 2, 16, '1v1 combats', {
      color: '#ffffff',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(ARENA_OVERLAY_DEPTH + 1);

    this.statusText = this.scene.add.text(20, 36, '', {
      color: '#e5e7eb',
      fontSize: '10px',
      wordWrap: { width: OVERLAY_WIDTH - 40 },
    }).setScrollFactor(0).setDepth(ARENA_OVERLAY_DEPTH + 1);

    const leftX = 20;
    const rightX = 190;
    const row1 = 130;
    const row2 = 160;
    const row3 = 190;
    const row4 = 220;
    const row5 = 250;

    const setupLabel = this.scene.add.text(20, 114, 'Setup', {
      color: '#9ca3af',
      fontSize: '10px',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(ARENA_OVERLAY_DEPTH + 1);

    const postLabel = this.scene.add.text(20, 234, 'Post-Combat', {
      color: '#9ca3af',
      fontSize: '10px',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(ARENA_OVERLAY_DEPTH + 1);

    const buttons: Phaser.GameObjects.Text[] = [];
    buttons.push(this.createButton('Setup 1v1', leftX, row1, () => this.setupMode('1v1')));
    buttons.push(this.createButton('Setup 2v2', rightX, row1, () => this.setupMode('2v2')));

    this.readyButton = this.createButton('Ready', leftX, row2, () => this.readyLocalPlayer());
    buttons.push(this.readyButton);
    buttons.push(this.createButton('Start Combat', rightX, row2, () => this.startCombat()));

    this.endCombatButton = this.createButton('End Game?', leftX, row3, () => this.endCombat());
    buttons.push(this.endCombatButton);
    buttons.push(this.createButton('Reset', rightX, row3, () => this.resetAll()));

    this.voteRematchButton = this.createButton('Vote Rematch All', leftX, row4, () => this.voteRematchAll());
    buttons.push(this.voteRematchButton);
    this.voteExitButton = this.createButton('Vote Exit All', rightX, row4, () => this.voteExitAll());
    buttons.push(this.voteExitButton);

    this.teamChangeButton = this.createButton('Team Change All', leftX, row5, () => this.voteTeamChangeAll());
    buttons.push(this.teamChangeButton);
    this.selectorsButton = this.createButton('Selectors Pick', rightX, row5, () => this.selectorsPick());
    buttons.push(this.selectorsButton);

    this.root = this.scene.add.container(0, 0, [panel, title, this.statusText, setupLabel, postLabel, ...buttons])
      .setScrollFactor(0)
      .setDepth(ARENA_OVERLAY_DEPTH);

    this.centerOverlay();

    this.updateHandler = () => this.updateStatus();
    this.scene.events.on('update', this.updateHandler);

    this.updateStatus();
  }

  destroy(): void {
    if (this.updateHandler) {
      this.scene.events.off('update', this.updateHandler);
      this.updateHandler = undefined;
    }

    if (this.root) {
      this.root.destroy(true);
      this.root = null;
    }
  }

  private isInArenaContext(): boolean {
    const hasArenaPlayers = this.combatArena.getPlayerCount() > 0;
    const hasWaitingPlayers = this.entrance.getWaitingPlayerCount() > 0;
    const hasActiveCombat = this.combatArena.getActiveCombats().length > 0;
    const hasPostSession = !!this.getCurrentSession();

    return hasArenaPlayers || hasWaitingPlayers || hasActiveCombat || hasPostSession;
  }

  private createButton(label: string, x: number, y: number, onClick: () => void): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, label, {
      color: '#f9fafb',
      backgroundColor: '#111827',
      fontSize: '12px',
      align: 'center',
      padding: { left: 7, right: 7, top: 5, bottom: 5 },
    })
      .setFixedSize(150, 24)
      .setScrollFactor(0)
      .setDepth(ARENA_OVERLAY_DEPTH + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (label === 'Ready' && !this.isModeOfficiallySelected()) {
          this.lastActionLine = 'Last action: Ready blocked (select mode first)';
          this.updateStatus();
          return;
        }
        if (label === 'End Game?' && this.combatArena.getActiveCombats().length <= 0) {
          this.lastActionLine = 'Last action: End Game? blocked (no active combat)';
          this.updateStatus();
          return;
        }
        const actionCode = ACTION_CODE_BY_LABEL[label] || 0;
        const readyOverride = label === 'Ready' ? true : (label === 'Start Combat' || label === 'Reset' ? false : undefined);
        this.markLastAction(label);
        this.sendSyncedUiMarker(actionCode, readyOverride);
        onClick();
        this.updateStatus();
      });
  }

  private markLastAction(actionLabel: string): void {
    const local = getLocalArenaIdentity();
    const who = local?.displayName || 'Unknown';
    this.lastActionLine = `Last action: ${who} -> ${actionLabel}`;
  }

  private isModeOfficiallySelected(): boolean {
    return this.currentMode === '1v1' || this.currentMode === '2v2';
  }

  private setupMode(mode: Mode): void {
    const actionCode = mode === '1v1'
      ? (ACTION_CODE_BY_LABEL['Setup 1v1'] || 0)
      : (ACTION_CODE_BY_LABEL['Setup 2v2'] || 0);

    const marker = this.sendGlobalModeMarker(actionCode);
    const decoded = this.decodeUiSelMarker(marker);
    this.lastAppliedGlobalModeSeq = decoded.seq;
    this.lastAppliedGlobalModeAction = actionCode;

    this.applyModeSetup(mode);
  }

  private readyLocalPlayer(): void {
    if (!this.isModeOfficiallySelected()) return;

    const local = getLocalArenaIdentity();
    if (!local) return;

    this.entrance.playerReady(local.playerId);
  }

  private buildUiSelMarker(actionCode: number, isReady: boolean): number {
    const seq = Date.now() % ACTION_SEQ_MOD;
    const act = Math.max(0, Math.min(99, actionCode | 0));
    const packed = ((seq | 0) * ACTION_SEQ_MULT) + act;
    return (isReady ? READY_FLAG_UI_SEL : 0) + packed;
  }

  private decodeUiSelMarker(rawUiSel: number): { ready: boolean; actionCode: number; seq: number } {
    const value = Math.max(0, rawUiSel | 0);
    const ready = value >= READY_FLAG_UI_SEL;
    const compact = ready ? (value - READY_FLAG_UI_SEL) : value;
    const actionCode = Math.max(0, compact % ACTION_SEQ_MULT);
    const seq = Math.max(0, Math.floor(compact / ACTION_SEQ_MULT)) % ACTION_SEQ_MOD;
    return { ready, actionCode, seq };
  }

  private sendSyncedUiMarker(actionCode: number, readyOverride?: boolean): void {
    const g: any = globalThis as any;
    const net: any = g.__net;
    const local = getLocalArenaIdentity();
    if (!net || typeof net.sendUiCommand !== 'function' || !local) return;

    const localPlayer = this.entrance.getPlayer(local.playerId);
    const isReady = typeof readyOverride === 'boolean' ? readyOverride : !!localPlayer?.isReady;
    const marker = this.buildUiSelMarker(actionCode, isReady);

    try {
      net.sendUiCommand({ type: 'setSel', playerId: local.netPid | 0, sel: marker });
    } catch {
      // no-op
    }
  }

  private getModeAuthorityPid(): number {
    const g: any = globalThis as any;
    const names = (g.__playerNames && typeof g.__playerNames === 'object') ? g.__playerNames as Record<string, string> : {};
    const profileByPid = (g.__netProfileByPid && typeof g.__netProfileByPid === 'object') ? g.__netProfileByPid as Record<string, string> : {};

    const pidSet = new Set<number>();
    Object.keys(names).forEach((k) => pidSet.add(Number(k) | 0));
    Object.keys(profileByPid).forEach((k) => pidSet.add(Number(k) | 0));
    this.latestSyncedMarkers.forEach((m) => pidSet.add(m.pid | 0));

    const local = getLocalArenaIdentity();
    if (local?.netPid) pidSet.add(local.netPid | 0);

    const pids = Array.from(pidSet.values()).filter((pid) => pid > 0).sort((a, b) => a - b);
    return pids[0] || (local?.netPid || 0);
  }

  private sendGlobalModeMarker(actionCode: number): number {
    const g: any = globalThis as any;
    const net: any = g.__net;
    if (!net || typeof net.sendUiCommand !== 'function') return 0;

    const authorityPid = this.getModeAuthorityPid();
    if (authorityPid <= 0) return 0;

    const authorityReady = this.latestSyncedMarkers.find((m) => (m.pid | 0) === (authorityPid | 0))?.ready || false;
    const marker = this.buildUiSelMarker(actionCode, authorityReady);

    try {
      net.sendUiCommand({ type: 'setSel', playerId: authorityPid | 0, sel: marker });
    } catch {
      // no-op
    }

    return marker;
  }

  private applyGlobalModeFromMarkers(markers: Array<{ pid: number; ready: boolean; actionCode: number; seq: number }>): void {
    const authorityPid = this.getModeAuthorityPid();
    if (authorityPid <= 0) return;

    const marker = markers.find((m) => (m.pid | 0) === (authorityPid | 0));
    if (!marker) return;

    const actionCode = marker.actionCode | 0;
    const isModeAction = actionCode === (ACTION_CODE_BY_LABEL['Setup 1v1'] || 0)
      || actionCode === (ACTION_CODE_BY_LABEL['Setup 2v2'] || 0)
      || actionCode === (ACTION_CODE_BY_LABEL['Reset'] || 0);
    if (!isModeAction) return;

    if (this.lastAppliedGlobalModeSeq === marker.seq && this.lastAppliedGlobalModeAction === actionCode) {
      return;
    }

    this.lastAppliedGlobalModeSeq = marker.seq;
    this.lastAppliedGlobalModeAction = actionCode;

    if (actionCode === (ACTION_CODE_BY_LABEL['Setup 1v1'] || 0)) {
      this.applyModeSetup('1v1');
    } else if (actionCode === (ACTION_CODE_BY_LABEL['Setup 2v2'] || 0)) {
      this.applyModeSetup('2v2');
    } else if (actionCode === (ACTION_CODE_BY_LABEL['Reset'] || 0)) {
      this.clearArenaState(false);
    }
  }

  private getPlayersForMode(mode: Mode): Array<{ id: string; name: string }> {
    const needed = mode === '2v2' ? 4 : 2;
    const g: any = globalThis as any;
    const namesByPid = (g.__playerNames && typeof g.__playerNames === 'object') ? g.__playerNames as Record<string, string> : {};

    const networkPlayers = Object.keys(namesByPid)
      .map((k) => ({ pid: Number(k) | 0, name: String(namesByPid[k] || '').trim() }))
      .filter((p) => p.pid > 0)
      .sort((a, b) => a.pid - b.pid)
      .slice(0, needed)
      .map((p) => ({ id: `net_${p.pid}`, name: p.name || `Player ${p.pid}` }));

    if (networkPlayers.length >= needed) return networkPlayers;

    const local = getLocalArenaIdentity();
    const basePlayers = mode === '1v1'
      ? [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' },
        ]
      : [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' },
          { id: 'p3', name: 'Player 3' },
          { id: 'p4', name: 'Player 4' },
        ];

    if (!local) return basePlayers;

    const localId = local.netPid > 0 ? `net_${local.netPid}` : local.playerId;
    return [{ id: localId, name: local.displayName }, ...basePlayers.slice(1)];
  }

  private applyModeSetup(mode: Mode): void {
    this.clearArenaState(false);
    this.currentMode = mode;

    const players = this.getPlayersForMode(mode);
    players.forEach((p, index) => {
      const spawn = getArenaSpawnPoint(this.scene, index + 1);
      this.entrance.playerArrivesAtEntrance(p.id, p.name);
      this.entrance.playerEntersArena(p.id);
      this.combatArena.playerEnterArena(p.id, p.name, spawn.x, spawn.y);
    });
  }

  private clearArenaState(syncMarker: boolean): void {
    if (syncMarker) {
      this.markLastAction('Reset');
      this.sendSyncedUiMarker(0, false);
    }

    const session = this.getCurrentSession();
    if (session) {
      this.postCombat.cancelSession(session.sessionId);
    }
    this.currentSessionId = null;

    this.entrance.reset();

    const players = this.combatArena.getPlayersInArena();
    players.forEach((p) => this.combatArena.playerLeaveArena(p.playerId));

    this.currentMode = 'none';
  }

  private parsePidFromArenaPlayerId(playerId: string): number {
    const s = String(playerId || '');
    if (s.startsWith('net_')) {
      const raw = Number(s.slice(4));
      return Number.isFinite(raw) ? (raw | 0) : 0;
    }

    if (s.startsWith('p')) {
      const raw = Number(s.slice(1));
      return Number.isFinite(raw) ? (raw | 0) : 0;
    }

    const raw = Number(s);
    return Number.isFinite(raw) ? (raw | 0) : 0;
  }

  private getSyncedMarkersFromSprites(): Array<{ pid: number; ready: boolean; actionCode: number; seq: number }> {
    const out: Array<{ pid: number; ready: boolean; actionCode: number; seq: number }> = [];
    const g: any = globalThis as any;
    const spritesNs: any = g.sprites;
    if (!spritesNs || typeof spritesNs.allSprites !== 'function') return out;

    const allSprites: any[] = spritesNs.allSprites();
    if (!Array.isArray(allSprites)) return out;

    for (const sprite of allSprites) {
      if (!sprite) continue;

      let owner = 0;
      let uiSel = 0;
      try {
        owner = spritesNs.readDataNumber(sprite, 'owner') | 0;
        uiSel = spritesNs.readDataNumber(sprite, 'uiSel') | 0;
      } catch {
        owner = 0;
        uiSel = 0;
      }

      if (owner > 0) {
        const decoded = this.decodeUiSelMarker(uiSel);
        out.push({ pid: owner, ...decoded });
      }
    }

    return out;
  }

  private getLatestMarkersByPid(markers?: Array<{ pid: number; ready: boolean; actionCode: number; seq: number }>): Array<{ pid: number; ready: boolean; actionCode: number; seq: number }> {
    const source = Array.isArray(markers) ? markers : this.latestSyncedMarkers;
    const latestByPid = new Map<number, { pid: number; ready: boolean; actionCode: number; seq: number }>();

    source.forEach((m) => {
      const pid = m.pid | 0;
      if (pid <= 0) return;
      const prev = latestByPid.get(pid);
      if (!prev || (m.seq | 0) >= (prev.seq | 0)) {
        latestByPid.set(pid, { pid, ready: !!m.ready, actionCode: m.actionCode | 0, seq: m.seq | 0 });
      }
    });

    return Array.from(latestByPid.values()).sort((a, b) => a.pid - b.pid);
  }

  private buildPlayersLine(): string {
    const g: any = globalThis as any;
    const namesByPid = (g.__playerNames && typeof g.__playerNames === 'object') ? g.__playerNames as Record<string, string> : {};
    const profileByPid = (g.__netProfileByPid && typeof g.__netProfileByPid === 'object') ? g.__netProfileByPid as Record<string, string> : {};
    const markerPids = this.latestSyncedMarkers.map((m) => m.pid);

    const pidSet = new Set<number>();
    Object.keys(namesByPid).forEach((k) => pidSet.add(Number(k) | 0));
    Object.keys(profileByPid).forEach((k) => pidSet.add(Number(k) | 0));
    markerPids.forEach((pid) => pidSet.add(pid | 0));

    const pids = Array.from(pidSet.values()).filter((pid) => pid > 0).sort((a, b) => a - b);
    if (pids.length === 0) return 'Players (0): none';

    const preview = pids
      .map((pid) => {
        const name = (namesByPid[String(pid)] || `P${pid}`).trim() || `P${pid}`;
        return `${name}#${pid}`;
      })
      .slice(0, 3);

    const more = pids.length > 3 ? ` +${pids.length - 3} more` : '';

    return `Players (${pids.length}): ${preview.join(', ')}${more}`;
  }

  private buildProfilesLine(): string {
    const g: any = globalThis as any;
    const connected = (g.__netProfileConnected && typeof g.__netProfileConnected === 'object')
      ? g.__netProfileConnected as Record<string, boolean>
      : {};

    const profiles = Object.keys(connected).filter((p) => connected[p]);
    if (profiles.length === 0) return 'Profiles (0): none';
    const preview = profiles.slice(0, 3);
    const more = profiles.length > 3 ? ` +${profiles.length - 3} more` : '';
    return `Profiles (${profiles.length}): ${preview.join(', ')}${more}`;
  }

  private buildNetReadyLine(): string {
    const readyPids = this.getLatestMarkersByPid()
      .filter((m) => m.ready)
      .map((m) => m.pid)
      .sort((a, b) => a - b);

    if (readyPids.length === 0) return 'Net Ready (0): none';
    const names = readyPids.map((pid) => this.getDisplayNameForPid(pid)).slice(0, 3);
    const more = readyPids.length > 3 ? ` +${readyPids.length - 3} more` : '';
    return `Net Ready (${readyPids.length}): ${names.join(', ')}${more}`;
  }

  private getDisplayNameForPid(pid: number): string {
    const waiting = this.entrance.getPlayersWaiting();
    for (const p of waiting) {
      if (this.parsePidFromArenaPlayerId(p.playerId) === pid) {
        return p.displayName;
      }
    }

    const g: any = globalThis as any;
    const names = g.__playerNames as Record<string, string> | undefined;
    const fromMap = names ? names[String(pid)] : '';
    if (typeof fromMap === 'string' && fromMap.trim()) return fromMap.trim();
    return `Player ${pid}`;
  }

  private syncReadyStatesFromNetworkMarker(): void {
    if (this.combatArena.getActiveCombats().length > 0) return;
    if (this.getCurrentSession()) return;

    const synced = this.getSyncedMarkersFromSprites();
    this.latestSyncedMarkers = synced;
    this.applyGlobalModeFromMarkers(synced);

    const waitingPlayers = this.entrance.getPlayersWaiting();
    const latestPerPid = this.getLatestMarkersByPid(synced);
    const readyPidSet = new Set<number>();
    let latestAction: { pid: number; actionCode: number; seq: number } | null = null;

    latestPerPid.forEach((m) => {
      if (m.ready) readyPidSet.add(m.pid);
      if (m.actionCode > 0) {
        if (!latestAction || m.seq > latestAction.seq) {
          latestAction = { pid: m.pid, actionCode: m.actionCode, seq: m.seq };
        }
      }
    });

    if (waitingPlayers.length > 0) {
      waitingPlayers.forEach((p) => {
        const pid = this.parsePidFromArenaPlayerId(p.playerId);
        if (pid <= 0) return;
        const shouldBeReady = readyPidSet.has(pid);
        this.entrance.setPlayerReadyState(p.playerId, shouldBeReady, {
          silent: true,
          triggerAllReadyCallback: true,
        });
      });
    }

    if (latestAction) {
      const label = ACTION_LABEL_BY_CODE[latestAction.actionCode] || 'Action';
      const who = this.getDisplayNameForPid(latestAction.pid);
      this.lastActionLine = `Last action: ${who} -> ${label}`;
    }
  }

  private startCountdown(): void {
    this.markLastAction('Start Countdown (auto)');
    this.sendSyncedUiMarker(ACTION_CODE_BY_LABEL['Start Countdown (auto)'] || 0);
    this.entrance.startCountdown((count) => {
      this.updateStatus();
      if (count <= 0) {
        this.startCombat();
      }
    });
  }

  onAllPlayersReady(): void {
    if (this.entrance.areAllPlayersReady() && !this.entrance.isCountdownActive()) {
      this.markLastAction('All Ready -> Countdown');
      this.sendSyncedUiMarker(ACTION_CODE_BY_LABEL['All Ready -> Countdown'] || 0);
      this.startCountdown();
    }
  }

  private startCombat(): void {
    this.sendSyncedUiMarker(0, false);

    const available = this.combatArena.getAvailablePlayers();
    if (this.currentMode === '1v1' && available.length >= 2) {
      this.combatArena.start1v1(available[0].playerId, available[1].playerId);
      return;
    }

    if (this.currentMode === '2v2' && available.length >= 4) {
      this.combatArena.start2v2(
        available[0].playerId,
        available[1].playerId,
        available[2].playerId,
        available[3].playerId
      );
    }
  }

  private endCombat(): void {
    const combats = this.combatArena.getActiveCombats();
    combats.forEach((combat) => {
      const allPlayers = [...combat.team1, ...combat.team2];
      if (allPlayers.length > 0) {
        this.combatArena.endCombat(allPlayers[0]);
      }
    });

    const players = this.combatArena.getPlayersInArena();
    if (players.length === 0) return;

    const playerIds = players.map((p) => p.playerId);
    const playerNames = new Map<string, string>();
    players.forEach((p) => playerNames.set(p.playerId, p.displayName));

    const session = this.postCombat.startPostCombatSession(
      this.currentMode === '2v2' ? '2v2' : '1v1',
      playerIds,
      playerNames
    );
    this.currentSessionId = session.sessionId;
  }

  private voteRematchAll(): void {
    const session = this.getCurrentSession();
    if (!session) return;

    Array.from(session.players.keys()).forEach((playerId) => {
      this.postCombat.playerVotesRematch(session.sessionId, playerId);
    });

    if (!this.postCombat.getSession(session.sessionId)) {
      this.startCombat();
      this.currentSessionId = null;
    }
  }

  private voteExitAll(): void {
    const session = this.getCurrentSession();
    if (!session) return;

    Array.from(session.players.keys()).forEach((playerId) => {
      this.postCombat.playerVotesExit(session.sessionId, playerId);
    });

    if (!this.postCombat.getSession(session.sessionId)) {
      this.currentSessionId = null;
      this.resetAll();
    }
  }

  private voteTeamChangeAll(): void {
    const session = this.getCurrentSession();
    if (!session || session.combatType !== '2v2') return;

    Array.from(session.players.keys()).forEach((playerId) => {
      this.postCombat.playerVotesTeamChange(session.sessionId, playerId);
    });
  }

  private selectorsPick(): void {
    const session = this.getCurrentSession();
    if (!session || !session.teamChangeMode) return;

    const selectors = this.postCombat.getTeamSelectors(session.sessionId);
    selectors.forEach((selectorId) => {
      const available = this.postCombat.getAvailableTeammates(session.sessionId, selectorId);
      const first = Array.from(available.keys())[0];
      if (first) {
        this.postCombat.selectNewTeammate(session.sessionId, selectorId, first);
      }
    });

    if (!this.postCombat.getSession(session.sessionId)) {
      this.currentSessionId = null;
      this.startCombat();
    }
  }

  private resetAll(): void {
    this.clearArenaState(true);
  }

  private getCurrentSession() {
    if (!this.currentSessionId) return null;
    return this.postCombat.getSession(this.currentSessionId);
  }

  private updateStatus(): void {
    if (!this.statusText || !this.root) return;

    this.centerOverlay();
    this.syncReadyStatesFromNetworkMarker();

    if (this.manuallyHidden) {
      this.root.setVisible(false);
      return;
    }

    const showOverlay = this.isInArenaContext();
    this.root.setVisible(showOverlay);
    if (!showOverlay) return;

    const waiting = this.entrance.getWaitingPlayerCount();
    const readyLocal = this.entrance.getPlayersWaiting().filter((p) => p.isReady).length;
    const readyNet = this.getLatestMarkersByPid().filter((m) => m.ready).length;
    const ready = Math.max(readyLocal, readyNet);
    const mode = this.combatArena.getCombatMode();
    const activeCombats = this.combatArena.getActiveCombats().length;
    const countdown = this.entrance.getCurrentCountdown();
    const session = this.getCurrentSession();
    const selectors = session ? this.postCombat.getTeamSelectors(session.sessionId) : [];
    const showPostCombatVotes = !!session;
    const isPostCombat2v2 = !!session && session.combatType === '2v2';
    const hasActiveCombat = activeCombats > 0;

    if (this.latestSyncedMarkers.length === 0) {
      this.latestSyncedMarkers = this.getSyncedMarkersFromSprites();
    }

    if (this.voteRematchButton) this.voteRematchButton.setVisible(showPostCombatVotes);
    if (this.voteExitButton) this.voteExitButton.setVisible(showPostCombatVotes);
    if (this.teamChangeButton) this.teamChangeButton.setVisible(isPostCombat2v2);
    if (this.selectorsButton) this.selectorsButton.setVisible(isPostCombat2v2);
    if (this.readyButton) this.readyButton.setAlpha(this.isModeOfficiallySelected() ? 1 : 0.5);
    if (this.endCombatButton) this.endCombatButton.setVisible(hasActiveCombat);

    this.statusText.setText(
      [
        `Mode: ${this.currentMode} | Arena: ${mode}`,
        `Lobby: waiting ${waiting}, ready ${ready}, countdown ${countdown}`,
        `Combat: active ${activeCombats} | Post: ${session ? session.combatType : 'none'}${session?.teamChangeMode ? ' (team change)' : ''}`,
        `Selectors: ${selectors.join(', ') || 'none'}`,
        this.buildPlayersLine(),
        this.buildProfilesLine(),
        this.buildNetReadyLine(),
        this.lastActionLine,
      ].join('\n')
    );
  }

  private centerOverlay(): void {
    if (!this.root) return;

    const cam = this.scene.cameras.main;
    const centerX = cam ? cam.centerX : (this.scene.scale.width * 0.5);
    const centerY = cam ? cam.centerY : (this.scene.scale.height * 0.5);

    this.root.setPosition(
      Math.floor(centerX - (OVERLAY_WIDTH / 2)),
      Math.floor(centerY - (OVERLAY_HEIGHT / 2))
    );
    this.root.setDepth(ARENA_OVERLAY_DEPTH);
    this.scene.children.bringToTop(this.root);
  }

  hidePanel(): void {
    this.manuallyHidden = true;
    if (this.root) this.root.setVisible(false);
  }

  showPanel(): void {
    this.manuallyHidden = false;
    this.updateStatus();
  }

  togglePanelVisibility(): void {
    if (this.manuallyHidden) this.showPanel();
    else this.hidePanel();
  }
}
