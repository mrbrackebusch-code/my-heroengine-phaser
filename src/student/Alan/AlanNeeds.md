Alan student system external requests

**Last Updated:** March 5, 2026 (XP System Complete, Awaiting Sprites)

**COMPLETION STATUS:**
- ✅ Combat mechanics: DONE
- ✅ Pet behavior: DONE
- ✅ Inventory & items: DONE
- ✅ XP & leveling: DONE (Alan on behalf of Elizabeth)
- ⏳ Pet sprites: PENDING (Lourdes)

---

1) Pet assets (CRITICAL for visuals)
- Please add real pet spritesheets and icons under `assets/` (or tell us where to place them). Suggested paths and keys:
	- assets/pets/wisp 32x32.png — placeholder exists (blue circle), needs replacement with custom art
	- assets/pets/wisp_food 16x16.png — placeholder exists
	- assets/pets/wisp_bandage 16x16.png — placeholder exists
	- assets/pets/wisp_super_food 16x16.png — placeholder exists
	
   **For Lourdes:** See SPRITE_INTEGRATION_GUIDE.md for exact specifications.

2) Optional core helper hooks
- The scaffolded behavior assumes the runtime pet object might support helper methods like `followHero(hero, opts)` and `moveTo(x,y)`. If the core does not expose these, please provide a small helper hook that student systems can call to request "move pet near hero" behavior. Suggested hook signature:

	```ts
	requestPetMove(petEntity: any, targetX: number, targetY: number, options?: any): void
	```

3) Combat integration guidance
- If there are recommended fields or method names on pet runtime objects (for example `pet.hp`, `pet.maxHp`, `pet.stats`, `pet.moveTo`, `pet.followHero`), please document them or expose a small API so student hooks can update HP and request positioning reliably.

4) Pet combat system hooks ✅ **VERIFIED & WORKING**
- We've built a pet combat system (petCombat.ts) that:
  - Calculates damage from `pet.stats.baseAtk` + growth + variance ✅
  - Tracks attack cooldown (1500ms - 50ms per ATK point, reduced by level) ✅
  - Needs access to active enemies in the current scene to auto-target ✅ (implemented with fallback queries)
  - Calls `target.takeDamage(dmg)` or `target.damage(dmg)` or reduces `target.hp` directly ✅ (implemented with fallback)
  - **Triggers XP hook on enemy defeat** ✅ **INTEGRATED WITH LEVELING SYSTEM**
  
  **Status:** Combat system fully functional and wired to XP progression.

5) Asset-loading preference
- If you want student-supplied assets to be registered automatically, confirm the preferred folder and naming convention. Our scaffold uses namespaced keys generated via the student API; we'll swap real texture keys once you confirm placement.

**RECENT COMPLETIONS:**
- Pet behavior refined: distance-based following, smoother retreat, buff expiry. ✅
- XP system expanded & completed: full progression formula, level-up hooks, UI integration, test utilities. ✅
- Debug harness enhanced: manual XP controls, live stat display, camera flash on level-up. ✅
- Integration verified: combat → XP flow confirmed working, all modules compile cleanly. ✅

**NEXT STEPS FOR TEAM:**
1. **Lourdes:** Create pet spritesheet and replace placeholder
   - See SPRITE_INTEGRATION_GUIDE.md
   - 16 frames @ 32x32, horizontal strip
   - Once ready: animations will trigger on level-up (already wired)

2. **Maintainer (if needed):** Confirm asset placement and help with sprite registration

3. **Alan/System:** Ready to integrate sprites and test full game loop

---

**TEST THE SYSTEM NOW:**
- Open `debug.html?student=Alan`
- Click "+50 XP", "+100 XP" buttons to test level-up mechanics
- Check console for detailed logs
- See QUICK_START_XP_TESTING.md for full verification steps

If any of these require core edits, please review and apply; otherwise the pet system is production-ready pending sprite completion.

