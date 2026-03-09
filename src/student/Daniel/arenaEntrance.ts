/**
 * Arena Entrance System
 * Manages the entrance, waiting room, and countdown before combat
 */

export interface EntranceState {
  playerId: string;
  displayName: string;
  status: 'waiting' | 'ready' | 'countdown' | 'in_combat';
  isReady: boolean; // Explicit ready confirmation
  joinedAt: number;
}

export class ArenaEntrance {
  private entranceId: string = "daniel_arena_entrance";
  private waitingPlayers: Map<string, EntranceState> = new Map();
  private countdownActive: boolean = false;
  private countdownValue: number = 5;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private countdownCallback?: (count: number) => void;
  private allReadyCallback?: (playerIds: string[]) => void;

  constructor() {
    // Initialize entrance
  }

  /**
   * Player arrives at the entrance
   * Shows door and "Combat Area" sign
   */
  playerArrivesAtEntrance(playerId: string, displayName: string): EntranceState {
    const entrance: EntranceState = {
      playerId,
      displayName,
      status: 'waiting',
      isReady: false, // Players start as not ready
      joinedAt: Date.now(),
    };

    this.waitingPlayers.set(playerId, entrance);
    console.log(`[ENTRANCE] ${displayName} arrived at Combat Area entrance`);
    console.log(`[ENTRANCE] Door and "Combat Area" sign displayed`);

    return entrance;
  }

  /**
   * Player enters the arena (goes through the door)
   * Transitions from entrance to waiting in arena
   */
  playerEntersArena(playerId: string): EntranceState | null {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      console.log(`[ENTRANCE] Player not at entrance`);
      return null;
    }

    player.status = 'waiting';
    console.log(`[ENTRANCE] ${player.displayName} entered the arena - now waiting for others`);

    return { ...player };
  }

  /**
   * Player leaves the entrance/arena
   */
  playerLeavesEntrance(playerId: string): void {
    const player = this.waitingPlayers.get(playerId);
    if (!player) return;

    this.waitingPlayers.delete(playerId);
    
    // If countdown was active, stop it
    if (this.countdownActive && this.waitingPlayers.size < 2) {
      this.stopCountdown();
    }

    console.log(`[ENTRANCE] ${player.displayName} left the arena`);
  }

  /**
   * Player uses the EXIT DOOR to immediately leave the arena
   * Can be used anytime (waiting room, after combat, etc.)
   * Bypasses countdown and rematch logic
   */
  playerUsesExitDoor(playerId: string): void {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      console.log(`[ENTRANCE] Player not at entrance`);
      return;
    }

    console.log(`[ENTRANCE] ${player.displayName} used the EXIT DOOR - leaving arena immediately`);
    
    this.waitingPlayers.delete(playerId);
    
    // If countdown was active, stop it (other player(s) also affected)
    if (this.countdownActive && this.waitingPlayers.size < 2) {
      this.stopCountdown();
    }
  }

  /**
   * Get all players waiting at entrance/arena
   */
  getPlayersWaiting(): EntranceState[] {
    return Array.from(this.waitingPlayers.values());
  }

  /**
   * Get player count waiting
   */
  getWaitingPlayerCount(): number {
    return this.waitingPlayers.size;
  }

  /**
   * Check if enough players are ready to start (minimum 2 for 1v1)
   */
  canStartCombat(): boolean {
    return this.getWaitingPlayerCount() >= 2;
  }

  /**
   * Player confirms they are ready for combat.
   * Only when all players are ready can countdown start.
   */
  playerReady(playerId: string): boolean {
    return this.setPlayerReadyState(playerId, true, { silent: false, triggerAllReadyCallback: true });
  }

  /**
   * Player cancels their ready status.
   * If countdown is active, stop it.
   */
  playerNotReady(playerId: string): boolean {
    return this.setPlayerReadyState(playerId, false, { silent: false, triggerAllReadyCallback: false });
  }

  setPlayerReadyState(
    playerId: string,
    isReady: boolean,
    options?: { silent?: boolean; triggerAllReadyCallback?: boolean }
  ): boolean {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      if (!options?.silent) {
        console.log(`[ENTRANCE] Player not found`);
      }
      return false;
    }

    const nextReady = isReady === true;
    const wasReady = player.isReady === true;
    if (wasReady === nextReady) {
      return true;
    }

    const wasAllReady = this.areAllPlayersReady();

    player.isReady = nextReady;
    player.status = nextReady ? 'ready' : 'waiting';

    if (!options?.silent) {
      console.log(`[ENTRANCE] ${player.displayName} is ${nextReady ? 'READY' : 'NO LONGER ready'}`);
    }

    if (!nextReady && this.countdownActive) {
      this.stopCountdown();
    }

    const allowCallback = options?.triggerAllReadyCallback !== false;
    const nowAllReady = this.areAllPlayersReady();
    if (allowCallback && !wasAllReady && nowAllReady && this.allReadyCallback) {
      this.allReadyCallback(this.getPlayersWaiting().map((p) => p.playerId));
    }

    return true;
  }

  /**
   * Check if all players are ready (ready flag = true)
   * Countdown can ONLY start when this is true
   */
  areAllPlayersReady(): boolean {
    const players = this.getPlayersWaiting();
    return players.length >= 2 && players.every((p) => p.isReady);
  }

  /**
   * Start countdown (5 seconds before combat begins)
   * Calls the provided callback with countdown value (5, 4, 3, 2, 1, 0)
   */
  startCountdown(onCountdownTick?: (count: number) => void): boolean {
    if (!this.areAllPlayersReady()) {
      console.log(`[ENTRANCE] Cannot start countdown - not all players are ready`);
      console.log(`[ENTRANCE] Players must explicitly confirm readiness before countdown begins`);
      return false;
    }

    if (this.countdownActive) {
      console.log(`[ENTRANCE] Countdown already active`);
      return false;
    }

    this.countdownActive = true;
    this.countdownValue = 5;
    this.countdownCallback = onCountdownTick;

    console.log(`[ENTRANCE] ✓ ALL PLAYERS READY - Countdown starting: 5 seconds until combat begins`);

    // Update all waiting players to 'countdown' status
    this.waitingPlayers.forEach((p) => {
      p.status = 'countdown';
    });

    // Initial callback with 5
    if (this.countdownCallback) {
      this.countdownCallback(5);
    }

    // Countdown interval (1 second per count)
    this.countdownInterval = setInterval(() => {
      this.countdownValue--;

      console.log(`[ENTRANCE] Countdown: ${this.countdownValue}`);

      if (this.countdownCallback) {
        this.countdownCallback(this.countdownValue);
      }

      if (this.countdownValue <= 0) {
        this.finishCountdown();
      }
    }, 1000);

    return true;
  }

  /**
   * Stop countdown early (if a player leaves or backs out)
   */
  stopCountdown(): void {
    if (!this.countdownActive) return;

    console.log(`[ENTRANCE] Countdown stopped`);
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    this.countdownActive = false;
    this.countdownValue = 5;
    this.countdownCallback = undefined;

    // Reset players to waiting status and not ready
    this.waitingPlayers.forEach((p) => {
      p.status = 'waiting';
      p.isReady = false; // Reset ready flag when countdown stops
    });
  }

  /**
   * Internal: Finish countdown (trigger combat start)
   */
  private finishCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    console.log(`[ENTRANCE] Countdown finished - COMBAT BEGINS!`);

    // Update all players to 'in_combat' status
    this.waitingPlayers.forEach((p) => {
      p.isReady = false; // Reset ready flag after combat starts
      p.status = 'in_combat';
    });

    this.countdownActive = false;
  }

  /**
   * Get current countdown value (0 if not active)
   */
  getCurrentCountdown(): number {
    return this.countdownActive ? this.countdownValue : 0;
  }

  /**
   * Check if countdown is currently active
   */
  isCountdownActive(): boolean {
    return this.countdownActive;
  }

  /**
   * Get player data
   */
  getPlayer(playerId: string): EntranceState | null {
    return this.waitingPlayers.get(playerId) || null;
  }

  /**
   * Clear all players (reset entrance)
   */
  reset(): void {
    this.stopCountdown();
    this.waitingPlayers.clear();
    console.log(`[ENTRANCE] Entrance reset`);
  }

  setAllReadyCallback(callback: (playerIds: string[]) => void): void {
    this.allReadyCallback = callback;
  }
}
