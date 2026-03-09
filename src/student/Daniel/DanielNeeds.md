# Daniel's Combat Arena System - External Integration Needs

## Overview
Daniel is developing a **Combat Arena Floor** where players can enter through a dedicated entrance, wait for friends, and then fight each other through an automated countdown system.

## System Components
1. **Arena Entrance** - Door and "Combat Area" sign at entry point
2. **Waiting Lobby** - Players wait for friends to arrive
3. **Countdown System** - 5-second countdown before combat begins
4. **Combat Arena Floor** - Where the actual fights happen

## Core Features
- **Arena Entry/Exit**: Players can enter/leave the arena
- **Player Tracking**: Track all active players in the arena
- **Dynamic Combat Modes**: 
  - **1v1** when exactly 2 players are in the arena
  - **2v2** team combat when 4+ players are in the arena (with partner selection)
- **Team FormEntrance Entity
**What we need**: A physical entrance location in the game world with:
- A **door** that players can interact with to enter the arena
- A **sign displaying "Combat Area"** above or near the door
- Collision/interaction area that triggers entrance

**How Daniel will use it**:
```typescript
import { arenaEntrance } from './src/student/Daniel';

// When player approaches entrance and sees door/sign
arenaEntrance.playerArrivesAtEntrance('player1', 'Alice');

// When player interacts with door
arenaEntrance.playerEntersArena('player1');
```

**Expected behavior**:
- Door and sign are visible at entrance
- Door triggers entrance function when interacted with
- Players see they are in the "Combat Area"

### 2. Waiting Lobby (Entrance)
**What we need**: A waiting area where players see each other while waiting for friends.

**How Daniel will use it**:
```typescript
// Check how many players are waiting
const waitingCount = arenaEntrance.getWaitingPlayerCount(); // 1, 2, etc.

// Check if all required players have arrived
if (arenaEntrance.allPlayersReady()) {
  arenaEntrance.startCountdown((count) => {
    console.log(`Combat starts in ${count}...`);
    // Update UI to show countdown
  });
}
```

**Expected behavior**:
- Players see other waiting players
- Visual indication of how many are waiting
- Countdown UI displays when timer starts

### 3. Countdown System (5 seconds)
**What we need**: A visual countdown that triggers combat start.

**How Daniel will use it**:
```typescript
// Start 5-second countdown
arenaEntrance.startCountdown((countdownValue) => {
  // countdownValue: 5, 4, 3, 2, 1, 0
  // Update UI to show: "5...", "4...", "3...", etc.
  // On 0, combat automatically begins
});

// Check countdown status
const isCountingDown = arenaEntrance.isCountdownActive();
const currentCount = arenaEntrance.getCurrentCountdown();
```

**Expected behavior**:
- Countdown displays visually to all players (5, 4, 3, 2, 1, START)
- Each tick is 1 second
- At 0, combat match begins automatically
- If a player leaves during countdown, it stops

**Expected behavior**:
- Player movements in arena are broadcast to other players
- Team partnerships are synchronized (so all clients know team members)
- Combat state is synchronized across clients
- When combat ends, all clients know about it

## Current Implementation

### CombatArenaFloor Class
 (auto-ends combat if in one)
- `getCombatMode()` - Returns '1v1', '2v2', or 'waiting' based on player count
- `getPlayerCount()` - Get total players in arena
- `getPlayersInArena()` - Get all active players
- `getAvailablePlayers()` - Get players not currently in combat
- `choosePartner(playerId, partnerId)` - Explicitly pair with a specific partner
- `randomizePartner(playerId)` - Assign a random available partner
- `start1v1(player1Id, player2Id)` - Initiate 1v1 combat
- `start2v2(player1Id, partner1Id, player2Id, partner2Id)` - Initiate 2v2 team combat
- `endCombat(playerId)` - End combat for a player/team
- `getActiveCombats()` - Get all ongoing combats
- `isPlayerInCombat(playerId)` - Check if player is fighting
- `getOpponents(playerId)` - Get all opponents (1 for 1v1, 2 for 2v2)
- `getPartner(playerId)` - Get team partner (2v2 only
- `getActiveCombats()` - Get all ongoing combats
- `isPlayerInCombat(playerId)` - Check if player is fighting
- `getOpponent(playerId)` - Get opponent (if in combat)
- `updatePlayerPosition(playerId, posX, posY)` - Update player position
- `getPlayer(playerId)` - Get player data

## Development Status
- ✅ Core arena system implemented
- ⏳ Awaiting arena floor entity in game world
- ⏳ Awaiting combat system integration
- ⏳ Awaiting multiplayer synchronization hooks

## Notes
- Self-contained within `src/student/Daniel/`
- No core files modified
- Ready for integration once game hooks are provided