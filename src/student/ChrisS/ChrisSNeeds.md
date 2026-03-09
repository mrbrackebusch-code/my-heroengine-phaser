# ChrisS Amulet System — Status

## ✅ CORE INTEGRATION COMPLETE

Amulet effects are **fully integrated** and working. Only Floor 1 reward trigger remains.

---

## ✅ What's Complete

### Student Code (100%)
- **5 Amulets:** Tides, Zephyrs, Embers, Venom, Stones with full mechanics
- **All VFX:** LightEffects, FireWrath, CosmicTime, EarthImpact particle effects
- **Amulet Selection UI:** Modal with stats display and confirmation popup
- **Effect Handlers:** Speed mods, DoT, stuns, knockback, area effects, cooldowns
- **Safe Wrappers:** [amuletUtils.ts](amuletUtils.ts) prevents sprite corruption
- **Floor 1 Listener:** [index.ts](index.ts) ready to show UI on event

### Core Integration (100%)
- ✅ `dispatchRelicModifyMoveStats` - imported & called (line 27842)
- ✅ `dispatchRelicOnHitEnemy` - imported & called (line 84872)
- ✅ `__heroEngineVfxRegistry` - exposed to globalThis (line 13105)

---

## ⏳ NOT YET DONE: Floor 1 Reward Hooks

**VERIFICATION: These are NOT in HeroEngineInPhaser.ts. Teacher must add them.**

### 1️⃣ Event Dispatch — NOT FOUND IN CORE

**Location:** Find where floor 1 treasure is opened in HeroEngineInPhaser.ts  
**Search for:** `treasureChest`, `openTreasure`, or floor index `=== 1`  
**Add this line:**

```typescript
globalThis.dispatchEvent(new CustomEvent("he:dungeonFloorComplete", {
    detail: { floorIndex: 1 }
}));
```

### 2️⃣ Relic Grant Function — NOT FOUND IN CORE

**Add at module level in HeroEngineInPhaser.ts** (after other helpers):

```typescript
export function addRelicToHero(heroIndex: number, amuletId: string): void {
    const hero = /* get hero sprite by heroIndex from your hero array */;
    if (!hero) return;
    
    // Use your relic system to add the relic
    // Example: heroes[heroIndex].addRelic(amuletId);
    // or: relicInventory.add(heroIndex, amuletId);
}

// Expose to globalThis
(globalThis as any).addRelicToHero = addRelicToHero;
```

**Why:** Student UI ([index.ts](index.ts) line 81–82) calls `g.addRelicToHero(heroIndex, amuletId)` after player confirms amulet selection.

---

## 🧪 Testing

**Test UI manually (without teacher hooks):**

1. Run `npm run dev`
2. Open game in browser
3. Open DevTools Console
4. Run: `globalThis.dispatchEvent(new CustomEvent("he:dungeonFloorComplete",{detail:{floorIndex:1}}))`
5. Amulet selection UI should appear
6. Select amulet → view stats → confirm → see "Are you sure?" popup

**Test with floor 1 reward (after teacher adds hooks):**

1. Start game normally
2. Complete floor 1 (reach treasure)
3. UI appears automatically
4. Select & confirm amulet
5. Amulet is granted to hero
6. Test effects in combat on floor 2+

---

## 📊 Expected Behaviors

Once integrated:

- **Tides:** +15% speed | Every 5 Strength = knockback wave | Intelligence = bubble trap (2.5s)
- **Zephyrs:** +15% speed | Strength +5% speed | Intelligence = tornado pull
- **Embers:** +10% speed | Burn on hit (8% total HP) | Every 3 Strength = 1s stun
- **Venom:** +12% speed | Poison on hit (6% total HP) | Debuff stacks to -20%
- **Stones:** -10% speed, +20% def | Strength = 360° knockback | Intelligence = rock stun (2s)


