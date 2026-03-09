// Simple Node.js simulation of src/student/Daniel/arenaEntrance.ts
class ArenaEntrance {
  constructor() {
    this.entranceId = "daniel_arena_entrance";
    this.waitingPlayers = new Map();
    this.countdownActive = false;
    this.countdownValue = 5;
    this.countdownInterval = null;
    this.countdownCallback = undefined;
  }

  playerArrivesAtEntrance(playerId, displayName) {
    const entrance = {
      playerId,
      displayName,
      status: 'waiting',
      isReady: false,
      joinedAt: Date.now(),
    };
    this.waitingPlayers.set(playerId, entrance);
    console.log(`[ENTRANCE] ${displayName} arrived at Combat Area entrance`);
    console.log(`[ENTRANCE] Door and "Combat Area" sign displayed`);
    return entrance;
  }

  playerEntersArena(playerId) {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      console.log(`[ENTRANCE] Player not at entrance`);
      return null;
    }
    player.status = 'waiting';
    console.log(`[ENTRANCE] ${player.displayName} entered the arena - now waiting for others`);
    return Object.assign({}, player);
  }

  playerLeavesEntrance(playerId) {
    const player = this.waitingPlayers.get(playerId);
    if (!player) return;
    this.waitingPlayers.delete(playerId);
    if (this.countdownActive && this.waitingPlayers.size < 2) {
      this.stopCountdown();
    }
    console.log(`[ENTRANCE] ${player.displayName} left the arena`);
  }

  getPlayersWaiting() {
    return Array.from(this.waitingPlayers.values());
  }

  getWaitingPlayerCount() {
    return this.waitingPlayers.size;
  }

  canStartCombat() {
    return this.getWaitingPlayerCount() >= 2;
  }

  playerReady(playerId) {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      console.log(`[ENTRANCE] Player not found`);
      return false;
    }
    player.isReady = true;
    player.status = 'ready';
    console.log(`[ENTRANCE] ${player.displayName} is READY`);
    return true;
  }

  playerNotReady(playerId) {
    const player = this.waitingPlayers.get(playerId);
    if (!player) {
      console.log(`[ENTRANCE] Player not found`);
      return false;
    }
    player.isReady = false;
    player.status = 'waiting';
    if (this.countdownActive) {
      this.stopCountdown();
    }
    console.log(`[ENTRANCE] ${player.displayName} is NO LONGER ready`);
    return true;
  }

  areAllPlayersReady() {
    const players = this.getPlayersWaiting();
    return players.length >= 2 && players.every((p) => p.isReady);
  }

  startCountdown(onCountdownTick) {
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

    this.waitingPlayers.forEach((p) => {
      p.status = 'countdown';
    });

    if (this.countdownCallback) {
      this.countdownCallback(5);
    }

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

  stopCountdown() {
    if (!this.countdownActive) return;
    console.log(`[ENTRANCE] Countdown stopped`);
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdownActive = false;
    this.countdownValue = 5;
    this.countdownCallback = undefined;
    this.waitingPlayers.forEach((p) => {
      p.status = 'waiting';
      p.isReady = false;
    });
  }

  finishCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    console.log(`[ENTRANCE] Countdown finished - COMBAT BEGINS!`);
    this.waitingPlayers.forEach((p) => {
      p.isReady = false;
      p.status = 'in_combat';
    });
    this.countdownActive = false;
  }

  getCurrentCountdown() {
    return this.countdownActive ? this.countdownValue : 0;
  }

  isCountdownActive() {
    return this.countdownActive;
  }

  getPlayer(playerId) {
    return this.waitingPlayers.get(playerId) || null;
  }

  reset() {
    this.stopCountdown();
    this.waitingPlayers.clear();
    console.log(`[ENTRANCE] Entrance reset`);
  }
}

// Simulation runner
(function runSimulation() {
  console.log('--- Arena Entrance Simulation Start ---');
  const arena = new ArenaEntrance();

  // Two players arrive
  arena.playerArrivesAtEntrance('p1', 'Alice');
  arena.playerArrivesAtEntrance('p2', 'Bob');

  // Both enter arena (keeps them waiting)
  arena.playerEntersArena('p1');
  arena.playerEntersArena('p2');

  // Both confirm ready
  setTimeout(() => arena.playerReady('p1'), 200);
  setTimeout(() => arena.playerReady('p2'), 400);

  // Start countdown after short delay to allow ready flags to set
  setTimeout(() => {
    arena.startCountdown((count) => {
      console.log(`[TICK CALLBACK] ${count}`);
    });
  }, 700);

  // Monitor for in_combat state and then print final states and exit
  const monitor = setInterval(() => {
    const players = arena.getPlayersWaiting();
    if (players.length > 0 && players.every(p => p.status === 'in_combat')) {
      console.log('--- Final Player States ---');
      players.forEach(p => console.log(JSON.stringify(p)));
      clearInterval(monitor);
      console.log('--- Simulation Complete ---');
      // give stdout a moment
      setTimeout(() => process.exit(0), 100);
    }
  }, 150);

  // Safety timeout
  setTimeout(() => {
    console.log('--- Simulation Timeout (forced exit) ---');
    process.exit(1);
  }, 15000);
})();
