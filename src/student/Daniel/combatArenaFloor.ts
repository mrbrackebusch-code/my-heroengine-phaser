    /**
 * Combat Arena System
 * A floor where players can enter and fight each other
 * Supports 1v1 (2 players) and 2v2 team matches (4+ players)
 */

export interface ArenaPlayer {
  playerId: string;
  displayName: string;
  posX: number;
  posY: number;
  isInCombat: boolean;
  teamId?: string; // For 2v2 matches
  partner?: string; // Partner ID for 2v2
  currentOpponents?: string[]; // IDs of opponents in active combat (1 for 1v1, 2 for 2v2)
}

export interface ArenaCombat {
  combatId: string;
  type: '1v1' | '2v2'; // Combat type
  team1: string[]; // Player IDs on team 1
  team2: string[]; // Player IDs on team 2
  startTime: number;
  isActive: boolean;
}

export class CombatArenaFloor {
  private arenaid: string = "daniel_combat_arena";
  private activePlayers: Map<string, ArenaPlayer> = new Map();
  private activeCombats: Map<string, ArenaCombat> = new Map();
  private combatCounter: number = 0;
  private teamCounter: number = 0;

  constructor() {
    // Initialize arena
  }

  /**
   * Get number of players currently in arena
   */
  getPlayerCount(): number {
    return this.activePlayers.size;
  }

  /**
   * Determine combat mode based on player count
   * 2 players = 1v1, 4+ players = 2v2 (with partner selection)
   */
  getCombatMode(): '1v1' | '2v2' | 'waiting' {
    const count = this.getPlayerCount();
    if (count === 2) return '1v1';
    if (count >= 4) return '2v2';
    return 'waiting';
  }

  /**
   * Player enters the arena
   */
  playerEnterArena(
    playerId: string,
    displayName: string,
    posX: number = 0,
    posY: number = 0
  ): ArenaPlayer {
    const player: ArenaPlayer = {
      playerId,
      displayName,
      posX,
      posY,
      isInCombat: false,
    };

    this.activePlayers.set(playerId, player);
    console.log(`[ARENA] ${displayName} entered the arena (${this.getPlayerCount()} players total)`);

    return player;
  }

  /**
   * Player leaves the arena
   */
  playerLeaveArena(playerId: string): void {
    const player = this.activePlayers.get(playerId);
    if (!player) return;

    // End any active combat
    if (player.isInCombat) {
      this.endCombat(playerId);
    }

    // If player had a partner, also remove them from combat
    if (player.partner) {
      const partner = this.activePlayers.get(player.partner);
      if (partner && partner.isInCombat) {
        this.endCombat(player.partner);
      }
    }

    this.activePlayers.delete(playerId);
    console.log(`[ARENA] ${player.displayName} left the arena (${this.getPlayerCount()} players remaining)`);
  }

  /**
   * Get all players currently in arena
   */
  getPlayersInArena(): ArenaPlayer[] {
    return Array.from(this.activePlayers.values());
  }

  /**
   * Get all players not currently in combat
   */
  getAvailablePlayers(): ArenaPlayer[] {
    return Array.from(this.activePlayers.values()).filter((p) => !p.isInCombat);
  }

  /**
   * For 2v2: Player explicitly chooses a specific partner
   */
  choosePartner(playerId: string, partnerId: string): boolean {
    const player = this.activePlayers.get(playerId);
    const partner = this.activePlayers.get(partnerId);

    if (!player || !partner) {
      console.log(`[ARENA] Cannot choose partner - one or both players not found`);
      return false;
    }

    if (player.isInCombat || partner.isInCombat) {
      console.log(`[ARENA] Cannot choose partner - one or both already in combat`);
      return false;
    }

    if (this.getCombatMode() !== '2v2') {
      console.log(`[ARENA] Not enough players for 2v2 (need 4+, have ${this.getPlayerCount()})`);
      return false;
    }

    const teamId = `team_${this.teamCounter++}`;
    player.teamId = teamId;
    player.partner = partnerId;
    partner.teamId = teamId;
    partner.partner = playerId;

    console.log(`[ARENA] Team formed: ${player.displayName} + ${partner.displayName}`);
    return true;
  }

  /**
   * For 2v2: Player opts for random partner assignment
   * Assigns them to an available player who is also not in combat or already partnered
   */
  randomizePartner(playerId: string): boolean {
    const player = this.activePlayers.get(playerId);

    if (!player) {
      console.log(`[ARENA] Cannot randomize partner - player not found`);
      return false;
    }

    if (player.isInCombat) {
      console.log(`[ARENA] Cannot randomize partner - player already in combat`);
      return false;
    }

    if (player.partner) {
      console.log(`[ARENA] Player already has a partner`);
      return false;
    }

    if (this.getCombatMode() !== '2v2') {
      console.log(`[ARENA] Not enough players for 2v2 (need 4+, have ${this.getPlayerCount()})`);
      return false;
    }

    // Find available players who are also not in combat and don't have a partner
    const availablePartners = Array.from(this.activePlayers.values()).filter(
      (p) => !p.isInCombat && !p.partner && p.playerId !== playerId
    );

    if (availablePartners.length === 0) {
      console.log(`[ARENA] No available partners for randomization`);
      return false;
    }

    // Pick random partner
    const randomPartner = availablePartners[Math.floor(Math.random() * availablePartners.length)];

    const teamId = `team_${this.teamCounter++}`;
    player.teamId = teamId;
    player.partner = randomPartner.playerId;
    randomPartner.teamId = teamId;
    randomPartner.partner = playerId;

    console.log(`[ARENA] Random team formed: ${player.displayName} + ${randomPartner.displayName}`);
    return true;
  }

  /**
   * Start 1v1 combat (when exactly 2 players in arena)
   */
  start1v1(player1Id: string, player2Id: string): ArenaCombat | null {
    const player1 = this.activePlayers.get(player1Id);
    const player2 = this.activePlayers.get(player2Id);

    if (!player1 || !player2) {
      console.log(`[ARENA] Cannot start 1v1 - one or both players not in arena`);
      return null;
    }

    if (player1.isInCombat || player2.isInCombat) {
      console.log(`[ARENA] Cannot start 1v1 - one or both players already in combat`);
      return null;
    }

    const combatId = `combat_${this.combatCounter++}`;
    const combat: ArenaCombat = {
      combatId,
      type: '1v1',
      team1: [player1Id],
      team2: [player2Id],
      startTime: Date.now(),
      isActive: true,
    };

    this.activeCombats.set(combatId, combat);
    player1.isInCombat = true;
    player1.currentOpponents = [player2Id];
    player2.isInCombat = true;
    player2.currentOpponents = [player1Id];

    console.log(`[ARENA] 1v1 Combat started: ${player1.displayName} vs ${player2.displayName}`);

    return combat;
  }

  /**
   * Start 2v2 combat (team1 vs team2)
   * Team 1: [player1Id, player1PartnerId]
   * Team 2: [player2Id, player2PartnerId]
   */
  start2v2(
    player1Id: string,
    player1PartnerId: string,
    player2Id: string,
    player2PartnerId: string
  ): ArenaCombat | null {
    const players = [
      this.activePlayers.get(player1Id),
      this.activePlayers.get(player1PartnerId),
      this.activePlayers.get(player2Id),
      this.activePlayers.get(player2PartnerId),
    ];

    if (players.some((p) => !p)) {
      console.log(`[ARENA] Cannot start 2v2 - one or more players not found`);
      return null;
    }

    if (players.some((p) => p!.isInCombat)) {
      console.log(`[ARENA] Cannot start 2v2 - one or more players already in combat`);
      return null;
    }

    const combatId = `combat_${this.combatCounter++}`;
    const combat: ArenaCombat = {
      combatId,
      type: '2v2',
      team1: [player1Id, player1PartnerId],
      team2: [player2Id, player2PartnerId],
      startTime: Date.now(),
      isActive: true,
    };

    this.activeCombats.set(combatId, combat);

    // Set all players to in-combat with their opponents
    players.forEach((p) => {
      p!.isInCombat = true;
    });

    // Team 1 sees Team 2 as opponents
    players[0]!.currentOpponents = [player2Id, player2PartnerId];
    players[1]!.currentOpponents = [player2Id, player2PartnerId];

    // Team 2 sees Team 1 as opponents
    players[2]!.currentOpponents = [player1Id, player1PartnerId];
    players[3]!.currentOpponents = [player1Id, player1PartnerId];

    console.log(
      `[ARENA] 2v2 Combat started: ${players[0]!.displayName} + ${players[1]!.displayName} vs ${players[2]!.displayName} + ${players[3]!.displayName}`
    );

    return combat;
  }

  /**
   * End combat for a player (or team in 2v2)
   */
  endCombat(playerId: string): void {
    const player = this.activePlayers.get(playerId);
    if (!player || !player.isInCombat) return;

    // Find the combat this player is in
    let combatToEnd: ArenaCombat | null = null;
    for (const [, combat] of this.activeCombats.entries()) {
      if (
        (combat.team1.includes(playerId) || combat.team2.includes(playerId)) &&
        combat.isActive
      ) {
        combatToEnd = combat;
        break;
      }
    }

    if (!combatToEnd) return;

    // Clear combat state for all involved players
    const allPlayersInCombat = [...combatToEnd.team1, ...combatToEnd.team2];
    allPlayersInCombat.forEach((pId) => {
      const p = this.activePlayers.get(pId);
      if (p) {
        p.isInCombat = false;
        p.currentOpponents = undefined;
      }
    });

    combatToEnd.isActive = false;
    this.activeCombats.delete(combatToEnd.combatId);

    console.log(`[ARENA] ${combatToEnd.type} combat ended`);
  }

  /**
   * Get active combats in arena
   */
  getActiveCombats(): ArenaCombat[] {
    return Array.from(this.activeCombats.values()).filter((c) => c.isActive);
  }

  /**
   * Check if a player is in combat
   */
  isPlayerInCombat(playerId: string): boolean {
    const player = this.activePlayers.get(playerId);
    return player ? player.isInCombat : false;
  }

  /**
   * Get opponents of a player (if in combat)
   */
  getOpponents(playerId: string): ArenaPlayer[] {
    const player = this.activePlayers.get(playerId);
    if (!player || !player.currentOpponents) return [];

    return player.currentOpponents
      .map((oppId) => this.activePlayers.get(oppId))
      .filter((opp) => !!opp) as ArenaPlayer[];
  }

  /**
   * Get partner of a player (for 2v2)
   */
  getPartner(playerId: string): ArenaPlayer | null {
    const player = this.activePlayers.get(playerId);
    if (!player || !player.partner) return null;

    return this.activePlayers.get(player.partner) || null;
  }

  /**
   * Update player position in arena
   */
  updatePlayerPosition(playerId: string, posX: number, posY: number): void {
    const player = this.activePlayers.get(playerId);
    if (player) {
      player.posX = posX;
      player.posY = posY;
    }
  }

  /**
   * Get player data
   */
  getPlayer(playerId: string): ArenaPlayer | null {
    return this.activePlayers.get(playerId) || null;
  }
}
