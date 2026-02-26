# ChrisS Amulet System — Teacher Action Required

## 🚨 STATUS: AWAITING CORE INTEGRATION

Student code is complete. System needs 3 dispatch calls in `HeroEngineInPhaser.ts` to go live.

---

## ✅ What's Complete

- **5 Amulets:** Tides (water), Zephyrs (wind), Embers (fire), Venom (poison), Stones (earth)
- **All Mechanics:** Speed mods, DoT, stuns, knockback, area effects, cooldowns
- **Safe Wrappers:** [amuletUtils.ts](amuletUtils.ts) prevents sprite data corruption
- **Bridge Functions:** [studentSystemsHooks.ts](../../studentSystemsHooks.ts) has dispatch functions ready
- **Registration:** [index.ts](index.ts) registers all relics with effect keys

---

## ⚠️ Required: Apply Core Integration

**Choose one option:**

### Option A: Git Patch (Recommended)

```bash
git apply src/student/ChrisS/heroengine_relic_integration.patch
git add -A
git commit -m "Integrate student relic dispatch hooks (ChrisS amulets)"
```

✅ Atomic, reversible, reviewable

---

### Option B: Manual Edits (3 Locations)

**1. Add Import (Top of File)**

Find the import block from `"./studentSystemsHooks"` (~line 15-40) and add:

```typescript
import {
    // ... existing imports ...
    dispatchRelicModifyMoveSpeed,
    dispatchRelicModifyMoveStats,
    dispatchRelicOnHitEnemy,
} from "./studentSystemsHooks";
```

**2. Hook Into Move Execution (executeStrengthMove)**

Search for: `executeStrengthMove(`  
Find: `sprites.setDataString(hero, HERO_DATA.STR_PAYLOAD_ANIM, animKey || "")`  
Add **after that line:**

```typescript
// Allow student relics to modify per-move behavior
try {
    dispatchRelicModifyMoveStats({
        hero,
        move: { family: FAMILY.STRENGTH, button },
        stats,
        hitEnemies: []
    });
} catch (e) {
    console.error("[RELIC][ERROR] dispatchRelicModifyMoveStats:", e);
}
```

**3. Hook Into Hit Detection (Weapon/Projectile Overlap)**

Search for: `applyDamageToEnemyIndex(eIndex, dmg, heroIndex, hit);`  
Add **immediately before that line:**

```typescript
// Trigger student relic on-hit effects
try {
    dispatchRelicOnHitEnemy({
        hero,
        enemy,
        eIndex,
        damage: dmg,
        family,
        button,
        hitPacket: hit
    });
} catch (e) {
    console.error("[RELIC][ERROR] dispatchRelicOnHitEnemy:", e);
}
```

📄 **Full context with line numbers:** See [HeroEngineCoreEdits.md](HeroEngineCoreEdits.md)

---

## 🧪 Testing After Integration

**1. Build and run:**
```bash
npm run dev
```

**2. Open debug sandbox:**
```
debug.html?student=ChrisS
```

**3. Equip an amulet and test:**
- Speed mods work (Zephyrs +15%, Stones -10%)
- On-hit effects trigger (burn, poison, stuns, knockback)
- No `[RELIC][ERROR]` logs in console

**Expected behaviors:**
- **Tides:** Every 5 Strength = knockback; Intelligence = bubble trap
- **Zephyrs:** +15% speed + Strength boosts; Intelligence = tornado pull
- **Embers:** Burns on hit; every 3 Strength = stun
- **Venom:** Poison DoT + stacking debuffs (max 20%)
- **Stones:** -10% speed, +20% defense; Strength = shockwave + rock stun

---

## 🎨 Optional: VFX Integration

Currently amulet effects work but have no visuals. To add particle effects:

**Teacher needs to:**
1. Expose `VfxHelpers` to student code (pass in context or add to studentSystemsHooks)
2. Student can then spawn Water 150x150.png effect for Tides amulet

**Why it's not done yet:**
- VFX helpers (`vfxHelpers.spawnEffect()`) exist in core but aren't student-accessible
- Asset is ready: `assets/effects/otherEffects/cool spells not used yet/Water 150x150.png`
- TODOs in [amuletEffects.ts](amuletEffects.ts) mark where effects should spawn

---

## 📋 Other Optional Enhancements

1. **Debug Flag:** Add `DEBUG_RELIC_EFFECTS` to [debugFlags.ts](../../debugFlags.ts) for verbose logging
2. **Per-Hero Filtering:** Only run dispatches for equipped relics (currently all handlers run)

---

## 📞 Questions?

See [HeroEngineCoreEdits.md](HeroEngineCoreEdits.md) for detailed paste-ready code snippets.


