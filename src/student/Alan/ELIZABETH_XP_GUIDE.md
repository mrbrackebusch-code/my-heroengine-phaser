# XP Progression Guide for Elizabeth

This guide explains the pet XP and leveling system, and what you need to implement.

---

## 🎯 Your Mission

Flesh out [petXpSystem.ts](petXpSystem.ts) to create a complete pet progression system. Alan has already wired the XP hooks in combat; you're implementing the leveling mechanics.

---

## 📊 Current State

### What's Already Done ✅

1. **XP Event Wiring** (petCombat.ts)
   - When pet defeats an enemy, `registerPetXpGainHook()` is called
   - XP reward calculated based on enemy level: `baseXp (25) + (level × 5)`
   - Hook receives context: `{ pet, petId, xpAmount, enemyId, enemyType, scene, now }`

2. **Skeleton Functions** (petXpSystem.ts)
   - `initPetXpState(pet)` — Initialize XP tracking
   - `getPetXpState(pet)` — Retrieve XP state
   - `awardPetXp(pet, xpAmount, ctx)` — Award XP and check level-up
   - `_levelUpPet(pet, xpState, ctx)` — Handle level-up logic
   - `_applyStatGrowth(pet, fromLevel, toLevel)` — Grow stats on level-up
   - `_calculateXpThreshold(level)` — Calculate XP required per level (TUNABLE)

3. **Pet Stats** (petDefs.ts)
   - Base HP: 40
   - Base ATK: 6
   - Growth HP: 6 (HP gain per level)
   - Growth ATK: 1 (ATK gain per level)
   - Max Level: 10
   - Level range: 1-10

### What You're Implementing ✅

The skeleton is **already complete**, but you should:

1. **Tune progression formulas** in `_calculateXpThreshold()`
2. **Test end-to-end** XP flow (award → level-up → stat growth)
3. **Optionally add:** level-up animations, VFX, or UI hooks
4. **Document** any assumptions or limitations

---

## 🔢 Progression Design

### Current Formula

```typescript
function _calculateXpThreshold(level: number): number {
    const baseXp = 100;
    const bonusPerLevel = 50;
    const threshold = baseXp + (bonusPerLevel * level);
    return Math.min(threshold, 600);
}
```

**Resulting XP table:**

| Level | XP to Next | Total XP | Enemy Defeats | Pacing |
|-------|-----------|----------|---------------|--------|
| 1→2   | 100       | 100      | 4-5           | Fast (encourages early leveling) |
| 2→3   | 150       | 250      | 5-6           | Good |
| 3→4   | 200       | 450      | 6-8           | Good |
| 4→5   | 250       | 700      | 7-9           | Good |
| 5→6   | 300       | 1000     | 8-10          | Moderate |
| 6→7   | 350       | 1350     | 9-11          | Moderate |
| 7→8   | 400       | 1750     | 11-14         | Slow |
| 8→9   | 450       | 2200     | 13-15         | Slow |
| 9→10  | 500       | 2700     | 15-18         | Rare (max level is achievement) |

**Assumptions:**
- Average enemy XP: 25-30 base (scales with level)
- Play session: 20-30 minutes
- Pet reaches level 5-6 per session (reasonable progression)

### Tuning Options

If you want **faster progression:**
```typescript
// More aggressive: 75 XP base, 40 per level
return 75 + (40 * level);
```

If you want **slower progression:**
```typescript
// More grind: 120 XP base, 60 per level
return 120 + (60 * level);
```

---

## 📈 Stat Growth

### How Stats Scale

**HP Growth:**
```
maxHp = baseHp + (growthHp × (level - 1))
      = 40 + (6 × (level - 1))
```

- Level 1: 40 HP
- Level 5: 64 HP
- Level 10: 94 HP

**ATK Growth:**
```
atk = baseAtk + (growthAtk × (level - 1))
    = 6 + (1 × (level - 1))
```

- Level 1: 6 ATK
- Level 5: 10 ATK
- Level 10: 15 ATK

**Damage Impact:**
Pet damage formula (from petCombat.ts):
```
baseDmg = (baseAtk × 0.5) + (growthAtk × (level - 1))
damage = baseDmg ± 20% (variance)
```

- Level 1: 3 ± 0.6 dmg (avg 2.4–3.6)
- Level 5: 7 ± 1.4 dmg (avg 5.6–8.4)
- Level 10: 12 ± 2.4 dmg (avg 9.6–14.4)

---

## 🔧 Tuning Parameters

Elizabeth: Adjust these constants in `_calculateXpThreshold()` to change pacing:

```typescript
// Line ~120 in petXpSystem.ts

const baseXp = 100;         // ← XP for level 2 (tune this for early-game feel)
const bonusPerLevel = 50;   // ← XP increase per level (tune for mid/late-game curve)
```

### Testing Quick-Tuning

- **Fast progression:** baseXp=60, bonusPerLevel=30
- **Normal progression (default):** baseXp=100, bonusPerLevel=50
- **Slow progression:** baseXp=150, bonusPerLevel=70

---

## 🧪 Testing Checklist

### Unit Tests (manual testing)

1. **Init state correctly**
   - Spawn pet, verify `pet.__alanXp` initialized to `{ currentXp: 0, level: 1, xpToNextLevel: 100 }`

2. **Award XP, no level-up**
   - Call `awardPetXp(pet, 50)`, verify `pet.__alanXp.currentXp === 50`, level still 1

3. **Award XP, trigger level-up**
   - Call `awardPetXp(pet, 100)`, verify level → 2, currentXp reset

4. **Multiple level-ups**
   - Call `awardPetXp(pet, 500)`, verify pet reaches level 4 or 5 (depending on formula)

5. **Stat growth**
   - Verify HP increases: `pet.maxHp` grows from 40 → 46 → 52 (by 6 per level)
   - Verify ATK increases: `pet.atk` grows from 6 → 7 → 8 (by 1 per level)

6. **Max level cap**
   - Award massive XP (10000), verify pet caps at level 10 and doesn't go higher

7. **XP hook integration** (end-to-end)
   - Simulate enemy defeat via `registerPetXpGainHook` callback
   - Verify XP awarded, level-up triggered, stats updated

### Integration Points

- **petCombat.ts** sends XP events
- **petDefs.ts** provides stat bases and growth rates
- **petBehavior.ts** may benefit from level-up animations (optional)

---

## 🎬 Optional Enhancements (future)

Once basic progression works, consider:

1. **Level-up animations**
   - Hook to play "level-up" animation key
   - Example: `pet.play('wisp_interact')` on level-up

2. **VFX on level-up**
   - Trigger particle effect or flash
   - Coordinate with Lourdes on visual style

3. **UI level display**
   - Show pet level in HUD or pet status panel

4. **Stat UI**
   - Display HP, ATK, level, next XP threshold in UI

5. **XP bar/progress**
   - Visual progress bar toward next level

---

## 📝 Code Style

Follow the existing patterns in petXpSystem.ts:

- Use JSDoc comments for functions
- Namespace pet state with `__alan` prefix (e.g., `pet.__alanXp`)
- Return early to avoid nested ifs
- Log important events (level-up) with `console.log` for debugging
- Silently handle errors (try/catch) to avoid crashes

---

## 🚀 Quick Start

1. **Read** petDefs.ts to understand base stats and growth rates
2. **Read** petCombat.ts line ~310 to see how XP hook is called
3. **Test** `_calculateXpThreshold()` with example levels (2, 5, 10) to verify formula
4. **Tune** baseXp and bonusPerLevel until pacing feels right
5. **Integrate** end-to-end: spawn pet → defeat enemy → verify level-up
6. **Optional:** Add level-up VFX/animation hooks if time permits

---

## 📞 Questions?

If you need:
- **Stat formula clarification:** Check petDefs.ts and the table above
- **XP event details:** See petCombat.ts `_onEnemyDefeated()` function
- **Animation/VFX hooks:** Coordinate with Lourdes or Alan for integration points
- **Balance feedback:** Reach out to the team with progression data and suggested tuning

---

**Last Updated:** February 17, 2026  
**Created for:** Elizabeth (leveling & progression)  
**Linked from:** [PET_SYSTEM_STATUS.md](PET_SYSTEM_STATUS.md)
