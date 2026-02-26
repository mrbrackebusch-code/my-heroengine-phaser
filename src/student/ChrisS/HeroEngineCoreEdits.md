Purpose
=======
This file contains exact, paste-ready code snippets and precise insertion hints your maintainer (teacher) can apply to `src/HeroEngineInPhaser.ts` to activate student relic effects. These edits are minimal and safe (non-invasive).

Apply only by a maintainer with write access to core files.

-----

Summary (what to add)
---------------------
Add 4 small integration points into `HeroEngineInPhaser.ts`:

1) Import the dispatch functions from `studentSystemsHooks` near the top imports.
2) Call `dispatchRelicModifyMoveSpeed(...)` after final move stats are calculated.
3) Call `dispatchRelicModifyMoveStats(...)` inside move execution functions (STR/AGI/INT) after traits/stats are finalized and before the move begins.
4) Call `dispatchRelicOnHitEnemy(...)` where projectiles/weapon overlaps detect enemy hits (before/after `applyDamageToEnemyIndex`).
5) (Optional but recommended) Call `dispatchRelicBeforeHeroDamage(...)` at start of `applyDamageToHeroIndex(...)`.

These will wire student-registered relic handlers (in `src/student/*`) into gameplay.

-----

Paste-ready code snippets
------------------------

1) Import (add near other top-level imports, e.g., after other local imports):

```ts
// student relic dispatch hooks (studentSystemsHooks.ts)
import { dispatchRelicModifyMoveSpeed, dispatchRelicModifyMoveStats, dispatchRelicOnHitEnemy, dispatchRelicBeforeHeroDamage } from "./studentSystemsHooks";
```

Suggested context to find the correct location (search for similar imports):
- Search for `applyStudentRelicDefinitions` or the top-of-file import block.


2) Move speed integration (call after finalizing `stats` for a move)

Where: any function that finalizes per-move `stats` before the move begins.
Examples:
- `calculateStrengthStats()` (if a single-return spot exists after computation)
- or right after `calculateMoveStats(baseTime, traits)` result is assembled in callers.

Snippet (paste after the stats object exists and before it's used):

```ts
// Let student relics modify move speed/stat
try {
    dispatchRelicModifyMoveSpeed({ hero, stats, family: FAMILY.STRENGTH, button: "" });
} catch (e) {
    console.error("[RELIC][ERROR] dispatchRelicModifyMoveSpeed:", e);
}
```

Notes:
- Replace `FAMILY.STRENGTH` with the appropriate family constant in context (or pass the variable `family`).
- Ensure `hero` and `stats` variables are available in scope (they typically are where `stats` was computed).


3) Move execution integration (STR/AGI/INT)

Where: near the start of `executeStrengthMove()`, `executeAgilityMove()`, and intellect execution paths — after the payload/traits/stats are snapshot and before `beginStrengthCharge()` / `spawnAgilityThrustProjectile()` / spell start.

Snippet (paste where `hero`, `move` metadata, and `stats` are known):

```ts
// Allow relics to modify move-specific behavior before the action starts
try {
    dispatchRelicModifyMoveStats({
        hero,
        move: { family: FAMILY.STRENGTH, button }, // adjust family/button appropriately
        stats,
        hitEnemies: [] // will be populated by overlap/hit logic later
    });
} catch (e) {
    console.error("[RELIC][ERROR] dispatchRelicModifyMoveStats:", e);
}
```

Notes:
- `hitEnemies` is provided for handlers that need to act on enemies hit; the core overlap/hit logic should pass a populated list when available via `dispatchRelicOnHitEnemy` (see below).


4) On-hit integration (projectile / weapon overlap handling)

Where: inside the overlap handler that calls `applyDamageToEnemyIndex(eIndex, dmg, heroIndex, hit)` — call the dispatch either immediately before or immediately after the `applyDamageToEnemyIndex` call.

Snippet (example placed before `applyDamageToEnemyIndex`):

```ts
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

// Then apply damage as usual
applyDamageToEnemyIndex(eIndex, dmg, heroIndex, hit);
```

Notes:
- `hero`/`heroIndex` should be the attacker; if `hero` isn't available (e.g., environmental damage), pass `hero` as `null` or omit.


5) Defensive integration (optional but recommended)

Where: at the top of `applyDamageToHeroIndex(heroIndex, amount, source)` — call `dispatchRelicBeforeHeroDamage` so relics can modify incoming damage or trigger defensive effects.

Snippet:

```ts
try {
    dispatchRelicBeforeHeroDamage({ hero: heroes[heroIndex], damage: amount, source });
} catch (e) {
    console.error("[RELIC][ERROR] dispatchRelicBeforeHeroDamage:", e);
}
```


Quick locating hints
--------------------
- Top imports: search for `applyStudentRelicDefinitions` or the long import block at file top.
- Stats calculation: search for `calculateStrengthStats(` or `calculateMoveStats(`.
- Move execution: search for `function executeStrengthMove(`, `executeAgilityMove(`, `executeIntellectMove(`.
- On-hit: search for `applyDamageToEnemyIndex(` in the projectile/weapon overlap sections (there are multiple call sites; prefer the one inside the projectile overlap handler where `hero` and `weapon` are in scope).
- applyDamageToHeroIndex: search for `function applyDamageToHeroIndex(`.


Minimal testing checklist for maintainer
---------------------------------------
- Build and run the debug sandbox: `debug.html?student=ChrisS` (spawn a hero with an amulet equipped).
- Verify speed mods: equip Amulet of Zephyrs and confirm movespeed changes.
- Verify on-hit effects: perform Strength/Intelligence moves and observe DoT, stuns, knockback placeholders.
- Inspect console for any `[RELIC][ERROR]` logs.


If you want, I can also generate a ready-to-apply git patch file (`.patch`) containing these edits; I did not modify core files myself per repo rules. Paste this file into the maintainer's repo and apply with `git apply` when they're ready.

-----

Contact message (copy/paste) for teacher
----------------------------------------
Use the following message to ask the teacher to apply the edits:

"Hi — to activate student-created relics (amulets) I added student-side handlers and dispatchers. Please apply the four small changes in `src/HeroEngineInPhaser.ts` described in `src/student/ChrisS/HeroEngineCoreEdits.md` (imports + calls to `dispatchRelicModifyMoveSpeed`, `dispatchRelicModifyMoveStats`, `dispatchRelicOnHitEnemy`, and `dispatchRelicBeforeHeroDamage`). The doc includes paste-ready snippets and exact locating hints. Let me know if you prefer I produce a single git patch you can apply."
