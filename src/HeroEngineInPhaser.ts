
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

    // Stabilize custom kinds for the compat layer
    SK.Hero = 50;
    SK.HeroWeapon = 51;
    SK.HeroAura = 52;
    SK.EnemySpawner = 53;
    SK.SupportBeam = 54;
    SK.SupportIcon = 55;
    SK.Wall = 56;
})();
// =====================================================================
// END PHASER-ONLY SHIM
// =====================================================================



















// --------------------------------------------------------------
// Sprite kinds - type declarations for TS (no top-level create()) DON'T COPY THIS OVER TO PHASER! It is already there
// --------------------------------------------------------------
namespace SpriteKind {
    export let Hero: number
    export let HeroWeapon: number
    export let HeroAura: number
    export let EnemySpawner: number
    export let SupportBeam: number
    export let SupportIcon: number
    export let Wall: number
}




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
//   updateHeroAuras() – Update aura sprites (position, visibility, style) for all heroes.
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

        ensureHeroSpriteKinds();

        initWorldTileMap()

        scene.setBackgroundColor(1);
        tiles.setCurrentTilemap(tilemap`level1`)
        setupHeroes();
        setupTestEnemies();
        setupEnemySpawners();
        startEnemyWaves();

    }
}










declare const globalThis: any;





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
// Debug flags
// Used by: agility / integrator debug logging & probes
// --------------------------------------------------------------
const DEBUG_AGILITY = true
const DBG_INTERVAL_MS = 50
const DEBUG_INTEGRATOR = true
const DBG_INT_INTERVAL_MS = 50

const DEBUG_HERO_LOGIC = true

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



function ensureHeroSpriteKinds() {
    if (_heroKindsInitialized) return
    _heroKindsInitialized = true

    // Pure Arcade-safe version; only touches custom kinds.
    // (In Arcade, SpriteKind.Player / Enemy are defined by runtime.)
    if (!SpriteKind.Hero) SpriteKind.Hero = SpriteKind.create()
    if (!SpriteKind.HeroWeapon) SpriteKind.HeroWeapon = SpriteKind.create()
    if (!SpriteKind.HeroAura) SpriteKind.HeroAura = SpriteKind.create()
    if (!SpriteKind.EnemySpawner) SpriteKind.EnemySpawner = SpriteKind.create()
    if (!SpriteKind.SupportBeam) SpriteKind.SupportBeam = SpriteKind.create()
    if (!SpriteKind.SupportIcon) SpriteKind.SupportIcon = SpriteKind.create()
    if (!SpriteKind.Wall) SpriteKind.Wall = SpriteKind.create()
}



// Phaser/ESM shim: ensure custom SpriteKinds exist before any overlaps are registered.
ensureHeroSpriteKinds();




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

// --------------------------------------------------------------
// HERO_DATA – sprite data schema for hero sprites
// Ownership:
//   • Written by: setupHeroes(), initHeroHP(), initHeroMana(),
//                 executeXMove(), combo / dash / iframe logic
//   • Read by:    applyDamageToHeroIndex(), control-lock logic,
//                 combo handling, AGI/STR/INT modules, auras
// --------------------------------------------------------------

const HERO_DATA = {
    HP: "hp", MAX_HP: "maxHp", MANA: "mana", MAX_MANA: "maxMana",
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
    STR_INNER_RADIUS: "strInnerR",     // STR smash inner radius (per-hero cache)
    OWNER: "owner",                    // which player "owns" this hero

    // NEW: engine-side state we want exposed
    BUSY_UNTIL: "busyUntil",           // heroBusyUntil[heroIndex]
    MOVE_SPEED_MULT: "mvMult",         // heroMoveSpeedMult[heroIndex]
    DAMAGE_AMP_MULT: "dmgMult",        // heroDamageAmpMult[heroIndex]
    BUFF_JSON: "buffsJson",             // JSON snapshot of heroBuffs[heroIndex]

    // NEW: for tile-collision rollback
    PREV_X: "prevX",
    PREV_Y: "prevY",

    // NEW: hero death state (for LPC death animation timing)
    IS_DEAD: "isDead",
    DEATH_UNTIL: "deathUntil",

    // NEW: animation-facing mirror fields (for Phaser heroAnimGlue)
    DIR: "dir",
    PHASE: "phase"
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


const ENEMY_MELEE_RANGE_PX = 16 // or 20 or whatever feels right. THIS SHOULD BE CONVERTED TO AN ENEMY_DATA KEY CHATGPT. THIS IS LAZY AND IF YOU SCAN THIS REMIND ME THIS NEEDS TO BE DONE

// How long to keep a dying hero around so LPC "death" anim can play (ms)
const HERO_DEATH_ANIM_MS = 600;


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



// --------------------------------------------------------------
// GLOBAL ARRAYS – core engine collections
// These are what the main update loops iterate over.
// --------------------------------------------------------------
let heroes: Sprite[] = []
let enemies: Sprite[] = []
let heroProjectiles: Sprite[] = []




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
let enemyHPBars: StatusBarSprite[] = []
let heroComboMeters: Sprite[] = []

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






// ================================================================
// ================================================================
// ================================================================
// SECTION 2 - HELPER FUNCTIONS
// ================================================================
// Utility helpers used across the engine. Stateless. No side effects.
// ================================================================
// ================================================================
// ================================================================
// ================================================================



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

function getAimVectorForHero(heroIndex: number) {
    let dx = heroFacingX[heroIndex] || 0, dy = heroFacingY[heroIndex] || 0
    if (dx == 0 && dy == 0) { dx = 1; dy = 0 }
    return [dx, dy]
}

function r2(v: number) { return Math.round(v * 100) / 100 }
function r3(v: number) { return Math.round(v * 1000) / 1000 }




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
    const tile = WORLD_TILE_SIZE
    const wallImg = _createWallTileImage()

    for (let r = 0; r < map.length; r++) {
        const row = map[r]
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== TILE_WALL) continue

            const s = sprites.create(wallImg, SpriteKind.Wall)
            s.left = c * tile
            s.top = r * tile

            // Phaser host: keep them for collisions, but NEVER draw over the tiles
            s.z = -2000
            s.setFlag(SpriteFlag.Invisible, true)
        }
    }
}





// This is called ONLY by HeroEngine.start()
function initWorldTileMap(): void {
    _engineWorldTileMap = _createTileMap2D()
    _buildTilesIntoSprites(_engineWorldTileMap)
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
                    if (c < 0 || c >= cols) continue
                    if (rowArr[c] !== TILE_WALL) continue

                    const tileLeft = c * tileSize
                    const tileRight = tileLeft + tileSize
                    const tileTop = r * tileSize
                    const tileBottom = tileTop + tileSize

                    // Compute overlaps on each side
                    const overlapLeft = right - tileLeft
                    const overlapRight = tileRight - left
                    const overlapTop = bottom - tileTop
                    const overlapBottom = tileBottom - top

                    // If any are <= 0, AABBs don't overlap on that axis
                    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) {
                        continue
                    }

                    // Minimal penetration on each axis
                    const penX = overlapLeft < overlapRight ? overlapLeft : overlapRight
                    const penY = overlapTop < overlapBottom ? overlapTop : overlapBottom

                    if (penX < penY) {
                        // Push in X
                        const tileCenterX = tileLeft + tileSize / 2
                        if (s.x < tileCenterX) {
                            s.x -= penX
                        } else {
                            s.x += penX
                        }
                        // Soft slide: kill only X velocity
                        s.vx = 0
                    } else {
                        // Push in Y
                        const tileCenterY = tileTop + tileSize / 2
                        if (s.y < tileCenterY) {
                            s.y -= penY
                        } else {
                            s.y += penY
                        }
                        // Soft slide: kill only Y velocity
                        s.vy = 0
                    }

                    moved = true
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




function doHeroMoveForPlayer(playerId: number, button: string) {
    const heroIndex = playerToHeroIndex[playerId]
    if (heroIndex < 0 || heroIndex >= heroes.length) return
    const hero = heroes[heroIndex]
    if (!hero) return
    const now = game.runtime()

    if (DEBUG_HERO_LOGIC) {
        console.log("[doHeroMoveForPlayer] ENTER playerId=" + playerId + "button=" + button + "heroIndex=" + heroIndex)
    }

    // Trap world time so the wrapper/save system can see it
    worldRuntimeMs = now

    // Respect busy window
    const busyUntil = heroBusyUntil[heroIndex] || 0
    if (busyUntil > 0 && now < busyUntil) return

    // If already steering an intellect spell, ignore new move inputs
    if (sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) return

    // If in the middle of a support puzzle, ignore new move inputs
    if (supportPuzzleActive[heroIndex]) return






    // -----------------------------
    // Student logic (OUT array)
    // Shape: [family, t1, t2, t3, t4, element, animId]
    // -----------------------------
    const hook = HeroEngine.runHeroLogicForHeroHook || runHeroLogicForHero;

    if (DEBUG_HERO_LOGIC) {
        console.log(
            "[doHeroMoveForPlayer] BEFORE HOOK heroIndex=" + heroIndex +
            " button=" + button +
            " hookType=" + (typeof hook)
        );
    }

    //let out: number[];
    let out: any[]; //So we can get strings for the names from students
    try {
        out = hook(heroIndex, button);
    } catch (e) {
        console.log(
            "[doHeroMoveForPlayer] ERROR calling hook heroIndex=" + heroIndex +
            " button=" + button +
            " error=" + e
        );
        return;
    }

    if (DEBUG_HERO_LOGIC) {
        console.log(
            "[doHeroMoveForPlayer] AFTER HOOK heroIndex=" + heroIndex +
            " button=" + button +
            " out=" + (out ? "[" + out.join(",") + "]" : "null")
        );
    }

    // Guard against bad / missing logic output
    // We expect at least 7 entries: 0..6
    if (!out || out.length < 7) {
        console.log(
            "[MOVE] heroIndex=" + heroIndex +
            " button=" + button +
            " INVALID OUT=" + (out ? "[" + out.join(",") + "]" : "null")
        );
        return;
    }


    const family = coerceFamily(out[0])      // FAMILY
    const t1 = out[1] | 0                    // TRAIT1
    const t2 = out[2] | 0                    // TRAIT2
    const t3 = out[3] | 0                    // TRAIT3
    const t4 = out[4] | 0                    // TRAIT4
    const element = coerceElement(out[5])    // ELEMENT



    // Positional unpack (avoid OUT.* at runtime in Arcade)
    //    const family = out[0] | 0;  // FAMILY
    //    const t1 = out[1] | 0;      // TRAIT1
    //    const t2 = out[2] | 0;      // TRAIT2
    //    const t3 = out[3] | 0;      // TRAIT3
    //    const t4 = out[4] | 0;      // TRAIT4
    //    const element = out[5] | 0; // ELEMENT
    //    const animId = out[6] | 0;  // ANIM_ID






    // traits[1..4] are the same pools as before; traits[5] holds element for future use
    const traits = [0, t1, t2, t3, t4, element]

    // Persist family + traits on hero (modules read these)
    sprites.setDataNumber(hero, HERO_DATA.FAMILY, family)

    // NEW: mirror current move family as string for heroAnimGlue
    sprites.setDataString(hero, "heroFamily", heroFamilyNumberToString(family));

    sprites.setDataString(hero, HERO_DATA.BUTTON, button)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT1, t1)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT2, t2)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT3, t3)
    sprites.setDataNumber(hero, HERO_DATA.TRAIT4, t4)

    //const animKey = animIdToKey(animId)
    // Animation ID: allow either a free-form string from Blocks or a numeric ID
    let animKey: string
    const rawAnim = out[6]
    if (typeof rawAnim === "string") {
        // Students can return any animation key they like, e.g. "idle", "FireSlash", "MyWeirdAnim"
        animKey = rawAnim
    } else {
        const animId = (rawAnim | 0)
        animKey = animIdToKey(animId)
    }



    // Trait-driven move stats (per family)
    const stats = calculateMoveStatsForFamily(family, button, traits)







    // -----------------------------
    // -----------------------------
    // Mana cost & check
    // -----------------------------
    // Simple sum of the four trait values
    let manaCost = t1 + t2 + t3 + t4
    if (manaCost < 0) manaCost = 0

    let mana = sprites.readDataNumber(hero, HERO_DATA.MANA)
    if (mana < manaCost) {
        flashHeroManaBar(heroIndex)
        return
    }
    mana -= manaCost
    sprites.setDataNumber(hero, HERO_DATA.MANA, mana)
    updateHeroManaBar(heroIndex)

    // Floating negative blue mana number
    if (manaCost > 0) {
        showDamageNumber(hero.x, hero.y - 10, -manaCost, "mana")
    }


    // -----------------------------
    // Aim / movement setup
    // Shared for STR/AGI; INT/HEAL get zero lunge
    // -----------------------------
    const aim = getAimVectorForHero(heroIndex)
    let ax = aim[0], ay = aim[1]
    if (ax == 0 && ay == 0) { ax = 1; ay = 0 }
    const mag = Math.sqrt(ax * ax + ay * ay) || 1
    ax /= mag; ay /= mag

    // Apply haste multiplier to lunge speed
    const hasteMult = heroMoveSpeedMult[heroIndex] || 1
    const baseLunge = stats[STAT.LUNGE_SPEED] | 0
    const rawLunge = baseLunge * hasteMult
    const lungeCapped = Math.max(0, Math.min(rawLunge, 500))

    if (family == FAMILY.STRENGTH || family == FAMILY.AGILITY) {
        hero.vx = ax * lungeCapped
        hero.vy = ay * lungeCapped
    } else {
        hero.vx = 0
        hero.vy = 0
    }

    const moveDuration = stats[STAT.MOVE_DURATION] | 0
    const L_exec = Math.idiv(lungeCapped * moveDuration, 1000)
    sprites.setDataNumber(hero, "AGI_L_EXEC", L_exec)


    // NEW: phase hint for animations based on family
    if (family == FAMILY.STRENGTH) {
        setHeroPhaseString(heroIndex, "slash")
    } else if (family == FAMILY.AGILITY) {
        setHeroPhaseString(heroIndex, "thrust")
    } else if (family == FAMILY.INTELLECT) {
        setHeroPhaseString(heroIndex, "cast")
    } else if (family == FAMILY.HEAL) {
        setHeroPhaseString(heroIndex, "cast")
    }


    // -----------------------------
    // Control lock & agility extras
    // (unchanged pattern from OLD version)
    // -----------------------------




    // --- Control lock & agility extras ---

    // STR / AGI / INT use timed lock via heroBusyUntil

    if (family == FAMILY.STRENGTH || family == FAMILY.AGILITY || family == FAMILY.INTELLECT) {
        lockHeroControls(heroIndex)

        const unlockAt = now + moveDuration
        heroBusyUntil[heroIndex] = unlockAt

        //heroBusyUntil[heroIndex] = now + moveDuration

        // NEW: mirror onto hero sprite for save/sync
        sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, unlockAt)

        // NEW: mirror control-lock timestamp onto the hero sprite
        //sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, heroBusyUntil[heroIndex])


    } else if (family == FAMILY.HEAL) {
        // SUPPORT/HEAL: no timed lock here.
        // beginSupportPuzzleForHero() will call lockHeroControls()
        // and the puzzle end will call unlockHeroControls().
        hero.vx = 0
        hero.vy = 0
    }

    // Agility-specific landing + combo windows
    if (family == FAMILY.AGILITY) {
        const landBufferMs = stats[STAT.AGILITY_LAND_BUFFER_MS] || AGI_LANDING_BUFFER_MS
        sprites.setDataNumber(
            hero,
            HERO_DATA.AGI_DASH_UNTIL,
            now + moveDuration + landBufferMs
        )
        const comboWindow = stats[STAT.COMBO_WINDOW] | 0
        sprites.setDataNumber(
            hero,
            HERO_DATA.AGI_COMBO_UNTIL,
            comboWindow > 0 ? now + moveDuration + comboWindow : 0
        )
    } else {
        sprites.setDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL, 0)
        sprites.setDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL, 0)
    }










    // -----------------------------
    // Fire animation (students own the sprite art)
    // -----------------------------
    callHeroAnim(heroIndex, animKey, moveDuration)


    if (DEBUG_INTEGRATOR) {
        console.log(
            "[MOVE] hero=" + heroIndex
            + " family=" + family
            + " button=" + button
            + " vx=" + (hero.vx | 0)
            + " vy=" + (hero.vy | 0)
            + " moveDuration=" + moveDuration
            + " busyUntil=" + (heroBusyUntil[heroIndex] | 0)
        )
    }





    // -----------------------------
    // Hand off to family-specific executors
    // -----------------------------
    if (family == FAMILY.STRENGTH) {
        executeStrengthMove(heroIndex, hero, button, traits, stats)
        return
    }

    if (family == FAMILY.AGILITY) {
        executeAgilityMove(heroIndex, hero, button, traits, stats)
        return
    }

    if (family == FAMILY.INTELLECT) {
        executeIntellectMove(heroIndex, hero, button, traits, stats, now)
        return
    }

    if (family == FAMILY.HEAL) {
        executeHealMove(heroIndex, hero, button, traits, stats, now)
        return
    }

    // Any future family types would fall through here.
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



function createHeroForPlayer(playerId: number, startX: number, startY: number) {
    // Start with a 64x64 placeholder so HP/mana bars + collisions match LPC hero art size.
    // In Phaser, the native LPC sprite uses the same footprint; we skip pixel uploads.
    // In pure Arcade, students will just see big, chunky heroes.
    const hero = sprites.create(image.create(64, 64), SpriteKind.Player)

    hero.x = startX; hero.y = startY; hero.z = 20

    // NEW: seed previous position for collisions
    sprites.setDataNumber(hero, HERO_DATA.PREV_X, hero.x)
    sprites.setDataNumber(hero, HERO_DATA.PREV_Y, hero.y)

    const heroIndex = heroes.length; heroes.push(hero)
    playerToHeroIndex[playerId] = heroIndex

    sprites.setDataNumber(hero, HERO_DATA.OWNER, playerId)
    heroFacingX[heroIndex] = 1; heroFacingY[heroIndex] = 0
    heroBusyUntil[heroIndex] = 0

    // NEW: seed initial facing + phase for animations
    syncHeroDirData(heroIndex)
    setHeroPhaseString(heroIndex, "idle")

    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, false)
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
    sprites.setDataNumber(hero, HERO_DATA.FAMILY, FAMILY.STRENGTH)
    
    // NEW: seed hero identity strings so Phaser can resolve LPC animations
    const profileName = getHeroProfileForHeroIndex(heroIndex);
    sprites.setDataString(hero, "heroName", profileName);
    sprites.setDataString(
        hero,
        "heroFamily",
        heroFamilyNumberToString(FAMILY.STRENGTH)
    );

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



    heroTargetCircles[heroIndex] = null

    initHeroHP(heroIndex, hero, 1000)
    initHeroMana(heroIndex, hero, 2000)
    refreshHeroController(heroIndex)

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

// Mirror phase into hero data so Phaser can see it.
function setHeroPhaseString(heroIndex: number, phase: string) {
    const hero = heroes[heroIndex]; if (!hero) return
    sprites.setDataString(hero, "phase", phase)
    sprites.setDataString(hero, HERO_DATA.PHASE, phase)
}

function updateHeroFacingsFromVelocity() {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue
        const vx = hero.vx, vy = hero.vy
        if (vx == 0 && vy == 0) continue
        let dx = 0, dy = 0
        if (vx > 0) dx = 1; else if (vx < 0) dx = -1
        if (vy > 0) dy = 1; else if (vy < 0) dy = -1
        if (dx != 0 || dy != 0) {
            heroFacingX[i] = dx; heroFacingY[i] = dy
            // NEW: keep dir string mirrored for heroAnimGlue
            syncHeroDirData(i)
        }
    }
}

function callHeroAnim(heroIndex: number, animKey: string, timeMs: number) {
    const hero = heroes[heroIndex]; if (!hero) return
    const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY)
    if (family == FAMILY.STRENGTH || family == FAMILY.INTELLECT || family == FAMILY.HEAL) hero.startEffect(effects.trail, timeMs)
    const direction = getHeroDirectionName(heroIndex)
    const playerId = sprites.readDataNumber(hero, HERO_DATA.OWNER)

    if (playerId == 1) HeroEngine.animateHero1Hook(hero, animKey, timeMs, direction)
    else if (playerId == 2) HeroEngine.animateHero2Hook(hero, animKey, timeMs, direction)
    else if (playerId == 3) HeroEngine.animateHero3Hook(hero, animKey, timeMs, direction)
    else if (playerId == 4) HeroEngine.animateHero4Hook(hero, animKey, timeMs, direction)

}



// ================================================================
// SECTION 5 - HERO STATS AND UI
// ================================================================
// HP, Mana, Combo, Aura visuals. 
// Owns bar creation + update per frame.

function initHeroHP(heroIndex: number, hero: Sprite, maxHPVal: number) {
    sprites.setDataNumber(hero, HERO_DATA.MAX_HP, maxHPVal)
    sprites.setDataNumber(hero, HERO_DATA.HP, maxHPVal)
    const bar = statusbars.create(20, 3, StatusBarKind.Health)
    bar.attachToSprite(hero); bar.setOffsetPadding(0, 2)
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
    const bar = statusbars.create(20, 2, StatusBarKind.Energy)
    bar.attachToSprite(hero); bar.setOffsetPadding(0, 1)
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

    const now = game.runtime() | 0;

    // Mark hero as dead and set a "death animation" window
    sprites.setDataBoolean(hero, HERO_DATA.IS_DEAD, true);
    const deathUntil = now + HERO_DEATH_ANIM_MS;
    sprites.setDataNumber(hero, HERO_DATA.DEATH_UNTIL, deathUntil);

    // Lock controls and stop movement while dying
    hero.vx = 0;
    hero.vy = 0;

    heroBusyUntil[heroIndex] = deathUntil;
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, deathUntil);
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, true);

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



function updateHeroAuras() {
    const now = game.runtime()
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        let showAura = false
        let color = 0
        const family = sprites.readDataNumber(hero, HERO_DATA.FAMILY)

        if (family == FAMILY.STRENGTH && (heroBusyUntil[i] || 0) > now) { showAura = true; color = AURA_COLOR_STRENGTH }
        if (family == FAMILY.AGILITY) {
            const dashUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_DASH_UNTIL)
            const comboUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL)
            if (dashUntil > now || comboUntil > now) { showAura = true; color = AURA_COLOR_AGILITY }
        }
        if (family == FAMILY.INTELLECT && sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) { showAura = true; color = AURA_COLOR_INTELLECT }
        if (family == FAMILY.HEAL && sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) { showAura = true; color = AURA_COLOR_HEAL }

        // Aura sprite
        const aura = heroAuras[i]
        if (!showAura) { if (aura) aura.setFlag(SpriteFlag.Invisible, true) }
        else {
            const active = ensureHeroAuraSprite(i); if (active) {
                active.setImage(createAuraImageFromHero(hero, color))
                active.setFlag(SpriteFlag.Invisible, false)
                active.x = hero.x; active.y = hero.y; active.z = hero.z + 1
            }
        }

        // Agility combo meter (thin 1px bar below the mana bar)
        const comboUntil = sprites.readDataNumber(hero, HERO_DATA.AGI_COMBO_UNTIL) | 0
        const meter = heroComboMeters[i]
        if (comboUntil > now) {
            const m = ensureComboMeter(i); if (m) {
                const total = 300 // matches STAT.COMBO_WINDOW baseline
                const remain = Math.max(0, Math.min(total, comboUntil - now))
                const frac = remain / total
                const w = 20, h = 1
                const fill = Math.max(1, Math.floor(w * frac))
                const img = image.create(w, h)
                for (let x = 0; x < w; x++) img.setPixel(x, 0, x < fill ? 5 : 0) // 5 = yellow
                m.setImage(img)
                m.setFlag(SpriteFlag.Invisible, false)
                // place just below mana bar (which is 2px high with small padding)
                m.x = hero.x
                m.y = hero.y + (hero.height >> 1) + 5
            }
        } else {
            if (meter) meter.setFlag(SpriteFlag.Invisible, true)
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

function calculateStrengthStats(baseTimeMs: number, traits: number[]) {
    const stats = makeBaseStats(baseTimeMs)

    // Pull raw trait values, floor at 0, NO upper cap
    let tWind = (traits[1] | 0) // windup & damage
    let tReach = (traits[2] | 0) // reach distance
    let tArc = (traits[3] | 0)   // total arc degrees
    let tKnock = (traits[4] | 0) // knockback amount

    if (tWind < 0) tWind = 0
    if (tReach < 0) tReach = 0
    if (tArc < 0) tArc = 0
    if (tKnock < 0) tKnock = 0

    // ----------------------------------------------------
    // DAMAGE (traits[1])
    // ----------------------------------------------------
    // Damage starts at 80%, then +2% per point of tWind
    stats[STAT.DAMAGE_MULT] = 80 + tWind * 2

    // ----------------------------------------------------
    // TIMING: windup (pre-cast) + swing (actual arc)
    // ----------------------------------------------------
    // We treat baseTimeMs as the *total* lock at tWind=0, then:
    //   moveDuration = windupBase + tWind*10 + SWING_MS
    //   windupMs    = moveDuration - SWING_MS
    const BASE_SWING_MS = 220

    let windupBase = baseTimeMs - BASE_SWING_MS
    if (windupBase < 80) windupBase = 80 // always some visible windup

    const windupMs = windupBase + tWind * 10
    const totalMoveMs = windupMs + BASE_SWING_MS

    // Constant swing, trait-driven windup
    stats[STAT.STRENGTH_SWING_MS] = BASE_SWING_MS
    stats[STAT.MOVE_DURATION] = totalMoveMs

    // ----------------------------------------------------
    // LUNGE: Strength = tiny crawl forward during lock
    // ----------------------------------------------------
    // This feeds the generic lunge block:
    //   hero.vx = aimX * LUNGE_SPEED; hero.vy = aimY * LUNGE_SPEED
    // We ignore tReach here; reach is handled in the hitbox shape.
    const STRENGTH_CRAWL_SPEED = 5 // px/s-ish velocity; feels like a slow lean
    stats[STAT.LUNGE_SPEED] = STRENGTH_CRAWL_SPEED

    // ----------------------------------------------------
    // ARC (traits[3]) → total swing arc degrees
    // ----------------------------------------------------
    let arcDeg = 1 + tArc
    if (arcDeg > 360) arcDeg = 360
    stats[STAT.STRENGTH_TOTAL_ARC_DEG] = arcDeg

    // ----------------------------------------------------
    // KNOCKBACK (traits[4]) → knockback percentage
    // ----------------------------------------------------
    stats[STAT.KNOCKBACK_PCT] = 10 + tKnock * 10

    return stats
}




function executeStrengthMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[]
) {
    // Base damage from family + trait-driven multiplier
    const baseDamage = getBasePower(FAMILY.STRENGTH)
    const damageMult = stats[STAT.DAMAGE_MULT] | 0
    let dmg = Math.idiv(baseDamage * (damageMult || 100), 100)
    if (dmg < 1) dmg = 1

    // Debuff / knockback knobs – all trait-driven via stats
    const slowPct = stats[STAT.SLOW_PCT] | 0
    const slowDurationMs = stats[STAT.SLOW_DURATION] | 0
    const weakenPct = stats[STAT.WEAKEN_PCT] | 0
    const weakenDurationMs = stats[STAT.WEAKEN_DURATION] | 0
    const knockbackPct = stats[STAT.KNOCKBACK_PCT] | 0

    // Strength-specific animation knobs (centralized in calculateStrengthStats)
    const swingDurationMsStat = stats[STAT.STRENGTH_SWING_MS] || 220
    let moveDuration = stats[STAT.MOVE_DURATION] | 0
    if (moveDuration <= swingDurationMsStat) moveDuration = swingDurationMsStat

    // Windup is the pre-cast delay; swing is the actual arc duration
    const windupMs = moveDuration - swingDurationMsStat
    const totalArcDeg = stats[STAT.STRENGTH_TOTAL_ARC_DEG] || 150
    const isHeal = false // Strength move never heals

    const startMs = game.runtime()
    let fired = false

    // Delay the *actual* smash until after windupMs
    game.onUpdate(function () {
        if (fired) return

        const now = game.runtime()
        if (now - startMs < windupMs) return

        const h = heroes[heroIndex]
        if (!h || (h.flags & sprites.Flag.Destroyed)) {
            fired = true
            return
        }

        fired = true

        spawnStrengthSwingProjectile(
            heroIndex, h,
            dmg, isHeal, button,
            slowPct, slowDurationMs,
            weakenPct, weakenDurationMs,
            knockbackPct,
            swingDurationMsStat,
            totalArcDeg
        )
    })
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

    // Circumradius: smallest circle that contains the full sprite
    const heroRadius = Math.sqrt(cx * cx + cy * cy)

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

    console.log("S-EDGE: img " + w + "x" + h + " cx=" + cx + " cy=" + cy +
        " dir=(" + nx + "," + ny + ")")

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
                console.log("S-EDGE: out of bounds after opaque at d=" + d +
                    " lastOpaque=" + lastOpaqueDist)
            } else {
                console.log("S-EDGE: out of bounds before any opaque at d=" + d)
            }
            break
        }

        const p = img.getPixel(px, py)

        if (p != 0) {
            // Solid pixel – keep extending the edge
            if (!sawOpaque) {
                console.log("S-EDGE: first opaque at d=" + d +
                    " px=" + px + " py=" + py + " color=" + p)
            }
            lastOpaqueDist = d
            sawOpaque = true
        } else if (sawOpaque) {
            // First transparent after at least one solid pixel -> stop
            console.log("S-EDGE: first transparent after opaque at d=" + d +
                " lastOpaque=" + lastOpaqueDist)
            break
        }
    }

    console.log("S-EDGE: result sawOpaque=" + sawOpaque +
        " lastOpaqueDist=" + lastOpaqueDist)

    if (!sawOpaque) return 0
    return lastOpaqueDist
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

    // Inner radius: circle that fully contains hero sprite + aura + spacing
    const inner0 = getStrengthInnerRadiusForHero(hero)

    // ----------------------------------------------------
    // REACH: baseline just outside aura + trait-driven extra
    // ----------------------------------------------------
    let tReach = sprites.readDataNumber(hero, HERO_DATA.TRAIT2) | 0
    if (tReach < 0) tReach = 0

    const baseExtraReach = 4      // tiny bit beyond aura even at 0 reach
    const extraPerPoint = 1       // 1px per trait point; tweak to taste
    const reachFromInner = baseExtraReach + tReach * extraPerPoint

    // Create initial image at progress = 0 (tiny nub / initial thrust)
    const img0 = buildStrengthSmashBitmap(nx, ny, inner0, reachFromInner, totalArcDeg, 0)

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

    console.log("S-UPDATE: heroIndex=" + heroIndex +
        " age=" + age + "/" + swingMs +
        " t=" + t +
        " dir=(" + nx + "," + ny + ")" +
        " attachPx=" + attachPx +
        " reach=" + reachFromFront +
        " heroPos=(" + hero.x + "," + hero.y + ")" +
        " heroVel=(" + hero.vx + "," + hero.vy + ")" +
        " projPos=(" + proj.x + "," + proj.y + ")" +
        " projVel=(" + proj.vx + "," + proj.vy + ")")

    const totalArcDeg = sprites.readDataNumber(proj, "SS_ARC_DEG") || 150
    proj.setImage(buildStrengthSmashBitmap(nx, ny, attachPx, reachFromFront, totalArcDeg, t))
    proj.setPosition(hero.x, hero.y)  // center-anchored
    return true
}

function buildStrengthSmashBitmap(
    nx: number, ny: number,
    inner0: number, reachExtra: number,
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
        for (let r = inner0; r <= tipR; r++) {
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

function calculateAgilityStats(
    baseTimeMs: number,
    traits: number[]
) {
    const stats = makeBaseStats(baseTimeMs)

    // Pull raw trait values, floor at 0 (no upper caps)
    let tCombo = (traits[1] | 0)  // combo window
    let tDash = (traits[2] | 0)  // dash speed
    let tIFrame = (traits[3] | 0)  // invulnerability window
    let tSlow = (traits[4] | 0)  // slow / cripple

    if (tCombo < 0) tCombo = 0
    if (tDash < 0) tDash = 0
    if (tIFrame < 0) tIFrame = 0
    if (tSlow < 0) tSlow = 0

    // ----------------------------------------------------
    // COMBO WINDOW (traits[1]) + a bit of damage flavor
    // ----------------------------------------------------
    // Base combo window 200ms, +5ms per point of tCombo
    stats[STAT.COMBO_WINDOW] = 200 + tCombo * 5

    // Damage: 60% base, +1% per point of tCombo (can go absurd)
    stats[STAT.DAMAGE_MULT] = 60 + tCombo

    // ----------------------------------------------------
    // DASH SPEED (traits[2]) → lunge speed ONLY
    // ----------------------------------------------------
    // Lunge speed: base 250, +5 per point of tDash
    // (global lunge clamp to 500 still happens in the dash code)
    stats[STAT.LUNGE_SPEED] = 250 + tDash * 5

    // ----------------------------------------------------
    // MOVE DURATION – no longer tied to dash speed
    // ----------------------------------------------------
    // Start from baseTimeMs and let combo make the window a bit longer
    let moveDur = baseTimeMs + tCombo * 2
    if (moveDur < 50) moveDur = 50  // safety: never 0/negative
    stats[STAT.MOVE_DURATION] = moveDur

    // ----------------------------------------------------
    // INVULNERABILITY (traits[3]) → landing buffer / i-frames
    // ----------------------------------------------------
    // Base AGI_LANDING_BUFFER_MS + 2ms per point of tIFrame
    stats[STAT.AGILITY_LAND_BUFFER_MS] = AGI_LANDING_BUFFER_MS + tIFrame * 2

    // ----------------------------------------------------
    // SLOW / CRIPPLE (traits[4])
    // ----------------------------------------------------
    // Slow percent: 10% base, +2% per point of tSlow
    stats[STAT.SLOW_PCT] = 10 + tSlow * 2

    // Slow duration: 200ms base, +20ms per point of tSlow
    stats[STAT.SLOW_DURATION] = 200 + tSlow * 20

    return stats
}





function executeAgilityMove(
    heroIndex: number,
    hero: Sprite,
    button: string,
    traits: number[],
    stats: number[]
) {
    // Base damage from family + trait-driven multiplier
    const baseDamage = getBasePower(FAMILY.AGILITY)
    const damageMult = stats[STAT.DAMAGE_MULT] | 0
    let dmg = Math.idiv(baseDamage * (damageMult || 100), 100)
    if (dmg < 1) dmg = 1

    // Cripple / slow / debuff knobs – from agility stats
    const slowPct = stats[STAT.SLOW_PCT] | 0
    const slowDurationMs = stats[STAT.SLOW_DURATION] | 0
    const weakenPct = stats[STAT.WEAKEN_PCT] | 0
    const weakenDurationMs = stats[STAT.WEAKEN_DURATION] | 0
    const knockbackPct = stats[STAT.KNOCKBACK_PCT] | 0

    const isHeal = false // Agility is pure offense right now

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

    // Create projectile; updater will replace image + position each frame
    const proj = sprites.create(image.create(2, 2), SpriteKind.HeroWeapon)
    proj.z = hero.z + 1
    proj.vx = 0
    proj.vy = 0
    proj.x = hero.x
    proj.y = hero.y
    // Start with a degenerate segment; real geometry is handled in the updater
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

    // Runtime fields for updater
    sprites.setDataNumber(proj, PROJ_DATA.LAST_T, nowMs)
    sprites.setDataNumber(proj, PROJ_DATA.ARROW_LEN, 0)
    sprites.setDataNumber(proj, PROJ_DATA.REACH_T, 0)
    sprites.setDataNumber(proj, PROJ_DATA.HIT_MASK, 0)

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
            `[AGI ${seq}] SPAWN hero=${heroIndex} L_exec=${L} dir=(${r3(nx)},${r3(ny)}) @(${hero.x | 0},${hero.y | 0})`
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

    // Anchor point = hero center at cast time (world-space)
    const anchorX = sprites.readDataNumber(proj, PROJ_DATA.START_HERO_X)
    const anchorY = sprites.readDataNumber(proj, PROJ_DATA.START_HERO_Y)

    // Distance from hero center to the FRONT EDGE in the dash direction:
    // use width for horizontal, height for vertical (and blend for diagonals)
    const attachPx =
        0.5 * (Math.abs(nx) * hero.width + Math.abs(ny) * hero.height)

    // Your segment drawer renders a 1px nose at (sf + 2). Stop the "head base" at L - 2,
    // so the visual nose lands at L.
    const sBackAtCast = attachPx
    let sFrontStop = L - 2
    if (sFrontStop <= sBackAtCast) {
        sFrontStop = sBackAtCast + 4 // safety so we always have a positive length
        L = sFrontStop + 2
        sprites.setDataNumber(proj, PROJ_DATA.MAX_REACH, L)
    }
    const maxLen = Math.max(0, sFrontStop - sBackAtCast)

    // Runtime state: previous sample time, current arrow length, and the time we first reached full length
    const PREV_S_KEY = "prevS"
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

    function cornerX(f: number, wside: number) {
        return nx * f + sx * wside
    }
    function cornerY(f: number, wside: number) {
        return ny * f + sy * wside
    }

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

    let minXW = xs[0]
    let maxXW = xs[0]
    let minYW = ys[0]
    let maxYW = ys[0]
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

// NEW: small draining meter above hero for agility combo
function ensureComboMeter(heroIndex: number): Sprite {
    let m = heroComboMeters[heroIndex]
    const hero = heroes[heroIndex]; if (!hero) return null
    if (!m) {
        m = sprites.create(image.create(22, 2), SpriteKind.HeroAura)
        m.z = hero.z + 2
        heroComboMeters[heroIndex] = m
    }
    return m
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
    let targetingTime = 500 + tTarget * 50
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
    // Targeting window from trait-driven stats (clamped with hard floor)
    const targetingTime = (stats[STAT.TARGETING_TIME] | 0) || 5000 // hard floor now set in calculateIntellectStats

    // Stamp hero control metadata
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, true)
    sprites.setDataNumber(hero, HERO_DATA.TARGET_START_MS, now)
    sprites.setDataNumber(hero, HERO_DATA.TARGET_LOCK_MS, targetingTime)

    // NEW: phase = cast while steering intellect spell
    setHeroPhaseString(heroIndex, "cast")


    // Delegate all spell creation + damage math to the intellect module
    // (beginIntellectTargeting already re-reads traits and calculates its own stats)
    beginIntellectTargeting(heroIndex, targetingTime, button, FAMILY.INTELLECT)
}

function beginIntellectTargeting(
    heroIndex: number,
    spellLifetimeMs: number,
    button: string,
    family: number
) {
    const hero = heroes[heroIndex]; if (!hero) return

    // Pull hero traits
    const t1 = sprites.readDataNumber(hero, HERO_DATA.TRAIT1)
    const t2 = sprites.readDataNumber(hero, HERO_DATA.TRAIT2)
    const t3 = sprites.readDataNumber(hero, HERO_DATA.TRAIT3)
    const t4 = sprites.readDataNumber(hero, HERO_DATA.TRAIT4)
    const traits = [0, t1, t2, t3, t4]

    // Stats from traits
    const stats = calculateMoveStatsForFamily(family, button, traits)

    // Control window: final targeting time already computed in calculateIntellectStats
    const lifespanMs = (stats[STAT.TARGETING_TIME] || 5000)


    const baseDamage = getBasePower(family)
    const damageMult = stats[STAT.DAMAGE_MULT]
    let dmg = Math.idiv(baseDamage * damageMult, 100)
    if (dmg < 1) dmg = 1

    const weakenPct = stats[STAT.WEAKEN_PCT]
    const weakenDurMs = stats[STAT.WEAKEN_DURATION]

    // Aim vector from hero
    const dir = getAimVectorForHero(heroIndex)
    let dx = dir[0], dy = dir[1]
    if (dx == 0 && dy == 0) { dx = 1; dy = 0 }

    const baseSpeed = 30
    let mag = Math.sqrt(dx * dx + dy * dy)
    if (mag == 0) mag = 1
    const vx = Math.idiv(dx * baseSpeed, mag)
    const vy = Math.idiv(dy * baseSpeed, mag)

    // Lock hero motion, mark as controlling a spell
    hero.vx = 0
    hero.vy = 0
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, true)

    const imgCore = (family == FAMILY.HEAL)
        ? img`
            . 7 7 7 .
            7 7 7 7 7
            7 7 7 7 7
            . 7 7 7 .
        `
        : img`
            . 8 8 8 .
            8 8 8 8 8
            8 8 8 8 8
            . 8 8 8 .
        `

    const spell = sprites.createProjectileFromSprite(imgCore, hero, vx, vy)
    spell.setKind(SpriteKind.HeroWeapon)

    // 🔧 IMPORTANT: give the projectile a real lifespan (like v10),
    // long enough for targeting + detonation visuals.
    // Add a bit of buffer beyond the targeting window.
    spell.lifespan = lifespanMs + 1000

    const now = game.runtime()

    // Control time window (our own floor / timer detonation)
    const ctrlUntil = now + lifespanMs
    //    sprites.setDataNumber(spell, "INT_CTRL_UNTIL", ctrlUntil)

    sprites.setDataNumber(spell, INT_CTRL_UNTIL_KEY, ctrlUntil)



    // 🔵 DEBUG: log spawn + control window
    console.log(
        `[INT DEBUG] SPAWN hero=${heroIndex} family=${family} ` +
        `now=${now} ctrlUntil=${ctrlUntil} lifespanMs=${lifespanMs} ` +
        `pos=(${hero.x},${hero.y}) vxvy=(${vx},${vy})`
    )

    heroControlledSpells[heroIndex] = spell
    heroProjectiles.push(spell)

    sprites.setDataNumber(spell, PROJ_DATA.HERO_INDEX, heroIndex)
    sprites.setDataNumber(spell, PROJ_DATA.FAMILY, family)
    sprites.setDataString(spell, PROJ_DATA.BUTTON, button)

    // Intellect: actual damage; Heal: 0 here (we compute healing on detonation)
    sprites.setDataNumber(
        spell,
        PROJ_DATA.DAMAGE,
        (family == FAMILY.HEAL) ? 0 : dmg
    )
    sprites.setDataNumber(spell, PROJ_DATA.IS_HEAL, (family == FAMILY.HEAL) ? 1 : 0)
    sprites.setDataNumber(spell, PROJ_DATA.SLOW_PCT, 0)
    sprites.setDataNumber(spell, PROJ_DATA.SLOW_DURATION_MS, 0)
    sprites.setDataNumber(spell, PROJ_DATA.WEAKEN_PCT, weakenPct)
    sprites.setDataNumber(spell, PROJ_DATA.WEAKEN_DURATION_MS, weakenDurMs)
    sprites.setDataNumber(spell, PROJ_DATA.KNOCKBACK_PCT, 0)

    // Default AoE radius; traits can later tune this
    sprites.setDataNumber(spell, INT_RADIUS_KEY, 16)
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

// Finish helper
function finishIntellectSpellForHero(heroIndex: number) {
    if (heroIndex < 0 || heroIndex >= heroes.length) return
    const hero = heroes[heroIndex]; if (!hero) return
    sprites.setDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL, false)
    const spell = heroControlledSpells[heroIndex]
    if (spell) heroControlledSpells[heroIndex] = null
    heroBusyUntil[heroIndex] = 0
    sprites.setDataBoolean(hero, HERO_DATA.INPUT_LOCKED, false)
    sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)   // NEW
    unlockHeroControls(heroIndex)

    // NEW: spell finished → back to idle
    setHeroPhaseString(heroIndex, "idle")

}

function updateIntellectSpellsControl() {
    const baseAccel = 40, maxSpeed = 80
    const now = game.runtime()

    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]; if (!hero) continue

        const isCtrl = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)
        if (!isCtrl) continue

        const spell = heroControlledSpells[i]; if (!spell) continue

        // Fizzle if floor elapsed and no detonation yet
        //        const ctrlUntil = sprites.readDataNumber(spell, "INT_CTRL_UNTIL") | 0

        const ctrlUntil = sprites.readDataNumber(spell, INT_CTRL_UNTIL_KEY) | 0


        if (ctrlUntil > 0 && now >= ctrlUntil && !sprites.readDataNumber(spell, INT_DETONATED_KEY)) {
            const fam = sprites.readDataNumber(spell, PROJ_DATA.FAMILY)

            // DEBUG: timer-based detonation / fizzle
            console.log(
                `[INT DEBUG] TIMER DETONATION hero=${i} family=${fam} ` +
                `now=${now} ctrlUntil=${ctrlUntil} delta=${now - ctrlUntil}`
            )

            if (fam == FAMILY.HEAL) detonateHealSpellAt(spell, spell.x, spell.y)
            else detonateIntellectSpellAt(spell, spell.x, spell.y)
            continue
        }

        // If already detonated, don't move
        if (sprites.readDataNumber(spell, INT_DETONATED_KEY)) continue

        // Controls
        const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0
        let ctrl: controller.Controller = null
        if (ownerId == 1) ctrl = controller.player1
        else if (ownerId == 2) ctrl = controller.player2
        else if (ownerId == 3) ctrl = controller.player3
        else if (ownerId == 4) ctrl = controller.player4
        if (!ctrl) continue

        let ax = 0, ay = 0
        if (ctrl.left.isPressed()) ax -= baseAccel
        if (ctrl.right.isPressed()) ax += baseAccel
        if (ctrl.up.isPressed()) ay -= baseAccel
        if (ctrl.down.isPressed()) ay += baseAccel

        if (ax != 0 || ay != 0) {
            spell.vx += ax
            spell.vy += ay

            const vx = spell.vx, vy = spell.vy
            const speedSq = vx * vx + vy * vy
            const maxSq = maxSpeed * maxSpeed
            if (speedSq > maxSq) {
                const m = Math.sqrt(speedSq)
                spell.vx = Math.idiv(vx * maxSpeed, m)
                spell.vy = Math.idiv(vy * maxSpeed, m)
            }
        }
    }
}

// INTELLECT: one-time detonation at (termX, termY) with AoE damage+weaken
function detonateIntellectSpellAt(spell: Sprite, termX: number, termY: number) {
    if (!spell) return
    if (sprites.readDataNumber(spell, INT_DETONATED_KEY)) return

    const heroIndex = sprites.readDataNumber(spell, PROJ_DATA.HERO_INDEX) | 0

    // 👉 As soon as detonation begins, give control back to the hero
    if (heroIndex >= 0 && heroIndex < heroes.length) {
        finishIntellectSpellForHero(heroIndex)
    }

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

    // Visual + cleanup (spell will be destroyed later, but hero is already free)
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
    if (heroIndex < 0 || heroIndex >= heroes.length) return
    if (heroControlledSpells[heroIndex] == proj) { heroControlledSpells[heroIndex] = null; finishIntellectSpellForHero(heroIndex) }
})


// ====================================================
// SECTION H - HEAL AND SUPPORT SPELLS MODULE
// ====================================================
// Heal/support effects. Drives healing & buff application.

// HEAL: one-time detonation that heals heroes only (no enemy effect)

const SUPPORT_BEAM_SPEED = 80 // pixels per second-ish

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


function beginSupportPuzzleForHero(heroIndex: number, seqLen: number, now: number) {
    const hero = heroes[heroIndex]; if (!hero) return

    // Generate random sequence
    const seq: number[] = []
    for (let i = 0; i < seqLen; i++) {
        seq.push(randomSupportDir())
    }
    supportPuzzleSeq[heroIndex] = seq
    supportPuzzleProgress[heroIndex] = 0
    supportPuzzleStartMs[heroIndex] = now
    supportPuzzlePrevMask[heroIndex] = 0

    // Clear any existing icons
    const oldIcons = supportPuzzleIcons[heroIndex]
    for (let i = 0; i < oldIcons.length; i++) {
        if (oldIcons[i]) oldIcons[i].destroy()
    }
    supportPuzzleIcons[heroIndex] = []

    // 9x9 icons with a 1-pixel gap, centered under hero
    const iconSize = 9
    const gap = 1
    const step = iconSize + gap
    const mid = (seqLen - 1) / 2
    const y = hero.y + 12

    for (let i = 0; i < seqLen; i++) {
        const dir = seq[i]
        const spr = sprites.create(supportIconImageFor(dir, false), SpriteKind.SupportIcon)
        // center icons symmetrically around hero.x
        spr.x = hero.x + (i - mid) * step
        spr.y = y
        spr.z = hero.z + 1 //Make sure the arrows don't get hidden behind players
        supportPuzzleIcons[heroIndex].push(spr)
    }

    // Lock hero movement while puzzle is active
    lockHeroControls(heroIndex)
    supportPuzzleActive[heroIndex] = true

    // NEW: treat support action as a cast phase
    setHeroPhaseString(heroIndex, "cast")

}



function updateSupportPuzzles(now: number) {
    for (let hi = 0; hi < heroes.length; hi++) {
        if (!supportPuzzleActive[hi]) continue
        const hero = heroes[hi]; if (!hero) continue
        const seq = supportPuzzleSeq[hi]
        const progress = supportPuzzleProgress[hi]
        if (!seq || progress >= seq.length) continue

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

        if (newMask == 0) continue  // no new press this frame

        let dir = -1
        if (newMask & 1) dir = SUP_DIR_UP
        else if (newMask & 2) dir = SUP_DIR_DOWN
        else if (newMask & 4) dir = SUP_DIR_LEFT
        else if (newMask & 8) dir = SUP_DIR_RIGHT

        if (dir < 0) continue

        const expected = seq[progress]

        if (dir == expected) {
            // Correct input; advance
            supportPuzzleProgress[hi] = progress + 1

            // Turn this icon "green"
            const icons = supportPuzzleIcons[hi]
            if (icons && icons[progress]) {
                icons[progress].setImage(supportIconImageFor(expected, true))
            }

            if (supportPuzzleProgress[hi] >= seq.length) {
                // Puzzle complete → activate support beams
                completeSupportPuzzleForHero(hi)
            }
        } else {
            // Wrong input → fizzle
            failSupportPuzzleForHero(hi)
        }
    }
}

function clearSupportPuzzleForHero(heroIndex: number) {
    const icons = supportPuzzleIcons[heroIndex]
    for (let i = 0; i < icons.length; i++) {
        if (icons[i]) icons[i].destroy()
    }
    supportPuzzleIcons[heroIndex] = []
    supportPuzzleSeq[heroIndex] = []
    supportPuzzleProgress[heroIndex] = 0
    supportPuzzleActive[heroIndex] = false
    supportPuzzlePrevMask[heroIndex] = 0
    unlockHeroControls(heroIndex)

    // NEW: support puzzle ended (success or fail) → back to idle
    setHeroPhaseString(heroIndex, "idle")
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

    console.log(
        "[HE.spawned Enemy Of Kind]" +
        "id=" + enemy.id +
        " kind=" + enemy.kind +
        " monsterId=" + monsterId +
        " dataKeys=" + Object.keys((enemy as any).data || {})
    )

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

// Global flags you can flip later.
const TEST_WAVE_ENABLED = false     // show ALL monsters once
const DEBUG_WAVE_ENABLED = false     // focus on a single monster type
const DEBUG_MONSTER_ID = "imp blue"  // which monster for debug waves

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

                console.log(
                "[enemyHoming] DEATH HOLD",
                "monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                "phase=", sprites.readDataString(enemy, "phase") || "(none)",
                "x=", enemy.x, "y=", enemy.y,
                "t=", nowMs
                )

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
                    console.log(
                        "[enemyHoming] ATTACK HOLD",
                        "monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                        "phase=", phaseStr,
                        "x=", enemy.x, "y=", enemy.y,
                        "vx=", enemy.vx, "vy=", enemy.vy,
                        "t=", nowMs
                    )
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
                console.log(
                    "[enemyHoming] START ATTACK",
                    "monsterId=", mid,
                    "phase=", "attack",
                    "d2=", bestD2,
                    "attackMs=", attackMs
                )
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
            console.log(
                "[enemyHoming] tick",
                "monsterId=", sprites.readDataString(enemy, ENEMY_DATA.MONSTER_ID) || "(none)",
                "phase=", phaseStr,
                "x=", enemy.x, "y=", enemy.y,
                "vx=", enemy.vx, "vy=", enemy.vy,
                "t=", nowMs
            )
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
        // Already dying? don't reschedule
        const existing = sprites.readDataNumber(enemy, ENEMY_DATA.DEATH_UNTIL) | 0
        if (existing > 0) return

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
            // Agility module owns movement + lifetime; it removes itself on false
            if (!updateAgilityProjectilesMotionFor(proj, hero, heroIndex, now, i)) {
                continue
            }
        } else if (mvType === "strengthswing") {
            // Strength module owns movement + lifetime
            if (!updateStrengthProjectilesMotionFor(proj, hero, heroIndex, now, i)) {
                continue
            }
        } else if (mvType === "supportbeam") {
            // Support beams home toward target hero and apply buffs on arrival
            if (!updateSupportBeamFor(proj, heroIndex, now, i)) {
                heroProjectiles.removeAt(i)
                continue
            }
        } else {
            // Driven spells (Intellect / old Heal) and any other non-STR/AGI/SUPPORT projectiles
            // are owned by their own modules; don't touch them here.
            continue
        }
    }

    // 2) INT spells (driven spells) – Intellect module owns them
    updateIntellectSpellsControl()
    processIntellectLingers()
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

function updatePlayerInputs() {
    const aNow1 = controller.player1.A.isPressed()
    const bNow1 = controller.player1.B.isPressed()
    if (aNow1 && bNow1) p1Intent = "A+B"
    else if (aNow1) p1Intent = "A"
    else if (bNow1) p1Intent = "B"
    else p1Intent = ""

    const aNow2 = controller.player2.A.isPressed()
    const bNow2 = controller.player2.B.isPressed()
    if (aNow2 && bNow2) p2Intent = "A+B"
    else if (aNow2) p2Intent = "A"
    else if (bNow2) p2Intent = "B"
    else p2Intent = ""

    const aNow3 = controller.player3.A.isPressed()
    const bNow3 = controller.player3.B.isPressed()
    if (aNow3 && bNow3) p3Intent = "A+B"
    else if (aNow3) p3Intent = "A"
    else if (bNow3) p3Intent = "B"
    else p3Intent = ""

    const aNow4 = controller.player4.A.isPressed()
    const bNow4 = controller.player4.B.isPressed()
    if (aNow4 && bNow4) p4Intent = "A+B"
    else if (aNow4) p4Intent = "A"
    else if (bNow4) p4Intent = "B"
    else p4Intent = ""


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
    for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi]; if (!hero) continue;

        // Don't stomp special phases
        if (sprites.readDataBoolean(hero, HERO_DATA.IS_DEAD)) continue;
        if (sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)) continue;
        if (supportPuzzleActive[hi]) continue;

        const busyUntil = sprites.readDataNumber(hero, HERO_DATA.BUSY_UNTIL) || 0;
        if (busyUntil > now) continue; // mid-attack / cast window → keep slash/thrust/cast

        const vx = hero.vx, vy = hero.vy;
        if (vx || vy) {
            // Moving but not in a special move → run phase
            setHeroPhaseString(hi, "run");
        } else {
            // Standing, not busy → idle
            setHeroPhaseString(hi, "idle");
        }
    }
}



// New helper: maintain locked heroes unless controlling a spell
function updateHeroControlLocks(now: number) {
    for (let i = 0; i < heroes.length; i++) {
        const hero = heroes[i]
        if (!hero) continue

        const locked = sprites.readDataBoolean(hero, HERO_DATA.INPUT_LOCKED)
        const isCtrlSpell = sprites.readDataBoolean(hero, HERO_DATA.IS_CONTROLLING_SPELL)
        if (locked && !isCtrlSpell) {
            hero.vx = sprites.readDataNumber(hero, HERO_DATA.STORED_VX)
            hero.vy = sprites.readDataNumber(hero, HERO_DATA.STORED_VY)


            const busyUntil = heroBusyUntil[i] || 0
            if (busyUntil > 0 && now >= busyUntil) {

                if (DEBUG_INTEGRATOR) {
                    console.log("[LOCK-END] hero=" + i + " unlock at " + (now | 0))
                }

                if (DEBUG_INTEGRATOR) {
                    sprites.setDataNumber(hero, "INT_ID", 0)
                }
                unlockHeroControls(i)
                heroBusyUntil[i] = 0

                // NEW: reflect that unlock into hero data
                sprites.setDataNumber(hero, HERO_DATA.BUSY_UNTIL, 0)

                // NEW: when control lock ends, hero returns to idle phase
                setHeroPhaseString(i, "idle")


            }
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
game.onUpdate(function () {
    if (!HeroEngine._isStarted()) return

    // NEW: snapshot previous positions for all heroes
    for (let hi = 0; hi < heroes.length; hi++) {
        const h = heroes[hi]
        if (h) {
            sprites.setDataNumber(h, HERO_DATA.PREV_X, h.x)
            sprites.setDataNumber(h, HERO_DATA.PREV_Y, h.y)
        }
    }

    updateHeroFacingsFromVelocity()
    updatePlayerInputs()
    const now = game.runtime()


    // NEW: keep a canonical world-runtime mirror
    worldRuntimeMs = now

    // Debug integrator logs
    for (let i = 0; i < heroes.length; i++) { const hero = heroes[i]; if (hero) debugDashIntegratorTick(hero) }

    updateSupportPuzzles(now)     // NEW
    updateHeroControlLocks(now)

    // NEW: if not in a special move, phase follows motion (idle/run)
    updateHeroMovementPhase(now)

    updateHeroBuffs(now)          // NEW


    // NEW: handle post-death cleanup (LPC death anim window)
    updateHeroDeaths(now);

    //updateHeroControlLocks(now)

    updateHeroProjectiles()     // <— this replaces the messy cluster

    updateHeroAuras()                  // aura + combo meter

    // NEW: enforce collisions with logical wall tiles
    resolveTilemapCollisions()

    for (let hi = 0; hi < heroes.length; hi++) { const h = heroes[hi]; if (h) debugAgilityDashProgress(h, hi) }
    updateEnemyHoming(now)             // AI + attacks

    updateEnemyEffects(now)     // clear expired enemy effects

})



// Timers

game.onUpdateInterval(80, function () {
    if (!HeroEngine._isStarted()) return;

    try {
        const nowMs = game.runtime() | 0;

        if (p1Intent != "") {
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] BEFORE P1 intent=" + p1Intent + " timeMs=" + nowMs);
            }
            doHeroMoveForPlayer(1, p1Intent);
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] AFTER P1 intent=" + p1Intent + " timeMs=" + nowMs);
            }
        }

        if (p2Intent != "") {
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] BEFORE P2 intent=" + p2Intent + " timeMs=" + nowMs);
            }
            doHeroMoveForPlayer(2, p2Intent);
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] AFTER P2 intent=" + p2Intent + " timeMs=" + nowMs);
            }
        }

        if (p3Intent != "") {
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] BEFORE P3 intent=" + p3Intent + " timeMs=" + nowMs);
            }
            doHeroMoveForPlayer(3, p3Intent);
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] AFTER P3 intent=" + p3Intent + " timeMs=" + nowMs);
            }
        }

        if (p4Intent != "") {
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] BEFORE P4 intent=" + p4Intent + " timeMs=" + nowMs);
            }
            doHeroMoveForPlayer(4, p4Intent);
            if (DEBUG_HERO_LOGIC) {
                console.log("[TIMER80] AFTER P4 intent=" + p4Intent + " timeMs=" + nowMs);
            }
        }
    } catch (e) {
        console.log("[TIMER80] ERROR in doHeroMoveForPlayer:" + e);
    }
});


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
        kinds: ["imp blue", "bat"],
        weights: [1]
    },
    {
        label: "Wave 2 – More Grunts",
        durationMs: 2400,
        breakMs: 4000,
        spawnChance: 0.75,
        kinds: ["imp blue"],
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
        kinds: ["imp blue", "spider green", "big worm", "dragon red"],
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
    if (!enemySpawners || enemySpawners.length == 0) return

    const now = game.runtime()

    if (!WAVE_DEFS || WAVE_DEFS.length == 0) {
        const idx = randint(0, enemySpawners.length - 1)
        const s = enemySpawners[idx]
        // Spawns a default real monster id if you ever run with no WAVE_DEFS
        console.log("Doing a default imp blue call to spawn enemy Of Kind")
        spawnEnemyOfKind("imp blue", s.x, s.y)
        
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
    console.log("Making a call to spawn enemy Of Kind")
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

        console.log(">>> [HeroEngineInPhaser] exposed __HeroEnginePhaserInternals (tile map + size)");
    } catch {
        // If globalThis isn't available (e.g., PXT runtime), just silently skip.
    }
})();
