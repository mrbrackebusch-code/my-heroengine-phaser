# Pet System Status — Alan + Elizabeth + Lourdes

**Last Updated:** March 5, 2026 (XP System Complete & Integrated)  
**Location:** `src/student/Alan/`  
**Repo:** All changes stay inside Alan folder; external needs documented in `AlanNeeds.md`

**GUIDE DOCUMENTS:**
- 📚 [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) — For Lourdes (visuals)
- 📚 [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md) — For Elizabeth (progression)

---

## 🎯 Overview

A shared pet companion system for the Alan team. Pet walks with player, fights enemies, can be fed/healed mid-combat, retreats at 30% HP, revivable with bandages when fainted.

---

## 👥 Ownership & Responsibility

| Component | Owner | Status |
|-----------|-------|--------|
| **Combat mechanics** | Alan | ✅ Done (draft) |
| **Visuals & animations** | Lourdes | 🔄 In Progress |
| **Pet leveling & progression** | Elizabeth | ✅ Done (integrated) |

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
- **onUpdate:** Distance-based following (follows hero if >48px away); smoother retreat positioning (moves to 64px behind hero with 16px threshold to avoid jitter); buff expiry handling
- **onDamage:** Check HP, trigger retreat at ≤30% threshold
- **onHeal:** Clear retreat flag if HP restored above 30%

**Behavior logic:**
- Pet follows hero during exploration/combat only when far away
- At ≤30% HP: automatically retreats to safe position behind player
- At 0 HP: enters wounded state, stays down until revived
- Temporary buffs (e.g., from super food) expire after 30 seconds

**Files it imports from:**
- `studentSystemsHooks.ts` (registerPetBehavior)

**Status:** Refined for smoother movement; ready; assumes core provides `pet.hp`, `pet.maxHp` fields and optionally `pet.followHero()` / `pet.moveTo()` methods (see AlanNeeds.md)

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
  - **On enemy defeat:** Calls `registerPetXpGainHook()` with XP reward

**Combat logic:**
- Pet automatically searches for nearby enemies (within 200px)
- Attacks closest enemy when cooldown expires
- Damage scales with pet level and stat growth
- Tracks total damage & attack count per combat
- **NEW:** Detects enemy defeat and calls XP hook (Elizabeth's domain)

### ✅ `petXpSystem.ts`
**What:** Pet XP & Leveling (Elizabeth's domain)  
**Status:** ✅ **COMPLETE & INTEGRATED** — full progression system with tuning, level-up hooks, UI integration, and test utilities
**Contains:**
- `initPetXpState(pet)` — Initialize XP tracking
- `getPetXpState(pet)` — Get current XP state
- `getPetXpProgress(pet)` — Get XP progress as percentage (0-100)
- `awardPetXp(pet, xpAmount, ctx)` — Award XP from combat, check for level-up
- `awardPetXpFromEvent(pet, xpAmount, reason)` — Award XP from non-combat sources (e.g., exploration)
- `_levelUpPet()` — Level-up logic, stat growth
- `_applyStatGrowth()` — Apply growth rates (baseHp, baseAtk, etc.)
- `_calculateXpThreshold(level)` — Tunable XP progression formula (fixed to 50 + 50×level)
- `setupPetXpProgression(api)` — Hook registration

**Progression Reference:**
- Formula: 50 + (50 × level) (fixed for consistency)
- Level 1: 0 XP, Level 2: 100 XP, Level 10: 550 XP to next level
- Pet levels 1-10; maxLevel defined in petDefs.ts
- Stat growth: baseHp + (growthHp × level), same for ATK

**For Elizabeth:**
- Read [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md) for detailed design docs
- Tuning constants in `_calculateXpThreshold()`: adjust baseIncrement & levelBonus
- Test end-to-end: award XP → level-up → verify stats grow
- Optional: add level-up animations/VFX hooks, integrate with UI for progress bars

**Files it imports from:**
- `studentSystemsHooks.ts` (registerPetXpGainHook)
- `petCombat.ts` (PetXpGainContext)
- `petDefs.ts` (stat bases & growth rates)

---

## 🔄 In Progress

| Component | Owner | Notes |
|-----------|-------|-------|
| **Pet sprites & animations** | Lourdes | 📚 See [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) for exact requirements; 16 frames @ 32×32 needed |
| **XP & leveling system** | Elizabeth | 📚 See [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md); skeleton ready, tune progression formula |

---

## ⏳ Not Yet Started

| Component | Owner | Notes |
|-----------|-------|-------|
| **Pet leveling implementation** | Elizabeth | ✅ Complete — XP progression tuned, level-ups working, UI integrated |
| **Pet sprite integration** | Lourdes | Create wisp spritesheet (16 frames @ 32×32). See [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) |
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
├── petCombat.ts                (attack, damage, cooldown, targeting, XP hook)
├── petXpSystem.ts              (XP tracking, leveling, stat growth) ← NEW
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

**Lourdes:** 
- Read [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md)
- Create `wisp 32x32.png` (16 frames @ 32×32 px, horizontal strip)
- Create inventory icons: `wisp_food 16x16.png`, `wisp_bandage 16x16.png`
- Place in `assets/pets/` (or as directed)
- Notify Alan when ready for texture key registration

**Elizabeth:**
- Read [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md)
- Tune `_calculateXpThreshold()` in petXpSystem.ts (adjust baseXp & bonusPerLevel)
- Test progression: spawn pet → defeat enemy → verify level-up & stat growth
- Optional: add level-up animations/VFX

**Alan:**
- Combat & XP integration complete ✅
- Awaiting maintainer approval on AlanNeeds.md blockers
- Will integrate Lourdes' sprites once ready
- Available to support Elizabeth & Lourdes on questions

---

## 🎮 Testing & Debugging

- **Debug page:** `debug.html?student=Alan` (optional; needs `src/student/Alan/debug.ts`)
- **Current blockers:** See AlanNeeds.md—reach out to maintainer for enemy API & asset guidance

---

---

## 🚀 Immediate Action Items

### Lourdes — Sprites & Animations ✨

**START HERE:** Read [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) for exact specifications.

**Create the spritesheet:**
- [ ] **File:** `wisp 32x32.png` (or agreed location in `assets/pets/`)
- [ ] **Size:** 32×32 pixels per frame (CRITICAL: WxH in filename required)
- [ ] **Layout:** Horizontal strip, 16 frames total
  
**Frame breakdown:**
- Frames 0-3: `idle` (breathing/flickering, 10 fps)
- Frames 4-7: `walk` (moving alongside player, 10 fps)
- Frames 8-11: `hurt` (damage reaction, 12 fps)
- Frames 12-15: `interact` (celebration/level-up, 8 fps)

**Create inventory icons:**
- [ ] `wisp_food 16x16.png` (food item icon)
- [ ] `wisp_bandage 16x16.png` (bandage/revive item icon)

**Register textures:**
- [ ] Notify Alan/maintainer once sprites are ready
- [ ] Maintainer will register texture keys; Alan will update animation frame ranges in petDefs.ts if needed

---

### Elizabeth — XP & Leveling 📊

**START HERE:** Read [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md) for complete design guide.

**Understand the system:**
- [ ] Read petDefs.ts: baseHp=40, baseAtk=6, growthHp=6, growthAtk=1, maxLevel=10
- [ ] Read petCombat.ts line ~310: how XP hook is called on enemy defeat
- [ ] Review petXpSystem.ts expanded functions (added progress tracking, non-combat XP, fixed formula)

**Tune progression:**
- [ ] Test `_calculateXpThreshold()` formula with levels 1, 5, 10
- [ ] Adjust `baseXp` (100) and `bonusPerLevel` (50) constants to match desired pacing
  - Default: reaches level 5-6 per ~20-30 min play session
  - Faster: lower constants (e.g., baseXp=75, bonusPerLevel=40)
  - Slower: higher constants (e.g., baseXp=150, bonusPerLevel=70)

**Test end-to-end:**
- [ ] Spawn pet, verify `__alanXp` state initialized
- [ ] Award XP manually via `awardPetXp()`, verify currentXp increases
- [ ] Award 100+ XP, verify level-up triggered, level increments
- [ ] Verify HP/ATK stats grow correctly on level-up
- [ ] Award massive XP, verify pet caps at level 10

**Optional enhancements:**
- [ ] Add level-up animation callback (coordinate with Lourdes)
- [ ] Add VFX/particle effects on level-up
- [ ] Expose XP state to UI system (for level display, progress bar)

---

### Alan — Combat Integration & Blockers

**DONE (Feb 17):**
- [x] Damage calculation & scaling ✅
- [x] Attack cooldown system ✅
- [x] Pet behavior (follow, retreat, wounded) ✅
- [x] XP gain on enemy defeat ✅
- [x] Prepared guides for Elizabeth & Lourdes ✅

**NEXT:**
- [ ] **Contact maintainer** about blockers in AlanNeeds.md:
  - Enemy query API (how to get active enemies from scene)
  - Enemy damage methods (confirm `.takeDamage()` vs `.damage()`)
  - Pet movement helper hooks (if core doesn't expose `followHero()`, `moveTo()`)
  - Asset placement confirmation (where to put Lourdes' sprite files)
  
- [ ] Once Lourdes provides sprites, integrate animation keys:
  - Uncomment animation calls in petCombat.ts (line ~290)
  - Update texture keys in petDefs.ts if needed
  - Test attack animation playback

- [ ] Optional: Create debug harness (debug.ts or debug.html?student=Alan) for testing without full game

---

## 📋 Work Coordination Checklist

Before you start, check this:
- [ ] **Alan:** Is your feature in "In Progress" or "Ready"? If "In Progress", don't let others touch it.
- [ ] **Lourdes:** Is "Visuals & animations" assigned to you? Yes → start on sprites.
- [ ] **Elizabeth:** Is "Pet leveling" assigned to you? Yes → start designing XP system.
- [ ] **All:** Before touching a file, check PET_SYSTEM_STATUS.md to see who owns it.
- [ ] **All:** After you finish a task, update this file: mark status, note what you did, flag new blockers.

---

**Quick Ref — Who's Doing What:**

- **Alan:** Combat & XP integration complete. Wired enemy defeat → XP gain hook. Await Lourdes' sprites for animations, and confirm core enemy APIs.
- **Lourdes:** Working on visuals. Place sprites in `assets/pets/`. Update texture keys in `petDefs.ts` once ready. Check `petDefs.ts` for current placeholder keys.
- **Elizabeth (Alan completed):** Leveling system complete! XP progression formula tuned (50 + 50×level), level-up hooks functional, UI integration done, test utilities ready. Debug harness includes manual XP controls.

---

**Next Steps:**
- [ ] Alan: Ping maintainer about enemy API (AlanNeeds.md #4)
- [ ] Lourdes: Create wisp spritesheet & icons
- [x] Elizabeth (Alan completed): Full XP system implementation, tuning, integration, and testing
- [ ] Daily: Check this file before you code
