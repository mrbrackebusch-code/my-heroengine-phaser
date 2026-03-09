/**
 * Post-Combat Manager
 * Handles rematch voting, exit decisions, and exit countdowns after combat ends
 */

export interface PostCombatState {
  playerId: string;
  displayName: string;
  wantsRematch: boolean | null; // true = rematch, false = exit, null = undecided
  wantsTeamChange?: boolean; // true = wants new teammate (2v2 only)
}

export interface PostCombatSession {
  sessionId: string;
  combatType: '1v1' | '2v2';
  players: Map<string, PostCombatState>;
  startTime: number;
  countdownActive: boolean;
  countdownValue: number;
  countdownInterval: ReturnType<typeof setInterval> | null;
  teamChangeMode?: boolean; // 2v2 only: players choosing new partners
  teamSelectors?: string[]; // 2v2 only: randomly selected players who can choose teammates
  newTeamSelections?: Map<string, string>; // playerId -> selectedPartnerId
}

export class PostCombatManager {
  private activeSessions: Map<string, PostCombatSession> = new Map();
  private sessionCounter: number = 0;
  private countdownCallback?: (remainingTime: number) => void;
  private exitCallback?: (playerIds: string[]) => void;

  constructor() {
    // Initialize manager
  }

  /**
   * Start a new post-combat session after battle ends
   */
  startPostCombatSession(
    combatType: '1v1' | '2v2',
    playerIds: string[],
    playerNames: Map<string, string>
  ): PostCombatSession {
    const sessionId = `postcombat_${this.sessionCounter++}`;
    const players = new Map<string, PostCombatState>();

    playerIds.forEach((pId) => {
      players.set(pId, {
        playerId: pId,
        displayName: playerNames.get(pId) || 'Unknown',
        wantsRematch: null, // Undecided initially
      });
    });

    const session: PostCombatSession = {
      sessionId,
      combatType,
      players,
      startTime: Date.now(),
      countdownActive: false,
      countdownValue: 5,
      countdownInterval: null,
    };

    this.activeSessions.set(sessionId, session);

    console.log(
      `[POST-COMBAT] Session started for ${combatType} with ${playerIds.length} players`
    );
    console.log(`[POST-COMBAT] Players have options: REMATCH or EXIT`);

    return session;
  }

  /**
   * Player votes to change teammates (2v2 only)
   * If ALL players vote yes, enter team selection mode
   */
  playerVotesTeamChange(sessionId: string, playerId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`[POST-COMBAT] Session not found`);
      return false;
    }

    // Team change only for 2v2
    if (session.combatType !== '2v2') {
      console.log(`[POST-COMBAT] Team change only available for 2v2 matches`);
      return false;
    }

    const player = session.players.get(playerId);
    if (!player) {
      console.log(`[POST-COMBAT] Player not in session`);
      return false;
    }

    player.wantsTeamChange = true;
    console.log(`[POST-COMBAT] ${player.displayName} wants to CHANGE TEAMMATES`);

    this.checkTeamChangeStatus(sessionId);
    return true;
  }

  /**
   * Player cancels team change request
   */
  playerCancelsTeamChange(sessionId: string, playerId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const player = session.players.get(playerId);
    if (!player) return false;

    player.wantsTeamChange = false;
    console.log(`[POST-COMBAT] ${player.displayName} cancelled team change`);

    return true;
  }

  /**
   * Check if all players want to change teams (2v2 only)
   */
  private checkTeamChangeStatus(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.combatType !== '2v2') return;

    const players = Array.from(session.players.values());
    const teamChangeVotes = players.filter((p) => p.wantsTeamChange === true).length;

    console.log(`[POST-COMBAT] Team change votes: ${teamChangeVotes}/4`);

    if (teamChangeVotes === 4 && players.length === 4) {
      console.log(`[POST-COMBAT] ✓ ALL PLAYERS AGREED - Entering team selection mode`);
      session.teamChangeMode = true;
      session.newTeamSelections = new Map();

      const allPlayerIds = Array.from(session.players.keys());
      const shuffled = [...allPlayerIds].sort(() => Math.random() - 0.5);
      session.teamSelectors = shuffled.slice(0, 2);

      const selectorNames = session.teamSelectors
        .map((id) => session.players.get(id)?.displayName || id)
        .join(', ');
      console.log(`[POST-COMBAT] Team selectors chosen randomly: ${selectorNames}`);
    }
  }

  /**
   * Player selects a new teammate during team selection mode (2v2 only)
   */
  selectNewTeammate(sessionId: string, playerId: string, selectedPartnerId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.teamChangeMode) {
      console.log(`[POST-COMBAT] Not in team selection mode`);
      return false;
    }

    const selectors = session.teamSelectors ?? [];
    if (!selectors.includes(playerId)) {
      console.log(`[POST-COMBAT] Only randomly selected players can choose teammates`);
      return false;
    }

    const player = session.players.get(playerId);
    const selectedPartner = session.players.get(selectedPartnerId);

    if (!player || !selectedPartner) {
      console.log(`[POST-COMBAT] Player(s) not found in session`);
      return false;
    }

    if (playerId === selectedPartnerId) {
      console.log(`[POST-COMBAT] Cannot select yourself as teammate`);
      return false;
    }

    if (selectors.includes(selectedPartnerId)) {
      console.log(`[POST-COMBAT] Selected partner must be one of the non-selector players`);
      return false;
    }

    const alreadyChosen = Array.from(session.newTeamSelections?.values() ?? []);
    if (alreadyChosen.includes(selectedPartnerId)) {
      console.log(`[POST-COMBAT] That player has already been selected by the other selector`);
      return false;
    }

    session.newTeamSelections?.set(playerId, selectedPartnerId);
    console.log(
      `[POST-COMBAT] ${player.displayName} selected ${selectedPartner.displayName} as new teammate`
    );

    // Check if both selectors have selected teammates
    if (session.newTeamSelections?.size === 2) {
      this.finalizeTeamRematch(sessionId);
    }

    return true;
  }

  /**
   * Finalize rematch with new teams when all selections are made
   */
  private finalizeTeamRematch(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log(`[POST-COMBAT] Team selectors completed choices - Finalizing rematch`);
    console.log(`[POST-COMBAT] New teams formed - Rematch with new partnerships starting`);

    // Reset session values
    session.teamChangeMode = false;
    session.teamSelectors = [];

    // Trigger rematch with new team selections
    this.triggerRematch(sessionId);
  }

  /**
   * Player votes for rematch
   */
  playerVotesRematch(sessionId: string, playerId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`[POST-COMBAT] Session not found`);
      return false;
    }

    const player = session.players.get(playerId);
    if (!player) {
      console.log(`[POST-COMBAT] Player not in session`);
      return false;
    }

    player.wantsRematch = true;
    console.log(`[POST-COMBAT] ${player.displayName} wants to REMATCH`);

    this.checkRematchStatus(sessionId);
    return true;
  }

  /**
   * Player votes to exit
   */
  playerVotesExit(sessionId: string, playerId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`[POST-COMBAT] Session not found`);
      return false;
    }

    const player = session.players.get(playerId);
    if (!player) {
      console.log(`[POST-COMBAT] Player not in session`);
      return false;
    }

    player.wantsRematch = false;
    console.log(`[POST-COMBAT] ${player.displayName} wants to EXIT`);

    this.checkRematchStatus(sessionId);
    return true;
  }

  /**
   * Check if rematch is possible based on votes
   * 1v1: Both must want rematch
   * 2v2: 3/4 or 4/4 must want rematch
   */
  private checkRematchStatus(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const votes = Array.from(session.players.values());
    const rematchVotes = votes.filter((p) => p.wantsRematch === true).length;
    const exitVotes = votes.filter((p) => p.wantsRematch === false).length;
    const undecidedVotes = votes.filter((p) => p.wantsRematch === null).length;

    console.log(
      `[POST-COMBAT] Votes - Rematch: ${rematchVotes}, Exit: ${exitVotes}, Undecided: ${undecidedVotes}`
    );

    // Check if rematch conditions are met
    if (session.combatType === '1v1') {
      // 1v1: Both players must agree
      if (rematchVotes === 2) {
        console.log(`[POST-COMBAT] ✓ REMATCH APPROVED - Both players agreed!`);
        this.triggerRematch(sessionId);
      } else if (exitVotes === 2) {
        // Both players want to exit - immediate exit, no countdown
        console.log(`[POST-COMBAT] Both players want to EXIT - Immediately exiting arena`);
        this.triggerImmediateExit(sessionId);
      } else if (exitVotes >= 1 && rematchVotes === 1) {
        // One player wants exit, one wants rematch - start countdown
        console.log(
          `[POST-COMBAT] Rematch rejected - One player wants to exit. Starting exit countdown (5 sec)`
        );
        this.startExitCountdown(sessionId);
      }
    } else if (session.combatType === '2v2') {
      // 2v2: 3/4 or 4/4 must agree
      if (rematchVotes >= 3) {
        console.log(`[POST-COMBAT] ✓ REMATCH APPROVED - ${rematchVotes}/4 players agreed!`);
        this.triggerRematch(sessionId);
      } else if (exitVotes >= 1) {
        // At least one player exited - start countdown
        console.log(
          `[POST-COMBAT] Rematch rejected - ${exitVotes} player(s) want to exit. Starting exit countdown (5 sec)`
        );
        this.startExitCountdown(sessionId);
      }
    }
  }

  /**
   * Trigger immediate exit - both players want to leave (1v1 only)
   * No countdown needed, exit immediately
   */
  private triggerImmediateExit(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const playerIds = Array.from(session.players.keys());
    console.log(`[POST-COMBAT] Exiting all ${playerIds.length} players immediately from arena`);

    // Trigger exit callback (no countdown)
    if (this.exitCallback) {
      this.exitCallback(playerIds);
    }

    this.activeSessions.delete(sessionId);
  }

  /**
   * Trigger rematch - reset and return to combat
   */
  private triggerRematch(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const playerIds = Array.from(session.players.keys());
    console.log(`[POST-COMBAT] Rematch triggered for ${session.combatType}`);
    console.log(`[POST-COMBAT] Players: ${Array.from(session.players.values()).map((p) => p.displayName).join(', ')}`);

    // Reset votes for next session or trigger rematch callback
    this.activeSessions.delete(sessionId);

    // In real integration, this would trigger a new combat session
  }

  /**
   * Start 5-second exit countdown
   * After countdown, force exit any remaining players
   */
  private startExitCountdown(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.countdownActive) return;

    session.countdownActive = true;
    session.countdownValue = 5;

    console.log(`[POST-COMBAT] Exit countdown started: 5 seconds to exit arena`);

    // Callback with initial value
    if (this.countdownCallback) {
      this.countdownCallback(5);
    }

    // Countdown interval (1 second per tick)
    session.countdownInterval = setInterval(() => {
      session.countdownValue--;

      console.log(`[POST-COMBAT] Exit countdown: ${session.countdownValue}`);

      if (this.countdownCallback) {
        this.countdownCallback(session.countdownValue);
      }

      if (session.countdownValue <= 0) {
        this.finishExitCountdown(sessionId);
      }
    }, 1000);
  }

  /**
   * Finish exit countdown - force exit all remaining players
   */
  private finishExitCountdown(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.countdownInterval) {
      clearInterval(session.countdownInterval);
      session.countdownInterval = null;
    }

    const playerIds = Array.from(session.players.keys());
    console.log(`[POST-COMBAT] Exit countdown finished - Forcing all ${playerIds.length} players to exit arena`);

    // Trigger exit callback
    if (this.exitCallback) {
      this.exitCallback(playerIds);
    }

    this.activeSessions.delete(sessionId);
  }

  /**
   * Set callback for countdown ticks
   */
  setCountdownCallback(callback: (remainingTime: number) => void): void {
    this.countdownCallback = callback;
  }

  /**
   * Set callback for when players are forced to exit
   */
  setExitCallback(callback: (playerIds: string[]) => void): void {
    this.exitCallback = callback;
  }

  /**
   * Get post-combat session
   */
  getSession(sessionId: string): PostCombatSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all players' current votes in a session
   */
  getPlayerVotes(sessionId: string): Map<string, boolean | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return new Map();

    const votes = new Map<string, boolean | null>();
    session.players.forEach((player, playerId) => {
      votes.set(playerId, player.wantsRematch);
    });

    return votes;
  }

  /**
   * Get available teammates for selection (exclude self and already selected)
   */
  getAvailableTeammates(sessionId: string, playerId: string): Map<string, string> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.teamChangeMode) return new Map();

    const selectors = session.teamSelectors ?? [];
    if (!selectors.includes(playerId)) return new Map();

    const available = new Map<string, string>();
    const alreadyChosen = Array.from(session.newTeamSelections?.values() ?? []);

    session.players.forEach((player, id) => {
      if (
        id !== playerId &&
        !selectors.includes(id) &&
        !alreadyChosen.includes(id)
      ) {
        available.set(id, player.displayName);
      }
    });

    return available;
  }

  /**
   * Check if team selection is in progress
   */
  isTeamSelectionMode(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.teamChangeMode ?? false;
  }

  /**
   * Get team change votes count
   */
  getTeamChangeVotes(sessionId: string): number {
    const session = this.activeSessions.get(sessionId);
    if (!session) return 0;

    return Array.from(session.players.values()).filter((p) => p.wantsTeamChange === true)
      .length;
  }

  /**
   * Get randomly selected players allowed to choose teammates in team-change mode
   */
  getTeamSelectors(sessionId: string): string[] {
    const session = this.activeSessions.get(sessionId);
    if (!session) return [];
    return session.teamSelectors ?? [];
  }

  /**
   * Cancel session and exit all players immediately
   */
  cancelSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.countdownInterval) {
      clearInterval(session.countdownInterval);
      session.countdownInterval = null;
    }

    const playerIds = Array.from(session.players.keys());
    console.log(`[POST-COMBAT] Session cancelled - Exiting all ${playerIds.length} players`);

    if (this.exitCallback) {
      this.exitCallback(playerIds);
    }

    this.activeSessions.delete(sessionId);
  }

  /**
   * Player uses EXIT DOOR to immediately leave during post-combat voting
   * Bypasses rematch voting - immediately exits
   */
  playerUsesExitDoor(sessionId: string, playerId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`[POST-COMBAT] Session not found`);
      return;
    }

    const player = session.players.get(playerId);
    if (!player) {
      console.log(`[POST-COMBAT] Player not in session`);
      return;
    }

    console.log(`[POST-COMBAT] ${player.displayName} used the EXIT DOOR - leaving immediately`);

    // Remove player from session
    session.players.delete(playerId);

    // If only 1 player left or none, exit them too
    if (session.players.size === 0) {
      console.log(`[POST-COMBAT] No players remaining - Session ended`);
      this.activeSessions.delete(sessionId);
    } else if (session.players.size === 1 && session.combatType === '1v1') {
      // For 1v1, if one player uses exit door, exit the other too
      const remainingPlayer = Array.from(session.players.keys())[0];
      console.log(`[POST-COMBAT] Opponent left via exit door - Exiting remaining player`);
      if (this.exitCallback) {
        this.exitCallback([remainingPlayer]);
      }
      this.activeSessions.delete(sessionId);
    } else if (session.combatType === '2v2') {
      // For 2v2, check if rematch is still possible
      const rematchVotes = Array.from(session.players.values()).filter((p) => p.wantsRematch === true).length;
      const playersLeft = session.players.size;
      
      if (playersLeft < 2) {
        // Not enough players for any match, exit everyone
        console.log(`[POST-COMBAT] Not enough players remaining - Exiting all`);
        if (this.exitCallback) {
          this.exitCallback(Array.from(session.players.keys()));
        }
        this.activeSessions.delete(sessionId);
      }
    }
  }
}
