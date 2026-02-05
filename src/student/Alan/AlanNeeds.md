Alan student system external requests

1) Pet assets
- Please add real pet spritesheets and icons under `assets/` (or tell us where to place them). Suggested paths and keys:
	- assets/pets/wisp_32x32.png  (frames must match WxH naming)
	- assets/pets/wisp_food_16x16.png
	- assets/pets/wisp_bandage_16x16.png

2) Optional core helper hooks
- The scaffolded behavior assumes the runtime pet object might support helper methods like `followHero(hero, opts)` and `moveTo(x,y)`. If the core does not expose these, please provide a small helper hook that student systems can call to request "move pet near hero" behavior. Suggested hook signature:

	```ts
	requestPetMove(petEntity: any, targetX: number, targetY: number, options?: any): void
	```

3) Combat integration guidance
- If there are recommended fields or method names on pet runtime objects (for example `pet.hp`, `pet.maxHp`, `pet.stats`, `pet.moveTo`, `pet.followHero`), please document them or expose a small API so student hooks can update HP and request positioning reliably.

4) Pet combat system hooks
- We've built a pet combat system (petCombat.ts) that:
  - Calculates damage from `pet.stats.baseAtk` + growth + variance
  - Tracks attack cooldown (1500ms - 50ms per ATK point, reduced by level)
  - Needs access to active enemies in the current scene to auto-target
  - Calls `target.takeDamage(dmg)` or `target.damage(dmg)` or reduces `target.hp` directly
  
  **What we need:**
  - A way to query "current enemies" from the scene (scene.data.get, scene.registry, or a getEnemies() hook)
  - Confirmation that enemy objects have `takeDamage()` or `damage()` methods (or expose their HP field)
  - Optional: hooks to trigger pet attack animations once sprites are ready

5) Asset-loading preference
- If you want student-supplied assets to be registered automatically, confirm the preferred folder and naming convention. Our scaffold uses namespaced keys generated via the student API; we'll swap real texture keys once you confirm placement.

If any of these require core edits, please review and apply; otherwise we can continue building more pet behaviors and UI inside `src/student/Alan/`.

