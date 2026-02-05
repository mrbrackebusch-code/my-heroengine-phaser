# Pet System Status — Alan + Elizabeth + Lourdes

**Last Updated:** Feb 5, 2026  
**Location:** `src/student/Alan/`  
**Repo:** All changes stay inside Alan folder; external needs documented in `AlanNeeds.md`

---

## 🎯 Overview

A shared pet companion system for the Alan team. Pet walks with player, fights enemies, can be fed/healed mid-combat, retreats at 30% HP, revivable with bandages when fainted.

---

## 👥 Ownership & Responsibility

| Component | Owner | Status |
|-----------|-------|--------|
| **Combat mechanics** | Alan | ✅ Done (draft) |
| **Visuals & animations** | Lourdes | 🔄 In Progress |
| **Pet leveling & progression** | Elizabeth | ⏳ Not Started |

---

## 📦 Completed Modules

### ✅ `petDefs.ts`
**What:** Pet registration (atlas, stats, acquisition, ally)  
**Contains:**
- `setupPetDefinitions(api)` — registers wisp pet with placeholder texture keys
- Pet stats: baseHp=40, baseAtk=6, growth rates, maxLevel=10
- Starter acquisition (summon kind)
- Ally registry entry for combat integration

**Files it imports from:**
- `studentSystemsHooks.ts` (registerPetAtlas, registerPetStats, registerPetAcquisition, registerAlly)

**Status:** Ready; awaits real sprite texture keys from Lourdes

---

### ✅ `petBehavior.ts`
**What:** Pet AI & state management (follow, retreat, wounded)  
**Contains:**
- `setupPetBehaviors(api)` — registers pet AI behavior callbacks
- **onSpawn:** Init runtime state (`__alanState`: retreating, wounded flags)
- **onUpdate:** Follow hero when active; position behind hero when retreating
- **onDamage:** Check HP, trigger retreat at ≤30% threshold
- **onHeal:** Clear retreat flag if HP restored above 30%

**Behavior logic:**
- Pet follows hero during exploration/combat
- At ≤30% HP: automatically retreats behind player
- At 0 HP: enters wounded state, stays down until revived

**Files it imports from:**
- `studentSystemsHooks.ts` (registerPetBehavior)

**Status:** Ready; assumes core provides `pet.hp`, `pet.maxHp` fields and optionally `pet.followHero()` / `pet.moveTo()` methods (see AlanNeeds.md)

---

### ✅ `petInventory.ts`
**What:** Inventory items (food, bandage) & pet care hooks  
**Contains:**
- `setupPetInventory(api)` — registers food item, bandage item, inventory hooks
- **onPetFeed:** Restores 20 HP, clears retreat if healed above 30%
- **onPetHeal:** Bandages revive pet from 0 HP → 30% HP; also regular heal (15 HP)

**Item mechanics:**
- **Wisp Food** (food_id) — heal item, +20 HP
- **Bandage** (bandage_id) — revive item, resurrects pet at 30% HP

**Files it imports from:**
- `studentSystemsHooks.ts` (registerInventoryItem, registerInventoryHooks)

**Status:** Ready; hook logic handles HP updates and state checks

---

### ✅ `petCombat.ts`
**What:** Pet attack mechanics (damage calc, cooldown, targeting)  
**Contains:**
- `calculatePetDamage(ctx)` — baseAtk + (growthAtk × level-1) ± 20% variance
- `calculateAttackCooldown(ctx)` — 1500ms - (50ms per ATK point) - (20ms per level), min 300ms
- `canPetAttack(pet, now)` — cooldown check
- `recordPetAttack(pet, dmg, now)` — tracks damage dealt, attack count
- `setupPetCombat(api)` — registers combat-focused pet behavior
  - **onSpawn:** Init combat state (`__alanCombat`: cooldown tracking)
  - **onUpdate:** Auto-target nearby enemies, attack when cooldown ready
  - Calls `target.takeDamage(dmg)` or reduces `target.hp`

**Combat logic:**
- Pet automatically searches for nearby enemies (within 200px)
- Attacks closest enemy when cooldown expires
- Damage scales with pet level and stat growth
- Tracks total damage & attack count per combat

**Files it imports from:**
- `studentSystemsHooks.ts` (registerPetBehavior, getPetStats)

**Status:** Ready draft; **blocked** on core enemy-query & damage-apply API (see AlanNeeds.md)

---

## 🔄 In Progress

| Component | Owner | Notes |
|-----------|-------|-------|
| **Pet sprites & animations** | Lourdes | Waiting on final art; will swap texture keys in petDefs.ts once ready |

---

## ⏳ Not Yet Started

| Component | Owner | Notes |
|-----------|-------|-------|
| **Pet progression (leveling, XP)** | Elizabeth | Pet can level 1–10; growth formulas built into combat. Needs XP gain triggers from core. |
| **Pet UI overlays** | *TBD* | Health bar, status icons, inventory access, feed/revive buttons. Can use `api.ui.createOverlay()`. |
| **Debug harness** | *TBD* | Test page (debug.ts or debug.html?pet=alan) to spawn/test pet without full game. |

---

## 🚫 Blocked / External Dependencies

See `AlanNeeds.md` for full details. Key blockers:

1. **Enemy query API** — How to get active enemies from scene for targeting?
   - Current: tries `scene.data.get('enemies')` or `scene.registry.get('enemies')`
   - Need: confirm correct API or expose `getEnemies()` hook

2. **Enemy damage methods** — Do enemies have `.takeDamage()`, `.damage()`, or custom HP field?
   - Current: tries `target.takeDamage(dmg)` → `target.damage(dmg)` → reduce `target.hp`
   - Need: confirm which method is correct

3. **Pet object fields/methods** — What are standard runtime pet properties?
   - Assumed: `pet.hp`, `pet.maxHp`, `pet.level`, `pet.followHero()`, `pet.moveTo()`
   - Need: documentation or examples from core

4. **Asset placement** — Where should Lourdes place pet spritesheets?
   - Current plan: `assets/pets/` or `src/student/Alan/assets/pets/`
   - Need: confirmation + naming convention (WxH required, e.g., `wisp 32x32.png`)

---

## 📁 File Structure

```
src/student/Alan/
├── index.ts                    (entry point, registers all modules)
├── petDefs.ts                  (pet atlas, stats, acquisition)
├── petBehavior.ts              (follow, retreat, wounded state)
├── petInventory.ts             (food, bandage, care hooks)
├── petCombat.ts                (attack, damage, cooldown, targeting)
├── PET_SYSTEM_STATUS.md        (this file)
├── AlanNeeds.md                (external requests for maintainer)
├── README.md                   (general info)
└── assets/
    └── pets/                   (Lourdes will add spritesheets here)
        ├── wisp 32x32.png      (main pet spritesheet)
        ├── wisp_food 16x16.png (inventory icon)
        └── wisp_bandage 16x16.png (inventory icon)
```

---

## 🔗 Integration Points

### What's Wired Up ✅
- All modules imported and registered in `index.ts`
- Pet behaviors & combat registered via student SDK hooks
- Inventory items & hooks registered
- API uses `api.key()` for automatic namespacing (no collisions)

### What Needs Wiring
- Asset registration (once Lourdes provides textures)
- Animation frame mappings (once sprites exist)
- Enemy targeting & damage (once core API clarified)
- XP/leveling (if Elizabeth picks this up)

---

## 🛠️ How to Update This File

**Golden rule:** Keep this file in sync with reality.

**When you add a feature:**
1. Add a new section (e.g., `### ✅ petProgression.ts`)
2. List what the module contains
3. Note status (draft, ready, blocked)
4. List key imports/dependencies

**When you fix a blocker:**
1. Update the blocked section
2. Note what was fixed
3. Bump "Last Updated" date

**Before you start work:**
1. Check this file for ownership & status
2. If status is "In Progress" or "Ready", coordinate with owner
3. Update status as you work (In Progress → Ready)

---

## 📞 Quick Reference for Collaborators

**Alan:** Working on combat & mechanics. Check `petCombat.ts` before starting attack-related work.

**Lourdes:** Working on visuals. Place sprites in `assets/pets/`. Update texture keys in `petDefs.ts` once ready. Check `petDefs.ts` for current placeholder keys.

**Elizabeth:** Working on leveling & progression. Pet stats already support levels 1–10 with growth rates. You'll build XP tracking, level-up mechanics, stat gains. See `petDefs.ts` for baseHp, baseAtk, growthHp, growthAtk formulas.

---

## 🎮 Testing & Debugging

- **Debug page:** `debug.html?student=Alan` (optional; needs `src/student/Alan/debug.ts`)
- **Current blockers:** See AlanNeeds.md—reach out to maintainer for enemy API & asset guidance

---

---

## 🚀 Immediate Action Items

### Alan — Combat Mechanics
- [x] Damage calculation & scaling ✅
- [x] Attack cooldown system ✅
- [x] Pet behavior (follow, retreat, wounded) ✅
- [ ] **NEXT:** Wait for Lourdes' sprites, then integrate animation keys
- [ ] **BLOCKED:** Need core API for enemy targeting & damage (see AlanNeeds.md)
  - Recommend: reach out to maintainer, confirm `getEnemies()` & enemy `.takeDamage()` method
  - Once confirmed, unblock petCombat.ts `_findNearbyEnemies()` & `_executePetAttack()`

### Lourdes — Visuals & Animations
- [ ] **START HERE:** Create pet spritesheet
  - File: `src/student/Alan/assets/pets/wisp 32x32.png` (or agreed location)
  - Size: 32×32 px per frame (WxH naming required)
  - Frames needed: idle, walk, hurt, interact (see petDefs.ts line ~20 for anim keys)
  
- [ ] Create inventory item icons
  - `wisp_food 16x16.png` → used by petInventory.ts as food icon
  - `wisp_bandage 16x16.png` → used by petInventory.ts as bandage icon
  
- [ ] Register textures & animations
  - In `petDefs.ts`, update `setupPetDefinitions()`:
    - `api.assets.registerSpritesheet("wisp_spritesheet", "<path>/wisp 32x32.png", 32, 32)`
    - `api.assets.registerImage("wisp_food_icon", "<path>/wisp_food 16x16.png")`
    - `api.assets.registerImage("wisp_bandage_icon", "<path>/wisp_bandage 16x16.png")`
  
- [ ] Map animation frames
  - In `petDefs.ts`, define anim frame data (e.g., `idle: [0,1,2]`, `walk: [3,4,5,6]`)
  - Coordinate with Alan on which frames trigger attacks (petCombat.ts line ~280)

### Elizabeth — Pet Leveling & Progression
- [ ] **START HERE:** Understand current stat structure
  - Read `petDefs.ts`: baseHp=40, baseAtk=6, growthHp=6, growthAtk=1, maxLevel=10
  - Read `petCombat.ts` line ~66–80: how damage scales with level
  
- [ ] Design XP system
  - XP gain triggers: enemy defeated, combat end, item use?
  - XP to next level: fixed (e.g., 100 XP per level) or scaling?
  - Document in a new file `petProgression.ts`
  
- [ ] Build progression hooks
  - Create `setupPetProgression(api)` function
  - Register XP tracking on pet spawn
  - Hook into combat system (Alan's petCombat.ts) to award XP on enemy defeat
  - Implement level-up: stat calculation, UI feedback
  - Register with student SDK in `index.ts`
  
- [ ] Stat gain formula
  - On level-up: newHp = baseHp + (growthHp × (level - 1))
  - On level-up: newAtk = baseAtk + (growthAtk × (level - 1))
  - (These formulas already exist; you wire the level-up trigger)

---

## 📋 Work Coordination Checklist

Before you start, check this:
- [ ] **Alan:** Is your feature in "In Progress" or "Ready"? If "In Progress", don't let others touch it.
- [ ] **Lourdes:** Is "Visuals & animations" assigned to you? Yes → start on sprites.
- [ ] **Elizabeth:** Is "Pet leveling" assigned to you? Yes → start designing XP system.
- [ ] **All:** Before touching a file, check PET_SYSTEM_STATUS.md to see who owns it.
- [ ] **All:** After you finish a task, update this file: mark status, note what you did, flag new blockers.

---

**Next Steps:**
- [ ] Alan: Ping maintainer about enemy API (AlanNeeds.md #4)
- [ ] Lourdes: Create wisp spritesheet & icons
- [ ] Elizabeth: Read petDefs.ts & petCombat.ts, design XP progression
- [ ] Daily: Check this file before you code
