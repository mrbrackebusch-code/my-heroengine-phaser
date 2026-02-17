# Wisdom Bard Mode - External Integration Hooks

This document tracks what the Kyle module needs from the core game to function fully.

## Required Hooks

### 1. **Phaser Rendering Integration**
**Purpose:** Render FNF-style notes scrolling down the screen and the hit zone.

**What's needed:**
- A Phaser Scene or container where notes can be spawned as graphics/sprites
- Note sprites/graphics positioned in 4 lanes (left, up, down, right)
- Each note scrolls toward the top hit zone based on song timing
- Visual feedback for hits (Sick/Mid/Bruh/Garbage) and misses

**Hook signature (placeholder):**
```typescript
// Request from src/studentSystemsHooks.ts or core:
export function requestBardModeRenderer() {
  // Return a renderer object that can spawn/update/destroy notes
}
```

**Location to call:** [src/student/Kyle/wisdomBard/phaserRenderer.ts](src/student/Kyle/wisdomBard/phaserRenderer.ts) (not yet created)

---

### 2. **Audio Playback**
**Purpose:** Play the song during minigame.

**What's needed:**
- Load and play audio by song key/ID
- Sync playback with minigame timing
- Control playback (start, pause, stop)

**Hook signature (placeholder):**
```typescript
export function requestAudioManager() {
  // Return audio control interface
}
```

**Location to call:** [src/student/Kyle/wisdomBard/audioHooks.ts](src/student/Kyle/wisdomBard/audioHooks.ts) (not yet created)

---

### 3. **Wisdom Move Input Interception**
**Purpose:** Detect when player holds down the Wisdom move button and feed arrow-key input.

**What's needed:**
- Hook into button-hold detection for Wisdom move (button 4 or "R")
- When held: call `BardMode.startHolding(song)` and begin minigame loop
- On arrow-key press (↑↓←→): call `BardMode.onInput(lane)`
- When released: call `BardMode.stopHolding()` and apply healing multiplier to the move

**Current location in core:** `src/HeroEngineInPhaser.ts` (move input handlers)

**Required information:**
- Song data per hero (how is it stored? in player save? per-profile Blockly?)
- How to apply the healing multiplier back to the move's effect

---

### 4. **Song Storage & Loading**
**Purpose:** Load player-composed songs from Blockly editor.

**What's needed:**
- Where are songs stored? (global map like `__heBlocklyXmlByProfile`?)
- How to parse Blockly output → `Song` object
- Access to per-hero song data

**Reference:** `src/blocklyHeroLogicRuntime.ts` uses `__heBlocklyXmlByProfile` for hero logic.

**Location to implement:** [src/student/Kyle/wisdomBard/musicBlocklyInterface.ts](src/student/Kyle/wisdomBard/musicBlocklyInterface.ts) (currently placeholder)

---

### 5. **Blockly Music Editor UI**
**Purpose:** Let players compose songs (notes + BPM).

**What's needed:**
- A Blockly editor instance for music composition (separate from hero logic, traps, shrines)
- Blocks for:
  - Set BPM
  - Add note (lane, time offset)
  - Validate song
- Export format → parseable by `parseBlocklyToSong()`

**Reference:** See `src/blocklyTrapEditor.ts` and `src/blocklyHeroLogicEditor.ts` for patterns.

**Status:** Design phase. Needs maintainer guidance on Blockly integration.

---

## Integration Checklist

- [ ] Phaser renderer (render notes, hit zone, feedback)
- [ ] Audio playback system
- [ ] Wisdom button input interception
- [ ] Song storage/loading mechanism
- [ ] Blockly music editor UI
- [ ] Apply healing multiplier to Wisdom move

---

## Implementation Notes

**Phaser-agnostic core:** The minigame engine itself (`minigame.ts`, `scoreCalculator.ts`, `bardMode.ts`) is completely independent of Phaser and Blockly. It only needs:
1. A `Song` object with notes and timing
2. Arrow-key input callbacks
3. Rendering callbacks for visual feedback

**All Phaser/Blockly logic should live in separate wrapper modules** that call into the core and handle UI/audio.

---

## Questions for Maintainer

1. How should songs be stored per-hero? (global map, player save, per-profile?)
2. Should the Blockly music editor be a separate workspace or integrated into existing editors?
3. How should the healing multiplier integrate with the existing move system? (Apply before/after other calculations?)
