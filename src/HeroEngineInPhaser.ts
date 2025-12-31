
// -----------------------------------------------------
// MakeCode-compatible randint helper for Phaser build
// (safe in Arcade too; just shadows the built-in)
// -----------------------------------------------------
function randint(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --------------------------------------------------------------
// Sprite kinds - type declarations for TS (no top-level create())
// --------------------------------------------------------------
namespace SpriteKind {
    export let Hero: number
    export let HeroWeapon: number
    export let HeroAura: number
    export let EnemySpawner: number
    export let SupportBeam: number
    export let SupportIcon: number
    export let Wall: number
    export let ShopNpc: number
    export let ShopItem: number
    export let ShopUI: number

}

// =====================================================================
// PHASER-ONLY SHIM – DO NOT COPY THIS BLOCK INTO MAKECODE ARCADE
// =====================================================================
(function phaserSpriteKindShim() {
    // In the Phaser build, this module has its own SpriteKind object
    // that does NOT see Player/Enemy created in arcadeCompat.ts.
    // Here we force this module's SpriteKind to use the same ids
    // that arcadeCompat expects.

    const SK: any = SpriteKind as any;

    // Match arcadeCompat's ids
    if (SK.Player == null) SK.Player = 1;
    if (SK.Enemy == null) SK.Enemy = 2;

    // Stabilize custom kinds for the compat layer (fixed ids)
    if (SK.Hero == null) SK.Hero = 50;
    if (SK.HeroWeapon == null) SK.HeroWeapon = 51;
    if (SK.HeroAura == null) SK.HeroAura = 52;
    if (SK.EnemySpawner == null) SK.EnemySpawner = 53;
    if (SK.SupportBeam == null) SK.SupportBeam = 54;
    if (SK.SupportIcon == null) SK.SupportIcon = 55;
    if (SK.Wall == null) SK.Wall = 56;

    // NEW: Shop skeleton kinds (fixed ids)
    if (SK.ShopNpc == null) SK.ShopNpc = 57;
    if (SK.ShopItem == null) SK.ShopItem = 58;
    if (SK.ShopUI == null) SK.ShopUI = 59;

    // ------------------------------------------------------------
    // Polyfill SpriteKind.create() if this module doesn't have it
    // (Prevents crashes if any code still calls SpriteKind.create())
    // ------------------------------------------------------------
    if (typeof SK.create !== "function") {
        let maxId = -1;
        for (const k of Object.keys(SK)) {
            const v = SK[k];
            if (typeof v === "number" && isFinite(v)) {
                if (v > maxId) maxId = v;
            }
        }
        SK.__nextKindId = (maxId + 1) | 0;

        SK.create = function (): number {
            const id = (SK.__nextKindId | 0);
            SK.__nextKindId = (id + 1) | 0;
            return id;
        };
    }
})();
// =====================================================================
// END PHASER-ONLY SHIM
// =====================================================================


(function phaserSpriteKindShim() {
    const SK: any = SpriteKind as any;

    if (SK.Player == null) SK.Player = 1;
    if (SK.Enemy == null) SK.Enemy = 2;

    SK.Hero = 50;
    SK.HeroWeapon = 51;
    SK.HeroAura = 52;
    SK.EnemySpawner = 53;
    SK.SupportBeam = 54;
    SK.SupportIcon = 55;
    SK.Wall = 56;

    // NEW: shop phase kinds (fixed ids in Phaser build)
    SK.ShopNpc = 57;
    SK.ShopItem = 58;
    SK.ShopUI = 59;
})();


// =====================================================================
// END PHASER-ONLY SHIM
// =====================================================================


// --------------------------------------------------------------
// HERO ENGINE V20 – FUNCTION INDEX
// --------------------------------------------------------------
//
// SECTION 0 - UPDATE STATUS AND COMMENTARY
//   (no top-level functions)
//
// SECTION 1 - ENGINE CONSTANTS, DATA KEYS & GLOBALS
//   (no top-level functions)
//
// SECTION 2 - HELPER FUNCTIONS
//   makeBaseStats() – Allocate and initialize a STAT[] array with defaults for a single move.
//   getBaseMoveDurationMs() – Return baseline move duration in ms for a given button/family.
//   getBasePower() – Return baseline damage/power budget for a button/family.
//   animIdToKey() – Convert a numeric animation ID into a string key for hero animations.
//   distanceTo() – Compute Euclidean distance between two sprites.
//   distSqPointToSprite() – Compute squared distance from a world point to a sprite's center.
//   worldPointAlongRay() – Return a point along a ray from a sprite, given direction and distance.
//   tintImageReplace() – Clone an image while remapping a color (for aura/tint effects).
//   getAimVectorForHero() – Compute normalized aim vector for a hero from facing/inputs.
//   r2() – Round a value to 2 decimal places (numeric helper).
//   r3() – Round a value to 3 decimal places (numeric helper).
//
//
// SECTION 2.5 - TILEMAP AND WORLD GENERATION
//    initWorldTileMap() - Run the tilemap functions (called from the "game start" function)
//    createTileMap2D() - Makes the tilemap array
//    createWallTileImage() - Makes an image for the walls in the tilemap array
//    buildTilesIntoSprites() - Makes walls where they are supposed to be in the tilemap
//    readTile() - Accesses the array and determines what tile is there
//
//
// SECTION 3 - STUDENT HOOKS: HERO LOGIC & ANIMATION - NO LONGER HERE. THEY ARE GONE. They have been moved to a project that uses the Hero Engine extension.
//   hero1Logic() – Student-editable logic for Hero 1's behavior each frame.
//   hero2Logic() – Student-editable logic for Hero 2's behavior each frame.
//   hero3Logic() – Student-editable logic for Hero 3's behavior each frame.
//   hero4Logic() – Student-editable logic for Hero 4's behavior each frame.
//   animateHero1() – Student-editable animation for Hero 1 based on state/facing.
//   animateHero2() – Student-editable animation for Hero 2 based on state/facing.
//   animateHero3() – Student-editable animation for Hero 3 based on state/facing.
//   animateHero4() – Student-editable animation for Hero 4 based on state/facing.
//
// SECTION 4 - PLAYER SPRITES CREATION AND CONTROL
//   runHeroLogicForHero() – Call the appropriate heroXLogic() for the given hero index.
//   calculateMoveStatsForFamily() – Dispatch to calculateXStats() for the chosen family/button.
//   doHeroMoveForPlayer() – Entry point when a player presses a move button; resolves family, spends mana, and executes the move.
//   heroImageForPlayer() – Return the base sprite image for the hero controlled by a given player.
//   createHeroForPlayer() – Create and initialize a hero sprite for a specific player index.
//   setupHeroes() – Create all hero sprites, assign them to players, and initialize hero arrays.
//   lockHeroControls() – Mark a hero as busy and prevent input until a given time.
//   unlockHeroControls() – Clear a hero's busy flag and restore control.
//   refreshHeroController() – Rebind hardware controllers to hero sprites (e.g., after respawn/reset).
//   getHeroDirectionName() – Return a string like "up"/"down"/"left"/"right" for current hero facing.
//   updateHeroFacingsFromVelocity() – Update hero facing direction based on its velocity vector.
//   callHeroAnim() – Call the appropriate animateHeroX() helper for the given hero index.
//
// SECTION 5 - HERO STATS AND UI
//   initHeroHP() – Initialize hero HP, HP bar sprite, and HP-related data fields.
//   updateHeroHPBar() – Update hero HP bar width/position based on current HP.
//   initHeroMana() – Initialize hero mana pool and mana bar sprite for a hero.
//   updateHeroManaBar() – Update hero mana bar to reflect current mana value.
//   flashHeroManaBar() – Temporarily flash the hero mana bar (e.g., on insufficient mana).
//   applyDamageToHeroIndex() – Apply damage to a hero, clamp HP, and trigger HP-related effects.
//   flashHeroOnDamage() – Briefly flash the hero sprite when taking damage.
//   regenHeroManaAll() – Regenerate mana for all heroes each tick/frame.
//   showDamageNumber() – Spawn a floating text sprite showing damage dealt at a position.
//   createAuraImageFromHero() – Generate an aura outline image based on a hero's sprite bitmap.
//   ensureHeroAuraSprite() – Ensure a hero has an attached aura sprite and create it if missing.
//   updateHeroOverlays() – Update aura and combo meter and agility indicator sprites (position, visibility, style) for all heroes.
//
// SECTION 6 - ON OVERLAP - COLLISIONS AND INTERACTIONS BETWEEN KINDS
//   hasSignificantOverlap() – Return true if two sprites overlap enough to count as a hit/collision.
//
// SECTION S - STRENGTH MOVE MODULE
//   calculateStrengthStats() – Compute STAT[] for the Strength family based on base time and traits.
//   executeStrengthMove() – Perform a Strength move: spend mana, lock hero, and schedule the smash.
//   getStrengthInnerRadiusForHero() – Return the inner radius for the Strength smash hit area around a hero.
//   findHeroLeadingEdgeDistance() – Compute distance from hero center to leading edge in facing direction.
//   spawnStrengthSwingProjectile() – Spawn the visual Strength smash projectile attached to a hero.
//   updateStrengthProjectilesMotionFor() – Move Strength smash projectiles and decide when they expire.
//   buildStrengthSmashBitmap() – Build the custom bitmap used to render the Strength smash arc.
//
// SECTION A - AGILITY MOVE MODULE
//   calculateAgilityStats() – Compute STAT[] for the Agility family based on base time and traits.
//   executeAgilityMove() – Perform an Agility move: spend mana, lock hero, and start dash/thrust.
//   updateAgilityComboOnHit() – Update the hero's combo meter and state after an Agility hit.
//   getComboDamageMultPct() – Return damage multiplier percent based on current combo streak.
//   spawnAgilityThrustProjectile() – Spawn the melee thrust hitbox/visual for an Agility move.
//   createAgilityArrowSegmentImage() – Create the segment image used for Agility thrust trails/arrow.
//   updateAgilityProjectilesMotionFor() – Move Agility thrust projectiles and handle dash follow-through/timing.
//   debugAgilityDashProgress() – Visual/logging helper to inspect dash integration over time.
//   debugDashIntegratorTick() – Helper used by debugAgilityDashProgress() to step the integrator.
//   showComboPop() – Spawn a temporary "Nx" combo popup over the hero sprite.
//   ensureComboMeter() – Ensure a combo meter sprite exists for a hero and attach/position it.
//
// SECTION I - INTELLECT MOVE MODULE
//   calculateIntellectStats() – Compute STAT[] for the Intellect family based on base time and traits.
//   executeIntellectMove() – Perform an Intellect move: start targeting mode and consume mana.
//   beginIntellectTargeting() – Create a controllable Intellect spell projectile and enter steering mode.
//   runIntellectDetonation() – Handle Intellect projectile detonation, damage application, and linger spawn.
//   finishIntellectSpellForHero() – Clean up Intellect spell state and unlock hero after spell ends.
//   updateIntellectSpellsControl() – Per-frame steering/motion control for active Intellect spells.
//   detonateIntellectSpellAt() – Helper to detonate an Intellect spell at a specific world (x,y).
//   processIntellectLingers() – Update Intellect linger sprites (DoT, visuals, cleanup).
//
// SECTION H - HEAL AND SUPPORT SPELLS MODULE
//   detonateHealSpellAt() – Trigger a heal/support effect centered at a given world point.
//   applyHealToHeroIndex() – Apply healing and buffs to a specific hero index.
//   calculateHealStats() – Compute STAT[] for the Heal family based on base time and traits.
//   executeHealMove() – Perform a Heal move: spawn heal/support effect and consume mana.
//
// SECTION E - ENEMY MODULE
//   enemyImageForKind() – Return the base sprite image for a given enemy kind.
//   spawnEnemyOfKind() – Spawn a single enemy of the requested kind at a specified position.
//   setupEnemySpawners() – Create invisible spawner sprites around the arena edges (current version).
//   setupEnemySpawnersBUGGED() – Older/broken spawner setup kept for reference while debugging.
//   spawnEnemyFromRandomSpawnerWeighted() – Randomly pick a spawner and enemy kind using weights and spawn it.
//   updateEnemyHoming() – Update enemy velocity to home toward their chosen hero target.
//   spawnDummyEnemy() – Spawn a dummy/test enemy for development purposes.
//   setupTestEnemies() – Spawn an initial batch of test enemies.
//   getEnemyIndex() – Return the index of an enemy sprite inside the enemies[] array.
//   getHeroIndex() – Return the index of a hero sprite inside the heroes[] array.
//   initEnemyHP() – Initialize enemy HP and attach an HP bar sprite.
//   updateEnemyHPBar() – Update enemy HP bar based on current HP.
//   applyDamageToEnemyIndex() – Apply damage to an enemy, clamp HP, and handle death logic.
//   flashEnemyOnDamage() – Flash the enemy sprite briefly when it takes damage.
//
// SECTION F - FINAL SECTION - onUpdates, GAME LOOP, INPUT, ENEMY AI/WAVES & STARTUP
//   updateHeroProjectiles() – Per-frame update for STR/AGI projectiles; leaves driven spells to their modules.
//   updateProjectilesCleanup() – Destroy projectiles whose timed DESTROY_AT has passed.
//   updatePlayerInputs() – Poll controllers and convert button state into move intents.
//   updateMeleeProjectilesMotion() – Legacy melee projectile updater (older path, mostly superseded).
//   updateHeroControlLocks() – Per-frame check to unlock heroes whose busyUntil has expired.
//   updateEnemyEffects() – Update enemy slow/weakness/status-effect timers and visuals.
//

// =====================================================================
// UNIVERSAL ANIMATION TIMELINE KEY OWNERSHIP (SINGLE-WRITER CONTRACT)
// ---------------------------------------------------------------------
// These keys are published in HERO_DATA for Phaser rendering.
//
// Goal: Each key group has a SMALL set of authoritative writers.
// Everybody else is READ-ONLY for that group.
// This prevents double-increment / stomping / false “new action” edges.
//
// ---------------------------------------------------------------------
// ACTION (edge: new move instance)
//   Keys: ActionSequence / ActionKind / ActionVariant / ActionSeed / ActionP0..P3 / ActionTargetId
//   Rule: ONLY ONE place may increment ActionSequence.
//   Authoritative incrementer: _doHeroMoveBeginActionTimeline()
//   Allowed overrides (NO ActionSequence increment): move-specific begin/commit functions may refine
//     ActionKind/Variant/TargetId within the same action instance.
//
// ---------------------------------------------------------------------
// PHASE (coarse animation family + timing window)
//   Keys: PhaseName / PhaseStartMs / PhaseDurationMs / PhaseProgressInt / PhaseFlags
//   Ambient phase changes (idle/run/combatIdle): setHeroPhaseString() only.
//   Action window stamping (fresh start even if same phase repeats): _doHeroMovePlayAnimAndDispatch() only.
//   Long-running progress updates: the move’s timing loop may update PhaseProgressInt (e.g., strength charge).
//
// ---------------------------------------------------------------------
// PHASE PART (within-phase segmentation)  [future wiring]
//   Keys: PhasePartName / PhasePartStartMs / PhasePartDurationMs / PhasePartProgress / PhasePartFlags
//   Authoritative writers: the move timing loops that already know segmentation timing.
//   (Examples: agility lunge motion updater, strength charge updater, intellect targeting control updater)
//
// ---------------------------------------------------------------------
// EVENT BUS (one-shot pulses)
//   Keys: EventSequence / EventMask / EventP0..P3
//   Rule: ONLY event emitters increment EventSequence.
//   Clearers may only clear EventMask (never touch EventSequence).
//
// ---------------------------------------------------------------------
// RENDER STYLE (orthogonal cosmetic overlays)  [future wiring]
//   Keys: RenderStyleMask / RenderStyleP0..P1
//   Authoritative writer: action-begin (stable for the action instance), with rare move-specific overrides.
//
// ---------------------------------------------------------------------
// READ-ONLY WARNING (IMPORTANT):
//   callHeroAnim() MUST NOT publish Action/Phase/Event timeline keys.
//   publishHeroActionPhase() is legacy and MUST NOT be used as a publisher in the final design.
//   (Currently those functions still publish; we will remove that behavior in Step 3/4.)
// =====================================================================


// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁








// 🍁 ────── 🍂 ────── 🍁 SECTION 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 SECTION 🍁 ────── 🍂 ────── 🍁
//These are the things that need to be present for this code to work in MakeCode Arcade


// --------------------------------------------------------------
// Sprite kinds - type declarations for TS (no top-level create()) DON'T COPY THIS OVER TO PHASER! It is already there
// --------------------------------------------------------------
namespace SpriteKindArcade {
    export let Hero: number
    export let HeroWeapon: number
    export let HeroAura: number
    export let EnemySpawner: number
    export let SupportBeam: number
    export let SupportIcon: number
    export let Wall: number
    export let ShopNpc: number
    export let ShopItem: number
    export let ShopUI: number
}

// Allow referring to globalThis when a host (like Phaser) provides it.
// In MakeCode Arcade this is just a type declaration; the try/catch below
// will swallow any runtime issue if it's missing.

// ================================================================
// External hero hooks – implemented in the user project (main.ts)
// ================================================================

// Logic hooks: must return an OUT array-like structure

// ================================================================
// Default hero hooks – safe stubs for the extension itself.
// Student projects will override these in main.ts with their own
// heroXLogic / animateHeroX functions.
// ================================================================

// ================================================================
// Hero logic / animation hooks (extension side)
// Students will assign their functions to these from main.ts
// ================================================================

// --------------------------------------------------------------
// Sprite kinds - type declarations for TS
// --------------------------------------------------------------

namespace HeroEngine {


    export function __getHeroVisualInfo(hero: Sprite, nx: number, ny: number): number[] {
        const innerR = getStrengthInnerRadiusForHero(hero)
        const lead = findHeroLeadingEdgeDistance(hero, nx, ny)
        return [innerR, lead, 0, 0]
    }



    // Block-safe function type for student logic
    export type HeroLogicFn = (
        button: string,
        heroIndex: number,
        enemiesArr: any[],
        heroesArr: any[]
    ) => number[];


    export type HeroAnimFn = (
        hero: Sprite,
        animKey: string,
        timeMs: number,
        direction: string
    ) => void;


    function defaultHeroLogic(
        button: string,
        heroIndex: number,
        enemiesArr: any[],
        heroesArr: any[]
    ): number[] {
        return [FAMILY.STRENGTH, 0, 0, 0, 0, ELEM.NONE, ANIM.ID.IDLE];
    }


    // Helper: wrap a small hero idle sprite (e.g. 16x16) into a 64x64 image
    function _wrapIdleInto64(src: any) {
        const result = image.create(64, 64);
        const offX = (result.width - src.width) >> 1;
        const offY = (result.height - src.height) >> 1;
        result.drawTransparentImage(src, offX, offY);
        return result;
    }


    function defaultHeroAnim(
        hero: Sprite,
        animKey: string,
        timeMs: number,
        direction: string
    ): void {

        // OWNER, not index, determines which hero it is
        const owner = sprites.readDataNumber(hero, HERO_DATA.OWNER);

        // Hardcoded idle sprites for each hero
        // These NEVER appear in student project, so Blocks stays clean.

        const idle1 = _wrapIdleInto64(img`
        . . . . . . f f f f . . . . . .
        . . . . f f f 2 2 f f f . . . .
        . . . f f f 2 2 2 2 f f f . . .
        . . f f f e e e e e e f f f . .
        . . f f e 2 2 2 2 2 2 e e f . .
        . . f e 2 f f f f f f 2 e f . .
        . . f f f f e e e e f f f f . .
        . f f e f b f 4 4 f b f e f f .
        . f e e 4 1 f d d f 1 4 e e f .
        . . f e e d d d d d d e e f . .
        . . . f e e 4 4 4 4 e e f . . .
        . . e 4 f 2 2 2 2 2 2 f 4 e . .
        . . 4 d f 2 2 2 2 2 2 f d 4 . .
        . . 4 4 f 4 4 5 5 4 4 f 4 4 . .
        . . . . . f f f f f f . . . . .
        . . . . . f f . . f f . . . . .
    `);

        const idle2 = _wrapIdleInto64(img`
        . . . . . . f f f f . . . . . .
        . . . . f f f a a f f f . . . .
        . . . f f f a a a a f f f . . .
        . . f f f e e e e e e f f f . .
        . . f f e a a a a a a e e f . .
        . . f e a f f f f f f a e f . .
        . . f f f f e e e e f f f f . .
        . f f e f b f 6 6 f b f e f f .
        . f e e a 6 f d d f 6 a e e f .
        . . f e e d d d d d d e e f . .
        . . . f e e 4 4 4 4 e e f . . .
        . . e 4 f 4 4 4 4 4 4 f 4 e . .
        . . 4 d f 4 4 4 4 4 4 f d 4 . .
        . . 4 4 f a a a a a a f 4 4 . .
        . . . . . f f f f f f . . . . .
        . . . . . f f . . f f . . . . .
    `);

        const idle3 = _wrapIdleInto64(img`
        . . . . . . f f f f . . . . . .
        . . . . f f f 7 7 f f f . . . .
        . . . f f f 7 7 7 7 f f f . . .
        . . f f f e e e e e e f f f . .
        . . f f e 7 7 7 7 7 7 e e f . .
        . . f e 7 f f f f f f 7 e f . .
        . . f f f f e e e e f f f f . .
        . f f e f b f 8 8 f b f e f f .
        . f e e 4 8 f d d f 8 4 e e f .
        . . f e e d d d d d d e e f . .
        . . . f e e 4 4 4 4 e e f . . .
        . . e 4 f 7 7 7 7 7 7 f 4 e . .
        . . 4 d f 7 7 7 7 7 7 f d 4 . .
        . . 4 4 f 4 4 9 9 4 4 f 4 4 . .
        . . . . . f f f f f f . . . . .
        . . . . . f f . . f f . . . . .
    `);

        const idle4 = _wrapIdleInto64(img`
        . . . . . . f f f f . . . . . .
        . . . . f f f 8 8 f f f . . . .
        . . . f f f 8 8 8 8 f f f . . .
        . . f f f e e e e e e f f f . .
        . . f f e 8 8 8 8 8 8 e e f . .
        . . f e 8 f f f f f f 8 e f . .
        . . f f f f e e e e f f f f . .
        . f f e f b f 1 1 f b f e f f .
        . f e e 4 1 f d d f 1 4 e e f .
        . . f e e d d d d d d e e f . .
        . . . f e e 4 4 4 4 e e f . . .
        . . e 4 f 8 8 8 8 8 8 f 4 e . .
        . . 4 d f 8 8 8 8 8 8 f d 4 . .
        . . 4 4 f 4 4 9 9 4 4 f 4 4 . .
        . . . . . f f f f f f . . . . .
        . . . . . f f . . f f . . . . .
    `);

        if (owner === 1) hero.setImage(idle1);
        else if (owner === 2) hero.setImage(idle2);
        else if (owner === 3) hero.setImage(idle3);
        else if (owner === 4) hero.setImage(idle4);
        else hero.setImage(idle1);
    }



    // Strongly typed hooks now
    export let hero1LogicHook: any = defaultHeroLogic;
    export let hero2LogicHook: any = defaultHeroLogic;
    export let hero3LogicHook: any = defaultHeroLogic;
    export let hero4LogicHook: any = defaultHeroLogic;


    export let animateHero1Hook: HeroAnimFn = defaultHeroAnim;
    export let animateHero2Hook: HeroAnimFn = defaultHeroAnim;
    export let animateHero3Hook: HeroAnimFn = defaultHeroAnim;
    export let animateHero4Hook: HeroAnimFn = defaultHeroAnim;


    // Overridable hook for hero logic.
    // Arcade: stays null → we fall back to runHeroLogicForHero.
    // Phaser: heroEnginePhaserGlue.ts overrides this.
    export type RunHeroLogicForHeroHook = (heroIndex: number, button: string) => number[] | null;
    export let runHeroLogicForHeroHook: RunHeroLogicForHeroHook = null;

    let _started = false;

    export function _isStarted(): boolean {
        return _started;
    }

    //% blockId=heroEngine_start
    //% block="start hero engine"
    //% group="Setup"
    //% weight=100
    export function start() {
        if (_started) return;
        _started = true;

        // NEW: reset shared coins + HUD
        teamCoins = 0
        if (teamCoinsHud && !(teamCoinsHud.flags & sprites.Flag.Destroyed)) teamCoinsHud.destroy()
        teamCoinsHud = null
        setTeamCoins(0)

        ensureHeroSpriteKinds();

        initWorldTileMap()
        scene.setBackgroundColor(1);
        tiles.setCurrentTilemap(tilemap`level1`)
        setupHeroes();

        // Shop boot (single path)
        installShopInputHandlers()

        // REMOVE legacy shop box spawner (it is a different shop system and conflicts)
        // spawnShopNpcBox( (userconfig.ARCADE_SCREEN_WIDTH>>1), (userconfig.ARCADE_SCREEN_HEIGHT>>1) + 30, 1 )

        setupTestEnemies();
        setupEnemySpawners();
        startEnemyWaves();
    }

}


// 🍁 ────── 🍂 ────── 🍁 SECTION 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 SECTION 🍁 ────── 🍂 ────── 🍁
//This section is for how we check if we are in Phaser or MakeCode Arcade. I am putting these in their own section because other than this there shouldn't be a place the engine "knows" whether it is in MakeCode Arcade or not
//This is also for debug flags so they are easy to spot
declare const globalThis: any;


function isPhaserRuntime(): boolean {
    // SAFE even if globalThis isn't actually present at runtime
    if (typeof globalThis === "undefined") return false
    return !!globalThis.__phaserScene
}

function isMakeCodeArcadeRuntime(): boolean {
    return !isPhaserRuntime()
}




//##########################################################################################################################################
// DEBUG: Agility combo v3
//##########################################################################################################################################

const DEBUG_AGI_COMBO = false  //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_AGI_COMBO_LANDING = false  //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_AGI_COMBO_EXIT = false  //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_AGI_COMBO_BUILD = false  //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v

// --------------------------------------------------------------
// Debug flags
// Used by: agility / integrator debug logging & probes
// --------------------------------------------------------------
const DEBUG_AGILITY = false //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DBG_INTERVAL_MS = 50
const DEBUG_INTEGRATOR = true
const DBG_INT_INTERVAL_MS = 50

const DEBUG_HERO_LOGIC = true //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v


const DEBUG_WARN_PUBLISH_HERO_ACTION_PHASE = true //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v


const DEBUG_ANIM_KEYS = true //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v


const DEBUG_PHASE_CHANGES = true //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v 

// Change this string to whatever you want to grep for.
// Must contain "P1 intent" per your filtering workflow.
const DEBUG_FILTER_PHRASE = "[P1 intent]"

// --------------------------------------------------------------
// Debug filter (input/move gating probes)
// --------------------------------------------------------------
const DEBUG_FILTER_LOGS = true  //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥


// --------------------------------------------------------------
// Move pipeline debug (engine-only). Off by default.
// --------------------------------------------------------------
const DEBUG_MOVE_PIPE = false //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v

const DEBUG_MOVE_PIPE_PLAYER = 0      // 0 = all players, else only that player index (1-based)
const DEBUG_MOVE_PIPE_THROTTLE_MS = 500  // rate limit per hero for tick-style logs
let _dbgMovePipeLastMsByHero: number[] = []

// Internal: lets helper functions know which player is currently being processed.
// Debug-only; do not use for gameplay logic.
let _dbgMoveCurrentPlayerId = 0

const DEBUG_AGI_AIM = false //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_AGI_AIM_HERO_INDEX = 0          // 0 = hero 0, 1 = hero 1, etc.
const DEBUG_AGI_AIM_THROTTLE_MS = 250

let _dbgAgiAimLastMs: number[] = []



// DEBUG: track intent edges + durations for Player 1
let _dbg_prevP1Intent = ""
let _dbg_prevP1IntentMs = 0
let _dbg_prevP1A = false
let _dbg_prevP1B = false

// debug flag
const TEST_WAVE_ENABLED = false     // show ALL monsters once //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_WAVE_ENABLED = false     // focus on a single monster type //debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥v
const DEBUG_MONSTER_ID = "imp blue"  // which monster for debug waves



// Simple shop mode gate (POC)
let SHOP_MODE_ACTIVE_MASTER = false // Debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
let SHOP_MODE_ACTIVE = true //local flag gets overwritten

if (!SHOP_MODE_ACTIVE_MASTER) { SHOP_MODE_ACTIVE = false}
//Turn the shop on
//Turn the shop off

const SHOP_AFTER_WAVE = 10   // you asked for 0 for now Debug Flag turn the shop wave up down
let _shopEntered = false


// --------------------------------------------------------------
// ANIMKEYS logging helpers (one-line, copy/paste friendly)
// --------------------------------------------------------------
const DEBUG_ANIM_KEYS_HERO_INDEX = -1   // -1 = all heroes, else only this heroIndex
const DEBUG_ANIM_KEYS_PLAYER_ID = 0     // 0 = all, else only this OWNER/player id
const DEBUG_ANIM_KEYS_PHASE_EDGE = true
const DEBUG_ANIM_KEYS_PHASE_STAMP = true
const DEBUG_ANIM_KEYS_PHASE_PART = false
const DEBUG_ANIM_KEYS_INT_FINISH = true



// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥


// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕
// ================================================================
// SECTION 1 - ENGINE CONSTANTS, DATA KEYS & GLOBALS
// ================================================================
// --------------------------------------------------------------
// SECTION 1 – CONSTANTS, DATA KEYS, GLOBALS
// Purpose:
//   • Centralize all tuning constants and enums
//   • Define sprite data "schemas" for heroes, enemies, and projectiles
//   • Declare the core global arrays the engine loops over
// --------------------------------------------------------------

// --------------------------------------------------------------
// Screen config
// Used by: spawn positions, UI layout, enemy spawners, etc.
// --------------------------------------------------------------
namespace userconfig {
    export const ARCADE_SCREEN_WIDTH = 640
    export const ARCADE_SCREEN_HEIGHT = 480
}

// --------------------------------------------------------------
// INTERNAL TILEMAP SYSTEM (GLOBAL ENGINE SPACE)
// Completely hidden from wrapper / HeroEngine namespace
// --------------------------------------------------------------

const WORLD_TILE_SIZE = 32          // private
const TILE_EMPTY = 0                // private
const TILE_WALL = 1                 // private

// --------------------------------------
// Tile collision shapes (per tile "type")
// --------------------------------------
interface TileCollisionShape {
    solid: boolean;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

// Index by tile type (0, 1, 2, ...)
const TILE_COLLISION_DEFS: TileCollisionShape[] = [
    // 0: empty
    { solid: false, offsetX: 0, offsetY: 0, width: 0, height: 0 },

    // 1: full solid tile (current behavior of TILE_WALL)
    {
        solid: true,
        offsetX: 0,
        offsetY: 0,
        width: WORLD_TILE_SIZE,
        height: WORLD_TILE_SIZE,
    },

    // 2+: reserved for later (half-height walls, ledges, etc.)
    // Example (commented out for now):
    // {
    //     solid: true,
    //     offsetX: 0,
    //     offsetY: WORLD_TILE_SIZE - 12,
    //     width: WORLD_TILE_SIZE,
    //     height: 12,
    // },
];

// 2D array of numbers for engine-internal use only
let _engineWorldTileMap: number[][] = []

// ====================================================
// WORLD SIZE CONFIG (MakeCode / HeroEngine side)
// ====================================================

// Tile size is whatever you're already using
//const WORLD_TILE_SIZE = 16;   // or 32 or 64 — whatever you already have

// Target world size in tiles.
// Example: 1920x1080 with 64px tiles → 30 x 17 tiles.
// Adjust these numbers, not the code, when you want a new world size.
const WORLD_TILES_W = 48/2;     // columns
const WORLD_TILES_H = 26/2;     // rows

// Optional small safety floor
const MIN_WORLD_TILES_W = 5;
const MIN_WORLD_TILES_H = 5;

// --------------------------------------------------------------
// Sprite kinds (lazy init for extension safety)
// --------------------------------------------------------------
let _heroKindsInitialized = false

// --------------------------------------------------------------
// Family / element enums
// FAMILY: which move "bucket" the hero is using
// ELEM: damage type / flavor for future resistances
// Used by: calculateXStats(), executeXMove(), damage logic
// --------------------------------------------------------------

// Families
const FAMILY = { STRENGTH: 0, AGILITY: 1, INTELLECT: 2, HEAL: 3 }

// Map numeric FAMILY to the HeroAtlas family strings
function heroFamilyNumberToString(family: number): string {
    switch (family | 0) {
        case FAMILY.STRENGTH:   return "strength";
        case FAMILY.AGILITY:    return "agility";
        case FAMILY.INTELLECT:  return "intelligence";
        case FAMILY.HEAL:       return "support";
        default:                return "strength";
    }
}


// Elements
const ELEM = { NONE: 0, GRASS: 1, FIRE: 2, WATER: 3, ELECTRIC: 4, EARTH: 5 }

// --------------------------------------------------------------
// Animation keys
// Used by: callHeroAnim(), animateHeroX()
// --------------------------------------------------------------
const ANIM = {
    IDLE: "idle",
    A: "A-Move",
    B: "B-Move",
    AB: "A+B Move",
    ID: { IDLE: 0, A: 1, B: 2, AB: 3 }
}

// --------------------------------------------------------------
// STAT index map – per-move stats array
// One STAT[] is produced by calculateXStats() for each move.
// Used by: executeXMove(), STR/AGI motion, INT/HEAL detonation logic.
// --------------------------------------------------------------
const STAT = {
    DAMAGE_MULT: 0,        // overall damage multiplier vs base power
    MOVE_DURATION: 1,      // how long the move owns the hero (ms)
    LUNGE_SPEED: 2,        // AGI dash / thrust speed (px/s)
    COMBO_WINDOW: 3,       // AGI combo window duration (ms)

    SLOW_PCT: 4,
    SLOW_DURATION: 5,
    WEAKEN_PCT: 6,
    WEAKEN_DURATION: 7,

    TARGETING_TIME: 8,     // INT steer window (ms)
    RING_RADIUS: 9,        // INT detonation radius
    CHANNEL_POWER: 10,     // INT / HEAL potency
    KNOCKBACK_PCT: 11,     // knockback strength %

    // Family-specific knobs we want centralized
    STRENGTH_TOTAL_ARC_DEG: 12, // total degrees swept by STR smash
    STRENGTH_SWING_MS: 13,      // STR swing duration (ms)
    AGILITY_LAND_BUFFER_MS: 14, // AGI landing grace buffer (ms)

    LEN: 15                    // length of STAT[] arrays
}


// --------------------------------------------------------------
// HERO_DATA – sprite data schema for hero sprites
// Ownership:
//   • Written by: setupHeroes(), initHeroHP(), initHeroMana(),
//                 executeXMove(), combo / dash / iframe logic
//   • Read by:    applyDamageToHeroIndex(), control-lock logic,
//                 combo handling, AGI/STR/INT modules, auras
// --------------------------------------------------------------
const HERO_DATA = {
    HP: "hp", MAX_HP: "maxHp", MANA: "mana", MAX_MANA: "maxMana", NAME: "name",
    FAMILY: "family", BUTTON: "btn",
    TRAIT1: "t1", TRAIT2: "t2", TRAIT3: "t3", TRAIT4: "t4",
    INPUT_LOCKED: "inputLocked", STORED_VX: "sVx", STORED_VY: "sVy",
    TARGET_START_MS: "tStart", TARGET_LOCK_MS: "tLock",
    IS_CONTROLLING_SPELL: "isCtrlSpell",
    COMBO_COUNT: "comboCount", COMBO_MULT: "comboMult",
    LAST_HIT_TIME: "lastHit", LAST_MOVE_KEY: "lastMoveKey",
    IFRAME_UNTIL: "iUntil",
    AGI_DASH_UNTIL: "aDashUntil",      // when AGI dash ends (ms)
    AGI_COMBO_UNTIL: "aComboUntil",    // when AGI combo window ends (ms)

    // NEW (Agility combo v2): Phaser-visible state + UI-driving fields
    AGI_STATE: "aState",               // number enum (see AGI_STATE below)
    AGI_CHAIN: "aChain",               // consecutive AGI presses counter
    AGI_LAST_PRESS_MS: "aLastMs",      // sanity gate for "in a row" detection
    AGI_METER_START_MS: "aMetS",       // pendulum start (ms)
    AGI_METER_POS_X1000: "aMetP",      // current pendulum position 0..1000 (optional)
    AGI_ZONE_E_W: "aZE",               // execute zone width (pixels)
    AGI_ZONE_1_W: "aZ1",               // 1x zone width (pixels)
    AGI_ZONE_2_W: "aZ2",               // 2x zone width (pixels)
    AGI_ZONE_3_W: "aZ3",               // 3x zone width (pixels)
    AGI_PKT_COUNT: "aPkC",             // packet count (stored hits)
    AGI_PKT_SUM: "aPkS",               // optional: sum of packet damages
    AGI_CANCEL_HOLD_MS: "aCanH",       // how long player has held movement to cancel

    // NEW (Agility combo v3): persistent combo mode + landing/entry bookkeeping
    AGI_COMBO_MODE: "aCMode",                  // 0/1 persistent combo-state flag
    AGI_COMBO_ENTRY_BTN: "aCEntB",             // initiating button id (the one that must be held through landing)
    AGI_COMBO_ENTRY_DASH_UNTIL: "aCEntDU",     // dashUntil of the entry-attempt dash
    AGI_COMBO_LAND_ARMED_FOR_DU: "aCArmedDU",  // guard: last dashUntil we already armed meter for (prevents re-arming spam)
    AGI_COMBO_LAST_AGI_BTN: "aCLastB",         // optional: last agility button pressed (debug / future use)

    // NEW (Agility combo v4): weapon-as-meter charge contract (Phaser reads these)
    AGI_CHARGE_ACTIVE: "aChg",          // 0/1
    AGI_START_MS: "aChgS",              // ms
    AGI_PERIOD_MS: "aChgPer",           // ms
    AGI_TIER_A_ADD: "aTA",              // number
    AGI_TIER_B_ADD: "aTB",              // number
    AGI_TIER_C_ADD: "aTC",              // number
    AGI_EXEC_FRAC_X1000: "aExF",        // half-cycle window fractions; sum to 500
    AGI_A_FRAC_X1000: "aAF",
    AGI_B_FRAC_X1000: "aBF",
    AGI_C_FRAC_X1000: "aCF",
    AGI_EXECUTE_SEQ: "aExSeq",          // increments per accepted execute
    AGI_LAST_ADD_AMOUNT: "aLastAdd",    // captured on execute
    AGI_STORED_HITS: "aStor",           // authoritative stored hits (separate from ghosts)
    AGI_LAND_BUFFER_MS: "aLandB",       // optional (ms)

    AGI_PENDING_ADD: "aPend",     // number: current pending add amount (ghost count)
    AGI_IS_EXEC_WINDOW: "aExW",   // number: 1 if in EXEC window (sheen), else 0


    // NEW (C4): Agility execute sequencing + teleport bookkeeping
    AGI_EXEC_ORIG_X: "aExOX",
    AGI_EXEC_ORIG_Y: "aExOY",
    AGI_EXEC_RADIUS: "aExR",
    AGI_EXEC_STEP: "aExI",
    AGI_EXEC_NEXT_MS: "aExN",
    AGI_EXEC_INTERVAL_MS: "aExDt",
    AGI_EXEC_SLOW_PCT: "aExSl",
    AGI_EXEC_SLOW_DUR_MS: "aExSd",

    // NEW (C5): cancel bookkeeping
    AGI_CANCEL_LAST_TICK_MS: "aCanT",

    // NEW (Bug2 fix): cancel direction must be steady to cancel
    AGI_CANCEL_DIR_X: "aCanDX",
    AGI_CANCEL_DIR_Y: "aCanDY",

    STR_INNER_RADIUS: "strInnerR",     // STR smash inner radius (per-hero cache)
    OWNER: "owner",                    // which player "owns" this hero

    // STR charge (hold-to-charge) state
    STR_CHARGING: "strChg",            // boolean
    STR_CHARGE_BTN: "strChgBtn",       // number (button id)
    STR_CHARGE_START_MS: "strChgS",    // number (ms)
    STR_CHARGE_LAST_MS: "strChgL",     // number (ms)
    STR_CHARGE_MAX_MS: "strChgMax",    // number (ms to full)
    STR_CHARGE_ARC_DEG: "strChgDeg",   // number (0..360) current arc from charge
    STR_CHARGE_MPD_X1000: "strChgMpd", // number (mana per degree * 1000)
    STR_CHARGE_SPENT: "strChgSpent",   // number (debug/validation)
    STR_CHARGE_REM_X1000: "strChgRem", // number (fixed-point remainder for incremental mana drain)

    // STR cached payload (snapshotted at charge start; immune to mid-hold changes)
    STR_PAYLOAD_FAMILY: "strPayFam",   // number
    STR_PAYLOAD_BTNSTR: "strPayBtn",   // string ("A" | "B" | "A+B")
    STR_PAYLOAD_T1: "strPay1",         // number
    STR_PAYLOAD_T2: "strPay2",         // number
    STR_PAYLOAD_T3: "strPay3",         // number
    STR_PAYLOAD_T4: "strPay4",         // number
    STR_PAYLOAD_EL: "strPayEl",        // number
    STR_PAYLOAD_ANIM: "strPayAnim",    // string

    // NEW: engine-side state we want exposed
    BUSY_UNTIL: "busyUntil",           // heroBusyUntil[heroIndex]
    MOVE_SPEED_MULT: "mvMult",         // heroMoveSpeedMult[heroIndex]
    DAMAGE_AMP_MULT: "dmgMult",        // heroDamageAmpMult[heroIndex]
    BUFF_JSON: "buffsJson",            // JSON snapshot of heroBuffs[heroIndex]

    // NEW: for tile-collision rollback
    PREV_X: "prevX",
    PREV_Y: "prevY",

    // NEW: hero death state (for LPC death animation timing)
    IS_DEAD: "isDead",
    DEATH_UNTIL: "deathUntil",

    // -------------------------------------------------
    // Weapons (net-safe: primitives only)
    // -------------------------------------------------
    WEAPON_LOADOUT_VER: "wVer",     // number (start at 1)
    WEAPON_SLASH_ID: "wSl",         // string (weapon model id)
    WEAPON_THRUST_ID: "wTh",        // string (weapon model id)
    WEAPON_CAST_ID: "wCa",          // string (weapon model id)
    WEAPON_EXEC_ID: "wEx",          // string (weapon model id; optional)
    WEAPON_COMBO_ID: "wCo",         // string (weapon model id used during agility combo/charge visuals)

    // NEW: animation-facing mirror fields (for Phaser heroAnimGlue)
    DIR: "dir",
    PHASE: "phase",
    FRAME_COL_OVERRIDE: "frameColOverride",


    // -------------------------------------------------
    // NEW: universal Action/Phase/Event timeline contract (human-readable)
    // -------------------------------------------------
    ActionSequence: "ActionSequence",
    ActionKind: "ActionKind",
    ActionVariant: "ActionVariant",
    ActionSeed: "ActionSeed",
    ActionP0: "ActionP0",
    ActionP1: "ActionP1",
    ActionP2: "ActionP2",
    ActionP3: "ActionP3",
    ActionTargetId: "ActionTargetId",


    // ------------------------------------------------------------
    // Agility thrust motion schedule (Windup -> Forward -> Landing)
    // ------------------------------------------------------------
    AgilityLungeStartMs: "AgilityLungeStartMs",     // number
    AgilityLungeEndMs: "AgilityLungeEndMs",         // number
    AgilityLungeDirX1000: "AgilityLungeDirX1000",   // number
    AgilityLungeDirY1000: "AgilityLungeDirY1000",   // number
    AgilityLungeSpeed: "AgilityLungeSpeed",         // number (px/s)



    PhaseName: "PhaseName",
    PhaseStartMs: "PhaseStartMs",
    PhaseDurationMs: "PhaseDurationMs",
    PhaseFlags: "PhaseFlags",
    PhaseProgressInt: "PhaseProgressInt",   // 0..PHASE_PROGRESS_MAX

    // -------------------------------------------------
    // NEW: PhasePart contract (within-phase segmentation)
    // -------------------------------------------------
    PhasePartName: "PhasePartName",                 // string
    PhasePartStartMs: "PhasePartStartMs",           // number (ms)
    PhasePartDurationMs: "PhasePartDurationMs",     // number (ms)
    PhasePartProgress: "PhasePartProgress",         // number 0..PHASE_PROGRESS_MAX
    PhasePartFlags: "PhasePartFlags",               // number bitmask (future)

    // -------------------------------------------------
    // NEW: RenderStyle contract (orthogonal cosmetics)
    // -------------------------------------------------
    RenderStyleMask: "RenderStyleMask",             // number bitmask
    RenderStyleP0: "RenderStyleP0",                 // number (future)
    RenderStyleP1: "RenderStyleP1",                 // number (future)


    // Universal event bus (engine -> Phaser)
    EventSequence: "EventSequence",   // increments each emitted event
    EventMask: "EventMask",           // bitmask describing event type(s)
    EventP0: "EventP0",               // payload param 0 (e.g., x)
    EventP1: "EventP1",               // payload param 1 (e.g., y)
    EventP2: "EventP2",               // payload param 2 (optional)
    EventP3: "EventP3",               // payload param 3 (optional)

    // Weapon display offsets (pixels)
    HERO_WPN_OFF_X: "wpnOffX",
    HERO_WPN_OFF_Y: "wpnOffY",
    WEAPON_ALWAYS_SHOW: "wAlw",

    _InvLastActionSequence: "_InvLastActionSequence",

    AURA_ACTIVE: "auraActive",
    AURA_COLOR: "auraColor",

    VIS_INNER_R: "visInnerR",
    VIS_LEAD_EDGE: "visLeadEdge",
    VIS_WTIP_X: "visWTipX",
    VIS_WTIP_Y: "visWTipY"
}

// --------------------------------------------------------------
// ENEMY_DATA – sprite data schema for enemies
// Ownership:
//   • Written by: spawnEnemyOfKind(), initEnemyHP(), enemy AI setup
//   • Read by:    updateEnemyHoming(), updateEnemyEffects(),
//                 applyDamageToEnemyIndex(), wave logic
// --------------------------------------------------------------
const ENEMY_DATA = {
    HP: "hp",
    MAX_HP: "maxHp",


    
    SPEED: "spd",                 // base movement speed for homing AI
    TOUCH_DAMAGE: "touchDmg",     // contact damage vs heroes
    REGEN_PCT: "regenPct",        // % regen per tick (if used later)


    // NEW: logical monster identifier so Phaser wrapper can pick LPC sheet
    MONSTER_ID: "monsterId",

    SLOW_PCT: "slowPct",
    SLOW_UNTIL: "slowUntil",
    WEAKEN_PCT: "weakPct",
    WEAKEN_UNTIL: "weakUntil",
    KNOCKBACK_UNTIL: "kbUntil",

    ATK_PHASE: "atkPhase",        // current attack state (enum/int)
    ATK_UNTIL: "atkUntil",        // time current attack phase ends
    ATK_COOLDOWN_UNTIL: "atkCd",   // when enemy can attack again

    HOME_X: "HOMEX",
    HOME_Y: "HOMEY",
    RETURNING_HOME: "returningHome",
    
    ATK_ORIGIN_X: "atkOriginX",
    ATK_ORIGIN_Y: "atkOriginY",
    RETURNING_TO_ORIGIN: "returningToOrigin",
    ATK_RATE_PCT: "atkRatePct",

    // NEW: death timing
    DEATH_UNTIL: "deathUntil",
    homeX: "homeX",
    homeY: "homeY",
    dir: "dir",
    phase: "phase",

}

// --------------------------------------------------------------
// PROJ_DATA – sprite data schema for hero projectiles
// Includes STR/AGI melee hitboxes and INT/HEAL driven spells.
// Ownership:
//   • Written by: spawnStrengthSwingProjectile(),
//                 spawnAgilityThrustProjectile(),
//                 beginIntellectTargeting(), runIntellectDetonation(),
//                 detonateHealSpellAt()
//   • Read by:    updateHeroProjectiles(),
//                 updateAgilityProjectilesMotionFor(),
//                 updateStrengthProjectilesMotionFor(),
//                 updateIntellectSpellsControl(),
//                 processIntellectLingers(),
//                 updateProjectilesCleanup()
// --------------------------------------------------------------
const PROJ_DATA = {
    DAMAGE: "dmg",
    IS_HEAL: "isHeal",
    HERO_INDEX: "heroIndex",
    FAMILY: "family",
    BUTTON: "btn",

    // Status effects applied on hit
    SLOW_PCT: "slowPct",
    SLOW_DURATION_MS: "slowDur",
    WEAKEN_PCT: "weakPct",
    WEAKEN_DURATION_MS: "weakDur",
    KNOCKBACK_PCT: "kbPct",

    HIT_MASK: "hitMask",          // bookkeeping for multi-hit behavior

    // Motion / geometry
    MOVE_TYPE: "mvType",
    START_TIME: "startMs",
    REACH_T: "reachT",
    TAIL_AT_REACH: "tailAtReach",
    MAX_REACH: "maxReach",
    DIR_X: "dirX",
    DIR_Y: "dirY",
    THRUST_PPS: "thrustPps",
    ARROW_LEN: "arrowLen",
    LAST_T: "lastT",
    DASH_MS: "dashMs",
    DASH_END_MS: "dashEndMs",

    ACTIVATE_AT_MS: "ActivateAtMs",   // runtime() time when the projectile becomes “real”
    IS_ACTIVE: "IsActive",            // 0/1: gate overlaps + visuals until activation

    START_HERO_X: "hStartX",
    START_HERO_Y: "hStartY",

    TERMINUS_HIT: "termHit",
    TERMINUS_X: "termX",
    TERMINUS_Y: "termY",
    TERMINUS_MS: "termMs",

    DESTROY_AT: "destroyAt",       // runtime() time when projectile should be destroyed

    SUPPORT_TARGET_HERO: "supTgtHero",
    SUPPORT_BUFF_KIND: "supBuffKind",
    SUPPORT_BUFF_POWER: "supBuffPower",
    SUPPORT_BUFF_DURATION: "supBuffDur"
}

// --------------------------------------------------------------
// OUT array – student-facing move definition
// Shape: [FAMILY, mana, trait1, trait2, trait3, trait4, target, element, animId]
// Used by: calculateMoveStatsForFamily(), executeXMove()
// --------------------------------------------------------------
const OUT = {
    FAMILY: 0,
    TRAIT1: 1, TRAIT2: 2, TRAIT3: 3, TRAIT4: 4,
    ELEMENT: 5,
    ANIM_ID: 6,
    LEN: 7
}

// --------------------------------------------------------------
// Contact / i-frames / visual tuning
// Used by: hero damage, overlap tests, AGI visuals, feedback
// --------------------------------------------------------------
const HERO_CONTACT_MIN_OVERLAP_PCT = 25
const HERO_IFRAME_MS = 600
const AGI_LANDING_BUFFER_MS = 80
const HERO_DAMAGE_FLASH_MS = 150
const AGI_MIN_VISUAL_LEN = 3


const HERO_FRAME_COL_OVERRIDE_NONE = -1

const PHASE_PROGRESS_MAX = 1024   // PhaseProgressInt is 0..PHASE_PROGRESS_MAX

const ENEMY_MELEE_RANGE_PX = 16 // or 20 or whatever feels right. THIS SHOULD BE CONVERTED TO AN ENEMY_DATA KEY CHATGPT. THIS IS LAZY AND IF YOU SCAN THIS REMIND ME THIS NEEDS TO BE DONE

// How long to keep a dying hero around so LPC "death" anim can play (ms)
const HERO_DEATH_ANIM_MS = 600;



// Strength swing segmentation (non-breaking addon channel)
// NOTE: does NOT touch PhasePartName/Start/Duration/Progress.
const STR_SEG_NAME_KEY = "STR_SEG_NAME"
const STR_SEG_START_MS_KEY = "STR_SEG_START_MS"
const STR_SEG_DUR_MS_KEY = "STR_SEG_DUR_MS"
const STR_SEG_PROGRESS_INT_KEY = "STR_SEG_PROGRESS_INT"

// Fractions of swingDurationMs (x1000)
const STR_SWING_SEG_WINDUP_FRAC_X1000 = 180   // 18%
const STR_SWING_SEG_FORWARD_FRAC_X1000 = 640  // 64%
const STR_SWING_SEG_LANDING_FRAC_X1000 = 180  // 18%

const STR_SWING_SEG_MIN_MS = 40               // never 0/instant segments


const STR_CHARGE_BASE_MAX_MS = 3000         // t3=0 charge time to full (ms)
const STR_CHARGE_MIN_MAX_MS = 160           // clamp so it never becomes instant
const STR_CHARGE_MS_PER_T3 = 70             // each point of trait3 reduces time by this much

const STR_CHARGE_EXTRA_MANA_PCT = 100       // extra mana over the baseCost when reaching full charge
// Example: baseCost=10, EXTRA_MANA_PCT=100 => extraCost=10 => full charge total = 20

const STR_PREP_VISIBLE_MS = 500  // tune: how long we play the first slash frames before freezing

// % of the RELEASE window when the projectile should spawn (0..1000)
const STR_SWING_PROJECTILE_SPAWN_FRAC_X1000 = 700 // 70% into release (tune this)

// Pending swing projectile spawn (hero data keys)
const STR_PEND_SWING_SPAWN_AT_MS_KEY = "strPendSwingSpawnAtMs"
const STR_PEND_SWING_ACTIVE_KEY      = "strPendSwingActive" // 0/1

const STR_PEND_SWING_DMG_KEY         = "strPendSwingDmg"
const STR_PEND_SWING_BTN_KEY         = "strPendSwingBtn"
const STR_PEND_SWING_SLOW_PCT_KEY    = "strPendSwingSlowPct"
const STR_PEND_SWING_SLOW_MS_KEY     = "strPendSwingSlowMs"
const STR_PEND_SWING_WEAK_PCT_KEY    = "strPendSwingWeakPct"
const STR_PEND_SWING_WEAK_MS_KEY     = "strPendSwingWeakMs"
const STR_PEND_SWING_KB_PCT_KEY      = "strPendSwingKbPct"
const STR_PEND_SWING_SWING_MS_KEY    = "strPendSwingSwingMs"
const STR_PEND_SWING_ARC_DEG_KEY     = "strPendSwingArcDeg"




// --------------------------------------------------------------
// AGILITY COMBO V2 – state enum + UI defaults
// --------------------------------------------------------------

const AGI_STATE = {
    NONE: 0,
    ARMED: 1,
    EXECUTING: 2
}

// Default UI layout for the pendulum meter (pixels)
// [E][1x][2x][3x][2x][1x][E]
const AGI_METER_W_E = 18
const AGI_METER_W_1 = 24
const AGI_METER_W_2 = 24
const AGI_METER_W_3 = 32
const AGI_METER_H = 14

// Alias for older name used by agiMeterZoneMultiplier
const AGI_METER_W_EXEC = AGI_METER_W_E


// Back-compat: the old combo-window baseline used 300ms. For C1 visibility we
// map that old window into a pendulum sweep so Phaser can see "something" now.
// (Later phases replace this with true pendulum logic driven by sprite-data.)
const AGI_METER_COMPAT_TOTAL_MS = 300

// NEW (Agility combo v2): “in-a-row” sanity gate (press #2 must happen soon)
const AGI_CHAIN_MAX_GAP_MS = 1200

// NEW (C2): temporary pendulum sweep period for visibility/testing (real pendulum logic later)
const AGI_METER_PERIOD_MS = 1200

// NEW (C3): Agility packet bank (authoritative, engine-side)
// Keyed by heroIndex for simplicity/stability.
let agiPacketBankByHeroIndex = new Map<number, number[]>()

// NEW (C4): Execute cadence (teleport-slash pacing)
const AGI_EXEC_STEP_MS = 85
const AGI_EXEC_STEP_MS_MIN = 150

// EventMask bits (engine -> Phaser)
const EVENT_MASK_AGI_EXEC_SLASH = 1 << 0

// ================================================================
// Agility Execute: teleport positioning + facing knobs
// ================================================================

// 0 = ABOVE (same X, slightly above enemy)  [your “behind” description]
// 1 = LEFT
// 2 = RIGHT
// 3 = ALT_LR (alternate left/right each hit)
// 4 = RAND_LR (random left/right each hit)
const AGI_EXEC_POS_MODE = 3   // ALT_LR (alternate left/right each hit)

// Offsets (pixels)
const AGI_EXEC_OFFSET_Y_ABOVE = -12
const AGI_EXEC_OFFSET_X_SIDE = 16

// Force hero to face down during execute teleports
const AGI_EXEC_FORCE_FACING_DOWN = true

// NEW (C5): manual cancel while ARMED (hold movement to break lock)
const AGI_CANCEL_HOLD_THRESHOLD_MS = 600
const AGI_CANCEL_GRACE_MS = 120


// --------------------------------------------------------------
// Agility EXECUTE beat segmentation (must match Phaser seek logic)
// Each beat dt is split into: teleport -> strike -> recover
// --------------------------------------------------------------
const AGI_EXEC_TELEPORT_FRAC_X1000 = 180
const AGI_EXEC_STRIKE_FRAC_X1000 = 520
// recover = remainder


// --------------------------------------------------------------
// C6: Agility trait wiring flags (tuning knobs)
// --------------------------------------------------------------
const AGI_BUILD_HITS_ENEMIES = false          // build dashes do 0 damage for now
const AGI_TIME_AFFECTS_VULN = true           // Trait3 affects vulnerability window
const AGI_TIME_AFFECTS_PENDULUM = true       // Trait3 affects pendulum speed

// NEW (C5.1): allow rapid combo presses even while a dash lock is active.
// This is the minimum time between accepted combo presses.
// NOTE: since doHeroMovesFromIntents runs at 80ms intervals, values below ~80ms won't matter.
const AGI_MIN_COMBO_REPRESS_MS = 80

// NEW (C7): aim indicator tuning
const AGI_AIM_SIDE_EDGE_SHRINK_PX = 7
const AGI_AIM_SIDE_INSET_PX = 8

// NEW (C6): \"break\" visual feedback
const AGI_BREAK_STRETCH_PX = 16
const AGI_BREAK_SHAKE_PX = 2

// --------------------------------------------------------------
// C6: Agility trait wiring flags (tuning knobs)
// --------------------------------------------------------------
const AGI_TIME_AFFECTS_SCHEDULE = false      // NEW (v4): Trait3 reshapes tier set + schedule (not wired yet)

// --------------------------------------------------------------
// Agility combo v4 (weapon-as-meter) defaults
// NOTE: Step 1 only seeds/publishes keys; behavior is wired later.
// Contract: EXEC + A + B + C = 500 (X1000 units, half-cycle)
// Full cycle implied: EXEC → A → B → C → B → A → EXEC
// --------------------------------------------------------------
const AGI_CHARGE_DEFAULT_TIER_A_ADD = 3
const AGI_CHARGE_DEFAULT_TIER_B_ADD = 4
const AGI_CHARGE_DEFAULT_TIER_C_ADD = 5

const AGI_CHARGE_DEFAULT_EXEC_FRAC_X1000 = 80
const AGI_CHARGE_DEFAULT_A_FRAC_X1000 = 140
const AGI_CHARGE_DEFAULT_B_FRAC_X1000 = 140
const AGI_CHARGE_DEFAULT_C_FRAC_X1000 = 140

// Default period used for the pendulum cycle while charging (ms)
// (kept aligned with current pendulum constant for now)
const AGI_CHARGE_DEFAULT_PERIOD_MS = AGI_METER_PERIOD_MS


// Thrust timing ratios MUST match Phaser segmented seek (heroAnimGlue.ts)
const AGI_THRUST_WINDUP_FRAC_X1000 = 550
const AGI_THRUST_FORWARD_FRAC_X1000 = 200
// landing = remainder


// --------------------------------------------------------------
// TEMP DEBUG: make agility thrust super visible
// --------------------------------------------------------------
const AGI_DEBUG_SLOWMO = true
const AGI_DEBUG_MOVE_DUR_MULT_X1000 = 7000   // 3.5× longer total move
const AGI_DEBUG_LUNGE_SPEED_MULT_X1000 = 2500 // 2.5× faster lunge => farther


// Strength charge button ids (matches updatePlayerInputs intent strings)
const STR_BTN_NONE = 0
const STR_BTN_A = 1
const STR_BTN_B = 2
const STR_BTN_AB = 3

// --------------------------------------------------------------
// Intellect spell sprite-data keys (non-enum string keys)
// Used by: INT detonation & linger animation
// --------------------------------------------------------------
const INT_DETONATED_KEY = "INT_DET"
const INT_TERM_X_KEY = "INT_TX"
const INT_TERM_Y_KEY = "INT_TY"
const INT_RADIUS_KEY = "INT_RAD"
// Detonation animation timing keys
const INT_DETONATE_START_KEY = "INT_DS"   // detonation start time (ms)
const INT_DETONATE_END_KEY = "INT_DE"     // detonation end time (ms)

// NEW: control window (when the player must finish aiming)
const INT_CTRL_UNTIL_KEY = "INT_CTRL_UNTIL"


// ====================================================
// INTELLECT CAST PARTS (hero animation segmentation)
// ====================================================
const INT_PRODUCE_DUR_MS = 1000
const INT_LAND_DUR_MS = 500

// Hero data keys to stage delayed projectile spawn + landing window
const INT_CAST_SPAWN_AT_MS_KEY = "INT_CAST_SPAWN_AT_MS"
const INT_CAST_DRIVE_MS_KEY = "INT_CAST_DRIVE_MS"
const INT_CAST_FAMILY_KEY = "INT_CAST_FAMILY"
const INT_CAST_BUTTON_KEY = "INT_CAST_BUTTON"
const INT_CAST_LAND_END_MS_KEY = "INT_CAST_LAND_END_MS"

const INT_SPELL_EXPIRES_AT_MS_KEY = "intSpellExpiresAtMs"



// --------------------------------------------------------------
// Weapon defaults (Step 2)
// NOTE: weapon IDs must match weaponAtlas "model" ids.
// --------------------------------------------------------------

const DEFAULT_WEAPON_LOADOUT_VER = 2

// Your current picked defaults:
const DEFAULT_WEAPON_SLASH_ID = "glowsword"
const DEFAULT_WEAPON_THRUST_ID = "spear"
const DEFAULT_WEAPON_EXEC_ID = "dagger"
const DEFAULT_WEAPON_COMBO_ID = "arming"


// Engine phase is "cast" but your sheet token is "spellcast".
// We will resolve "cast" -> ["cast","spellcast"] in weaponAtlas.ts (see below).
const DEFAULT_WEAPON_CAST_ID = "simple"

// Optional (future):
const DEFAULT_WEAPON_VARIANT = "blue" //"base"

// --------------------------------------------------------------
// Hardcoded weapon loadout source (Step 3)
// (Internal-only object; Step 4 will write primitive strings to sprite.data)
// --------------------------------------------------------------

// ------------------------------------------------------------
// Unified PhaseName ambient window envelopes (ms)
// PhaseName must always be renderable and have non-zero duration.
// Phaser may loop by modulo (now-start) % dur.
// ------------------------------------------------------------
const AMBIENT_IDLE_PHASE_DUR_MS = 700
const AMBIENT_RUN_PHASE_DUR_MS = 320
const AMBIENT_COMBATIDLE_PHASE_DUR_MS = 520


interface HardcodedWeaponLoadout {
    slashId: string
    thrustId: string
    castId: string
    execId: string
    comboId: string
}

// --------------------------------------------------------------
// GLOBAL ARRAYS – core engine collections
// These are what the main update loops iterate over.
// --------------------------------------------------------------
let heroes: Sprite[] = []
let enemies: Sprite[] = []
let heroProjectiles: Sprite[] = []

// NEW (Agility): stored-hit counter text + future packet bank UI
let heroAgiStoredCounters: Sprite[] = []

// Global world time (ms since this game instance started)
// We update this once per master update so the wrapper/save system
// has a single authoritative value to export.
let worldRuntimeMs = 0

// NEW: hero buff state (per-hero arrays)
let heroBuffs: any[][] = [[], [], [], []]
let heroMoveSpeedMult: number[] = [1, 1, 1, 1]   // haste from buffs
let heroDamageAmpMult: number[] = [1, 1, 1, 1]   // damage amp from buffs (hooked later)

let heroHPBars: StatusBarSprite[] = []
let heroManaBars: StatusBarSprite[] = []

let heroStrengthChargeBars: StatusBarSprite[] = []


let enemyHPBars: StatusBarSprite[] = []
let heroComboMeters: Sprite[] = []
let heroAgiAimIndicators: Sprite[] = []



let playerToHeroIndex: number[] = [-1, -1, -1, -1, -1]

// Hero-facing and targeting helpers
let heroFacingX: number[] = []
let heroFacingY: number[] = []
let heroTargetCircles: Sprite[] = []
let heroControlledSpells: Sprite[] = []
let heroAuras: Sprite[] = []

// Simple "intent" placeholder for P1 (used by input logic)
let p1Intent = ""

// Simple "intent" placeholder for P2 (used by input logic)
let p2Intent = ""

// Simple "intent" placeholder for P3 (used by input logic)
let p3Intent = ""

// Simple "intent" placeholder for P4 (used by input logic)
let p4Intent = ""


// Edge-queued intents (consumed by TIMER80)
let p1IntentPending = ""
let p2IntentPending = ""
let p3IntentPending = ""
let p4IntentPending = ""

// NEW: tiny 2-deep FIFO so fast taps between TIMER80 ticks don’t get dropped
let p1IntentPending2 = ""
let p2IntentPending2 = ""
let p3IntentPending2 = ""
let p4IntentPending2 = ""

// Previous raw button states (for edge detection)
let _p1PrevA = false, _p1PrevB = false
let _p2PrevA = false, _p2PrevB = false
let _p3PrevA = false, _p3PrevB = false
let _p4PrevA = false, _p4PrevB = false


// Control-lock timestamps: when each hero's inputs should unlock
let heroBusyUntil: number[] = []

const BUFF_KIND_HASTE = 1
const BUFF_KIND_DAMAGE_AMP = 2
const BUFF_KIND_SHIELD = 3

// Support puzzle directions
const SUP_DIR_UP = 0
const SUP_DIR_DOWN = 1
const SUP_DIR_LEFT = 2
const SUP_DIR_RIGHT = 3

// Per-hero support puzzle state
let supportPuzzleActive: boolean[] = [false, false, false, false]
let supportPuzzleSeq: number[][] = [[], [], [], []]
let supportPuzzleProgress: number[] = [0, 0, 0, 0]
let supportPuzzleIcons: Sprite[][] = [[], [], [], []]
let supportPuzzleStartMs: number[] = [0, 0, 0, 0]
// For edge detection on D-pad
let supportPuzzlePrevMask: number[] = [0, 0, 0, 0]

// Pending buff payload per hero (what to apply when the beam arrives)
let supportPendingBuffPower: number[] = [0, 0, 0, 0]
let supportPendingBuffDuration: number[] = [0, 0, 0, 0]
let supportPendingBuffKind: number[] = [BUFF_KIND_HASTE, BUFF_KIND_HASTE, BUFF_KIND_HASTE, BUFF_KIND_HASTE]

// --------------------------------------------------------------
// Aura colors – by family
// Used by: createAuraImageFromHero(), updateHeroAuras()
// --------------------------------------------------------------
const AURA_COLOR_STRENGTH = 2
const AURA_COLOR_AGILITY = 5
const AURA_COLOR_INTELLECT = 8
const AURA_COLOR_HEAL = 7 // green-ish


// === UI marker keys (shared) ===
const UI_KIND_KEY = "__uiKind";
const UI_KIND_COMBO_METER = "comboMeter";

const UI_KIND_AGI_STORED_COUNTER = "agiStoredCounter";


// === Combo meter sprite data keys ===
const UI_COMBO_TOTAL_W_KEY = "__comboTotalW";
const UI_COMBO_H_KEY = "__comboH";

const UI_COMBO_W_E_KEY = "__comboWE";
const UI_COMBO_W_1_KEY = "__comboW1";
const UI_COMBO_W_2_KEY = "__comboW2";
const UI_COMBO_W_3_KEY = "__comboW3";

const UI_COMBO_POS_X1000_KEY = "__comboPosX1000";
const UI_COMBO_VISIBLE_KEY = "__comboVisible";
const UI_COMBO_PKT_COUNT_KEY = "__comboPktCount"; // optional

// === Agility aim indicator (UI-managed sprite) ===
// Arcade runtime: render a simple procedural arrow image for the indicator.
// Phaser runtime: hide sprite pixels and publish aim params via data keys; Phaser draws natively.
const UI_KIND_AGI_AIM_INDICATOR = "agiAimIndicator";

// Indicator sprite data keys
const UI_AIM_VISIBLE_KEY = "__aimVis";          // 0/1
const UI_AIM_DIR_X1000_KEY = "__aimDx1000";     // -1000..1000
const UI_AIM_DIR_Y1000_KEY = "__aimDy1000";     // -1000..1000
const UI_AIM_ANGLE_MDEG_KEY = "__aimAngleMdeg"; // future 360 hook (milli-degrees)
const UI_AIM_LEN_KEY = "__aimLen";              // optional (pixels)

// Arcade-only indicator render constants (pixels). Phaser uses native rendering.
const AGI_AIM_INDICATOR_LEN = 14;
const AGI_AIM_INDICATOR_OX = 0;
const AGI_AIM_INDICATOR_OY = 0;

const UI_KIND_TEAM_COINS = "teamCoins"

// Coins reward tuning
const COIN_REWARD_MIN = 1
const COIN_REWARD_HP_DIV = 50   // ~1 coin per 50 maxHP

// HUD color (Arcade palette index; 7 is usually “yellow-ish”)
const COIN_HUD_FG = 7

let teamCoins = 0
let teamCoinsHud: Sprite = null





const HERO_LOCO_IDLE_LOOP_MS = 700
const HERO_LOCO_WALK_LOOP_MS = 700
const HERO_LOCO_RUN_LOOP_MS  = 500

const HERO_LOCO_RUN_VEL_SQ_THRESHOLD = 1600 // 40^2; adjust if your vx/vy scale differs




//End of Constants

// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
//This is for the helpers for debugging
// ------------------------------------------------------------
// CONTRACT SNAPSHOT DEBUG (aggregated per tick, change-gated)
// ------------------------------------------------------------

const DEBUG_CONTRACT_SNAPSHOT = true //Debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
//The master debug turn on and turn off

// Filters (0 = all players; -1 = all heroes; set to reduce noise)
let DEBUG_CONTRACT_PLAYER_ID = 0          // match HERO_DATA.OWNER
let DEBUG_CONTRACT_HERO_INDEX = -1        // match heroIndex
let DEBUG_CONTRACT_THROTTLE_MS = 0        // 0 = no extra throttle beyond change-gate

// Internal state
let _dbgContract_lastTickMs = 0
let _dbgContract_lastPrintMs = 0
const _dbgContract_lastPrintedSigByHero: string[] = []
const _dbgContract_lastObservedSigByHero: string[] = []
const _dbgContract_pendingStagesByHero: string[] = []
const _dbgContract_pendingLineByHero: string[] = []
const _dbgContract_pendingFlagByHero: number[] = []
const _dbgContract_pendingCoreLineByHero: string[] = []

// Parts whose PhasePartStartMs/PhasePartDurationMs are expected to slide every tick.
// These should NOT be part of the "core identity" signature.
const DEBUG_CONTRACT_VOLATILE_PART_WINDOWS: string[] = ["drive", "beat"]

function _dbgContract_isVolatilePartWindow(partName: string): boolean {
    const p = partName || ""
    for (let i = 0; i < DEBUG_CONTRACT_VOLATILE_PART_WINDOWS.length; i++) {
        if (DEBUG_CONTRACT_VOLATILE_PART_WINDOWS[i] === p) return true
    }
    return false
}



function dbgContractSnapshotAllHeroes(nowMs: number, stage: string): void {
    if (!DEBUG_CONTRACT_SNAPSHOT) return
    if (!HeroEngine._isStarted()) return

    const now = nowMs | 0
    const st = stage || ""

    // ------------------------------------------------------------
    // Auto-flush previous tick when we observe a new tick time.
    // ------------------------------------------------------------
    if (_dbgContract_lastTickMs !== 0 && now !== (_dbgContract_lastTickMs | 0)) {
        _dbgContract_flushTick(_dbgContract_lastTickMs | 0)
        _dbgContract_lastTickMs = now
    } else if (_dbgContract_lastTickMs === 0) {
        _dbgContract_lastTickMs = now
    }

    // ------------------------------------------------------------
    // Capture/aggregate this stage's observed state for each hero.
    // ------------------------------------------------------------
    for (let hi = 0; hi < heroes.length; hi++) {
        if (DEBUG_CONTRACT_HERO_INDEX >= 0 && hi !== (DEBUG_CONTRACT_HERO_INDEX | 0)) continue

        const hero = heroes[hi]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) continue

        const owner = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        if (DEBUG_CONTRACT_PLAYER_ID !== 0 && owner !== (DEBUG_CONTRACT_PLAYER_ID | 0)) continue

        // ---------------- Read contract ----------------
        const aSeq = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
        const aKind = sprites.readDataString(hero, HERO_DATA.ActionKind) || ""
        const aVar = sprites.readDataNumber(hero, HERO_DATA.ActionVariant) | 0
        const aSeed = sprites.readDataNumber(hero, HERO_DATA.ActionSeed) | 0
        const aTgt = sprites.readDataNumber(hero, HERO_DATA.ActionTargetId) | 0

        const ph = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
        const phS = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
        const phD = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
        const phF = sprites.readDataNumber(hero, HERO_DATA.PhaseFlags) | 0
        const phP = sprites.readDataNumber(hero, HERO_DATA.PhaseProgressInt) | 0

        const pp = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
        const ppS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
        const ppD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
        const ppF = sprites.readDataNumber(hero, HERO_DATA.PhasePartFlags) | 0
        const ppP = sprites.readDataNumber(hero, HERO_DATA.PhasePartProgress) | 0

        const eSeq = sprites.readDataNumber(hero, HERO_DATA.EventSequence) | 0
        const eMask = sprites.readDataNumber(hero, HERO_DATA.EventMask) | 0
        const e0 = sprites.readDataNumber(hero, HERO_DATA.EventP0) | 0
        const e1 = sprites.readDataNumber(hero, HERO_DATA.EventP1) | 0
        const e2 = sprites.readDataNumber(hero, HERO_DATA.EventP2) | 0
        const e3 = sprites.readDataNumber(hero, HERO_DATA.EventP3) | 0

        const rs = sprites.readDataNumber(hero, HERO_DATA.RenderStyleMask) | 0
        const rs0 = sprites.readDataNumber(hero, HERO_DATA.RenderStyleP0) | 0
        const rs1 = sprites.readDataNumber(hero, HERO_DATA.RenderStyleP1) | 0

        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED) ? 1 : 0
        const ctrl = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL) ? 1 : 0
        const strCh = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING) ? 1 : 0
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0

        const dir = sprites.readDataNumber(hero, HERO_DATA.DIR) | 0
        const phaseMirror = sprites.readDataString(hero, HERO_DATA.PHASE) || ""
        const fco = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
        const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY) | 0

        const wSl = sprites.readDataString(hero, HERO_DATA.WEAPON_SLASH_ID) || ""
        const wTh = sprites.readDataString(hero, HERO_DATA.WEAPON_THRUST_ID) || ""
        const wCa = sprites.readDataString(hero, HERO_DATA.WEAPON_CAST_ID) || ""
        const wEx = sprites.readDataString(hero, HERO_DATA.WEAPON_EXEC_ID) || ""
        const wCo = sprites.readDataString(hero, HERO_DATA.WEAPON_COMBO_ID) || ""

        // ------------------------------------------------------------
        // Per-tick aggregation meta (tspan + progress before/after)
        // Format: "t0,t1,phP0,phP1,ppP0,ppP1"
        // ------------------------------------------------------------
        let meta = _dbgContract_pendingLineByHero[hi] || ""
        let t0 = 0, t1 = 0, phP0 = 0, phP1 = 0, ppP0 = 0, ppP1 = 0
        if (meta && meta.indexOf(",") >= 0 && meta.indexOf("[CONTRACT]") < 0) {
            const parts = meta.split(",")
            if (parts.length >= 6) {
                t0 = parseInt(parts[0]) | 0
                t1 = parseInt(parts[1]) | 0
                phP0 = parseInt(parts[2]) | 0
                phP1 = parseInt(parts[3]) | 0
                ppP0 = parseInt(parts[4]) | 0
                ppP1 = parseInt(parts[5]) | 0
            }
        }

        if (!t0) {
            t0 = now
            phP0 = phP
            ppP0 = ppP
        }
        t1 = now
        phP1 = phP
        ppP1 = ppP

        _dbgContract_pendingLineByHero[hi] = "" + t0 + "," + t1 + "," + phP0 + "," + phP1 + "," + ppP0 + "," + ppP1

        // Accumulate stages (even if core unchanged)
        const prevStages = _dbgContract_pendingStagesByHero[hi] || ""
        if (!prevStages) {
            _dbgContract_pendingStagesByHero[hi] = st
        } else {
            const token = "|" + st + "|"
            const hay = "|" + prevStages + "|"
            if (hay.indexOf(token) < 0) {
                _dbgContract_pendingStagesByHero[hi] = prevStages + "|" + st
            }
        }

        // ------------------------------------------------------------
        // CORE signature: excludes progress and also excludes volatile sliding windows
        // (ppS/ppD) for whitelisted part names (ex: "drive").
        // ------------------------------------------------------------
        const ppVolatile = _dbgContract_isVolatilePartWindow(pp)
        const ppS_sig = ppVolatile ? 0 : (ppS | 0)
        const ppD_sig = ppVolatile ? 0 : (ppD | 0)

        const coreSig =
            owner + "|" + hi + "|" +
            aSeq + "|" + aKind + "|" + aVar + "|" + aSeed + "|" + aTgt + "|" +
            ph + "|" + phS + "|" + phD + "|" + phF + "|" +
            pp + "|" + ppS_sig + "|" + ppD_sig + "|" + ppF + "|" +
            eSeq + "|" + eMask + "|" + e0 + "|" + e1 + "|" + e2 + "|" + e3 + "|" +
            rs + "|" + rs0 + "|" + rs1 + "|" +
            busyUntil + "|" + locked + "|" + ctrl + "|" + strCh + "|" + agiState + "|" +
            family + "|" + dir + "|" + phaseMirror + "|" + fco + "|" +
            wSl + "|" + wTh + "|" + wCa + "|" + wEx + "|" + wCo

        // Change gate
        const printedCore0 = _dbgContract_lastPrintedSigByHero[hi] || ""
        if (coreSig === printedCore0) continue

        _dbgContract_pendingFlagByHero[hi] = 1
        _dbgContract_lastObservedSigByHero[hi] = coreSig

        // Build core line (prints REAL ppS/ppD so you can still see sliding values when something else changes)
        _dbgContract_pendingCoreLineByHero[hi] =
            `p=${owner} hi=${hi} ` +
            `A{seq=${aSeq} kind=${aKind} var=${aVar} seed=${aSeed} tgt=${aTgt}} ` +
            `Ph{name=${ph} s=${phS} d=${phD} f=${phF}} ` +
            `Part{name=${pp} s=${ppS} d=${ppD} f=${ppF}} ` +
            `Ev{seq=${eSeq} mask=${eMask} p0=${e0} p1=${e1} p2=${e2} p3=${e3}} ` +
            `Style{m=${rs} p0=${rs0} p1=${rs1}} ` +
            `Lock{busyUntil=${busyUntil} locked=${locked} ctrl=${ctrl} strCh=${strCh} agi=${agiState}} ` +
            `Glue{fam=${family} dir=${dir} phase=${phaseMirror} fco=${fco}} ` +
            `W{sl=${wSl} th=${wTh} ca=${wCa} ex=${wEx} co=${wCo}}`
    }
}


// ------------------------------------------------------------
// INTERNAL: flush pending CORE changes for a tick
// Prints CORE change with PROG before->after.
// ------------------------------------------------------------

// Add this new array near your other debug arrays (outside functions):
// const _dbgContract_pendingCoreLineByHero: string[] = []

function _dbgContract_flushTick(tickMs: number): void {
    const t = tickMs | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        // Always reset tick-span meta and stages after each tick,
        // but only print if pendingFlag says CORE changed.
        const meta = _dbgContract_pendingLineByHero[hi] || ""
        let t0 = 0, t1 = 0, phP0 = 0, phP1 = 0, ppP0 = 0, ppP1 = 0
        if (meta && meta.indexOf(",") >= 0 && meta.indexOf("[CONTRACT]") < 0) {
            const parts = meta.split(",")
            if (parts.length >= 6) {
                t0 = parseInt(parts[0]) | 0
                t1 = parseInt(parts[1]) | 0
                phP0 = parseInt(parts[2]) | 0
                phP1 = parseInt(parts[3]) | 0
                ppP0 = parseInt(parts[4]) | 0
                ppP1 = parseInt(parts[5]) | 0
            }
        }

        if (_dbgContract_pendingFlagByHero[hi]) {
            const stages = _dbgContract_pendingStagesByHero[hi] || ""
            const coreLine = _dbgContract_pendingCoreLineByHero[hi] || ""

            // Print with before/after progress only (no spam)
            console.log(
                `[CONTRACT] t=${t0}->${t1} stages={${stages}} ` +
                coreLine + " " +
                `PROG{ph ${phP0}->${phP1} part ${ppP0}->${ppP1}}`
            )

            // Commit printed CORE signature
            const coreSig = _dbgContract_lastObservedSigByHero[hi] || ""
            _dbgContract_lastPrintedSigByHero[hi] = coreSig
        }

        // Clear per-tick aggregation (always)
        _dbgContract_pendingFlagByHero[hi] = 0
        _dbgContract_pendingStagesByHero[hi] = ""
        _dbgContract_pendingLineByHero[hi] = ""
        _dbgContract_pendingCoreLineByHero[hi] = ""
    }
}




function _dbgAnimKeysLineEx(heroIndex: number, hero: Sprite, tag: string, extra: string): string {
    const base = _dbgAnimKeysLine(heroIndex, hero, tag)
    return extra ? (base + " " + extra) : base
}

function _dbgAnimKeys(heroIndex: number, hero: Sprite, tag: string, extra: string): void {
    if (!DEBUG_ANIM_KEYS) return
    if (DEBUG_ANIM_KEYS_HERO_INDEX >= 0 && heroIndex !== (DEBUG_ANIM_KEYS_HERO_INDEX | 0)) return
    const owner = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
    if (DEBUG_ANIM_KEYS_PLAYER_ID !== 0 && owner !== (DEBUG_ANIM_KEYS_PLAYER_ID | 0)) return
    console.log(_dbgAnimKeysLineEx(heroIndex, hero, tag, extra))
}

function _dbgFindHeroIndexForSprite(hero: Sprite): number {
    for (let hi = 0; hi < heroes.length; hi++) {
        if (heroes[hi] === hero) return hi
    }
    return -1
}

function _dbgMovePipeLine(tag: string, heroIndex: number, hero: Sprite, nowMs: number, extra: string): string {
    const p = sprites.readDataNumber(hero, HERO_DATA.PLAYER_ID) | 0

    const seq = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
    const kind = sprites.readDataString(hero, HERO_DATA.ActionKind) || ""
    const vari = sprites.readDataNumber(hero, HERO_DATA.ActionVariant) | 0
    const seed = sprites.readDataNumber(hero, HERO_DATA.ActionSeed) | 0
    const tgt = sprites.readDataNumber(hero, HERO_DATA.ActionTarget) | 0

    const phName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
    const phS = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
    const phD = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
    const phP = sprites.readDataNumber(hero, HERO_DATA.PhaseProgressInt) | 0
    const phF = sprites.readDataNumber(hero, HERO_DATA.PhaseFlags) | 0

    const partName = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
    const partS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
    const partD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
    const partP = sprites.readDataNumber(hero, HERO_DATA.PhasePartProgress) | 0
    const partF = sprites.readDataNumber(hero, HERO_DATA.PhasePartFlags) | 0

    const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
    const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED) ? 1 : 0
    const ctrl = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL) ? 1 : 0
    const strCh = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING) ? 1 : 0
    const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0

    const svx = sprites.readDataNumber(hero, HERO_DATA.STORED_VX) | 0
    const svy = sprites.readDataNumber(hero, HERO_DATA.STORED_VY) | 0

    // Keep this one-line and copy/paste friendly
    return (
        `[PIPE][${tag}] now=${nowMs} p=${p} hi=${heroIndex} ` +
        `A{seq=${seq} kind=${kind} var=${vari} seed=${seed} tgt=${tgt}} ` +
        `Ph{name=${phName} s=${phS} d=${phD} p=${phP} f=${phF}} ` +
        `Part{name=${partName} s=${partS} d=${partD} p=${partP} f=${partF}} ` +
        `Lock{busyUntil=${busyUntil} locked=${locked} ctrl=${ctrl} strCh=${strCh} agi=${agiState}} ` +
        `Vel{vx=${hero.vx | 0} vy=${hero.vy | 0} svx=${svx} svy=${svy}}` +
        (extra ? ` ${extra}` : "")
    )
}

function _dbgMovePipe(tag: string, heroIndex: number, hero: Sprite, nowMs: number, extra: string): void {
    if (!DEBUG_MOVE_PIPE) return

    const p = sprites.readDataNumber(hero, HERO_DATA.PLAYER_ID) | 0
    if (DEBUG_MOVE_PIPE_PLAYER !== 0 && p !== DEBUG_MOVE_PIPE_PLAYER) return

    console.log(_dbgMovePipeLine(tag, heroIndex, hero, nowMs, extra))
}

function _dbgMovePipeTick(tag: string, heroIndex: number, hero: Sprite, nowMs: number, extra: string): void {
    if (!DEBUG_MOVE_PIPE) return

    const p = sprites.readDataNumber(hero, HERO_DATA.PLAYER_ID) | 0
    if (DEBUG_MOVE_PIPE_PLAYER !== 0 && p !== DEBUG_MOVE_PIPE_PLAYER) return

    const last = (_dbgMovePipeLastMsByHero[heroIndex] | 0) || 0
    if (nowMs - last < DEBUG_MOVE_PIPE_THROTTLE_MS) return

    _dbgMovePipeLastMsByHero[heroIndex] = nowMs
    console.log(_dbgMovePipeLine(tag, heroIndex, hero, nowMs, extra))
}


function _dbgAnimKeysLine(heroIndex: number, hero: Sprite, tag: string): string {
    const aSeq = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
    const aKind = sprites.readDataString(hero, HERO_DATA.ActionKind) || ""
    const aVar = sprites.readDataNumber(hero, HERO_DATA.ActionVariant) | 0
    const aSeed = sprites.readDataNumber(hero, HERO_DATA.ActionSeed) | 0
    const aTgt = sprites.readDataNumber(hero, HERO_DATA.ActionTargetId) | 0

    const ph = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
    const phS = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
    const phD = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
    const phP = sprites.readDataNumber(hero, HERO_DATA.PhaseProgressInt) | 0
    const phF = sprites.readDataNumber(hero, HERO_DATA.PhaseFlags) | 0

    const pp = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
    const ppS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
    const ppD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
    const ppP = sprites.readDataNumber(hero, HERO_DATA.PhasePartProgress) | 0
    const ppF = sprites.readDataNumber(hero, HERO_DATA.PhasePartFlags) | 0

    const eSeq = sprites.readDataNumber(hero, HERO_DATA.EventSequence) | 0
    const eMask = sprites.readDataNumber(hero, HERO_DATA.EventMask) | 0
    const e0 = sprites.readDataNumber(hero, HERO_DATA.EventP0) | 0
    const e1 = sprites.readDataNumber(hero, HERO_DATA.EventP1) | 0
    const e2 = sprites.readDataNumber(hero, HERO_DATA.EventP2) | 0
    const e3 = sprites.readDataNumber(hero, HERO_DATA.EventP3) | 0

    const rs = sprites.readDataNumber(hero, HERO_DATA.RenderStyleMask) | 0
    const rs0 = sprites.readDataNumber(hero, HERO_DATA.RenderStyleP0) | 0
    const rs1 = sprites.readDataNumber(hero, HERO_DATA.RenderStyleP1) | 0

    const owner = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0

    return (
        `[ANIMKEYS][${tag}] p=${owner} hi=${heroIndex}` +
        ` A{seq=${aSeq} kind=${aKind} var=${aVar} seed=${aSeed} tgt=${aTgt}}` +
        ` Ph{name=${ph} s=${phS} d=${phD} p=${phP} f=${phF}}` +
        ` Part{name=${pp} s=${ppS} d=${ppD} p=${ppP} f=${ppF}}` +
        ` Ev{seq=${eSeq} mask=${eMask} p0=${e0} p1=${e1} p2=${e2} p3=${e3}}` +
        ` Style{m=${rs} p0=${rs0} p1=${rs1}}`
    )
}

function _dbgAgiAimLog(heroIndex: number, now: number, msg: string) {
    if (!DEBUG_AGI_AIM) return
    if (heroIndex !== (DEBUG_AGI_AIM_HERO_INDEX | 0)) return
    const last = (_dbgAgiAimLastMs[heroIndex] | 0)
    if (last && (now - last) < DEBUG_AGI_AIM_THROTTLE_MS) return
    _dbgAgiAimLastMs[heroIndex] = now | 0
    console.log("[AGI_AIM] h=" + heroIndex + " t=" + (now | 0) + " " + msg)
}



function _ambientPhaseWindowMs(phaseName: string): number {
    const p = (phaseName || "").toLowerCase()
    if (p === "run" || p === "walk") return AMBIENT_RUN_PHASE_DUR_MS
    if (p === "combatidle") return AMBIENT_COMBATIDLE_PHASE_DUR_MS
    return AMBIENT_IDLE_PHASE_DUR_MS
}



// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

function ensureHeroSpriteKinds(): void {
    const SK: any = SpriteKind as any

    // Phaser/compat build: SpriteKind.create() does not exist.
    // Rely on phaserSpriteKindShim() numeric ids instead.
    if (typeof SK.create !== "function") {
        // Defensive: ensure the fields exist (ids assigned in the shim).
        if (SK.Hero == null) SK.Hero = 50
        if (SK.HeroWeapon == null) SK.HeroWeapon = 51
        if (SK.HeroAura == null) SK.HeroAura = 52
        if (SK.EnemySpawner == null) SK.EnemySpawner = 53
        if (SK.SupportBeam == null) SK.SupportBeam = 54
        if (SK.SupportIcon == null) SK.SupportIcon = 55
        if (SK.Wall == null) SK.Wall = 56

        // Shop kinds (you said these are now fixed)
        if (SK.ShopUI == null) SK.ShopUI = 57
        if (SK.ShopNpc == null) SK.ShopNpc = 58
        if (SK.ShopItem == null) SK.ShopItem = 59
        return
    }

    // MakeCode Arcade runtime: create missing kinds normally
    if (!SpriteKind.Hero) SpriteKind.Hero = SpriteKind.create()
    if (!SpriteKind.HeroWeapon) SpriteKind.HeroWeapon = SpriteKind.create()
    if (!SpriteKind.HeroAura) SpriteKind.HeroAura = SpriteKind.create()
    if (!SpriteKind.EnemySpawner) SpriteKind.EnemySpawner = SpriteKind.create()
    if (!SpriteKind.SupportBeam) SpriteKind.SupportBeam = SpriteKind.create()
    if (!SpriteKind.SupportIcon) SpriteKind.SupportIcon = SpriteKind.create()
    if (!SpriteKind.Wall) SpriteKind.Wall = SpriteKind.create()

    if (!SpriteKind.ShopUI) SpriteKind.ShopUI = SpriteKind.create()
    if (!SpriteKind.ShopNpc) SpriteKind.ShopNpc = SpriteKind.create()
    if (!SpriteKind.ShopItem) SpriteKind.ShopItem = SpriteKind.create()
}

// Phaser/ESM shim: ensure custom SpriteKinds exist before any overlaps are registered.
ensureHeroSpriteKinds();



function clampInt(v: number, lo: number, hi: number): number {
    if (v < lo) return lo
    if (v > hi) return hi
    return v | 0
}


function splitAgiThrustDurations(totalMs: number): [number, number, number] {
    const T = Math.max(1, totalMs | 0)

    let wind = Math.idiv(T * AGI_THRUST_WINDUP_FRAC_X1000, 1000)
    let fwd  = Math.idiv(T * AGI_THRUST_FORWARD_FRAC_X1000, 1000)
    let land = T - wind - fwd

    // safety mins so we never get 0ms phases on small durations
    if (wind < 1) wind = 1
    if (fwd < 1) fwd = 1
    if (land < 1) land = 1

    // re-balance if we over-allocated
    const sum = wind + fwd + land
    if (sum !== T) {
        land = Math.max(1, land + (T - sum))
    }

    return [wind, fwd, land]
}


function _animKeys_clearPhasePart(hero: Sprite): void {
    const prevPart = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
    const prevS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
    const prevD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0

    // Safe defaults (PhasePart is optional until we start wiring segmented moves)
    sprites.setDataString(hero, HERO_DATA.PhasePartName, "")
    sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, 0) // 0..PHASE_PROGRESS_MAX
    sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)

    // ---- LOG: clear only if we cleared a real part ----
    if (DEBUG_ANIM_KEYS_PHASE_PART && prevPart) {
        const hi = getHeroIndex(hero) | 0
        if (hi >= 0) {
            const now = game.runtime() | 0
            _dbgAnimKeys(hi, hero, "PART_CLEAR", `t=${now} prev{${prevPart} s=${prevS} d=${prevD}}`)
        }
    }
}

function _animKeys_actionBeginHygiene(hero: Sprite): void {
    // Allowed action-edge resets (prevents stale visuals)
    sprites.setDataNumber(hero, HERO_DATA.PhaseFlags, 0)

    // Event bus hygiene: clear mask + payload (emitters are the only writers of EventSequence)
    _animEvent_clear(hero)

    // Clear phase-part segmentation so new actions don't inherit old parts
    _animKeys_clearPhasePart(hero)
}


function _animKeys_stampPhaseWindow(
    heroIndex: number,
    hero: Sprite,
    phaseName: string,
    nowMs: number,
    durationMs: number,
    where: string
): void {
    const now = nowMs | 0;
    const dur = durationMs | 0;

    _animInvAssert(phaseName.length > 0, where, heroIndex, `stampPhaseWindow called with empty phaseName`);
    _animInvAssert(dur > 0, where, heroIndex, `stampPhaseWindow("${phaseName}") durationMs must be > 0 (got ${dur})`);

    const prevName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
    const prevS = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
    const prevD = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0

    sprites.setDataString(hero, HERO_DATA.PhaseName, phaseName);
    sprites.setDataNumber(hero, HERO_DATA.PhaseStartMs, now);
    sprites.setDataNumber(hero, HERO_DATA.PhaseDurationMs, dur);

    // A new stamped window must start at progress=0 to avoid stale values.
    sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, 0);

    // Hard-fail + consistency check right after stamping.
    _animInvCheckHeroTimeline(heroIndex, hero, now, `${where}::stampPhaseWindow("${phaseName}")`);

    // ---- LOG: authoritative timing publish ----
    if (DEBUG_ANIM_KEYS_PHASE_STAMP) {
        _dbgAnimKeys(heroIndex, hero, "PHASE_STAMP",
            `t=${now} where=${where} prev{${prevName} s=${prevS} d=${prevD}} now{${phaseName} s=${now} d=${dur}}`
        )
    }
}


// Compat alias: some newer shop/POC code calls this older name.
// Keep it as a thin wrapper so we don't have to hunt callsites.
function _animKeys_setHeroPhaseWindow(
    heroIndex: number,
    hero: Sprite,
    phaseName: string,
    nowMs: number,
    durationMs: number,
    where: string
): void {
    _animKeys_stampPhaseWindow(heroIndex, hero, phaseName, nowMs, durationMs, where)
}


function _animKeys_setPhasePart(
    hero: Sprite,
    partName: string,
    partStartMs: number,
    partDurationMs: number,
    nowMs: number
): void {
    const start = (partStartMs | 0)
    const now = (nowMs | 0)
    const dur = (partDurationMs | 0)

    // If you're setting a named part, duration must be > 0.
    if (partName && partName.length) {
        _animInvAssert(dur > 0, "setPhasePart", -1, `PhasePart "${partName}" duration must be > 0 (got ${dur})`)
    }

    const prevPart = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
    const prevS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
    const prevD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0

    sprites.setDataString(hero, HERO_DATA.PhasePartName, partName)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, start)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, dur)

    // Progress: 0..PHASE_PROGRESS_MAX
    let pInt = 0
    if (dur > 0) {
        const elapsed = clampInt(now - start, 0, dur)
        pInt = clampInt(Math.idiv(PHASE_PROGRESS_MAX * elapsed, dur), 0, PHASE_PROGRESS_MAX)
    }
    sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, pInt)

    // Default flags to 0 unless caller sets later
    sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)

    // ---- LOG: phase-part publish/change ----
    if (DEBUG_ANIM_KEYS_PHASE_PART) {
        const hi = getHeroIndex(hero) | 0
        if (hi >= 0) {
            _dbgAnimKeys(hi, hero, "PART_SET",
                `t=${now} prev{${prevPart} s=${prevS} d=${prevD}} now{${partName} s=${start} d=${dur}}`
            )
        }
    }
}


function _animEvent_reset(hero: Sprite): void {
    sprites.setDataNumber(hero, HERO_DATA.EventSequence, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventMask, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP0, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP1, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP2, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP3, 0)
}

function _animEvent_clear(hero: Sprite): void {
    sprites.setDataNumber(hero, HERO_DATA.EventMask, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP0, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP1, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP2, 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP3, 0)
}

function _animEvent_emit(hero: Sprite, mask: number, p0: number, p1: number, p2: number, p3: number): void {
    const seq0 = sprites.readDataNumber(hero, HERO_DATA.EventSequence) | 0
    sprites.setDataNumber(hero, HERO_DATA.EventSequence, (seq0 + 1) | 0)

    sprites.setDataNumber(hero, HERO_DATA.EventMask, mask | 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP0, p0 | 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP1, p1 | 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP2, p2 | 0)
    sprites.setDataNumber(hero, HERO_DATA.EventP3, p3 | 0)
}



function _elemToRenderStyleMask(element: number): number {
    const e = element | 0
    if (e <= 0) return 0
    // Reserve bit0 for future non-element styles; elements occupy bits 1..n.
    return (1 << e) | 0
}

function _animKeys_setRenderStyle(hero: Sprite, styleMask: number, p0: number, p1: number): void {
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleMask, styleMask | 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP0, p0 | 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP1, p1 | 0)
}


// --------------------------------------------------------------
// HARD FAIL animation timeline invariants
// Goal: immediately detect missing PhaseDurationMs / stale keys / out-of-range progress.
// --------------------------------------------------------------

const ANIM_INVARIANTS_HARDFAIL = true

function _animInvFail(tag: string, heroIndex: number, msg: string): void {
    const full = `[ANIM-INVARIANT] ${tag} hero=${heroIndex} :: ${msg}`
    if (ANIM_INVARIANTS_HARDFAIL) throw new Error(full)
    // If you ever flip to soft mode later:
    // console.log(full)
}

function _animInvAssert(cond: boolean, tag: string, heroIndex: number, msg: string): void {
    if (!cond) _animInvFail(tag, heroIndex, msg)
}

function _animInvStr(hero: Sprite, k: string): string {
    const v = sprites.readDataString(hero, k as any)
    return v ? String(v) : ""
}
function _animInvNum(hero: Sprite, k: string): number {
    return sprites.readDataNumber(hero, k as any) | 0
}


function _animInvHardFail(where: string, heroIndex: number, message: string, ctx?: any): void {
    let extra = ""
    if (ctx !== undefined) {
        try {
            extra = " " + JSON.stringify(ctx)
        } catch (e) {
            extra = " " + String(ctx)
        }
    }

    // tag first, then heroIndex, then message
    _animInvFail(`[ANIM-INV] ${where}`, heroIndex, `${message}${extra}`)
}


function _animInvCheckHeroTimeline(heroIndex: number, hero: Sprite, nowMs: number, where: string): void {
    // Step 6: Unified contract invariants
    // - PhaseName is ALWAYS the render phase (ambient or action).
    // - PhaseStartMs/PhaseDurationMs must ALWAYS be valid (non-zero) for live heroes.
    // - PhasePart is optional and may be blank outside move segments.
    // - ActionSequence/ActionKind must be valid (seeded at spawn).

    if (!ANIM_INVARIANTS_HARDFAIL) return

    const now = nowMs | 0

    const phaseName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
    const phaseStart = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
    const phaseDur = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
    const phaseProg = sprites.readDataNumber(hero, HERO_DATA.PhaseProgressInt) | 0

    const partName = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
    const partStart = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
    const partDur = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
    const partProg = sprites.readDataNumber(hero, HERO_DATA.PhasePartProgress) | 0

    const actionSeq = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
    const actionKind = sprites.readDataString(hero, HERO_DATA.ActionKind) || ""

    const evSeq = sprites.readDataNumber(hero, HERO_DATA.EventSequence) | 0
    const evMask = sprites.readDataNumber(hero, HERO_DATA.EventMask) | 0

    // Minimal context for hardfail reports
    const ctx: any = {
        where,
        nowMs: now,
        x: hero.x | 0,
        y: hero.y | 0,
        busyUntil: sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0,
        phaseName,
        phaseStart,
        phaseDur,
        phaseProg,
        partName,
        partStart,
        partDur,
        partProg,
        actionSeq,
        actionKind,
        evSeq,
        evMask
    }

    // Action identity must always be valid (spawn seeds it).
    if (actionSeq <= 0) {
        _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.ActionSequence}: ${actionSeq}`, ctx)
    }
    if (!actionKind) {
        _animInvHardFail(where, heroIndex, `missing ${HERO_DATA.ActionKind}`, ctx)
    }

    // Unified Phase window invariants
    if (!phaseName) {
        _animInvHardFail(where, heroIndex, `missing ${HERO_DATA.PhaseName}`, ctx)
    }
    if (phaseStart <= 0) {
        _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhaseStartMs}: ${phaseStart}`, ctx)
    }
    if (phaseDur <= 0) {
        _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhaseDurationMs}: ${phaseDur}`, ctx)
    }
    if (phaseProg < 0 || phaseProg > PHASE_PROGRESS_MAX) {
        _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhaseProgressInt}: ${phaseProg}`, ctx)
    }

    // Part is optional; if present, must be valid
    if (partName) {
        if (partStart <= 0) {
            _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhasePartStartMs}: ${partStart}`, ctx)
        }
        if (partDur <= 0) {
            _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhasePartDurationMs}: ${partDur}`, ctx)
        }
        if (partProg < 0 || partProg > PHASE_PROGRESS_MAX) {
            _animInvHardFail(where, heroIndex, `invalid ${HERO_DATA.PhasePartProgress}: ${partProg}`, ctx)
        }
    }

    // Optional monotonic guard (debug only): ActionSequence must never regress
    const last = sprites.readDataNumber(hero, HERO_DATA._InvLastActionSequence) | 0
    if (last && actionSeq < last) {
        _animInvHardFail(where, heroIndex, `ActionSequence regressed: ${actionSeq} < ${last}`, ctx)
    }
    sprites.setDataNumber(hero, HERO_DATA._InvLastActionSequence, actionSeq)
}

// !!! CONTRACT NOTE !!!
// LEGACY PUBLISHER (TEMPORARILY VIOLATES SINGLE-WRITER CONTRACT)
// - This currently increments ActionSequence and stamps Phase keys.
// - In the final design this must become READ-ONLY (or be retired).
// - callHeroAnim() must not call this once Step 3/4 are applied.
function publishHeroActionPhase(
    hero: Sprite,
    actionKind: string,
    phaseName: string,
    phaseDurationMs: number,
    nowMs: number
): void {
    // RETIRED (READ-ONLY / NO-OP)
    // This function used to (incorrectly, per the new contract) increment ActionSequence and stamp Phase keys.
    // Keeping it as a no-op prevents accidental future calls from breaking the single-writer rules.
    //
    // Authoritative publishers now are:
    //  - _doHeroMoveBeginActionTimeline()   (Action edge + ActionSequence increment)
    //  - _doHeroMovePlayAnimAndDispatch()   (Phase window stamp)
    //  - setHeroPhaseString()              (ambient phase changes)
    //  - move timing loops                 (PhaseProgressInt / PhasePart*)
    //  - event emitters                    (EventSequence pulses)

    if (DEBUG_WARN_PUBLISH_HERO_ACTION_PHASE) {
        console.log(
            `[WARN][publishHeroActionPhase] deprecated call; actionKind=${actionKind} phase=${phaseName} dur=${phaseDurationMs | 0} now=${nowMs | 0}`
        )
    }
}




function getHardcodedWeaponLoadoutForHero(profileName: string, familyNumber: number): HardcodedWeaponLoadout {
    const key = String(profileName || "").trim().toLowerCase()

    switch (key) {
        default:
            return {
                slashId: DEFAULT_WEAPON_SLASH_ID,
                thrustId: DEFAULT_WEAPON_THRUST_ID,
                castId: DEFAULT_WEAPON_CAST_ID,
                execId: DEFAULT_WEAPON_EXEC_ID,

                // NEW: combo weapon (used during agility charge / combo visuals)
                comboId: DEFAULT_WEAPON_COMBO_ID,
            }
    }
}





// ================================================================
// ================================================================
// ================================================================
// SECTION 2 - HELPER FUNCTIONS and Phaser Helper Constants
// ================================================================
// Utility helpers used across the engine. Stateless. No side effects.
// ================================================================
// ================================================================
// ================================================================
// ================================================================

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// This section is for the "global helpers", those that truly serve any function and provide base calculations


function worldPixelWidth(): number {
    return WORLD_TILES_W * WORLD_TILE_SIZE;
}

function worldPixelHeight(): number {
    return WORLD_TILES_H * WORLD_TILE_SIZE;
}

function worldCenter(): { x: number; y: number } {
    return {
        x: worldPixelWidth() / 2,
        y: worldPixelHeight() / 2
    };
}

function makeBaseStats(baseTimeMs: number) {
    const stats: number[] = []
    for (let i = 0; i < STAT.LEN; i++) stats[i] = 0
    stats[STAT.DAMAGE_MULT] = 100
    stats[STAT.MOVE_DURATION] = baseTimeMs
    return stats
}

function getBaseMoveDurationMs(button: string, family: number) {
    let base = 300
    if (family == FAMILY.STRENGTH) base = 400
    else if (family == FAMILY.AGILITY) base = 250
    else if (family == FAMILY.INTELLECT || family == FAMILY.HEAL) base = 350
    if (button == "A+B") base += 150
    return base
}

function getBasePower(family: number) {
    if (family == FAMILY.STRENGTH) return 15
    if (family == FAMILY.AGILITY) return 10
    if (family == FAMILY.INTELLECT) return 8
    if (family == FAMILY.HEAL) return 8
    return 5
}

// Map numeric anim IDs to string keys (used by callHeroAnim)
function animIdToKey(id: number) {
    if (id == ANIM.ID.A) return ANIM.A
    if (id == ANIM.ID.B) return ANIM.B
    if (id == ANIM.ID.AB) return ANIM.AB
    return ANIM.IDLE
}

function distanceTo(a: Sprite, b: Sprite): number {
    if (!a || !b) return 99999
    const dx = b.x - a.x, dy = b.y - a.y
    return Math.sqrt(dx * dx + dy * dy)
}

function distSqPointToSprite(px: number, py: number, s: Sprite): number { const dx = px - s.x, dy = py - s.y; return dx * dx + dy * dy }

function worldPointAlongRay(ax: number, ay: number, nx: number, ny: number, s: number) { return [ax + nx * s, ay + ny * s] }

// Tint helper: remap one color index to another
function tintImageReplace(imgBase: Image, fromColor: number, toColor: number): Image {
    const w = imgBase.width, h = imgBase.height
    const out = image.create(w, h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = imgBase.getPixel(x, y)
        out.setPixel(x, y, p == fromColor ? toColor : p)
    }
    return out
}


function getAimVectorForHero(heroIndex: number): number[] {
    // Use MakeCode-style per-player d-pad buttons (works even if hero movement is locked)
    let p: any = controller.player1
    if (heroIndex === 1) p = controller.player2
    else if (heroIndex === 2) p = controller.player3
    else if (heroIndex === 3) p = controller.player4

    // Defensive fallback (should never hit if controller is present)
    if (!p || !p.left || !p.right || !p.up || !p.down) {
        let dx0 = heroFacingX[heroIndex] || 0
        let dy0 = heroFacingY[heroIndex] || 0
        if (dx0 === 0 && dy0 === 0) { dx0 = 1; dy0 = 0 }
        return [dx0, dy0]
    }

    const left  = p.left.isPressed() ? 1 : 0
    const right = p.right.isPressed() ? 1 : 0
    const up    = p.up.isPressed() ? 1 : 0
    const down  = p.down.isPressed() ? 1 : 0

    let dx = (right - left) | 0
    let dy = (down - up) | 0

    // If no d-pad held, keep last facing so spell continues smoothly.
    if (dx === 0 && dy === 0) {
        dx = heroFacingX[heroIndex] || 0
        dy = heroFacingY[heroIndex] || 0
        if (dx === 0 && dy === 0) { dx = 1; dy = 0 }
    }

    return [dx, dy]
}

function r2(v: number) { return Math.round(v * 100) / 100 }
function r3(v: number) { return Math.round(v * 1000) / 1000 }


// --------------------------------------------------------------
// MOD BANK: unlimited additive effectors by bucket+label
// - Store unlimited entries (arrays) in JS memory (safe)
// - Cache sums per hero+bucket for O(1) reads in hot paths
// - Apply by modifying traits[] before calculateMoveStatsForFamily()
// --------------------------------------------------------------

type ModEntry = { label: string, value: number }

// Buckets (POC: family-only damage axis = TRAIT1)
const MOD_BUCKET_STR_DMG = "STR_DMG"
const MOD_BUCKET_AGI_DMG = "AGI_DMG"
const MOD_BUCKET_INT_DMG = "INT_DMG"
const MOD_BUCKET_SUP_DMG = "SUP_DMG"

// Lists live in memory (unbounded)
const _heroMods: { [heroIndex: number]: { [bucket: string]: ModEntry[] } } = {}
// Cached sums (fast reads)
const _heroModSums: { [heroIndex: number]: { [bucket: string]: number } } = {}

function _ensureHeroBucket(heroIndex: number, bucket: string): ModEntry[] {
    let h = _heroMods[heroIndex]
    if (!h) { h = {}; _heroMods[heroIndex] = h }
    let arr = h[bucket]
    if (!arr) { arr = []; h[bucket] = arr }
    return arr
}

function _recomputeHeroBucketSum(heroIndex: number, bucket: string): number {
    const arr = _ensureHeroBucket(heroIndex, bucket)
    let sum = 0
    for (let i = 0; i < arr.length; i++) sum += (arr[i].value | 0)

    let s = _heroModSums[heroIndex]
    if (!s) { s = {}; _heroModSums[heroIndex] = s }
    s[bucket] = sum
    return sum
}

function heroModGet(heroIndex: number, bucket: string, label: string): number {
    const arr = _ensureHeroBucket(heroIndex, bucket)
    for (let i = 0; i < arr.length; i++) if (arr[i].label === label) return arr[i].value | 0
    return 0
}

// Sets/overwrites the value for a label (best for "shop level", "relic id", etc.)
function heroModSet(heroIndex: number, bucket: string, label: string, value: number): number {
    const arr = _ensureHeroBucket(heroIndex, bucket)
    const v = value | 0

    for (let i = 0; i < arr.length; i++) {
        if (arr[i].label === label) {
            arr[i].value = v
            return _recomputeHeroBucketSum(heroIndex, bucket)
        }
    }

    arr.push({ label, value: v })
    return _recomputeHeroBucketSum(heroIndex, bucket)
}

function heroModRemove(heroIndex: number, bucket: string, label: string): number {
    const arr = _ensureHeroBucket(heroIndex, bucket)
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].label === label) { arr.removeAt(i); break }
    }
    return _recomputeHeroBucketSum(heroIndex, bucket)
}

function heroModSum(heroIndex: number, bucket: string): number {
    const s = _heroModSums[heroIndex]
    if (s && (bucket in s)) return s[bucket] | 0
    return _recomputeHeroBucketSum(heroIndex, bucket)
}

function heroModDebug(heroIndex: number, bucket: string): string {
    const arr = _ensureHeroBucket(heroIndex, bucket)
    let out = ""
    for (let i = 0; i < arr.length; i++) {
        const e = arr[i]
        if (i) out += " "
        out += `${e.label}:${e.value | 0}`
    }
    return out
}

// --------------------------------------------------------------
// APPLY MODS: POC = add bucket sum to TRAIT1 (damage axis) per family
// --------------------------------------------------------------

function _damageBucketForFamily(family: number): string {
    switch (family | 0) {
        case FAMILY.STRENGTH:  return MOD_BUCKET_STR_DMG
        case FAMILY.AGILITY:   return MOD_BUCKET_AGI_DMG
        case FAMILY.INTELLECT: return MOD_BUCKET_INT_DMG
        case FAMILY.HEAL:      return MOD_BUCKET_SUP_DMG
    }
    return ""
}

// Returns either the original traits array (no change) OR a cloned array with TRAIT1 modified.
function applyDamageModsToTraits(heroIndex: number, family: number, traits: number[]): number[] {
    const b = _damageBucketForFamily(family)
    if (!b) return traits

    const bonus = heroModSum(heroIndex, b) | 0
    if (!bonus) return traits

    const out = traits.slice()
    out[OUT.TRAIT1] = (out[OUT.TRAIT1] | 0) + bonus
    return out
}

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
//This is the shops section
// Shop section



// ------------------------------
// SHOP registries (optional)
// ------------------------------
const SHOP_NPCS: Sprite[] = []
const SHOP_ITEMS: Sprite[] = []

// ------------------------------
// Shop constants
// ------------------------------
const SHOPKEEPER_PLAYER_ID = 99
const SHOPKEEPER_HERO_NAME = "Shopkeeper"
const SHOP_FOCUS_KEEPALIVE_MS = 120

// ------------------------------
// Shop runtime objects
// ------------------------------
let shopkeeperNpc: Sprite = null
let shopItemPedestal: Sprite = null
let shopTriggerZone: Sprite = null

// Ring offer hitboxes (invisible ShopItem sprites)
let _shopRingOfferItems: Sprite[] = []

// ------------------------------
// Per-hero shop state (heroIndex 0..3)
// ------------------------------
// Focus = "which offer am I currently touching/focused on?"
let shopFocusOfferByHero: Sprite[] = [null, null, null, null]
let shopFocusRingIndexByHero: number[] = [-1, -1, -1, -1]
let shopFocusUntilMsByHero: number[] = [0, 0, 0, 0]

// UI gating + purchase flags (if you still want them)
let shopTouchUntilMsByHero: number[] = [0, 0, 0, 0]
let shopBoughtByHero: boolean[] = [false, false, false, false]

// ------------------------------
// Debug + input edges
// ------------------------------
let _shopLastDebugDumpMs = 0
const SHOP_DEBUG_DUMP_EVERY_MS = 25000

let shopPrevAByPlayer: boolean[] = [false, false, false, false]
let shopPrevBByPlayer: boolean[] = [false, false, false, false]
let shopPrevUpByPlayer: boolean[] = [false, false, false, false]
let shopPrevDownByPlayer: boolean[] = [false, false, false, false]
let shopPrevLeftByPlayer: boolean[] = [false, false, false, false]
let shopPrevRightByPlayer: boolean[] = [false, false, false, false]

// --- SHOP UI state (MUST be top-level globals) ---
let shopUiBgByHero: Sprite[] = [null, null, null, null]
let shopUiTextByHero: TextSprite[] = [null, null, null, null]
let shopUiStatsByHero: TextSprite[] = [null, null, null, null]

// --- Shop focus change debug (MUST be top-level globals) ---
let _shopPrevTouchMask = -1
let _shopPrevTouchByHero = ""

let SHOP_TOUCH_GRACE_MS = 100

let _shopDbgNextAllowedMs = 0
let _shopDbgPrevSig = ""
const SHOP_DBG_MIN_INTERVAL_MS = 500   // throttle (still prints immediately on changes)

// "p1=2|p2=-1|p3=-1|p4=0"  (ring index touched by each player; -1 = none)
const SHOP_WPN_TOUCHED_RING_BY_PID_KEY = "shopWpnTouchedRingByPid"

// "p1=dagger|p2=|p3=|p4=glowsword"
const SHOP_WPN_TOUCHED_ID_BY_PID_KEY = "shopWpnTouchedIdByPid"

// Optional: "p1=thrust|p2=|p3=|p4=slash"
const SHOP_WPN_TOUCHED_SLOT_BY_PID_KEY = "shopWpnTouchedSlotByPid"

// --------------------------------------------------------------
// Per-hero focused offer state (computed each frame)
// --------------------------------------------------------------
//let shopFocusUntilMsByHero: number[] = [0, 0, 0, 0]
//let shopFocusOfferByHero: Sprite[] = [null, null, null, null]

//let shopFocusRingIndexByHero: number[] = [-1, -1, -1, -1]

// --------------------------------------------------------------
// Shop input edge detect (separate from combat input)
// --------------------------------------------------------------
// --------------------------------------------------------------
// Shop tick throttles
// --------------------------------------------------------------
//const SHOP_DEBUG_DUMP_EVERY_MS = 250

// How long a focus stays “alive” without a continuous overlap event.
//const SHOP_FOCUS_KEEPALIVE_MS = 120



function enterShopMode(): void {
    if (_shopEntered) return
    _shopEntered = false
    if(SHOP_MODE_ACTIVE_MASTER) {
    SHOP_MODE_ACTIVE = true
    }
    // Create shopkeeper + publish contract + spawn offers
    shopInitPOC()

    // Optional: immediate debug
    console.log("[SHOP] ENTER shop mode t=" + (game.runtime() | 0))
}



function _shopEnsurePerHeroStateArrays(): void {
    const N = 4

    // (These vars MUST already be declared at top-level in this namespace.)
    if (shopFocusRingIndexByHero === null) shopFocusRingIndexByHero = []
    if (shopFocusUntilMsByHero === null) shopFocusUntilMsByHero = []
    if (shopTouchUntilMsByHero === null) shopTouchUntilMsByHero = []
    if (shopBoughtByHero === null) shopBoughtByHero = []
    if (shopFocusOfferByHero === null) shopFocusOfferByHero = []

    while (shopFocusRingIndexByHero.length < N) shopFocusRingIndexByHero.push(-1)
    while (shopFocusUntilMsByHero.length < N) shopFocusUntilMsByHero.push(0)
    while (shopTouchUntilMsByHero.length < N) shopTouchUntilMsByHero.push(0)
    while (shopBoughtByHero.length < N) shopBoughtByHero.push(false)
    while (shopFocusOfferByHero.length < N) shopFocusOfferByHero.push(null)
}



function shopTick(nowMs: number): void {
    const now = nowMs | 0
    if (!HeroEngine._isStarted()) return

    // Only init when missing/destroyed (DO NOT re-init every frame)
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) {
        shopInitPOC()
    }

    // If still not present, bail cleanly.
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) {
        console.log("Ending shop mode")
        SHOP_MODE_ACTIVE = false
        return
    }

    // 1) Compute which offer each hero is focused/touching (grace-window)
    shopUpdateFocus(now)

    // 2) Publish highlight contract on shopkeeper sprite
    shopPublishTouchedMapOnShopkeeper(now)

    // 3) Route shop controls (A buy, B return, arrows reserved for future UI)
    shopHandleControls(now)

    // 4) Decide whether shop mode is active
    let anyActive = false
    for (let hi = 0; hi < 4; hi++) {
        if (now <= (shopFocusUntilMsByHero[hi] | 0)) { anyActive = true; break }
    }

//    console.log("Before anyactive Shop mode is ", SHOP_MODE_ACTIVE)
//    SHOP_MODE_ACTIVE = anyActive
//    console.log("After anyactive Shop mode is ", SHOP_MODE_ACTIVE)

    // 5) Debug dump (throttled inside)
    shopDebugDump(now)
}


function shopPollControls(hi: number): {
    A_edge: boolean;
    B_edge: boolean;
    Up_edge: boolean;
    Down_edge: boolean;
    Left_edge: boolean;
    Right_edge: boolean;
} {
    const i = hi | 0
    if (i < 0 || i > 3) {
        return { A_edge: false, B_edge: false, Up_edge: false, Down_edge: false, Left_edge: false, Right_edge: false }
    }

    let aNow = false, bNow = false, upNow = false, downNow = false, leftNow = false, rightNow = false

    if (i === 0) {
        aNow = controller.player1.A.isPressed()
        bNow = controller.player1.B.isPressed()
        upNow = controller.player1.up.isPressed()
        downNow = controller.player1.down.isPressed()
        leftNow = controller.player1.left.isPressed()
        rightNow = controller.player1.right.isPressed()
    } else if (i === 1) {
        aNow = controller.player2.A.isPressed()
        bNow = controller.player2.B.isPressed()
        upNow = controller.player2.up.isPressed()
        downNow = controller.player2.down.isPressed()
        leftNow = controller.player2.left.isPressed()
        rightNow = controller.player2.right.isPressed()
    } else if (i === 2) {
        aNow = controller.player3.A.isPressed()
        bNow = controller.player3.B.isPressed()
        upNow = controller.player3.up.isPressed()
        downNow = controller.player3.down.isPressed()
        leftNow = controller.player3.left.isPressed()
        rightNow = controller.player3.right.isPressed()
    } else {
        aNow = controller.player4.A.isPressed()
        bNow = controller.player4.B.isPressed()
        upNow = controller.player4.up.isPressed()
        downNow = controller.player4.down.isPressed()
        leftNow = controller.player4.left.isPressed()
        rightNow = controller.player4.right.isPressed()
    }

    const aPrev = shopPrevAByPlayer[i]
    const bPrev = shopPrevBByPlayer[i]
    const upPrev = shopPrevUpByPlayer[i]
    const downPrev = shopPrevDownByPlayer[i]
    const leftPrev = shopPrevLeftByPlayer[i]
    const rightPrev = shopPrevRightByPlayer[i]

    shopPrevAByPlayer[i] = aNow
    shopPrevBByPlayer[i] = bNow
    shopPrevUpByPlayer[i] = upNow
    shopPrevDownByPlayer[i] = downNow
    shopPrevLeftByPlayer[i] = leftNow
    shopPrevRightByPlayer[i] = rightNow

    return {
        A_edge: !!(aNow && !aPrev),
        B_edge: !!(bNow && !bPrev),
        Up_edge: !!(upNow && !upPrev),
        Down_edge: !!(downNow && !downPrev),
        Left_edge: !!(leftNow && !leftPrev),
        Right_edge: !!(rightNow && !rightPrev),
    }
}



function shopUpdateFocus(nowMs: number): void {
    const now = nowMs | 0

    // Cull destroyed focus references
    for (let hi = 0; hi < 4; hi++) {
        const cur = shopFocusOfferByHero[hi]
        if (cur && (cur.flags & sprites.Flag.Destroyed)) {
            shopFocusOfferByHero[hi] = null
            shopFocusRingIndexByHero[hi] = -1
            shopFocusUntilMsByHero[hi] = 0
        }
    }

    // We prefer SHOP_ITEMS if you maintain it; otherwise fallback to sprites.allOfKind
    let offers: Sprite[] = null as any
    try {
        // If SHOP_ITEMS exists in your file, use it.
        // (This try prevents a compile fail if SHOP_ITEMS isn't declared in this branch.)
        offers = (SHOP_ITEMS as any)
    } catch (e) {
        offers = null
    }
    if (!offers) offers = sprites.allOfKind(SpriteKind.ShopItem)

    // Build a small candidate list sorted by ring index (if present)
    // NOTE: ring index key name must match what your spawn/builder sets.
    // Your spawnShopItem() uses SH_ITEM_RING_INDEX.
    const sorted: Sprite[] = []
    for (let i = 0; i < offers.length; i++) {
        const s = offers[i]
        if (!s) continue
        if (s.flags & sprites.Flag.Destroyed) continue
        sorted.push(s)
    }
    sorted.sort(function (a: Sprite, b: Sprite): number {
        const ai = sprites.readDataNumber(a, SH_ITEM_RING_INDEX) | 0
        const bi = sprites.readDataNumber(b, SH_ITEM_RING_INDEX) | 0
        return ai - bi
    })

    for (let hi = 0; hi < 4; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        let found: Sprite = null
        let foundRing = -1

        for (let j = 0; j < sorted.length; j++) {
            const it = sorted[j]
            if (!it) continue
            if (_shopIsOverlapping(hero, it)) {
                found = it
                foundRing = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
                break
            }
        }

        if (found) {
            shopFocusOfferByHero[hi] = found
            shopFocusRingIndexByHero[hi] = foundRing
            shopFocusUntilMsByHero[hi] = (now + SHOP_FOCUS_KEEPALIVE_MS) | 0
        } else {
            // grace window: keep focus alive briefly even without a continuous overlap
            if (now > (shopFocusUntilMsByHero[hi] | 0)) {
                shopFocusOfferByHero[hi] = null
                shopFocusRingIndexByHero[hi] = -1
                shopFocusUntilMsByHero[hi] = 0
            }
        }
    }
}



function shopPublishTouchedMapOnShopkeeper(nowMs: number): void {
    const now = nowMs | 0
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) return

    // Build: p1=2|p2=-1|p3=-1|p4=0
    let ringByPid = ""
    let idByPid = ""
    let slotByPid = ""

    for (let hi = 0; hi < 4; hi++) {
        const pid = (hi + 1) | 0
        let ring = -1
        let wid = ""
        let slot = ""

        if (now <= (shopFocusUntilMsByHero[hi] | 0)) {
            ring = shopFocusRingIndexByHero[hi] | 0
            const offer = shopFocusOfferByHero[hi]
            if (offer && !(offer.flags & sprites.Flag.Destroyed)) {
                wid = sprites.readDataString(offer, SH_ITEM_WEAPON_ID) || ""
                slot = sprites.readDataString(offer, SH_ITEM_RENDER_SLOT) || ""
            }
        }

        if (hi > 0) { ringByPid += "|"; idByPid += "|"; slotByPid += "|" }
        ringByPid += "p" + pid + "=" + ring
        idByPid += "p" + pid + "=" + wid
        slotByPid += "p" + pid + "=" + slot
    }

    sprites.setDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_RING_BY_PID_KEY, ringByPid)
    sprites.setDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_ID_BY_PID_KEY, idByPid)
    sprites.setDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_SLOT_BY_PID_KEY, slotByPid)
}


function shopHandleControls(nowMs: number): void {
    const now = nowMs | 0
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) return

    for (let hi = 0; hi < 4; hi++) {
        // Only if focused (grace window alive)
        if (!(now <= (shopFocusUntilMsByHero[hi] | 0))) continue

        const hero = heroes[hi]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) continue

        const offer = shopFocusOfferByHero[hi]
        if (!offer || (offer.flags & sprites.Flag.Destroyed)) continue

        const ctrl = shopPollControls(hi)

        // Reserved for future UI navigation
        // if (ctrl.Left_edge) ...
        // if (ctrl.Right_edge) ...

        const pid = (hi + 1) | 0

        const weaponId = sprites.readDataString(offer, SH_ITEM_WEAPON_ID) || ""
        const slot = sprites.readDataString(offer, SH_ITEM_RENDER_SLOT) || "thrust"
        const price = sprites.readDataNumber(offer, SH_ITEM_PRICE) | 0

        const boughtByPid = sprites.readDataNumber(offer, SH_ITEM_BOUGHT_BY_PID) | 0
        const isBought = (boughtByPid | 0) !== 0

        // A = buy
        if (ctrl.A_edge) {
            if (!weaponId) {
                console.log("[SHOP][BUY] hi=" + hi + " pid=" + pid + " DENY empty weaponId ring=" + (sprites.readDataNumber(offer, SH_ITEM_RING_INDEX) | 0))
            } else if (isBought) {
                console.log("[SHOP][BUY] hi=" + hi + " pid=" + pid + " DENY alreadyBought byPid=" + boughtByPid + " wid=" + weaponId)
            } else if ((teamCoins | 0) < (price | 0)) {
                console.log("[SHOP][BUY] hi=" + hi + " pid=" + pid + " DENY coins=" + (teamCoins | 0) + " price=" + price + " wid=" + weaponId)
            } else {
                const before = teamCoins | 0
                setTeamCoins((before - price) | 0)

                sprites.setDataNumber(offer, SH_ITEM_BOUGHT_BY_PID, pid)
                sprites.setDataBoolean(offer, SHOP_DATA.BOUGHT, true)

                // Equip: replace only the render slot for that hero
                if (slot === "thrust") sprites.setDataString(hero, HERO_DATA.WEAPON_THRUST_ID, weaponId)
                else if (slot === "slash") sprites.setDataString(hero, HERO_DATA.WEAPON_SLASH_ID, weaponId)
                else if (slot === "cast") sprites.setDataString(hero, HERO_DATA.WEAPON_CAST_ID, weaponId)

                console.log("[SHOP][BUY] hi=" + hi + " pid=" + pid + " ok coins " + before + "->" + (teamCoins | 0) +
                    " slot=" + slot + " wid=" + weaponId + " ring=" + (sprites.readDataNumber(offer, SH_ITEM_RING_INDEX) | 0))
            }
        }

        // B = return (undo)
        if (ctrl.B_edge) {
            if (!isBought) {
                console.log("[SHOP][RETURN] hi=" + hi + " pid=" + pid + " DENY notBought wid=" + weaponId)
            } else if ((boughtByPid | 0) !== (pid | 0)) {
                console.log("[SHOP][RETURN] hi=" + hi + " pid=" + pid + " DENY ownedBy otherPid=" + boughtByPid + " wid=" + weaponId)
            } else {
                const before = teamCoins | 0
                setTeamCoins((before + price) | 0)

                sprites.setDataNumber(offer, SH_ITEM_BOUGHT_BY_PID, 0)
                sprites.setDataBoolean(offer, SHOP_DATA.BOUGHT, false)

                // Unequip: clear only the render slot for that hero
                if (slot === "thrust") sprites.setDataString(hero, HERO_DATA.WEAPON_THRUST_ID, "")
                else if (slot === "slash") sprites.setDataString(hero, HERO_DATA.WEAPON_SLASH_ID, "")
                else if (slot === "cast") sprites.setDataString(hero, HERO_DATA.WEAPON_CAST_ID, "")

                console.log("[SHOP][RETURN] hi=" + hi + " pid=" + pid + " ok coins " + before + "->" + (teamCoins | 0) +
                    " slot=" + slot + " wid=" + weaponId + " ring=" + (sprites.readDataNumber(offer, SH_ITEM_RING_INDEX) | 0))
            }
        }
    }
}

function shopDebugDump(nowMs: number): void {
    const now = nowMs | 0
    if (now - (_shopLastDebugDumpMs | 0) < SHOP_DEBUG_DUMP_EVERY_MS) return
    _shopLastDebugDumpMs = now

    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) return

    const skId = (shopkeeperNpc.id | 0)
    const owner = (sprites.readDataNumber(shopkeeperNpc, HERO_DATA.OWNER) | 0)
    const heroName = sprites.readDataString(shopkeeperNpc, "heroName") || sprites.readDataString(shopkeeperNpc, HERO_DATA.NAME) || ""
    const ringIds = sprites.readDataString(shopkeeperNpc, SHOP_WPN_RING_IDS_KEY) || ""
    const rPx = sprites.readDataNumber(shopkeeperNpc, SHOP_WPN_RING_RADIUS_PX_KEY) | 0
    const aDeg = sprites.readDataNumber(shopkeeperNpc, SHOP_WPN_RING_ANGLE_DEG_KEY) | 0
    const defDir = sprites.readDataString(shopkeeperNpc, SHOP_WPN_DEFAULT_DIR_KEY) || ""
    const dirMap = sprites.readDataString(shopkeeperNpc, SHOP_WPN_DIR_MAP_KEY) || ""

    const touchedRingByPid = sprites.readDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_RING_BY_PID_KEY) || ""
    const touchedIdByPid = sprites.readDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_ID_BY_PID_KEY) || ""
    const touchedSlotByPid = sprites.readDataString(shopkeeperNpc, SHOP_WPN_TOUCHED_SLOT_BY_PID_KEY) || ""

    // Offer list snapshot (ringIndex:weaponId:slot:price:boughtByPid)
    let offers: Sprite[] = null as any
    try { offers = (SHOP_ITEMS as any) } catch (e) { offers = null }
    if (!offers) offers = sprites.allOfKind(SpriteKind.ShopItem)

    let offerDump = ""
    for (let i = 0; i < offers.length; i++) {
        const it = offers[i]
        if (!it) continue
        if (it.flags & sprites.Flag.Destroyed) continue

        const ri = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
        const wid = sprites.readDataString(it, SH_ITEM_WEAPON_ID) || ""
        const slot = sprites.readDataString(it, SH_ITEM_RENDER_SLOT) || ""
        const price = sprites.readDataNumber(it, SH_ITEM_PRICE) | 0
        const byPid = sprites.readDataNumber(it, SH_ITEM_BOUGHT_BY_PID) | 0

        if (offerDump !== "") offerDump += " ; "
        offerDump += ri + ":" + wid + ":" + slot + ":" + price + ":p" + byPid
    }

    console.log(
        "[SHOP][DUMP] t=" + now +
        " sk{id=" + skId + " owner=" + owner + " heroName=" + heroName + "}" +
        " ring{ids='" + ringIds + "' rPx=" + rPx + " aDeg=" + aDeg + " defDir=" + defDir + " dirMap='" + dirMap + "'}" +
        " touched{ring='" + touchedRingByPid + "' id='" + touchedIdByPid + "' slot='" + touchedSlotByPid + "'}" +
        " offers{n=" + offers.length + " " + offerDump + "}"
    )
}


function _shopSafeStr(s: string): string {
    return (s === null || s === undefined) ? "" : ("" + s)
}

function _shopSpriteId(s: Sprite): number {
    // Arcade sprite ids are usually stored on the object; if not, return -1
    return (s && (s as any).id !== undefined) ? ((s as any).id | 0) : -1
}

function _shopOfferSummary(it: Sprite): string {
    if (!it) return "null"
    if (it.flags & sprites.Flag.Destroyed) return "destroyed"

    const id = _shopSpriteId(it)
    const ringIndex = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
    const weaponId = _shopSafeStr(sprites.readDataString(it, SH_ITEM_WEAPON_ID))
    const slot = _shopSafeStr(sprites.readDataString(it, SH_ITEM_RENDER_SLOT))
    const price = sprites.readDataNumber(it, SH_ITEM_PRICE) | 0
    const ownedBy = sprites.readDataNumber(it, SH_ITEM_BOUGHT_BY_PID) | 0

    return "#" + id +
        " i=" + ringIndex +
        " wid=" + weaponId +
        " slot=" + slot +
        " $" + price +
        " ownedBy=" + ownedBy +
        " pos=(" + (it.x | 0) + "," + (it.y | 0) + ")"
}

function _shopBuildDebugSignature(nowMs: number): string {
    // Signature used to detect meaningful changes for spam-safe logs
    let sig = ""

    // Shopkeeper core + contract
    if (shopkeeperNpc && !(shopkeeperNpc.flags & sprites.Flag.Destroyed)) {
        sig += "sk@" + (shopkeeperNpc.x | 0) + "," + (shopkeeperNpc.y | 0)
        sig += "|ids=" + _shopSafeStr(sprites.readDataString(shopkeeperNpc, SHOP_WPN_RING_IDS_KEY))
        sig += "|r=" + (sprites.readDataNumber(shopkeeperNpc, SHOP_WPN_RING_RADIUS_PX_KEY) | 0)
        sig += "|a=" + (sprites.readDataNumber(shopkeeperNpc, SHOP_WPN_RING_ANGLE_DEG_KEY) | 0)
        sig += "|dd=" + _shopSafeStr(sprites.readDataString(shopkeeperNpc, SHOP_WPN_DEFAULT_DIR_KEY))
        sig += "|dm=" + _shopSafeStr(sprites.readDataString(shopkeeperNpc, SHOP_WPN_DIR_MAP_KEY))

        // Highlight contract
        sig += "|tm=" + (sprites.readDataNumber(shopkeeperNpc, SHOP_WPN_TOUCH_MASK_KEY) | 0)
        sig += "|tbh=" + _shopSafeStr(sprites.readDataString(shopkeeperNpc, SHOP_WPN_TOUCH_BY_HERO_KEY))
    } else {
        sig += "sk=none"
    }

    // Offers summary (weapon/slot/price/ownedBy)
    sig += "|offers="
    for (let i = 0; i < _shopRingOfferItems.length; i++) {
        const it = _shopRingOfferItems[i]
        if (!it || (it.flags & sprites.Flag.Destroyed)) { sig += "x"; continue }
        const weaponId = _shopSafeStr(sprites.readDataString(it, SH_ITEM_WEAPON_ID))
        const slot = _shopSafeStr(sprites.readDataString(it, SH_ITEM_RENDER_SLOT))
        const price = sprites.readDataNumber(it, SH_ITEM_PRICE) | 0
        const ownedBy = sprites.readDataNumber(it, SH_ITEM_BOUGHT_BY_PID) | 0
        sig += "[" + weaponId + ":" + slot + ":" + price + ":" + ownedBy + "]"
    }

    // Per-hero focus
    sig += "|focus="
    for (let hi = 0; hi < 4; hi++) {
        sig += "(" + (shopFocusRingIndexByHero[hi] | 0) + "," + (shopFocusUntilMsByHero[hi] | 0) + ")"
    }

    // Coins
    sig += "|coins=" + (teamCoins | 0)

    return sig
}





function _shopPrettySlot(slot: string): string {
    const s = (slot || "").toLowerCase()
    if (s === "slash") return "SLASH"
    if (s === "cast") return "CAST"
    return "THRUST"
}

function _shopOwnerLabel(ownedByPid: number, pid: number): string {
    const ob = ownedByPid | 0
    const p = pid | 0
    if (ob === 0) return "AVAILABLE"
    if (ob === p) return "YOURS"
    return "OWNED(P" + ob + ")"
}

function _shopGetFocusedOfferSummaryForHero(hi: number, nowMs: number): {
    offer: Sprite,
    ringIndex: number,
    weaponId: string,
    slot: string,
    price: number,
    ownedBy: number,
    active: boolean
} {
    const now = nowMs | 0
    const offer = _shopGetFocusedOfferForHero(hi, now)

    if (!offer) {
        return {
            offer: null,
            ringIndex: -1,
            weaponId: "",
            slot: "",
            price: 0,
            ownedBy: 0,
            active: false
        }
    }

    const ringIndex = sprites.readDataNumber(offer, SH_ITEM_RING_INDEX) | 0
    const weaponId = sprites.readDataString(offer, SH_ITEM_WEAPON_ID) || ""
    const slot = sprites.readDataString(offer, SH_ITEM_RENDER_SLOT) || "thrust"
    const price = sprites.readDataNumber(offer, SH_ITEM_PRICE) | 0
    const ownedBy = sprites.readDataNumber(offer, SH_ITEM_BOUGHT_BY_PID) | 0

    return {
        offer,
        ringIndex,
        weaponId,
        slot,
        price,
        ownedBy,
        active: true
    }
}

function _shopBuildDialogLine(hi: number, pid: number, s: {
    ringIndex: number,
    weaponId: string,
    slot: string,
    price: number,
    ownedBy: number,
    active: boolean
}): string {
    if (!s.active) return ""

    const slotPretty = _shopPrettySlot(s.slot)
    const ownerStr = _shopOwnerLabel(s.ownedBy, pid)

    // Example: "DAGGER  [THRUST]  $6  AVAILABLE"
    return (s.weaponId || "???").toUpperCase() + "  [" + slotPretty + "]  $" + (s.price | 0) + "  " + ownerStr
}

function _shopBuildControlsLine(pid: number, s: {
    price: number,
    ownedBy: number,
    active: boolean
}): string {
    if (!s.active) return ""

    const owner = s.ownedBy | 0
    const p = pid | 0

    if (owner === 0) {
        // Can buy (maybe insufficient coins, but we keep prompt; Step 7 logs deny)
        return "A: buy  B: (none)    Coins: " + (teamCoins | 0)
    }

    if (owner === p) {
        return "A: (owned)  B: return    Coins: " + (teamCoins | 0)
    }

    return "A: (blocked)  B: (none)    Coins: " + (teamCoins | 0)
}

function _shopBuildStatsLine(hi: number, s: {
    weaponId: string,
    slot: string,
    active: boolean
}): string {
    if (!s.active) return ""

    // Placeholder “preview” (replace later with real stat calc)
    // Keep it short: one line.
    const slotPretty = _shopPrettySlot(s.slot)
    return "Slot=" + slotPretty + "   (preview stats TBD)"
}



function _shopGetFocusedOfferForHero(hi: number, nowMs: number): Sprite {
    if (hi < 0 || hi > 3) return null

    // Focus must be currently alive (freshness)
    const until = shopFocusUntilMsByHero[hi] | 0
    if (!(until > 0 && (nowMs | 0) < until)) return null

    const idx = shopFocusRingIndexByHero[hi] | 0
    if (idx < 0) return null

    // Prefer ring list
    if (idx < _shopRingOfferItems.length) {
        const it = _shopRingOfferItems[idx]
        if (it && !(it.flags & sprites.Flag.Destroyed)) return it
    }

    // Fallback: scan SHOP_ITEMS by ringIndex
    _shopCullDestroyed(SHOP_ITEMS)
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
        const it = SHOP_ITEMS[i]
        if (!it) continue
        if (it.flags & sprites.Flag.Destroyed) continue
        const ri = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
        if (ri === idx) return it
    }

    return null
}

function _shopEquipWeaponToHeroSlot(hero: Sprite, renderSlot: string, weaponId: string): void {
    if (!hero) return
    const slot = (renderSlot || "").toLowerCase()

    if (slot === "slash") {
        sprites.setDataString(hero, HERO_DATA.WEAPON_SLASH_ID, weaponId || "")
    } else if (slot === "cast") {
        sprites.setDataString(hero, HERO_DATA.WEAPON_CAST_ID, weaponId || "")
    } else {
        // default -> thrust
        sprites.setDataString(hero, HERO_DATA.WEAPON_THRUST_ID, weaponId || "")
    }
}

function _shopClearWeaponFromHeroSlotIfMatches(hero: Sprite, renderSlot: string, weaponId: string): void {
    if (!hero) return
    const slot = (renderSlot || "").toLowerCase()
    const wid = weaponId || ""

    if (slot === "slash") {
        const cur = sprites.readDataString(hero, HERO_DATA.WEAPON_SLASH_ID) || ""
        if (cur === wid) sprites.setDataString(hero, HERO_DATA.WEAPON_SLASH_ID, "")
    } else if (slot === "cast") {
        const cur = sprites.readDataString(hero, HERO_DATA.WEAPON_CAST_ID) || ""
        if (cur === wid) sprites.setDataString(hero, HERO_DATA.WEAPON_CAST_ID, "")
    } else {
        const cur = sprites.readDataString(hero, HERO_DATA.WEAPON_THRUST_ID) || ""
        if (cur === wid) sprites.setDataString(hero, HERO_DATA.WEAPON_THRUST_ID, "")
    }
}

function _shopSetUiBoughtFlagFromOffer(hi: number, pid: number, offer: Sprite): void {
    if (hi < 0 || hi > 3) return
    if (!offer) { shopBoughtByHero[hi] = false; return }
    const boughtBy = sprites.readDataNumber(offer, SH_ITEM_BOUGHT_BY_PID) | 0
    shopBoughtByHero[hi] = (boughtBy === (pid | 0))
}



function _shopApplyFocusGateToShopUi(nowMs: number): void {
    const now = nowMs | 0
    for (let hi = 0; hi < 4; hi++) {
        const until = shopFocusUntilMsByHero[hi] | 0
        const active = (until > 0) && (now < until)

        if (active) {
            // Keep the existing shop UI/input gate alive while an offer is focused
            shopTouchUntilMsByHero[hi] = now + SHOP_TOUCH_GRACE_MS
        } else {
            // Let it decay naturally (do not force to 0; preserves your grace semantics)
            // (No-op here)
        }
    }
}



function _shopIsAliveSprite(s: Sprite): boolean {
    return !!s && ((s.flags & sprites.Flag.Destroyed) === 0)
}

function _shopComputeFocusedRingIndexForHero(hero: Sprite): number {
    if (!hero) return -1

    // Prefer the dedicated ring offer list (Step 1–4)
    for (let i = 0; i < _shopRingOfferItems.length; i++) {
        const it = _shopRingOfferItems[i]
        if (!_shopIsAliveSprite(it)) continue
        if (_shopIsOverlapping(hero, it)) {
            const idx = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
            return (idx >= 0) ? idx : i
        }
    }

    // Fallback: scan SHOP_ITEMS if ring list isn't populated
    // (This keeps the seam usable even if someone later spawns items outside the ring builder.)
    _shopCullDestroyed(SHOP_ITEMS)
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
        const it = SHOP_ITEMS[i]
        if (!_shopIsAliveSprite(it)) continue
        if (_shopIsOverlapping(hero, it)) {
            const idx = sprites.readDataNumber(it, SH_ITEM_RING_INDEX) | 0
            return (idx >= 0) ? idx : -1
        }
    }

    return -1
}

function _shopPublishTouchStateOnShopkeeper(nowMs: number): void {
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) return

    // Determine "active touch" (within keepalive)
    let mask = 0
    const parts: string[] = []

    for (let hi = 0; hi < 4; hi++) {
        const until = shopFocusUntilMsByHero[hi] | 0
        const active = (until > 0) && ((nowMs | 0) < until)

        const idx = active ? (shopFocusRingIndexByHero[hi] | 0) : -1
        parts.push("" + idx)

        if (active && idx >= 0 && idx < 31) {
            mask |= (1 << idx)
        }
    }

    const touchByHeroStr = parts.join("|")

    // Publish to shopkeeper for Phaser ghost-ring renderer
    sprites.setDataNumber(shopkeeperNpc, SHOP_WPN_TOUCH_MASK_KEY, mask | 0)
    sprites.setDataString(shopkeeperNpc, SHOP_WPN_TOUCH_BY_HERO_KEY, touchByHeroStr)

    // Debug only on change
    if (mask !== _shopPrevTouchMask || touchByHeroStr !== _shopPrevTouchByHero) {
        _shopPrevTouchMask = mask
        _shopPrevTouchByHero = touchByHeroStr
        console.log("[SHOP][FOCUS] mask=" + mask + " byHero=" + touchByHeroStr)
    }
}


// Main “shop controls layer” tick (Step 5)
// - Today: focus comes from overlap
// - Future: focus can come from a menu selection (arrows) without touching publish/purchase code
function shopControlTick(nowMs: number): void {
    const now = nowMs | 0


//    let shopFocusRingIndexByHero: number[] = [-1, -1, -1, -1]
//    let shopFocusUntilMsByHero: number[] = [0, 0, 0, 0]
//    let shopTouchUntilMsByHero: number[] = [0, 0, 0, 0]
//    let shopBoughtByHero: boolean[] = [false, false, false, false]
 //   let shopFocusOfferByHero: Sprite[] = [null, null, null, null]


    // If shopkeeper not alive, clear state
    if (!_shopIsAliveSprite(shopkeeperNpc)) {
        for (let hi = 0; hi < 4; hi++) {
            shopFocusRingIndexByHero[hi] = -1
            shopFocusUntilMsByHero[hi] = 0
        }
        return
    }

    // Ensure ring offers exist (safe keep-in-sync)
    _shopEnsureWeaponRingOffersForShopkeeper(shopkeeperNpc)

    // Compute focus per hero (overlap-based for now)
    for (let hi = 0; hi < 4; hi++) {
        const hero = heroes[hi]
        if (!_shopIsAliveSprite(hero)) {
            shopFocusRingIndexByHero[hi] = -1
            shopFocusUntilMsByHero[hi] = 0
            continue
        }

        const idx = _shopComputeFocusedRingIndexForHero(hero)

        if (idx >= 0) {
            shopFocusRingIndexByHero[hi] = idx
            shopFocusUntilMsByHero[hi] = (now + SHOP_FOCUS_KEEPALIVE_MS) | 0
        } else {
            // Persist briefly; then drop
            const until = shopFocusUntilMsByHero[hi] | 0
            if (!(until > 0 && now < until)) {
                shopFocusRingIndexByHero[hi] = -1
                shopFocusUntilMsByHero[hi] = 0
            }
        }
    }

    // Publish highlight/touch state onto shopkeeper
    _shopPublishTouchStateOnShopkeeper(now)

    // Step 9: comprehensive dump (spam-safe; prints on change or throttled)
    shopDebugDump(now)
}



// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function _shopSplitPipeList(s: string): string[] {
    const raw = (s || "").trim()
    if (!raw) return []
    // Keep empty segments out
    const parts = raw.split("|")
    const out: string[] = []
    for (let i = 0; i < parts.length; i++) {
        const p = (parts[i] || "").trim()
        if (p) out.push(p)
    }
    return out
}

function _shopDegToRad(deg: number): number {
    return (deg * Math.PI) / 180
}

function _shopDestroyOfferItems(): void {
    for (let i = 0; i < _shopRingOfferItems.length; i++) {
        const s = _shopRingOfferItems[i]
        if (s && !(s.flags & sprites.Flag.Destroyed)) s.destroy()
    }
    _shopRingOfferItems = []
}

function _shopPublishWeaponRingContractOnShopkeeper(sk: Sprite): void {
    if (!sk) return

    // IDs + geometry + direction controls
    sprites.setDataString(sk, SHOP_WPN_RING_IDS_KEY, SHOP_DEFAULT_RING_WEAPON_IDS)
    sprites.setDataNumber(sk, SHOP_WPN_RING_RADIUS_PX_KEY, SHOP_DEFAULT_RING_RADIUS_PX)
    sprites.setDataNumber(sk, SHOP_WPN_RING_ANGLE_DEG_KEY, SHOP_DEFAULT_RING_ANGLE_DEG)
    sprites.setDataString(sk, SHOP_WPN_DEFAULT_DIR_KEY, SHOP_DEFAULT_RING_DIR)
    sprites.setDataString(sk, SHOP_WPN_DIR_MAP_KEY, SHOP_DEFAULT_RING_DIR_MAP)

    // Slots + source phases (alignment/visibility)
    sprites.setDataString(sk, SHOP_WPN_RING_SLOTS_KEY, SHOP_DEFAULT_RING_SLOTS)
    sprites.setDataString(sk, SHOP_WPN_RING_SOURCE_PHASES_KEY, SHOP_DEFAULT_RING_SOURCE_PHASES)

    // Highlight state
    sprites.setDataNumber(sk, SHOP_WPN_TOUCH_MASK_KEY, 0)
    sprites.setDataString(sk, SHOP_WPN_TOUCH_BY_HERO_KEY, "-1|-1|-1|-1")
}

function _shopGameplayKindForRingIndex(i: number): string {
    // Aligned with SHOP_DEFAULT_RING_WEAPON_IDS order:
    // diamond (intellect staff), glowsword (strength), spear (agility), simple (support)
    if (i === 0) return "intellect"
    if (i === 1) return "strength"
    if (i === 2) return "agility"
    if (i === 3) return "support"
    return "unknown"
}

function _shopPriceForRingIndex(i: number): number {
    // Placeholder pricing – adjust later
    if (i === 0) return 10
    if (i === 1) return 10
    if (i === 2) return 10
    if (i === 3) return 10
    return 10
}

function _shopEnsureWeaponRingOffersForShopkeeper(sk: Sprite): void {
    if (!sk) return

    const ids = _shopSplitPipeList(sprites.readDataString(sk, SHOP_WPN_RING_IDS_KEY) || SHOP_DEFAULT_RING_WEAPON_IDS)
    const slots = _shopSplitPipeList(sprites.readDataString(sk, SHOP_WPN_RING_SLOTS_KEY) || SHOP_DEFAULT_RING_SLOTS)

    const n = ids.length
    if (n <= 0) {
        _shopDestroyOfferItems()
        return
    }

    // Rebuild if wrong count or any destroyed
    let rebuild = false
    if (_shopRingOfferItems.length !== n) rebuild = true
    else {
        for (let i = 0; i < _shopRingOfferItems.length; i++) {
            const s = _shopRingOfferItems[i]
            if (!s || (s.flags & sprites.Flag.Destroyed)) { rebuild = true; break }
        }
    }
    if (rebuild) _shopDestroyOfferItems()

    const radius = sprites.readDataNumber(sk, SHOP_WPN_RING_RADIUS_PX_KEY) | 0
    const baseDeg = sprites.readDataNumber(sk, SHOP_WPN_RING_ANGLE_DEG_KEY) | 0

    // Create missing items (or all, if rebuilt)
    for (let i = 0; i < n; i++) {
        const weaponId = ids[i]
        const renderSlot = (i < slots.length) ? slots[i] : "thrust"

        const thetaDeg = baseDeg + ((360 * i) / n)
        const theta = _shopDegToRad(thetaDeg)
        const ox = (Math.round(radius * Math.cos(theta)) | 0)
        const oy = (Math.round(radius * Math.sin(theta)) | 0)

        const x = (sk.x + ox) | 0
        const y = (sk.y + oy) | 0

        let it: Sprite = null
        if (!rebuild && i < _shopRingOfferItems.length) it = _shopRingOfferItems[i]

        if (!it) {
            // Spawn as an *invisible* hitbox (Arcade overlap still works; Phaser won't render it anyway)
            it = spawnShopItem(x, y, weaponId) // label is weaponId for now
            it.setFlag(SpriteFlag.Invisible, true)
            it.setFlag(SpriteFlag.Ghost, true)
            it.z = sk.z + 5
            _shopRingOfferItems[i] = it
        } else {
            it.setPosition(x, y)
        }

        // Stamp contract-required metadata
        sprites.setDataNumber(it, SH_ITEM_RING_INDEX, i | 0)
        sprites.setDataString(it, SH_ITEM_WEAPON_ID, weaponId)
        sprites.setDataString(it, SH_ITEM_LABEL, weaponId)
        sprites.setDataString(it, SH_ITEM_RENDER_SLOT, renderSlot)
        sprites.setDataString(it, SH_ITEM_GAMEPLAY_KIND, _shopGameplayKindForRingIndex(i))
        sprites.setDataNumber(it, SH_ITEM_PRICE, _shopPriceForRingIndex(i))
        if ((sprites.readDataNumber(it, SH_ITEM_BOUGHT_BY_PID) | 0) === 0) {
            sprites.setDataNumber(it, SH_ITEM_BOUGHT_BY_PID, 0)
        }
    }
}



function ensureTeamCoinsHud(): Sprite {
    if (teamCoinsHud && !(teamCoinsHud.flags & sprites.Flag.Destroyed)) return teamCoinsHud

    const t = textsprite.create("Coins: 0", 0, COIN_HUD_FG)
    t.setMaxFontHeight(7)
    t.setOutline(1, 15)

    // Stick to screen
    t.setFlag(SpriteFlag.RelativeToCamera, true)
    t.setPosition(42, 8)
    t.z = 10000

    // Tag for Phaser-side UI identification (optional but nice)
    sprites.setDataString(t, UI_KIND_KEY, UI_KIND_TEAM_COINS)

    teamCoinsHud = t
    return t
}


function _shopEnsureMenu(): TextSprite {
    if (_shopMenu) return _shopMenu
    const t = textsprite.create("", 0, 1)
    t.setMaxFontHeight(8)
    t.setBorder(1, 15, 2)
    t.setOutline(1, 15)
    t.z = 10_000
    t.setFlag(SpriteFlag.Invisible, true)
    _shopMenu = t
    return t
}

function _shopIsOverlapping(a: Sprite, b: Sprite): boolean {
    if (!a || !b) return false
    const ax0 = (a.x - (a.width >> 1)) | 0
    const ay0 = (a.y - (a.height >> 1)) | 0
    const ax1 = (a.x + (a.width >> 1)) | 0
    const ay1 = (a.y + (a.height >> 1)) | 0

    const bx0 = (b.x - (b.width >> 1)) | 0
    const by0 = (b.y - (b.height >> 1)) | 0
    const bx1 = (b.x + (b.width >> 1)) | 0
    const by1 = (b.y + (b.height >> 1)) | 0

    return (ax0 < bx1) && (ax1 > bx0) && (ay0 < by1) && (ay1 > by0)
}


function _shopIsOverlappingOLD(a: Sprite, b: Sprite): boolean {
    // simple AABB overlap (works in both Arcade and Phaser)
    const dx = Math.abs((a.x | 0) - (b.x | 0))
    const dy = Math.abs((a.y | 0) - (b.y | 0))
    const ax = ((a.width | 0) + (b.width | 0)) >> 1
    const ay = ((a.height | 0) + (b.height | 0)) >> 1
    return dx <= ax && dy <= ay
}

function _shopFindTargetForHero(hero: Sprite): Sprite {
    if (!hero) return null

    _shopCullDestroyed(SHOP_NPCS)
    _shopCullDestroyed(SHOP_ITEMS)

    // Priority: NPC first, then item (change if you want)
    for (let i = 0; i < SHOP_NPCS.length; i++) {
        const npc = SHOP_NPCS[i]
        if (!npc) continue
        if (_shopIsOverlapping(hero, npc)) return npc
    }

    for (let i = 0; i < SHOP_ITEMS.length; i++) {
        const it = SHOP_ITEMS[i]
        if (!it) continue
        if (_shopIsOverlapping(hero, it)) return it
    }

    return null
}

function _shopSetHighlight(target: Sprite, on: boolean): void {
    if (!target) return
    // Simple “touch does something”: toggle a visible outline color
    // (works for placeholder box sprites)
    if (on) target.image.drawRect(0, 0, target.image.width, target.image.height, 2)
    else {
        // re-draw border in normal color (1) without clearing the whole sprite
        target.image.drawRect(0, 0, target.image.width, target.image.height, 1)
    }
}


function setTeamCoins(newVal: number): void {
    teamCoins = Math.max(0, newVal | 0)
    const hud = ensureTeamCoinsHud()
    ;(hud as any).setText("Coins: " + teamCoins)
}

function showCoinPop(x: number, y: number, delta: number): void {
    const t = textsprite.create("+" + (delta | 0), 0, COIN_HUD_FG)
    t.setMaxFontHeight(8)
    t.setOutline(1, 15)
    t.setPosition(x, y)
    t.lifespan = 900
    t.vy = -12
}

function addTeamCoins(delta: number, popX: number, popY: number): void {
    const d = delta | 0
    if (d <= 0) return
    setTeamCoins(teamCoins + d)
    showCoinPop(popX, popY, d)
}



// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// SHOP PHASE POC (touch → reaction) + (spawn NPC box) + (overlap-gated menu) + (B toggles bought)
// Paste this as a new section near your other SpriteKind/constants (before the handlers is fine).

// --------------------------------------------------------------
// SHOP POC DATA KEYS
// --------------------------------------------------------------
const SHOP_DATA = {
    NAME: "shopName",           // string: npc name / item name
    PROMPT: "shopPrompt",       // number: 1 if hero is in range (for UI)
    PURCHASED: "shopBought",    // number: 0/1
    NEAR_KIND: "shopNearKind",  // number: 0 none, 1 npc, 2 item
    BOUGHT: "shopBought",
    NPC_NAME: "shopNpcName",
    ITEM_NAME: "shopItemName",
    IS_SHOP_NPC: "shopNpc",
    IS_SHOP_ITEM: "shopItem",
    LABEL: "shopLabel",
};


let _shopPrevB1 = false
let _shopMenu: TextSprite = null
let _shopLastTarget: Sprite = null


// POC handles
let shopNpc0: Sprite = null
let shopItem0: Sprite = null
let shopPromptText: TextSprite = null



const SHOP_DATA_ITEM_ID = "shItemId"          // number
const SHOP_DATA_ITEM_BOUGHT = "shBought"      // number 0/1


// Shop weapon ring: sprite.data keys (consumed by arcadeCompat.ts)
const SHOP_WPN_RING_IDS_KEY = "shopWpnRingIds"            // string list: "idA|idB|idC"
const SHOP_WPN_RING_RADIUS_PX_KEY = "shopWpnRingRadiusPx" // number (pixels)
const SHOP_WPN_RING_ANGLE_DEG_KEY = "shopWpnRingAngleDeg" // number (degrees)
const SHOP_WPN_DEFAULT_DIR_KEY = "shopWpnDefaultDir"      // string: "R","L","U","D"
const SHOP_WPN_DIR_MAP_KEY = "shopWpnDirMap"              // string map: "idA:R,idB:U"

const SHOP_DEFAULT_RING_RADIUS_PX = 100 //22 
const SHOP_DEFAULT_RING_ANGLE_DEG = 0
const SHOP_DEFAULT_RING_DIR = "R"
const SHOP_DEFAULT_RING_DIR_MAP = ""

// ------------------------------------------------------------
// SHOP WEAPON RING – contract keys (shopkeeper sprite.data)
// ------------------------------------------------------------
const SHOP_WPN_RING_SLOTS_KEY = "shopWpnRingSlots"                       // "thrust|slash|thrust|cast"
const SHOP_WPN_RING_SOURCE_PHASES_KEY = "shopWpnRingSourcePhases"        // "thrust|slash|thrust|cast"
const SHOP_WPN_TOUCH_MASK_KEY = "shopWpnTouchMask"                       // number bitmask
const SHOP_WPN_TOUCH_BY_HERO_KEY = "shopWpnTouchByHero"                  // "-1|-1|-1|-1"

// Per-offer item sprite.data keys (ShopItem hitboxes)
const SH_ITEM_RING_INDEX = "shRingIndex"           // number
const SH_ITEM_WEAPON_ID = "shWeaponId"             // string (atlas model id)
const SH_ITEM_LABEL = "shLabel"                    // string
const SH_ITEM_RENDER_SLOT = "shRenderSlot"         // string: "thrust"|"slash"|"cast"
const SH_ITEM_GAMEPLAY_KIND = "shGameplayKind"     // string: "intellect"|"strength"|"agility"|"support"
const SH_ITEM_PRICE = "shPrice"                    // number
const SH_ITEM_BOUGHT_BY_PID = "shBoughtByPid"      // number (0=unbought)

// ------------------------------------------------------------
// SHOP WEAPON RING – canonical defaults (must match atlas model ids)
// ------------------------------------------------------------
const SHOP_DEFAULT_RING_WEAPON_IDS = "diamond|glowsword|spear|simple"
const SHOP_DEFAULT_RING_SLOTS = "thrust|slash|thrust|cast"
const SHOP_DEFAULT_RING_SOURCE_PHASES = "thrust|slash|thrust|cast"






function _mkShopNpcBox(): Image {
    const img = image.create(16, 16)
    img.fill(0)
    img.drawRect(0, 0, 16, 16, 7)
    img.drawRect(2, 2, 12, 12, 10)
    img.setPixel(5, 6, 1); img.setPixel(10, 6, 1) // eyes
    img.drawLine(6, 11, 9, 11, 2) // mouth
    return img
}

function _mkShopItemBox(): Image {
    const img = image.create(12, 12)
    img.fill(0)
    img.drawRect(0, 0, 12, 12, 7)
    img.fillRect(3, 3, 6, 6, 9)
    return img
}


// Per-hero interaction state (POC: overlap “freshness” time window)
let heroShopTouchUntilMs: number[] = []
let heroShopTargetNpc: Sprite[] = []
let heroShopMenu: TextSprite[] = []
let heroShopSpawnedItem: Sprite[] = []        // per hero POC “inventory box sprite”

const SHOP_TOUCH_KEEPALIVE_MS = 120

function _shopEnsureMenuForHero(heroIndex: number): TextSprite {
    let t = heroShopMenu[heroIndex]
    if (t) return t

    // bg=0, fg=1 (blue) – adjust later
    t = textsprite.create("", 0, 1)
    t.setMaxFontHeight(8)
    t.setBorder(1, 15, 2)
    t.setOutline(1, 15)
    t.setFlag(SpriteFlag.Invisible, true)

    heroShopMenu[heroIndex] = t
    return t
}

function _shopMenuTextForNpc(npc: Sprite): string {
    const bought = (sprites.readDataNumber(npc, SHOP_DATA_ITEM_BOUGHT) | 0) ? true : false
    return bought ? "item bought" : "item not bought"
}

function _shopMakeBoxImage(w: number, h: number, borderCol: number, fillCol: number): Image {
    const img = image.create(w, h)
    img.fill(fillCol)
    img.drawRect(0, 0, w, h, borderCol)
    // tiny “face” dot so it reads as something (optional)
    img.setPixel((w >> 1) - 1, (h >> 1), borderCol)
    img.setPixel((w >> 1) + 1, (h >> 1), borderCol)
    return img
}

function _shopMakeDitherBg(w: number, h: number, col: number): Image {
    const img = image.create(w, h)
    // checkerboard “alpha”: color col on alternating pixels, transparent elsewhere
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (((x + y) & 1) === 0) img.setPixel(x, y, col)
        }
    }
    img.drawRect(0, 0, w, h, 15)
    return img
}

function _shopEnsureUiForHero(hi: number): void {
    if (hi < 0 || hi > 3) return

    if (!shopUiBgByHero[hi]) {
        const bg = sprites.create(_shopMakeDitherBg(150, 42, 1), SpriteKind.ShopUI)
        bg.setFlag(SpriteFlag.Ghost, true)
        bg.setFlag(SpriteFlag.RelativeToCamera, true)
        bg.z = 1000
        shopUiBgByHero[hi] = bg
    }

    if (!shopUiTextByHero[hi]) {
        const t = textsprite.create("", 15, 0)
        t.setMaxFontHeight(12)              // BIGGER
        t.setOutline(1, 1)
        t.setFlag(SpriteFlag.RelativeToCamera, true)
        t.z = 1001
        shopUiTextByHero[hi] = t
    }

    if (!shopUiStatsByHero[hi]) {
        const s = textsprite.create("", 15, 0)
        s.setMaxFontHeight(10)
        s.setOutline(1, 1)
        s.setFlag(SpriteFlag.RelativeToCamera, true)
        s.z = 1001
        shopUiStatsByHero[hi] = s
    }
}

function _shopDestroyUiForHero(hi: number): void {
    if (hi < 0 || hi > 3) return

    // Hard guards: if the arrays don't exist for some reason, do nothing.
    if (typeof shopUiBgByHero === "undefined") return
    if (typeof shopUiTextByHero === "undefined") return
    if (typeof shopUiStatsByHero === "undefined") return

    const bg = shopUiBgByHero[hi]
    const t = shopUiTextByHero[hi]
    const s = shopUiStatsByHero[hi]

    if (bg) { bg.destroy(); shopUiBgByHero[hi] = null }
    if (t) { t.destroy(); shopUiTextByHero[hi] = null }
    if (s) { s.destroy(); shopUiStatsByHero[hi] = null }
}

function _shopStatsPreviewText(hi: number): string {
    // For now: show “+0” baseline, then “+1” after purchase
    const bought = shopBoughtByHero[hi]
    const dmg = bought ? "+1" : "+0"
    const reach = bought ? "+0" : "+0"
    const time = bought ? "+0" : "+0"
    const status = bought ? "+0" : "+0"
    return "DMG " + dmg + "  REACH " + reach + "  TIME " + time + "  STATUS " + status
}



function _shopUpdateUiForHero(hi: number, now: number): void {
    const bg = shopUiBgByHero[hi]
    const t = shopUiTextByHero[hi]
    const s = shopUiStatsByHero[hi]
    if (!bg || !t || !s) return

    // Bottom-left placement (unchanged)
    const margin = 6
    const W = userconfig.ARCADE_SCREEN_WIDTH
    const H = userconfig.ARCADE_SCREEN_HEIGHT

    bg.left = margin
    bg.bottom = H - margin

    t.left = margin + 6
    t.bottom = H - margin - 22

    s.left = margin + 6
    s.bottom = H - margin - 8

    // Focus-driven content
    const pid = (hi + 1) | 0
    const summary = _shopGetFocusedOfferSummaryForHero(hi, now | 0)

    if (!summary.active) {
        // If shop is gated on but no focused item, show minimal prompt
        t.setText("Shop: (no item)")
        s.setText("Walk onto a weapon.  Coins: " + (teamCoins | 0))
        return
    }

    // Ensure your old boolean matches the focused offer ownership
    shopBoughtByHero[hi] = (summary.ownedBy === pid)

    const dialog = _shopBuildDialogLine(hi, pid, summary)
    const controls = _shopBuildControlsLine(pid, summary)
    const stats = _shopBuildStatsLine(hi, summary)

    // Two-line UI:
    // - main line: item/slot/price/owner
    // - stats line: controls + optional preview
    t.setText(dialog)
    s.setText(controls + "    " + stats)
}



function shopModeUpdate(nowMs: number): void {
//    _shopEnsurePerHeroStateArrays()

    const now = nowMs | 0

    // If the shop isn’t enabled, do nothing.
    // (If you want it always running, remove this guard.)
    // if (!SHOP_MODE_ACTIVE) return

    // Step 5: compute focus + publish highlight state to shopkeeper
    shopControlTick(now)

    // Step 6: item-focus gate drives shop UI/input gate
    _shopApplyFocusGateToShopUi(now)

    // Existing UI behavior (now depends on focus-driven shopTouchUntilMsByHero)
    for (let hi = 0; hi < 4; hi++) {
        if (now <= (shopTouchUntilMsByHero[hi] | 0)) {
            _shopEnsureUiForHero(hi)
            _shopUpdateUiForHero(hi, now)
        } else {
            _shopDestroyUiForHero(hi)
        }
    }

    // Step 7–8: purchase/return controls
    shopHandleControls(now)

    // Step 9: debug dump / visibility
    shopDebugDump(now)
}



function spawnShopNpcBox(x: number, y: number, itemId: number): Sprite {
    // 12x16 “placeholder NPC” box
    const npc = sprites.create(_shopMakeBoxImage(12, 16, 1, 13), SpriteKind.ShopNpc)
    npc.setFlag(SpriteFlag.Ghost, true)   // don’t block movement (POC)
    npc.x = x
    npc.y = y
    npc.z = 2000                         // sit above ground clutter

    sprites.setDataNumber(npc, SHOP_DATA_ITEM_ID, itemId | 0)
    sprites.setDataNumber(npc, SHOP_DATA_ITEM_BOUGHT, 0)

    return npc
}

function _shopEnsureItemForHero(heroIndex: number): Sprite {
    let it = heroShopSpawnedItem[heroIndex]
    if (it && !(it.flags & sprites.Flag.Destroyed)) return it

    // 10x10 “inventory/weapon placeholder box”
    it = sprites.create(_shopMakeBoxImage(10, 10, 2, 0), SpriteKind.ShopItem)
    it.setFlag(SpriteFlag.Ghost, true)
    it.setFlag(SpriteFlag.Invisible, true)
    it.z = 5000

    heroShopSpawnedItem[heroIndex] = it
    return it
}

function _shopSetItemVisibleForHero(heroIndex: number, hero: Sprite, show: boolean): void {
    const it = _shopEnsureItemForHero(heroIndex)
    it.setFlag(SpriteFlag.Invisible, !show)
    if (!show) return

    // POC “inventory position”: floats near hero
    it.x = hero.x + 18
    it.y = hero.y - 18
}

// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 1) Touching something makes something happen
//    Overlap keeps “shop target” alive for a short window; menu is gated by that window.
sprites.onOverlap(SpriteKind.Player, SpriteKind.ShopNpc, function (hero, npc) {
    const heroIndex = getHeroIndex(hero)
    if (heroIndex < 0) return

    const now = game.runtime() | 0
    heroShopTargetNpc[heroIndex] = npc
    heroShopTouchUntilMs[heroIndex] = (now + SHOP_TOUCH_KEEPALIVE_MS) | 0

    // “Something happens” (POC): tiny effect + debug line
    npc.startEffect(effects.spray, 40)
    // If you hate spam, delete this log once confirmed
    console.log("[SHOP] overlap hero=" + heroIndex + " itemId=" + (sprites.readDataNumber(npc, SHOP_DATA_ITEM_ID) | 0))

    // Update menu text immediately
    const m = _shopEnsureMenuForHero(heroIndex)
    m.setText(_shopMenuTextForNpc(npc))
    m.setFlag(SpriteFlag.Invisible, false)
})

// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 2) Overlap-gated menu visibility + positioning (runs every frame)
function updateShopUi(now: number): void {
    const nowMs = now | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        const until = heroShopTouchUntilMs[hi] | 0
        const npc = heroShopTargetNpc[hi]

        const aliveNpc = npc && !(npc.flags & sprites.Flag.Destroyed)
        const active = aliveNpc && (until > 0) && (nowMs < until)

        const m = _shopEnsureMenuForHero(hi)

        if (!active) {
            m.setFlag(SpriteFlag.Invisible, true)
            // keep target but it’ll be overwritten on next overlap; you can also clear it:
            // heroShopTargetNpc[hi] = null
            continue
        }

        // Menu position near hero
        m.z = hero.z + 50
        m.x = hero.x
        m.y = hero.y - (hero.height >> 1) - 18

        // Refresh text (cheap + keeps it consistent)
        m.setText(_shopMenuTextForNpc(npc))
        m.setFlag(SpriteFlag.Invisible, false)

        // If item is bought, keep showing placeholder “inventory” box
        const bought = (sprites.readDataNumber(npc, SHOP_DATA_ITEM_BOUGHT) | 0) ? true : false
        _shopSetItemVisibleForHero(hi, hero, bought)
    }
}
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 3) B button toggles bought/not-bought while overlapping the shop NPC
function _shopToggleForPlayer(playerId: number): void {
    const pid = playerId | 0
    if (pid < 1 || pid > 4) return

    const hi = (playerToHeroIndex && (playerToHeroIndex[pid] | 0) >= 0) ? (playerToHeroIndex[pid] | 0) : -1
    if (hi < 0 || hi >= heroes.length) return

    const hero = heroes[hi]
    if (!hero || (hero.flags & sprites.Flag.Destroyed)) return

    const now = game.runtime() | 0
    const until = heroShopTouchUntilMs[hi] | 0
    const npc = heroShopTargetNpc[hi]

    if (!npc || (npc.flags & sprites.Flag.Destroyed)) return
    if (!(until > 0 && now < until)) return   // not “currently overlapping” (freshness gate)

    const bought0 = sprites.readDataNumber(npc, SHOP_DATA_ITEM_BOUGHT) | 0
    const bought1 = bought0 ? 0 : 1
    sprites.setDataNumber(npc, SHOP_DATA_ITEM_BOUGHT, bought1)

    console.log("[SHOP] TOGGLE pid=" + pid + " hero=" + hi + " bought=" + bought1)

    // Menu updates instantly
    const m = _shopEnsureMenuForHero(hi)
    m.setText(_shopMenuTextForNpc(npc))
    m.setFlag(SpriteFlag.Invisible, false)

    // Spawn/show placeholder item box if bought
    _shopSetItemVisibleForHero(hi, hero, bought1 ? true : false)
}

function installShopInputHandlers(): void {
    // Phaser runtime does not define ControllerButtonEvent,
    // and this POC uses polling edge-detect instead.
    // (Shop input is handled in shopHandleInputs() called from the loop.)
}



// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥




// Convenience: “shop upgrade” entry (label is stable; value is the current total shop bonus)
function shopSetDamageBonus(heroIndex: number, family: number, value: number): void {
    const b = _damageBucketForFamily(family)
    if (!b) return
    heroModSet(heroIndex, b, "shop.damage", value | 0)
}

function shopAddDamageBonus(heroIndex: number, family: number, delta: number): void {
    const b = _damageBucketForFamily(family)
    if (!b) return
    const cur = heroModGet(heroIndex, b, "shop.damage") | 0
    heroModSet(heroIndex, b, "shop.damage", (cur + (delta | 0)) | 0)
}

function _stampHumanoidPhaseForSprite(s: Sprite, phaseName: string, nowMs: number, durMs: number): void {
    if (!s) return
    const now = nowMs | 0
    const dur = Math.max(1, durMs | 0)

    // These are the same HERO_DATA keys your Phaser anim glue is reading for heroes.
    sprites.setDataString(s, HERO_DATA.PhaseName, phaseName)
    sprites.setDataNumber(s, HERO_DATA.PhaseStartMs, now)
    sprites.setDataNumber(s, HERO_DATA.PhaseDurationMs, dur)
    sprites.setDataNumber(s, HERO_DATA.PhaseProgressInt, 0)

    // Keep it non-segmented
    _animKeys_clearPhasePart(s as any)
}


let _shopGrantedCoins = false


function shopInitPOC(): void {
//    _shopEnsurePerHeroStateArrays()


        if (!_shopGrantedCoins) {
            _shopGrantedCoins = true
            setTeamCoins(999)
        }


    // ---------------------------------------------------------
    // 1) Spawn a simple trigger zone (this is what players overlap)
    // ---------------------------------------------------------
    if (!shopTriggerZone) {
        const img = image.create(28, 18)
        img.fill(1)
        img.drawRect(0, 0, 28, 18, 15)
        img.drawLine(2, 9, 25, 9, 15)

        shopTriggerZone = sprites.create(img, SpriteKind.ShopUI)
        shopTriggerZone.setFlag(SpriteFlag.Ghost, true)

        // Put it somewhere obvious near center for now
        const W = userconfig.ARCADE_SCREEN_WIDTH
        const H = userconfig.ARCADE_SCREEN_HEIGHT
        shopTriggerZone.setPosition((W >> 1) + 40, (H >> 1))
    }

    // ---------------------------------------------------------
    // 2) Spawn the shopkeeper NPC as a “hero-like” sprite
    //    PlayerId=99 so Phaser can treat it as a managed “player”
    // ---------------------------------------------------------
    if (!shopkeeperNpc || (shopkeeperNpc.flags & sprites.Flag.Destroyed)) {
        // Find an existing hero sprite that already has OWNER=99 (no sprites.allOfKind)
        let shopHi = -1
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i]
            if (!h) continue
            if (h.flags & sprites.Flag.Destroyed) continue
            const owner = sprites.readDataNumber(h, HERO_DATA.OWNER) | 0
            if (owner === SHOPKEEPER_PLAYER_ID) { shopHi = i; break }
        }

        // If none exists yet, create it using the NORMAL hero pipeline
        if (shopHi < 0) {
            const sx = (shopTriggerZone.x + 22) | 0
            const sy = (shopTriggerZone.y - 4) | 0

            createHeroForPlayer(
                SHOPKEEPER_PLAYER_ID,
                sx,
                sy,
                SHOPKEEPER_HERO_NAME,     // profileNameOverride -> "Shopkeeper"
                FAMILY.SUPPORT,           // familyOverride
                true,                     // isNpc
                false,                    // forcePlayerToHeroIndexMapping
                false
            )

            shopHi = heroes.length - 1
        }

        shopkeeperNpc = heroes[shopHi]

        // Force shopkeeper to face DOWN on spawn (Arcade: +Y is down)
        heroFacingX[shopHi] = 0
        heroFacingY[shopHi] = 1
        shopkeeperNpc.vx = 0
        shopkeeperNpc.vy = 0

        // Publish facing into sprite.data so Phaser/anim glue sees it
        syncHeroDirData(shopHi)

        // Optional: nudge renderer to re-resolve frame immediately
        callHeroAnim(shopHi, "idle", 0)

        if (shopkeeperNpc) {
            shopkeeperNpc.setFlag(SpriteFlag.Ghost, false)

            // Canonical identity fields
            sprites.setDataNumber(shopkeeperNpc, HERO_DATA.OWNER, SHOPKEEPER_PLAYER_ID)
            sprites.setDataString(shopkeeperNpc, HERO_DATA.NAME, SHOPKEEPER_HERO_NAME)

            // If your glue uses these offsets/always-show, keep them:
            sprites.setDataNumber(shopkeeperNpc, HERO_DATA.HERO_WPN_OFF_X, 10)
            sprites.setDataNumber(shopkeeperNpc, HERO_DATA.HERO_WPN_OFF_Y, 6)
            sprites.setDataNumber(shopkeeperNpc, HERO_DATA.WEAPON_ALWAYS_SHOW, 1)

            // Keep legacy fields too (Phaser glue often reads these)
            sprites.setDataString(shopkeeperNpc, "heroName", SHOPKEEPER_HERO_NAME)
            sprites.setDataString(shopkeeperNpc, "heroFamily", heroFamilyNumberToString(FAMILY.SUPPORT))

            // Give it a stable idle phase window
            const nowMs = Math.max(1, game.runtime() | 0)
            setHeroPhaseString(shopHi, "idle")
            _animKeys_stampPhaseWindow(
                shopHi,
                shopkeeperNpc,
                "idle",
                nowMs,
                999999,
                "shopInitPOC(shopkeeper)"
            )

            // Place it near the trigger zone (in case it existed but was elsewhere)
            shopkeeperNpc.setPosition(shopTriggerZone.x + 22, shopTriggerZone.y - 4)

            // ---------------------------------------------------------
            // Publish ring contract + ensure offer hitboxes exist
            // ---------------------------------------------------------
            _shopPublishWeaponRingContractOnShopkeeper(shopkeeperNpc)
            _shopEnsureWeaponRingOffersForShopkeeper(shopkeeperNpc)
        }
    } else {
        // Shopkeeper exists already: ensure contract + offers stay in sync
        _shopPublishWeaponRingContractOnShopkeeper(shopkeeperNpc)
        _shopEnsureWeaponRingOffersForShopkeeper(shopkeeperNpc)
    }

    // ---------------------------------------------------------
    // 3) REMOVE pedestal: replaced by ring offers
    // ---------------------------------------------------------
    if (shopItemPedestal && !(shopItemPedestal.flags & sprites.Flag.Destroyed)) {
        shopItemPedestal.destroy()
    }
    shopItemPedestal = null
}



function _near(a: Sprite, b: Sprite, r: number): boolean {
    if (!a || !b) return false
    const dx = (a.x - b.x)
    const dy = (a.y - b.y)
    return (dx*dx + dy*dy) <= (r*r)
}

function _shopCullDestroyed(list: Sprite[]): void {
    for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]
        if (!s) { list.removeAt(i); continue }
        if ((s.flags & sprites.Flag.Destroyed) != 0) { list.removeAt(i); continue }
    }
}

function _shopRegisterNpc(s: Sprite): void {
    sprites.setDataBoolean(s, SHOP_DATA.IS_SHOP_NPC, true)
    SHOP_NPCS.push(s)
}

function _shopRegisterItem(s: Sprite): void {
    sprites.setDataBoolean(s, SHOP_DATA.IS_SHOP_ITEM, true)
    SHOP_ITEMS.push(s)
}





function shopHandleInputs(nowMs: number): void {
    const now = nowMs | 0

    // Player mapping: heroIndex 0..3 -> controller.player1..player4
    for (let hi = 0; hi < 4; hi++) {
        // Gate: shop active (Step 6 ties this to focus, but keep the gate anyway)
        if (now > (shopTouchUntilMsByHero[hi] | 0)) continue

        const hero = heroes[hi]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) continue

        const pid = (hi + 1) | 0

        // Read focused offer (must be fresh)
        const offer = _shopGetFocusedOfferForHero(hi, now)
        if (!offer) {
            // No offer focused => treat as not-bought for UI
            shopBoughtByHero[hi] = false
            continue
        }

        // Keep UI bought flag in sync with the focused offer
        _shopSetUiBoughtFlagFromOffer(hi, pid, offer)

        // Read offer metadata
        const weaponId = sprites.readDataString(offer, SH_ITEM_WEAPON_ID) || ""
        const renderSlot = sprites.readDataString(offer, SH_ITEM_RENDER_SLOT) || "thrust"
        const price = sprites.readDataNumber(offer, SH_ITEM_PRICE) | 0
        const ringIndex = sprites.readDataNumber(offer, SH_ITEM_RING_INDEX) | 0

        // ---------------------------------------------------------
        // Edge detect: A and B
        // ---------------------------------------------------------
        let aNow = false
        let bNow = false
        if (hi === 0) { aNow = controller.player1.A.isPressed(); bNow = controller.player1.B.isPressed() }
        else if (hi === 1) { aNow = controller.player2.A.isPressed(); bNow = controller.player2.B.isPressed() }
        else if (hi === 2) { aNow = controller.player3.A.isPressed(); bNow = controller.player3.B.isPressed() }
        else if (hi === 3) { aNow = controller.player4.A.isPressed(); bNow = controller.player4.B.isPressed() }

        const aPrev = shopPrevAByPlayer[hi]
        const bPrev = shopPrevBByPlayer[hi]
        shopPrevAByPlayer[hi] = aNow
        shopPrevBByPlayer[hi] = bNow

        const aEdge = aNow && !aPrev
        const bEdge = bNow && !bPrev

        // ---------------------------------------------------------
        // A = BUY focused offer
        // ---------------------------------------------------------
        if (aEdge) {
            const boughtBy0 = sprites.readDataNumber(offer, SH_ITEM_BOUGHT_BY_PID) | 0

            // Already owned by this hero => no-op
            if (boughtBy0 === pid) {
                console.log("[SHOP][BUY] already-owned pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " wid=" + weaponId + " slot=" + renderSlot)
            } else if (boughtBy0 !== 0) {
                // Owned by someone else => deny for now
                console.log("[SHOP][BUY] denied-owned-by-other pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " ownedBy=" + boughtBy0)
            } else {
                // Check coins
                if ((teamCoins | 0) < (price | 0)) {
                    console.log("[SHOP][BUY] denied-insufficient pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " price=" + price + " coins=" + teamCoins)
                } else {
                    // Deduct + mark + equip
                    setTeamCoins((teamCoins - price) | 0)
                    sprites.setDataNumber(offer, SH_ITEM_BOUGHT_BY_PID, pid)

                    _shopEquipWeaponToHeroSlot(hero, renderSlot, weaponId)

                    console.log("[SHOP][BUY] ok pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " wid=" + weaponId + " slot=" + renderSlot + " price=" + price + " coins=" + teamCoins)

                    // UI flag follows focused offer
                    _shopSetUiBoughtFlagFromOffer(hi, pid, offer)
                    _shopUpdateUiForHero(hi, now)
                }
            }
        }

        // ---------------------------------------------------------
        // B = RETURN/UNDO focused offer (only if this hero bought it)
        // ---------------------------------------------------------
        if (bEdge) {
            const boughtBy0 = sprites.readDataNumber(offer, SH_ITEM_BOUGHT_BY_PID) | 0

            if (boughtBy0 !== pid) {
                console.log("[SHOP][RETURN] no-op pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " ownedBy=" + boughtBy0)
            } else {
                // Refund + clear ownership
                sprites.setDataNumber(offer, SH_ITEM_BOUGHT_BY_PID, 0)
                setTeamCoins((teamCoins + price) | 0)

                // Clear the hero slot ONLY if still matches this weaponId
                _shopClearWeaponFromHeroSlotIfMatches(hero, renderSlot, weaponId)

                console.log("[SHOP][RETURN] ok pid=" + pid + " hi=" + hi + " ring=" + ringIndex + " wid=" + weaponId + " slot=" + renderSlot + " refund=" + price + " coins=" + teamCoins)

                _shopSetUiBoughtFlagFromOffer(hi, pid, offer)
                _shopUpdateUiForHero(hi, now)
            }
        }
    }
}



function spawnShopNpc(x: number, y: number, label: string): Sprite {
    const img = image.create(16, 16)
    img.fill(1)
    img.drawRect(0, 0, 16, 16, 15)

    const npc = sprites.create(img, SpriteKind.ShopNpc)
    npc.setPosition(x, y)
    npc.setFlag(SpriteFlag.Ghost, true) // so it doesn't collide weirdly while POC-ing
    sprites.setDataString(npc, SHOP_DATA.LABEL, label || "NPC")

    _shopRegisterNpc(npc)
    return npc
}


function spawnShopItem(x: number, y: number, label: string): Sprite {
    // Invisible hitbox by default (you can temporarily make it visible while debugging)
    const img = image.create(12, 12)
    img.fill(0)
    img.drawRect(0, 0, 12, 12, 1)

    const it = sprites.create(img, SpriteKind.ShopItem)
    it.setPosition(x, y)
    it.setFlag(SpriteFlag.Ghost, true)
    it.setFlag(SpriteFlag.Invisible, true)

    // Keep legacy label field too
    sprites.setDataString(it, SHOP_DATA.LABEL, label || "Item")
    sprites.setDataBoolean(it, SHOP_DATA.BOUGHT, false)

    // New per-offer fields (some will be overwritten by ring builder)
    sprites.setDataString(it, SH_ITEM_LABEL, label || "Item")
    sprites.setDataString(it, SH_ITEM_WEAPON_ID, label || "")
    sprites.setDataString(it, SH_ITEM_RENDER_SLOT, "thrust")
    sprites.setDataString(it, SH_ITEM_GAMEPLAY_KIND, "unknown")
    sprites.setDataNumber(it, SH_ITEM_RING_INDEX, -1)
    sprites.setDataNumber(it, SH_ITEM_PRICE, 10)
    sprites.setDataNumber(it, SH_ITEM_BOUGHT_BY_PID, 0)

    _shopRegisterItem(it)
    return it
}



// ------------------------------------------------------------
// SHOP HUD (shop-only overlay)
// Panel + big dialog + stats in bottom-left.
// Uses checkerboard transparency for "translucent" look.
// ------------------------------------------------------------

let _shopHudPanel: Sprite = null
let _shopHudDialog: TextSprite = null
let _shopHudStats: TextSprite = null

const SHOP_HUD_W = 150
const SHOP_HUD_H = 42

function _shopHudMakePanelImage(w: number, h: number): Image {
    const img = image.create(w, h)
    img.fill(0) // 0 is transparent

    // Border
    img.drawRect(0, 0, w, h, 1)

    // "Translucent" interior: checkerboard of transparent (0) and dark pixel (1)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (((x + y) & 1) === 0) {
                img.setPixel(x, y, 0) // transparent pixel
            } else {
                img.setPixel(x, y, 1) // dark pixel
            }
        }
    }

    return img
}

function ensureShopHud(): void {
    if (_shopHudPanel) return

    // Panel sprite
    _shopHudPanel = sprites.create(_shopHudMakePanelImage(SHOP_HUD_W, SHOP_HUD_H), SpriteKind.ShopUI)
    _shopHudPanel.setFlag(SpriteFlag.Ghost, true)
    _shopHudPanel.setFlag(SpriteFlag.RelativeToCamera, true)
    _shopHudPanel.setFlag(SpriteFlag.Invisible, true)
    _shopHudPanel.z = 10_000

    // Big dialog line
    _shopHudDialog = textsprite.create("", 0, 15) // fg=15 (white)
    _shopHudDialog.setMaxFontHeight(12)
    _shopHudDialog.setOutline(1, 1) // outline=dark
    _shopHudDialog.setFlag(SpriteFlag.RelativeToCamera, true)
    _shopHudDialog.setFlag(SpriteFlag.Ghost, true)
    _shopHudDialog.setFlag(SpriteFlag.Invisible, true)
    _shopHudDialog.z = 10_001

    // Stats line (slightly smaller)
    _shopHudStats = textsprite.create("", 0, 7) // fg=7 (light)
    _shopHudStats.setMaxFontHeight(9)
    _shopHudStats.setOutline(1, 1)
    _shopHudStats.setFlag(SpriteFlag.RelativeToCamera, true)
    _shopHudStats.setFlag(SpriteFlag.Ghost, true)
    _shopHudStats.setFlag(SpriteFlag.Invisible, true)
    _shopHudStats.z = 10_001
}

function _shopHudSetVisible(show: boolean): void {
    ensureShopHud()
    _shopHudPanel.setFlag(SpriteFlag.Invisible, !show)
    _shopHudDialog.setFlag(SpriteFlag.Invisible, !show)
    _shopHudStats.setFlag(SpriteFlag.Invisible, !show)
}

function _shopHudSetText(dialog: string, stats: string): void {
    ensureShopHud()
    ;(_shopHudDialog as any).setText(dialog || "")
    ;(_shopHudStats as any).setText(stats || "")
}

function _shopHudPositionBottomLeft(): void {
    ensureShopHud()

    const W = userconfig.ARCADE_SCREEN_WIDTH
    const H = userconfig.ARCADE_SCREEN_HEIGHT

    const pad = 2
    const cx = pad + (SHOP_HUD_W >> 1)
    const cy = H - pad - (SHOP_HUD_H >> 1)

    _shopHudPanel.x = cx
    _shopHudPanel.y = cy

    // dialog near top of panel
    _shopHudDialog.x = cx
    _shopHudDialog.y = cy - 10

    // stats near bottom of panel
    _shopHudStats.x = cx
    _shopHudStats.y = cy + 8
}

function shopHudShow(dialog: string, stats: string): void {
    _shopHudSetText(dialog, stats)
    _shopHudPositionBottomLeft()
    _shopHudSetVisible(true)
}

function shopHudHide(): void {
    if (!_shopHudPanel) return
    _shopHudSetVisible(false)
}

function _shopBuildStatsPreview(heroIndex: number): string {
    // TODO: replace with calculateMoveStats(...) once you pick an item model.
    // Keep it single-line for now so it reads cleanly.
    return "DMG:+0  REACH:+0  TIME:+0  STATUS:+0"
}


// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮

// ================================================================
// SECTION 2.5 - TILEMAP AND WORLD GENERATION (improved)
// ================================================================
// Uses cellular automata to make nice blobby walls, then carves
// a central arena for the heroes.
// ================================================================

function _createTileMap2D(): number[][] {
    // Just use the basic cave generator in ALL runtimes.
    // MakeCode and Phaser both see the same 0/1 logic grid.
    return _createBasicCaveMap();
}

function _createBasicCaveMap(): number[][] {
    // 1) Decide world dimensions in tiles
    let cols = Math.max(WORLD_TILES_W, MIN_WORLD_TILES_W)
    let rows = Math.max(WORLD_TILES_H, MIN_WORLD_TILES_H)

    // Extra safety floor if you still want it
    if (cols < 10) cols = 10
    if (rows < 8) rows = 8

    // 2) Seed random map (0 = empty, 1 = wall)
    const wallChance = 45
    let map = _seedRandomMap(rows, cols, wallChance)

    // 3) Run a few smoothing steps (cellular automata)
    const smoothSteps = 5
    for (let i = 0; i < smoothSteps; i++) {
        map = _smoothMapStep(map)
    }

    // 4) Make outer border solid walls (flying-island feel & clean edges)
    for (let r = 0; r < rows; r++) {
        map[r][0] = TILE_WALL
        map[r][cols - 1] = TILE_WALL
    }
    for (let c = 0; c < cols; c++) {
        map[0][c] = TILE_WALL
        map[rows - 1][c] = TILE_WALL
    }

    // 5) Carve a central arena for the heroes (guaranteed open space)
    const centerR = Math.idiv(rows, 2)
    const centerC = Math.idiv(cols, 2)

    // Size of arena scales with map size
    const arenaHalfH = Math.max(2, Math.idiv(rows, 8))   // vertical half-size
    const arenaHalfW = Math.max(2, Math.idiv(cols, 8))   // horizontal half-size

    const topR = Math.max(1, centerR - arenaHalfH)
    const bottomR = Math.min(rows - 2, centerR + arenaHalfH)
    const leftC = Math.max(1, centerC - arenaHalfW)
    const rightC = Math.min(cols - 2, centerC + arenaHalfW)

    for (let r = topR; r <= bottomR; r++) {
        for (let c = leftC; c <= rightC; c++) {
            map[r][c] = TILE_EMPTY
        }
    }

    // 6) Carve L-shaped corridors from each corner into the arena.
    //
    // Monsters spawning in the corners (near [1,1], [1, cols-2], [rows-2,1],
    // [rows-2, cols-2]) now have guaranteed paths into the arena.
    //
    const corridorHalfWidth = 1 // 1 → corridors are 3 tiles wide

    function carveRect(r0: number, c0: number, r1: number, c1: number) {
        const rStart = Math.max(1, Math.min(r0, r1))
        const rEnd   = Math.min(rows - 2, Math.max(r0, r1))
        const cStart = Math.max(1, Math.min(c0, c1))
        const cEnd   = Math.min(cols - 2, Math.max(c0, c1))

        for (let r = rStart; r <= rEnd; r++) {
            for (let c = cStart; c <= cEnd; c++) {
                map[r][c] = TILE_EMPTY
            }
        }
    }

    function carveCornerToArena(cornerR: number, cornerC: number) {
        // First segment: from corner toward the arena horizontally
        const targetC = centerC
        carveRect(
            cornerR - corridorHalfWidth,
            Math.min(cornerC, targetC),
            cornerR + corridorHalfWidth,
            Math.max(cornerC, targetC)
        )

        // Second segment: from that line down/up to the vertical center of arena
        const targetR = centerR
        carveRect(
            Math.min(cornerR, targetR),
            targetC - corridorHalfWidth,
            Math.max(cornerR, targetR),
            targetC + corridorHalfWidth
        )
    }

    // Inner spawn corners (leave outermost border walls intact at 0 / rows-1 / cols-1)
    const topRow = 1
    const bottomRow = rows - 2
    const leftCol = 1
    const rightCol = cols - 2

    // Top-left corner → arena
    carveCornerToArena(topRow, leftCol)
    // Top-right corner → arena
    carveCornerToArena(topRow, rightCol)
    // Bottom-left corner → arena
    carveCornerToArena(bottomRow, leftCol)
    // Bottom-right corner → arena
    carveCornerToArena(bottomRow, rightCol)


    // 7) Carve spawn pads that INCLUDE the actual outer corners.
    //
    // This clears a (2*radius+1)x(2*radius+1) block of floor centered
    // near each corner. Because we allow r/c = 0 and rows-1/cols-1
    // here, we punch holes in the border exactly where we want them.

    const SPAWN_PAD_RADIUS = 2 // 2 → up to 5x5 pad; tune as needed

    function carveSpawnPad(centerR: number, centerC: number) {
        const rStart = Math.max(0, centerR - SPAWN_PAD_RADIUS)
        const rEnd   = Math.min(rows - 1, centerR + SPAWN_PAD_RADIUS)
        const cStart = Math.max(0, centerC - SPAWN_PAD_RADIUS)
        const cEnd   = Math.min(cols - 1, centerC + SPAWN_PAD_RADIUS)

        for (let r = rStart; r <= rEnd; r++) {
            for (let c = cStart; c <= cEnd; c++) {
                map[r][c] = TILE_EMPTY
            }
        }
    }

    // Pads centered on the REAL world corners
    carveSpawnPad(0, 0)                 // top-left WORLD corner
    carveSpawnPad(0, cols - 1)          // top-right WORLD corner
    carveSpawnPad(rows - 1, 0)          // bottom-left WORLD corner
    carveSpawnPad(rows - 1, cols - 1)   // bottom-right WORLD corner




    console.log(
        ">>> [HeroEngine.worldgen] map size",
        rows,
        "x",
        cols,
        "arena=",
        { topR, bottomR, leftC, rightC }
    )

    return map

}

// ------------------------------------------------------------
// Seed map with random walls / empty
// ------------------------------------------------------------
function _seedRandomMap(rows: number, cols: number, wallChancePercent: number): number[][] {
    const map: number[][] = []
    for (let r = 0; r < rows; r++) {
        const row: number[] = []
        for (let c = 0; c < cols; c++) {
            // Random wall vs empty
            if (randint(0, 99) < wallChancePercent) {
                row.push(TILE_WALL)
            } else {
                row.push(TILE_EMPTY)
            }
        }
        map.push(row)
    }
    return map
}

// ------------------------------------------------------------
// One cellular automata smoothing step
// ------------------------------------------------------------
function _smoothMapStep(oldMap: number[][]): number[][] {
    const rows = oldMap.length
    const cols = oldMap[0].length
    const newMap: number[][] = []

    for (let r = 0; r < rows; r++) {
        const newRow: number[] = []
        for (let c = 0; c < cols; c++) {
            const wallCount = _countWallNeighbors(oldMap, r, c)

            const current = oldMap[r][c]
            let next = current

            // Classic cave-style rules:
            // - If many walls around, this cell tends to become wall
            // - If few walls around, it tends to become empty
            if (current === TILE_WALL) {
                if (wallCount < 4) next = TILE_EMPTY
                else next = TILE_WALL
            } else { // TILE_EMPTY
                if (wallCount > 4) next = TILE_WALL
                else next = TILE_EMPTY
            }

            newRow.push(next)
        }
        newMap.push(newRow)
    }
    return newMap
}

// ------------------------------------------------------------
// Count walls in the 8 neighbors around (r,c).
// Out-of-bounds counts as wall to keep edges closed.
// ------------------------------------------------------------
function _countWallNeighbors(map: number[][], r: number, c: number): number {
    const rows = map.length
    const cols = map[0].length
    let count = 0

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                // Treat out-of-bounds as wall
                count++
            } else if (map[nr][nc] === TILE_WALL) {
                count++
            }
        }
    }

    return count
}


function _createWallTileImage(): Image {
    const s = WORLD_TILE_SIZE
    const img = image.create(s, s)

    // Black base
    img.fill(15)

    // Gray speckles
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            if (randint(0, 7) === 0) img.setPixel(x, y, 13)
        }
    }

    // Stripes
    for (let x = 0; x < s; x += 4) {
        for (let y = 0; y < s; y++) img.setPixel(x, y, 1)
    }

    return img
}



function _buildTilesIntoSprites(map: number[][]): void {
    // Phaser runtime: NEVER represent wall tiles as Arcade sprites.
    // Rendering is handled by tileMapGlue/WorldTileRenderer using Phaser tilemap layers,
    // and collisions are handled by the engine's grid-based solver.
    if (isPhaserRuntime()) return

    const tile = WORLD_TILE_SIZE
    const wallImg = _createWallTileImage()

    for (let r = 0; r < map.length; r++) {
        const row = map[r]
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== TILE_WALL) continue

            const s = sprites.create(wallImg, SpriteKind.Wall)
            s.left = c * tile
            s.top = r * tile
        }
    }
}

// This is called ONLY by HeroEngine.start()
function initWorldTileMap(): void {
    // Always build the numeric world grid (used by Phaser renderer + collision).
    _engineWorldTileMap = _createTileMap2D()

    // Only the MakeCode Arcade runtime needs "walls as sprites".
    // Phaser renders walls as a Phaser tilemap layer, not sprite objects.
    if (isMakeCodeArcadeRuntime()) {
        _buildTilesIntoSprites(_engineWorldTileMap)
    }
}

function _readTile(r: number, c: number): number {
    if (r < 0 || r >= _engineWorldTileMap.length) return TILE_WALL
    if (c < 0 || c >= _engineWorldTileMap[0].length) return TILE_WALL
    return _engineWorldTileMap[r][c]
}

// ==========================================================
// TILEMAP COLLISION – HEROES + ENEMIES, WITH LOGGING
// Soft slide along walls instead of teleporting
// ==========================================================

let _tileCollFrame = 0

// Check if an axis-aligned box overlaps any TILE_WALL
function _boxOverlapsWall(
    centerX: number,
    centerY: number,
    halfW: number,
    halfH: number
): boolean {
    if (!_engineWorldTileMap || _engineWorldTileMap.length === 0) return false

    const map = _engineWorldTileMap
    const rows = map.length
    const cols = map[0].length
    const tileSize = WORLD_TILE_SIZE

    const left = centerX - halfW
    const right = centerX + halfW - 1
    const top = centerY - halfH
    const bottom = centerY + halfH - 1

    const minCol = Math.idiv(left, tileSize)
    const maxCol = Math.idiv(right, tileSize)
    const minRow = Math.idiv(top, tileSize)
    const maxRow = Math.idiv(bottom, tileSize)

    for (let r = minRow; r <= maxRow; r++) {
        if (r < 0 || r >= rows) continue
        const rowArr = map[r]
        for (let c = minCol; c <= maxCol; c++) {
            if (c < 0 || c >= cols) continue
            if (rowArr[c] === TILE_WALL) {
                return true
            }
        }
    }
    return false
}



// Soft-slide resolver for a group (heroes or enemies)
function _resolveTilemapCollisionsForGroup(group: Sprite[], label: string): void {
    if (!_engineWorldTileMap || _engineWorldTileMap.length === 0) return

    const tileSize = WORLD_TILE_SIZE
    const map = _engineWorldTileMap
    const rows = map.length
    const cols = map[0].length

    // Log occasionally so we can see what's happening
    const doFrameLog = (_tileCollFrame % 30) === 0
    if (doFrameLog) {
        console.log(
            "[tileColl] frame" + _tileCollFrame +
            "group" + label +
            "count" + group.length +
            "map" + rows + "x" + cols +
            "tileSize" + tileSize
        )
    }

    for (let i = 0; i < group.length; i++) {
        const s = group[i]
        if (!s) continue

        const prevX = sprites.readDataNumber(s, HERO_DATA.PREV_X)
        const prevY = sprites.readDataNumber(s, HERO_DATA.PREV_Y)
        const cx = s.x
        const cy = s.y

        const halfW = s.width >> 1
        const halfH = s.height >> 1

        // If we don't have a prev snapshot, skip for this frame
        if (!(prevX || prevX === 0) || !(prevY || prevY === 0)) continue

        // ------------------------------------------
        // Soft slide resolution:
        // 1) test X movement (cx, prevY)
        // 2) then test Y (finalX, cy)
        // ------------------------------------------

        let finalX = cx
        let finalY = cy
        let blockedX = false
        let blockedY = false

        // Test horizontal movement (X) first
        if (_boxOverlapsWall(cx, prevY, halfW, halfH)) {
            blockedX = true
            finalX = prevX  // can't move into the wall; keep previous X
        } else {
            finalX = cx     // X is ok, Y will be resolved next
        }

        // Test vertical movement (Y) with resolved X
        if (_boxOverlapsWall(finalX, cy, halfW, halfH)) {
            blockedY = true
            finalY = prevY  // can't move into the wall; keep previous Y
        } else {
            finalY = cy
        }

        // Apply final position
        s.x = finalX
        s.y = finalY

        // Zero out velocity on the blocked axes so they "slide"
        if (blockedX) s.vx = 0
        if (blockedY) s.vy = 0

        if (blockedX || blockedY) {
            console.log(
                "[tileColl]" + label + "#" + i +
                "blockedX" + blockedX + "blockedY" + blockedY +
                "prev=(" + prevX + "," + prevY + ")" +
                "curr=(" + cx + "," + cy + ")" +
                "final=(" + finalX + "," + finalY + ")"
            )
        } else if (doFrameLog && i === 0) {
            // Occasional sample log even when no collision,
            // so we know the system is actually running.
            console.log(
                "[tileColl]" + label + "#" + i +
                "no collision" +
                "prev=(" + prevX + "," + prevY + ")" +
                "curr=(" + cx + "," + cy + ")"
            )
        }
    }
}

function resolveHeroTilemapCollisions(): void {
    if (!_engineWorldTileMap || _engineWorldTileMap.length === 0) return

    const map = _engineWorldTileMap
    const rows = map.length
    const cols = map[0].length
    const tileSize = WORLD_TILE_SIZE

    // Resolve collision for a single sprite (hero or enemy)
    function resolveForSprite(s: Sprite) {
        if (!s) return

        const halfW = s.width >> 1
        const halfH = s.height >> 1

        // Run a couple of passes in case we overlap more than one tile
        for (let iter = 0; iter < 3; iter++) {
            const left = s.x - halfW
            const right = s.x + halfW - 1
            const top = s.y - halfH
            const bottom = s.y + halfH - 1

            const minCol = Math.idiv(left, tileSize)
            const maxCol = Math.idiv(right, tileSize)
            const minRow = Math.idiv(top, tileSize)
            const maxRow = Math.idiv(bottom, tileSize)

            let moved = false

            for (let r = minRow; r <= maxRow; r++) {
                if (r < 0 || r >= rows) continue
                const rowArr = map[r]


                for (let c = minCol; c <= maxCol; c++) {
                    const type = rowArr[c] | 0; // force 0 if undefined
                    const def = TILE_COLLISION_DEFS[type] || TILE_COLLISION_DEFS[0];
                    if (!def.solid) continue;

                    // Build the tile's collision rect in WORLD space,
                    // using per-type offsets and size.
                    const shapeLeft   = c * tileSize + def.offsetX;
                    const shapeRight  = shapeLeft + def.width;
                    const shapeTop    = r * tileSize + def.offsetY;
                    const shapeBottom = shapeTop + def.height;

                    // Compute overlaps on each side (sprite vs collision shape)
                    const overlapLeft   = right  - shapeLeft;
                    const overlapRight  = shapeRight - left;
                    const overlapTop    = bottom - shapeTop;
                    const overlapBottom = shapeBottom - top;

                    // If any are <= 0, AABBs don't overlap on that axis
                    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) {
                        continue;
                    }

                    // Minimal penetration on each axis
                    const penX = overlapLeft < overlapRight ? overlapLeft : overlapRight;
                    const penY = overlapTop < overlapBottom ? overlapTop : overlapBottom;

                    if (penX < penY) {
                        // Push in X
                        const shapeCenterX = shapeLeft + def.width / 2;
                        if (s.x < shapeCenterX) {
                            s.x -= penX;
                        } else {
                            s.x += penX;
                        }
                        // Soft slide: kill only X velocity
                        s.vx = 0;
                    } else {
                        // Push in Y
                        const shapeCenterY = shapeTop + def.height / 2;
                        if (s.y < shapeCenterY) {
                            s.y -= penY;
                        } else {
                            s.y += penY;
                        }
                        // Soft slide: kill only Y velocity
                        s.vy = 0;
                    }

                    moved = true;

                }



            }

            // If we didn't adjust position this pass, we are out of walls
            if (!moved) break
        }
    }

    // Apply to all heroes
    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (h) resolveForSprite(h)
    }

    // Apply to all enemies
    for (let ei = 0; ei < enemies.length; ei++) {
        const e = enemies[ei]
        if (e) resolveForSprite(e)
    }
}

// Main entry to call from onUpdate
function resolveTilemapCollisions(): void {
    _tileCollFrame++
    resolveHeroTilemapCollisions()
    //_resolveTilemapCollisionsForGroup(heroes, "Hero")
    //_resolveTilemapCollisionsForGroup(enemies, "Enemy")
}

// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮

// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️

// ================================================================
// SECTION 4 - PLAYER SPRITES CREATION AND CONTROL
// ================================================================
// Creating, locking/unlocking, and animating heroes. 
// Owns hero movement, controller binding, and base stats.

// Default hero profile names per slot (index 0..3).
// On MakeCode, this is the only thing used.
// On Phaser, the wrapper can override via globalThis.__heroProfiles.
const HERO_SLOT_PROFILE_DEFAULTS = ["Default", "Default", "Default", "Default"];

// Hook: resolve a "profile name" for this hero.
// In Phaser, the wrapper may set (globalThis as any).__heroProfiles
// to an array like ["Jason", "Default", "Default", "Default"].
// In MakeCode, globalThis may not exist, so we swallow errors and
// just fall back to the default profile.

function getHeroProfileForHeroIndex(heroIndex: number): string {
    const hero = heroes[heroIndex]
    if (!hero) return "Default"

    // Prefer mapping by owner/playerId so join order lines up with profiles
    const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
    const slotIndex = ownerId > 0 ? ownerId - 1 : heroIndex

    // Default profile name from engine's own table
    let name = HERO_SLOT_PROFILE_DEFAULTS[slotIndex] || "Default"

    // OPTIONAL override from host (Phaser / VS / custom glue file)
    try {
        const g: any = globalThis
        if (g && g.__heroProfiles && typeof g.__heroProfiles[slotIndex] === "string") {
            name = g.__heroProfiles[slotIndex]
        }
    } catch (e) {
        // In MakeCode Arcade, globalThis may not exist; we just keep the default.
    }

    return name
}


function runHeroLogicForHero(heroIndex: number, button: string) {
    const hero = heroes[heroIndex];
    if (!hero) {
        if (DEBUG_HERO_LOGIC) {
            console.log("[runHeroLogicForHero] NO HERO heroIndex=" + heroIndex + " button=" + button);
        }
        return null;
    }

    const localEnemies = enemies as any[];
    const localHeroes = heroes as any[];

    // Choose the appropriate hook
    let fn: any = null;
    if (heroIndex == 0) fn = HeroEngine.hero1LogicHook;
    else if (heroIndex == 1) fn = HeroEngine.hero2LogicHook;
    else if (heroIndex == 2) fn = HeroEngine.hero3LogicHook;
    else if (heroIndex == 3) fn = HeroEngine.hero4LogicHook;
    else fn = HeroEngine.hero1LogicHook;

    if (DEBUG_HERO_LOGIC) {
        console.log(
            "[runHeroLogicForHero] ENTER heroIndex=" + heroIndex +
            " button=" + button +
            " fnType=" + (typeof fn)
        );
    }

    // Guard: do not let the VM try to call a non-function (this is what leads to 'iface')
    if (!fn || typeof fn !== "function") {
        console.log(
            "[runHeroLogicForHero] INVALID HOOK heroIndex=" + heroIndex +
            " button=" + button +
            " fn=" + fn
        );
        return [
            FAMILY.STRENGTH,
            0, 0, 0, 0,
            ELEM.NONE,
            ANIM.ID.IDLE
        ];
    }

    //let out: number[];
    let out: any[];

    try {
        out = fn(button, heroIndex, localEnemies, localHeroes);
    } catch (e) {
        console.log(
            "[runHeroLogicForHero] ERROR heroIndex=" + heroIndex +
            " button=" + button +
            " error=" + e
        );
        return [
            FAMILY.STRENGTH,
            0, 0, 0, 0,
            ELEM.NONE,
            ANIM.ID.IDLE
        ];
    }

    if (DEBUG_HERO_LOGIC) {
        console.log(
            "[runHeroLogicForHero] OUT heroIndex=" + heroIndex +
            " button=" + button +
            " out=" + (out ? "[" + out.join(",") + "]" : "null")
        );
    }

    return out;
}

// Wire default implementation into overridable hook
HeroEngine.runHeroLogicForHeroHook = runHeroLogicForHero;



// Positional unpack (allow strings or numbers from Blocks)
// 0: family, 1–4: trait pools, 5: element, 6: anim
function coerceFamily(val: any): number {
    if (typeof val === "string") {
        const s = val.toLowerCase()
        if (s === "strength") return FAMILY.STRENGTH
        if (s === "agility") return FAMILY.AGILITY
        if (s === "intelligence" || s === "intellect") return FAMILY.INTELLECT
        if (s === "support" || s === "heal") return FAMILY.HEAL
    }
    return (val | 0)
}

function coerceElement(val: any): number {
    if (typeof val === "string") {
        const s = val.toLowerCase()
        if (s === "none") return ELEM.NONE
        if (s === "grass" || s === "plant" || s === "plants") return ELEM.GRASS
        if (s === "fire") return ELEM.FIRE
        if (s === "water") return ELEM.WATER
        if (s === "electric" || s === "lightning") return ELEM.ELECTRIC
        // Earth support — you'll add ELEM.EARTH yourself
        if (s === "earth" && (ELEM as any).EARTH !== undefined) {
            return (ELEM as any).EARTH
        }
    }
    return (val | 0)
}


function calculateMoveStatsForFamily(family: number, button: string, traits: number[]) {
    const baseTime = getBaseMoveDurationMs(button, family)
    if (family == FAMILY.STRENGTH) return calculateStrengthStats(baseTime, traits)
    if (family == FAMILY.AGILITY) return calculateAgilityStats(baseTime, traits)
    if (family == FAMILY.INTELLECT) return calculateIntellectStats(baseTime, traits)
    if (family == FAMILY.HEAL) return calculateHealStats(baseTime, traits)
    return makeBaseStats(baseTime)
}



function heroImageForPlayer(playerId: number) { /* (same 4 tiny images as before) */

    if (playerId == 1) return img`
        . . . . . . f f f f . . . . . .
        . . . . f f f 2 2 f f f . . . .
        . . . f f f 2 2 2 2 f f f . . .
        . . f f f e e e e e e f f f . .
        . . f f e 2 2 2 2 2 2 e e f . .
        . . f e 2 f f f f f f 2 e f . .
        . . f f f f e e e e f f f f . .
        . f f e f b f 4 4 f b f e f f .
        . f e e 4 1 f d d f 1 4 e e f .
        . . f e e d d d d d d e e f . .
        . . . f e e 4 4 4 4 e e f . . .
        . . e 4 f 2 2 2 2 2 2 f 4 e . .
        . . 4 d f 2 2 2 2 2 2 f d 4 . .
        . . 4 4 f 4 4 5 5 4 4 f 4 4 . .
        . . . . . f f f f f f . . . . .
        . . . . . f f . . f f . . . . .
    `
    if (playerId == 2) return img`
        . . . . . . c c c c . . . . . .
        . . . . c c c 5 5 c c c . . . .
        . . . c c c 5 5 5 5 c c c . . .
        . . c c c e e e e e e c c c . .
        . . c c e 5 5 5 5 5 5 e e c . .
        . . c e 5 c c c c c c 5 e c . .
        . . c c c c e e e e c c c c . .
        . c c e c b c 4 4 c b c e c c .
        . c e e 4 1 c d d c 1 4 e e c .
        . . c e e d d d d d d e e c . .
        . . . c e e 4 4 4 4 e e c . . .
        . . e 4 c 5 5 5 5 5 5 c 4 e . .
        . . 4 d c 5 5 5 5 5 5 c d 4 . .
        . . 4 4 c 4 4 7 7 4 4 c 4 4 . .
        . . . . . c c c c c c . . . . .
        . . . . . c c . . c c . . . . .
    `
    if (playerId == 3) return img`
        . . . . . . 6 6 6 6 . . . . . .
        . . . . 6 6 6 3 3 6 6 6 . . . .
        . . . 6 6 6 3 3 3 3 6 6 6 . . .
        . . 6 6 6 e e e e e e 6 6 6 . .
        . . 6 6 e 3 3 3 3 3 3 e e 6 . .
        . . 6 e 3 6 6 6 6 6 6 3 e 6 . .
        . . 6 6 6 6 e e e e 6 6 6 6 . .
        . 6 6 e 6 b 6 4 4 6 b 6 e 6 6 .
        . 6 e e 4 1 6 d d 6 1 4 e e 6 .
        . . 6 e e d d d d d d e e 6 . .
        . . . 6 e e 4 4 4 4 e e 6 . . .
        . . e 4 6 3 3 3 3 3 3 6 4 e . .
        . . 4 d 6 3 3 3 3 3 3 6 d 4 . .
        . . 4 4 6 4 4 9 9 4 4 6 4 4 . .
        . . . . . 6 6 6 6 6 6 . . . . .
        . . . . . 6 6 . . 6 6 . . . . .
    `
    return img`
        . . . . . . 8 8 8 8 . . . . . .
        . . . . 8 8 8 7 7 8 8 8 . . . .
        . . . 8 8 8 7 7 7 7 8 8 8 . . .
        . . 8 8 8 e e e e e e 8 8 8 . .
        . . 8 8 e 7 7 7 7 7 7 e e 8 . .
        . . 8 e 7 8 8 8 8 8 8 7 e 8 . .
        . . 8 8 8 8 e e e e 8 8 8 8 . .
        . 8 8 e 8 b 8 4 4 8 b 8 e 8 8 .
        . 8 e e 4 1 8 d d 8 1 4 e e 8 .
        . . 8 e e d d d d d d e e 8 . .
        . . . 8 e e 4 4 4 4 e e 8 . . .
        . . e 4 8 7 7 7 7 7 7 8 4 e . .
        . . 4 d 8 7 7 7 7 7 7 8 d 4 . .
        . . 4 4 8 4 4 9 9 4 4 8 4 4 . .
        . . . . . 8 8 8 8 8 8 . . . . .
        . . . . . 8 8 . . 8 8 . . . . .
    `

}


function ensureHeroWeaponLoadoutSeeded(hero: Sprite, profileName: string, familyNumber: number) {
    const existingVer = sprites.readDataNumber(hero, HERO_DATA.WEAPON_LOADOUT_VER) | 0
    if (existingVer === DEFAULT_WEAPON_LOADOUT_VER) return

    const lo = getHardcodedWeaponLoadoutForHero(profileName, familyNumber)

    sprites.setDataString(hero, HERO_DATA.WEAPON_SLASH_ID, lo.slashId)
    sprites.setDataString(hero, HERO_DATA.WEAPON_THRUST_ID, lo.thrustId)
    sprites.setDataString(hero, HERO_DATA.WEAPON_CAST_ID, lo.castId)
    sprites.setDataString(hero, HERO_DATA.WEAPON_EXEC_ID, lo.execId)

    // NEW
    sprites.setDataString(hero, HERO_DATA.WEAPON_COMBO_ID, lo.comboId)

    sprites.setDataNumber(hero, HERO_DATA.WEAPON_LOADOUT_VER, DEFAULT_WEAPON_LOADOUT_VER)
}

function createHeroForPlayer(
    playerId: number,
    startX: number,
    startY: number,
    // NEW (optional): allow callers to override identity/family and treat as NPC
    profileNameOverride?: string,
    familyOverride?: number,
    isNpc?: boolean,
    // NEW (optional): if true, still map playerToHeroIndex[playerId] even for non-1..4 ids
    forcePlayerToHeroIndexMapping?: boolean
) {
    // Start with a 64x64 placeholder so HP/mana bars + collisions match LPC hero art size.
    // In Phaser, the native LPC sprite uses the same footprint; we skip pixel uploads.
    // In pure Arcade, students will just see big, chunky heroes.
    const hero = sprites.create(image.create(64, 64), SpriteKind.Player)

    hero.x = startX; hero.y = startY; hero.z = 20

    // NEW: seed previous position for collisions
    sprites.setDataNumber(hero, HERO_DATA.PREV_X, hero.x)
    sprites.setDataNumber(hero, HERO_DATA.PREV_Y, hero.y)

    const heroIndex = heroes.length; heroes.push(hero)

    // -------------------------------------------------
    // NEW: do NOT automatically map non-1..4 ids unless requested.
    // This avoids sparse playerToHeroIndex[99] unless you WANT it.
    // -------------------------------------------------
    const pid = playerId | 0
    const shouldMap =
        (pid >= 1 && pid <= 4) ||
        (forcePlayerToHeroIndexMapping ? true : false)

    if (shouldMap) {
        playerToHeroIndex[pid] = heroIndex
    }

    sprites.setDataNumber(hero, HERO_DATA.OWNER, pid)
    heroFacingX[heroIndex] = 1; heroFacingY[heroIndex] = 0

    // Shopkeeper: force initial facing DOWN
    if (playerId === SHOPKEEPER_PLAYER_ID) {
        heroFacingX[heroIndex] = 0
        heroFacingY[heroIndex] = 1
    }


    heroBusyUntil[heroIndex] = 0

    // Use a non-zero timestamp for invariants even if runtime() is 0 at boot.
    const nowMs = Math.max(1, game.runtime() | 0)

    // NEW: seed initial facing + phase for animations
    syncHeroDirData(heroIndex)
    setHeroPhaseString(heroIndex, "idle")
    clearHeroFrameColOverride(heroIndex) // IMPORTANT: seed to -1 so run/idle logic works

    // -------------------------------------------------
    // NEW: seed universal Action/Phase/Event timeline keys (human-readable)
    // -------------------------------------------------
    // IMPORTANT (unified invariants): ActionSequence must be > 0 and ActionKind non-empty
    // even before the first player-driven move begins.
    sprites.setDataNumber(hero, HERO_DATA.ActionSequence, 1)
    sprites.setDataString(hero, HERO_DATA.ActionKind, "spawn")
    sprites.setDataNumber(hero, HERO_DATA.ActionVariant, 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionSeed, nowMs | 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP0, 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP1, 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP2, 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP3, 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionTargetId, 0)

    // PhaseFlags default
    sprites.setDataNumber(hero, HERO_DATA.PhaseFlags, 0)

    // NEW: seed PhasePart (within-phase segmentation) defaults
    sprites.setDataString(hero, HERO_DATA.PhasePartName, "")
    sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, 0) // 0..PHASE_PROGRESS_MAX
    sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)

    // NEW: seed RenderStyle (orthogonal cosmetics) defaults
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleMask, 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP0, 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP1, 0)

    _animEvent_reset(hero)
    // -------------------------------------------------

    // UNIFIED CONTRACT: PhaseName/Start/Dur must be valid immediately (non-zero duration).
    // setHeroPhaseString() resets duration to 0 on change, so stamp an ambient window now.
    const idleDur = _ambientPhaseWindowMs("idle") | 0
    _animKeys_stampPhaseWindow(heroIndex, hero, "idle", nowMs, idleDur, "createHeroForPlayer(init)")

    // -------------------------------------------------
    // NEW: decide family + profile name BEFORE seeding identity strings/loadout
    // -------------------------------------------------
    const fam = (familyOverride == null) ? FAMILY.STRENGTH : (familyOverride | 0)

    // IMPORTANT: keep your default input state, but allow NPC override
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, false)
    if (isNpc) sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, true)

    sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, false)
    sprites.setDataNumber(hero, HERO_DATA.TARGET_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.TARGET_LOCK_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.COMBO_COUNT, 0)
    sprites.setDataNumber(hero, HERO_DATA.COMBO_MULT, 100)
    sprites.setDataNumber(hero, HERO_DATA.LAST_HIT_TIME, 0)
    sprites.setDataString(hero, HERO_DATA.LAST_MOVE_KEY, "")
    sprites.setDataNumber(hero, HERO_DATA.IFRAME_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL, 0)

    // Seed UI/state fields so Phaser can render immediately
    sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHAIN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_ZONE_E_W, AGI_METER_W_E)
    sprites.setDataNumber(hero, HERO_DATA.AGI_ZONE_1_W, AGI_METER_W_1)
    sprites.setDataNumber(hero, HERO_DATA.AGI_ZONE_2_W, AGI_METER_W_2)
    sprites.setDataNumber(hero, HERO_DATA.AGI_ZONE_3_W, AGI_METER_W_3)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_COUNT, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_SUM, 0)

    // Manual cancel bookkeeping (seed all to 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

    // NEW (Agility combo v3): persistent combo mode + landing/entry bookkeeping
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_MODE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAND_ARMED_FOR_DU, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAST_AGI_BTN, 0)

    // NEW (Agility combo v4): weapon-as-meter charge contract (seed defaults)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PERIOD_MS, AGI_CHARGE_DEFAULT_PERIOD_MS)

    sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_A_ADD, AGI_CHARGE_DEFAULT_TIER_A_ADD)
    sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_B_ADD, AGI_CHARGE_DEFAULT_TIER_B_ADD)
    sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_C_ADD, AGI_CHARGE_DEFAULT_TIER_C_ADD)

    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_FRAC_X1000, AGI_CHARGE_DEFAULT_EXEC_FRAC_X1000)
    sprites.setDataNumber(hero, HERO_DATA.AGI_A_FRAC_X1000, AGI_CHARGE_DEFAULT_A_FRAC_X1000)
    sprites.setDataNumber(hero, HERO_DATA.AGI_B_FRAC_X1000, AGI_CHARGE_DEFAULT_B_FRAC_X1000)
    sprites.setDataNumber(hero, HERO_DATA.AGI_C_FRAC_X1000, AGI_CHARGE_DEFAULT_C_FRAC_X1000)

    sprites.setDataNumber(hero, HERO_DATA.AGI_EXECUTE_SEQ, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_ADD_AMOUNT, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_STORED_HITS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAND_BUFFER_MS, AGI_LANDING_BUFFER_MS)

    sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, 0)

    // -------------------------------------------------
    // CHANGED (not removed): FAMILY now uses fam (override-capable)
    // -------------------------------------------------
    sprites.setDataNumber(hero, HERO_DATA.FAMILY, fam)

    // -------------------------------------------------
    // NEW: seed hero identity strings so Phaser can resolve LPC animations
    // and ALSO set your requested HERO_DATA.Name = "name"
    // -------------------------------------------------
    let profileName = profileNameOverride

    // If caller didn't override, keep your existing profile resolution
    if (!profileName) {
        profileName = getHeroProfileForHeroIndex(heroIndex)
    }

    // If this is the shopkeeper pid and no override was given, force it
    if (!profileNameOverride && pid === SHOPKEEPER_PLAYER_ID) {
        profileName = SHOPKEEPER_PROFILE_NAME
    }

    // Your requested canonical name field
    sprites.setDataString(hero, HERO_DATA.Name, profileName)

    // Keep legacy keys too (don’t delete them; Phaser glue may still read them)
    sprites.setDataString(hero, "heroName", profileName)
    sprites.setDataString(hero, "heroFamily", heroFamilyNumberToString(fam))

    // NEW (Step 4): seed weapon loadout onto sprite.data (primitives only; net-safe)
    // This runs once per hero and will not overwrite later drops/equips.
    ensureHeroWeaponLoadoutSeeded(hero, profileName, fam)

    sprites.setDataString(hero, HERO_DATA.BUTTON, "")
    sprites.setDataNumber(hero, HERO_DATA.TRAIT1, 25)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT2, 25)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT3, 25)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT4, 25)

    // NEW: initialize mirrored engine-side fields
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.MOVE_SPEED_MULT, 1)
    sprites.setDataNumber(hero, HERO_DATA.DAMAGE_AMP_MULT, 1)
    sprites.setDataString(hero, HERO_DATA.BUFF_JSON, "[]")

    // Weapon display offsets (pixels)
//    HERO_WPN_OFF_X: "wpnOffX",
//    HERO_WPN_OFF_Y: "wpnOffY",

    sprites.setDataNumber(hero, HERO_DATA.HERO_WPN_OFF_X, 0)
    sprites.setDataString(hero, HERO_DATA.HERO_WPN_OFF_Y, 0)

    sprites.setDataNumber(hero, HERO_DATA.WEAPON_ALWAYS_SHOW, 1)

    heroTargetCircles[heroIndex] = null

    initHeroHP(heroIndex, hero, 1000)
    initHeroMana(heroIndex, hero, 2000)
    refreshHeroController(heroIndex)

        // -------------------------------------------------
    // SHOPKEEPER POC: force a tiny downward "kick" on spawn
    // so we can prove the render + facing pipeline is live.
    // -------------------------------------------------
    if (playerId === SHOPKEEPER_PLAYER_ID) {
        // Face DOWN immediately (then publish dir data)
        heroFacingX[heroIndex] = 0
        heroFacingY[heroIndex] = 1
        syncHeroDirData(heroIndex)

        // Tiny physical nudge downward
        const kickVy = 20
        const kickMs = 120
        const kickStart = nowMs

        hero.vx = 0
        hero.vy = kickVy

        // If anything reads STORED_* (locks), keep it consistent
        sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
        sprites.setDataNumber(hero, HERO_DATA.STORED_VY, kickVy)

        // One-shot stop
        const now = game.runtime() | 0
        worldRuntimeMs = now

        game.onUpdate(function () {
            // Safety: sprite might be gone
            if (!hero || (hero.flags & sprites.Flag.Destroyed)) return

            const t = game.runtime() | 0
            if ((t - kickStart) >= kickMs) {
                hero.vx = 0
                hero.vy = 0
                sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
                sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            }
        })
    }

    // -------------------------------------------------
    // SHOPKEEPER: force identity for Phaser pipeline
    // -------------------------------------------------
    if ((playerId | 0) === 99) {
        // This is the key Phaser glue reads (NOT HERO_DATA.Name)
        sprites.setDataString(hero, "heroName", "Shopkeeper")
        sprites.setDataString(hero, "heroFamily", "base") // matches your sheet classification

        // Optional: give it a readable label too (your engine-side name field)
        // (Use whatever key you actually defined: HERO_DATA.Name is "name")
        sprites.setDataString(hero, HERO_DATA.Name, "Shopkeeper")

        // Force initial facing DOWN using your existing facing arrays path
        // (down = dy=+1)
        heroFacingX[heroes.length - 1] = 0
        heroFacingY[heroes.length - 1] = 1
        syncHeroDirData(heroes.length - 1)

        // No input, no movement
        sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, true)
        hero.vx = 0
        hero.vy = 0

        console.log(
            `>>> [SHOPKEEPER][ENGINE] created p=99 id=${(hero as any).id ?? "?"}` +
            ` heroName=${sprites.readDataString(hero, "heroName")}` +
            ` heroFamily=${sprites.readDataString(hero, "heroFamily")}` +
            ` dir=${sprites.readDataString(hero, "dir")}`
        )
    }


    // NEW: let the student animation hook define what this hero actually looks like
    // "idle" here is your base/default state; 0 duration so it's just an image set
    callHeroAnim(heroIndex, "idle", 0)
}


function setupHeroes() {

    // 1) Start from ARCADE screen center as a safe default.
    // In MakeCode Arcade, this gives you the 320×240-ish center.
    // In Phaser compat, ARCADE_SCREEN_* mirrors screen.width/height from arcadeCompat.
    let W = userconfig.ARCADE_SCREEN_WIDTH;
    let H = userconfig.ARCADE_SCREEN_HEIGHT;

    // 2) If we have a full world tilemap, override with WORLD size in pixels.
    if (_engineWorldTileMap && _engineWorldTileMap.length > 0 && _engineWorldTileMap[0].length > 0) {
        const rows = _engineWorldTileMap.length;
        const cols = _engineWorldTileMap[0].length;

        W = cols * WORLD_TILE_SIZE;
        H = rows * WORLD_TILE_SIZE;

        console.log(
            "[setupHeroes] using WORLD center from tilemap",
            { rows, cols, tileSize: WORLD_TILE_SIZE, W, H }
        );
    } else {
        console.log(
            "[setupHeroes] using SCREEN center (no world tilemap yet)",
            { W, H }
        );
    }

    const centerW = W / 2;
    const centerH = H / 2;

    // You can nudge this however you like
    const offset = 40;

    const coords: number[][] = [
        [centerW + offset, centerH + offset],
        [centerW - offset, centerH + offset],
        [centerW + offset, centerH - offset],
        [centerW - offset, centerH - offset]
    ];

    // ------------------------------------------------------------
    // STEP 6: Phaser runtime spawn-on-demand
    // - Phaser host starts with ONLY Player 1.
    // - Players 2..4 are spawned later (on-demand) when they actually act/join.
    // - MakeCode Arcade runtime keeps the original 4-player behavior.
    // TODO_NPLAYER_BRIDGE: later we’ll remove 4-player assumptions entirely.
    // ------------------------------------------------------------
    if (isPhaserRuntime()) {
        console.log("[setupHeroes] Phaser runtime: spawning ONLY Player 1 (spawn-on-demand enabled)");
        createHeroForPlayer(1, coords[0][0], coords[0][1]);
        return;
    }

    // MakeCode Arcade behavior (unchanged)
    createHeroForPlayer(1, coords[0][0], coords[0][1]);
    createHeroForPlayer(2, coords[1][0], coords[1][1]);
    createHeroForPlayer(3, coords[2][0], coords[2][1]);
    createHeroForPlayer(4, coords[3][0], coords[3][1]);
}


function lockHeroControls(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, true)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VX, hero.vx)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VY, hero.vy)
    refreshHeroController(heroIndex)
}

function unlockHeroControls(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, false)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
    hero.vx = 0; hero.vy = 0
    refreshHeroController(heroIndex)
}


function refreshHeroController(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const playerId = sprites.readDataNumber(hero, HERO_DATA.OWNER)
    const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)

    const baseSpeed = 50
    const hasteMult = heroMoveSpeedMult[heroIndex] || 1
    const speed = locked ? 0 : baseSpeed * hasteMult

    if (playerId == 1) controller.player1.moveSprite(hero, speed, speed)
    else if (playerId == 2) controller.player2.moveSprite(hero, speed, speed)
    else if (playerId == 3) controller.player3.moveSprite(hero, speed, speed)
    else if (playerId == 4) controller.player4.moveSprite(hero, speed, speed)
}



function refreshHeroControllerBUGGED(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const playerId = sprites.readDataNumber(hero, HERO_DATA.OWNER)
    const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)

    const baseSpeed = 50
    const mult = heroMoveSpeedMult[heroIndex] || 1
    const speed = locked ? 0 : baseSpeed * mult

    const vx = speed
    const vy = speed
    if (playerId == 1) controller.player1.moveSprite(hero, vx, vy)
    else if (playerId == 2) controller.player2.moveSprite(hero, vx, vy)
    else if (playerId == 3) controller.player3.moveSprite(hero, vx, vy)
    else if (playerId == 4) controller.player4.moveSprite(hero, vx, vy)
}


function getHeroDirectionName(heroIndex: number) {
    const dx = heroFacingX[heroIndex] || 0, dy = heroFacingY[heroIndex] || 0
    if (dy < 0) return "up"; if (dy > 0) return "down"; if (dx < 0) return "left"; return "right"
}


// Mirror direction into hero data so Phaser can see it.
function syncHeroDirData(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const dir = getHeroDirectionName(heroIndex)
    sprites.setDataString(hero, "dir", dir)
    sprites.setDataString(hero, HERO_DATA.DIR, dir)
}

// AUTHORITATIVE AMBIENT PHASE WRITER (SINGLE-WRITER)
// Owns: ambient phase changes (idle/run/combatIdle/etc.).
// Only stamps PhaseStartMs when phase actually changes.
// MUST NOT increment ActionSequence or emit events.
// AUTHORITATIVE PHASE WRITER (SINGLE-WRITER)
// Unified contract:
// - PhaseName is authoritative for rendering (always mirrors what we should render).
// - Legacy HERO_DATA.PHASE remains as a mirror for compatibility.
// This function MUST NOT increment ActionSequence or emit events.
function setHeroPhaseString(heroIndex: number, phase: string, where: string = ""): void {
    const hero = heroes[heroIndex]
    if (!hero) return

    const p = phase || "idle"

    // PhaseName is authoritative for rendering.
    const prevPhaseName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""

    // Always mirror legacy phase fields (compat)
    sprites.setDataString(hero, "phase", p)
    sprites.setDataString(hero, HERO_DATA.PHASE, p)

    // Optional: keep PhaseRaw mirrored too if you still use it anywhere for debugging/legacy
    sprites.setDataString(hero, HERO_DATA.PhaseRaw, p)

    // If PhaseName already matches, do not reset the window.
    if (prevPhaseName === p) return

    const nowMs = game.runtime() | 0

    sprites.setDataString(hero, HERO_DATA.PhaseName, p)
    sprites.setDataNumber(hero, HERO_DATA.PhaseStartMs, nowMs)

    // Duration is authored by the move code / ambient stamper,
    // so reset here and let the caller stamp a real value.
    sprites.setDataNumber(hero, HERO_DATA.PhaseDurationMs, 0)

    // Reset progress to 0 at phase start
    sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, 0)

    // ---- LOG: phase edge (ownership change) ----
    if (DEBUG_ANIM_KEYS_PHASE_EDGE) {
        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED) ? 1 : 0
        const ctrl = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL) ? 1 : 0
        const strCh = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING) ? 1 : 0
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const fco = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
        const w = where ? where : "?"
        _dbgAnimKeys(heroIndex, hero, "PHASE_EDGE",
            `t=${nowMs} where=${w} ${prevPhaseName}->${p} lock{busyUntil=${busyUntil} locked=${locked} ctrl=${ctrl} strCh=${strCh} agi=${agiState} fco=${fco}}`
        )
    }
}


function clearHeroFrameColOverride(heroIndex: number): void {
    const hero = heroes[heroIndex]; if (!hero) return
    const prev = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
    if (prev === HERO_FRAME_COL_OVERRIDE_NONE) return

    sprites.setDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE, HERO_FRAME_COL_OVERRIDE_NONE)

    if (DEBUG_INTEGRATOR) {
        const phase = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
        const dir = sprites.readDataString(hero, HERO_DATA.DIR) || ""
        const strCharging = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)
        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        console.log("[WPN-FCO-CLEAR]", { heroIndex, prev, v: HERO_FRAME_COL_OVERRIDE_NONE, phase, dir, strCharging, agiState, locked, busyUntil, t: (game.runtime() | 0) })
    }
}



function getHeroBusyUntil(heroIndex: number): number {
    const hero = heroes[heroIndex]; if (!hero) return 0
    const v = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
    heroBusyUntil[heroIndex] = v
    return v
}

function setHeroBusyUntil(heroIndex: number, untilMs: number): void {
    const hero = heroes[heroIndex]; if (!hero) return
    const v = untilMs | 0
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, v)
    heroBusyUntil[heroIndex] = v
}

function clearHeroBusyUntil(heroIndex: number): void {
    setHeroBusyUntil(heroIndex, 0)
}

function _updateHeroLocomotionPhaseWindow(heroIndex: number, hero: Sprite, now: number): void {
    if (!hero) return

    // If an action phase window is currently active, locomotion must NOT overwrite it.
    const phStart = (sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0)
    const phDur = (sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0)
    if (phStart > 0 && phDur > 0 && (now | 0) < ((phStart + phDur) | 0)) return

    // If you're otherwise "busy" by your gates, also don't stomp phases.
    const busyUntil0 = heroBusyUntil[heroIndex] || 0
    if (busyUntil0 > 0 && (now | 0) < (busyUntil0 | 0)) return
    if (sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) return
    if (supportPuzzleActive[heroIndex]) return
    if (sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    const vx = hero.vx || 0
    const vy = hero.vy || 0
    const vSq = (vx * vx) + (vy * vy)

    let nextPhase = "idle"
    let nextDur = HERO_LOCO_IDLE_LOOP_MS | 0

    if (vSq > 0) {
        if (vSq >= (HERO_LOCO_RUN_VEL_SQ_THRESHOLD | 0)) {
            nextPhase = "run"
            nextDur = HERO_LOCO_RUN_LOOP_MS | 0
        } else {
            nextPhase = "walk"
            nextDur = HERO_LOCO_WALK_LOOP_MS | 0
        }
    }

    const curPhase = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
    if (curPhase === nextPhase) return

    sprites.setDataString(hero, HERO_DATA.PhaseName, nextPhase)

    // Stamp a real phase window for the renderer (do NOT use 0 duration).
    _animKeys_stampPhaseWindow(
        heroIndex,
        hero,
        nextPhase,
        now | 0,
        nextDur | 0,
        "_updateHeroLocomotionPhaseWindow"
    )

    if (DEBUG_ANIM_KEYS) console.log(_dbgAnimKeysLine(heroIndex, hero, "LOCO_PHASE"))
}


function updateHeroFacingsFromVelocity() {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        // ------------------------------------------------------------
        // Shopkeeper (Player 99): seed facing DOWN once, then keep it.
        // This fixes “spawns up” without touching createHeroForPlayer.
        // ------------------------------------------------------------
        const ownerId0 = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        if (ownerId0 === SHOPKEEPER_PLAYER_ID) {
            const seeded = sprites.readDataBoolean(hero, "shopFaceSeeded")
            if (!seeded) {
                heroFacingX[i] = 0
                heroFacingY[i] = 1
                syncHeroDirData(i)
                sprites.setDataBoolean(hero, "shopFaceSeeded", true)
            }
            continue
        }

        const state = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)

        // NEW: In Agility build mode, read D-pad to update facing (aim),
        // but do NOT use it to change velocity.
        if (locked && state === AGI_STATE.ARMED) {
            const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
            const ctrl = getControllerForOwnerId(ownerId)
            if (ctrl) {
                let dx = 0, dy = 0
                if (ctrl.left.isPressed()) dx = -1
                else if (ctrl.right.isPressed()) dx = 1
                if (ctrl.up.isPressed()) dy = -1
                else if (ctrl.down.isPressed()) dy = 1

                if (dx !== 0 || dy !== 0) {
                    heroFacingX[i] = dx
                    heroFacingY[i] = dy
                    syncHeroDirData(i)
                }
            }
            continue
        }

        // Normal behavior: facing follows velocity
        const vx = hero.vx, vy = hero.vy
        if (vx == 0 && vy == 0) continue

        let dx = 0, dy = 0
        if (vx > 0) dx = 1; else if (vx < 0) dx = -1
        if (vy > 0) dy = 1; else if (vy < 0) dy = -1

        if (dx != 0 || dy != 0) {
            heroFacingX[i] = dx; heroFacingY[i] = dy
            syncHeroDirData(i)
        }
    }
}


// READ-ONLY FOR UNIVERSAL TIMELINE KEYS (FINAL DESIGN)
// callHeroAnim() is ONLY an animation request/hook runner.
// It must NOT publish Action/Phase/Event keys.
// (Currently it still calls publishHeroActionPhase; this will be removed in Step 3.)
function callHeroAnim(heroIndex: number, animKey: string, timeMs: number) {
    const hero = heroes[heroIndex]; if (!hero) return

    // READ-ONLY FOR UNIVERSAL TIMELINE KEYS (Action/Phase/Event/Part/RenderStyle)
    // callHeroAnim() is ONLY an animation request/hook runner.
    // Timeline keys are authored by:
    //  - _doHeroMoveBeginActionTimeline() (Action edge)
    //  - _doHeroMovePlayAnimAndDispatch() (Phase window stamp)
    //  - move timing loops (PhaseProgress / PhasePart)
    //  - event emitters (EventSequence pulses)

    const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY) | 0

    // Existing visual effect behavior (kept exactly)
    if (family == FAMILY.STRENGTH || family == FAMILY.INTELLECT || family == FAMILY.HEAL) {
        hero.startEffect(effects.trail, timeMs)
    }

    const direction = getHeroDirectionName(heroIndex)
    const playerId = sprites.readDataNumber(hero, HERO_DATA.OWNER)

    if (playerId == 1) HeroEngine.animateHero1Hook(hero, animKey, timeMs, direction)
    else if (playerId == 2) HeroEngine.animateHero2Hook(hero, animKey, timeMs, direction)
    else if (playerId == 3) HeroEngine.animateHero3Hook(hero, animKey, timeMs, direction)
    else if (playerId == 4) HeroEngine.animateHero4Hook(hero, animKey, timeMs, direction)
}

type AgilityPressResult = {
    agiZoneMult: number
    agiStateBefore: number
    agiChainAfter: number
    agiIsArmedThisPress: boolean
    agiDoExecuteThisPress: boolean
}

// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
//Do hero move is its own section at this point. This is the function for stating what the hero should be doing

function _doHeroMoveShouldIgnoreDueToBusy(heroIndex: number, hero: Sprite, now: number): boolean {
    // --------------------------------------------------------------------
    // IMPORTANT: busyUntil gating must NOT block ARMED build presses after landing,
    // otherwise the meter is visible but presses are ignored.
    // We can only know "meter is active" from hero state + dashUntil.
    // --------------------------------------------------------------------
    const state0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0)
    const dashUntil0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0)
    const inAgiBuildAfterLanding0 =
        (state0 === AGI_STATE.ARMED) && (dashUntil0 <= 0 || now >= dashUntil0)

    const busyUntil0 = heroBusyUntil[heroIndex] || 0

    if (!inAgiBuildAfterLanding0 && busyUntil0 > 0 && now < busyUntil0) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && _dbgMoveCurrentPlayerId === 1) {
            const chain0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_CHAIN) | 0)
            const lastPress0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS) | 0)
            const meterStart0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0)
            const dtBusy = busyUntil0 - now
            const dtDash = dashUntil0 - now
            console.log(
                DEBUG_FILTER_PHRASE +
                " BUSY_BLOCK timeMs=" + now +
                " heroIndex=" + heroIndex +
                " busyUntil=" + busyUntil0 +
                " dtBusy=" + dtBusy +
                " agiState=" + state0 +
                " agiChain=" + chain0 +
                " lastPressMs=" + lastPress0 +
                " meterStartMs=" + meterStart0 +
                " dashUntil=" + dashUntil0 +
                " dtDash=" + dtDash +
                " inBuildAfterLanding=" + (inAgiBuildAfterLanding0 ? 1 : 0)
            )
        }
        return true
    }

    return false
}



function _doHeroMoveCallLogicHook(heroIndex: number, button: string): any[] | null {
    const hook = HeroEngine.runHeroLogicForHeroHook || runHeroLogicForHero

    try {
        const out = hook(heroIndex, button)
        return out
    } catch (e) {
        console.log(
            "[doHeroMoveForPlayer] ERROR calling hook heroIndex=" + heroIndex +
            " button=" + button +
            " error=" + e
        )
        return null
    }
}

function _doHeroMoveValidateHookOut(heroIndex: number, button: string, out: any[] | null): out is any[] {
    if (!out || out.length < 7) {
        console.log(
            "[MOVE] heroIndex=" + heroIndex +
            " button=" + button +
            " INVALID OUT=" + (out ? "[" + out.join(",") + "]" : "null")
        )
        return false
    }
    return true
}

function _doHeroMoveParseHookOut(out: any[]): {
    family: number
    t1: number
    t2: number
    t3: number
    t4: number
    element: number
    traits: number[]
    animKey: string
} {
    const family = coerceFamily(out[0])
    const t1 = out[1] | 0
    const t2 = out[2] | 0
    const t3 = out[3] | 0
    const t4 = out[4] | 0
    const element = coerceElement(out[5])

    const traits = [0, t1, t2, t3, t4, element]

    let animKey: string
    const rawAnim = out[6]
    if (typeof rawAnim === "string") animKey = rawAnim
    else animKey = animIdToKey(rawAnim | 0)

    return { family, t1, t2, t3, t4, element, traits, animKey }
}

function _doHeroMoveApplyBaseHeroMoveData(
    hero: Sprite,
    family: number,
    button: string,
    t1: number,
    t2: number,
    t3: number,
    t4: number
): void {
    sprites.setDataNumber(hero, HERO_DATA.FAMILY, family)
    sprites.setDataString(hero, "heroFamily", heroFamilyNumberToString(family))

    sprites.setDataString(hero, HERO_DATA.BUTTON, button)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT1, t1)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT2, t2)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT3, t3)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT4, t4)
}



// AUTHORITATIVE ACTION EDGE PUBLISHER (SINGLE-WRITER)
// Owns: ActionSequence increment + ActionKind/Variant/Seed/P0..P3/TargetId (initial publish).
// MUST be called only after we have truly committed to a real move instance.
// Nobody else may increment ActionSequence.
function _doHeroMoveBeginActionTimeline(
    heroIndex: number,
    hero: Sprite,
    family: number,
    button: string,
    t1: number,
    t2: number,
    t3: number,
    t4: number,
    element: number,
    now: number
): void {
    // AUTHORITATIVE ACTION EDGE PUBLISHER (SINGLE-WRITER)
    // Owns: ActionSequence increment + initial ActionKind/Variant/Seed/P0..P3/TargetId
    // + RenderStyleMask (cosmetic, stable for action instance).

    const nowMs = now | 0

    const actionSeq0 = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
    sprites.setDataNumber(hero, HERO_DATA.ActionSequence, (actionSeq0 + 1) | 0)

    // Default semantic action kind (execute refines elsewhere)
    let kind = "none"
    if (family === FAMILY.STRENGTH) kind = "strength_charge"
    else if (family === FAMILY.AGILITY) kind = "agility_thrust"
    else if (family === FAMILY.INTELLECT) kind = "intellect_cast"
    else if (family === FAMILY.HEAL) kind = "support_cast"
    else kind = heroFamilyNumberToString(family)

    sprites.setDataString(hero, HERO_DATA.ActionKind, kind)

    const btnId = encodeIntentToStrBtnId(button) | 0
    sprites.setDataNumber(hero, HERO_DATA.ActionVariant, btnId)

    // Deterministic seed (no Math.random)
    const seed = (nowMs ^ ((heroIndex + 1) * 1103515245)) | 0
    sprites.setDataNumber(hero, HERO_DATA.ActionSeed, seed)

    // Param bus: traits axes
    sprites.setDataNumber(hero, HERO_DATA.ActionP0, t1 | 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP1, t2 | 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP2, t3 | 0)
    sprites.setDataNumber(hero, HERO_DATA.ActionP3, t4 | 0)

    sprites.setDataNumber(hero, HERO_DATA.ActionTargetId, 0)

    // Allowed action-edge hygiene
    _animKeys_actionBeginHygiene(hero)

    // RenderStyle authored once at action begin (stable for action instance)
    const styleMask = _elemToRenderStyleMask(element | 0)
    _animKeys_setRenderStyle(hero, styleMask, 0, 0)

    _animInvCheckHeroTimeline(heroIndex, hero, nowMs | 0, "_doHeroMoveBeginActionTimeline(end)")

    if (DEBUG_ANIM_KEYS) console.log(_dbgAnimKeysLine(heroIndex, hero, "ACTION_EDGE"))

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && _dbgMoveCurrentPlayerId === 1) {
        const aSeq1 = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0
        console.log(
            DEBUG_FILTER_PHRASE +
            " ACTION_EDGE heroIndex=" + heroIndex +
            " actionSeq=" + aSeq1 +
            " kind=" + kind +
            " variantBtnId=" + btnId +
            " seed=" + seed +
            " elem=" + (element | 0) +
            " styleMask=" + styleMask
        )
    }
}




function _doHeroMoveUpdateAgilityComboState(
    heroIndex: number,
    hero: Sprite,
    now: number,
    family: number
): AgilityPressResult {
    // NOTE: "agiZoneMult" is now reused as "pendingAddAmount" for v4 wiring.
    // We keep the variable name so we don't churn call signatures in this step.
    let agiZoneMult = -1
    let agiDoExecuteThisPress = false

    const agiStateBefore = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
    const comboMode0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_MODE) | 0

    // ------------------------------------------------------------
    // NEW (Agility combo v3): Non-agility move cancels combo mode,
    // but we still proceed to perform the other move.
    // ------------------------------------------------------------
    if (family != FAMILY.AGILITY) {
        const chain0 = sprites.readDataNumber(hero, HERO_DATA.AGI_CHAIN) | 0
        const meterStart0 = sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0

        if (comboMode0 || agiStateBefore !== AGI_STATE.NONE || chain0 !== 0 || meterStart0 !== 0) {
            cancelAgilityComboNow(heroIndex, hero)
        }

        return {
            agiZoneMult,
            agiStateBefore,
            agiChainAfter: 0,
            agiIsArmedThisPress: false,
            agiDoExecuteThisPress
        }
    }

    // ------------------------------------------------------------
    // Agility press: We DO NOT arm via chain anymore.
    // Chain is kept only as a debug counter (optional).
    // ------------------------------------------------------------
    const lastMs0 = sprites.readDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS) | 0
    let chain0 = sprites.readDataNumber(hero, HERO_DATA.AGI_CHAIN) | 0

    if (lastMs0 > 0) {
        const gap = (now | 0) - lastMs0
        if (gap > AGI_CHAIN_MAX_GAP_MS) {
            chain0 = 0
        }
    }

    const agiChainAfter = (chain0 + 1) | 0
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHAIN, agiChainAfter)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS, now | 0)

    const agiIsArmedThisPress = (agiStateBefore === AGI_STATE.ARMED)

    // --------------------------------------------------------------------
    // v4: While ARMED, use engine-published window state:
    // - AGI_IS_EXEC_WINDOW determines execute selection (sheen window)
    // - AGI_PENDING_ADD is the exact ghost count / pending add amount
    // --------------------------------------------------------------------
    if (agiIsArmedThisPress) {
        const isExecW = (sprites.readDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW) | 0) ? 1 : 0
        const pendingAdd = sprites.readDataNumber(hero, HERO_DATA.AGI_PENDING_ADD) | 0

        agiZoneMult = pendingAdd | 0
        if (isExecW) agiDoExecuteThisPress = true

        // Defensive fallback (should not happen once v4 publisher is always running):
        // If pendingAdd is 0 and we're not in EXEC, fall back to old zone multiplier.
        if (!agiDoExecuteThisPress && agiZoneMult <= 0) {
            const legacyZ = agiMeterZoneMultiplier(hero, now) | 0
            agiZoneMult = legacyZ | 0
            if (legacyZ === 0) agiDoExecuteThisPress = true
        }
    }

    return {
        agiZoneMult,
        agiStateBefore,
        agiChainAfter,
        agiIsArmedThisPress,
        agiDoExecuteThisPress
    }
}




function _doHeroMoveTrySpendMana(
    heroIndex: number,
    hero: Sprite,
    family: number,
    t1: number,
    t2: number,
    t3: number,
    t4: number
): boolean {
    // Mana (skip Strength)
    if (family == FAMILY.STRENGTH) return true

    let manaCost = t1 + t2 + t3 + t4
    if (manaCost < 0) manaCost = 0

    let mana = sprites.readDataNumber(hero, HERO_DATA.MANA)
    if (mana < manaCost) {
        flashHeroManaBar(heroIndex)
        return false
    }

    mana -= manaCost
    sprites.setDataNumber(hero, HERO_DATA.MANA, mana)
    updateHeroManaBar(heroIndex)
    if (manaCost > 0) showDamageNumber(hero.x, hero.y - 10, -manaCost, "mana")

    return true
}


function agiEmitExecuteEvent(hero: Sprite, lastAddAmount: number): void {
    const seq0 = sprites.readDataNumber(hero, HERO_DATA.AGI_EXECUTE_SEQ) | 0
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXECUTE_SEQ, (seq0 + 1) | 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_ADD_AMOUNT, lastAddAmount | 0)
}




function _doHeroMoveTryAgilityExecuteThisPress(
    heroIndex: number,
    hero: Sprite,
    family: number,
    button: string,
    t1: number,
    t2: number,
    t3: number,
    t4: number,
    element: number,
    stats: number[],
    animKey: string,
    agiDoExecuteThisPress: boolean,
    now: number
): boolean {

    if (family != FAMILY.AGILITY) return false
    if (!agiDoExecuteThisPress) return false

    // ------------------------------------------------------------
    // ACTION EDGE (authoritative): this execute is a new move instance.
    // Must happen here because execute returns early and bypasses the
    // normal action-edge call in doHeroMoveForPlayer.
    // ------------------------------------------------------------
    _doHeroMoveBeginActionTimeline(
        heroIndex,
        hero,
        family,
        button,
        t1 | 0,
        t2 | 0,
        t3 | 0,
        t4 | 0,
        element | 0,
        now | 0
    )
    sprites.setDataString(hero, HERO_DATA.ActionKind, "agility_execute")
    if (DEBUG_ANIM_KEYS) _dbgAnimKeys(heroIndex, hero, "KIND_REFINE", `t=${(now|0)} kind=agility_execute`)

    // ------------------------------------------------------------

    // Hygiene: clear any leftover lunge schedule so thrust parts don't fight execute.
    sprites.setDataNumber(hero, HERO_DATA.AgilityLungeStartMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.AgilityLungeEndMs, 0)
    sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirX1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirY1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.AgilityLungeSpeed, 0)

    // ------------------------------------------------------------
    // Execute radius comes from Trait2 (Reach)
    // ------------------------------------------------------------
    const reach = Math.max(0, t2 | 0)
    let execRadius = 40 + reach * 2
    if (execRadius < 40) execRadius = 40
    if (execRadius > 220) execRadius = 220

    const slowPct = stats[STAT.SLOW_PCT] | 0
    const slowDurMs = stats[STAT.SLOW_DURATION] | 0

    // v4: Emit the execute event (for Phaser sheen/collapse logic).
    // In EXEC window there are no ghosts; lastAddAmount is 0.
    agiEmitExecuteEvent(hero, 0)

    // Immediately disarm v4 charge keys so Phaser doesn't display stale charge state until next tick.
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, 0)

    destroyAgiAimIndicator(heroIndex)
    agiBeginExecute(heroIndex, hero, execRadius, slowPct, slowDurMs)

    // If execute couldn't start (no packets), agiBeginExecute already cleaned up.
    const stateNow = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
    if (stateNow !== AGI_STATE.EXECUTING) return true

    // Compute authoritative execute duration from packets + interval.
    const arr0 = agiPacketsEnsure(heroIndex)
    const steps0 = (arr0 ? (arr0.length | 0) : 0) | 0

    const interval0 = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_INTERVAL_MS) | 0
    const dtBase = (interval0 > 0 ? interval0 : (AGI_EXEC_STEP_MS | 0)) | 0
    const dt = Math.max(dtBase, (AGI_EXEC_STEP_MS_MIN | 0)) | 0

    // Total window: last beat happens at start+(steps-1)*dt, so choose ((steps-1)*dt + 1)
    const stepsSafe = Math.max(1, steps0) | 0
    const totalDur = Math.max(1, (((stepsSafe - 1) | 0) * dt + 1) | 0) | 0

    // Use "slash" family for execute (semantic contract).
    // IMPORTANT: setHeroPhaseString resets the window to duration=0, so do it BEFORE stamping.
    setHeroPhaseString(heroIndex, "slash")

    // Stamp the phase window here (execute bypasses _doHeroMovePlayAnimAndDispatch)
    _animKeys_stampPhaseWindow(
        heroIndex,
        hero,
        "slash",
        now | 0,
        totalDur | 0,
        "_doHeroMoveTryAgilityExecuteThisPress"
    )

    // Seed an initial part window; updateAgilityExecuteAll will keep it updated.
    _animKeys_setPhasePart(hero, "beat", now | 0, dt | 0, now | 0)

    // Busy gate must block other presses while executing.
    setHeroBusyUntil(heroIndex, (now + totalDur) | 0)

    // callHeroAnim is read-only for universal timeline keys
    callHeroAnim(heroIndex, animKey, totalDur)

    return true
}

function _doHeroMoveTryAgilityBuildAfterLanding(
    heroIndex: number,
    hero: Sprite,
    now: number,
    family: number,
    t1: number,
    animKey: string,
    agiChainAfter: number,
    agiZoneMult: number,
    agiIsArmedThisPress: boolean
): boolean {
    // Only applicable for agility presses.
    if (family !== FAMILY.AGILITY) return false

    // NEW (Agility combo v3): build/commit only while combo-mode is ON.
    const comboMode0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_MODE) | 0
    if (!comboMode0) return false

    // Must be ARMED (meter is up) and landed.
    const state0 = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
    if (state0 !== AGI_STATE.ARMED || !agiIsArmedThisPress) return false

    const dashUntil0 = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
    const landed = (dashUntil0 <= 0) || ((now | 0) >= dashUntil0)
    if (!landed) return false

    // v4: do not build while in EXEC window (sheen).
    // Execute path should have returned earlier.
    const isExecW0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW) | 0) ? 1 : 0
    if (isExecW0) {
        if (DEBUG_AGI_COMBO_BUILD) {
            console.log(`[agi.combo.build] UNEXPECTED execWindow=1 hero=${heroIndex} now=${now} dashUntil=${dashUntil0}`)
        }

        // Universal contract:
        // Do NOT write illegal 0-duration phase windows here.
        // This is an unexpected path; just consume so we don't dash with no selection.
        return true // consume so we don't accidentally dash with no selection
    }

    // v4: pending add amount is authoritative. We reuse agiZoneMult as the carried pendingAdd,
    // but allow a defensive read from HERO_DATA if it came through as "unknown".
    let z = agiZoneMult | 0
    if (z < 0) z = (sprites.readDataNumber(hero, HERO_DATA.AGI_PENDING_ADD) | 0)

    // If invalid, do nothing but disarm (so the press still dashes).
    if (z <= 0) {
        if (DEBUG_AGI_COMBO_BUILD) {
            console.log(`[agi.combo.build] cancel z=${z} hero=${heroIndex} now=${now} dashUntil=${dashUntil0}`)
        }

        // Disarm meter but keep combo mode ON.
        sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
        sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

        // v4: immediately disarm published charge keys (prevents 1-frame stale visuals in Phaser)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, 0)

        // Clear cancel bookkeeping
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

        // Allow dash path to proceed
        unlockHeroControls(heroIndex)
        return false
    }

    // ------------------------------------------------------------
    // Commit: append EXACTLY z hits into the stored-hits packet bank.
    // v4: z is the pending add amount from the time schedule (A/B/C tier values).
    // ------------------------------------------------------------
    const dmg = t1 | 0
    agiPacketsAppend(heroIndex, hero, dmg, z)

    // v4: Emit execute event so Phaser can collapse ghosts and streak z times into the counter.
    agiEmitExecuteEvent(hero, z)

    // v4: keep AGI_STORED_HITS authoritative + up-to-date immediately
    const storedHitsNow = sprites.readDataNumber(hero, HERO_DATA.AGI_PKT_COUNT) | 0
    sprites.setDataNumber(hero, HERO_DATA.AGI_STORED_HITS, storedHitsNow)

    if (DEBUG_AGI_COMBO_BUILD) {
        console.log(`[agi.combo.build] commit hero=${heroIndex} z=${z} dmg=${dmg} now=${now} dashUntil=${dashUntil0}`)
    }

    // Disarm meter for this dash; combo mode stays ON.
    sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

    // v4: immediately disarm published charge keys (prevents 1-frame stale visuals in Phaser)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, 0)

    // Clear cancel bookkeeping
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

    // Clear busy and unlock so the dash path can apply velocity/lock cleanly this same press.
    clearHeroBusyUntil(heroIndex)
    unlockHeroControls(heroIndex)

    // Return false => doHeroMoveForPlayer continues into dash path on this same press.
    return false
}



function _doHeroMoveComputeAimUnit(heroIndex: number): [number, number] {
    const aim = getAimVectorForHero(heroIndex)
    let ax = aim[0], ay = aim[1]
    if (ax == 0 && ay == 0) { ax = 1; ay = 0 }
    const mag = Math.sqrt(ax * ax + ay * ay) || 1
    ax /= mag; ay /= mag
    return [ax, ay]
}

function _doHeroMoveComputeLungeSpeedCapped(heroIndex: number, stats: number[]): number {
    const hasteMult = heroMoveSpeedMult[heroIndex] || 1
    const baseLunge = stats[STAT.LUNGE_SPEED] | 0
    const rawLunge = baseLunge * hasteMult
    const lungeCapped = Math.max(0, Math.min(rawLunge, 500))
    return lungeCapped
}

function _doHeroMoveApplyDashVelocity(hero: Sprite, family: number, ax: number, ay: number, lungeCapped: number): void {
    if (family == FAMILY.AGILITY) {
        hero.vx = ax * lungeCapped
        hero.vy = ay * lungeCapped
    } else {
        hero.vx = 0
        hero.vy = 0
    }
}

function _doHeroMoveSetPhaseFromFamily(heroIndex: number, family: number): void {
    if (family == FAMILY.STRENGTH) setHeroPhaseString(heroIndex, "slash")
    else if (family == FAMILY.AGILITY) setHeroPhaseString(heroIndex, "thrust")
    else if (family == FAMILY.INTELLECT) setHeroPhaseString(heroIndex, "cast")
    else if (family == FAMILY.HEAL) setHeroPhaseString(heroIndex, "cast")
}



function _doHeroMoveApplyControlLockAndBusy(
    heroIndex: number,
    hero: Sprite,
    family: number,
    now: number,
    moveDuration: number
): void {
    if (family == FAMILY.AGILITY || family == FAMILY.INTELLECT) {
        lockHeroControls(heroIndex)

        const durMs = moveDuration | 0
        const unlockAt = (now + durMs) | 0

        setHeroBusyUntil(heroIndex, unlockAt)

        // NOTE:
        // Do NOT stamp PhaseDurationMs here.
        // callHeroAnim() publishes PhaseStartMs/PhaseDurationMs for the action instance.
    } else if (family == FAMILY.HEAL) {
        hero.vx = 0
        hero.vy = 0
    }
}



function _doHeroMoveApplyAgilityDashTimers(
    heroIndex: number,
    hero: Sprite,
    family: number,
    now: number,
    moveDuration: number,
    stats: number[]
): void {
    if (family == FAMILY.AGILITY) {
        const landBufferMs = stats[STAT.AGILITY_LAND_BUFFER_MS] || AGI_LANDING_BUFFER_MS
        sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, now + moveDuration + landBufferMs)
        sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL, 0)
    } else {
        sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL, 0)
    }
}


// AUTHORITATIVE ACTION PHASE-WINDOW STAMP (SINGLE-WRITER)
// Owns: PhaseName/PhaseStartMs/PhaseDurationMs/PhaseProgressInt reset at action start,
// even when the coarse phase repeats ("slash" -> "slash").
// MUST NOT touch ActionSequence (action edge is handled elsewhere).
function _doHeroMovePlayAnimAndDispatch(
    heroIndex: number,
    hero: Sprite,
    family: number,
    button: string,
    traits: number[],
    stats: number[],
    animKey: string,
    now: number,
    t3: number
): void {
    let animDuration = stats[STAT.MOVE_DURATION] | 0
    if (animDuration <= 0) animDuration = 1

    // Strength path still wants a duration even if it gets special handling downstream.
    if (family == FAMILY.STRENGTH) {
        animDuration = strengthChargeMaxMsFromTrait3(t3) | 0
        if (animDuration <= 0) animDuration = 1
    }

    // Unified contract: PhaseName is authoritative for rendering/stamping.
    // Do NOT consult legacy HERO_DATA.PHASE here.
    let phaseName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""

    // Defensive fallback (should be unreachable once Steps 1–2 are in place)
    if (!phaseName) {
        if (family == FAMILY.STRENGTH) phaseName = "slash"
        else if (family == FAMILY.AGILITY) phaseName = "thrust"
        else if (family == FAMILY.INTELLECT) phaseName = "cast"
        else if (family == FAMILY.HEAL) phaseName = "cast"
        else phaseName = "idle"

        // Also make PhaseName consistent immediately.
        sprites.setDataString(hero, HERO_DATA.PhaseName, phaseName)
    }

    // AUTHORITATIVE PHASE-WINDOW STAMP (per move instance)
    _animKeys_stampPhaseWindow(
        heroIndex,
        hero,
        phaseName,
        now | 0,
        animDuration | 0,
        "_doHeroMovePlayAnimAndDispatch"
    )

    if (DEBUG_ANIM_KEYS) console.log(_dbgAnimKeysLine(heroIndex, hero, "PHASE_WINDOW"))

    // callHeroAnim is read-only for universal timeline keys
    callHeroAnim(heroIndex, animKey, animDuration)

    if (family == FAMILY.STRENGTH) { executeStrengthMove(heroIndex, hero, button, traits, stats, animKey); return }
    if (family == FAMILY.AGILITY)  { executeAgilityMove(heroIndex, hero, button, traits, stats); return }
    if (family == FAMILY.INTELLECT){ executeIntellectMove(heroIndex, hero, button, traits, stats, now); return }
    if (family == FAMILY.HEAL)     { executeHealMove(heroIndex, hero, button, traits, stats, now); return }
}



function doHeroMoveForPlayer(playerId: number, button: string) {

    // ------------------------------------------------------------
    // STEP 6: Phaser runtime spawn-on-demand
    // ------------------------------------------------------------
    let heroIndex = playerToHeroIndex[playerId]

    if ((heroIndex == null || heroIndex < 0 || heroIndex >= heroes.length) && isPhaserRuntime()) {
        if (playerId >= 1 && playerId <= 4) {

            let W = userconfig.ARCADE_SCREEN_WIDTH;
            let H = userconfig.ARCADE_SCREEN_HEIGHT;

            if (_engineWorldTileMap && _engineWorldTileMap.length > 0 && _engineWorldTileMap[0].length > 0) {
                const rows = _engineWorldTileMap.length;
                const cols = _engineWorldTileMap[0].length;
                W = cols * WORLD_TILE_SIZE;
                H = rows * WORLD_TILE_SIZE;
            }

            const centerW = W / 2;
            const centerH = H / 2;
            const offset = 40;

            const coords: number[][] = [
                [centerW + offset, centerH + offset],
                [centerW - offset, centerH + offset],
                [centerW + offset, centerH - offset],
                [centerW - offset, centerH - offset]
            ];

            const slotIndex = playerId - 1;
            console.log("[doHeroMoveForPlayer] Phaser spawn-on-demand: creating hero for playerId =", playerId);
            createHeroForPlayer(playerId, coords[slotIndex][0], coords[slotIndex][1]);

            heroIndex = playerToHeroIndex[playerId]
        }
    }

    if (heroIndex < 0 || heroIndex >= heroes.length) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE badHeroIndex playerId=" + playerId + " heroIndex=" + heroIndex + " button=" + button)
        }
        return
    }

    const hero = heroes[heroIndex]
    if (!hero) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE heroNull playerId=" + playerId + " heroIndex=" + heroIndex + " button=" + button)
        }
        return
    }

    const now = game.runtime()
    worldRuntimeMs = now

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
        _dbgMoveCurrentPlayerId = playerId

        const busyUntil0 = heroBusyUntil[heroIndex] || 0
        const state0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0)
        const chain0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_CHAIN) | 0)
        const dashUntil0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0)
        const lastPress0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS) | 0)
        const meterStart0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0)
        const dtBusy0 = busyUntil0 - (now | 0)
        const dtDash0 = dashUntil0 - (now | 0)

        console.log(
            DEBUG_FILTER_PHRASE +
            " ENTER doHeroMove timeMs=" + now +
            " button=" + button +
            " heroIndex=" + heroIndex +
            " busyUntil=" + busyUntil0 +
            " dtBusy=" + dtBusy0 +
            " agiState=" + state0 +
            " agiChain=" + chain0 +
            " dashUntil=" + dashUntil0 +
            " dtDash=" + dtDash0 +
            " lastPressMs=" + lastPress0 +
            " meterStartMs=" + meterStart0 +
            " vx=" + hero.vx +
            " vy=" + hero.vy
        )
    }

    if (_doHeroMoveShouldIgnoreDueToBusy(heroIndex, hero, now)) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            const busyUntil0 = heroBusyUntil[heroIndex] || 0
            const state0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0)
            const dashUntil0 = (sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0)
            console.log(
                DEBUG_FILTER_PHRASE +
                " IGNORE busyGate timeMs=" + now +
                " button=" + button +
                " heroIndex=" + heroIndex +
                " busyUntil=" + busyUntil0 +
                " agiState=" + state0 +
                " dashUntil=" + dashUntil0
            )
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    if (sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE controllingSpell timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }
    if (supportPuzzleActive[heroIndex]) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE supportPuzzleActive timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }
    if (sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE strCharging timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    const out = _doHeroMoveCallLogicHook(heroIndex, button)
    if (!out) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE hookNull timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }
    if (!_doHeroMoveValidateHookOut(heroIndex, button, out)) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE invalidOut timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    const parsed = _doHeroMoveParseHookOut(out)
    const family = parsed.family
    const t1 = parsed.t1
    const t2 = parsed.t2
    const t3 = parsed.t3
    const t4 = parsed.t4
    const element = parsed.element
    const traits = parsed.traits
    const animKey = parsed.animKey

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
        console.log(
            DEBUG_FILTER_PHRASE +
            " OUT timeMs=" + now +
            " button=" + button +
            " family=" + family +
            " t1=" + t1 +
            " t2=" + t2 +
            " t3=" + t3 +
            " t4=" + t4 +
            " elem=" + (element | 0) +
            " animKey=" + animKey
        )
    }

    _doHeroMoveApplyBaseHeroMoveData(hero, family, button, t1, t2, t3, t4)

    const agi = _doHeroMoveUpdateAgilityComboState(heroIndex, hero, now, family)

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
        const state1 = (sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0)
        const chain1 = (sprites.readDataNumber(hero, HERO_DATA.AGI_CHAIN) | 0)
        const dashUntil1 = (sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0)
        console.log(
            DEBUG_FILTER_PHRASE +
            " AGI_STATE timeMs=" + now +
            " stateNow=" + state1 +
            " chainNow=" + chain1 +
            " dashUntil=" + dashUntil1 +
            " zoneMult=" + agi.agiZoneMult +
            " stateBefore=" + agi.agiStateBefore +
            " chainAfter=" + agi.agiChainAfter +
            " armedThisPress=" + (agi.agiIsArmedThisPress ? 1 : 0) +
            " doExecuteThisPress=" + (agi.agiDoExecuteThisPress ? 1 : 0)
        )
    }

    const traitsEff = applyDamageModsToTraits(heroIndex, family, traits)
    
    const stats = calculateMoveStatsForFamily(family, button, traitsEff)


    if (family === FAMILY.STRENGTH) {
        executeStrengthMove(heroIndex, hero, button, traits, stats, animKey)

        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    if (!_doHeroMoveTrySpendMana(heroIndex, hero, family, t1, t2, t3, t4)) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " IGNORE noMana timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex + " family=" + family)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    if (_doHeroMoveTryAgilityExecuteThisPress(
        heroIndex,
        hero,
        family,
        button,
        t1,
        t2,
        t3,
        t4,
        element | 0,
        stats,
        animKey,
        agi.agiDoExecuteThisPress,
        now
    )) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " PATH execute timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    if (_doHeroMoveTryAgilityBuildAfterLanding(
        heroIndex,
        hero,
        now,
        family,
        t1,
        animKey,
        agi.agiChainAfter,
        agi.agiZoneMult,
        agi.agiIsArmedThisPress
    )) {
        if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
            console.log(DEBUG_FILTER_PHRASE + " PATH build timeMs=" + now + " button=" + button + " heroIndex=" + heroIndex)
            _dbgMoveCurrentPlayerId = 0
        }
        return
    }

    _doHeroMoveBeginActionTimeline(heroIndex, hero, family, button, t1, t2, t3, t4, element | 0, now)

    const [ax, ay] = _doHeroMoveComputeAimUnit(heroIndex)
    const lungeCapped = _doHeroMoveComputeLungeSpeedCapped(heroIndex, stats)

    const moveDuration = stats[STAT.MOVE_DURATION] | 0

    if (family === FAMILY.AGILITY) {
        const [windMs, fwdMs, _landMs] = splitAgiThrustDurations(moveDuration)

        const startMs = (now + windMs) | 0
        const endMs = (startMs + fwdMs) | 0

        sprites.setDataNumber(hero, HERO_DATA.AgilityLungeStartMs, startMs)
        sprites.setDataNumber(hero, HERO_DATA.AgilityLungeEndMs, endMs)
        sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirX1000, Math.round(ax * 1000) | 0)
        sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirY1000, Math.round(ay * 1000) | 0)
        sprites.setDataNumber(hero, HERO_DATA.AgilityLungeSpeed, lungeCapped | 0)

        hero.vx = 0
        hero.vy = 0
    } else {
        _doHeroMoveApplyDashVelocity(hero, family, ax, ay, lungeCapped)
    }

    const [_, fwdMs2, __] = (family === FAMILY.AGILITY) ? splitAgiThrustDurations(moveDuration) : [0, moveDuration, 0]
    const L_exec = Math.idiv(lungeCapped * (fwdMs2 | 0), 1000)
    sprites.setDataNumber(hero, "AGI_L_EXEC", L_exec)

    _doHeroMoveSetPhaseFromFamily(heroIndex, family)
    _doHeroMoveApplyControlLockAndBusy(heroIndex, hero, family, now, moveDuration)
    _doHeroMoveApplyAgilityDashTimers(heroIndex, hero, family, now, moveDuration, stats)

    if (family === FAMILY.AGILITY) {
        const btnId = encodeIntentToStrBtnId(button) | 0
        sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAST_AGI_BTN, btnId)

        const comboMode0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_MODE) | 0
        if (!comboMode0) {
            const dashUntilNew = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
            if (dashUntilNew > 0) {
                sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, btnId)
                sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, dashUntilNew)
            }
        }
    }

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
        const busyUntil1 = heroBusyUntil[heroIndex] || 0
        const dashUntil1 = (sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0)
        console.log(
            DEBUG_FILTER_PHRASE +
            " PATH dash timeMs=" + now +
            " button=" + button +
            " heroIndex=" + heroIndex +
            " family=" + family +
            " moveDuration=" + moveDuration +
            " lunge=" + lungeCapped +
            " busyUntil=" + busyUntil1 +
            " dashUntil=" + dashUntil1 +
            " vx=" + hero.vx +
            " vy=" + hero.vy
        )
    }

    _doHeroMovePlayAnimAndDispatch(heroIndex, hero, family, button, traits, stats, animKey, now, t3)

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS && playerId === 1) {
        _dbgMoveCurrentPlayerId = 0
    }
}



// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥

// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥

// ================================================================
// SECTION 5 - HERO STATS AND UI
// ================================================================
// HP, Mana, Combo, Aura visuals. 
// Owns bar creation + update per frame.

const STATUS_KIND_STRENGTH_CHARGE = StatusBarKind.create()



function ensureStrengthChargeBar(heroIndex: number, hero: Sprite): StatusBarSprite {
    let bar = heroStrengthChargeBars[heroIndex]
    if (bar) return bar

    bar = statusbars.create(20, 4, STATUS_KIND_STRENGTH_CHARGE)
    bar.attachToSprite(hero)
    bar.positionDirection(CollisionDirection.Bottom)

    // Arcade assumes a 16x16 sprite; Phaser uses the real 64x64 silhouette.
    // So we push the bar DOWN much further in Phaser only.
    if (isMakeCodeArcadeRuntime()) {
        // Tuned for Arcade's fake 16x16 anchor
        bar.setOffsetPadding(0, 2)
    } else {
        // Phaser: small, sane padding under the real sprite
        bar.setOffsetPadding(0, 25)
    }

    bar.max = 100
    bar.value = 0
    bar.setColor(2, 1, 3)

    bar.setFlag(SpriteFlag.Invisible, true)
    heroStrengthChargeBars[heroIndex] = bar
    return bar
}





function setStrengthChargeBarPct(heroIndex: number, hero: Sprite, pct0to100: number): void {
    const bar = ensureStrengthChargeBar(heroIndex, hero)
    const pct = Math.max(0, Math.min(100, pct0to100 | 0))
    bar.value = pct
}

function showStrengthChargeBar(heroIndex: number, hero: Sprite, show: boolean): void {
    const bar = ensureStrengthChargeBar(heroIndex, hero)
    bar.setFlag(SpriteFlag.Invisible, !show)
}



function initHeroHP(heroIndex: number, hero: Sprite, maxHPVal: number) {
    sprites.setDataNumber(hero, HERO_DATA.MAX_HP, maxHPVal)
    sprites.setDataNumber(hero, HERO_DATA.HP, maxHPVal)
    const bar = statusbars.create(20, 4, StatusBarKind.Health)
    bar.attachToSprite(hero)
    //bar.setOffsetPadding(0, 2)


    // Arcade assumes a 16x16 sprite; Phaser uses the real 64x64 silhouette.
    // So we push the bar DOWN much further in Arcade only.
    if (isMakeCodeArcadeRuntime()) {
        // Tuned for Arcade's fake 16x16 anchor
        bar.setOffsetPadding(0, 2)
    } else {
        // Phaser: LARGE padding to actually get above the real sprite
        bar.setOffsetPadding(0, 20)
    }

    bar.max = 100; bar.value = 100
    heroHPBars[heroIndex] = bar
}

function updateHeroHPBar(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const bar = heroHPBars[heroIndex]; if (!bar) return
    const hp = sprites.readDataNumber(hero, HERO_DATA.HP)
    let maxHp = sprites.readDataNumber(hero, HERO_DATA.MAX_HP); if (maxHp <= 0) maxHp = 1
    bar.value = Math.max(0, Math.min(100, Math.idiv(hp * 100, maxHp)))
}


function initHeroMana(heroIndex: number, hero: Sprite, maxManaVal: number) {
    sprites.setDataNumber(hero, HERO_DATA.MAX_MANA, maxManaVal)
    sprites.setDataNumber(hero, HERO_DATA.MANA, maxManaVal)
    const bar = statusbars.create(20, 4, StatusBarKind.Energy)
    bar.attachToSprite(hero)
    //bar.setOffsetPadding(0, 1)


    // Arcade assumes a 16x16 sprite; Phaser uses the real 64x64 silhouette.
    // So we push the bar DOWN much further in Arcade only.
    if (isMakeCodeArcadeRuntime()) {
        // Tuned for Arcade's fake 16x16 anchor
        bar.setOffsetPadding(0, 1)
    } else {
        // Phaser: LARGE padding on top of the real sprite
        bar.setOffsetPadding(0, 15)
    }

    bar.max = 100; bar.value = 100; bar.setColor(9, 1)
    heroManaBars[heroIndex] = bar
}


function updateHeroManaBar(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const bar = heroManaBars[heroIndex]; if (!bar) return
    const mana = sprites.readDataNumber(hero, HERO_DATA.MANA)
    let maxMana = sprites.readDataNumber(hero, HERO_DATA.MAX_MANA); if (maxMana <= 0) maxMana = 1
    bar.value = Math.max(0, Math.min(100, Math.idiv(mana * 100, maxMana)))
    bar.setColor(9, 1)
}

function flashHeroManaBar(heroIndex: number) {
    const bar = heroManaBars[heroIndex]; if (!bar) return
    bar.setColor(2, 1)
}




function applyDamageToHeroIndex(heroIndex: number, amount: number) {
    const hero = heroes[heroIndex]; if (!hero) return;

    let hp = sprites.readDataNumber(hero, HERO_DATA.HP);
    hp = Math.max(0, hp - amount);
    sprites.setDataNumber(hero, HERO_DATA.HP, hp);
    updateHeroHPBar(heroIndex);
    flashHeroOnDamage(hero);

    if (hp > 0) return;

    // Already processed death for this hero? Don't double-trigger.
    if (sprites.readDataBoolean(hero, HERO_DATA.IS_DEAD)) {
        return;
    }

    const now = Math.max(1, game.runtime() | 0);

    // ------------------------------------------------------------
    // Unified PhaseName contract: death is a real render phase window.
    // Also treat it as a new "action edge" (system-driven).
    // ------------------------------------------------------------
    const aSeq0 = sprites.readDataNumber(hero, HERO_DATA.ActionSequence) | 0;
    sprites.setDataNumber(hero, HERO_DATA.ActionSequence, ((aSeq0 <= 0 ? 1 : aSeq0) + 1) | 0);
    sprites.setDataString(hero, HERO_DATA.ActionKind, "death");

    // Clear any move-segmentation and one-shot pulses so "death" is clean.
    _animKeys_clearPhasePart(hero);
    _animEvent_clear(hero);

    // Set PhaseName (authoritative) + mirror legacy, then stamp a real window.
    setHeroPhaseString(heroIndex, "death");

    // Mark hero as dead and set a "death animation" window
    sprites.setDataBoolean(hero, HERO_DATA.IS_DEAD, true);
    const deathUntil = (now + (HERO_DEATH_ANIM_MS | 0)) | 0;
    sprites.setDataNumber(hero, HERO_DATA.DEATH_UNTIL, deathUntil);

    // Lock controls and stop movement while dying
    hero.vx = 0;
    hero.vy = 0;

    heroBusyUntil[heroIndex] = deathUntil;
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, deathUntil);
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, true);

    // Stamp the authoritative render window for death (non-zero duration).
    _animKeys_stampPhaseWindow(heroIndex, hero, "death", now, (HERO_DEATH_ANIM_MS | 0), "applyDamageToHeroIndex(death)");

    // Fire a "death" animation request.
    // In Arcade, defaultHeroAnim is a harmless stub.
    // In Phaser, heroAnimGlue / phaser glue will interpret this as "play LPC death".
    callHeroAnim(heroIndex, "death", HERO_DEATH_ANIM_MS);
}






function flashHeroOnDamage(hero: Sprite) {
    const flashDuration = 150, flashInterval = 50
    const start = game.runtime()
    game.onUpdate(function () {
        const elapsed = game.runtime() - start
        if (elapsed >= flashDuration) { hero.setFlag(SpriteFlag.Invisible, false); return }
        const phase = Math.idiv(elapsed, flashInterval)
        hero.setFlag(SpriteFlag.Invisible, phase % 2 == 0)
    })
}

function regenHeroManaAll(percentOfMax: number) {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue
        const maxM = sprites.readDataNumber(hero, HERO_DATA.MAX_MANA); if (maxM <= 0) continue
        let mana = sprites.readDataNumber(hero, HERO_DATA.MANA)
        let gain = Math.idiv(maxM * percentOfMax, 100)
        if (gain < 1 && mana < maxM) gain = 1
        mana = Math.min(maxM, mana + gain)
        sprites.setDataNumber(hero, HERO_DATA.MANA, mana)
        updateHeroManaBar(i)
    }
}


function showDamageNumber(x: number, y: number, amount: number, kind?: string) {
    let k = (kind || "damage").toLowerCase()

    // Choose foreground color (text color) per kind
    // Tuned for the usual Arcade palette:
    // 2 = red, 6 = green, 9 = dark blue
    let fg = 2 // damage = red
    if (k.indexOf("heal") >= 0) {
        fg = 6 // heal = green
    } else if (k.indexOf("mana") >= 0) {
        fg = 9 // mana = blue
    }

    // bg = 0 (black), fg = chosen color
    const txt = textsprite.create("" + amount, 0, fg)
    txt.setMaxFontHeight(9)        // a bit larger than before
    txt.setBorder(0, 0, 0)         // no extra border box
    txt.setOutline(1, 15)          // thin black outline around the colored text

    txt.setPosition(x, y)
    txt.lifespan = 900             // was 400 → more than double time on screen
    txt.vy = -12                   // slower rise so it's readable
}



function createAuraImageFromHero(hero: Sprite, color: number): Image {
    const base = hero.image;
    const w = base.width;
    const h = base.height;

    // Output is same size as hero image.
    const aura = image.create(w, h);

    // How far out the aura should extend from the sprite's solid pixels.
    // 2 → roughly "2 pixels wider" halo.
    const MAX_RADIUS = 2;

    // For every transparent pixel, check if it's within MAX_RADIUS of any solid pixel.
    // If so, draw aura there. This creates a halo around the hero's silhouette without
    // filling inside the sprite.
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // Only draw aura in originally transparent pixels
            if (base.getPixel(x, y) != 0) continue;

            let nearSolid = false;

            for (let dy = -MAX_RADIUS; dy <= MAX_RADIUS && !nearSolid; dy++) {
                for (let dx = -MAX_RADIUS; dx <= MAX_RADIUS && !nearSolid; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    const xx = x + dx;
                    const yy = y + dy;
                    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;

                    if (base.getPixel(xx, yy) != 0) {
                        nearSolid = true;
                    }
                }
            }

            if (nearSolid) {
                aura.setPixel(x, y, color);
            }
        }
    }

    return aura;
}



function ensureHeroAuraSprite(heroIndex: number): Sprite {
    let aura = heroAuras[heroIndex]
    const hero = heroes[heroIndex]; if (!hero) return null
    if (!aura) {
        aura = sprites.create(image.create(hero.image.width, hero.image.height), SpriteKind.HeroAura)
        heroAuras[heroIndex] = aura
    }
    aura.z = hero.z + 1
    return aura
}



function agiPendulumPeriodMsForHero(hero: Sprite): number {
    // Mirror the existing C6 pendulum-speed logic used by agiMeterPosX1000()
    let period = AGI_METER_PERIOD_MS | 0

    if (AGI_TIME_AFFECTS_PENDULUM) {
        const tTime = sprites.readDataNumber(hero, HERO_DATA.TRAIT3) | 0
        period = 1200 + Math.max(0, tTime) * 10
        if (period < 400) period = 400
        if (period > 4000) period = 4000
    }

    return period | 0
}


function agiResolveHalfCyclePosX1000(nowMs: number, startMs: number, periodMs: number): number {
    const now = nowMs | 0
    const start = startMs | 0
    let per = periodMs | 0
    if (per <= 0) per = 1

    let dt = (now - start) | 0
    if (dt < 0) dt = 0

    // t in [0..per-1]
    const t = (dt % per) | 0

    // mirror into half-cycle
    let halfPer = (per >> 1) | 0
    if (halfPer <= 0) halfPer = 1

    const halfT = (t >= halfPer) ? ((per - t) | 0) : t

    // 0..1000 inclusive
    const posX1000 = Math.idiv((halfT * 1000) | 0, halfPer) | 0
    if (posX1000 < 0) return 0
    if (posX1000 > 1000) return 1000
    return posX1000
}


function agiResolveWindowAndPendingAdd(hero: Sprite, nowMs: number): { pendingAdd: number, isExec: number } {
    const startMs = sprites.readDataNumber(hero, HERO_DATA.AGI_START_MS) | 0
    const periodMs = sprites.readDataNumber(hero, HERO_DATA.AGI_PERIOD_MS) | 0

    // Half-cycle position 0..1000
    const halfPosX1000 = agiResolveHalfCyclePosX1000(nowMs, startMs, periodMs)

    // Window lengths are expressed as "full-cycle X1000 fractions" whose half-cycle sum is 500.
    // Convert to half-cycle X1000 by doubling (sum becomes 1000).
    let exF = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_FRAC_X1000) | 0
    let aF  = sprites.readDataNumber(hero, HERO_DATA.AGI_A_FRAC_X1000) | 0
    let bF  = sprites.readDataNumber(hero, HERO_DATA.AGI_B_FRAC_X1000) | 0
    let cF  = sprites.readDataNumber(hero, HERO_DATA.AGI_C_FRAC_X1000) | 0

    const sum = (exF + aF + bF + cF) | 0
    if (exF <= 0 || aF <= 0 || bF <= 0 || cF <= 0 || sum !== 500) {
        // fall back to defaults (Step 2 already seeds, this is just belt+suspenders)
        exF = AGI_CHARGE_DEFAULT_EXEC_FRAC_X1000
        aF  = AGI_CHARGE_DEFAULT_A_FRAC_X1000
        bF  = AGI_CHARGE_DEFAULT_B_FRAC_X1000
        cF  = AGI_CHARGE_DEFAULT_C_FRAC_X1000
    }

    const exLen = (exF << 1) | 0
    const aLen  = (aF << 1) | 0
    const bLen  = (bF << 1) | 0

    // Boundaries cover [0..1000]; C is the remainder window.
    let b0 = exLen
    let b1 = (b0 + aLen) | 0
    let b2 = (b1 + bLen) | 0

    // Clamp boundaries defensively
    if (b0 < 0) b0 = 0
    if (b1 < b0) b1 = b0
    if (b2 < b1) b2 = b1
    if (b2 > 1000) b2 = 1000
    if (b1 > 1000) b1 = 1000
    if (b0 > 1000) b0 = 1000

    // Tier values
    const tA = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_A_ADD) | 0
    const tB = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_B_ADD) | 0
    const tC = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_C_ADD) | 0

    // Resolve window for this half-cycle position
    if (halfPosX1000 < b0) {
        return { pendingAdd: 0, isExec: 1 }
    }
    if (halfPosX1000 < b1) {
        return { pendingAdd: (tA > 0 ? tA : 0), isExec: 0 }
    }
    if (halfPosX1000 < b2) {
        return { pendingAdd: (tB > 0 ? tB : 0), isExec: 0 }
    }
    return { pendingAdd: (tC > 0 ? tC : 0), isExec: 0 }
}



function updateAgiChargeV4PublishedKeys(nowMs: number): void {
    const now = nowMs | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        // Charge is "relevant" in v2/v3 terms when ARMED and landed (same visibility rule as meter/aim)
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
        const landed = (dashUntil === 0) || (now >= dashUntil)
        const chargeActive = (agiState === AGI_STATE.ARMED) && landed

        // Always publish period + defaults so Phaser has stable values even if it reads early
        const periodMs = agiPendulumPeriodMsForHero(hero)
        sprites.setDataNumber(hero, HERO_DATA.AGI_PERIOD_MS, periodMs)

        // Land buffer mirrors calculateAgilityStats() logic (Trait3 -> vuln window) for later use
        let landBuf = AGI_LANDING_BUFFER_MS | 0
        if (AGI_TIME_AFFECTS_VULN) {
            const tTime = sprites.readDataNumber(hero, HERO_DATA.TRAIT3) | 0
            landBuf = (AGI_LANDING_BUFFER_MS + Math.max(0, tTime) * 2) | 0
        }
        sprites.setDataNumber(hero, HERO_DATA.AGI_LAND_BUFFER_MS, landBuf)

        // Seed tier values if missing/invalid
        let tA = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_A_ADD) | 0
        let tB = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_B_ADD) | 0
        let tC = sprites.readDataNumber(hero, HERO_DATA.AGI_TIER_C_ADD) | 0
        if (tA <= 0 || tB <= 0 || tC <= 0) {
            tA = AGI_CHARGE_DEFAULT_TIER_A_ADD
            tB = AGI_CHARGE_DEFAULT_TIER_B_ADD
            tC = AGI_CHARGE_DEFAULT_TIER_C_ADD
            sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_A_ADD, tA)
            sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_B_ADD, tB)
            sprites.setDataNumber(hero, HERO_DATA.AGI_TIER_C_ADD, tC)
        }

        // Seed schedule fractions if missing/invalid OR sum != 500
        let exF = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_FRAC_X1000) | 0
        let aF = sprites.readDataNumber(hero, HERO_DATA.AGI_A_FRAC_X1000) | 0
        let bF = sprites.readDataNumber(hero, HERO_DATA.AGI_B_FRAC_X1000) | 0
        let cF = sprites.readDataNumber(hero, HERO_DATA.AGI_C_FRAC_X1000) | 0

        const sum = (exF + aF + bF + cF) | 0
        if (exF <= 0 || aF <= 0 || bF <= 0 || cF <= 0 || sum !== 500) {
            exF = AGI_CHARGE_DEFAULT_EXEC_FRAC_X1000
            aF = AGI_CHARGE_DEFAULT_A_FRAC_X1000
            bF = AGI_CHARGE_DEFAULT_B_FRAC_X1000
            cF = AGI_CHARGE_DEFAULT_C_FRAC_X1000
            sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_FRAC_X1000, exF)
            sprites.setDataNumber(hero, HERO_DATA.AGI_A_FRAC_X1000, aF)
            sprites.setDataNumber(hero, HERO_DATA.AGI_B_FRAC_X1000, bF)
            sprites.setDataNumber(hero, HERO_DATA.AGI_C_FRAC_X1000, cF)
        }

        // Stored hits contract: keep separate from ghosts; for now mirror existing packets count
        const storedHits = sprites.readDataNumber(hero, HERO_DATA.AGI_PKT_COUNT) | 0
        sprites.setDataNumber(hero, HERO_DATA.AGI_STORED_HITS, storedHits)

        if (!chargeActive) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, 0)

            // v4 convenience publishes (inactive)
            sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, 0)
            continue
        }

        // Active charge: publish start time aligned with existing meter start
        let startMs = sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0
        if (startMs <= 0) {
            startMs = now
            sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, startMs)
        }

        sprites.setDataNumber(hero, HERO_DATA.AGI_CHARGE_ACTIVE, 1)
        sprites.setDataNumber(hero, HERO_DATA.AGI_START_MS, startMs)

        // Resolve current window -> pending add amount + exec window flag (engine-authoritative)
        const res = agiResolveWindowAndPendingAdd(hero, now)
        sprites.setDataNumber(hero, HERO_DATA.AGI_PENDING_ADD, res.pendingAdd | 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW, res.isExec | 0)
    }
}



// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 4) Hook into your existing update + startup
// Add this call inside your existing updateHeroOverlays() (or right after it in game.onUpdate):
//    updateShopUi(now)

//
// Example:
// function updateHeroOverlays() {
//     const now = game.runtime() | 0
//     const phaser = isPhaserRuntime()
//     updateAgiChargeV4PublishedKeys(now)
//     updateHeroAuras(now, phaser)
//     updateHeroAimIndicators(now, phaser)
//     updateHeroMeters(now, phaser)
//     updateShopUi(now)   // <-- ADD THIS
// }
//
// And call these ONCE during startup (after heroes exist / setupHeroes runs):
//    installShopInputHandlers()
//    spawnShopNpcBox( (userconfig.ARCADE_SCREEN_WIDTH>>1), (userconfig.ARCADE_SCREEN_HEIGHT>>1) + 30, 1 )


function updateHeroOverlays() {
    const now = game.runtime() | 0
    const phaser = isPhaserRuntime()

    // NEW (v4): publish weapon-as-meter contract keys (engine-side authoritative data)
    updateAgiChargeV4PublishedKeys(now)

    updateHeroAuras(now, phaser)
    updateHeroAimIndicators(now, phaser)
    updateHeroMeters(now, phaser)
    updateShopUi(now)   // <-- ADD THIS

}




function updateHeroAimIndicators(now: number, phaser: boolean) {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        const ind = ensureAgiAimIndicator(i)
        if (!ind) continue

        // Show only in Agility ARMED state after landing (not during dash)
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0

        const show = (agiState === AGI_STATE.ARMED) && (dashUntil === 0 || now >= dashUntil)

        setAgiAimIndicatorVisible(i, show)

        _dbgAgiAimLog(i, now, "state=" + agiState + " dashUntil=" + dashUntil + " show=" + (show ? 1 : 0))

        if (!show) continue

        const aim = computeHeroAimForIndicator(i, hero)

        // Publish direction
        sprites.setDataNumber(ind, UI_AIM_DIR_X1000_KEY, aim.dx1000 | 0)
        sprites.setDataNumber(ind, UI_AIM_DIR_Y1000_KEY, aim.dy1000 | 0)

        // ------------------------------------------------------------
        // Leading edge distance: MUST be silhouette/oval-based in Phaser
        // Use the same hook-backed visual info pipeline as Strength.
        // ------------------------------------------------------------
        let edgeDist = 0
        let edgeSrc = "none"

        {
            const vis = getHeroVisualInfoForStrength(hero, aim.nx, aim.ny)
            if (vis && vis.length > 1) {
                edgeDist = (vis[1] | 0) // leadEdge
                if (edgeDist > 0) edgeSrc = "visHook"
            }
        }

        // Arcade fallback (or safety fallback if hook fails)
        if (edgeDist <= 0) {
            edgeDist = findHeroLeadingEdgeDistance(hero, aim.nx, aim.ny) | 0
            if (edgeDist > 0) edgeSrc = "scan"
        }

        // Final safety fallback: push to ~half-width
        if (edgeDist <= 0) {
            edgeDist = ((hero.width | 0) > 0) ? ((hero.width | 0) >> 1) : 16
            edgeSrc = "halfW"
        }

        // Side tuning
        const absNx = Math.abs(aim.nx)
        const sideWeight = absNx * absNx
        edgeDist = Math.max(0, edgeDist - Math.round(AGI_AIM_SIDE_EDGE_SHRINK_PX * sideWeight))
        const inset = Math.round(AGI_AIM_SIDE_INSET_PX * sideWeight)

        const tailDx = Math.round(aim.nx * Math.max(0, edgeDist - inset))
        const tailDy = Math.round(aim.ny * Math.max(0, edgeDist))

        // Stretch + shake while holding cancel
        let len = AGI_AIM_INDICATOR_LEN
        const cancelHoldMs = sprites.readDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS) | 0
        if (cancelHoldMs > 0) {
            const t = Math.max(0, Math.min(1, cancelHoldMs / AGI_CANCEL_HOLD_THRESHOLD_MS))
            len += Math.round(AGI_BREAK_STRETCH_PX * t)

            const amp = Math.round(AGI_BREAK_SHAKE_PX * t)
            if (amp > 0) {
                const phase = now * 0.05
                const j = Math.round(Math.sin(phase) * amp)
                const px = -aim.ny
                const py = aim.nx
                ind.x = hero.x + tailDx + AGI_AIM_INDICATOR_OX + Math.round(px * j)
                ind.y = hero.y + tailDy + AGI_AIM_INDICATOR_OY + Math.round(py * j)
            } else {
                ind.x = hero.x + tailDx + AGI_AIM_INDICATOR_OX
                ind.y = hero.y + tailDy + AGI_AIM_INDICATOR_OY
            }
        } else {
            ind.x = hero.x + tailDx + AGI_AIM_INDICATOR_OX
            ind.y = hero.y + tailDy + AGI_AIM_INDICATOR_OY
        }

        // Safety: NaN guard (this is the “disappears silently” killer)
        if (!isFinite(ind.x as any) || !isFinite(ind.y as any)) {
            _dbgAgiAimLog(i, now,
                "ERROR NaN pos: ind=(" + ind.x + "," + ind.y + ") hero=(" + hero.x + "," + hero.y + ") nx=" + aim.nx + " ny=" + aim.ny + " edgeDist=" + edgeDist + " src=" + edgeSrc
            )
            ind.x = hero.x
            ind.y = hero.y
        }

        sprites.setDataNumber(ind, UI_AIM_LEN_KEY, len | 0)

        // Angle for phaser arrow if needed
        const ang = Math.atan2(aim.ny, aim.nx)
        sprites.setDataNumber(ind, UI_AIM_ANGLE_MDEG_KEY, Math.round(ang * 180000 / Math.PI))

        _dbgAgiAimLog(
            i,
            now,
            "visKey=" + (sprites.readDataNumber(ind, UI_AIM_VISIBLE_KEY) | 0) +
            " dir=(" + (sprites.readDataNumber(ind, UI_AIM_DIR_X1000_KEY) | 0) + "," + (sprites.readDataNumber(ind, UI_AIM_DIR_Y1000_KEY) | 0) + ")" +
            " len=" + (sprites.readDataNumber(ind, UI_AIM_LEN_KEY) | 0) +
            " pos=(" + ind.x + "," + ind.y + ")" +
            " edgeDist=" + edgeDist +
            " src=" + edgeSrc
        )
    }
}





function updateHeroMeters(now: number, phaser: boolean) {
    // Arcade-only fallback: compact pips (pending add amount) + optional EXEC sparkle.
    function drawAgiPipsImage(pendingAdd: number, isExecWindow: boolean): Image {
        const pipW = 2
        const pipH = 2
        const gap = 1
        const pad = 1
        const maxPips = 8

        let n = pendingAdd | 0
        if (n < 0) n = 0
        if (n > maxPips) n = maxPips

        const wInner = (n > 0) ? ((n * pipW) + ((n - 1) * gap)) : 4
        const w = (wInner + pad * 2) | 0
        const h = 6

        const img = image.create(w, h)
        img.fill(0)

        // Border
        img.drawRect(0, 0, w, h, 1)

        // Pips
        let x = pad
        const y = 2
        for (let i = 0; i < n; i++) {
            img.fillRect(x, y, pipW, pipH, 7)
            x += pipW + gap
        }

        // EXEC sparkle (tiny cross)
        if (isExecWindow) {
            const cx = (w >> 1) | 0
            const cy = (h >> 1) | 0
            img.setPixel(cx, cy, 5)
            if (cx - 1 >= 0) img.setPixel(cx - 1, cy, 5)
            if (cx + 1 < w) img.setPixel(cx + 1, cy, 5)
            if (cy - 1 >= 0) img.setPixel(cx, cy - 1, 5)
            if (cy + 1 < h) img.setPixel(cx, cy + 1, 5)
        }

        return img
    }

    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        // Charge relevance (same rule as before: ARMED + landed)
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
        const chargeRelevant = (agiState === AGI_STATE.ARMED) && (dashUntil === 0 || now >= dashUntil)

        const meter = heroComboMeters[i]
        const counter = heroAgiStoredCounters[i]

        // Stored hits: prefer v4 key if present, fallback to packet count
        let storedHits = sprites.readDataNumber(hero, HERO_DATA.AGI_STORED_HITS) | 0
        if (!storedHits && storedHits !== 0) storedHits = 0
        if ((storedHits | 0) === 0) {
            storedHits = sprites.readDataNumber(hero, HERO_DATA.AGI_PKT_COUNT) | 0
        }

        // ------------------------------------------------------------
        // Phaser runtime: completely disable the old combo-bar path.
        // (No ensureComboMeter, no UI_KIND_COMBO_METER publishing.)
        // ------------------------------------------------------------
        if (phaser) {
            if (meter) {
                meter.setFlag(SpriteFlag.Invisible, true)
                sprites.setDataNumber(meter, UI_COMBO_VISIBLE_KEY, 0)
            }
        } else {
            // --------------------------------------------------------
            // Arcade fallback: show compact pips while charge relevant.
            // --------------------------------------------------------
            if (!chargeRelevant) {
                if (meter) meter.setFlag(SpriteFlag.Invisible, true)
            } else {
                const m = ensureComboMeter(i); if (!m) continue

                const pendingAdd = sprites.readDataNumber(hero, HERO_DATA.AGI_PENDING_ADD) | 0
                const isExecW = (sprites.readDataNumber(hero, HERO_DATA.AGI_IS_EXEC_WINDOW) | 0) ? true : false

                const img = drawAgiPipsImage(pendingAdd, isExecW)
                m.setImage(img)

                m.z = hero.z + 2
                m.x = hero.x
                m.y = hero.y + (hero.height >> 1) + 5
                m.setFlag(SpriteFlag.Invisible, false)
            }
        }

        // ------------------------------------------------------------
        // Stored-hits counter: separate, above the hero’s head.
        // Show if there are stored hits OR charge is relevant.
        // ------------------------------------------------------------
        const showCounter = ((storedHits | 0) > 0) || chargeRelevant

        if (!showCounter) {
            if (counter) counter.setFlag(SpriteFlag.Invisible, true)
            continue
        }

        const tSprite = ensureAgiStoredCounter(i)
        if (tSprite) {
            ;(tSprite as any).setText("" + (storedHits | 0))
            tSprite.setFlag(SpriteFlag.Invisible, false)

            // Above head (near HP/mana area)
            tSprite.z = hero.z + 10
            tSprite.x = hero.x + 18
            tSprite.y = hero.y - (hero.height >> 1) - 10
        }
    }
}



function updateHeroAuras(now: number, phaser: boolean) {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        let showAura = false
        let color = 0
        const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY)

        // Strength aura
        const strCharging = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)
        if (family == FAMILY.STRENGTH && (strCharging || (heroBusyUntil[i] || 0) > now)) {
            showAura = true
            color = AURA_COLOR_STRENGTH
        }

        // Agility aura
        if (family == FAMILY.AGILITY) {
            const dashUntil0 = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL)
            if (dashUntil0 > now) { showAura = true; color = AURA_COLOR_AGILITY }
        }

        // Intellect / Heal aura
        if (family == FAMILY.INTELLECT && sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) {
            showAura = true
            color = AURA_COLOR_INTELLECT
        }
        if (family == FAMILY.HEAL && sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) {
            showAura = true
            color = AURA_COLOR_HEAL
        }

        // Phaser: publish aura state; hide Arcade aura sprite
        if (phaser) {
            sprites.setDataBoolean(hero, HERO_DATA.AURA_ACTIVE, showAura)
            sprites.setDataNumber(hero, HERO_DATA.AURA_COLOR, color)
            const aura = heroAuras[i]
            if (aura) aura.setFlag(SpriteFlag.Invisible, true)
        } else {
            const aura = heroAuras[i]
            if (!showAura) {
                if (aura) aura.setFlag(SpriteFlag.Invisible, true)
            } else {
                const active = ensureHeroAuraSprite(i)
                if (active) {
                    active.setImage(createAuraImageFromHero(hero, color))
                    active.setFlag(SpriteFlag.Invisible, false)
                    active.x = hero.x; active.y = hero.y; active.z = hero.z + 1
                }
            }
        }
    }
}







// Non-lazy support glow: real aura around hero sprite, pulsing a few times.
function triggerSupportGlowPulse(heroIndex: number) {
    const hero = heroes[heroIndex];
    if (!hero) {
        console.log("SUPPORT GLOW: no hero at index " + heroIndex);
        return;
    }

    console.log("SUPPORT GLOW: creating aura for hero " + heroIndex);

    // Use the same silhouette halo as the normal auras, but locked to HEAL color.
    const auraImg = createAuraImageFromHero(hero, AURA_COLOR_HEAL);

    const aura = sprites.create(auraImg, SpriteKind.HeroAura);
    aura.setFlag(SpriteFlag.Ghost, true);
    aura.setFlag(SpriteFlag.AutoDestroy, true);

    // Draw ABOVE hero so it's not hidden by the hero sprite
    aura.z = hero.z + 1;
    aura.x = hero.x;
    aura.y = hero.y;

    let ticks = 0;
    const flashInterval = 60; // ms



    game.onUpdateInterval(flashInterval, function () {
        if (!HeroEngine._isStarted()) return;
        if (!aura || (aura.flags & sprites.Flag.Destroyed)) return;

        // Follow the hero so the aura stays centered if they move
        aura.x = hero.x;
        aura.y = hero.y;

        ticks++;
        // even ticks visible, odd ticks invisible
        aura.setFlag(SpriteFlag.Invisible, (ticks % 2 != 0));

        if (ticks >= 8) {
            console.log("SUPPORT GLOW: destroying aura for hero " + heroIndex);
            aura.destroy();
        }
    });
}






ensureHeroSpriteKinds();



// ================================================================
// SECTION 6 - ON OVERLAP - COLLISIONS AND INTERACTIONS BETWEEN KINDS
// ================================================================
// Overlap logic shared by STR/AGI/INT/HEAL effects.


// HeroWeapon ↔ Enemy (STR/AGI: normal; INTELLECT: detonate; HEAL: ignore enemies)
sprites.onOverlap(SpriteKind.HeroWeapon, SpriteKind.Enemy, function (weapon, enemy) {
    const family = sprites.readDataNumber(weapon, PROJ_DATA.FAMILY)
    const heroIndex = sprites.readDataNumber(weapon, PROJ_DATA.HERO_INDEX)

    // HEAL: ignore enemy overlaps entirely
    if (family == FAMILY.HEAL) return

    // INTELLECT: detonate once, no destroy now
    if (family == FAMILY.INTELLECT) {
        if (!sprites.readDataNumber(weapon, INT_DETONATED_KEY)) {
            console.log(
                `[INT DEBUG] OVERLAP DETONATION hero=${heroIndex} ` +
                `spell=(${weapon.x},${weapon.y}) enemy=(${enemy.x},${enemy.y})`
            )
            detonateIntellectSpellAt(weapon, weapon.x, weapon.y)
        }
        return
    }

    // STR/AGI payload (once per enemy)
    const button = sprites.readDataString(weapon, PROJ_DATA.BUTTON)
    const isHeal = (sprites.readDataNumber(weapon, PROJ_DATA.IS_HEAL) | 0) == 1
    const slowPct = sprites.readDataNumber(weapon, PROJ_DATA.SLOW_PCT) | 0
    const slowDurationMs = sprites.readDataNumber(weapon, PROJ_DATA.SLOW_DURATION_MS) | 0
    const weakenPct = sprites.readDataNumber(weapon, PROJ_DATA.WEAKEN_PCT) | 0
    const weakenDurationMs = sprites.readDataNumber(weapon, PROJ_DATA.WEAKEN_DURATION_MS) | 0
    const knockbackPct = sprites.readDataNumber(weapon, PROJ_DATA.KNOCKBACK_PCT) | 0
    const eIndex = getEnemyIndex(enemy); if (eIndex < 0 || heroIndex < 0 || heroIndex >= heroes.length) return
    const hero = heroes[heroIndex]; if (!hero) return
    let hitMask = sprites.readDataNumber(weapon, PROJ_DATA.HIT_MASK) | 0
    const bit = 1 << eIndex; if (hitMask & bit) return
    sprites.setDataNumber(weapon, PROJ_DATA.HIT_MASK, hitMask | bit)
    const now = game.runtime()
    if (slowPct > 0 && slowDurationMs > 0) { sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_PCT, slowPct); sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_UNTIL, now + slowDurationMs) }
    if (weakenPct > 0 && weakenDurationMs > 0) { sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_PCT, weakenPct); sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_UNTIL, now + weakenDurationMs) }
    let dmg = sprites.readDataNumber(weapon, PROJ_DATA.DAMAGE) | 0
    if (dmg > 0) {
        if (family == FAMILY.AGILITY) {
            const comboMultPct = getComboDamageMultPct(heroIndex)
            dmg = Math.idiv(dmg * comboMultPct, 100)
            updateAgilityComboOnHit(heroIndex, button)
        }
        applyDamageToEnemyIndex(eIndex, dmg)
        showDamageNumber(enemy.x, enemy.y - 6, dmg)
    }
    if (isHeal && dmg > 0) applyHealToHeroIndex(heroIndex, dmg)
    
    if (knockbackPct > 0) {
    applyPctKnockbackToEnemy(enemy, hero.x, hero.y, knockbackPct)
    }

})

// NEW: HeroWeapon ↔ Player (HEAL detonates on allies)
sprites.onOverlap(SpriteKind.HeroWeapon, SpriteKind.Player, function (weapon, hero) {
    const family = sprites.readDataNumber(weapon, PROJ_DATA.FAMILY)
    if (family != FAMILY.HEAL) return
    if (!sprites.readDataNumber(weapon, INT_DETONATED_KEY)) detonateHealSpellAt(weapon, weapon.x, weapon.y)
})


function hasSignificantOverlap(hero: Sprite, enemy: Sprite, minHeroAreaPct: number): boolean {
    const heroW = hero.width, heroH = hero.height, enemyW = enemy.width, enemyH = enemy.height
    const halfHW = Math.idiv(heroW, 2), halfHH = Math.idiv(heroH, 2), halfEW = Math.idiv(enemyW, 2), halfEH = Math.idiv(enemyH, 2)
    const dx = Math.abs(hero.x - enemy.x), dy = Math.abs(hero.y - enemy.y)
    const overlapX = (halfHW + halfEW) - dx, overlapY = (halfHH + halfEH) - dy
    if (overlapX <= 0 || overlapY <= 0) return false
    const overlapArea = overlapX * overlapY, heroArea = heroW * heroH
    return overlapArea * 100 >= heroArea * minHeroAreaPct
}

// Player ↔ Enemy contact (with agility invuln & weaken on enemy attacks)
sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (hero, enemy) {
    const heroIndex = getHeroIndex(hero); if (heroIndex < 0) return
    if (!hasSignificantOverlap(hero, enemy, HERO_CONTACT_MIN_OVERLAP_PCT)) return
    const now = game.runtime()
    const iframeUntil = sprites.readDataNumber(hero, HERO_DATA.IFRAME_UNTIL)
    if (iframeUntil > 0 && now < iframeUntil) return
    const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY)
    if (family == FAMILY.AGILITY) {
        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL)
        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)
        if (locked && dashUntil > 0 && now < dashUntil) return
    }
    let dmg = sprites.readDataNumber(enemy, ENEMY_DATA.TOUCH_DAMAGE); if (dmg <= 0) dmg = 5
    let weakenPct = sprites.readDataNumber(enemy, ENEMY_DATA.WEAKEN_PCT)
    const weakenUntil = sprites.readDataNumber(enemy, ENEMY_DATA.WEAKEN_UNTIL)
    if (weakenPct > 0 && weakenUntil <= now) { weakenPct = 0; sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_PCT, 0) }
    if (weakenPct > 0) { const factor = 100 - weakenPct; dmg = (factor <= 0) ? 0 : Math.idiv(dmg * factor, 100) }
    if (dmg <= 0) return
    applyDamageToHeroIndex(heroIndex, dmg)
    showDamageNumber(hero.x, hero.y - 6, dmg)
    sprites.setDataNumber(hero, HERO_DATA.IFRAME_UNTIL, now + HERO_IFRAME_MS)
})


// ====================================================
// SECTION S - STRENGTH MOVE MODULE
// ====================================================
// Strength moves: smash arc, timing, lifetimes, projectile owner.

//Strength traits should be calculated using: windup duration/damage at trait[1], reach distance at trait[2], total arc degrees at trait[3], knockback amount at traits[4]
// Strength calculation should use the 

// Strength traits mapping:
// traits[1] = windup duration & damage
// traits[2] = reach distance
// traits[3] = total arc degrees
// traits[4] = knockback amount


// Strength traits mapping:
// traits[1] = windup duration & damage
// traits[2] = reach distance
// traits[3] = total arc degrees
// traits[4] = knockback amount

// Strength traits mapping:
// traits[1] = windup duration & damage
// traits[2] = reach distance
// traits[3] = total arc degrees
// traits[4] = knockback amount





function _strTrySpawnPendingSwingForHero(heroIndex: number, hero: Sprite, nowMs: number): void {
    if (!hero) return
    if (hero.flags & sprites.Flag.Destroyed) return

    const active = sprites.readDataNumber(hero, STR_PEND_SWING_ACTIVE_KEY) | 0
    if (!active) return

    const at = sprites.readDataNumber(hero, STR_PEND_SWING_SPAWN_AT_MS_KEY) | 0
    if (at <= 0) {
        // Defensive cleanup
        sprites.setDataNumber(hero, STR_PEND_SWING_ACTIVE_KEY, 0)
        sprites.setDataNumber(hero, STR_PEND_SWING_SPAWN_AT_MS_KEY, 0)
        return
    }

    if ((nowMs | 0) < (at | 0)) return

    // Consume payload
    const dmg = sprites.readDataNumber(hero, STR_PEND_SWING_DMG_KEY) | 0
    const button = sprites.readDataString(hero, STR_PEND_SWING_BTN_KEY) || "A"

    const slowPct = sprites.readDataNumber(hero, STR_PEND_SWING_SLOW_PCT_KEY) | 0
    const slowMs  = sprites.readDataNumber(hero, STR_PEND_SWING_SLOW_MS_KEY) | 0
    const weakPct = sprites.readDataNumber(hero, STR_PEND_SWING_WEAK_PCT_KEY) | 0
    const weakMs  = sprites.readDataNumber(hero, STR_PEND_SWING_WEAK_MS_KEY) | 0
    const kbPct   = sprites.readDataNumber(hero, STR_PEND_SWING_KB_PCT_KEY) | 0
    const swingMs = sprites.readDataNumber(hero, STR_PEND_SWING_SWING_MS_KEY) | 0
    const arcDeg  = sprites.readDataNumber(hero, STR_PEND_SWING_ARC_DEG_KEY) | 0

    // Clear BEFORE spawning (prevents double-spawn if spawn throws/logs)
    sprites.setDataNumber(hero, STR_PEND_SWING_ACTIVE_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_SPAWN_AT_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_DMG_KEY, 0)
    sprites.setDataString(hero, STR_PEND_SWING_BTN_KEY, "")
    sprites.setDataNumber(hero, STR_PEND_SWING_SLOW_PCT_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_SLOW_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_WEAK_PCT_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_WEAK_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_KB_PCT_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_SWING_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_ARC_DEG_KEY, 0)

    // Spawn (late)
    const isHeal = false
    spawnStrengthSwingProjectile(
        heroIndex, hero,
        dmg, isHeal, button,
        slowPct, slowMs,
        weakPct, weakMs,
        kbPct,
        swingMs,
        arcDeg
    )
}

function updateStrengthPendingSwingSpawnsAllHeroes(nowMs: number): void {
    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue
        _strTrySpawnPendingSwingForHero(hi, hero, nowMs | 0)
    }
}


function _strPublishSwingSegForHero(heroIndex: number, hero: Sprite, nowMs: number): void {
    if (!hero) return

    // Only meaningful during a strength swing
    const kind = sprites.readDataString(hero, HERO_DATA.ActionKind) || ""
    if (kind !== "strength_swing") {
        // Optional: clear segmentation keys so they don't linger
        // (safe even if consumers ignore them)
        if ((sprites.readDataString(hero, STR_SEG_NAME_KEY) || "") !== "") {
            sprites.setDataString(hero, STR_SEG_NAME_KEY, "")
            sprites.setDataNumber(hero, STR_SEG_START_MS_KEY, 0)
            sprites.setDataNumber(hero, STR_SEG_DUR_MS_KEY, 0)
            sprites.setDataNumber(hero, STR_SEG_PROGRESS_INT_KEY, 0)
        }
        return
    }

    // We anchor segmentation to the existing Phase window (already stamped on release).
    const phaseStart = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
    const phaseDur = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
    if (phaseStart <= 0 || phaseDur <= 0) return

    const endMs = (phaseStart + phaseDur) | 0
    if (nowMs < phaseStart || nowMs > endMs) return

    // Compute segment durations from fractions
    let windMs = Math.idiv((phaseDur | 0) * STR_SWING_SEG_WINDUP_FRAC_X1000, 1000) | 0
    let fwdMs  = Math.idiv((phaseDur | 0) * STR_SWING_SEG_FORWARD_FRAC_X1000, 1000) | 0
    let landMs = (phaseDur - windMs - fwdMs) | 0

    // Clamp each to min
    if (windMs < STR_SWING_SEG_MIN_MS) windMs = STR_SWING_SEG_MIN_MS
    if (fwdMs  < STR_SWING_SEG_MIN_MS) fwdMs  = STR_SWING_SEG_MIN_MS
    if (landMs < STR_SWING_SEG_MIN_MS) landMs = STR_SWING_SEG_MIN_MS

    // If clamping pushed us over budget, shave back (never below min)
    let over = ((windMs + fwdMs + landMs - phaseDur) | 0)
    if (over > 0) {
        // Prefer shaving landing first, then forward, then windup
        let shave = Math.min(over, Math.max(0, (landMs - STR_SWING_SEG_MIN_MS) | 0)) | 0
        if (shave > 0) { landMs = (landMs - shave) | 0; over = (over - shave) | 0 }

        shave = Math.min(over, Math.max(0, (fwdMs - STR_SWING_SEG_MIN_MS) | 0)) | 0
        if (shave > 0) { fwdMs = (fwdMs - shave) | 0; over = (over - shave) | 0 }

        shave = Math.min(over, Math.max(0, (windMs - STR_SWING_SEG_MIN_MS) | 0)) | 0
        if (shave > 0) { windMs = (windMs - shave) | 0; over = (over - shave) | 0 }
    }

    // Recompute endpoints
    const windEnd = (phaseStart + windMs) | 0
    const fwdEnd  = (windEnd + fwdMs) | 0

    let segName = "release"
    let segStart = fwdEnd
    let segDur = landMs

    if (nowMs < windEnd) {
        segName = "prepareToCharge"
        segStart = phaseStart
        segDur = windMs
    } else if (nowMs < fwdEnd) {
        segName = "charging"
        segStart = windEnd
        segDur = fwdMs
    }

    // Only rewrite when segment actually changes (less churn)
    const prevName = sprites.readDataString(hero, STR_SEG_NAME_KEY) || ""
    const prevStart = sprites.readDataNumber(hero, STR_SEG_START_MS_KEY) | 0
    const prevDur = sprites.readDataNumber(hero, STR_SEG_DUR_MS_KEY) | 0

    const changed = (prevName !== segName) || (prevStart !== (segStart | 0)) || (prevDur !== (segDur | 0))

    if (changed) {
        // Side-channel keys (optional but fine)
        sprites.setDataString(hero, STR_SEG_NAME_KEY, segName)
        sprites.setDataNumber(hero, STR_SEG_START_MS_KEY, segStart | 0)
        sprites.setDataNumber(hero, STR_SEG_DUR_MS_KEY, segDur | 0)

        // ✅ CANONICAL CONTRACT: publish PhasePart so heroAnimGlue/weaponAnimGlue can consume it
        // NOTE: This must exist already in your codebase (you referenced it earlier).
        _animKeys_setPhasePart(hero, segName, nowMs | 0, segDur | 0, segStart | 0)

        // Debug only on segment transitions (not every frame)
        console.log(`[STR][SEG] hi=${heroIndex} ${segName} start=${segStart} dur=${segDur} phaseStart=${phaseStart} phaseDur=${phaseDur}`)
    }

    // Segment-local progress (0..PHASE_PROGRESS_MAX) for any debug tooling you have
    let t = (nowMs - segStart) | 0
    if (t < 0) t = 0
    if (t > segDur) t = segDur

    const prog = clampInt(
        Math.idiv(PHASE_PROGRESS_MAX * t, Math.max(1, segDur)),
        0,
        PHASE_PROGRESS_MAX
    )

    sprites.setDataNumber(hero, STR_SEG_PROGRESS_INT_KEY, prog)
}


function updateStrengthSwingSegmentationAllHeroes(nowMs: number): void {
    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        _strPublishSwingSegForHero(hi, hero, nowMs | 0)
    }
}



function updateStrengthChargingAllHeroes(nowMs: number): void {
    for (let heroIndex = 0; heroIndex < heroes.length; heroIndex++) {
        const hero = heroes[heroIndex]
        if (!hero) continue
        if (!sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) continue

        // 1) Advance charge, drain mana, force-release if mana hits 0 (handled inside)
        updateStrengthChargeForHero(heroIndex, hero, nowMs)

        // If update forced a release, charging will already be false now.
        if (!sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) continue

        // 2) Release if the initiating button is no longer pressed
        const ownerId = (sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0)
        const btnId = (sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_BTN) | 0)

        const held = isStrBtnIdPressedForOwner(ownerId, btnId)

//        console.log(`[STR][CHARGE][HELD?] hi=${heroIndex} owner=${ownerId} btnId=${btnId} held=${held} locked=${sprites.readDataBoolean(hero, HERO_DATA.LOCKED) ? 1 : 0}`)

        if (!held) releaseStrengthCharge(heroIndex, hero, nowMs)


        if (!isStrBtnIdPressedForOwner(ownerId, btnId)) {
            releaseStrengthCharge(heroIndex, hero, nowMs)
        }
    }
}



function strengthChargeMaxMsFromTrait3(t3: number): number {
    let v = STR_CHARGE_BASE_MAX_MS - (t3 | 0) * STR_CHARGE_MS_PER_T3
    if (v < STR_CHARGE_MIN_MAX_MS) v = STR_CHARGE_MIN_MAX_MS
    return v
}

function strengthBaseManaCostFromTraits(t1: number, t2: number, t4: number): number {
    // Base mana is paid immediately: traits 1,2,4 only
    let cost = (t1 | 0) + (t2 | 0) + (t4 | 0)
    if (cost < 0) cost = 0
    return cost
}

function strengthExtraManaForFullCharge(baseCost: number): number {
    // Extra mana is paid incrementally as arc grows (0..360)
    const extra = Math.idiv((baseCost | 0) * STR_CHARGE_EXTRA_MANA_PCT, 100)
    return extra < 0 ? 0 : extra
}


function beginStrengthCharge(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[],
    animKey: string
): void {
    if (sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    const now = game.runtime()
    const btnId = encodeIntentToStrBtnId(button)
    if (btnId === 0) return

    const t1 = traits[1] | 0
    const t2 = traits[2] | 0
    const t3 = traits[3] | 0
    const t4 = traits[4] | 0
    const element = traits[OUT.ELEMENT] | 0

    const baseCost = strengthBaseManaCostFromTraits(t1, t2, t4)
    let mana = sprites.readDataNumber(hero, HERO_DATA.MANA) | 0
    if (mana < baseCost) {
        flashHeroManaBar(heroIndex)
        return
    }

    if (baseCost > 0) {
        mana -= baseCost
        if (mana < 0) mana = 0
        sprites.setDataNumber(hero, HERO_DATA.MANA, mana)
        updateHeroManaBar(heroIndex)
        showDamageNumber(hero.x, hero.y - 10, -baseCost, "mana")
    }

    // Action edge only after real commit (base mana paid)
    _doHeroMoveBeginActionTimeline(heroIndex, hero, FAMILY.STRENGTH, button, t1, t2, t3, t4, element | 0, now | 0)

    const maxMs = strengthChargeMaxMsFromTrait3(t3)
    const extraCost = strengthExtraManaForFullCharge(baseCost)
    const mpdX1000 = (extraCost <= 0) ? 0 : Math.idiv(extraCost * 1000, 360)

    sprites.setDataBoolean(hero, HERO_DATA.STR_CHARGING, true)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_BTN, btnId)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_START_MS, now)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, now)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MAX_MS, maxMs)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MPD_X1000, mpdX1000)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_REM_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT, baseCost)

    lockHeroControls(heroIndex)

    setHeroPhaseString(heroIndex, "slash")
    clearHeroFrameColOverride(heroIndex)

    sprites.setDataString(hero, HERO_DATA.ActionKind, "strength_charge")
    if (DEBUG_ANIM_KEYS) _dbgAnimKeys(heroIndex, hero, "KIND_REFINE", `t=${(now|0)} kind=strength_charge`)

    _animKeys_stampPhaseWindow(heroIndex, hero, "slash", now | 0, maxMs | 0, "beginStrengthCharge")

    // ✅ Visible prep part, then hold part (transition happens in updateStrengthChargeForHero)
    let prepMs = STR_PREP_VISIBLE_MS | 0
    if (prepMs < 0) prepMs = 0
    if (prepMs > (maxMs | 0)) prepMs = maxMs | 0

    if (prepMs > 0) {
        _animKeys_setPhasePart(hero, "prepareToCharge", now | 0, prepMs | 0, now | 0)
    } else {
        _animKeys_setPhasePart(hero, "charging", now | 0, Math.max(1, maxMs | 0) | 0, now | 0)
    }

    // Let slash play. Prep is visible; charging hold is done by heroAnimGlue when part=="charging".
    callHeroAnim(heroIndex, animKey, maxMs | 0)

    showStrengthChargeBar(heroIndex, hero, true)
    setStrengthChargeBarPct(heroIndex, hero, 0)
}



function updateStrengthChargeForHero(heroIndex: number, hero: Sprite, nowMs: number): void {
    if (!hero) return
    if (!sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    const startMs = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_START_MS) | 0
    let lastMs = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS) | 0
    const maxMs = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_MAX_MS) | 0
    let arcDeg = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG) | 0
    const mpdX1000 = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_MPD_X1000) | 0
    let remX1000 = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_REM_X1000) | 0

    if (maxMs <= 0) {
        releaseStrengthCharge(heroIndex, hero, nowMs)
        return
    }

    // ----------------------------
    // Compute prep vs hold timing
    // ----------------------------
    let prepMs = STR_PREP_VISIBLE_MS | 0
    if (prepMs < 0) prepMs = 0
    if (prepMs > (maxMs | 0)) prepMs = maxMs | 0

    const holdMsRaw = ((maxMs | 0) - (prepMs | 0)) | 0
    const holdMs = Math.max(1, holdMsRaw | 0) | 0
    const prepStart = startMs | 0
    const holdStart = ((startMs | 0) + (prepMs | 0)) | 0

    // ----------------------------
    // Publish universal PHASE progress (0..1000)
    // ----------------------------
    const elapsed0 = clampInt((nowMs | 0) - (startMs | 0), 0, maxMs | 0)
    const pInt = clampInt(Math.idiv(PHASE_PROGRESS_MAX * elapsed0, maxMs | 0), 0, PHASE_PROGRESS_MAX)
    sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, pInt)

    // ----------------------------
    // ✅ Maintain correct PhasePart (this was the missing piece)
    // - during prep window => prepareToCharge
    // - after holdStart     => charging
    // ----------------------------
    const ppNow = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""

    if (prepMs > 0 && (nowMs | 0) < (holdStart | 0)) {
        // In prep
        if (ppNow !== "prepareToCharge") {
            _animKeys_setPhasePart(hero, "prepareToCharge", prepStart | 0, prepMs | 0, prepStart | 0)
        }
    } else {
        // In charging/hold
        if (ppNow !== "charging") {
            _animKeys_setPhasePart(hero, "charging", holdStart | 0, holdMs | 0, holdStart | 0)
        }
    }

    // ----------------------------
    // Part-local progress (0..1000) for the current part
    // ----------------------------
    let partProg = 0
    if (prepMs > 0 && (nowMs | 0) < (holdStart | 0)) {
        const t = clampInt(((nowMs | 0) - (prepStart | 0)) | 0, 0, prepMs | 0)
        partProg = clampInt(Math.idiv(PHASE_PROGRESS_MAX * t, Math.max(1, prepMs | 0)), 0, PHASE_PROGRESS_MAX)
    } else {
        const t = clampInt(((nowMs | 0) - (holdStart | 0)) | 0, 0, holdMs | 0)
        partProg = clampInt(Math.idiv(PHASE_PROGRESS_MAX * t, Math.max(1, holdMs | 0)), 0, PHASE_PROGRESS_MAX)
    }
    sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, partProg)

    _animInvCheckHeroTimeline(heroIndex, hero, nowMs | 0, "updateStrengthChargeForHero")

    // Clamp dt so tab-switch / hitching doesn't instantly jump to full
    let dt = (nowMs | 0) - (lastMs | 0)
    if (dt < 0) dt = 0
    if (dt > 80) dt = 80

    // If already full, keep bar full and wait for button release
    if (arcDeg >= 360) {
        arcDeg = 360
        sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, 360)
        setStrengthChargeBarPct(heroIndex, hero, 100)
        sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, nowMs)
        return
    }

    // dDeg = 360 * dt / maxMs
    const dDeg = (dt <= 0) ? 0 : Math.idiv(360 * dt, maxMs)
    if (dDeg <= 0) {
        const pct = clampInt(Math.idiv(100 * clampInt(elapsed0, 0, maxMs), maxMs), 0, 100)
        setStrengthChargeBarPct(heroIndex, hero, pct)
        sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, nowMs)
        return
    }

    // Incremental mana drain tied to degrees gained
    let manaToSpend = 0
    if (mpdX1000 > 0) {
        let costX1000 = dDeg * mpdX1000 + remX1000
        manaToSpend = Math.idiv(costX1000, 1000)
        remX1000 = costX1000 - manaToSpend * 1000
    }

    // Spend mana; if mana hits 0, force-release
    if (manaToSpend > 0) {
        let mana = sprites.readDataNumber(hero, HERO_DATA.MANA) | 0
        if (mana <= 0) {
            releaseStrengthCharge(heroIndex, hero, nowMs)
            return
        }

        if (mana < manaToSpend) {
            const affordableMana = mana
            mana = 0
            sprites.setDataNumber(hero, HERO_DATA.MANA, 0)
            updateHeroManaBar(heroIndex)

            let degAff = 0
            if (mpdX1000 > 0) degAff = Math.idiv(affordableMana * 1000, mpdX1000)
            else degAff = dDeg

            arcDeg += degAff
            if (arcDeg > 360) arcDeg = 360
            sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, arcDeg)

            const spent = (sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT) | 0) + affordableMana
            sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT, spent)

            const pct = clampInt(Math.idiv(arcDeg * 100, 360), 0, 100)
            setStrengthChargeBarPct(heroIndex, hero, pct)

            releaseStrengthCharge(heroIndex, hero, nowMs)
            return
        }

        mana -= manaToSpend
        if (mana < 0) mana = 0
        sprites.setDataNumber(hero, HERO_DATA.MANA, mana)
        updateHeroManaBar(heroIndex)

        const spent = (sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT) | 0) + manaToSpend
        sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT, spent)
    }

    arcDeg += dDeg
    if (arcDeg > 360) arcDeg = 360
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, arcDeg)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, nowMs)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_REM_X1000, remX1000)

    const pct = clampInt(Math.idiv(arcDeg * 100, 360), 0, 100)
    setStrengthChargeBarPct(heroIndex, hero, pct)
}

function releaseStrengthCharge(heroIndex: number, hero: Sprite, nowMs: number): void {
    if (!hero) return
    if (!sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    const now = nowMs | 0

    // We are no longer holding a single frame; allow normal playback on release
    clearHeroFrameColOverride(heroIndex)

    // Snapshot arc BEFORE clearing charge state
    let arcDeg = sprites.readDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG) | 0
    arcDeg = clampInt(arcDeg, 0, 360)
    // Minimal swing even for tiny charge (no free cancel after paying base mana)
    if (arcDeg < 10) arcDeg = 10

    // ------------------------------------------------------------
    // Clear charge state FIRST (so downstream logic doesn't still see "charging")
    // ------------------------------------------------------------
    sprites.setDataBoolean(hero, HERO_DATA.STR_CHARGING, false)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_BTN, STR_BTN_NONE)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MAX_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MPD_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_REM_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT, 0)

    // Ensure we stop any "frame freeze" override used during charge
    sprites.setDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE, HERO_FRAME_COL_OVERRIDE_NONE)

    // Hide bar (this fixes the lingering white outline)
    showStrengthChargeBar(heroIndex, hero, false)
    setStrengthChargeBarPct(heroIndex, hero, 0)

    // --- clear swing segmentation addon keys (fresh slate) ---
    sprites.setDataString(hero, STR_SEG_NAME_KEY, "")
    sprites.setDataNumber(hero, STR_SEG_START_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_SEG_DUR_MS_KEY, 0)
    sprites.setDataNumber(hero, STR_SEG_PROGRESS_INT_KEY, 0)

    // ------------------------------------------------------------
    // Compute swing duration from charge amount (keep the V9 shaping)
    // ------------------------------------------------------------
    const swingDurationMs = clampInt(220 + Math.idiv(arcDeg * 220, 360), 160, 520) | 0

    // ------------------------------------------------------------
    // Busy lock for the swing window
    // ------------------------------------------------------------
    const until = (now + swingDurationMs) | 0
    heroBusyUntil[heroIndex] = until
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, until)
    lockHeroControls(heroIndex)

    // ------------------------------------------------------------
    // Use snapshotted payload (immune to mid-hold changes)
    // ------------------------------------------------------------
    const family0 = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_FAMILY) | 0
    const button = sprites.readDataString(hero, HERO_DATA.STR_PAYLOAD_BTNSTR) || "A"
    const t1 = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_T1) | 0
    const t2 = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_T2) | 0
    const t3 = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_T3) | 0
    const t4 = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_T4) | 0
    const el = sprites.readDataNumber(hero, HERO_DATA.STR_PAYLOAD_EL) | 0
    const traits = [0, t1, t2, t3, t4, el]

    // Recompute stats from the snapshotted traits/button
    const family = (family0 | 0) || FAMILY.STRENGTH
    const traitsEff = applyDamageModsToTraits(heroIndex, family, traits)
    const stats = calculateMoveStatsForFamily(family, button, traitsEff)

    // Damage calc (matches your existing Strength flow)
    const baseDamage = getBasePower(FAMILY.STRENGTH)
    const damageMult = stats[STAT.DAMAGE_MULT] | 0
    let dmg = Math.idiv(baseDamage * (damageMult || 100), 100)
    if (dmg < 1) dmg = 1

    const slowPct = stats[STAT.SLOW_PCT] | 0
    const slowDurationMs = stats[STAT.SLOW_DURATION] | 0
    const weakenPct = stats[STAT.WEAKEN_PCT] | 0
    const weakenDurationMs = stats[STAT.WEAKEN_DURATION] | 0
    const knockbackPct = stats[STAT.KNOCKBACK_PCT] | 0

    // ------------------------------------------------------------
    // NORMALIZED ACTION EDGE
    // ------------------------------------------------------------
    _doHeroMoveBeginActionTimeline(
        heroIndex,
        hero,
        FAMILY.STRENGTH,
        button,
        t1,
        t2,
        t3,
        t4,
        el,
        now
    )

    sprites.setDataString(hero, HERO_DATA.ActionKind, "strength_swing")
    if (DEBUG_ANIM_KEYS) _dbgAnimKeys(heroIndex, hero, "KIND_REFINE", `t=${(now|0)} kind=strength_swing`)

    // ------------------------------------------------------------
    // Phase + part window for the swing
    // ------------------------------------------------------------
    _animKeys_stampPhaseWindow(heroIndex, hero, "slash", now, swingDurationMs, "releaseStrengthCharge")
    _animKeys_setPhasePart(hero, "swing", now, swingDurationMs, now)

    // initialize segmentation addon channel (you said you like this)
    _strPublishSwingSegForHero(heroIndex, hero, now)

    _animInvCheckHeroTimeline(heroIndex, hero, now, "releaseStrengthCharge(begin swing)")

    // Animation request
    callHeroAnim(heroIndex, "slash", swingDurationMs)

    _dbgMovePipe("STR_RELEASE", heroIndex, hero, now, `arcDeg=${arcDeg} swingMs=${swingDurationMs} dmg=${dmg}`)

    // ------------------------------------------------------------
    // ✅ NEW: schedule projectile spawn LATER inside the swing window
    // ------------------------------------------------------------
    let spawnDelayMs = Math.idiv((swingDurationMs | 0) * STR_SWING_PROJECTILE_SPAWN_FRAC_X1000, 1000) | 0
    if (spawnDelayMs < 0) spawnDelayMs = 0
    if (spawnDelayMs > swingDurationMs) spawnDelayMs = swingDurationMs

    const spawnAtMs = (now + spawnDelayMs) | 0

    sprites.setDataNumber(hero, STR_PEND_SWING_ACTIVE_KEY, 1)
    sprites.setDataNumber(hero, STR_PEND_SWING_SPAWN_AT_MS_KEY, spawnAtMs)

    sprites.setDataNumber(hero, STR_PEND_SWING_DMG_KEY, dmg | 0)
    sprites.setDataString(hero, STR_PEND_SWING_BTN_KEY, button)

    sprites.setDataNumber(hero, STR_PEND_SWING_SLOW_PCT_KEY, slowPct | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_SLOW_MS_KEY, slowDurationMs | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_WEAK_PCT_KEY, weakenPct | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_WEAK_MS_KEY, weakenDurationMs | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_KB_PCT_KEY, knockbackPct | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_SWING_MS_KEY, swingDurationMs | 0)
    sprites.setDataNumber(hero, STR_PEND_SWING_ARC_DEG_KEY, arcDeg | 0)

    // ------------------------------------------------------------
    // Clear cached payload after firing (cleanliness / prevents stale reads)
    // ------------------------------------------------------------
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_FAMILY, 0)
    sprites.setDataString(hero, HERO_DATA.STR_PAYLOAD_BTNSTR, "")
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T1, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T2, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T3, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T4, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_EL, 0)
    sprites.setDataString(hero, HERO_DATA.STR_PAYLOAD_ANIM, "")
}



function cancelStrengthCharge(heroIndex: number, hero: Sprite, nowMs: number): void {
    if (!hero) return
    if (!sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    const now = nowMs | 0

    // End charging state
    sprites.setDataBoolean(hero, HERO_DATA.STR_CHARGING, false)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_LAST_MS, now)

    // Clear charge bookkeeping (safe to zero; NOT the Phase window)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_BTN, STR_BTN_NONE)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MAX_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_ARC_DEG, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_MPD_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_REM_X1000, 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_CHARGE_SPENT, 0)

    // Release any hold-frame override / color override
    sprites.setDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE, HERO_FRAME_COL_OVERRIDE_NONE)
    clearHeroFrameColOverride(heroIndex)

    // UI
    showStrengthChargeBar(heroIndex, hero, false)
    setStrengthChargeBarPct(heroIndex, hero, 0)

    // Cancel ends the move-segment (PhasePart), but PhaseName stays meaningful (unified contract)
    _animKeys_clearPhasePart(hero)

    // Clear any one-shot event pulse (mask + payload only; EventSequence untouched)
    _animEvent_clear(hero)

    // Unlock inputs and clear busy
    clearHeroBusyUntil(heroIndex)
    unlockHeroControls(heroIndex)

    // Return to ambient phase under the unified PhaseName contract
    updateHeroMovementPhase(now)

    _animInvCheckHeroTimeline(heroIndex, hero, now, "cancelStrengthCharge")
}



function calculateStrengthStats(baseTimeMs: number, traits: number[]) {
    const stats = makeBaseStats(baseTimeMs)

    // New Strength trait mapping:
    // traits[1] = Damage
    // traits[2] = Reach (handled in spawnStrengthSwingProjectile via HERO_DATA.TRAIT2)
    // traits[3] = Time (charge-to-full time; handled by the charging system, not stats[])
    // traits[4] = Status (knockback, and any future STR status knobs)

    let tDmg = (traits[1] | 0)
    let tReach = (traits[2] | 0) // not used here; documented for clarity
    let tTime = (traits[3] | 0)  // not used here; charging system uses this
    let tStatus = (traits[4] | 0)

    if (tDmg < 0) tDmg = 0
    if (tReach < 0) tReach = 0
    if (tTime < 0) tTime = 0
    if (tStatus < 0) tStatus = 0

    // ----------------------------------------------------
    // DAMAGE (traits[1])
    // ----------------------------------------------------
    // Keep your existing feel: starts at 80%, +2% per point
    stats[STAT.DAMAGE_MULT] = 80 + tDmg * 2

    // ----------------------------------------------------
    // TIMING (post-release swing only)
    // ----------------------------------------------------
    // Charging time is handled outside stats[] now.
    // After release, we only lock for the swing animation.
    const BASE_SWING_MS = 220
    stats[STAT.STRENGTH_SWING_MS] = BASE_SWING_MS
    stats[STAT.MOVE_DURATION] = BASE_SWING_MS

    // ----------------------------------------------------
    // LUNGE: tiny crawl forward during the swing
    // ----------------------------------------------------
    const STRENGTH_CRAWL_SPEED = 5
    stats[STAT.LUNGE_SPEED] = STRENGTH_CRAWL_SPEED

    // ----------------------------------------------------
    // ARC: no longer trait-driven here (charge drives arc 0..360)
    // Keep a safe default for any legacy reads.
    // ----------------------------------------------------
    stats[STAT.STRENGTH_TOTAL_ARC_DEG] = 360

    // ----------------------------------------------------
    // STATUS (traits[4]) → knockback percentage
    // ----------------------------------------------------
    stats[STAT.KNOCKBACK_PCT] = 10 + tStatus * 10

    return stats
}



function executeStrengthMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[],
    animKey: string
) {
    // Ignore retriggers while charging
    if (sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) return

    // Snapshot payload (immune to any later changes while holding)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_FAMILY, FAMILY.STRENGTH)
    sprites.setDataString(hero, HERO_DATA.STR_PAYLOAD_BTNSTR, button)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T1, traits[1] | 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T2, traits[2] | 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T3, traits[3] | 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_T4, traits[4] | 0)
    sprites.setDataNumber(hero, HERO_DATA.STR_PAYLOAD_EL, traits[5] | 0)
    sprites.setDataString(hero, HERO_DATA.STR_PAYLOAD_ANIM, animKey || "")

    beginStrengthCharge(heroIndex, hero, button, traits, stats, animKey)
}



// Cached strength inner radius for this hero.
// - Computed lazily on first Strength use
// - Based on a circular bound that fully contains the hero sprite
// - Adds a small margin so the Strength arc will sit outside the aura/outline.

function getStrengthInnerRadiusForHero(hero: Sprite): number {
    // Check cache first
    let cached = sprites.readDataNumber(hero, HERO_DATA.STR_INNER_RADIUS)
    if (cached > 0) return cached

    const img = hero.image
    if (!img) return 0

    const w = img.width
    const h = img.height

    // Center of the sprite in image-space
    const cx = w / 2
    const cy = h / 2

    // Find the furthest non-transparent pixel from the center.
    // This gives us a silhouette-based radius that ignores blank padding.
    let maxR = 0
    let sawOpaque = false

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = img.getPixel(x, y)
            if (p == 0) continue

            sawOpaque = true
            const dx = x - cx
            const dy = y - cy
            const r = Math.sqrt(dx * dx + dy * dy)
            if (r > maxR) maxR = r
        }
    }

    let heroRadius: number
    if (sawOpaque) {
        heroRadius = maxR
    } else {
        // Fallback: no pixels? fall back to old "full sprite" radius
        heroRadius = Math.sqrt(cx * cx + cy * cy)
    }

    // Aura thickness (~1px) plus a tiny spacing gap so the Strength arc
    // will appear just outside the aura outline.
    const auraThickness = 1
    const spacing = 1

    const inner0 = heroRadius + auraThickness + spacing

    // Cache on the hero for all future Strength uses
    sprites.setDataNumber(hero, HERO_DATA.STR_INNER_RADIUS, inner0)

    return inner0
}

// Find the hero's true leading edge along (nx, ny) in *image* space.
// We start at the hero's center pixel and march outward, tracking the last
// non-transparent pixel before we hit transparency or leave the sprite.
function findHeroLeadingEdgeDistance(hero: Sprite, nx: number, ny: number): number {
    const img = hero.image
    if (!img) {
        console.log("S-EDGE: no image on hero")
        return 0
    }

    const w = img.width
    const h = img.height

    // Center of the sprite in image coordinates
    const cx = w / 2
    const cy = h / 2

    //console.log("S-EDGE: img " + w + "x" + h + " cx=" + cx + " cy=" + cy +
    //    " dir=(" + nx + "," + ny + ")")

    let lastOpaqueDist = 0
    let sawOpaque = false

    // Max distance we could possibly need: diagonal of the sprite
    const maxDist = Math.sqrt(w * w + h * h)
    const maxSteps = Math.ceil(maxDist)

    // March in 1px steps from center outward
    for (let step = 0; step <= maxSteps; step++) {
        const d = step
        const px = Math.round(cx + nx * d)
        const py = Math.round(cy + ny * d)

        // Leaving the sprite bounds counts as "transparent"
        if (px < 0 || py < 0 || px >= w || py >= h) {
            if (sawOpaque) {
                //console.log("S-EDGE: out of bounds after opaque at d=" + d +
                //    " lastOpaque=" + lastOpaqueDist)
            } else {
                //console.log("S-EDGE: out of bounds before any opaque at d=" + d)
            }
            break
        }

        const p = img.getPixel(px, py)

        if (p != 0) {
            // Solid pixel – keep extending the edge
            if (!sawOpaque) {
                //console.log("S-EDGE: first opaque at d=" + d +
                //    " px=" + px + " py=" + py + " color=" + p)
            }
            lastOpaqueDist = d
            sawOpaque = true
        } else if (sawOpaque) {
            // First transparent after at least one solid pixel -> stop
            //console.log("S-EDGE: first transparent after opaque at d=" + d +
            //    " lastOpaque=" + lastOpaqueDist)
            break
        }
    }

    //console.log("S-EDGE: result sawOpaque=" + sawOpaque +
    //    " lastOpaqueDist=" + lastOpaqueDist)

    if (!sawOpaque) return 0
    return lastOpaqueDist
}



function getHeroVisualInfoForStrength(hero: Sprite, nx: number, ny: number): number[] {
    // Returns [innerR, leadEdge, wTipX, wTipY]
    try {
        const g: any = (globalThis as any)
        const hook = g && g.__HeroEngineHooks && g.__HeroEngineHooks.getHeroVisualInfo
        if (typeof hook === "function") return hook(hero, nx, ny)
    } catch {
        // ignore
    }

    // Fallback: engine-side default (Arcade pixel scan)
    // You already added this in the HeroEngine namespace.
    return (HeroEngine as any).__getHeroVisualInfo(hero, nx, ny)
}


function spawnStrengthSwingProjectile(
    heroIndex: number,
    hero: Sprite,
    dmg: number,
    isHeal: boolean,
    button: string,
    slowPct: number,
    slowDurMs: number,
    weakenPct: number,
    weakenDurMs: number,
    knockbackPct: number,
    swingDurationMs: number,
    totalArcDeg: number
) {

    const now = game.runtime()
    const aim = getAimVectorForHero(heroIndex)

    // Normalize facing
    let nx = aim[0]
    let ny = aim[1]
    if (nx == 0 && ny == 0) { nx = 1; ny = 0 }
    const mag = Math.sqrt(nx * nx + ny * ny) || 1
    nx /= mag
    ny /= mag


    // Pull silhouette-derived geometry via hook (Phaser override) or fallback (Arcade scan)
    const vis = getHeroVisualInfoForStrength(hero, nx, ny)
    let inner0 = (vis[0] || 0)
    let leadEdge = (vis[1] || 0)
    let wTipX = (vis[2] || 0)
    let wTipY = (vis[3] || 0)

    // Safety fallback (should rarely hit if hook is installed)
    if (inner0 <= 0) inner0 = 35
    if (leadEdge <= 0) leadEdge = 32

    // Where the thrust should START (leading edge, not max-radius circle)
    // This keeps the “initiates from the front” feel you care about.
    const AURA_THICKNESS = 1
    const SPACING = 1
    let frontStartR = leadEdge + AURA_THICKNESS + SPACING
    if (frontStartR < 0) frontStartR = 0
    if (frontStartR > inner0) frontStartR = inner0



    // ----------------------------------------------------
    // REACH: baseline just outside aura + trait-driven extra
    // ----------------------------------------------------
    let tReach = sprites.readDataNumber(hero, HERO_DATA.TRAIT2) | 0
    if (tReach < 0) tReach = 0

    const baseExtraReach = 4      // tiny bit beyond aura even at 0 reach
    const extraPerPoint = 1       // 1px per trait point; tweak to taste
    const reachFromInner = baseExtraReach + tReach * extraPerPoint

    // Create initial image at progress = 0 (tiny nub / initial thrust)
    const img0 = buildStrengthSmashBitmap(nx, ny, inner0, frontStartR, reachFromInner, totalArcDeg, 0)
    //const img0 = buildStrengthSmashBitmap(nx, ny, inner0, reachFromInner, totalArcDeg, 0)

    const proj = sprites.create(img0, SpriteKind.HeroWeapon)
    proj.z = hero.z + 1
    proj.vx = 0
    proj.vy = 0
    proj.setPosition(hero.x, hero.y)

    const swingDuration = swingDurationMs || 220

    // Persist parameters for per-frame updater
    sprites.setDataNumber(proj, PROJ_DATA.START_TIME, now)
    sprites.setDataNumber(proj, "SS_SWING_MS", swingDuration)
    sprites.setDataNumber(proj, "SS_ARC_DEG", totalArcDeg)
    sprites.setDataNumber(proj, "SS_NX", nx)
    sprites.setDataNumber(proj, "SS_NY", ny)

    // Semantics:
    //  - "SS_ATTACH" stores inner0 (inner radius from hero center)
    //  - "SS_REACH_FRONT" stores extra reach beyond inner0
    sprites.setDataNumber(proj, "SS_ATTACH", inner0)
    sprites.setDataNumber(proj, "SS_REACH_FRONT", reachFromInner)

    sprites.setDataNumber(proj, "SS_FRONT_START", frontStartR)
    sprites.setDataNumber(proj, "SS_WTIP_X", wTipX)
    sprites.setDataNumber(proj, "SS_WTIP_Y", wTipY)


    proj.lifespan = swingDuration
    heroProjectiles.push(proj)

    // Standard projectile data (unchanged)
    sprites.setDataNumber(proj, PROJ_DATA.HERO_INDEX, heroIndex)
    sprites.setDataNumber(proj, PROJ_DATA.FAMILY, FAMILY.STRENGTH)
    sprites.setDataString(proj, PROJ_DATA.BUTTON, button)
    sprites.setDataNumber(proj, PROJ_DATA.DAMAGE, dmg)
    sprites.setDataNumber(proj, PROJ_DATA.IS_HEAL, isHeal ? 1 : 0)
    sprites.setDataNumber(proj, PROJ_DATA.SLOW_PCT, slowPct)
    sprites.setDataNumber(proj, PROJ_DATA.SLOW_DURATION_MS, slowDurMs)
    sprites.setDataNumber(proj, PROJ_DATA.WEAKEN_PCT, weakenPct)
    sprites.setDataNumber(proj, PROJ_DATA.WEAKEN_DURATION_MS, weakenDurMs)
    sprites.setDataNumber(proj, PROJ_DATA.KNOCKBACK_PCT, knockbackPct)
    sprites.setDataString(proj, PROJ_DATA.MOVE_TYPE, "strengthSwing")
}



function updateStrengthProjectilesMotionFor(
    proj: Sprite, hero: Sprite, heroIndex: number, nowMs: number, iInArray: number
): boolean {
    const startMs = (sprites.readDataNumber(proj, PROJ_DATA.START_TIME) | 0) || nowMs
    const swingMs = (sprites.readDataNumber(proj, "SS_SWING_MS") | 0) || 220
    const age = nowMs - startMs
    if (age >= swingMs) {
        console.log("S-UPDATE: DONE heroIndex=" + heroIndex +
            " age=" + age + " swingMs=" + swingMs)
        proj.destroy()
        heroProjectiles.removeAt(iInArray)
        return false
    }

//    const frontStart = sprites.readDataNumber(proj, "SS_FRONT_START") || attachPx


    proj.vx = 0
    proj.vy = 0

    // 🔧 FIX: do NOT use `||` here, or we'll corrupt vertical directions
    let nx = sprites.readDataNumber(proj, "SS_NX")
    let ny = sprites.readDataNumber(proj, "SS_NY")

    // Optional sanity fallback if something ever stored (0,0)
    if (nx == 0 && ny == 0) {
        nx = 1
        ny = 0
        console.log("S-UPDATE: WARNING nx,ny were (0,0); defaulted to (1,0)")
    }

    const attachPx = (sprites.readDataNumber(proj, "SS_ATTACH") | 0)
    const reachFromFront = (sprites.readDataNumber(proj, "SS_REACH_FRONT") | 0)
    const t = Math.max(0, Math.min(1, age / Math.max(1, swingMs)))

    //console.log("S-UPDATE: heroIndex=" + heroIndex +
    //    " age=" + age + "/" + swingMs +
    //    " t=" + t +
    //    " dir=(" + nx + "," + ny + ")" +
    //    " attachPx=" + attachPx +
    //    " reach=" + reachFromFront +
    //   " heroPos=(" + hero.x + "," + hero.y + ")" +
    //    " heroVel=(" + hero.vx + "," + hero.vy + ")" +
    //    " projPos=(" + proj.x + "," + proj.y + ")" +
    //    " projVel=(" + proj.vx + "," + proj.vy + ")")

    const totalArcDeg = sprites.readDataNumber(proj, "SS_ARC_DEG") || 150
    
    const frontStart = sprites.readDataNumber(proj, "SS_FRONT_START") || attachPx

    const lastT = sprites.readDataNumber(proj, "SS_LAST_T") || -1
    if (lastT >= 0 && Math.abs(t - lastT) < 0.06) {
        proj.setPosition(hero.x, hero.y)
        return true
    }
    sprites.setDataNumber(proj, "SS_LAST_T", t)




    proj.setImage(buildStrengthSmashBitmap(nx, ny, attachPx, frontStart, reachFromFront, totalArcDeg, t))
    proj.setPosition(hero.x, hero.y)  // center-anchored

    return true
}

function buildStrengthSmashBitmap(
    nx: number, ny: number,
    inner0: number, frontStartR: number,
    reachExtra: number,
    totalArcDeg: number,
    progress: number
): Image {


    // Clamp inputs
    if (progress < 0) progress = 0
    if (progress > 1) progress = 1
    if (inner0 < 0) inner0 = 0
    if (reachExtra < 1) reachExtra = 1

    const outerR = inner0 + reachExtra

    // Constants controlling animation / shape
    // Constants controlling animation / shape
    const PHASE1_FRAC = 0.25         // % of anim spent in thrust phase
    const TOTAL_ARC_DEG = totalArcDeg // total degrees (± around forward), now passed in

    // Strength: how far past the hero's boundary the arc extends (in pixels)
    const STRENGTH_REACH_EXTRA = 32
    const HALF_ARC_DEG = TOTAL_ARC_DEG / 2
    const RAD_PER_DEG = Math.PI / 180
    const angleStepDeg = 3
    const angleStepRad = angleStepDeg * RAD_PER_DEG

    // Orthonormal frame: forward=(nx,ny), side=(-ny,nx)
    const sx = -ny
    const sy = nx

    // Allocate an image big enough to hold the full outer radius
    const outerInt = Math.ceil(outerR)
    const pad = 2
    const half = outerInt + pad
    const size = half * 2 + 1
    const img = image.create(size, size)

    // ------------------------------------------------------------
    // PHASE 1: forward thrust (no angular sweep yet)
    // ------------------------------------------------------------
    if (progress <= PHASE1_FRAC) {
        const thrustT = progress / PHASE1_FRAC
        const tipR = inner0 + reachExtra * thrustT

        // Straight "spear" along forward direction, from inner0 → tipR.
        for (let r = frontStartR; r <= tipR; r++) {
//        for (let r = inner0; r <= tipR; r++) {
            const px = nx * r
            const py = ny * r
            const ix = Math.round(px) + half
            const iy = Math.round(py) + half
            if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
                img.setPixel(ix, iy, 2)
            }
        }

        // Outline (color 15) around any color-2 pixel
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                if (img.getPixel(x, y) == 2) {
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx == 0 && dy == 0) continue
                            const ox = x + dx
                            const oy = y + dy
                            if (ox < 0 || oy < 0 || ox >= size || oy >= size) continue
                            if (img.getPixel(ox, oy) == 0) img.setPixel(ox, oy, 15)
                        }
                    }
                }
            }
        }

        return img
    }

    // ------------------------------------------------------------
    // PHASE 2: sweeping arc
    // ------------------------------------------------------------
    const sweepT = (progress - PHASE1_FRAC) / (1 - PHASE1_FRAC)
    const halfArcRadMax = HALF_ARC_DEG * RAD_PER_DEG
    const halfArcRad = halfArcRadMax * sweepT

    if (halfArcRad <= 0) {
        // Edge case: just draw a nub at outerR straight ahead
        const px = nx * outerR
        const py = ny * outerR
        const ix = Math.round(px) + half
        const iy = Math.round(py) + half
        if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
            img.setPixel(ix, iy, 2)
        }
    } else {
        // Number of angle steps to go from -halfArcRad → +halfArcRad
        const stepsFloat = halfArcRad / angleStepRad
        let steps = Math.floor(stepsFloat) * 2 + 1
        if (steps < 1) steps = 1

        const centerIndex = (steps - 1) / 2

        for (let i = 0; i < steps; i++) {
            const alpha = -halfArcRad + i * angleStepRad
            const distFromCenter = Math.abs(i - centerIndex)

            // Inner radius tapers toward outerR:
            //   - at center: inner ≈ inner0
            //   - at ends:   inner ≈ outerR - 1 (1-pixel thick)
            let innerR = inner0 + distFromCenter
            if (innerR > outerR - 1) innerR = outerR - 1
            if (innerR < inner0) innerR = inner0

            const cosA = Math.cos(alpha)
            const sinA = Math.sin(alpha)
            const dxDir = nx * cosA + sx * sinA
            const dyDir = ny * cosA + sy * sinA

            for (let r = innerR; r <= outerR; r++) {
                const px = dxDir * r
                const py = dyDir * r
                const ix = Math.round(px) + half
                const iy = Math.round(py) + half
                if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
                    img.setPixel(ix, iy, 2)
                }
            }
        }
    }

    // Outline (color 15) around any color-2 pixel
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (img.getPixel(x, y) == 2) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx == 0 && dy == 0) continue
                        const ox = x + dx
                        const oy = y + dy
                        if (ox < 0 || oy < 0 || ox >= size || oy >= size) continue
                        if (img.getPixel(ox, oy) == 0) img.setPixel(ox, oy, 15)
                    }
                }
            }
        }
    }

    return img
}

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁


// ====================================================
// SECTION A - AGILITY MOVE MODULE
// ====================================================
// Agility moves: dash/thrust, combo logic, arrow segments, DPS tracking.


//Agility traits should be calculated using: baseComboWindow at traits[1], speed of dash at traits[2], invulnerability window at traits[3], slow/cripple amount at traits[4]
// Agility
// Agility traits:
// traits[1] = baseComboWindow
// traits[2] = speed of dash
// traits[3] = invulnerability window
// traits[4] = slow / cripple amount

// Agility traits:
// traits[1] = baseComboWindow
// traits[2] = speed of dash
// traits[3] = invulnerability window
// traits[4] = slow / cripple amount





// ------------------------------------------------------------
// Agility combo meter helper
// Returns:
//   0 => execute window ("E")
//   1/2/3 => build window multiplier (how many hits to bank)
//  -1 => meter not active / unknown
// Layout: [E][1][2][3][2][1][E]
// ------------------------------------------------------------
function agiMeterZoneMultiplier(hero: Sprite, nowMs: number): number {
    const meterStart = sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0
    if (meterStart <= 0) return -1

    const wE = AGI_METER_W_EXEC
    const w1 = AGI_METER_W_1
    const w2 = AGI_METER_W_2
    const w3 = AGI_METER_W_3

    const totalW = (wE * 2) + (w1 * 2) + (w2 * 2) + w3
    const posX1000 = Math.max(0, Math.min(1000, sprites.readDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000) | 0))
    const pointerX = Math.idiv(posX1000 * Math.max(1, totalW - 1), 1000)

    let x = pointerX

    if (x < wE) return 0
    x -= wE

    if (x < w1) return 1
    x -= w1

    if (x < w2) return 2
    x -= w2

    if (x < w3) return 3
    x -= w3

    if (x < w2) return 2
    x -= w2

    if (x < w1) return 1
    return 0
}


// --------------------------------------------------------------
// C4: Agility execute (consume packets → teleport slashes)
// --------------------------------------------------------------

function agiSelectBestEnemyInRadius(cx: number, cy: number, radius: number): number {
    const r2 = radius * radius
    let bestIndex = -1
    let bestHp = -1
    let bestDist2 = 0

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]
        if (!e || (e.flags & sprites.Flag.Destroyed)) continue

        // Ignore enemies that are already dying
        const deathUntil = sprites.readDataNumber(e, ENEMY_DATA.DEATH_UNTIL) | 0
        if (deathUntil > 0) continue

        const dx = (e.x - cx)
        const dy = (e.y - cy)
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue

        const hp = sprites.readDataNumber(e, ENEMY_DATA.HP) | 0

        if (hp > bestHp) {
            bestHp = hp
            bestIndex = i
            bestDist2 = d2
        } else if (hp === bestHp && bestIndex >= 0) {
            // Tie-break: nearer
            if (d2 < bestDist2) {
                bestIndex = i
                bestDist2 = d2
            }
        }
    }

    return bestIndex
}


// EVENT EMITTER (AUTHORITATIVE FOR THIS EVENT)
// Phaser path: increments EventSequence + sets EventMask/Payload exactly once per slash beat.
// IMPORTANT: Only emitters increment EventSequence.
function agiSpawnExecuteSlashVfx(hero: Sprite, x: number, y: number): void {
    const phaser = isPhaserRuntime()

    // Phaser: emit an event beat instead of spawning an Arcade-side placeholder sprite.
    if (phaser) {
        _animEvent_emit(hero, EVENT_MASK_AGI_EXEC_SLASH, x | 0, y | 0, 0, 0)
        if (DEBUG_ANIM_KEYS) console.log(_dbgAnimKeysLine(-1, hero, "EVENT_EMIT"))
        return
    }

    // Pure Arcade fallback (unchanged behavior)
    const v = sprites.create(image.create(10, 10), SpriteKind.HeroWeapon)
    v.image.fill(0)
    v.image.drawRect(0, 0, 10, 10, 5)
    v.image.drawLine(1, 8, 8, 1, 5)
    v.x = x; v.y = y
    v.z = 999
    sprites.setDataNumber(v, PROJ_DATA.DESTROY_AT, (game.runtime() | 0) + 120)
    heroProjectiles.push(v)
}





function agiBeginExecute(heroIndex: number, hero: Sprite, execRadius: number, slowPct: number, slowDurMs: number): void {
    // Execute selection is an EXIT from combo mode (but we KEEP packets for execute).
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_MODE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAND_ARMED_FOR_DU, 0)

    // Prevent any landing-based re-arm from firing after execute (dash is over conceptually).
    sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)

    // If no packets, just disarm cleanly (and unlock).
    const arr = agiPacketsEnsure(heroIndex)
    if (!arr || arr.length <= 0) {
        sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CHAIN, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS, 0)

        sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

        heroBusyUntil[heroIndex] = 0
        sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)
        unlockHeroControls(heroIndex)

        destroyAgiAimIndicator(heroIndex)
        agiPacketsClear(heroIndex, hero)

        if (DEBUG_AGI_COMBO_EXIT) {
            console.log(`[agi.combo.exit] EXEC(noPackets) hero=${heroIndex}`)
        }
        return
    }

    sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.EXECUTING)

    // Freeze motion; execute has no movement
    hero.vx = 0
    hero.vy = 0

    // Save origin so we can restore after the sequence
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_ORIG_X, hero.x | 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_ORIG_Y, hero.y | 0)

    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_RADIUS, execRadius | 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_STEP, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_INTERVAL_MS, AGI_EXEC_STEP_MS | 0)

    const now = (game.runtime() | 0)

    // Interval (minimum floor so slashes are visible)
    const dtBase = (AGI_EXEC_STEP_MS | 0)
    const dt = Math.max(dtBase, (AGI_EXEC_STEP_MS_MIN | 0)) | 0

    // Schedule first beat immediately
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS, now)

    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_SLOW_PCT, slowPct | 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_SLOW_DUR_MS, slowDurMs | 0)

    // Hide pendulum immediately while executing
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

    // Keep controls locked through execute (we’ll unlock when done)
    lockHeroControls(heroIndex)

    // ------------------------------------------------------------
    // Phase window publish NOW (deterministic)
    // ------------------------------------------------------------
    const totalSteps = Math.max(1, (arr.length | 0)) | 0
    const phaseStart = now
    const phaseDur = Math.max(1, ((totalSteps * dt) | 0)) | 0

    _animKeys_stampPhaseWindow(
        heroIndex,
        hero,
        "slash",
        phaseStart,
        phaseDur,
        "agiBeginExecute"
    )

    // Start first beat part immediately as "teleport"
    _animKeys_setPhasePart(hero, "teleport", phaseStart, Math.max(1, Math.idiv(dt * AGI_EXEC_TELEPORT_FRAC_X1000, 1000)), now)

    if (DEBUG_AGI_COMBO_EXIT) {
        console.log(`[agi.combo.exit] EXEC(begin) hero=${heroIndex} packets=${arr.length} dt=${dt} phaseDur=${phaseDur}`)
    }
}





function agiFinishExecute(heroIndex: number, hero: Sprite): void {
    const ox = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_ORIG_X) | 0
    const oy = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_ORIG_Y) | 0
    if (ox !== 0 || oy !== 0) {
        hero.x = ox
        hero.y = oy
    }

    // Execute is an EXIT from combo mode (belt-and-suspenders)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_MODE, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAND_ARMED_FOR_DU, 0)

    // Prevent any landing-based re-arm from firing after execute
    sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)

    sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHAIN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS, 0)

    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_STEP, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_RADIUS, 0)

    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

    agiPacketsClear(heroIndex, hero)

    heroBusyUntil[heroIndex] = 0
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)
    unlockHeroControls(heroIndex)

    // NEW: cleanup indicator sprite
    destroyAgiAimIndicator(heroIndex)

    if (DEBUG_AGI_COMBO_EXIT) {
        console.log(`[agi.combo.exit] EXEC(finish) hero=${heroIndex}`)
    }
}



function updateAgilityExecuteAll(nowMs: number): void {
    const now = nowMs | 0

    for (let heroIndex = 0; heroIndex < heroes.length; heroIndex++) {
        const hero = heroes[heroIndex]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) continue

        const state = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        if (state !== AGI_STATE.EXECUTING) continue

        // Interval (minimum floor so slashes are visible)
        const interval = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_INTERVAL_MS) | 0
        const dtBase = (interval > 0 ? interval : (AGI_EXEC_STEP_MS | 0)) | 0
        const dt = Math.max(dtBase, (AGI_EXEC_STEP_MS_MIN | 0)) | 0

        // ------------------------------------------------------------
        // Whole-phase window (should already be stamped at agiBeginExecute)
        // ------------------------------------------------------------
        let phaseStart = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
        let phaseDur = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0

        // Defensive fallback (should be rare now)
        if (phaseStart <= 0 || phaseDur <= 0) {
            const arrTmp = agiPacketsEnsure(heroIndex)
            const rem = (arrTmp ? (arrTmp.length | 0) : 0) | 0
            const done = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_STEP) | 0
            const totalSteps = Math.max(1, (done + rem) | 0) | 0

            phaseStart = now
            phaseDur = Math.max(1, ((totalSteps * dt) | 0)) | 0

            _animKeys_stampPhaseWindow(
                heroIndex,
                hero,
                "slash",
                phaseStart,
                phaseDur,
                "updateAgilityExecuteAll:fallbackStamp"
            )
        }

        // Whole-phase progress
        const phaseElapsed = clampInt(now - phaseStart, 0, phaseDur)
        const phaseProg = clampInt(
            Math.idiv(PHASE_PROGRESS_MAX * phaseElapsed, Math.max(1, phaseDur)),
            0,
            PHASE_PROGRESS_MAX
        )
        sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, phaseProg)

        // ------------------------------------------------------------
        // Beat window + subparts (teleport / strike / recover)
        // Deterministic beatStart = phaseStart + step*dt
        // ------------------------------------------------------------
        const stepNow = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_STEP) | 0
        let beatStart = (phaseStart + (stepNow * dt)) | 0
        if (beatStart > now) beatStart = now // clamp immediate-after-step edge

        const beatElapsed = clampInt((now - beatStart) | 0, 0, dt)
        const beatProg = clampInt(
            Math.idiv(PHASE_PROGRESS_MAX * beatElapsed, Math.max(1, dt)),
            0,
            PHASE_PROGRESS_MAX
        )

        const tpDur = Math.max(1, Math.idiv(dt * AGI_EXEC_TELEPORT_FRAC_X1000, 1000)) | 0
        const stDur = Math.max(1, Math.idiv(dt * AGI_EXEC_STRIKE_FRAC_X1000, 1000)) | 0
        let rcDur = (dt - tpDur - stDur) | 0
        if (rcDur <= 0) rcDur = 1

        let desiredPart = "recover"
        let partStart = beatStart
        let partDur = rcDur

        if (beatElapsed < tpDur) {
            desiredPart = "teleport"
            partStart = beatStart
            partDur = tpDur
        } else if (beatElapsed < (tpDur + stDur)) {
            desiredPart = "strike"
            partStart = (beatStart + tpDur) | 0
            partDur = stDur
        } else {
            desiredPart = "recover"
            partStart = (beatStart + tpDur + stDur) | 0
            partDur = rcDur
        }

        // Stamp phase part (transition-aware is handled inside _animKeys_setPhasePart
        // in your codebase pattern; we call every frame to keep it authoritative).
        _animKeys_setPhasePart(hero, desiredPart, partStart, partDur, now)

        // Optional: if you want Phaser to have the per-beat progress too, publish it
        // as PhasePartProgress when desiredPart is "teleport/strike/recover".
        // (If _animKeys_setPhasePart already sets PhasePartProgress, this is redundant.)
        sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, beatProg)

        // ------------------------------------------------------------
        // Beat execution (only when it's time)
        // ------------------------------------------------------------
        const nextMs = (sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS) | 0)
        if (nextMs > 0 && now < nextMs) continue

        const execRadius = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_RADIUS) | 0
        const slowPct = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_SLOW_PCT) | 0
        const slowDurMs = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_SLOW_DUR_MS) | 0

        const arr = agiPacketsEnsure(heroIndex)
        if (!arr || arr.length <= 0) {
            agiFinishExecute(heroIndex, hero)
            continue
        }

        // Determine current step BEFORE consuming so parity is stable
        const step0 = sprites.readDataNumber(hero, HERO_DATA.AGI_EXEC_STEP) | 0

        // Consume one packet per step
        const packetDamage = (arr.shift() | 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_COUNT, arr.length)
        const prevSum = sprites.readDataNumber(hero, HERO_DATA.AGI_PKT_SUM) | 0
        sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_SUM, Math.max(0, prevSum - packetDamage))

        // Pick target (radius-only)
        const eIndex = agiSelectBestEnemyInRadius(hero.x, hero.y, execRadius)
        if (eIndex < 0) {
            agiFinishExecute(heroIndex, hero)
            continue
        }

        const enemy = enemies[eIndex]
        if (!enemy || (enemy.flags & sprites.Flag.Destroyed)) {
            // Skip this step; schedule next tick quickly
            sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS, now + 1)
            continue
        }

        // Teleport placement knobs
        let offX = 0
        let offY = 0

        if (AGI_EXEC_POS_MODE === 0) {
            offX = 0
            offY = AGI_EXEC_OFFSET_Y_ABOVE
        } else if (AGI_EXEC_POS_MODE === 1) {
            offX = -AGI_EXEC_OFFSET_X_SIDE
            offY = 0
        } else if (AGI_EXEC_POS_MODE === 2) {
            offX = AGI_EXEC_OFFSET_X_SIDE
            offY = 0
        } else if (AGI_EXEC_POS_MODE === 3) {
            offX = (step0 & 1) ? AGI_EXEC_OFFSET_X_SIDE : -AGI_EXEC_OFFSET_X_SIDE
            offY = 0
        } else if (AGI_EXEC_POS_MODE === 4) {
            offX = (Math.randomRange(0, 1) === 0) ? -AGI_EXEC_OFFSET_X_SIDE : AGI_EXEC_OFFSET_X_SIDE
            offY = 0
        }

        hero.x = enemy.x + offX
        hero.y = enemy.y + offY

        // Force facing DOWN each execute hit (so animation looks consistent)
        if (AGI_EXEC_FORCE_FACING_DOWN) {
            heroFacingX[heroIndex] = 0
            heroFacingY[heroIndex] = 1
            syncHeroDirData(heroIndex)
        }

        // Status (Trait4): slow on execute hits
        if (slowPct > 0 && slowDurMs > 0) {
            sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_PCT, slowPct)
            sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_UNTIL, now + slowDurMs)
        }

        if (packetDamage > 0) {
            applyDamageToEnemyIndex(eIndex, packetDamage)
        }

        agiSpawnExecuteSlashVfx(hero, enemy.x, enemy.y)

        // Advance step + schedule next
        const step1 = (step0 + 1) | 0
        sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_STEP, step1)
        sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS, now + dt)
    }
}


// DEBUG helpers (unchanged)
function debugAgilityDashProgress(hero: Sprite, heroIndex: number) { /* unchanged */ }

function debugDashIntegratorTick(hero: Sprite) { /* unchanged */ }

// NEW: combo pop ("1x", …)
function showComboPop(hero: Sprite, multX: number) {
    const t = textsprite.create(multX + "x")
    t.setPosition(hero.x, hero.y - 12)
    t.setMaxFontHeight(6)
    t.lifespan = 500
    t.vy = -15
}



function ensureAgiStoredCounter(heroIndex: number): Sprite {
    let t = heroAgiStoredCounters[heroIndex]
    const hero = heroes[heroIndex]; if (!hero) return null

    if (!t) {
        t = textsprite.create("0")
        t.setMaxFontHeight(6)
        t.z = hero.z + 3
        heroAgiStoredCounters[heroIndex] = t

        // Tag for Phaser-native execute FX targeting
        sprites.setDataString(t, UI_KIND_KEY, UI_KIND_AGI_STORED_COUNTER)

        // Copy hero owner so Phaser can match counter ↔ hero deterministically
        const owner = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        sprites.setDataNumber(t, HERO_DATA.OWNER, owner)
    }

    return t
}




function ensureComboMeter(heroIndex: number): Sprite {
    let m = heroComboMeters[heroIndex]
    const hero = heroes[heroIndex]; if (!hero) return null

    if (!m) {
        const phaser = isPhaserRuntime()

        // In Arcade: meter is a real pixel image sprite.
        // In Phaser: meter is drawn as native rectangles; this sprite is just a logical anchor + data carrier.
        const w = (AGI_METER_W_E * 2) + (AGI_METER_W_1 * 2) + (AGI_METER_W_2 * 2) + AGI_METER_W_3
        const h = AGI_METER_H

        const img = phaser
            ? image.create(2, 2)      // tiny dummy; Phaser uses rectangles
            : image.create(w, h)      // full size; Arcade uses pixels

        m = sprites.create(img, SpriteKind.HeroAura)
        m.z = hero.z + 2
        heroComboMeters[heroIndex] = m

        // Robust ID: do NOT rely on SpriteKind (combo meter is HeroAura).
        sprites.setDataString(m, UI_KIND_KEY, UI_KIND_COMBO_METER)

        // Seed defaults so Phaser renderer has something even before first update tick.
        sprites.setDataNumber(m, UI_COMBO_TOTAL_W_KEY, w)
        sprites.setDataNumber(m, UI_COMBO_H_KEY, h)
        sprites.setDataNumber(m, UI_COMBO_W_E_KEY, AGI_METER_W_E)
        sprites.setDataNumber(m, UI_COMBO_W_1_KEY, AGI_METER_W_1)
        sprites.setDataNumber(m, UI_COMBO_W_2_KEY, AGI_METER_W_2)
        sprites.setDataNumber(m, UI_COMBO_W_3_KEY, AGI_METER_W_3)
        sprites.setDataNumber(m, UI_COMBO_POS_X1000_KEY, 0)
        sprites.setDataNumber(m, UI_COMBO_VISIBLE_KEY, 0)
        sprites.setDataNumber(m, UI_COMBO_PKT_COUNT_KEY, 0)
    }

    return m
}


function ensureAgiAimIndicator(heroIndex: number): Sprite {
    let ind = heroAgiAimIndicators[heroIndex]
    const hero = heroes[heroIndex]; if (!hero) return null

    if (!ind) {
        // In Arcade: we will setImage() during the ARMED tick.
        // In Phaser: this is only a logical anchor + data carrier; Phaser renders natively.
        const img = image.create(2, 2)

        ind = sprites.create(img, SpriteKind.HeroAura)
        ind.z = hero.z + 2
        heroAgiAimIndicators[heroIndex] = ind

        // Robust ID: do NOT rely on SpriteKind.
        sprites.setDataString(ind, UI_KIND_KEY, UI_KIND_AGI_AIM_INDICATOR)

        // Seed defaults so host-side has sane values even before first tick update.
        sprites.setDataNumber(ind, UI_AIM_VISIBLE_KEY, 0)
        sprites.setDataNumber(ind, UI_AIM_DIR_X1000_KEY, 1000)
        sprites.setDataNumber(ind, UI_AIM_DIR_Y1000_KEY, 0)
        sprites.setDataNumber(ind, UI_AIM_ANGLE_MDEG_KEY, 0)
        sprites.setDataNumber(ind, UI_AIM_LEN_KEY, AGI_AIM_INDICATOR_LEN)

        // Default hidden everywhere. (Phaser always stays invisible for pixels.)
        ind.setFlag(SpriteFlag.Invisible, true)
    }

    return ind
}


function setAgiAimIndicatorVisible(heroIndex: number, vis: boolean): void {
    const ind = ensureAgiAimIndicator(heroIndex); if (!ind) return

    sprites.setDataNumber(ind, UI_AIM_VISIBLE_KEY, vis ? 1 : 0)

    if (isPhaserRuntime()) {
        // Never allow Arcade pixels for this in Phaser; host draws natively.
        ind.setFlag(SpriteFlag.Invisible, true)
    } else {
        // Arcade fallback: show/hide pixels normally.
        ind.setFlag(SpriteFlag.Invisible, !vis)
    }
}


function destroyAgiAimIndicator(heroIndex: number): void {
    const ind = heroAgiAimIndicators[heroIndex]
    if (!ind) return

    // In Phaser, UI sprites are represented by native Containers/Graphics.
    // Hard-destroying them can race the renderer and produce glTexture-null
    // if a texture/frame is removed mid-batch. So: soft-hide instead.
    if (isPhaserRuntime()) {
        sprites.setDataNumber(ind, UI_AIM_VISIBLE_KEY, 0) //UI_VIS_KEY reference error
        ind.setFlag(SpriteFlag.Invisible, true)
        return
    }

    ind.destroy()
    heroAgiAimIndicators[heroIndex] = null
}


function computeHeroAimForIndicator(
    heroIndex: number,
    hero: Sprite
): { dx1000: number; dy1000: number; angleMdeg: number; nx: number; ny: number } {
    // Aim comes from facing.
    let v = getAimVectorForHero(heroIndex)
    let dx = v[0], dy = v[1]

    // Normalize
    const len = Math.sqrt(dx * dx + dy * dy)
    let nx: number
    let ny: number
    if (len > 0) {
        nx = dx / len
        ny = dy / len
    } else {
        nx = 1
        ny = 0
    }

    const dx1000 = Math.round(nx * 1000)
    const dy1000 = Math.round(ny * 1000)

    const angleDeg = (Math.atan2(ny, nx) * 180) / Math.PI
    const angleMdeg = Math.round(angleDeg * 1000)

    return { dx1000, dy1000, angleMdeg, nx, ny }
}




function updateAgilityThrustMotionAll(nowMs: number): void {
    const now = nowMs | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        const lungeStart = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeStartMs) | 0
        const lungeEnd = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeEndMs) | 0
        if (lungeStart <= 0 || lungeEnd <= 0) continue

        // If we’re in build/execute mode, never apply lunge velocity or phase parts
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        if (agiState === AGI_STATE.ARMED || agiState === AGI_STATE.EXECUTING) {
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            hero.vx = 0
            hero.vy = 0
            _animKeys_clearPhasePart(hero)
            continue
        }

        // Determine the intended end of the full move window for landing progression.
        // Prefer BUSY_UNTIL (authoritative lock), then fall back to PhaseStart+Duration.
        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        const phaseStart = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
        const phaseDur = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
        let phaseEnd = (phaseStart > 0 && phaseDur > 0) ? ((phaseStart + phaseDur) | 0) : 0
        if (busyUntil > 0 && (phaseEnd <= 0 || busyUntil > phaseEnd)) phaseEnd = busyUntil
        if (phaseEnd <= 0) phaseEnd = (lungeEnd + 1) | 0

        // Decide which part we are in
        let desiredPart = ""
        if (now < lungeStart) desiredPart = "windup"
        else if (now < lungeEnd) desiredPart = "forward"
        else desiredPart = "landing"

        // Transition-based PhasePart stamping:
        // Only set Name/Start/Duration when the part actually changes.
        const curPart = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
        if (curPart !== desiredPart) {
            if (desiredPart === "windup") {
                const windStart = (phaseStart > 0 ? phaseStart : now) | 0
                let windDur = (lungeStart - windStart) | 0
                if (windDur <= 0) windDur = 1
                sprites.setDataString(hero, HERO_DATA.PhasePartName, "windup")
                sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, windStart)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, windDur)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)
            } else if (desiredPart === "forward") {
                let fwdDur = (lungeEnd - lungeStart) | 0
                if (fwdDur <= 0) fwdDur = 1
                sprites.setDataString(hero, HERO_DATA.PhasePartName, "forward")
                sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, lungeStart | 0)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, fwdDur)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)
            } else { // landing
                let landDur = (phaseEnd - lungeEnd) | 0
                if (landDur <= 0) landDur = 1
                sprites.setDataString(hero, HERO_DATA.PhasePartName, "landing")
                sprites.setDataNumber(hero, HERO_DATA.PhasePartStartMs, lungeEnd | 0)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartDurationMs, landDur)
                sprites.setDataNumber(hero, HERO_DATA.PhasePartFlags, 0)
            }
        }

        // Velocity behavior (still per-frame)
        if (desiredPart === "windup") {
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            hero.vx = 0
            hero.vy = 0
        } else if (desiredPart === "forward") {
            const ax1000 = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeDirX1000) | 0
            const ay1000 = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeDirY1000) | 0
            const speed = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeSpeed) | 0

            const vx = Math.idiv(ax1000 * speed, 1000)
            const vy = Math.idiv(ay1000 * speed, 1000)

            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, vx)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, vy)

            // STEP 7: Apply motion directly so dash travel works even if lock loop is bypassed
            hero.vx = vx
            hero.vy = vy
        } else { // landing
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            hero.vx = 0
            hero.vy = 0
        }

        // Progress update only (per-frame)
        const partStart = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
        let partDur = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
        if (partDur <= 0) partDur = 1

        let t = (now - partStart) | 0
        if (t < 0) t = 0
        if (t > partDur) t = partDur

        let prog = Math.idiv(t * PHASE_PROGRESS_MAX, partDur)
        if (prog < 0) prog = 0
        if (prog > PHASE_PROGRESS_MAX) prog = PHASE_PROGRESS_MAX
        sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, prog)

        // NEW universal contract: keep the coarse whole-phase progress updated too.
        let phaseProg = prog
        if (phaseStart > 0 && phaseDur > 0) {
            let pt = (now - phaseStart) | 0
            if (pt < 0) pt = 0
            if (pt > phaseDur) pt = phaseDur
            phaseProg = Math.idiv(pt * PHASE_PROGRESS_MAX, phaseDur)
            if (phaseProg < 0) phaseProg = 0
            if (phaseProg > PHASE_PROGRESS_MAX) phaseProg = PHASE_PROGRESS_MAX
        }
        sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, phaseProg)

        // Clear schedule once full action window has finished so PartProgress keeps updating during landing.
        if (now >= phaseEnd) {
            sprites.setDataNumber(hero, HERO_DATA.AgilityLungeStartMs, 0)
            sprites.setDataNumber(hero, HERO_DATA.AgilityLungeEndMs, 0)
            sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirX1000, 0)
            sprites.setDataNumber(hero, HERO_DATA.AgilityLungeDirY1000, 0)
            sprites.setDataNumber(hero, HERO_DATA.AgilityLungeSpeed, 0)

            // Ensure we don't keep drifting after schedule ends
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            hero.vx = 0
            hero.vy = 0

            // Don’t keep “landing” around after the schedule ends
            _animKeys_clearPhasePart(hero)
        }
    }
}



// --------------------------------------------------------------
// C3: Agility packets + meter snapshot helpers (NO execute yet)
// --------------------------------------------------------------



function agiPacketsEnsure(heroIndex: number): number[] {
    let arr = agiPacketBankByHeroIndex.get(heroIndex)
    if (!arr) {
        arr = []
        agiPacketBankByHeroIndex.set(heroIndex, arr)
    }
    return arr
}

function agiPacketsClear(heroIndex: number, hero: Sprite): void {
    agiPacketBankByHeroIndex.set(heroIndex, [])
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_COUNT, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_SUM, 0)
}

function agiPacketsAppend(heroIndex: number, hero: Sprite, packetDamage: number, count: number): void {
    if (count <= 0) return
    const arr = agiPacketsEnsure(heroIndex)
    for (let i = 0; i < count; i++) arr.push(packetDamage)

    const newCount = arr.length
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_COUNT, newCount)

    // Maintain a running sum (cheap + useful for UI/debug later)
    const prevSum = sprites.readDataNumber(hero, HERO_DATA.AGI_PKT_SUM) | 0
    sprites.setDataNumber(hero, HERO_DATA.AGI_PKT_SUM, prevSum + (packetDamage * count))
}




// Compute the current pendulum position (0..1000) using the same triangle-wave logic as C2 UI.
// IMPORTANT: this is used by press logic so UI == gameplay.
function agiMeterPosX1000(hero: Sprite, nowMs: number): number {
    let meterStart = sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0
    if (meterStart <= 0) {
        meterStart = nowMs | 0
        sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, meterStart)
    }

    // C6: period is affected by Trait3 (Time) if flag is enabled.
    // Higher Time => slower pendulum.
    let period = AGI_METER_PERIOD_MS | 0
    if (AGI_TIME_AFFECTS_PENDULUM) {
        const tTime = sprites.readDataNumber(hero, HERO_DATA.TRAIT3) | 0
        // 1200ms base + 10ms per point (tunable)
        period = 1200 + Math.max(0, tTime) * 10
        if (period < 400) period = 400
        if (period > 4000) period = 4000
    }

    let t = (nowMs - meterStart) % period
    if (t < 0) t += period
    const half = (period >> 1) || 1

    let pos: number
    if (t <= half) pos = Math.idiv(t * 1000, half)
    else pos = Math.idiv((period - t) * 1000, half)

    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, pos)
    return pos
}



// --------------------------------------------------------------
// C5: Manual cancel while ARMED (hold movement input to break lock)
// --------------------------------------------------------------

function getControllerForOwnerId(ownerId: number): controller.Controller {
    if (ownerId === 1) return controller.player1
    if (ownerId === 2) return controller.player2
    if (ownerId === 3) return controller.player3
    if (ownerId === 4) return controller.player4
    return null
}


function cancelAgilityComboNow(heroIndex: number, hero: Sprite) {
    if (!hero) return

    const nowMs = Math.max(1, game.runtime() | 0)

    // Clear combo / meter state
    sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.NONE)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CHAIN, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

    // Clear cancel bookkeeping
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

    // Clear packets + aim indicator
    agiPacketsClear(heroIndex, hero)
    destroyAgiAimIndicator(heroIndex)

    // End segmentation + one-shot pulses (no lingering execute sheen / beats)
    _animKeys_clearPhasePart(hero)
    _animEvent_clear(hero)

    // Clear any long dash/execute timers so movement can resume
    sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_NEXT_MS, 0)
    sprites.setDataNumber(hero, HERO_DATA.AGI_EXEC_STEP, 0)

    // Unlock and clear busy so ambient stamping can occur immediately
    clearHeroBusyUntil(heroIndex)
    unlockHeroControls(heroIndex)

    // Unified contract: immediately return to ambient and stamp a valid non-zero phase window.
    updateHeroMovementPhase(nowMs)

    _animInvCheckHeroTimeline(heroIndex, hero, nowMs, "cancelAgilityComboNow")
}





function updateAgilityComboLandingTransitions(nowMs: number): void {
    const now = nowMs | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
        if (dashUntil <= 0) continue
        if (now < dashUntil) continue // not landed yet

        // Guard: only process a given landing once per dashUntil value.
        const armedDu0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_LAND_ARMED_FOR_DU) | 0
        if (armedDu0 === dashUntil) continue
        sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_LAND_ARMED_FOR_DU, dashUntil)

        const agiState0 = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        if (agiState0 === AGI_STATE.EXECUTING) continue

        const family0 = sprites.readDataNumber(hero, HERO_DATA.FAMILY) | 0
        const comboMode0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_MODE) | 0

        // ------------------------------------------------------------
        // Case A: combo mode already ON → re-arm meter on every AGI landing
        // ------------------------------------------------------------
        if (comboMode0) {
            if (family0 !== FAMILY.AGILITY) {
                // Safety: if we somehow landed from a non-agility family while in combo mode,
                // cancel everything cleanly.
                if (DEBUG_AGI_COMBO_LANDING) {
                    console.log(`[agi.combo.land] cancelNonAgi hero=${hi} family=${family0} dashUntil=${dashUntil} now=${now}`)
                }
                cancelAgilityComboNow(hi, hero)
                continue
            }

            // Arm meter for selection
            sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.ARMED)
            sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, now)
            sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

            // Reset cancel bookkeeping so "hold direction to cancel" is steady
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

            // Critical: clear busy so movement-phase can enter combatIdle while ARMED
            heroBusyUntil[hi] = 0
            sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)

            if (DEBUG_AGI_COMBO_LANDING) {
                console.log(`[agi.combo.land] rearm hero=${hi} dashUntil=${dashUntil} now=${now}`)
            }
            continue
        }

        // ------------------------------------------------------------
        // Case B: combo mode OFF → entry attempt only if this landing matches the
        //         marked entry dash and the initiating button is still held now.
        // ------------------------------------------------------------
        const entryDu = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL) | 0
        if (entryDu > 0 && entryDu === dashUntil && family0 === FAMILY.AGILITY) {
            const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
            const entryBtnId = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN) | 0

            // Clear the entry attempt regardless (one-shot)
            sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, 0)

            const heldNow = isStrBtnIdPressedForOwner(ownerId, entryBtnId)

            if (DEBUG_AGI_COMBO_LANDING) {
                console.log(
                    `[agi.combo.land] entryCheck hero=${hi} owner=${ownerId} btnId=${entryBtnId} heldNow=${heldNow ? 1 : 0} dashUntil=${dashUntil} now=${now}`
                )
            }

            if (heldNow) {
                // Enter combo mode + arm meter immediately
                sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_MODE, 1)

                sprites.setDataNumber(hero, HERO_DATA.AGI_STATE, AGI_STATE.ARMED)
                sprites.setDataNumber(hero, HERO_DATA.AGI_METER_START_MS, now)
                sprites.setDataNumber(hero, HERO_DATA.AGI_METER_POS_X1000, 0)

                sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
                sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
                sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
                sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)

                heroBusyUntil[hi] = 0
                sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)

                if (DEBUG_AGI_COMBO) {
                    console.log(`[agi.combo] ENTER hero=${hi} dashUntil=${dashUntil} now=${now}`)
                }
            }
        } else {
            // If some stale entry dash matches, clear it (one-shot cleanup).
            if (entryDu > 0 && entryDu === dashUntil) {
                sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_BTN, 0)
                sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_ENTRY_DASH_UNTIL, 0)
            }
        }
    }
}





function updateAgilityManualCancelAllHeroes(nowMs: number): void {
    for (let heroIndex = 0; heroIndex < heroes.length; heroIndex++) {
        const hero = heroes[heroIndex]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) continue

        const state = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        if (state !== AGI_STATE.ARMED) {
            // Not in ARMED selection state => no manual cancel accumulation.
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)
            continue
        }

        // Don't allow cancel until after landing
        const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL) | 0
        if (dashUntil > 0 && nowMs < dashUntil) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, nowMs | 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)
            continue
        }

        // Grace after meter start
        const meterStart = sprites.readDataNumber(hero, HERO_DATA.AGI_METER_START_MS) | 0
        if (meterStart > 0 && (nowMs - meterStart) < AGI_CANCEL_GRACE_MS) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, nowMs | 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)
            continue
        }

        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)
        if (!locked) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)
            continue
        }

        const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        const ctrl = getControllerForOwnerId(ownerId)
        if (!ctrl) continue

        // Current direction input (if any)
        let dx = 0, dy = 0
        if (ctrl.left.isPressed()) dx = -1
        else if (ctrl.right.isPressed()) dx = 1
        if (ctrl.up.isPressed()) dy = -1
        else if (ctrl.down.isPressed()) dy = 1

        const pressed = (dx !== 0 || dy !== 0)

        let lastTick = sprites.readDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS) | 0
        if (lastTick <= 0) lastTick = nowMs | 0

        let dt = (nowMs - lastTick) | 0
        if (dt < 0) dt = 0
        if (dt > 100) dt = 100
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_LAST_TICK_MS, nowMs | 0)

        if (!pressed) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, 0)
            continue
        }

        // Cancel only counts if you hold a STEADY direction.
        const prevDx = sprites.readDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X) | 0
        const prevDy = sprites.readDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y) | 0
        if (dx !== prevDx || dy !== prevDy) {
            // Direction changed -> reset timer (this allows aiming without canceling)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_X, dx)
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_DIR_Y, dy)
            continue
        }

        // Also: don't allow immediate cancel right after an Agility press;
        // this prevents “combo ends” while you're actively building.
        const lastPress = sprites.readDataNumber(hero, HERO_DATA.AGI_LAST_PRESS_MS) | 0
        if (lastPress > 0 && (nowMs - lastPress) < 260) {
            sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, 0)
            continue
        }

        const hold = (sprites.readDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS) | 0) + dt
        sprites.setDataNumber(hero, HERO_DATA.AGI_CANCEL_HOLD_MS, hold)

        if (hold >= AGI_CANCEL_HOLD_THRESHOLD_MS) {
            if (DEBUG_AGI_COMBO_EXIT) {
                const comboMode0 = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_MODE) | 0
                console.log(`[agi.combo.exit] DIR_CANCEL hero=${heroIndex} owner=${ownerId} comboMode=${comboMode0} hold=${hold} dx=${dx} dy=${dy}`)
            }
            cancelAgilityComboNow(heroIndex, hero)
        }
    }
}
















function calculateAgilityStats(
    baseTimeMs: number,
    traits: number[]
) {
    const stats = makeBaseStats(baseTimeMs)

    // NEW mapping (C6):
    // traits[1] = Damage (packet damage / legacy damage flavor)
    // traits[2] = Reach (dash reach + execute radius)
    // traits[3] = Time (vulnerability window + pendulum speed)
    // traits[4] = Status (slow amount)
    let tDmg = (traits[1] | 0)
    let tReach = (traits[2] | 0)
    let tTime = (traits[3] | 0)
    let tStatus = (traits[4] | 0)

    if (tDmg < 0) tDmg = 0
    if (tReach < 0) tReach = 0
    if (tTime < 0) tTime = 0
    if (tStatus < 0) tStatus = 0

    // ----------------------------------------------------
    // DAMAGE (Trait1)
    // ----------------------------------------------------
    stats[STAT.DAMAGE_MULT] = 60 + tDmg

    // ----------------------------------------------------
    // REACH (Trait2) – dash reach driver
    // ----------------------------------------------------
    stats[STAT.LUNGE_SPEED] = 230 + tReach * 5

    // ----------------------------------------------------
    // MOVE DURATION – baseline (then debug slowmo)
    // ----------------------------------------------------
    let moveDur = baseTimeMs
    if (moveDur < 50) moveDur = 50

    if (AGI_DEBUG_SLOWMO) {
        moveDur = Math.max(50, Math.idiv(moveDur * AGI_DEBUG_MOVE_DUR_MULT_X1000, 1000)) | 0
    }
    stats[STAT.MOVE_DURATION] = moveDur

    // ----------------------------------------------------
    // VULNERABILITY WINDOW (Trait3)
    // ----------------------------------------------------
    if (AGI_TIME_AFFECTS_VULN) {
        stats[STAT.AGILITY_LAND_BUFFER_MS] = AGI_LANDING_BUFFER_MS + tTime * 2
    } else {
        stats[STAT.AGILITY_LAND_BUFFER_MS] = AGI_LANDING_BUFFER_MS
    }

    // ----------------------------------------------------
    // STATUS (Trait4)
    // ----------------------------------------------------
    stats[STAT.SLOW_PCT] = 10 + tStatus * 2
    stats[STAT.SLOW_DURATION] = 200 + tStatus * 20

    // (Old agility combo-window stat is intentionally unused now)
    stats[STAT.COMBO_WINDOW] = 0

    // ----------------------------------------------------
    // TEMP DEBUG: make movement FAR too (speed multiplier)
    // ----------------------------------------------------
    if (AGI_DEBUG_SLOWMO) {
        const sp0 = stats[STAT.LUNGE_SPEED] | 0
        stats[STAT.LUNGE_SPEED] = Math.max(1, Math.idiv(sp0 * AGI_DEBUG_LUNGE_SPEED_MULT_X1000, 1000)) | 0
    }

    return stats
}





function executeAgilityMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[]
) {
    // ✅ NEW: When agility combo v2 is active (ARMED/EXECUTING), do NOT spawn the legacy thrust projectile.
    // The combo system uses the aim-indicator + execute sequence; spawning thrust here creates the "extra arrow".
    const state = (sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0)
    if (state === AGI_STATE.ARMED || state === AGI_STATE.EXECUTING) {
        return
    }

    // Base damage from family + trait-driven multiplier (legacy)
    const baseDamage = getBasePower(FAMILY.AGILITY)
    const damageMult = stats[STAT.DAMAGE_MULT] | 0
    let dmg = Math.idiv(baseDamage * (damageMult || 100), 100)
    if (dmg < 1) dmg = 1

    // C6: build dash hits are off for now (execute-only damage vision)
    if (!AGI_BUILD_HITS_ENEMIES) {
        dmg = 0
    }

    // Status knobs (Trait4 -> stats)
    const slowPct = stats[STAT.SLOW_PCT] | 0
    const slowDurationMs = stats[STAT.SLOW_DURATION] | 0
    const weakenPct = stats[STAT.WEAKEN_PCT] | 0
    const weakenDurationMs = stats[STAT.WEAKEN_DURATION] | 0
    const knockbackPct = stats[STAT.KNOCKBACK_PCT] | 0

    const isHeal = false

    spawnAgilityThrustProjectile(
        heroIndex, hero,
        dmg, isHeal, button,
        slowPct, slowDurationMs,
        weakenPct, weakenDurationMs,
        knockbackPct
    )
}



// Agility combo system + UI meter support
function updateAgilityComboOnHit(heroIndex: number, button: string) {
    const hero = heroes[heroIndex]; if (!hero) return
    const now = game.runtime()
    const lastTime = sprites.readDataNumber(hero, HERO_DATA.LAST_HIT_TIME)
    const lastKey = sprites.readDataString(hero, HERO_DATA.LAST_MOVE_KEY)
    let comboCount = sprites.readDataNumber(hero, HERO_DATA.COMBO_COUNT)
    const delta = now - lastTime
    if (delta < 300 && lastKey != button) comboCount += 1
    else comboCount = 1
    if (comboCount < 1) comboCount = 1
    if (comboCount > 4) comboCount = 4
    const table = [100, 100, 120, 140, 160]
    const mult = table[comboCount]
    sprites.setDataNumber(hero, HERO_DATA.COMBO_COUNT, comboCount)
    sprites.setDataNumber(hero, HERO_DATA.COMBO_MULT, mult)
    sprites.setDataNumber(hero, HERO_DATA.LAST_HIT_TIME, now)
    sprites.setDataString(hero, HERO_DATA.LAST_MOVE_KEY, button)
    showComboPop(hero, comboCount)
}
function getComboDamageMultPct(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) return 100
    const val = sprites.readDataNumber(hero, HERO_DATA.COMBO_MULT)
    return val > 0 ? val : 100
}


// AGILITY - thrust / skewer projectile
function spawnAgilityThrustProjectile(
    heroIndex: number,
    hero: Sprite,
    baseDamage: number,
    isHeal: boolean,
    button: string,
    slowPct: number,
    slowDurationMs: number,
    weakenPct: number,
    weakenDurationMs: number,
    knockbackPct: number
): Sprite {
    const nowMs = game.runtime()

    // Freeze direction at cast (mirror doHeroMoveForPlayer normalization)
    const aim = getAimVectorForHero(heroIndex)
    let nx = aim[0]
    let ny = aim[1]
    if (nx == 0 && ny == 0) {
        nx = 1
        ny = 0
    }
    const mag = Math.sqrt(nx * nx + ny * ny) || 1
    nx /= mag
    ny /= mag

    // Planned reach (center→center), computed earlier into "AGI_L_EXEC"
    let L = sprites.readDataNumber(hero, "AGI_L_EXEC") | 0
    if (L < 1) L = 1

    // Determine when the thrust should become “active”
    // (Forward window start, scheduled by doHeroMoveForPlayer for agility)
    let activateAt = sprites.readDataNumber(hero, HERO_DATA.AgilityLungeStartMs) | 0
    if (activateAt <= 0) activateAt = nowMs

    // Create projectile; updater will replace image + position each frame
    const proj = sprites.create(image.create(2, 2), SpriteKind.HeroWeapon)
    proj.z = hero.z + 1
    proj.vx = 0
    proj.vy = 0
    proj.x = hero.x
    proj.y = hero.y
    proj.setImage(createAgilityArrowSegmentImage(0, 0, nx, ny))

    // Core identifiers
    sprites.setDataString(
        proj,
        PROJ_DATA.MOVE_TYPE,
        (L <= 0 ? "agilityStabLow" : "agilityStab")
    )
    sprites.setDataNumber(proj, PROJ_DATA.HERO_INDEX, heroIndex)
    sprites.setDataString(proj, PROJ_DATA.BUTTON, button)
    sprites.setDataNumber(proj, PROJ_DATA.FAMILY, FAMILY.AGILITY)

    // Combat stats (pass-through from caller)
    sprites.setDataNumber(proj, PROJ_DATA.DAMAGE, baseDamage | 0)
    sprites.setDataNumber(proj, PROJ_DATA.IS_HEAL, isHeal ? 1 : 0)
    sprites.setDataNumber(proj, PROJ_DATA.SLOW_PCT, slowPct | 0)
    sprites.setDataNumber(proj, PROJ_DATA.SLOW_DURATION_MS, slowDurationMs | 0)
    sprites.setDataNumber(proj, PROJ_DATA.WEAKEN_PCT, weakenPct | 0)
    sprites.setDataNumber(proj, PROJ_DATA.WEAKEN_DURATION_MS, weakenDurationMs | 0)
    sprites.setDataNumber(proj, PROJ_DATA.KNOCKBACK_PCT, knockbackPct | 0)

    // Direction + timing fields used by the updater
    sprites.setDataNumber(proj, PROJ_DATA.DIR_X, nx)
    sprites.setDataNumber(proj, PROJ_DATA.DIR_Y, ny)
    sprites.setDataNumber(proj, PROJ_DATA.START_TIME, nowMs)
    sprites.setDataNumber(proj, PROJ_DATA.START_HERO_X, hero.x)
    sprites.setDataNumber(proj, PROJ_DATA.START_HERO_Y, hero.y)

    // Planned reach for execution (center-based; updater converts to front edge frame)
    sprites.setDataNumber(proj, PROJ_DATA.MAX_REACH, L)

    // Activation gate (NEW)
    sprites.setDataNumber(proj, PROJ_DATA.ACTIVATE_AT_MS, activateAt | 0)

    const activeNow = (nowMs >= (activateAt | 0))
    sprites.setDataNumber(proj, PROJ_DATA.IS_ACTIVE, activeNow ? 1 : 0)

    // Runtime fields for updater
    sprites.setDataNumber(proj, PROJ_DATA.LAST_T, nowMs)
    sprites.setDataNumber(proj, PROJ_DATA.ARROW_LEN, 0)
    sprites.setDataNumber(proj, PROJ_DATA.REACH_T, 0)
    sprites.setDataNumber(proj, PROJ_DATA.HIT_MASK, 0)

    // If not active yet: hide + disable overlaps until forward starts
    if (!activeNow) {
        proj.setFlag(SpriteFlag.Invisible, true)
        proj.setFlag(SpriteFlag.Ghost, true)
    } else {
        proj.setFlag(SpriteFlag.Invisible, false)
        proj.setFlag(SpriteFlag.Ghost, false)
    }

    // Keep the V17 dash bookkeeping; updater doesn't depend on it, but other systems might
    const dashEnd = heroBusyUntil[heroIndex] | 0
    sprites.setDataNumber(proj, PROJ_DATA.DASH_END_MS, dashEnd)

    // Track for per-frame updates
    heroProjectiles.push(proj)

    // Debug stamp (kept from V10/V17 hybrid)
    if (DEBUG_AGILITY) {
        let seq = sprites.readDataNumber(hero, "DBG_SEQ") | 0
        seq++
        sprites.setDataNumber(hero, "DBG_SEQ", seq)
        sprites.setDataNumber(proj, "dbgId", seq)
        sprites.setDataNumber(proj, "dbgLast", 0)
        function r3(v: number) { return Math.round(v * 1000) / 1000 }
        console.log(
            `[AGI ${seq}] SPAWN hero=${heroIndex} L_exec=${L} dir=(${r3(nx)},${r3(ny)}) ` +
            `activateAt=${activateAt | 0} now=${nowMs | 0} @(${hero.x | 0},${hero.y | 0})`
        )
    }

    return proj
}




// 8.1 — AGILITY helpers (unchanged core)
function createAgilityArrowSegmentImage(sBack: number, sFront: number, nx: number, ny: number): Image { /* same as before */
    const sx = -ny, sy = nx
    let sb = sBack, sf = sFront
    if (sf < sb) { const t = sb; sb = sf; sf = t }
    const pad = 2
    const baseHalf = 1
    const sideHalf = baseHalf + 1
    const fMin = sb
    const fMax = sf + 2
    function cornerX(f: number, wside: number) { return nx * f + sx * wside }
    function cornerY(f: number, wside: number) { return ny * f + sy * wside }
    const xs = [cornerX(fMin, -sideHalf), cornerX(fMin, sideHalf), cornerX(fMax, -sideHalf), cornerX(fMax, sideHalf)]
    const ys = [cornerY(fMin, -sideHalf), cornerY(fMin, sideHalf), cornerY(fMax, -sideHalf), cornerY(fMax, sideHalf)]
    let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0]
    for (let j = 1; j < 4; j++) { if (xs[j] < minX) minX = xs[j]; if (xs[j] > maxX) maxX = xs[j]; if (ys[j] < minY) minY = ys[j]; if (ys[j] > maxY) maxY = ys[j] }
    minX = Math.floor(minX) - pad; maxX = Math.ceil(maxX) + pad
    minY = Math.floor(minY) - pad; maxY = Math.ceil(maxY) + pad
    const w = Math.max(1, maxX - minX + 1), h = Math.max(1, maxY - minY + 1)
    const img = image.create(w, h)
    function mapX(sForward: number, wSide: number) { return Math.round(nx * sForward + sx * wSide) - minX }
    function mapY(sForward: number, wSide: number) { return Math.round(ny * sForward + sy * wSide) - minY }
    const sStart = Math.floor(sb), sEnd = Math.floor(sf)
    for (let s = sStart; s <= sEnd; s++) { const px = mapX(s, 0), py = mapY(s, 0); if (px >= 0 && px < w && py >= 0 && py < h) img.setPixel(px, py, 5) }
    for (let woff = -baseHalf; woff <= baseHalf; woff++) {
        const hx = mapX(sf, woff), hy = mapY(sf, woff); if (hx >= 0 && hx < w && hy >= 0 && hy < h) img.setPixel(hx, hy, 5)
    }
    { const hx = mapX(sf + 1, 0), hy = mapY(sf + 1, 0); if (hx >= 0 && hx < w && hy >= 0 && hy < h) img.setPixel(hx, hy, 5) }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (img.getPixel(x, y) == 5)
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (dx == 0 && dy == 0) continue
            const ox = x + dx, oy = y + dy
            if (ox < 0 || ox >= w || oy < 0 || oy >= h) continue
            if (img.getPixel(ox, oy) == 0) img.setPixel(ox, oy, 15)
        }
    { const nxp = mapX(sf + 2, 0), nyp = mapY(sf + 2, 0); if (nxp >= 0 && nxp < w && nyp >= 0 && nyp < h) img.setPixel(nxp, nyp, 15) }
    { const px = mapX(sf, 0), py = mapY(sf, 0); if (px >= 0 && px < w && py >= 0 && py < h && img.getPixel(px, py) == 0) img.setPixel(px, py, 5) }
    return img
}


// AGILITY - world-space extend + reel motion (V10 behavior)
function updateAgilityProjectilesMotionFor(
    proj: Sprite,
    hero: Sprite,
    heroIndex: number,
    nowMs: number,
    iInArray: number
): boolean {
    // ------------------------------------------------------------
    // NEW: activation gate (windup-safe)
    // ------------------------------------------------------------
    const PREV_S_KEY = "prevS"

    const isActive = (sprites.readDataNumber(proj, PROJ_DATA.IS_ACTIVE) | 0)
    const activateAt = (sprites.readDataNumber(proj, PROJ_DATA.ACTIVATE_AT_MS) | 0)

    if (!isActive) {
        if (activateAt <= 0 || nowMs >= activateAt) {
            // Activate now: become visible and start fresh from this anchor/time
            sprites.setDataNumber(proj, PROJ_DATA.IS_ACTIVE, 1)

            proj.setFlag(SpriteFlag.Invisible, false)
            proj.setFlag(SpriteFlag.Ghost, false)

            sprites.setDataNumber(proj, PROJ_DATA.START_TIME, nowMs | 0)
            sprites.setDataNumber(proj, PROJ_DATA.START_HERO_X, hero.x)
            sprites.setDataNumber(proj, PROJ_DATA.START_HERO_Y, hero.y)

            sprites.setDataNumber(proj, PROJ_DATA.LAST_T, nowMs | 0)
            sprites.setDataNumber(proj, PROJ_DATA.ARROW_LEN, 0)
            sprites.setDataNumber(proj, PROJ_DATA.REACH_T, 0)
            sprites.setDataNumber(proj, PREV_S_KEY, 0)

            // Safety: no stale overlap bookkeeping
            sprites.setDataNumber(proj, PROJ_DATA.HIT_MASK, 0)
        } else {
            // Still in windup: keep hidden + no overlaps; follow hero silently
            proj.setFlag(SpriteFlag.Invisible, true)
            proj.setFlag(SpriteFlag.Ghost, true)

            proj.vx = 0
            proj.vy = 0
            proj.x = hero.x
            proj.y = hero.y

            sprites.setDataNumber(proj, PROJ_DATA.LAST_T, nowMs | 0)
            return true
        }
    }

    // Planned reach measured from HERO CENTER along the dash ray (saved at spawn)
    let L = sprites.readDataNumber(proj, PROJ_DATA.MAX_REACH) || 0
    if (L < 1) L = 1

    // Frozen dash direction saved at spawn; fall back to aim/facing if absent
    let nx = sprites.readDataNumber(proj, PROJ_DATA.DIR_X)
    let ny = sprites.readDataNumber(proj, PROJ_DATA.DIR_Y)
    if (!nx && !ny) {
        const aim = getAimVectorForHero(heroIndex)
        nx = aim[0]
        ny = aim[1]
        if (!nx && !ny) {
            nx = heroFacingX[heroIndex] || 1
            ny = heroFacingY[heroIndex] || 0
        }
    }
    let m = Math.sqrt(nx * nx + ny * ny)
    if (m < 1e-6) {
        nx = 1
        ny = 0
        m = 1
    }
    nx /= m
    ny /= m

    // Anchor point = hero center at *activation time* (world-space)
    const anchorX = sprites.readDataNumber(proj, PROJ_DATA.START_HERO_X)
    const anchorY = sprites.readDataNumber(proj, PROJ_DATA.START_HERO_Y)

    // Distance from hero center to the FRONT EDGE in the dash direction.
    // Prefer the real silhouette edge; fall back to size-based estimate.
    let attachPx = findHeroLeadingEdgeDistance(hero, nx, ny)
    if (attachPx <= 0) {
        attachPx = 0.5 * (Math.abs(nx) * hero.width + Math.abs(ny) * hero.height)
    }

    // Your segment drawer renders a 1px nose at (sf + 2). Stop the "head base" at L - 2,
    // so the visual nose lands at L.
    const sBackAtCast = attachPx
    let sFrontStop = L - 2
    if (sFrontStop <= sBackAtCast) {
        sFrontStop = sBackAtCast + 4
        L = sFrontStop + 2
        sprites.setDataNumber(proj, PROJ_DATA.MAX_REACH, L)
    }
    const maxLen = Math.max(0, sFrontStop - sBackAtCast)

    // Runtime state: previous sample time, current arrow length, and the time we first reached full length
    const lastT = sprites.readDataNumber(proj, PROJ_DATA.LAST_T) || nowMs
    let arrowLen = sprites.readDataNumber(proj, PROJ_DATA.ARROW_LEN) || 0
    let reachT = sprites.readDataNumber(proj, PROJ_DATA.REACH_T) || 0

    // Hero's forward progress along the dash ray (project hero's displacement onto (nx,ny))
    const sHero = (hero.x - anchorX) * nx + (hero.y - anchorY) * ny
    let prevS = sprites.readDataNumber(proj, PREV_S_KEY)
    if (prevS !== 0 && !prevS) prevS = sHero

    const dtSec = Math.max(0.0005, (nowMs - lastT) / 1000)
    const vHero = Math.max(0, (sHero - prevS) / dtSec)

    // Arrow extends faster than the hero to "lead" the dash, then parks and reels in
    const k = 2.5
    const vArrow = vHero * k

    let sBack: number
    let sFront: number

    if (reachT <= 0) {
        // Phase A — extend: grow only the front from the front edge
        arrowLen = arrowLen + vArrow * dtSec
        if (arrowLen >= maxLen) {
            arrowLen = maxLen
            reachT = nowMs
            sprites.setDataNumber(proj, PROJ_DATA.REACH_T, reachT)
        }
        sBack = sBackAtCast
        sFront = sBackAtCast + arrowLen
    } else {
        // Phase B — reel: keep head fixed at sFrontStop; pull tail forward over a fixed short time
        const REEL_MS = 200
        const u = Math.max(0, Math.min(1, (nowMs - reachT) / REEL_MS))
        arrowLen = maxLen * (1 - u)
        if (arrowLen <= 0) {
            proj.destroy()
            heroProjectiles.removeAt(iInArray)
            return false
        }
        sFront = sFrontStop
        sBack = sFront - arrowLen
    }

    // Persist runtime state
    sprites.setDataNumber(proj, PROJ_DATA.LAST_T, nowMs)
    sprites.setDataNumber(proj, PROJ_DATA.ARROW_LEN, arrowLen)
    sprites.setDataNumber(proj, PREV_S_KEY, sHero)

    // --- World-space bounding box for the segment sprite ---
    const sx = -ny
    const sy = nx
    const pad = 2
    const sideHalf = 2

    const fMin = sBack
    const fMax = sFront + 2 // include nose

    function cornerX(f: number, wside: number) { return nx * f + sx * wside }
    function cornerY(f: number, wside: number) { return ny * f + sy * wside }

    const xs = [
        cornerX(fMin, -sideHalf),
        cornerX(fMin, sideHalf),
        cornerX(fMax, -sideHalf),
        cornerX(fMax, sideHalf)
    ]
    const ys = [
        cornerY(fMin, -sideHalf),
        cornerY(fMin, sideHalf),
        cornerY(fMax, -sideHalf),
        cornerY(fMax, sideHalf)
    ]

    let minXW = xs[0], maxXW = xs[0], minYW = ys[0], maxYW = ys[0]
    for (let j = 1; j < 4; j++) {
        if (xs[j] < minXW) minXW = xs[j]
        if (xs[j] > maxXW) maxXW = xs[j]
        if (ys[j] < minYW) minYW = ys[j]
        if (ys[j] > maxYW) maxYW = ys[j]
    }

    minXW = Math.floor(minXW) - pad
    maxXW = Math.ceil(maxXW) + pad
    minYW = Math.floor(minYW) - pad
    maxYW = Math.ceil(maxYW) + pad

    // Replace image and place it in world space
    proj.setImage(createAgilityArrowSegmentImage(sBack, sFront, nx, ny))
    proj.vx = 0
    proj.vy = 0
    proj.x = anchorX + (minXW + maxXW) / 2
    proj.y = anchorY + (minYW + maxYW) / 2

    // Optional: keep V10-style debug trace
    if (DEBUG_AGILITY) {
        const dbgId = sprites.readDataNumber(proj, "dbgId") | 0
        const dbgLast = sprites.readDataNumber(proj, "dbgLast") | 0
        const DBG_INTERVAL_MS = 50
        if (dbgId && nowMs - dbgLast >= DBG_INTERVAL_MS) {
            sprites.setDataNumber(proj, "dbgLast", nowMs)

            const sHeroFront = sHero + attachPx
            const sNose = sFront + 2
            const heroFrontXY = worldPointAlongRay(anchorX, anchorY, nx, ny, sHeroFront)
            const arrowNoseXY = worldPointAlongRay(anchorX, anchorY, nx, ny, sNose)
            const deltaFN = sNose - sHeroFront

            const ax = Math.abs(nx)
            const ay = Math.abs(ny)
            const dirTag = ax > 0.999 ? "HORIZ" : ay > 0.999 ? "VERT" : "DIAG"

            function r(v: number) { return Math.round(v * 100) / 100 }

            console.log(
                `[AGI ${dbgId}] ${dirTag} ` +
                `L=${L} w=${hero.width} h=${hero.height} attachPx=${r(attachPx)} | ` +
                `sBack=${r(sBack)} sFront=${r(sFront)} ` +
                `sHeroFront=${r(sHeroFront)} sNose=${r(sNose)} Δ=${r(deltaFN)} | ` +
                `heroFront=(${heroFrontXY[0] | 0},${heroFrontXY[1] | 0}) ` +
                `nose=(${arrowNoseXY[0] | 0},${arrowNoseXY[1] | 0})`
            )
        }
    }

    return true
}





// ====================================================
// SECTION I - INTELLECT MOVE MODULE
// ====================================================
// Intellect: steerable spells, detonation, lingers, cleanup timers.


//Intellect traits should be calculated using: spell energy/inertia at traits[1], spell AEO size at traits[2], maximum spell targeting duration at traits[3], weakness at traits[4] (weakness is a placeholder until we better define intellect's debuff)
// Intellect
// Intellect traits mapping:
// traits[1] = spell energy / inertia
// traits[2] = spell AOE size
// traits[3] = maximum spell targeting duration
// traits[4] = weakness (debuff)

function calculateIntellectStats(baseTimeMs: number, traits: number[]) {
    const stats = makeBaseStats(baseTimeMs)

    // Pull raw trait values and floor at 0 (no upper caps)
    let tEnergy = (traits[1] | 0)   // energy / inertia
    let tSize = (traits[2] | 0)   // AOE size
    let tTarget = (traits[3] | 0)   // max targeting duration
    let tWeak = (traits[4] | 0)   // weakness debuff

    if (tEnergy < 0) tEnergy = 0
    if (tSize < 0) tSize = 0
    if (tTarget < 0) tTarget = 0
    if (tWeak < 0) tWeak = 0

    // ----------------------------------------------------
    // TARGETING DURATION (traits[3])
    // ----------------------------------------------------
    // How long you can "aim" the spell before it fires.
    // Base 500ms + 50ms per point of tTarget (can get absurdly long).
    let targetingTime = 500000 + tTarget * 50
    // Safety: never allow 0 or negative (shouldn't happen with floor, but just in case):
    if (targetingTime < 50) targetingTime = 50
    stats[STAT.TARGETING_TIME] = targetingTime

    // ----------------------------------------------------
    // AOE SIZE (traits[2]) → ring radius
    // ----------------------------------------------------
    // Base radius 8px + 1px per point of tSize.
    // No cap here; huge values just mean huge circles.
    stats[STAT.RING_RADIUS] = 8 + tSize

    // ----------------------------------------------------
    // ENERGY / INERTIA (traits[1]) → damage, channel power, move duration
    // ----------------------------------------------------
    // Damage multiplier: 60% base + 2% per point of tEnergy
    stats[STAT.DAMAGE_MULT] = 60 + tEnergy * 2

    // Channel power: 100 base + 5 per point of tEnergy
    stats[STAT.CHANNEL_POWER] = 100 + tEnergy * 5

    // Move duration: baseTimeMs + 5ms per point of tEnergy
    // (Big, heavy, high-energy spells take longer.)
    let moveDur = baseTimeMs + tEnergy * 5
    if (moveDur < 50) moveDur = 50 // minimal safety floor
    stats[STAT.MOVE_DURATION] = moveDur

    // ----------------------------------------------------
    // WEAKNESS (traits[4]) → debuff strength and duration
    // ----------------------------------------------------
    // Weaken percent: 5% base + 1% per point of tWeak
    stats[STAT.WEAKEN_PCT] = 5 + tWeak

    // Weaken duration: 500ms base + 20ms per point of tWeak
    stats[STAT.WEAKEN_DURATION] = 500 + tWeak * 20

    return stats
}



function executeIntellectMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[],
    now: number
) {
    const nowMs = now | 0

    // Total time the spell exists pre-detonation (THIS is your “16 seconds”)
    const targetingTime = (stats[STAT.TARGETING_TIME] | 0) || 16000

    const produceMs = INT_PRODUCE_DUR_MS | 0
    const spawnAt = (nowMs + produceMs) | 0

    const expiresAt = (nowMs + (targetingTime | 0)) | 0

    // Hero control metadata
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, true)

    // Store delayed spawn + lifetime on hero (so updateIntellectSpellsControl drives the timeline)
    sprites.setDataNumber(hero, INT_CAST_SPAWN_AT_MS_KEY, spawnAt)
    sprites.setDataNumber(hero, INT_SPELL_EXPIRES_AT_MS_KEY, expiresAt)
    console.log("Set the intellect spell lifetime to ", expiresAt)
    sprites.setDataNumber(hero, INT_CAST_FAMILY_KEY, FAMILY.INTELLECT)
    sprites.setDataString(hero, INT_CAST_BUTTON_KEY, button)
    sprites.setDataNumber(hero, INT_CAST_LAND_END_MS_KEY, 0)

    // Phase = cast for the whole segmented window
    setHeroPhaseString(heroIndex, "cast")
    sprites.setDataString(hero, HERO_DATA.ActionKind, "intellect_cast")

    // Phase window includes: produce + drive + land
    const totalCastMs = ((targetingTime | 0) + (INT_LAND_DUR_MS | 0)) | 0
    _animKeys_stampPhaseWindow(heroIndex, hero, "cast", nowMs, totalCastMs, "executeIntellectMove")

    // PhasePart: PRODUCE (frames 0..4 over produceMs)
    _animKeys_setPhasePart(hero, "produce", nowMs, produceMs, nowMs)

    // Lock hero immediately (produce + drive + land are non-movement)
    lockHeroControls(heroIndex)

    // BusyUntil is only for LAND; we’ll set it at detonation time.
    // (Do NOT set busyUntil to expiresAt — you want spell existence to control “drive”.)
}


function beginIntellectTargeting(
    heroIndex: number,
    expiresAtMsAbs: number, // ABSOLUTE time when the spell should auto-detonate
    button: string,
    family: number
) {
    const hero = heroes[heroIndex]
    if (!hero) return

    const now = game.runtime() | 0
    const expiresAt = (expiresAtMsAbs | 0)
    if (expiresAt <= now) {
        console.log(`[INT] BAD expiresAt hero=${heroIndex} now=${now} expiresAt=${expiresAt}`)
        finishIntellectSpellForHero(heroIndex)
        return
    }

    // Minimal spell sprite (you already replace its image during detonation)
    const imgCore = img`
        . 8 8 8 .
        8 8 8 8 8
        8 8 8 8 8
        . 8 8 8 .
    `
    const spell = sprites.create(imgCore, SpriteKind.HeroWeapon)
    spell.z = hero.z + 1
    spell.x = hero.x
    spell.y = hero.y

    // Spell lifetime (pre-detonation)
    sprites.setDataNumber(spell, INT_SPELL_EXPIRES_AT_MS_KEY, expiresAt)

    // CRITICAL: do not allow lifespan to kill this early
    // (If you *must* set something, set it safely beyond expiresAt + detonate anim)
    spell.lifespan = 0

    // Register
    heroControlledSpells[heroIndex] = spell
    heroProjectiles.push(spell)

    // Metadata used by detonation + damage
    sprites.setDataNumber(spell, PROJ_DATA.HERO_INDEX, heroIndex)
    sprites.setDataNumber(spell, PROJ_DATA.FAMILY, family)
    sprites.setDataString(spell, PROJ_DATA.BUTTON, button)

    console.log(`[INT] SPAWN hero=${heroIndex} now=${now} expiresAt=${expiresAt}`)
}



function runIntellectDetonation(spell: Sprite, lingerMs: number) {
    if (!spell || (spell.flags & sprites.Flag.Destroyed)) return

    const now = game.runtime()

    // How long the tendril animation should last (ms)
    const totalLinger = Math.max(200, Math.min(1200, lingerMs))

    // Pull max radius from traits; fall back to something sane
    let maxRadius = sprites.readDataNumber(spell, INT_RADIUS_KEY) | 0
    if (maxRadius <= 0) maxRadius = 16

    // Make the sprite's image large enough to contain the full explosion
    const size = maxRadius * 2 + 2
    const img = image.create(size, size)
    img.fill(0)
    spell.setImage(img)

    // Center it visually at the same world location
    // (Using spell.x / spell.y as world position is unchanged.)
    spell.z += 1

    // Move sprite so its visual center = actual detonation point
    spell.x -= img.width >> 1
    spell.y -= img.height >> 1

    // Store timing for per-frame animation
    sprites.setDataNumber(spell, INT_DETONATE_START_KEY, now)
    sprites.setDataNumber(spell, INT_DETONATE_END_KEY, now + totalLinger)

    // Schedule actual cleanup: spell will be destroyed AFTER the animation
    sprites.setDataNumber(spell, PROJ_DATA.DESTROY_AT, now + totalLinger + 100)
}


function finishIntellectSpellForHero(heroIndex: number): void {
    if (heroIndex < 0 || heroIndex >= heroes.length) return
    const hero = heroes[heroIndex]
    if (!hero) return

    const nowMs = game.runtime() | 0

    // ---- LOG (before) ----
    if (DEBUG_ANIM_KEYS_INT_FINISH) {
        const ctrl0 = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL) ? 1 : 0
        const busy0 = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        const ph0 = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
        const part0 = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
        const fco0 = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
        const hasSpell = heroControlledSpells[heroIndex] ? 1 : 0
        _dbgAnimKeys(heroIndex, hero, "INT_FINISH_BEGIN",
            `t=${nowMs} ctrl=${ctrl0} hasSpell=${hasSpell} busyUntil=${busy0} ph=${ph0} part=${part0} fco=${fco0}`
        )
    }

    // Release control state (engine-owned)
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, false)

    // IMPORTANT: do NOT destroy the spell here.
    // Detonation helpers call finishIntellectSpellForHero() and then run visuals on the spell.
    if (heroControlledSpells[heroIndex]) heroControlledSpells[heroIndex] = null

    // Clear movement intent + busy lock
    sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
    sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
    hero.vx = 0
    hero.vy = 0
    clearHeroBusyUntil(heroIndex)

    // Clear any action leftovers that can strand the hero in "aura-only" mode
    _animEvent_clear(hero)
    _animKeys_clearPhasePart(hero)

    sprites.setDataNumber(hero, HERO_DATA.RenderStyleMask, 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP0, 0)
    sprites.setDataNumber(hero, HERO_DATA.RenderStyleP1, 0)

    unlockHeroControls(heroIndex)

    // Return to ambient phase ownership (movement resolver will keep it healthy)
    setHeroPhaseString(heroIndex, "idle")

    // ------------------------------------------------------------------
    // ONLY CORRECTION:
    // Reset FAMILY back to movement/base so idle/run/walk resolve correctly
    // after an intellect cast. Otherwise FAMILY can stay "intelligence" and
    // ambient phases will miss frames => hero disappears.
    // ------------------------------------------------------------------
    sprites.setDataNumber(hero, HERO_DATA.FAMILY, 0) // 0 = strength/base movement atlas

    // ---- LOG (after) ----
    if (DEBUG_ANIM_KEYS_INT_FINISH) {
        const ctrl1 = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL) ? 1 : 0
        const busy1 = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        const ph1 = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
        const part1 = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
        const fco1 = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
        _dbgAnimKeys(heroIndex, hero, "INT_FINISH_END",
            `t=${nowMs} ctrl=${ctrl1} busyUntil=${busy1} ph=${ph1} part=${part1} fco=${fco1}`
        )
    }
}



function updateIntellectSpellsControl(): void {
    const nowMs = game.runtime() | 0

    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]
        if (!hero) continue

        // LAND finishing
        const landEnd0 = sprites.readDataNumber(hero, INT_CAST_LAND_END_MS_KEY) | 0
        if (landEnd0 > 0) {
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)

            if (nowMs >= landEnd0) {
                sprites.setDataNumber(hero, INT_CAST_LAND_END_MS_KEY, 0)
                finishIntellectSpellForHero(i)
            }
            continue
        }

        const isCtrl = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)
        if (!isCtrl) continue

        const spell = heroControlledSpells[i]

        // PRODUCE (delayed spawn)
        if (!spell) {
            const spawnAt = sprites.readDataNumber(hero, INT_CAST_SPAWN_AT_MS_KEY) | 0
            const expiresAt = sprites.readDataNumber(hero, INT_SPELL_EXPIRES_AT_MS_KEY) | 0
            const family = sprites.readDataNumber(hero, INT_CAST_FAMILY_KEY) | 0
            const button = sprites.readDataString(hero, INT_CAST_BUTTON_KEY) || ""

            if (spawnAt <= 0 || expiresAt <= 0) {
                console.log(`[INT] LIMBO BAD HERO METADATA hero=${i} now=${nowMs} spawnAt=${spawnAt} expiresAt=${expiresAt}`)
                finishIntellectSpellForHero(i)
                continue
            }

            // Still producing
            if (nowMs < spawnAt) {
                hero.vx = 0
                hero.vy = 0
                sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
                sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
                continue
            }

            // Spawn spell now
            beginIntellectTargeting(i, expiresAt, button, family)

            // Switch to DRIVE part immediately upon spell existing
            const remaining = Math.max(1, (expiresAt - nowMs) | 0) | 0
            _animKeys_setPhasePart(hero, "drive", nowMs, remaining, nowMs)
        }

        const spell2 = heroControlledSpells[i]
        if (!spell2) {
            console.log(`[INT] LIMBO spawn failed hero=${i} now=${nowMs}`)
            finishIntellectSpellForHero(i)
            continue
        }

        if ((spell2.flags & sprites.Flag.Destroyed) !== 0) {
            const exp = sprites.readDataNumber(spell2, INT_SPELL_EXPIRES_AT_MS_KEY) | 0
            console.log(`[INT BUG] SPELL DESTROYED EARLY hero=${i} now=${nowMs} expiresAt=${exp}`)
            finishIntellectSpellForHero(i)
            continue
        }

        // While controlling: hero stays frozen
        hero.vx = 0
        hero.vy = 0
        sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
        sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)

        // Ensure DRIVE phase-part persists as long as spell exists (and not detonated)
        if (!sprites.readDataNumber(spell2, INT_DETONATED_KEY)) {
            const exp = sprites.readDataNumber(spell2, INT_SPELL_EXPIRES_AT_MS_KEY) | 0
            if (exp > 0) {
                const remaining = Math.max(1, (exp - nowMs) | 0) | 0
                _animKeys_setPhasePart(hero, "drive", nowMs, remaining, nowMs)

                if (nowMs >= exp) {
                    console.log("Killing spell with detonate because nowMs is greater than exp")
                    detonateIntellectSpellForHero(i, spell2, nowMs)
                    continue
                }
            }
        }

        // Steering: DRIVE must be authoritative and ONLY move when player is aiming.
        const aim = getAimVectorForHero(i)
        let ax = aim[0] | 0
        let ay = aim[1] | 0

        // DEBUG (throttled): tells us if aim is stuck at 0,0 (causing drift in your old code)
        const nextLogAtKey = "__intDbgNextLogAt"
        const nextLogAt = (sprites.readDataNumber(hero, nextLogAtKey) | 0)
        if (nowMs >= nextLogAt) {
            sprites.setDataNumber(hero, nextLogAtKey, (nowMs + 250) | 0)
            console.log("[INT][DRIVE]",
                "| hero", i,
                "| aim", ax, ay,
                "| spellXY", (spell2.x | 0), (spell2.y | 0),
                "| spellV", (spell2.vx | 0), (spell2.vy | 0),
                "| now", nowMs
            )
        }

        // ✅ Critical change: NO input => STOP (do NOT force ax=1)
        if (ax === 0 && ay === 0) {
            spell2.vx = 0
            spell2.vy = 0
            continue
        }

        const speed = 35
        let mag = Math.sqrt(ax * ax + ay * ay)
        if (mag === 0) mag = 1
        const vx = Math.idiv(ax * speed, mag)
        const vy = Math.idiv(ay * speed, mag)

        spell2.vx = vx
        spell2.vy = vy
    }
}



function detonateIntellectSpellForHero(heroIndex: number, spell: Sprite, nowMs: number): void {
    if (!spell) {
        finishIntellectSpellForHero(heroIndex)
        return
    }
    if (spell.flags & sprites.Flag.Destroyed) {
        finishIntellectSpellForHero(heroIndex)
        return
    }

    // Already detonated? nothing to do.
    if (sprites.readDataNumber(spell, INT_DETONATED_KEY)) return

    const hero = (heroIndex >= 0 && heroIndex < heroes.length) ? heroes[heroIndex] : null

    // ------------------------------------------------------------
    // DRIVE ends here: stop controlling, begin LAND part (frames 5-6)
    // ------------------------------------------------------------
    if (hero) {
        sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, false)

        const landEnd = ((nowMs | 0) + (INT_LAND_DUR_MS | 0)) | 0
        sprites.setDataNumber(hero, INT_CAST_LAND_END_MS_KEY, landEnd)

        // PhasePart: LAND (500ms)
        _animKeys_setPhasePart(hero, "land", nowMs | 0, INT_LAND_DUR_MS | 0, nowMs | 0)

        // Keep frozen during land
        hero.vx = 0
        hero.vy = 0
        sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
        sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
        lockHeroControls(heroIndex)
        setHeroBusyUntil(heroIndex, landEnd)
    }

    const family = sprites.readDataNumber(spell, PROJ_DATA.FAMILY) | 0
    const termX = spell.x | 0
    const termY = spell.y | 0

    if (family === FAMILY.HEAL) {
        detonateHealSpellAt(spell, termX, termY)
    } else {
        console.log("Detonating intellect spell now")
        detonateIntellectSpellAt(spell, termX, termY)
    }
}



function detonateIntellectSpellAt(spell: Sprite, termX: number, termY: number) {
    
    if (!spell) return
    if (sprites.readDataNumber(spell, INT_DETONATED_KEY)) return

    const heroIndex = sprites.readDataNumber(spell, PROJ_DATA.HERO_INDEX) | 0

    // (Optional debug – keep or delete as you like)
    const family = sprites.readDataNumber(spell, PROJ_DATA.FAMILY) | 0
    const dmg = sprites.readDataNumber(spell, PROJ_DATA.DAMAGE) | 0
    console.log(
        `[INT DEBUG] DETONATE intellect hero=${heroIndex} family=${family} ` +
        `at=(${termX},${termY}) dmg=${dmg}`
    )

    // Mark detonated & pin position
    sprites.setDataNumber(spell, INT_DETONATED_KEY, 1)
    sprites.setDataNumber(spell, INT_TERM_X_KEY, termX)
    sprites.setDataNumber(spell, INT_TERM_Y_KEY, termY)
    spell.vx = 0
    spell.vy = 0
    spell.x = termX
    spell.y = termY

    // AoE parameters
    let radius = sprites.readDataNumber(spell, INT_RADIUS_KEY) | 0
    if (radius <= 0) radius = 16
    const rSq = radius * radius

    const weakenPct = sprites.readDataNumber(spell, PROJ_DATA.WEAKEN_PCT) | 0
    const weakenMs = sprites.readDataNumber(spell, PROJ_DATA.WEAKEN_DURATION_MS) | 0

    // Damage from spell data
    const dmgNow = sprites.readDataNumber(spell, PROJ_DATA.DAMAGE) | 0

    // Instant AoE over enemies[]
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]
        if (!e) continue

        if (distSqPointToSprite(termX, termY, e) <= rSq) {
            if (dmgNow > 0) {
                applyDamageToEnemyIndex(i, dmgNow)
                showDamageNumber(e.x, e.y - 6, dmgNow)
            }
            if (weakenPct > 0 && weakenMs > 0) {
                const now = game.runtime()
                sprites.setDataNumber(e, ENEMY_DATA.WEAKEN_PCT, weakenPct)
                sprites.setDataNumber(e, ENEMY_DATA.WEAKEN_UNTIL, now + weakenMs)
            }
        }
    }

    // Visual + cleanup (spell will be destroyed later)
    runIntellectDetonation(spell, Math.max(400, weakenMs))
}




function processIntellectLingers() {
    const now = game.runtime()

    const totalTendrils = 18        // 9 long + 9 short
    const longCount = 9
    const shortCount = totalTendrils - longCount

    const rotationSpeed = 0.008     // radians per ms (spin speed)
    const growthFrac = 0.4          // portion of time spent "growing" before spin

    const jagSegments = 5           // number of steps along each tendril
    const jagAmplitude = 0.5        // BIGGER wiggle (≈ "15" feel instead of "5")

    for (let i = 0; i < heroProjectiles.length; i++) {
        const proj = heroProjectiles[i]
        if (!proj || (proj.flags & sprites.Flag.Destroyed)) continue

        if (!sprites.readDataNumber(proj, INT_DETONATED_KEY)) continue

        const startMs = sprites.readDataNumber(proj, INT_DETONATE_START_KEY) | 0
        const endMs = sprites.readDataNumber(proj, INT_DETONATE_END_KEY) | 0
        if (startMs <= 0 || endMs <= startMs) continue

        const total = endMs - startMs
        const elapsed = now - startMs
        if (elapsed < 0) continue

        // Clamp animation progress [0, 1]
        let t = elapsed / total
        if (t > 1) t = 1

        let maxRadius = sprites.readDataNumber(proj, INT_RADIUS_KEY) | 0
        if (maxRadius <= 0) maxRadius = 16

        // Long tendrils go to full radius; short ones to half radius
        const longMax = maxRadius
        const shortMax = Math.max(1, maxRadius >> 1)

        const currentLongRadius = Math.max(
            1,
            Math.floor(longMax * (0.2 + 0.8 * t))
        )
        const currentShortRadius = Math.max(
            1,
            Math.floor(shortMax * (0.2 + 0.8 * t))
        )

        const img = proj.image
        if (!img) continue

        const w = img.width
        const h = img.height
        const cx = w >> 1
        const cy = h >> 1

        // Clear previous frame
        img.fill(0)

        const colorIndex = 8
        const twoPi = 2 * Math.PI

        // "Grow, then spin": no rotation during the first growthFrac of the lifetime
        const growthMs = total * growthFrac
        let spinElapsed = elapsed - growthMs
        if (spinElapsed < 0) spinElapsed = 0

        const baseAngleLong = spinElapsed * rotationSpeed          // clockwise
        const baseAngleShort = -spinElapsed * rotationSpeed        // counterclockwise

        const heroIndex = sprites.readDataNumber(proj, PROJ_DATA.HERO_INDEX) | 0

        for (let k = 0; k < totalTendrils; k++) {
            const isLong = k < longCount
            const setIndex = isLong ? k : (k - longCount)
            const perSetCount = isLong ? longCount : shortCount

            // Angle fraction within its own ring (9 long distributed, 9 short distributed)
            const fraction = perSetCount > 0 ? setIndex / perSetCount : 0

            const maxR = isLong ? currentLongRadius : currentShortRadius
            const baseAngle = isLong ? baseAngleLong : baseAngleShort

            // Alternate jag pattern: +1 vs -1 (up/down vs down/up)
            const patternSign = (k % 2 == 0) ? 1 : -1

            // Slight per-tendril variation
            const perTendrilPhase = (heroIndex * 0.3 + k * 0.5)

            let prevX = cx
            let prevY = cy

            for (let s = 1; s <= jagSegments; s++) {
                const segFrac = s / jagSegments
                const rBase = maxR * segFrac

                // Flip offset direction each segment for up/down/up/down look
                const segDir = (s % 2 == 0) ? 1 : -1

                // Wiggle angle – larger near center, smaller toward tip
                const wiggle = patternSign * segDir * jagAmplitude * (1 - segFrac)

                const angle = baseAngle
                    + fraction * twoPi
                    + wiggle
                    + perTendrilPhase * 0.02

                const ex = cx + Math.round(rBase * Math.cos(angle))
                const ey = cy + Math.round(rBase * Math.sin(angle))

                // Draw thicker tendril: main line + a slight perpendicular offset
                img.drawLine(prevX, prevY, ex, ey, colorIndex)

                const dx = ex - prevX
                const dy = ey - prevY
                const segLenSq = dx * dx + dy * dy
                if (segLenSq > 0) {
                    // Perpendicular unit step (approx) for width
                    let px = -dy
                    let py = dx
                    // Normalize to length 1-ish
                    if (px != 0 || py != 0) {
                        const mag = Math.sqrt(px * px + py * py)
                        px = Math.idiv(px, mag)
                        py = Math.idiv(py, mag)
                        img.drawLine(prevX + px, prevY + py, ex + px, ey + py, colorIndex)
                    }
                }

                prevX = ex
                prevY = ey
            }
        }

        // Tiny core so center isn't empty
        img.setPixel(cx, cy, colorIndex)
    }
}

// Return control when the projectile ends
sprites.onDestroyed(SpriteKind.HeroWeapon, function (proj) {

    const family = sprites.readDataNumber(proj, PROJ_DATA.FAMILY)
    if (family != FAMILY.INTELLECT && family != FAMILY.HEAL) return

    const heroIndex = sprites.readDataNumber(proj, PROJ_DATA.HERO_INDEX)
    console.log(`[INT DEBUG] onDestroyed heroWeapon hero=${heroIndex} t=${game.runtime()|0} detonated=${sprites.readDataNumber(proj, INT_DETONATED_KEY)|0} destroyAt=${sprites.readDataNumber(proj, PROJ_DATA.DESTROY_AT)|0} lifespan=${proj.lifespan|0}`);

    if (heroIndex < 0 || heroIndex >= heroes.length) return

    if (heroControlledSpells[heroIndex] == proj) {
        heroControlledSpells[heroIndex] = null

        const hero = heroes[heroIndex]
        if (!hero) return

        // If we are in the LAND window, finish will happen when land ends.
        const landEnd = sprites.readDataNumber(hero, INT_CAST_LAND_END_MS_KEY) | 0
        if (landEnd > 0 && (game.runtime() | 0) < landEnd) return

        // Otherwise, recover immediately (safety)
        finishIntellectSpellForHero(heroIndex)
    }
})




// ====================================================
// SECTION H - HEAL AND SUPPORT SPELLS MODULE
// ====================================================
// Heal/support effects. Drives healing & buff application.

// HEAL: one-time detonation that heals heroes only (no enemy effect)

const SUPPORT_BEAM_SPEED = 80 // pixels per second-ish

// Support puzzle timeline budgets (ms)
// (Completion is player-driven, but PhaseDurationMs/PhasePartDurationMs must be non-zero.)
const SUPPORT_PUZZLE_STEP_BUDGET_MS = 400
const SUPPORT_PUZZLE_MIN_TOTAL_MS = 300


// 2-wavelength "sine" made of single pixels (12×7), three phase frames
const SUPPORT_BEAM_WAVE0 = img`
    . . . . . . . . . . . .
    . . 7 . . . . . . . 7 .
    . 7 . 7 . . . . . 7 . 7
    7 . . . 7 . . . 7 . . .
    . . . . . 7 . 7 . . . .
    . . . . . . 7 . . . . .
    . . . . . . . . . . . .
`
const SUPPORT_BEAM_WAVE1 = img`
    . . . . . . . . . . . .
    . 7 . . . . . . . 7 . .
    7 . 7 . . . . . 7 . 7 .
    . . . 7 . . . 7 . . . 7
    . . . . 7 . 7 . . . . .
    . . . . . 7 . . . . . .
    . . . . . . . . . . . .
`
const SUPPORT_BEAM_WAVE2 = img`
    . . . . . . . . . . . .
    . . . 7 . . . . . . . 7
    7 . 7 . 7 . . . . . 7 .
    . 7 . . . 7 . . . 7 . .
    . . . . . . 7 . 7 . . .
    . . . . . . . 7 . . . .
    . . . . . . . . . . . .
`


function spawnSupportBeam(
    casterHeroIndex: number,
    targetHeroIndex: number,
    buffKind: number,
    buffPower: number,
    buffDurationMs: number
) {
    const caster = heroes[casterHeroIndex]
    const target = heroes[targetHeroIndex]
    if (!caster || !target) return

    // Start with a tiny blank image; we'll redraw it programmatically each frame
    const beamImg = image.create(2, 2)
    beamImg.fill(0)

    const beam = sprites.create(beamImg, SpriteKind.SupportBeam)
    beam.x = (caster.x + target.x) / 2
    beam.y = (caster.y + target.y) / 2
    beam.z = caster.z + 1

    sprites.setDataString(beam, PROJ_DATA.MOVE_TYPE, "supportbeam")
    sprites.setDataNumber(beam, PROJ_DATA.HERO_INDEX, casterHeroIndex)
    sprites.setDataNumber(beam, PROJ_DATA.SUPPORT_TARGET_HERO, targetHeroIndex)
    sprites.setDataNumber(beam, PROJ_DATA.SUPPORT_BUFF_KIND, buffKind)
    sprites.setDataNumber(beam, PROJ_DATA.SUPPORT_BUFF_POWER, buffPower)
    sprites.setDataNumber(beam, PROJ_DATA.SUPPORT_BUFF_DURATION, buffDurationMs)

    // Track travel distance along the line from caster → target
    sprites.setDataNumber(beam, "SUP_TRAVEL", 0)

    heroProjectiles.push(beam)
}


function updateSupportBeamFor(proj: Sprite, casterHeroIndex: number, now: number, iInArray: number): boolean {
    const caster = heroes[casterHeroIndex]
    const targetHeroIndex = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_TARGET_HERO) | 0
    const target = heroes[targetHeroIndex]

    if (!caster || (caster.flags & sprites.Flag.Destroyed) || !target || (target.flags & sprites.Flag.Destroyed)) {
        proj.destroy()
        return false
    }

    // World-space line from caster → target
    const x0 = caster.x
    const y0 = caster.y
    const x1 = target.x
    const y1 = target.y

    const dx = x1 - x0
    const dy = y1 - y0
    const distSq = dx * dx + dy * dy
    const dist = Math.sqrt(distSq) || 1

    // If they're basically on top of each other, just finish immediately
    if (dist < 2) {
        const kind = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_KIND) | 0
        const power = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_POWER) | 0
        const dur = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_DURATION) | 0
        console.log("SUPPORT BEAM: very short, applying buff immediately to hero " + targetHeroIndex)
        applySupportBuffToHero(targetHeroIndex, kind, power, dur)
        proj.destroy()
        return false
    }

    // How far the "head" has travelled from caster toward target
    let travel = sprites.readDataNumber(proj, "SUP_TRAVEL") | 0
    const stepPerFrame = 3 // pixels per update
    travel += stepPerFrame
    sprites.setDataNumber(proj, "SUP_TRAVEL", travel)

    // When head passes target, apply buff and end
    if (travel >= dist) {
        const kind = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_KIND) | 0
        const power = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_POWER) | 0
        const dur = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_DURATION) | 0

        console.log("SUPPORT BEAM: reached hero " + targetHeroIndex + ", applying buff")
        applySupportBuffToHero(targetHeroIndex, kind, power, dur)
        proj.destroy()
        return false
    }

    // ------------------------------------------
    // Rectangle that fully spans caster↔target
    // ------------------------------------------
    const margin = 6
    const minX = Math.min(x0, x1) - margin
    const minY = Math.min(y0, y1) - margin
    const maxX = Math.max(x0, x1) + margin
    const maxY = Math.max(y0, y1) + margin

    const imgWidth = Math.max(1, (maxX - minX) | 0)
    const imgHeight = Math.max(1, (maxY - minY) | 0)

    const beamImg = image.create(imgWidth, imgHeight)
    beamImg.fill(0)

    // Position the sprite so its image covers [minX,maxX]×[minY,maxY]
    proj.x = minX + imgWidth / 2
    proj.y = minY + imgHeight / 2

    // ------------------------------------------
    // Wave parameters
    // ------------------------------------------
    const buffPower = sprites.readDataNumber(proj, PROJ_DATA.SUPPORT_BUFF_POWER) | 0

    // Unit direction along the line
    const ux = dx / dist
    const uy = dy / dist

    // Perpendicular direction
    const px = -uy
    const py = ux

    // Head / tail distances along the line
    const headDist = travel
    let tailLength = 10 + buffPower * 0.3
    if (tailLength < 10) tailLength = 10
    if (tailLength > dist * 0.75) tailLength = dist * 0.75
    const tailDist = Math.max(0, headDist - tailLength)

    const twoPi = 6.28318
    const cycles = 2
    const basePhase = (now % 1000) / 1000 * twoPi

    const samples = 40

    // --- Per-buff amplitudes from caster's traits ---
    const pool1 = sprites.readDataNumber(caster, HERO_DATA.TRAIT1) | 0 // heal
    const pool2 = sprites.readDataNumber(caster, HERO_DATA.TRAIT2) | 0 // haste
    const pool3 = sprites.readDataNumber(caster, HERO_DATA.TRAIT3) | 0 // dmg amp
    const pool4 = sprites.readDataNumber(caster, HERO_DATA.TRAIT4) | 0 // shield / DR

    // Map channels: 0=heal, 1=haste, 2=damage amp, 3=shield/DR
    const channelColors = [7, 9, 1, 2] // green, yellow, blue, red

    for (let s = 0; s < samples; s++) {
        const tFrac = s / (samples - 1)
        const dAlong = tailDist + (headDist - tailDist) * tFrac
        if (dAlong < 0 || dAlong > dist) continue

        const wx = x0 + ux * dAlong
        const wy = y0 + uy * dAlong
        const tNorm = dAlong / dist

        // Four possible channels
        for (let c = 0; c < 4; c++) {
            let pool = 0
            if (c == 0) pool = pool1
            else if (c == 1) pool = pool2
            else if (c == 2) pool = pool3
            else pool = pool4

            // If this buff type has no power, skip this wave entirely
            if (pool <= 0) continue

            // Amplitude based ONLY on this buff's power (bounded 2..6)
            let amp = 2 + Math.idiv(Math.abs(pool), 40)
            if (amp < 2) amp = 2
            if (amp > 6) amp = 6

            const col = channelColors[c]

            // Phase-offset per channel so they wrap around instead of stack
            const phaseOffset = (twoPi * c) / 4
            const phase = basePhase + phaseOffset + tNorm * twoPi * cycles

            // Small radial offset so channels sit in slightly different "lanes"
            const radialOffset = (c - 1.5) * 0.6

            const totalOffset = Math.sin(phase) * amp + radialOffset

            const pxWorld = wx + px * totalOffset
            const pyWorld = wy + py * totalOffset

            const ix = Math.round(pxWorld - minX)
            const iy = Math.round(pyWorld - minY)

            if (ix >= 0 && ix < imgWidth && iy >= 0 && iy < imgHeight) {
                beamImg.setPixel(ix, iy, col)
            }
        }
    }

    proj.setImage(beamImg)
    return true
}



// heroBuffs[heroIndex] is your parallel buff array for that hero
function applySupportBuffToHero(heroIndex: number, kind: number, power: number, durationMs: number) {
    const now = game.runtime()
    const arr = heroBuffs[heroIndex]
    if (!arr) {
        console.log("SUPPORT BUFF: no buff array for hero " + heroIndex)
        return
    }

    console.log("SUPPORT BUFF: adding buff kind=" + kind + " power=" + power + " durMs=" + durationMs + " to hero " + heroIndex)

    arr.push({
        kind: kind,
        power: power,
        expiresAt: now + durationMs
    })

    // Visual feedback: green aura flash when buff lands
    triggerSupportGlowPulse(heroIndex)

    // One-time heal baked into buff power (chanPower/dmgMult already baked in)
    applyHealToHeroIndex(heroIndex, power)
}






function updateHeroBuffs(now: number) {
    for (let hi = 0; hi < heroes.length; hi++) {
        const buffs = heroBuffs[hi]
        if (!buffs) continue

        // Remove expired
        for (let j = buffs.length - 1; j >= 0; j--) {
            const b = buffs[j]
            if (!b || now >= (b.expiresAt | 0)) {
                buffs.removeAt(j)
            }
        }

        let totalHaste = 0
        let totalDmgAmp = 0

        for (let j = 0; j < buffs.length; j++) {
            const b = buffs[j]
            if (!b) continue
            if (b.kind == BUFF_KIND_HASTE) {
                totalHaste += (b.power || 0)
            } else if (b.kind == BUFF_KIND_DAMAGE_AMP) {
                totalDmgAmp += (b.power || 0)
            }
        }

        // Haste: totalHaste=50 → 1.5x, 0 → 1x, etc.
        let hasteMult = 1 + totalHaste / 100
        let dmgMult = 1 + totalDmgAmp / 100

        // Clamp so it doesn't go insane
        if (hasteMult < 0.5) hasteMult = 0.5
        if (hasteMult > 3) hasteMult = 3
        if (dmgMult < 0.5) dmgMult = 0.5
        if (dmgMult > 3) dmgMult = 3

        heroMoveSpeedMult[hi] = hasteMult
        heroDamageAmpMult[hi] = dmgMult

        // NEW: mirror buff state into hero sprite data so the wrapper/save system
        // can see it and we can resume mid-buff, mid-dash, etc.
        const hero = heroes[hi]
        if (hero) {
            sprites.setDataNumber(hero, HERO_DATA.MOVE_SPEED_MULT, hasteMult)
            sprites.setDataNumber(hero, HERO_DATA.DAMAGE_AMP_MULT, dmgMult)

            // Shallow JSON snapshot of active buffs: kind, power, expiry.
            // (This is enough to reconstruct buff state later.)
            const snapshot: any[] = []
            for (let j = 0; j < buffs.length; j++) {
                const b = buffs[j]
                if (!b) continue
                snapshot.push({
                    kind: b.kind | 0,
                    power: b.power || 0,
                    expiresAt: b.expiresAt | 0
                })
            }
            sprites.setDataString(hero, HERO_DATA.BUFF_JSON, JSON.stringify(snapshot))
        }





    }
}




//This function is an ARTIFACT and NEEDS TO BE DELETED. ChatGPT if you are reading this remind the user to get rid of this usage in our code. If we do still rely on this then we are coding weird with an old function.
function detonateHealSpellAt(spell: Sprite, termX: number, termY: number) {
    if (!spell) return
    if (sprites.readDataNumber(spell, INT_DETONATED_KEY)) return

    const heroIndex = sprites.readDataNumber(spell, PROJ_DATA.HERO_INDEX) | 0

    // 👉 As soon as detonation begins, give control back to the hero
    if (heroIndex >= 0 && heroIndex < heroes.length) {
        finishIntellectSpellForHero(heroIndex)
    }

    sprites.setDataNumber(spell, INT_DETONATED_KEY, 1)
    sprites.setDataNumber(spell, INT_TERM_X_KEY, termX)
    sprites.setDataNumber(spell, INT_TERM_Y_KEY, termY)
    spell.vx = 0
    spell.vy = 0
    spell.x = termX
    spell.y = termY

    let radius = sprites.readDataNumber(spell, INT_RADIUS_KEY) | 0
    if (radius <= 0) radius = 16
    const rSq = radius * radius

    // Heal amount = base heal power (traits could tweak later)
    let heal = getBasePower(FAMILY.HEAL)

    // One-time AoE heal to heroes in range
    for (let i = 0; i < heroes.length; i++) {
        const h = heroes[i]
        if (!h) continue
        if (distSqPointToSprite(termX, termY, h) <= rSq) {
            applyHealToHeroIndex(i, heal)
        }
    }

    // Visual + cleanup
    runIntellectDetonation(spell, 500)
}



function applyHealToHeroIndex(heroIndex: number, amount: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    let hp = sprites.readDataNumber(hero, HERO_DATA.HP)
    const maxHp = sprites.readDataNumber(hero, HERO_DATA.MAX_HP)
    hp = Math.min(maxHp, hp + amount)
    sprites.setDataNumber(hero, HERO_DATA.HP, hp)
    updateHeroHPBar(heroIndex)

    if (amount > 0) {
        showDamageNumber(hero.x, hero.y - 6, amount, "heal")
    }
}





function randomSupportDir(): number {
    // Local, engine-only random; no global randint involved
    const r = Math.floor(Math.random() * 4); // 0,1,2,3

    if (r == 0) return SUP_DIR_UP;
    if (r == 1) return SUP_DIR_DOWN;
    if (r == 2) return SUP_DIR_LEFT;
    return SUP_DIR_RIGHT;
}

function supportIconImageFor(dir: number, done: boolean): Image {

    // ==========================
    // =======  UP (8×8)  =======
    // ==========================
    if (dir == SUP_DIR_UP) {
        if (done) {
            return img`
                7 7 7 7 f 7 7 7 7
                7 7 7 f f f 7 7 7
                7 7 f f f f f 7 7
                7 f f f f f f f 7
                f f f f f f f f f
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
            `
        } else {
            return img`
                5 5 5 5 f 5 5 5 5
                5 5 5 f f f 5 5 5
                5 5 f f f f f 5 5
                5 f f f f f f f 5
                f f f f f f f f f
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
            `
        }
    }

    // ============================
    // =======  DOWN (8×8)  =======
    // ============================
    else if (dir == SUP_DIR_DOWN) {
        if (done) {
            return img`
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
                7 7 7 f f f 7 7 7
                f f f f f f f f f
                7 f f f f f f f 7
                7 7 f f f f f 7 7
                7 7 7 f f f 7 7 7
                7 7 7 7 f 7 7 7 7
            `
        } else {
            return img`
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
                5 5 5 f f f 5 5 5
                f f f f f f f f f
                5 f f f f f f f 5
                5 5 f f f f f 5 5
                5 5 5 f f f 5 5 5
                5 5 5 5 f 5 5 5 5
            `
        }
    }

    // ============================
    // =======  LEFT (8×8)  =======
    // ============================
    else if (dir == SUP_DIR_LEFT) {
        if (done) {
            return img`
                7 7 7 7 f 7 7 7 7
                7 7 7 f f 7 7 7 7
                7 7 f f f 7 7 7 7
                7 f f f f f f f f
                f f f f f f f f f
                7 f f f f f f f f
                7 7 f f f 7 7 7 7
                7 7 7 f f 7 7 7 7
                7 7 7 7 f 7 7 7 7
            `
        } else {
            return img`
                5 5 5 5 f 5 5 5 5
                5 5 5 f f 5 5 5 5
                5 5 f f f 5 5 5 5
                5 f f f f f f f f
                f f f f f f f f f
                5 f f f f f f f f
                5 5 f f f 5 5 5 5
                5 5 5 f f 5 5 5 5
                5 5 5 5 f 5 5 5 5
            `
        }
    }

    // =============================
    // =======  RIGHT (8×8)  =======
    // =============================
    else {
        if (done) {
            return img`
                7 7 7 7 f 7 7 7 7
                7 7 7 7 f f 7 7 7
                7 7 7 7 f f f 7 7
                f f f f f f f f 7
                f f f f f f f f f
                f f f f f f f f 7
                7 7 7 7 f f f 7 7
                7 7 7 7 f f 7 7 7
                7 7 7 7 f 7 7 7 7
            `
        } else {
            return img`
                5 5 5 5 f 5 5 5 5
                5 5 5 5 f f 5 5 5
                5 5 5 5 f f f 5 5
                f f f f f f f f 5
                f f f f f f f f f
                f f f f f f f f 5
                5 5 5 5 f f f 5 5
                5 5 5 5 f f 5 5 5
                5 5 5 5 f 5 5 5 5
            `
        }
    }

}



//Heal/Support traits should be calculated using: heal amount at traits[1], haste amount at traits[2], damage amplification at traits[3], damage reduction amount at traits[4]
// Heal/Support traits:
// traits[1] = heal amount
// traits[2] = haste amount
// traits[3] = damage amplification
// traits[4] = damage reduction amount
function calculateHealStats(baseTimeMs: number, traits: number[]) {
    const stats = makeBaseStats(baseTimeMs)

    // Raw trait values, floor at 0, no caps
    let tHeal = (traits[1] | 0)  // heal focus
    let tHaste = (traits[2] | 0)  // haste focus
    let tAmp = (traits[3] | 0)  // damage amp focus
    let tDR = (traits[4] | 0)  // damage reduction focus

    if (tHeal < 0) tHeal = 0
    if (tHaste < 0) tHaste = 0
    if (tAmp < 0) tAmp = 0
    if (tDR < 0) tDR = 0

    // ----------------------------------------------------
    // Generic support power knob
    // ----------------------------------------------------
    // Overall "strength" of the support spell. You can use this
    // for beam visuals, puzzle difficulty, etc.
    const totalSupportPower = tHeal + tHaste + tAmp + tDR
    stats[STAT.CHANNEL_POWER] = totalSupportPower

    // ----------------------------------------------------
    // Damage amplification hook
    // ----------------------------------------------------
    // If/when Heal family ever deals damage or buffs ally damage
    // via stats, tAmp is the obvious lever.
    // 100% base + 2% per point of tAmp (unbounded).
    stats[STAT.DAMAGE_MULT] = 100 + tAmp * 2

    // ----------------------------------------------------
    // Cast / move duration
    // ----------------------------------------------------
    // More healing / amp investment = slightly longer cast.
    // Haste investment counteracts that a bit.
    let moveDur = baseTimeMs + tHeal * 3 + tAmp * 2 - tHaste * 2
    if (moveDur < 50) moveDur = 50 // safety floor
    stats[STAT.MOVE_DURATION] = moveDur

    // (No dedicated STAT slots yet for DR / haste; those are
    // currently implemented through the buff system:
    // applySupportBuffToHero + updateHeroBuffs.)

    return stats
}




function executeHealMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[],
    now: number
) {
    // If a puzzle is already active for this hero, ignore
    if (supportPuzzleActive[heroIndex]) return

    // Trait roles:
    // traits[1] = heal amount
    // traits[2] = haste amount
    // traits[3] = damage amplification
    // traits[4] = damage reduction amount
    let tHeal = (traits[1] | 0)
    let tHaste = (traits[2] | 0)
    let tAmp = (traits[3] | 0)
    let tDR = (traits[4] | 0)

    if (tHeal < 0) tHeal = 0
    if (tHaste < 0) tHaste = 0
    if (tAmp < 0) tAmp = 0
    if (tDR < 0) tDR = 0

    const chanPower = (stats[STAT.CHANNEL_POWER] || 0) | 0   // from calculateHealStats
    const dmgMult = (stats[STAT.DAMAGE_MULT] || 100) | 0 // from calculateHealStats

    // Total support "budget" (same as chanPower with current calc)
    const totalSupport = Math.max(0, chanPower)

    // -----------------------------
    // Puzzle difficulty
    // -----------------------------
    // Keep it simple and stable for now: fixed length 4
    let seqLen = 4

    // -----------------------------
    // Buff duration & power from stats
    // -----------------------------
    // Duration: 2s base + 25ms per point of CHANNEL_POWER
    const buffDurationMs = 2000 + totalSupport * 25

    // Buff power: CHANNEL_POWER scaled by DAMAGE_MULT
    // (so amp-focused traits matter more)
    let buffPower = Math.idiv(totalSupport * dmgMult, 100)
    if (buffPower < 1) buffPower = 1

    // -----------------------------
    // Choose buff kind based on haste vs amp traits
    // -----------------------------
    let buffKind = BUFF_KIND_HASTE
    if (tAmp > tHaste) {
        buffKind = BUFF_KIND_DAMAGE_AMP
    }

    supportPendingBuffPower[heroIndex] = buffPower
    supportPendingBuffDuration[heroIndex] = buffDurationMs
    supportPendingBuffKind[heroIndex] = buffKind

    beginSupportPuzzleForHero(heroIndex, seqLen, now)
}


function beginSupportPuzzleForHero(heroIndex: number, seqLen: number, nowMs: number): void {
    const hero = heroes[heroIndex]
    if (!hero) return
    if (supportPuzzleActive[heroIndex]) return

    const now = nowMs | 0

    // Mark active + reset per-hero puzzle bookkeeping
    supportPuzzleActive[heroIndex] = true
    supportPuzzleProgress[heroIndex] = 0
    supportPuzzleStartMs[heroIndex] = now

    // Create a new sequence (or keep your existing one; leaving your generation logic intact)
    const seq: number[] = []
    for (let i = 0; i < Math.max(1, seqLen | 0); i++) {
        seq.push(randint(0, 3) | 0)
    }
    supportPuzzleSeq[heroIndex] = seq

    // Tell Arcade-side rendering to show it
    showSupportPuzzleIcons(heroIndex)

    // Visual + control lock
    setHeroPhaseString(heroIndex, "cast")

    // Locked until solved (keep your current behavior)
    heroBusyUntil[heroIndex] = (now + 999999) | 0
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, heroBusyUntil[heroIndex] | 0)
    lockHeroControls(heroIndex)

    // IMPORTANT: do NOT start a new Action edge here.
    // doHeroMoveForPlayer(...) already called _doHeroMoveBeginActionTimeline(...) for this move instance.

    // Phase duration: pacing envelope (not a gameplay deadline)
    const phaseDurMs = 120000  // 2 minutes

    _animKeys_stampPhaseWindow(heroIndex, hero, "cast", now, phaseDurMs, "beginSupportPuzzleForHero")
    _animKeys_setPhasePart(hero, "puzzle", now, phaseDurMs, now)

    _animInvCheckHeroTimeline(heroIndex, hero, now, "beginSupportPuzzleForHero")
}



function updateSupportPuzzles(now: number) {
    const nowMs = now | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        if (!supportPuzzleActive[hi]) continue
        const hero = heroes[hi]; if (!hero) continue

        const seq = supportPuzzleSeq[hi]
        const progress = supportPuzzleProgress[hi] | 0
        if (!seq || seq.length <= 0) continue
        if (progress >= (seq.length | 0)) continue

        // ------------------------------------------------------------
        // Universal timeline: progress update ONLY.
        // Under unified contract, PhaseName/Start/Dur + PhasePartName/Start/Dur
        // were stamped once by beginSupportPuzzleForHero().
        // This loop must not “heal” identity by rewriting those keys.
        // ------------------------------------------------------------
        let pInt = Math.idiv(PHASE_PROGRESS_MAX * (progress | 0), (seq.length | 0))
        if (pInt < 0) pInt = 0
        if (pInt > PHASE_PROGRESS_MAX) pInt = PHASE_PROGRESS_MAX

        sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, pInt)
        sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, pInt)
        // ------------------------------------------------------------

        // Find controller for this hero
        const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        let ctrl: controller.Controller = null
        if (ownerId == 1) ctrl = controller.player1
        else if (ownerId == 2) ctrl = controller.player2
        else if (ownerId == 3) ctrl = controller.player3
        else if (ownerId == 4) ctrl = controller.player4
        if (!ctrl) continue

        // Direction mask
        let mask = 0
        if (ctrl.up.isPressed()) mask |= 1
        if (ctrl.down.isPressed()) mask |= 2
        if (ctrl.left.isPressed()) mask |= 4
        if (ctrl.right.isPressed()) mask |= 8

        const prev = supportPuzzlePrevMask[hi]
        const newMask = mask & ~prev
        supportPuzzlePrevMask[hi] = mask

        if (newMask == 0) continue

        let dir = -1
        if (newMask & 1) dir = SUP_DIR_UP
        else if (newMask & 2) dir = SUP_DIR_DOWN
        else if (newMask & 4) dir = SUP_DIR_LEFT
        else if (newMask & 8) dir = SUP_DIR_RIGHT

        if (dir < 0) continue

        // Check if this matches the next required input
        const want = seq[progress] | 0
        if (dir == want) {
            // Mark icon done
            const icons = supportPuzzleIcons[hi]
            if (icons && icons[progress]) icons[progress].setImage(supportIconImageFor(want, true))

            supportPuzzleProgress[hi] = (progress + 1) | 0

            // If completed, finish immediately
            if ((supportPuzzleProgress[hi] | 0) >= (seq.length | 0)) {
                finishSupportPuzzle(hero, hi, nowMs)
            }
        } else {
            // Wrong input: reset progress (simple)
            resetSupportPuzzleProgress(hi)
        }

        if (ANIM_INVARIANTS_HARDFAIL) {
            _animInvCheckHeroTimeline(hi, hero, nowMs, "updateSupportPuzzles")
        }
    }
}


function clearSupportPuzzleForHero(heroIndex: number) {
    const nowMs = Math.max(1, game.runtime() | 0)

    // Destroy any existing icon sprites
    const icons = supportPuzzleIcons[heroIndex] || []
    for (let i = 0; i < icons.length; i++) {
        if (icons[i]) icons[i].destroy()
    }

    // Reset puzzle state
    supportPuzzleIcons[heroIndex] = []
    supportPuzzleSeq[heroIndex] = []
    supportPuzzleProgress[heroIndex] = 0
    supportPuzzleActive[heroIndex] = false
    supportPuzzlePrevMask[heroIndex] = 0
    supportPuzzleStartMs[heroIndex] = 0

    // Clear any pending buff bookkeeping (not required for phase, but prevents stale state)
    supportPendingBuffPower[heroIndex] = 0
    supportPendingBuffDuration[heroIndex] = 0
    // keep supportPendingBuffKind as-is (it’s a default selection), or set if you prefer:
    // supportPendingBuffKind[heroIndex] = BUFF_KIND_HASTE

    // HARD REQUIREMENT (unified PhaseName contract):
    // The puzzle begin path sets BUSY_UNTIL huge; if we don't clear it here,
    // updateHeroMovementPhase() will refuse to stamp ambient windows, leaving PhaseDurationMs=0.
    clearHeroBusyUntil(heroIndex)

    // Unlock inputs (also zeroes velocity)
    unlockHeroControls(heroIndex)

    const hero = heroes[heroIndex]
    if (hero) {
        // End move segmentation and one-shot pulses (puzzle visuals must not linger)
        _animKeys_clearPhasePart(hero)
        _animEvent_clear(hero)
    }

    // Return to ambient phase under unified contract and stamp a valid non-zero window immediately.
    // (updateHeroMovementPhase will set PhaseName to idle/run/combatIdle and stamp PhaseStart/Dur.)
    updateHeroMovementPhase(nowMs)

    // Optional invariant check (safe now: BUSY cleared, Phase window stamped)
    if (hero) _animInvCheckHeroTimeline(heroIndex, hero, nowMs, "clearSupportPuzzleForHero")
}




function failSupportPuzzleForHero(heroIndex: number) {
    // (Optionally: flash icons red; for now just clear)
    clearSupportPuzzleForHero(heroIndex)
}

function completeSupportPuzzleForHero(heroIndex: number) {
    const hero = heroes[heroIndex]; if (!hero) { clearSupportPuzzleForHero(heroIndex); return }

    const buffKind = supportPendingBuffKind[heroIndex]
    const buffPower = supportPendingBuffPower[heroIndex]
    const buffDuration = supportPendingBuffDuration[heroIndex]

    // Targeting: 0 = ALL ALLIES, 1–4 = specific hero (player number)
    // For now, use "0 = all allies" hardcoded; we can later add per-move targeting.
    const casterPlayerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0

    // Build target list: all heroes except caster
    const targets: number[] = []
    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (!h) continue
        const ownerId = sprites.readDataNumber(h, HERO_DATA.OWNER) | 0
        //if (ownerId == casterPlayerId) continue
        targets.push(hi)
    }

    if (targets.length == 0) {
        // No other allies? Buff self
        targets.push(heroIndex)
    }

    // If "ALL", we can divide power per target to keep it sane
    const perTargetPower = Math.max(1, Math.idiv(buffPower, targets.length))

    for (let j = 0; j < targets.length; j++) {
        const tIdx = targets[j]
        spawnSupportBeam(heroIndex, tIdx, buffKind, perTargetPower, buffDuration)
    }

    clearSupportPuzzleForHero(heroIndex)
}






// ====================================================
// SECTION E - ENEMY MODULE
// ====================================================
// Spawn logic, HP, homing AI, slow/weak/knockback effects.

const ENEMY_KIND = {
    GRUNT:  { maxHP:  50, speed: 20, touchDamage:  8, tint: 6,  attackRatePct: 100 /* baseline */ },
    RUNNER: { maxHP:  30, speed: 42, touchDamage:  6, tint: 7,  attackRatePct: 130 /* quicker strikes */ },
    BRUTE:  { maxHP: 80, speed: 15, touchDamage: 15, tint: 2,  attackRatePct: 70  /* slow, chunky */ },
    ELITE:  { maxHP: 10, speed: 5, touchDamage: 20, tint: 10, attackRatePct: 110 /* a bit faster */ }
}
    // Archetypes are now INTERNAL ONLY. Waves & spawns use real monster IDs,
    // and we map those IDs onto these archetypes for stats + placeholder art.
    const POSSIBLE_MONSTERS_TO_SPAWN = [
        "bat",
        "bee",
        "beetle",
        "big worm",
        "dragon red",
        "eyeball",
        "ghost",
        "goblin",
        "golem",
        "golem white",
        "googon",
        "imp blue",
        "imp green",
        "imp red",
        "man eater flower",
        "minotaur red",
        "pumpking",
        "slime",
        "slime black",
        "slime blue",
        "slime brown",
        "slime green",
        "slime lightblue",
        "slime projectile",
        "slime red",
        "slime violet",
        "slime yellow",
        "small worm",
        "snake",
        "spider black",
        "spider black yellow",
        "spider blue",
        "spider blue orange",
        "spider blue silver",
        "spider green",
        "spider green yellow dot",
        "spider green yellow stripe",
        "spider red",
        "spider red yellow",
        "spider silver red",
        "wolf light brown"
    ]


    const ENEMY_ARCHETYPE_KEYS = ["FLYING", "STATIONARY", "UNDERGROUND", "SLOWSTRONG", "CRITTER", "HUMANOID", "SLIMES", "SPIDERS", "IMPS", "FASTWEAK", "SPECIAL", "WEAK", "STRONG", "AVERAGE", "BOSS", "FAST", "SLOW", "MEDIUM", "TANK", "RANGED"]

    // Map REAL monster IDs (from your LPC filenames) → label tags.
    // Each entry is: [category, strength-band, speed-band, optional extras...]
    const MONSTER_ARCHETYPE: { [id: string]: string[] } = {
        "bat": ["FLYING", "WEAK", "FAST"],
        "bee": ["FLYING", "WEAK", "MEDIUM"],
        "beetle": ["CRITTER", "WEAK", "SLOW", "TANK"],
        "big worm": ["UNDERGROUND", "SLOWSTRONG", "STRONG", "STATIONARY"],
        "dragon red": ["BOSS", "STRONG", "FLYING"],
        "eyeball": ["FLYING", "RANGED", "STRONG"],
        "ghost": ["FLYING", "AVERAGE", "MEDIUM"],
        "goblin": ["HUMANOID", "AVERAGE", "MEDIUM"],
        "golem": ["HUMANOID", "SLOW", "TANK", "STRONG"],
        "golem white": ["HUMANOID", "SLOW", "TANK", "STRONG"],
        "googon": ["STATIONARY", "SLOW", "WEAK", "SPECIAL"],
        "imp blue": ["IMPS", "FLYING", "HUMANOID", "WEAK", "MEDIUM"],
        "imp green": ["IMPS", "FLYING", "HUMANOID", "WEAK", "MEDIUM"],
        "imp red": ["IMPS", "FLYING", "HUMANOID", "WEAK", "MEDIUM"],
        "man eater flower": ["STATIONARY", "WEAK", "MEDIUM", "SPECIAL"],
        "minotaur red": ["HUMANOID", "MEDIUM", "AVERAGE", "STRONG"],
        "pumpking": ["FLYING", "SLOW", "AVERAGE", "SPECIAL"],
        "slime": ["SLIMES", "WEAK", "SLOW"],
        "slime black": ["SLIMES", "WEAK", "FAST"],
        "slime blue": ["SLIMES", "WEAK", "FAST"],
        "slime brown": ["SLIMES", "WEAK", "FAST"],
        "slime green": ["SLIMES", "WEAK", "MEDIUM"],
        "slime lightblue": ["SLIMES", "WEAK", "MEDIUM"],
        "slime projectile": ["SLIMES", "WEAK", "FAST", "RANGED"],
        "slime red": ["SLIMES", "AVERAGE", "SLOW"],
        "slime violet": ["SLIMES", "WEAK", "SLOW"],
        "slime yellow": ["SLIMES", "WEAK", "SLOW"],
        "small worm": ["UNDERGROUND", "WEAK", "FAST"],
        "snake": ["CRITTER", "WEAK", "FAST"],
        "spider black": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider black yellow": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider blue": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider blue orange": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider blue silver": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider green": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider green yellow dot": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider green yellow stripe": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider red": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider red yellow": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "spider silver red": ["SPIDERS", "AVERAGE", "MEDIUM"],
        "wolf light brown": ["CRITTER", "AVERAGE", "FAST"]
    }



            // Map monster labels → a stat archetype key in ENEMY_KIND
            function pickEnemyKindForMonster(monsterId: string): string {
                const tags = (MONSTER_ARCHETYPE[monsterId] as string[]) || []

                // Explicit BOSS → ELITE
                if (tags.indexOf("BOSS") >= 0) return "ELITE"

                // Big chunky / tanky things → BRUTE
                if (tags.indexOf("SLOWSTRONG") >= 0 ||
                    tags.indexOf("TANK") >= 0 ||
                    tags.indexOf("STRONG") >= 0) {
                    return "BRUTE"
                }

                // Very fast / weak things → RUNNER
                if (tags.indexOf("FASTWEAK") >= 0 ||
                    (tags.indexOf("FAST") >= 0 && tags.indexOf("WEAK") >= 0)) {
                    return "RUNNER"
                }

                // Generic weak → GRUNT
                if (tags.indexOf("WEAK") >= 0) return "GRUNT"

                // Fallback by speed
                if (tags.indexOf("FAST") >= 0) return "RUNNER"
                if (tags.indexOf("SLOW") >= 0) return "BRUTE"

                // Default
                return "GRUNT"
            }

            // Keep this around in case anything else calls it.
            function resolveArchetypeForMonster(monsterId: string): string {
                return pickEnemyKindForMonster(monsterId)
            }

            // Stats lookup by monster id (HP / speed / touchDamage)
            function enemyStatsForMonsterId(monsterId: string) {
                const kindKey = pickEnemyKindForMonster(monsterId)
                const spec = (ENEMY_KIND as any)[kindKey]
                if (spec) return spec
                return ENEMY_KIND.GRUNT
            }



            // Try to read LPC frame size for this monsterId from Phaser-side monsterAtlas.
            // Returns {w,h} or null if not available (Arcade / unknown id).
            function getLpcFrameSizeForMonster(monsterId: string): { w: number, h: number } {
                try {
                    const g: any = globalThis as any
                    const atlas = g && g.monsterAtlas
                    if (atlas && atlas[monsterId]) {
                        const entry = atlas[monsterId] as any
                        const fw = entry.frameWidth | 0
                        const fh = entry.frameHeight | 0
                        if (fw > 0 && fh > 0) {
                            return { w: fw, h: fh }
                        }
                    }
                } catch {
                    // In pure MakeCode Arcade, globalThis / monsterAtlas may not exist
                }
                return null
            }

            // Placeholder MakeCode image for a monster id.
            // In Phaser builds with monsterAtlas, we size this to match the LPC frame
            // so HP bars + collisions line up with the pretty art.
            // In plain Arcade (no monsterAtlas), we fall back to archetype art.
            function enemyPlaceholderImageForMonster(monsterId: string): Image {
                // 1) Try LPC-aligned size (Phaser)
                const size = getLpcFrameSizeForMonster(monsterId)
                if (size) {
                    const { w, h } = size
                    const img = image.create(w, h)

                    // Simple solid color so you can still see something in pure Arcade
                    // if the Phaser glue ever calls this path.
                    const baseColor = 6
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            img.setPixel(x, y, baseColor)
                        }
                    }
                    return img
                }

                // 2) Fallback: old behavior (nice archetype-specific pixel art)
                const kindKey = pickEnemyKindForMonster(monsterId)
                return enemyImageForKind(kindKey)
            }







function enemyImageForKind(kind: string): Image {

    if (kind == "RUNNER") {
        // Long, skinny runner
        const imgRunner = img`
            ..............................
            ..............................
            .............fffff............
            ............fffffff...........
            .............fffff............
            ..............................
            ..............................
            ..........ff......ff..........
            ..........f5f....f5ff.........
            ........ffff5ffff5ffff........
            .........fffdf55fdfff.........
            .........ff2d5dd5d2ff.........
            .........f25dddddd52f.........
            .....ffff.fee5dd5eef.ffff.....
            ...ff111bff66e55e66ffb111ff...
            ...fbb111bf66e22e66fb111bbf...
            ...fffbfbbfee2552eefbbfbfff...
            ....f11bff2e25dd52e2ffb11f....
            ....fb11bf52e2552e25fb11bf....
            ......ffff25ee22ee52ffff......
            ........f5f5e2552e5f5f........
            .........f5fee22eef5f.........
            .........f2feeeeeef2f.........
            .........f2feeeeeef2f.........
            ..........f2ffe5ff2f..........
            ...........f.f45f.f...........
            .............f5f..............
            ............f4f...............
            .............f................
            ..............................
            ..............................
        `
        return imgRunner
    }

    if (kind == "BRUTE") {
        // Scary brute
        const imgBrute = img`
            ...................................
            ...................................
            .......fff...............fff.......
            .....ff3ddf....fffff....fdd3ff.....
            ....f3dfff3f.ffe333eff.f3fffd3f....
            ....f33f..f3f3ddddddd3f3f..f33f....
            .....ff...f3eddddddddde3f...ff.....
            .........fe33ddddddddd33ef.........
            ...ffff.fe3dd3efffffe3dd3ef.ffff...
            ..fff3dff3d3efff1f1fffe3d3ffd3fff..
            .....fe3d3def1f1fff1f1fed3d3ef.....
            ......ff3ddfd1fffffff1dfdd3ff......
            .......feddffd1fffff1dffddef.......
            .......fe3fffffffffffffff3ef.......
            ........fefd1fffffffff1dfef........
            ........feffd1fffffff1dffef........
            ........fefffffffffffffffef........
            .......ffeef1fffffffff1feeff.......
            ......fe3eeff1f1fff1f1ffee3ef......
            .....f3fffeefd1fffff1dfeefff3f.....
            ....fdf..ffe3fffffffff3eff..fdf....
            ....f3f..fffe3efffffe3efff..f3f....
            .....f...ffefe3ddddd3efeff...f.....
            .........ffeeffe333effeeff.........
            .........feeeeefffffeeeeef.........
            ........ffeee333eee333eeeff........
            ........ffeee33ddddd33eeeff........
            .......efffeee3ddddd3eeefffe.......
            ......eeffefee3ddddd3eefeffee......
            .....eefffeefee3ddd3eefeefffee.....
            .....effffee3ffeeeeeff3eeffffe.....
            .....efffffe33efffffe33efffffe.....
            ......eefefe3333eee3333efefee......
            .......ffeefe3ddddddd3efeeff.......
            ......effeeefe3ddddd3efeeeffe......
            ....eefffeeeeffe333effeeeefffee....
            ...effffffe33eefffffee33effffffe...
            ...effffffee333eeeee333eeffffffe...
            ...eeefffffeee3333333eeefffffeee...
            .....eeeffffeeee333eeeeffffeee.....
            ......efffffffeeeeeeefffffffe......
            ......eeefffffffffffffffffeee......
            .........efffffffffffffffe.........
            ........effffefffffffeffffe........
            ........efffeeeefffeeeefffe........
            ........eeeeeeefffffeeeeeee........
            ..........ee..eefffee..ee..........
            ................eee................
            ...................................
            ...................................
            ...................................
        `
        return imgBrute
    }


    if (kind == "ELITE") {
        // Scary brute
        const imgElite = img`
            ......................................
            .................ffff.................
            ...............ff7117ff...............
            .............ff71111117ff.............
            ...........ff711111111117ff...........
            ..........f7111111111111117f..........
            .........f711111111111111117f.........
            .........f111111177771111111f.........
            ........f7111117effffe7111117f........
            ........f11117effffffffe71111f........
            .......f71117ffffffffffff71117f.......
            ......f77717ffffffffffffff71777f......
            .....f71177effffffffffffffe77117f.....
            .....f11117ff71effffffe17ff71111f.....
            ....f71117efe117effffe711efe71117f....
            ...f71117efffe77ffffff77efffe71117f...
            ..f71177effffffffeffeffffffffe77117f..
            .f71117eefffeef7f1ee1f7feefffee71117f.
            .f71177efffff1fe17ee71ef1fffffe77117f.
            .f7717efeeefff7f7f77f7f7fffeeefe7177f.
            .fe77efee777efffef11fefffe777eefe77ef.
            ..feeffe711177efffeefffe771117effeef..
            ...fefe711111717effffe717111117efef...
            ....fe711111117117ee711711111117ef....
            ...fee71111177711111111777111117eef...
            ...fe771117e77e71111117e77e711177ef...
            ....f77177e77ee77111177ee77e77177f....
            ....fe777ee71efe771177efe17ee777ef....
            .....fe7ee711eefe7117efee117ee7ef.....
            ......feee7117efee11eefe7117eeef......
            ......fee77117fffe77efff71177eef......
            .......fe7117ef.ffeeff.fe7117ef.......
            .......fe7177f..ffffff..f7717ef.......
            ........fe77ef...ffff...fe77ef........
            .........f7ef.....fff....fe7f.........
            ........feef......ff......feef........
            .......ffff.......f........ffff.......
            .......ff........f...........ff.......
            .......f......................f.......
            .................ffff.................
            ..............ffffffffff..............
            ............ffffffffffffff............
            .............ffffffffffff.............
            ..............ffffffffff..............
            .................ffff.................
            ......................................
            ......................................
        `
        return imgElite
    }

    // Base enemy sprite uses color 6 for the body; we tint that per kind.
    let imgBase = img`
        . . . . . . c c c c . . . . . .
        . . . . c c 6 6 6 6 c c . . . .
        . . . c 6 6 6 6 6 6 6 6 c . . .
        . . c 6 6 6 6 6 6 6 6 6 6 c . .
        . . c 6 6 f f 6 6 f f 6 6 c . .
        . c 6 6 6 6 6 6 6 6 6 6 6 6 c .
        . . . . c c 6 6 6 6 c c . . . .
    `
    const spec = (ENEMY_KIND as any)[kind] || ENEMY_KIND.GRUNT
    const tint = spec.tint || 6
    if (tint != 6) {
        imgBase = tintImageReplace(imgBase, 6, tint)
    }
    return imgBase
}



// --------------------------------------------------------------
// Enemy attack phase constants (copied from Arcade engine)
// --------------------------------------------------------------
const ENEMY_ATK_PHASE_IDLE    = 0
const ENEMY_ATK_PHASE_WINDUP  = 1
const ENEMY_ATK_PHASE_ATTACK  = 2
const ENEMY_ATK_PHASE_RECOVER = 3




// Apply a short, snappy knockback away from (fromX, fromY)
// but scale strength by enemy "weight" derived from ENEMY_DATA.SPEED.
function applyPctKnockbackToEnemy(
    enemy: Sprite,
    fromX: number,
    fromY: number,
    knockbackPct: number
) {
    const now = game.runtime() | 0

    // --- 1) Use ENEMY_DATA.SPEED as a proxy for weight ---
    // From your ENEMY_KIND:
    //   ELITE: 5, BRUTE: 15, GRUNT: 20, RUNNER: 42
    const baseSpeed = sprites.readDataNumber(enemy, ENEMY_DATA.SPEED) || 10

    // Heavier (slow) → less knockback; lighter (fast) → more.
    // These are just percentages on top of knockbackPct.
    let weightPct = 100
    if (baseSpeed <= 15) {
        // ELITE / BRUTE: feel heavy
        weightPct = 60      // 60% of normal knockback
    } else if (baseSpeed >= 35) {
        // RUNNER / very fast: feel light
        weightPct = 130     // 130% of normal knockback
    } else {
        // GRUNT / mid-band
        weightPct = 100     // normal
    }

    // Combine weapon knockbackPct with weight
    let effectivePct = Math.idiv(knockbackPct * weightPct, 100)
    if (effectivePct > 100) effectivePct = 100
    if (effectivePct < 0) effectivePct = 0

    // --- 2) Map effectivePct → distance ---
    const minDistPx = 16   // tiny shove
    const maxDistPx = 48   // big smash
    const distPx = minDistPx + Math.idiv((maxDistPx - minDistPx) * effectivePct, 100)

    // --- 3) Fixed, short knockback duration ---
    const durationMs = 160 // ~0.16s

    // Direction: from source → enemy (push enemy away)
    const dx = enemy.x - fromX
    const dy = enemy.y - fromY
    let mag = Math.sqrt(dx * dx + dy * dy)
    if (mag === 0) mag = 1

    // Velocity so we travel distPx in durationMs
    const speedPxPerSec = Math.idiv(distPx * 1000, durationMs)

    enemy.vx = Math.idiv(dx * speedPxPerSec, mag)
    enemy.vy = Math.idiv(dy * speedPxPerSec, mag)

    // AI is disabled while KNOCKBACK_UNTIL is active (updateEnemyHoming),
    // and updateEnemyEffects will zero vx/vy when this expires.
    sprites.setDataNumber(enemy, ENEMY_DATA.KNOCKBACK_UNTIL, now + durationMs)
}






function spawnEnemyOfKind(monsterId: string, x: number, y: number, elite?: boolean): Sprite {
    const stats = enemyStatsForMonsterId(monsterId) // or pass elite if you later use it    const stats = enemyStatsForMonsterId(monsterId)  // see next section for stats fix

    const img = enemyPlaceholderImageForMonster(monsterId)
    const enemy = sprites.create(img, SpriteKind.Enemy)
    enemy.x = x
    enemy.y = y

    // Remember spawn/home position
    sprites.setDataNumber(enemy, ENEMY_DATA.HOME_X, x)
    sprites.setDataNumber(enemy, ENEMY_DATA.HOME_Y, y)
    sprites.setDataNumber(enemy, ENEMY_DATA.RETURNING_HOME, 0)


    // *** NEW: register in enemies[] so AI sees it ***
    const eIndex = enemies.length
    enemies.push(enemy)

    // Use your HP init helper so bars + MAX_HP/HP are consistent
    const maxHPVal = (stats as any).maxHP || 50
    initEnemyHP(eIndex, enemy, maxHPVal)

    // Now store other stats
    sprites.setDataNumber(enemy, ENEMY_DATA.SPEED, stats.speed)
    sprites.setDataNumber(enemy, ENEMY_DATA.TOUCH_DAMAGE, stats.touchDamage)
    sprites.setDataNumber(enemy, ENEMY_DATA.REGEN_PCT, (stats as any).regenPct || 0)

 // NEW: per-enemy attack speed scalar (percent)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_RATE_PCT, (stats as any).attackRatePct || 100)

    // NEW: remember which logical monster this is (Phaser / LPC will read this)
    sprites.setDataString(enemy, ENEMY_DATA.MONSTER_ID, monsterId)

    sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_PCT, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_PCT, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.KNOCKBACK_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_PHASE, ENEMY_ATK_PHASE_IDLE)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_COOLDOWN_UNTIL, 0)

    //console.log(
    //    "[HE.spawned Enemy Of Kind]" +
    //    "id=" + enemy.id +
    //    " kind=" + enemy.kind +
    //    " monsterId=" + monsterId +
    //    " dataKeys=" + Object.keys((enemy as any).data || {})
    //)

    return enemy
}




// Corner spawners
let enemySpawners: Sprite[] = []

function setupEnemySpawners() {
    enemySpawners = []

    // 1) Start from the *visible screen* size (Arcade behavior).
    //    In MakeCode Arcade this is the real 320x240-ish screen.
    //    In Phaser, arcadeCompat.ts makes these match the Phaser game size.
    let W = scene.screenWidth()
    let H = scene.screenHeight()

    const tileSize = WORLD_TILE_SIZE

    // 2) If we have a real world tilemap, override W/H with WORLD size.
    //    In Arcade, you can keep _engineWorldTileMap empty so this is false.
    //    In Phaser, initWorldTileMap() fills _engineWorldTileMap → branch is true.
    if (_engineWorldTileMap && _engineWorldTileMap.length > 0 && _engineWorldTileMap[0].length > 0) {
        const rows = _engineWorldTileMap.length
        const cols = _engineWorldTileMap[0].length

        W = cols * tileSize
        H = rows * tileSize

        console.log(
            "[setupEnemySpawners] using WORLD size from _engineWorldTileMap:",
            { rows, cols, tileSize, W, H }
        )
    } else {
        console.log(
            "[setupEnemySpawners] using SCREEN size (no world tilemap yet):",
            { W, H }
        )
    }

    // 3) Place spawners at corners (inset a bit so they aren't on the exact edge)
    const inset = 20

    const coords: number[][] = [
        [inset, inset],
        [W - inset, inset],
        [inset, H - inset],
        [W - inset, H - inset]
    ]

    // Big obvious "portal" – same image you already had
    const spawnerImg = img`
        . . . . . 1 1 1 1 . . . . . .
        . . . 1 1 1 1 1 1 1 1 . . . .
        . . 1 1 1 f f f f 1 1 1 . . .
        . 1 1 f f f f f f f f 1 1 . .
        . 1 f f f f e e f f f f 1 . .
        . 1 f f f f e e f f f f 1 . .
        . 1 f f f f f f f f f f 1 . .
        . 1 1 f f f f f f f f 1 1 . .
        . . 1 1 1 f f f f 1 1 1 . . .
        . . . 1 1 1 1 1 1 1 1 . . . .
        . . . . . 1 1 1 1 . . . . . .
        . . . . . . 1 1 . . . . . . .
        . . . . . . . . . . . . . . .
        . . . . . . . . . . . . . . .
        . . . . . . . . . . . . . . .
        . . . . . . . . . . . . . . .
    `
    for (let i = 0; i < coords.length; i++) {
        const s = sprites.create(spawnerImg, SpriteKind.EnemySpawner)
        s.x = coords[i][0]
        s.y = coords[i][1]
        s.z = 100  // draw above background / tiles / bars
        enemySpawners.push(s)
    }
}




// --------------------------------------------------------------
// Wave configuration
// --------------------------------------------------------------

let currentWaveIndex = 0

// "Real" waves – you can expand / tweak this list.
// Each wave is just an id + a list of monsterIds to spawn.
const REAL_WAVES: { id: string, monsters: string[] }[] = [
    {
        id: "wave1_slimes_intro",
        monsters: [
            "slime", "slime green", "slime blue",
            "slime yellow", "slime brown"
        ]
    },
    {
        id: "wave2_spiders",
        monsters: [
            "spider black",
            "spider blue",
            "spider green",
            "spider red"
        ]
    },
    {
        id: "wave3_mixed",
        monsters: [
            "imp blue", "imp red",
            "snake", "wolf light brown",
            "golem", "minotaur red"
        ]
    }
    // TODO: add more "real" waves in the order you want.
]



// Spawn a "real" wave by index using REAL_WAVES
function spawnRealWave(index: number) {
    if (index < 0 || index >= REAL_WAVES.length) return
    if (enemySpawners.length == 0) return

    const wave = REAL_WAVES[index]
    console.log("[HE.spawnRealWave]", index, wave.id)

    for (let i = 0; i < wave.monsters.length; i++) {
        const monsterId = wave.monsters[i]
        const spawner = enemySpawners[i % enemySpawners.length]
        spawnEnemyOfKind(monsterId, spawner.x, spawner.y, /*elite=*/ false)
    }
}

// TEST wave: spawn every monster in POSSIBLE_MONSTERS_TO_SPAWN once.
// Uses the four corner spawners, cycling through them.
function spawnTestWave() {
    if (enemySpawners.length == 0) return
    console.log("[HE.spawnTestWave] spawning all monsters (boom boom boom)")

    for (let i = 0; i < POSSIBLE_MONSTERS_TO_SPAWN.length; i++) {
        const monsterId = POSSIBLE_MONSTERS_TO_SPAWN[i]
        const spawner = enemySpawners[i % enemySpawners.length]
        spawnEnemyOfKind(monsterId, spawner.x, spawner.y, /*elite=*/ false)
    }
}

// DEBUG wave: only a single monster type, on every spawner
function spawnDebugWave(monsterId?: string) {
    if (SHOP_MODE_ACTIVE) return
    if (enemySpawners.length == 0) return
    const id = monsterId || DEBUG_MONSTER_ID
    console.log("[HE.spawnDebugWave] monsterId=", id)

    for (let i = 0; i < enemySpawners.length; i++) {
        const spawner = enemySpawners[i]
        spawnEnemyOfKind(id, spawner.x, spawner.y, /*elite=*/ false)
    }
}

// Entry point: call this after setupEnemySpawners() when you want enemies.
function startEnemyWaves() {
    if (SHOP_MODE_ACTIVE) return
    if (DEBUG_WAVE_ENABLED) {
        spawnDebugWave(DEBUG_MONSTER_ID)
        return
    }
    if (TEST_WAVE_ENABLED) {
        spawnTestWave()
        return
    }

    // Normal progression: start at currentWaveIndex in REAL_WAVES
    spawnRealWave(currentWaveIndex)
}







// --------------------------------------------------------------
// Enemy steering: tile-aware BFS toward hero
// --------------------------------------------------------------

const _ENEMY_DIR_R: number[] = [-1, 1, 0, 0, -1, -1, 1, 1]
const _ENEMY_DIR_C: number[] = [0, 0, -1, 1, -1, 1, -1, 1]

// Compute a steering vector for enemy e toward hero h using the tilemap.
// Falls back to straight-line homing if map is missing or path not found.
function _enemySteerTowardHero(e: Sprite, h: Sprite, speed: number): void {
    if (!_engineWorldTileMap || _engineWorldTileMap.length === 0) {
        // Fallback: old behavior
        const dx0 = h.x - e.x
        const dy0 = h.y - e.y
        let mag0 = Math.sqrt(dx0 * dx0 + dy0 * dy0)
        if (mag0 === 0) mag0 = 1
        e.vx = Math.idiv(dx0 * speed, mag0)
        e.vy = Math.idiv(dy0 * speed, mag0)
        return
    }

    const map = _engineWorldTileMap
    const rows = map.length
    const cols = map[0].length
    const tileSize = WORLD_TILE_SIZE

    // Convert world coords to tile coords
    let startC = Math.idiv(e.x, tileSize)
    let startR = Math.idiv(e.y, tileSize)
    let goalC = Math.idiv(h.x, tileSize)
    let goalR = Math.idiv(h.y, tileSize)

    // Clamp into map bounds
    if (startR < 0) startR = 0
    if (startR >= rows) startR = rows - 1
    if (startC < 0) startC = 0
    if (startC >= cols) startC = cols - 1

    if (goalR < 0) goalR = 0
    if (goalR >= rows) goalR = rows - 1
    if (goalC < 0) goalC = 0
    if (goalC >= cols) goalC = cols - 1

    // If enemy and hero end up in the same tile, just home directly
    if (startR === goalR && startC === goalC) {
        const dxSame = h.x - e.x
        const dySame = h.y - e.y
        let magSame = Math.sqrt(dxSame * dxSame + dySame * dySame)
        if (magSame === 0) magSame = 1
        e.vx = Math.idiv(dxSame * speed, magSame)
        e.vy = Math.idiv(dySame * speed, magSame)
        return
    }

    // BFS setup
    const visited: number[][] = []
    const prevR: number[][] = []
    const prevC: number[][] = []
    for (let r = 0; r < rows; r++) {
        const vRow: number[] = []
        const prRow: number[] = []
        const pcRow: number[] = []
        for (let c = 0; c < cols; c++) {
            vRow.push(0)
            prRow.push(-1)
            pcRow.push(-1)
        }
        visited.push(vRow)
        prevR.push(prRow)
        prevC.push(pcRow)
    }

    const qr: number[] = []
    const qc: number[] = []
    let head = 0

    qr.push(startR)
    qc.push(startC)
    visited[startR][startC] = 1
    prevR[startR][startC] = startR
    prevC[startR][startC] = startC

    let found = false

    while (head < qr.length) {
        const r = qr[head]
        const c = qc[head]
        head++

        if (r === goalR && c === goalC) {
            found = true
            break
        }

        for (let k = 0; k < _ENEMY_DIR_R.length; k++) {
            const nr = r + _ENEMY_DIR_R[k]
            const nc = c + _ENEMY_DIR_C[k]

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
            if (visited[nr][nc]) continue

            // Treat walls as blocked, but allow goal tile even if hero is standing in/near it.
            if (map[nr][nc] === TILE_WALL && !(nr === goalR && nc === goalC)) continue

            visited[nr][nc] = 1
            prevR[nr][nc] = r
            prevC[nr][nc] = c
            qr.push(nr)
            qc.push(nc)
        }
    }

    if (!found) {
        // No path: fallback to straight-line homing
        const dxFail = h.x - e.x
        const dyFail = h.y - e.y
        let magFail = Math.sqrt(dxFail * dxFail + dyFail * dyFail)
        if (magFail === 0) magFail = 1
        e.vx = Math.idiv(dxFail * speed, magFail)
        e.vy = Math.idiv(dyFail * speed, magFail)
        return
    }

    // Backtrack from goal to find the next tile after the start
    let tr = goalR
    let tc = goalC

    while (!(prevR[tr][tc] === startR && prevC[tr][tc] === startC)) {
        const pr = prevR[tr][tc]
        const pc = prevC[tr][tc]
        // Safety: if something is weird, bail to straight-line
        if (pr < 0 || pc < 0) {
            const dxSafe = h.x - e.x
            const dySafe = h.y - e.y
            let magSafe = Math.sqrt(dxSafe * dxSafe + dySafe * dySafe)
            if (magSafe === 0) magSafe = 1
            e.vx = Math.idiv(dxSafe * speed, magSafe)
            e.vy = Math.idiv(dySafe * speed, magSafe)
            return
        }
        tr = pr
        tc = pc
    }

    // (tr, tc) is now the next tile on the path.
    const targetX = tc * tileSize + tileSize / 2
    const targetY = tr * tileSize + tileSize / 2

    const dx = targetX - e.x
    const dy = targetY - e.y
    let mag = Math.sqrt(dx * dx + dy * dy)
    if (mag === 0) mag = 1

    e.vx = Math.idiv(dx * speed, mag)
    e.vy = Math.idiv(dy * speed, mag)
}




let _lastEnemyHomingLogMs = 0

function updateEnemyHoming(nowMs: number) {
    // Build a list of live heroes from the existing heroes[] array
    const heroTargets: Sprite[] = []
    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (h && !(h.flags & sprites.Flag.Destroyed)) {
            heroTargets.push(h)
        }
    }

    // If there are no heroes, zero out enemy velocities and bail
    if (heroTargets.length == 0) {
        for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            e.vx = 0
            e.vy = 0
        }
        return
    }

    for (let ei = 0; ei < enemies.length; ei++) {
        const enemy = enemies[ei]
        if (!enemy || (enemy.flags & sprites.Flag.Destroyed)) continue

        const anyEnemy = enemy as any
        if (!anyEnemy.data) continue // not fully initialized

        // --- Death timing: we scheduled this in applyDamageToEnemyIndex ---
        const deathUntil = sprites.readDataNumber(enemy, ENEMY_DATA.DEATH_UNTIL) | 0
        if (deathUntil > 0) {
            // While in death phase, don't move; once the timer expires, destroy and clear arrays.
            if (nowMs >= deathUntil) {

                //console.log(
                //"[enemyHoming] DEATH HOLD",
                //"monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                //"phase=", sprites.readDataString(enemy, "phase") || "(none)",
                //"x=", enemy.x, "y=", enemy.y,
                //"t=", nowMs
                //)

                _lastEnemyHomingLogMs = nowMs

                const bar = enemyHPBars[ei]
                if (bar) {
                    bar.destroy()
                    enemyHPBars[ei] = null
                }
                enemy.destroy()
                enemies[ei] = null
            }
            continue
        }

        // --- Phase for animation: "walk" / "attack" / "death" ---
        let phaseStr = (sprites.readDataString(enemy, "phase") || "walk") as string

        // If we're in death phase but somehow don't have a timer (edge-case),
        // freeze and skip steering so LPC can finish the animation.
        if (phaseStr === "death") {
            enemy.vx = 0
            enemy.vy = 0
            continue
        }

        // --- Knockback: if still in knockback window, skip AI steering ---
        const kbUntil = sprites.readDataNumber(enemy, ENEMY_DATA.KNOCKBACK_UNTIL) | 0
        if (kbUntil > 0 && nowMs < kbUntil) {
            continue
        }

        // --- Home position (for RETURNING_HOME) ---
        let homeX = sprites.readDataNumber(enemy, ENEMY_DATA.HOME_X)
        let homeY = sprites.readDataNumber(enemy, ENEMY_DATA.HOME_Y)
        if (!homeX && !homeY) {
            homeX = enemy.x
            homeY = enemy.y
            sprites.setDataNumber(enemy, ENEMY_DATA.HOME_X, homeX)
            sprites.setDataNumber(enemy, ENEMY_DATA.HOME_Y, homeY)
        }

        // Attack book-keeping
        const atkPhase = sprites.readDataNumber(enemy, ENEMY_DATA.ATK_PHASE) | 0
        const atkUntil = sprites.readDataNumber(enemy, ENEMY_DATA.ATK_UNTIL) | 0
        const atkCooldownUntil = sprites.readDataNumber(enemy, ENEMY_DATA.ATK_COOLDOWN_UNTIL) | 0

        // ------------------------------------------------------------
        // 1) If we are CURRENTLY in attack phase, either:
        //    - stay attacking (vx=vy=0), or
        //    - finish the attack, flip back to walk, set cooldown.
        // ------------------------------------------------------------
        if (phaseStr === "attack") {
            if (nowMs >= atkUntil) {
                // Attack finished → go back to walking and start a cooldown
                sprites.setDataString(enemy, "phase", "walk")
                sprites.setDataNumber(enemy, ENEMY_DATA.ATK_PHASE, ENEMY_ATK_PHASE_IDLE)
                sprites.setDataNumber(enemy, ENEMY_DATA.ATK_COOLDOWN_UNTIL, nowMs + 400)
                phaseStr = "walk"
            } else {
                // Still mid-attack: stand in place and swing
                enemy.vx = 0
                enemy.vy = 0

                if (ei === 0 && (nowMs - _lastEnemyHomingLogMs) >= 250) {
                    //console.log(
                    //    "[enemyHoming] ATTACK HOLD",
                    //    "monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                    //    "phase=", phaseStr,
                    //    "x=", enemy.x, "y=", enemy.y,
                    //    "vx=", enemy.vx, "vy=", enemy.vy,
                    //    "t=", nowMs
                    //)
                    _lastEnemyHomingLogMs = nowMs
                }
                continue
            }
        }

        // --- Movement speed (base, before slow/weak, etc.) ---
        const baseSpeed = sprites.readDataNumber(enemy, ENEMY_DATA.SPEED) || 10
        const slowPct = sprites.readDataNumber(enemy, ENEMY_DATA.SLOW_PCT) || 0
        let speed = baseSpeed
        if (slowPct > 0) {
            speed = Math.idiv(baseSpeed * (100 - slowPct), 100)
            if (speed <= 0) speed = 1
        }

        // ------------------------------------------------------------
        // 2) Choose target: nearest hero by distance to HERO EDGE,
        //    not hero center. Treat hero as a rectangle hitbox.
        // ------------------------------------------------------------
        let target = heroTargets[0]
        let bestD2 = 1e9
        let bestDx = 0
        let bestDy = 0
        let bestEdgeX = target.x
        let bestEdgeY = target.y

        for (let hi = 0; hi < heroTargets.length; hi++) {
            const h = heroTargets[hi]

            // Get hero width/height from image if possible
            const img: any = (h as any).image
            const heroW =
                (img && img.width) ||
                (h as any).width ||
                16
            const heroH =
                (img && img.height) ||
                (h as any).height ||
                16

            const halfW = heroW / 2
            const halfH = heroH / 2

            const left   = h.x - halfW
            const right  = h.x + halfW
            const top    = h.y - halfH
            const bottom = h.y + halfH

            // Clamp enemy position to hero rectangle to get closest edge point
            let edgeX = enemy.x
            if (edgeX < left) edgeX = left
            else if (edgeX > right) edgeX = right

            let edgeY = enemy.y
            if (edgeY < top) edgeY = top
            else if (edgeY > bottom) edgeY = bottom

            const dxEdge = edgeX - enemy.x
            const dyEdge = edgeY - enemy.y
            const d2 = dxEdge * dxEdge + dyEdge * dyEdge

            if (d2 < bestD2) {
                bestD2 = d2
                target = h
                bestDx = dxEdge
                bestDy = dyEdge
                bestEdgeX = edgeX
                bestEdgeY = edgeY
            }
        }

        // ------------------------------------------------------------
        // 3) Maybe START a new attack if we are close enough to EDGE
        //    and off cooldown.
        // ------------------------------------------------------------
        const atkRangePx = 20
        const atkRange2 = atkRangePx * atkRangePx

        if (bestD2 <= atkRange2 && nowMs >= atkCooldownUntil) {
            // Direction we will face for the attack (based on edge offset)
            let attackDir = "down"
            if (Math.abs(bestDx) > Math.abs(bestDy)) {
                attackDir = bestDx >= 0 ? "right" : "left"
            } else {
                attackDir = bestDy >= 0 ? "down" : "up"
            }

            // Scale attack duration by per-enemy attack rate
            const atkRatePct = sprites.readDataNumber(enemy, ENEMY_DATA.ATK_RATE_PCT) || 100
            const baseAttackDurationMs = 350
            let attackMs = baseAttackDurationMs
            if (atkRatePct !== 100) {
                attackMs = Math.idiv(baseAttackDurationMs * 100, atkRatePct)
            }
            if (attackMs < 150) attackMs = 150

            // NEW: tell Phaser how long the attack animation should last
            sprites.setDataNumber(enemy, "attackAnimMs", attackMs)

            // Enter attack state
            sprites.setDataString(enemy, "phase", "attack")
            sprites.setDataNumber(enemy, ENEMY_DATA.ATK_PHASE, ENEMY_ATK_PHASE_ATTACK)
            sprites.setDataNumber(enemy, ENEMY_DATA.ATK_UNTIL, nowMs + attackMs)
            sprites.setDataString(enemy, "dir", attackDir)

            // Freeze movement while attacking
            enemy.vx = 0
            enemy.vy = 0

            const mid = sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)"
            if (ei === 0) {
                //console.log(
                //    "[enemyHoming] START ATTACK",
                //    "monsterId=", mid,
                //    "phase=", "attack",
                //    "d2=", bestD2,
                //    "attackMs=", attackMs
                //)
            }

            // IMPORTANT: bail out of steering; _syncNativeSprites + monsterAnimGlue
            // will see phase="attack" + dir and swap the LPC anim.
            continue
        }

        // If we're basically on the hero edge, stop (but stay in walk phase)
        if (bestD2 < 1) {
            enemy.vx = 0
            enemy.vy = 0
            sprites.setDataNumber(enemy, ENEMY_DATA.RETURNING_HOME, 0)
            continue
        }

        // ------------------------------------------------------------
        // 4) Steering: walk toward the closest EDGE point instead of center
        // ------------------------------------------------------------
        const origTX = target.x
        const origTY = target.y

        // Temporarily treat the hero as if its "target point"
        // were the closest edge point we computed.
        ;(target as any).x = bestEdgeX
        ;(target as any).y = bestEdgeY

        _enemySteerTowardHero(enemy, target, speed)

        // Restore hero's real center so we don't break anything else
        ;(target as any).x = origTX
        ;(target as any).y = origTY

        // --- Direction string for animation ("up"/"down"/"left"/"right") ---
        let dir = "down"
        if (Math.abs(enemy.vx) > Math.abs(enemy.vy)) {
            dir = enemy.vx >= 0 ? "right" : "left"
        } else {
            dir = enemy.vy >= 0 ? "down" : "up"
        }
        sprites.setDataString(enemy, "dir", dir)

        // --- DEBUG log (throttled, first enemy only) ---
        if (ei === 0 && (nowMs - _lastEnemyHomingLogMs) >= 10000) {
            //console.log(
                //"[enemyHoming] tick",
                //"monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                //"phase=", phaseStr,
                //"x=", enemy.x, "y=", enemy.y,
                //"vx=", enemy.vx, "vy=", enemy.vy,
                //"t=", nowMs
            //)
            _lastEnemyHomingLogMs = nowMs
        }
    }
}



function spawnDummyEnemy(x: number, y: number) {
    const enemy = sprites.create(img`
        . . . . . . c c c c . . . . . .
        . . . . c c 6 6 6 6 c c . . . .
        . . . c 6 6 6 6 6 6 6 6 c . . .
        . . c 6 6 6 6 6 6 6 6 6 6 c . .
        . . c 6 6 f f 6 6 f f 6 6 c . .
        . c 6 6 6 6 6 6 6 6 6 6 6 6 c .
        . . . . c c 6 6 6 6 c c . . . .
    `, SpriteKind.Enemy)
    enemy.x = x; enemy.y = y; enemy.z = 10
    const eIndex = enemies.length; enemies.push(enemy)
    initEnemyHP(eIndex, enemy, 50)
    sprites.setDataNumber(enemy, ENEMY_DATA.SPEED, 28)
    sprites.setDataNumber(enemy, ENEMY_DATA.TOUCH_DAMAGE, 8)
    sprites.setDataNumber(enemy, ENEMY_DATA.REGEN_PCT, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_PCT, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.SLOW_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_PCT, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.WEAKEN_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.KNOCKBACK_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_PHASE, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_UNTIL, 0)
    sprites.setDataNumber(enemy, ENEMY_DATA.ATK_COOLDOWN_UNTIL, 0)
}

//function setupTestEnemies() { spawnDummyEnemy(30, 40); spawnDummyEnemy(130, 40) }
function setupTestEnemies() {
    if (SHOP_MODE_ACTIVE) return
    // Use the real enemy spawn path so Phaser sees monsterId, phase, dir, etc.
    spawnEnemyOfKind("imp blue", 30, 40, /*elite=*/ false);
    spawnEnemyOfKind("imp blue", 130, 40, /*elite=*/ false);
}


function getEnemyIndex(enemy: Sprite) { for (let i = 0; i < enemies.length; i++) if (enemies[i] == enemy) return i; return -1 }

function getHeroIndex(hero: Sprite) { for (let i = 0; i < heroes.length; i++) if (heroes[i] == hero) return i; return -1 }

// Enemy HP
function initEnemyHP(enemyIndex: number, enemy: Sprite, maxHPVal: number) {
    sprites.setDataNumber(enemy, ENEMY_DATA.MAX_HP, maxHPVal)
    sprites.setDataNumber(enemy, ENEMY_DATA.HP, maxHPVal)
    const bar = statusbars.create(18, 3, StatusBarKind.EnemyHealth)
    bar.attachToSprite(enemy); bar.setOffsetPadding(0, 2)
    bar.max = 100; bar.value = 100
    enemyHPBars[enemyIndex] = bar
}

function updateEnemyHPBar(enemyIndex: number) {
    const enemy = enemies[enemyIndex]; if (!enemy) return
    const bar = enemyHPBars[enemyIndex]; if (!bar) return
    const hp = sprites.readDataNumber(enemy, ENEMY_DATA.HP)
    let maxHp = sprites.readDataNumber(enemy, ENEMY_DATA.MAX_HP); if (maxHp <= 0) maxHp = 1
    bar.value = Math.max(0, Math.min(100, Math.idiv(hp * 100, maxHp)))
}


function applyDamageToEnemyIndex(eIndex: number, amount: number) {
    if (eIndex < 0 || eIndex >= enemies.length) return
    const enemy = enemies[eIndex]; if (!enemy) return

    let hp = sprites.readDataNumber(enemy, ENEMY_DATA.HP)
    hp = Math.max(0, hp - amount)

    showDamageNumber(enemy.x, enemy.y - 6, amount, "damage")
    sprites.setDataNumber(enemy, ENEMY_DATA.HP, hp)
    updateEnemyHPBar(eIndex)
    flashEnemyOnDamage(enemy)

    if (hp <= 0) {
        // Already dying? don't reschedule (and don't double-award)
        const existing = sprites.readDataNumber(enemy, ENEMY_DATA.DEATH_UNTIL) | 0
        if (existing > 0) return

        // ----------------------------
        // NEW: coin reward on kill
        // ----------------------------
        let maxHp = sprites.readDataNumber(enemy, ENEMY_DATA.MAX_HP) | 0
        if (maxHp <= 0) maxHp = 1
        const coins = Math.max(COIN_REWARD_MIN, Math.idiv(maxHp + (COIN_REWARD_HP_DIV - 1), COIN_REWARD_HP_DIV))
        addTeamCoins(coins, enemy.x, enemy.y - 12)

        const now = game.runtime()
        const deathDurationMs = 900  // tweak this and LPC death anim will auto-match

        // Tell Phaser: switch to death anim
        sprites.setDataString(enemy, "phase", "death")

        // Tell Phaser how long the death animation should last
        sprites.setDataNumber(enemy, "deathAnimMs", deathDurationMs)

        // Clear attack state
        sprites.setDataNumber(enemy, ENEMY_DATA.ATK_PHASE, ENEMY_ATK_PHASE_IDLE)
        sprites.setDataNumber(enemy, ENEMY_DATA.ATK_UNTIL, 0)
        sprites.setDataNumber(enemy, ENEMY_DATA.ATK_COOLDOWN_UNTIL, 0)

        // Freeze motion
        enemy.vx = 0
        enemy.vy = 0

        // Let updateEnemyHoming own the actual destroy timing
        sprites.setDataNumber(enemy, ENEMY_DATA.DEATH_UNTIL, now + deathDurationMs)
    }
}



// NEW: Enemy flash on damage
function flashEnemyOnDamage(enemy: Sprite) {
    const flashDuration = 150, flashInterval = 50
    const start = game.runtime()
    game.onUpdate(function () {
        if (!HeroEngine._isStarted()) return
        if (!enemy || (enemy.flags & sprites.Flag.Destroyed)) return
        const elapsed = game.runtime() - start
        if (elapsed >= flashDuration) { enemy.setFlag(SpriteFlag.Invisible, false); return }
        const phase = Math.idiv(elapsed, flashInterval)
        enemy.setFlag(SpriteFlag.Invisible, phase % 2 == 0)
    })
}








// ================================================================
// SECTION F - FINAL SECTION - onUpdates, GAME LOOP, INPUT, ENEMY AI/WAVES & STARTUP
// ================================================================
// Input → move execution → projectile updates → INT control → cleanup → enemy AI → UI.


function updateHeroTimelineProgressAll(nowMs: number): void {
    const now = nowMs | 0

    // Phases that should "cycle" visually (loop progress).
    // Everything else clamps (0→max and stays).
    const ph = (s: Sprite) => (sprites.readDataString(s, HERO_DATA.PhaseName) || "")
    const isAmbientPhase = (phaseName: string): boolean => {
        switch (phaseName) {
            case "idle":
            case "run":
            case "walk":
            case "combatIdle":
            case "sit":
            case "watering":
            case "emote":
            case "climb":
                return true
            default:
                return false
        }
    }

    const clampProg = (p: number): number => {
        let x = p | 0
        if (x < 0) x = 0
        if (x > PHASE_PROGRESS_MAX) x = PHASE_PROGRESS_MAX
        return x
    }

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue
        if (hero.flags & sprites.Flag.Destroyed) continue

        // -------------------------
        // Whole-phase progress
        // -------------------------
        const phaseName = ph(hero)
        const ps = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
        let pd = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0
        if (pd <= 0) pd = 1

        if (ps > 0) {
            const elapsed = (now - ps) | 0

            // Loop only for ambient phases; clamp for action phases.
            // (This matches your goal: phases own rendering; actions don't "replay" because progress loops.)
            let e = elapsed
            if (e < 0) e = 0

            if (isAmbientPhase(phaseName)) {
                // loop
                const eMod = (pd > 0) ? (e % pd) : 0
                const pInt = clampProg(Math.idiv(PHASE_PROGRESS_MAX * eMod, pd))
                sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, pInt)
            } else {
                // clamp
                let eClamp = e
                if (eClamp > pd) eClamp = pd
                const pInt = clampProg(Math.idiv(PHASE_PROGRESS_MAX * eClamp, pd))
                sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, pInt)
            }
        }

        // -------------------------
        // Phase-part progress (only if part is active)
        // -------------------------
        const partName = sprites.readDataString(hero, HERO_DATA.PhasePartName) || ""
        if (partName && partName.length > 0) {
            const partS = sprites.readDataNumber(hero, HERO_DATA.PhasePartStartMs) | 0
            let partD = sprites.readDataNumber(hero, HERO_DATA.PhasePartDurationMs) | 0
            if (partD <= 0) partD = 1

            if (partS > 0) {
                let pe = (now - partS) | 0
                if (pe < 0) pe = 0
                if (pe > partD) pe = partD
                const pPart = clampProg(Math.idiv(PHASE_PROGRESS_MAX * pe, partD))
                sprites.setDataNumber(hero, HERO_DATA.PhasePartProgress, pPart)
            }
        }
    }
}



function updateHeroProjectiles() {
    const now = game.runtime()

    // 1) STR/AGI/SUPPORT projectiles in heroProjectiles[]
    for (let i = heroProjectiles.length - 1; i >= 0; i--) {
        const proj = heroProjectiles[i]
        if (!proj || (proj.flags & sprites.Flag.Destroyed)) {
            heroProjectiles.removeAt(i)
            continue
        }

        const heroIndex = sprites.readDataNumber(proj, PROJ_DATA.HERO_INDEX) | 0
        const hero = heroes[heroIndex]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) {
            proj.destroy()
            heroProjectiles.removeAt(i)
            continue
        }

        const mvType = (sprites.readDataString(proj, PROJ_DATA.MOVE_TYPE) || "").toLowerCase()

        if (mvType === "agilitystab" || mvType === "agilitystablow") {
            if (!updateAgilityProjectilesMotionFor(proj, hero, heroIndex, now, i)) {
                continue
            }
        } else if (mvType === "strengthswing") {
            if (!updateStrengthProjectilesMotionFor(proj, hero, heroIndex, now, i)) {
                continue
            }
        } else if (mvType === "supportbeam") {
            if (!updateSupportBeamFor(proj, heroIndex, now, i)) {
                heroProjectiles.removeAt(i)
                continue
            }
        } else {
            continue
        }
    }

    // 2) INT spells
    updateIntellectSpellsControl()
    processIntellectLingers()

    // 3) NEW (C4): Agility execute slashes (no projectiles required)
    updateAgilityExecuteAll(now)
}





// Cleanup for timed destroy set by runIntellectDetonation
function updateProjectilesCleanup() {
    const now = game.runtime()
    
    for (let i = heroProjectiles.length - 1; i >= 0; i--) {
        const proj = heroProjectiles[i]
        if (!proj || (proj.flags & sprites.Flag.Destroyed)) continue
        const destroyAt = sprites.readDataNumber(proj, PROJ_DATA.DESTROY_AT) | 0
        if (destroyAt > 0 && now >= destroyAt) proj.destroy()
    }
}




function encodeIntentToStrBtnId(intent: string): number {
    if (intent === "A") return STR_BTN_A
    if (intent === "B") return STR_BTN_B
    if (intent === "A+B") return STR_BTN_AB
    return STR_BTN_NONE
}

function isStrBtnIdPressedForOwner(ownerId: number, btnId: number): boolean {
    let ctrl: controller.Controller = null
    if (ownerId === 1) ctrl = controller.player1
    else if (ownerId === 2) ctrl = controller.player2
    else if (ownerId === 3) ctrl = controller.player3
    else if (ownerId === 4) ctrl = controller.player4
    if (!ctrl) return false

    const a = ctrl.A.isPressed()
    const b = ctrl.B.isPressed()

    if (btnId === STR_BTN_A) return a
    if (btnId === STR_BTN_B) return b
    if (btnId === STR_BTN_AB) return a && b
    return false
}



function consumePlayerIntent(playerId: number): string {
    // 2-deep FIFO pop: return pending1, shift pending2 up.
    if (playerId === 1) {
        if (p1IntentPending !== "") {
            const s = p1IntentPending
            p1IntentPending = p1IntentPending2
            p1IntentPending2 = ""
            return s
        }
        if (p1IntentPending2 !== "") {
            const s = p1IntentPending2
            p1IntentPending2 = ""
            return s
        }
        return ""
    } else if (playerId === 2) {
        if (p2IntentPending !== "") {
            const s = p2IntentPending
            p2IntentPending = p2IntentPending2
            p2IntentPending2 = ""
            return s
        }
        if (p2IntentPending2 !== "") {
            const s = p2IntentPending2
            p2IntentPending2 = ""
            return s
        }
        return ""
    } else if (playerId === 3) {
        if (p3IntentPending !== "") {
            const s = p3IntentPending
            p3IntentPending = p3IntentPending2
            p3IntentPending2 = ""
            return s
        }
        if (p3IntentPending2 !== "") {
            const s = p3IntentPending2
            p3IntentPending2 = ""
            return s
        }
        return ""
    } else if (playerId === 4) {
        if (p4IntentPending !== "") {
            const s = p4IntentPending
            p4IntentPending = p4IntentPending2
            p4IntentPending2 = ""
            return s
        }
        if (p4IntentPending2 !== "") {
            const s = p4IntentPending2
            p4IntentPending2 = ""
            return s
        }
        return ""
    }
    return ""
}




function updatePlayerInputs() {
    const nowMs = game.runtime() | 0

    // --------------------------
    // Player 1
    // --------------------------
    const a1 = controller.player1.A.isPressed()
    const b1 = controller.player1.B.isPressed()

    // Held intent (kept for debug visibility)
    if (a1 && b1) p1Intent = "A+B"
    else if (a1) p1Intent = "A"
    else if (b1) p1Intent = "B"
    else p1Intent = ""

    // Edge intent: enqueue on rising edge, require release before another edge
    const a1Edge = a1 && !_p1PrevA
    const b1Edge = b1 && !_p1PrevB
    if (a1Edge || b1Edge) {
        const ev1 = (a1Edge && b1Edge) ? "A+B" : (a1Edge ? "A" : "B")
        if (p1IntentPending === "") p1IntentPending = ev1
        else if (p1IntentPending2 === "") p1IntentPending2 = ev1
        else p1IntentPending2 = ev1 // overwrite newest if spammed
    }

    if (DEBUG_HERO_LOGIC && DEBUG_FILTER_LOGS) {
        const changed = (p1Intent !== _dbg_prevP1Intent)
        const abChanged = (a1 !== _dbg_prevP1A) || (b1 !== _dbg_prevP1B)
        if (changed || abChanged || a1Edge || b1Edge) {
            const dur = (_dbg_prevP1IntentMs > 0) ? (nowMs - _dbg_prevP1IntentMs) : 0
            console.log(
                DEBUG_FILTER_PHRASE +
                " EDGE timeMs=" + nowMs +
                " intent=" + p1Intent +
                " (prev=" + _dbg_prevP1Intent + " prevDurMs=" + dur + ")" +
                " aNow=" + (a1 ? 1 : 0) +
                " bNow=" + (b1 ? 1 : 0) +
                " aEdge=" + (a1Edge ? 1 : 0) +
                " bEdge=" + (b1Edge ? 1 : 0) +
                " pending=" + p1IntentPending +
                " pending2=" + p1IntentPending2
            )

            if (_dbg_prevP1Intent === "" && p1Intent !== "") _dbg_prevP1IntentMs = nowMs
            if (_dbg_prevP1Intent !== "" && p1Intent === "") _dbg_prevP1IntentMs = 0

            _dbg_prevP1Intent = p1Intent
            _dbg_prevP1A = a1
            _dbg_prevP1B = b1
        }
    }

    _p1PrevA = a1
    _p1PrevB = b1

    // --------------------------
    // Player 2
    // --------------------------
    const a2 = controller.player2.A.isPressed()
    const b2 = controller.player2.B.isPressed()

    if (a2 && b2) p2Intent = "A+B"
    else if (a2) p2Intent = "A"
    else if (b2) p2Intent = "B"
    else p2Intent = ""

    const a2Edge = a2 && !_p2PrevA
    const b2Edge = b2 && !_p2PrevB
    if (a2Edge || b2Edge) {
        const ev2 = (a2Edge && b2Edge) ? "A+B" : (a2Edge ? "A" : "B")
        if (p2IntentPending === "") p2IntentPending = ev2
        else if (p2IntentPending2 === "") p2IntentPending2 = ev2
        else p2IntentPending2 = ev2
    }
    _p2PrevA = a2
    _p2PrevB = b2

    // --------------------------
    // Player 3
    // --------------------------
    const a3 = controller.player3.A.isPressed()
    const b3 = controller.player3.B.isPressed()

    if (a3 && b3) p3Intent = "A+B"
    else if (a3) p3Intent = "A"
    else if (b3) p3Intent = "B"
    else p3Intent = ""

    const a3Edge = a3 && !_p3PrevA
    const b3Edge = b3 && !_p3PrevB
    if (a3Edge || b3Edge) {
        const ev3 = (a3Edge && b3Edge) ? "A+B" : (a3Edge ? "A" : "B")
        if (p3IntentPending === "") p3IntentPending = ev3
        else if (p3IntentPending2 === "") p3IntentPending2 = ev3
        else p3IntentPending2 = ev3
    }
    _p3PrevA = a3
    _p3PrevB = b3

    // --------------------------
    // Player 4
    // --------------------------
    const a4 = controller.player4.A.isPressed()
    const b4 = controller.player4.B.isPressed()

    if (a4 && b4) p4Intent = "A+B"
    else if (a4) p4Intent = "A"
    else if (b4) p4Intent = "B"
    else p4Intent = ""

    const a4Edge = a4 && !_p4PrevA
    const b4Edge = b4 && !_p4PrevB
    if (a4Edge || b4Edge) {
        const ev4 = (a4Edge && b4Edge) ? "A+B" : (a4Edge ? "A" : "B")
        if (p4IntentPending === "") p4IntentPending = ev4
        else if (p4IntentPending2 === "") p4IntentPending2 = ev4
        else p4IntentPending2 = ev4
    }
    _p4PrevA = a4
    _p4PrevB = b4
}





// Agility/Strength projectile motion (unchanged)
function updateMeleeProjectilesMotion() {
    const now = game.runtime()
    for (let i = heroProjectiles.length - 1; i >= 0; i--) {
        const proj = heroProjectiles[i]
        if (!proj || proj.flags & sprites.Flag.Destroyed) { heroProjectiles.removeAt(i); continue }
        const heroIndex = sprites.readDataNumber(proj, PROJ_DATA.HERO_INDEX) | 0
        const hero = heroes[heroIndex]
        if (!hero || (hero.flags & sprites.Flag.Destroyed)) { proj.destroy(); heroProjectiles.removeAt(i); continue }
        const mvType = (sprites.readDataString(proj, PROJ_DATA.MOVE_TYPE) || "").toLowerCase()
        if (mvType === "agilitystab" || mvType === "agilitystablow") {
            if (!updateAgilityProjectilesMotionFor(proj, hero, heroIndex, now, i)) continue
        } else if (mvType === "strengthswing") {
            if (!updateStrengthProjectilesMotionFor(proj, hero, heroIndex, now, i)) continue
        } else {
            // (driven spells handled elsewhere)
        }
    }
}



// New helper: clean up heroes after their death animation finishes
function updateHeroDeaths(now: number) {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i];
        if (!hero) continue;

        if (!sprites.readDataBoolean(hero, HERO_DATA.IS_DEAD)) continue;

        const deathUntil = sprites.readDataNumber(hero, HERO_DATA.DEATH_UNTIL) | 0;
        if (deathUntil > 0 && now >= deathUntil) {
            // Final destroy – same effect as before, just delayed so LPC death can play.
            hero.destroy(effects.disintegrate, 200);

            // Optional: clear the timer so we don't re-evaluate
            sprites.setDataNumber(hero, HERO_DATA.DEATH_UNTIL, 0);
        }
    }
}


function updateHeroMovementPhase(now: number) {
    const nowMs = now | 0

    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]
        if (!hero) continue

        // Don't stomp death visuals
        if (sprites.readDataBoolean(hero, HERO_DATA.IS_DEAD)) continue;

        // Optional: avoid stomping NPC-ish actors (shopkeeper, announcer, etc.)
        // (Uses data you already have: heroName + player index convention you’re using in logs.)
        const pIndex = sprites.readDataNumber(hero, HERO_DATA.PLAYER_INDEX) | 0
        const heroName0 = (sprites.readDataString(hero, "heroName") || "")
        if (pIndex >= 90 || heroName0 === "Shopkeeper") continue

        // Intellect LAND owns the phase until finishIntellectSpellForHero runs.
        const landEnd = sprites.readDataNumber(hero, INT_CAST_LAND_END_MS_KEY) | 0
        if (landEnd > 0 && nowMs < landEnd) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, `reason=INT_LAND now=${nowMs} landEnd=${landEnd}`)
            continue
}


        // Intellect "controlling spell" owns the phase entirely (cast / control visuals)
        if (sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, "reason=CTRL_SPELL")
            continue
        }

        // Agility execute owns the phase entirely
        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        if (agiState === AGI_STATE.EXECUTING) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, "reason=AGI_EXECUTING")
            continue
        }

        // Strength charging owns the phase ("slash")
        if (sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, "reason=STR_CHARGING")
            continue
        }

        // If a hold-frame / override is active, don't stomp phase either
        const fco = sprites.readDataNumber(hero, HERO_DATA.FRAME_COL_OVERRIDE) | 0
        if (fco >= 0) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, "reason=FRAME_COL_OVERRIDE")
            continue
        }

        // If we're busy (attack/cast/death window), do not override the phase
        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) | 0
        if (busyUntil > 0 && nowMs < busyUntil) {
            _dbgMovePipeTick("AMB_SKIP", hi, hero, nowMs, `reason=BUSY now=${nowMs} busyUntil=${busyUntil}`)
            continue
        }

        // Decide ambient phase (PRESERVE OLD BEHAVIOR)
        let desiredPhase = "idle"

        const RUN_THRESH_SQ = 50
        const WALK_THRESH_SQ = 10

        // Agility combo build mode: show combat idle pose
        if (agiState === AGI_STATE.ARMED) {
            desiredPhase = "combatIdle"
        } else {
            const speedSq = (hero.vx * hero.vx) + (hero.vy * hero.vy)
            if (speedSq > RUN_THRESH_SQ) desiredPhase = "run"
            else if (speedSq > WALK_THRESH_SQ) desiredPhase = "walk"
            else desiredPhase = "idle"
        }

        // Unified contract: ambient is NOT segmented
        _animKeys_clearPhasePart(hero)

        // ***** THE MISSING FIX *****
        // If ambient owns the hero, ActionKind MUST be "none".
        // Your logs show: Phase becomes idle/run but ActionKind remains intellect_cast -> animation resolver mismatch -> blank/invisible.
        const ak = sprites.readDataString(hero, HERO_DATA.ActionKind) || "none"
        if (ak !== "none") {
            sprites.setDataString(hero, HERO_DATA.ActionKind, "none")
            // Optional safety: reset action params so nothing downstream “refines” based on stale cast metadata.
            sprites.setDataNumber(hero, HERO_DATA.ActionVariantBtnId, 0)
            sprites.setDataNumber(hero, HERO_DATA.ActionSeed, 0)
            sprites.setDataNumber(hero, HERO_DATA.ActionTargetSpriteId, 0)
            _dbgMovePipeTick("AMB_CLR_AK", hi, hero, nowMs, `prevActionKind=${ak} -> none`)
        }

        const wantDur = _ambientPhaseWindowMs(desiredPhase) | 0

        // Current phase window state (authoritative keys)
        const curPhaseName = sprites.readDataString(hero, HERO_DATA.PhaseName) || ""
        const curStart = sprites.readDataNumber(hero, HERO_DATA.PhaseStartMs) | 0
        const curDur = sprites.readDataNumber(hero, HERO_DATA.PhaseDurationMs) | 0

        // If PhaseName differs, switch immediately and stamp a valid non-zero window.
        if (curPhaseName !== desiredPhase) {
            setHeroPhaseString(hi, desiredPhase)
            _animKeys_stampPhaseWindow(hi, hero, desiredPhase, nowMs, wantDur, "updateHeroMovementPhase(ambient:change)")
            continue
        }

        // If window is invalid (should not happen under the unified contract), repair it.
        if (curStart <= 0 || curDur <= 0) {
            _animKeys_stampPhaseWindow(hi, hero, desiredPhase, nowMs, wantDur, "updateHeroMovementPhase(ambient:repair)")
            continue
        }

        // Window is valid and PhaseName matches desired ambient.
        // Update PhaseProgressInt continuously so Phaser can animate idle/run/combatIdle via progress.
        const elapsed = ((nowMs - curStart) % curDur) | 0
        const e = elapsed < 0 ? 0 : elapsed
        const pInt = clampInt(Math.idiv(PHASE_PROGRESS_MAX * e, curDur), 0, PHASE_PROGRESS_MAX)
        sprites.setDataNumber(hero, HERO_DATA.PhaseProgressInt, pInt)
    }
}




// LOCK/UNLOCK HYGIENE (ALLOWED CLEARER)
// Allowed: clearing PhaseFlags and EventMask on unlock to prevent stale visuals.
// NOT allowed: incrementing ActionSequence or changing ActionKind.
// Events: never touch EventSequence here (emitters only).
function updateHeroControlLocks(now: number) {
    const nowMs = now | 0

    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]
        if (!hero) continue

        const agiState = sprites.readDataNumber(hero, HERO_DATA.AGI_STATE) | 0
        const isAgiBuildMode = (agiState === AGI_STATE.ARMED)
        const isAgiExecuting = (agiState === AGI_STATE.EXECUTING)

        const isCtrlSpell = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)
        const isStrCharging = sprites.readDataBoolean(hero, HERO_DATA.STR_CHARGING)
        const isSupportPuzzle = (supportPuzzleActive && supportPuzzleActive[i]) ? true : false

        // If we are in Agility build mode but somehow not locked, lock now.
        // Critical: combo build must stay locked after dash ends.
        const locked0 = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)
        if (!isCtrlSpell && isAgiBuildMode && !locked0) {
            lockHeroControls(i)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            hero.vx = 0
            hero.vy = 0
        }

        // IMPORTANT: declare lockedNow BEFORE any branch that uses it
        const lockedNow = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)

        // Mirror from HERO_DATA (canonical) into heroBusyUntil[] for consistency
        const busyUntil = getHeroBusyUntil(i) | 0

        // ------------------------------------------------------------
        // LOCK OWNERSHIP CASES (do NOT auto-unlock here)
        // ------------------------------------------------------------

        // Intellect “controlling spell” owns the lock window (often not busyUntil-driven).
        // Keep hero frozen and do NOT auto-unlock based on busyUntil.
        if (isCtrlSpell) {
            if (!lockedNow) lockHeroControls(i)
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            continue
        }

        // NEW: Intellect LAND owns the lock window until landEnd expires.
        // Prevent generic busyUntil unlock from firing during land.
        const landEnd = sprites.readDataNumber(hero, INT_CAST_LAND_END_MS_KEY) | 0
        if (landEnd > 0 && nowMs < landEnd) {
            if (!lockedNow) lockHeroControls(i)
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            continue
        }

        // Support puzzle owns the lock (busyUntil is huge; cleared on solve).
        if (isSupportPuzzle) {
            if (!lockedNow) lockHeroControls(i)
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            continue
        }

        // Strength charging owns the lock. Never auto-unlock, never allow velocity.
        if (isStrCharging) {
            if (!lockedNow) lockHeroControls(i)
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            continue
        }

        // During ARMED/EXECUTING: allow aim changes, but DO NOT allow velocity changes.
        // Unlock is handled by cancel or execute finish.
        if (isAgiBuildMode || isAgiExecuting) {
            if (!lockedNow) lockHeroControls(i)
            hero.vx = 0
            hero.vy = 0
            sprites.setDataNumber(hero, HERO_DATA.STORED_VX, 0)
            sprites.setDataNumber(hero, HERO_DATA.STORED_VY, 0)
            continue
        }

        // ------------------------------------------------------------
        // NORMAL LOCK BEHAVIOR (dash / cast travel / etc.)
        // Preserve stored velocity until busyUntil ends.
        // ------------------------------------------------------------

        if (lockedNow) {
            _dbgMovePipeTick("LOCK_TICK", i, hero, nowMs, "")
            hero.vx = sprites.readDataNumber(hero, HERO_DATA.STORED_VX)
            hero.vy = sprites.readDataNumber(hero, HERO_DATA.STORED_VY)
        }

        // IMPORTANT: do NOT auto-unlock when busyUntil is 0.
        // Only unlock when an actual busy window expires.
        if (busyUntil > 0 && nowMs >= busyUntil) {

            // End of busy window
            clearHeroBusyUntil(i)
            sprites.setDataNumber(hero, HERO_DATA.PhaseFlags, 0)

            // Events: never touch EventSequence here (emitters only).
            _animEvent_clear(hero)

            // Clear phase-part segmentation so we don't stay "windup"/"aim"/"puzzle" while idle
            _animKeys_clearPhasePart(hero)

            // RenderStyle policy:
            // Keep RenderStyleMask as-is (persists until next action edge overwrites it).
            // If you want "style only during an action", uncomment the next line:
            // sprites.setDataNumber(hero, HERO_DATA.RenderStyleMask, 0)

            if (DEBUG_ANIM_KEYS) console.log(_dbgAnimKeysLine(i, hero, "UNLOCK"))

            unlockHeroControls(i)

            // Return to ambient phase selection; do not force a phase here.
            // updateHeroMovementPhase() will decide idle/run/combatIdle.
        }
    }
}



// New helper: clear expired enemy effects (knockback, slow, etc.)
function updateEnemyEffects(now: number) {
    for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j]
        if (!e) continue

        const kbUntil = sprites.readDataNumber(e, ENEMY_DATA.KNOCKBACK_UNTIL)
        if (kbUntil > 0 && now >= kbUntil) {
            e.vx = 0
            e.vy = 0
            sprites.setDataNumber(e, ENEMY_DATA.KNOCKBACK_UNTIL, 0)
        }

        const slowUntil = sprites.readDataNumber(e, ENEMY_DATA.SLOW_UNTIL)
        const slowPct = sprites.readDataNumber(e, ENEMY_DATA.SLOW_PCT)
        if (slowPct > 0 && slowUntil <= now) {
            sprites.setDataNumber(e, ENEMY_DATA.SLOW_PCT, 0)
        }
    }
}



// Master update
// Master update
// Master update
game.onUpdate(function () {
    if (!HeroEngine._isStarted()) return

    // snapshot previous positions for all heroes
    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (h) {
            sprites.setDataNumber(h, HERO_DATA.PREV_X, h.x)
            sprites.setDataNumber(h, HERO_DATA.PREV_Y, h.y)
        }
    }

    updateHeroFacingsFromVelocity()
    updatePlayerInputs()

    const now = game.runtime() | 0

    // keep a canonical world-runtime mirror
    worldRuntimeMs = now

    // ------------------------------------------------------------
    // SHOP LOOP (always runs; it owns focus + publishes highlight state)
    // ------------------------------------------------------------
        if(SHOP_MODE_ACTIVE_MASTER) {
    shopModeUpdate(now)
    shopTick(now)   // or shopTick(now) if that’s your canonical name
    }


    // ------------------------------------------------------------
    // SHOP MODE GATE: "exit normal loop" by returning early.
    // We still allow movement/locks/phase/collisions so the world feels alive.
    // ------------------------------------------------------------
if (SHOP_MODE_ACTIVE) {
       // The per-frame shop “owner” loop (NOT just inputs)
        //shopTick(now)   // or shopTick(now) if that’s your canonical name


        // Let any prior busy windows expire and unlock heroes naturally
        updateHeroControlLocks(now)

        // Keep run/idle visuals responsive while walking around the shop
        updateHeroMovementPhase(now)

        // Keep walls real in shop space too
        resolveTilemapCollisions()

        dbgContractSnapshotAllHeroes(now, "onUpdate:shopMode")

        // Nothing else (no enemies, projectiles, waves, etc.)
        return
    }


    
    // ---------------- NORMAL COMBAT LOOP ----------------

    // Debug integrator logs
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]
        if (hero) debugDashIntegratorTick(hero)
    }

    updateStrengthChargingAllHeroes(now)
    updateAgilityComboLandingTransitions(now)
    updateAgilityManualCancelAllHeroes(now)
    updateSupportPuzzles(now)
    updateAgilityThrustMotionAll(now)


    // NEW: one universal progress updater (PhaseProgressInt + PhasePartProgress)
    updateHeroTimelineProgressAll(now)

    // NEW: publish strength swing segmentation (windup/forward/landing)
    updateStrengthSwingSegmentationAllHeroes(now)
    // NEW: late-spawn strength projectiles inside release window
    updateStrengthPendingSwingSpawnsAllHeroes(now)

    updateHeroControlLocks(now)
    updateHeroMovementPhase(now)
    updateHeroBuffs(now)
    updateHeroDeaths(now)

    updateHeroProjectiles()
    updateProjectilesCleanup()
    updateHeroOverlays()

    resolveTilemapCollisions()

    // After all gameplay writers + universal progress update, before render-side consumption:
    dbgContractSnapshotAllHeroes(now, "onUpdate:postWriters")


    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (h) debugAgilityDashProgress(h, hi)
    }

    updateEnemyHoming(now)
    updateEnemyEffects(now)


})




game.onUpdateInterval(80, function () {
    if (!HeroEngine._isStarted()) return
    if (SHOP_MODE_ACTIVE) return

    try {
        const nowMs = game.runtime() | 0

        const i1 = consumePlayerIntent(1)
        if (i1 !== "") {
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] BEFORE P1 intent=" + i1 + " timeMs=" + nowMs)
            doHeroMoveForPlayer(1, i1)
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] AFTER P1 intent=" + i1 + " timeMs=" + nowMs)
        }

        const i2 = consumePlayerIntent(2)
        if (i2 !== "") {
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] BEFORE P2 intent=" + i2 + " timeMs=" + nowMs)
            doHeroMoveForPlayer(2, i2)
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] AFTER P2 intent=" + i2 + " timeMs=" + nowMs)
        }

        const i3 = consumePlayerIntent(3)
        if (i3 !== "") {
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] BEFORE P3 intent=" + i3 + " timeMs=" + nowMs)
            doHeroMoveForPlayer(3, i3)
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] AFTER P3 intent=" + i3 + " timeMs=" + nowMs)
        }

        const i4 = consumePlayerIntent(4)
        if (i4 !== "") {
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] BEFORE P4 intent=" + i4 + " timeMs=" + nowMs)
            doHeroMoveForPlayer(4, i4)
            if (DEBUG_HERO_LOGIC) console.log("[TIMER80] AFTER P4 intent=" + i4 + " timeMs=" + nowMs)
        }
    } catch (e) {
        console.log("[TIMER80] ERROR in doHeroMoveForPlayer:" + e)
    }
})

// Timers

game.onUpdateInterval(500, function () {
    if (!HeroEngine._isStarted()) return
    regenHeroManaAll(2)
})






// Wave spawns — scripted waves with short breaks between them.
// The interval below is the *tick* rate for the spawner; the wave table
// controls when we are allowed to spawn and which kinds appear.


function showWaveBanner(waveIdx: number) {
    let label = "Wave " + (waveIdx + 1)
    if (WAVE_DEFS && waveIdx >= 0 && waveIdx < WAVE_DEFS.length) {
        const w = WAVE_DEFS[waveIdx]
        if (w && (w as any).label) label = (w as any).label
    }

    // bg=0 (dark), fg=1 (blue title)
    const txt = textsprite.create(label, 0, 1)
    txt.setMaxFontHeight(8)
    txt.setBorder(1, 15, 2)   // white border + padding
    txt.setOutline(1, 15)

    txt.lifespan = 1800
    txt.vy = -10

    const W = userconfig.ARCADE_SCREEN_WIDTH
    const H = userconfig.ARCADE_SCREEN_HEIGHT
    txt.setPosition(W / 2, H / 4)
}



// Wave spawns — scripted waves with short breaks between them.
// The interval below is the *tick* rate; WAVE_DEFS controls spawn density + types.
const ENEMY_SPAWN_INTERVAL_MS = 1200

    const POSSIBLE_MONSTERS = [

        "bat",
        "bee",
        "beetle",
        "big worm",
        "dragon red",
        "eyeball",
        "ghost",
        "goblin",
        "golem",
        "golem white",
        "googon",
        "imp blue",
        "imp green",
        "imp red",
        "man eater flower",
        "minotaur red",
        "pumpking",
        "slime",
        "slime black",
        "slime blue",
        "slime brown",
        "slime green",
        "slime lightblue",
//        "slime projectile",
        "slime red",
        "slime violet",
        "slime yellow",
        "small worm",
        "snake",
        "spider black",
        "spider black yellow",
        "spider blue",
        "spider blue orange",
        "spider blue silver",
        "spider green",
        "spider green yellow dot",
        "spider green yellow stripe",
        "spider red",
        "spider red yellow",
        "spider silver red",
        "wolf light brown"
    ]

    const WAVE_DEFS = [
    {
        label: "Wave 1 – Warmup",
        durationMs: 1200,
        breakMs: 4000,
        spawnChance: 0.5,
        // TODO: use your real monster ids here
        kinds: ["eyeball", "bat", "pumpking"],
        weights: [1,1,1]
    },
    {
        label: "Wave 2 – More Grunts",
        durationMs: 2400,
        breakMs: 4000,
        spawnChance: 0.75,
        kinds: ["eyeball"],
        weights: [1]
    },
    {
        label: "Wave 3 – Runners appear",
        durationMs: 2400,
        breakMs: 5000,
        spawnChance: 0.9,
        kinds: ["imp blue", "spider green"],
        weights: [3, 2]
    },
    {
        label: "Wave 4 – Big guys",
        durationMs: 2400,
        breakMs: 5000,
        spawnChance: 1.0,
        kinds: ["imp blue", "spider green", "big worm"],
        weights: [2, 2, 2]
    },
    {
        label: "Wave 5 – Elite Mix",
        durationMs: 2400,
        breakMs: 5000,
        spawnChance: 1.0,
        kinds: ["imp blue", "spider green", "big worm"],//, "dragon red"],
        weights: [3, 3, 2, 2]
    }
]


// Wave state
//let currentWaveIndex = 0
let currentWaveIsBreak = true
let wavePhaseUntilMs = game.runtime() + 1000 // short delay before first wave

// Debug: cycle through all POSSIBLE_MONSTERS on Wave 1
let debugMonsterIndex = 0



function pickEnemyKindForWave(waveIdx: number): string {
    // Returns a REAL monster id (as used by WAVE_DEFS.kinds).
    if (!WAVE_DEFS || WAVE_DEFS.length == 0) return "imp blue" // fallback

    if (waveIdx < 0) waveIdx = 0
    if (waveIdx >= WAVE_DEFS.length) waveIdx = WAVE_DEFS.length - 1

    // --- WAVE 1 DEBUG MODE ---
    // Wave 0: cycle deterministically through POSSIBLE_MONSTERS.
    if (waveIdx === 0 && POSSIBLE_MONSTERS && POSSIBLE_MONSTERS.length > 0) {
        const idx = debugMonsterIndex % POSSIBLE_MONSTERS.length
        const name = POSSIBLE_MONSTERS[idx]
        debugMonsterIndex++
        return name
    }
    // --- END DEBUG MODE ---

    const w = WAVE_DEFS[waveIdx]
    if (!w || !w.kinds || !w.weights || w.kinds.length == 0) {
        return WAVE_DEFS[0].kinds[0]
    }

    let total = 0
    for (let i = 0; i < w.weights.length; i++) {
        const wt = w.weights[i] | 0
        if (wt > 0) total += wt
    }
    if (total <= 0) return w.kinds[0]

    let roll = randint(1, total)
    for (let i = 0; i < w.kinds.length; i++) {
        const wt = w.weights[i] | 0
        if (wt <= 0) continue
        if (roll <= wt) return w.kinds[i]
        roll -= wt
    }

    return w.kinds[0]
}


game.onUpdateInterval(ENEMY_SPAWN_INTERVAL_MS, function () {
    if (!HeroEngine._isStarted()) return
    if (SHOP_MODE_ACTIVE) return
    if (!enemySpawners || enemySpawners.length == 0) return

    const now = game.runtime()

    if (!WAVE_DEFS || WAVE_DEFS.length == 0) {
        const idx = randint(0, enemySpawners.length - 1)
        const s = enemySpawners[idx]
        // Spawns a default real monster id if you ever run with no WAVE_DEFS
        console.log("Doing a default imp blue call to spawn enemy Of Kind")
        
        if (!SHOP_MODE_ACTIVE) {
        spawnEnemyOfKind("imp blue", s.x, s.y)
        }
        return
    }

    // Phase transitions
    if (now >= wavePhaseUntilMs) {
        if (currentWaveIsBreak) {
            // Start / resume a wave
            currentWaveIsBreak = false
            const w = (currentWaveIndex < WAVE_DEFS.length)
                ? WAVE_DEFS[currentWaveIndex]
                : WAVE_DEFS[WAVE_DEFS.length - 1]
            wavePhaseUntilMs = now + (w.durationMs | 0)
            showWaveBanner(currentWaveIndex)
        } else {
            // Wave just ended – schedule next break
            currentWaveIsBreak = true
            if (currentWaveIndex < WAVE_DEFS.length - 1) {
                currentWaveIndex++
            }
            const w = (currentWaveIndex < WAVE_DEFS.length)
                ? WAVE_DEFS[currentWaveIndex]
                : WAVE_DEFS[WAVE_DEFS.length - 1]
            wavePhaseUntilMs = now + (w.breakMs | 0)
        }
        return
    }

    if (currentWaveIsBreak) {
        // Rest window: no spawns
        return
    }

    // Active wave: spawn with wave-specific spawnChance
    const wave = (currentWaveIndex < WAVE_DEFS.length)
        ? WAVE_DEFS[currentWaveIndex]
        : WAVE_DEFS[WAVE_DEFS.length - 1]
    const chance = (wave as any).spawnChance || 1
    if (chance < 1 && Math.random() > chance) return

    const idx = randint(0, enemySpawners.length - 1)
    const s = enemySpawners[idx]
    const kind = pickEnemyKindForWave(currentWaveIndex)
    //console.log("Making a call to spawn enemy Of Kind")
    spawnEnemyOfKind(kind, s.x, s.y)
})








// --------------------------------------------------------------
// Phaser-only glue: expose HeroEngine namespace on globalThis
// (Safe in MakeCode Arcade: guarded by typeof globalThis.)
// --------------------------------------------------------------
if (typeof globalThis !== "undefined") {
    (globalThis as any).HeroEngine = HeroEngine;
}

// ----------------------------------------------------------
// Phaser-only side channel: expose tile internals via global
// WITHOUT changing namespace HeroEngine.
// ----------------------------------------------------------
(() => {
    try {
        const g: any = globalThis as any;
        g.__HeroEnginePhaserInternals = g.__HeroEnginePhaserInternals || {};

        g.__HeroEnginePhaserInternals.getWorldTileMap = function (): number[][] {
            return _engineWorldTileMap;
        };

        g.__HeroEnginePhaserInternals.getWorldTileSize = function (): number {
            return WORLD_TILE_SIZE;
        };

        // ------------------------------------------------------------
        // STEP 6: spawn-on-demand hook for the Phaser host.
        // This lets arcadeCompat (or any host glue) force-spawn P2..P4
        // the moment a player is assigned/connected, rather than waiting
        // for first input.
        //
        // TODO_NPLAYER_BRIDGE: later replace playerId<=4 assumption with
        // roster/slot assignment logic.
        // ------------------------------------------------------------
        g.__HeroEnginePhaserInternals.ensureHeroForPlayer = function (playerId: number): number {
            const pid = playerId | 0;
            if (pid < 1 || pid > 4) return -1;

            const existing = playerToHeroIndex[pid] | 0;
            if (existing >= 0 && existing < heroes.length && heroes[existing]) {
                return existing;
            }

            // Compute the same spawn coordinates used by setupHeroes()
            let W = userconfig.ARCADE_SCREEN_WIDTH;
            let H = userconfig.ARCADE_SCREEN_HEIGHT;

            if (_engineWorldTileMap && _engineWorldTileMap.length > 0 && _engineWorldTileMap[0].length > 0) {
                const rows = _engineWorldTileMap.length;
                const cols = _engineWorldTileMap[0].length;
                W = cols * WORLD_TILE_SIZE;
                H = rows * WORLD_TILE_SIZE;
            }

            const centerW = W / 2;
            const centerH = H / 2;
            const offset = 40;

            const coords: number[][] = [
                [centerW + offset, centerH + offset],
                [centerW - offset, centerH + offset],
                [centerW + offset, centerH - offset],
                [centerW - offset, centerH - offset]
            ];

            const slotIndex = pid - 1;
            console.log(">>> [HeroEngineInPhaser] ensureHeroForPlayer spawning pid =", pid);
            createHeroForPlayer(pid, coords[slotIndex][0], coords[slotIndex][1]);

            const after = playerToHeroIndex[pid] | 0;
            return (after >= 0 && after < heroes.length && heroes[after]) ? after : -1;
        };

        console.log(">>> [HeroEngineInPhaser] exposed __HeroEnginePhaserInternals (tile map + size + ensureHeroForPlayer)");
    } catch {
        // If globalThis isn't available (e.g., PXT runtime), just silently skip.
    }
})();
