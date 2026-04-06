import type { StudentApi } from "../../studentApi";
import { registerStudentRelicEffectHandler, triggerVfx } from "../../studentSystemsHooks";
import { setEnemySlow, setEnemyWeaken, applyKnockback, applyKnockbackFrom, applyStun, getEnemiesInRadius } from "./amuletUtils";

/**
 * Amulet of Tides effect handler
 * 
 * Effects:
 * - Every 5 Strength moves creates tides that push enemies back (Cooldown: 5 seconds)
 * - Intelligence moves create bubbles that trap enemies for 2.5 seconds (Cooldown: 7 seconds)
 * - Movespeed increased by 15%
 */

type TidesState = {
    strengthMoveCount: number;
    lastTideTime: number;
    lastBubbleTime: number;
    lastWisdomShieldTime: number;
};

/**
 * Amulet of Zephyrs effect handler
 * 
 * Effects:
 * - Strength moves speed increased by 5%
 * - Intelligence moves create a small tornado pulling enemies to center (Cooldown: 6 seconds)
 * - Movespeed increased by 15%
 */

type ZephyrsState = {
    lastTornadoTime: number;
    lastWisdomShieldTime: number;
};

/**
 * Amulet of Embers effect handler
 * 
 * Effects:
 * - Strength moves burn enemies dealing 2% of enemy health per 0.5s for 2s (Non-refreshable until done burning)
 * - Every 3 Strength moves stuns enemy for 1s (Cooldown: 7 seconds)
 * - Intelligence moves create small explosion when enemies are hit
 * - Movespeed increased by 10%
 */

type EmbersState = {
    strengthMoveCount: number;
    lastStunTime: number;
    burnedEnemies: WeakSet<any>; // Track enemies currently burning
    lastWisdomShieldTime: number;
};

/**
 * Amulet of Venom effect handler
 * 
 * Effects:
 * - Strength moves poison enemies for 2% health per 0.5s for 1.5s (Non-refreshable until done poisoning)
 * - Poison also reduces enemy defense and attack by 5%, capping at 20% (Lasts 4.5-5 seconds if not reapplied)
 * - Intelligence moves create area that slows and damages enemies inside (Cooldown: 5 seconds)
 * - Movespeed increased by 12%
 */

type VenomState = {
    poisonedEnemies: WeakSet<any>; // Track enemies currently poisoned
    lastPoisonAreaTime: number;
    enemyDebuffs: WeakMap<any, { defenseReduction: number; attackReduction: number; debuffEndTime: number }>;
    lastWisdomShieldTime: number;
};

/**
 * Amulet of Stones effect handler
 * 
 * Effects:
 * - Strength moves knock back enemies in 360 degree radius (Cooldown: 4 seconds)
 * - Intelligence moves drop rock on enemies, stun for 2s, deal extra damage (Cooldown: 12 seconds)
 * - Movespeed decreased by 10%
 * - Defense increased by 20%
 */

type StonesState = {
    lastKnockbackTime: number;
    lastRockDropTime: number;
    lastWisdomShieldTime: number;
};

const WISDOM_SHIELD_DURATION_MS = 2500;
const WISDOM_SHIELD_COOLDOWN_MS = 30000;
const HERO_WISDOM_SHIELD_INVUL_UNTIL_KEY = "amuletWisdomShieldInvulUntil";

const tidesStateMap = new WeakMap<any, TidesState>();
const zephyrsStateMap = new WeakMap<any, ZephyrsState>();
const embersStateMap = new WeakMap<any, EmbersState>();
const venomStateMap = new WeakMap<any, VenomState>();
const stonesStateMap = new WeakMap<any, StonesState>();

// ---------------------------------------------------------------------------
// HUD SNAPSHOT — read by amuletHud.ts every frame to drive the cooldown UI.
// Updated in-place by effect handlers so the HUD always sees current values.
// ---------------------------------------------------------------------------
export type AmuletHudSnapshot = {
    tides: { strengthMoveCount: number; lastTideTime: number; lastBubbleTime: number };
    zephyrs: { lastTornadoTime: number };
    embers: { strengthMoveCount: number; lastStunTime: number };
    venom: { lastPoisonAreaTime: number };
    stones: { lastKnockbackTime: number; lastRockDropTime: number };
};

const _hudSnapshot: AmuletHudSnapshot = {
    tides: { strengthMoveCount: 0, lastTideTime: 0, lastBubbleTime: 0 },
    zephyrs: { lastTornadoTime: 0 },
    embers: { strengthMoveCount: 0, lastStunTime: 0 },
    venom: { lastPoisonAreaTime: 0 },
    stones: { lastKnockbackTime: 0, lastRockDropTime: 0 },
};

/** Returns a live reference; values update in-place as effects fire. */
export function getAmuletHudSnapshot(): AmuletHudSnapshot {
    return _hudSnapshot;
}

function getTidesState(hero: any): TidesState {
    if (!tidesStateMap.has(hero)) {
        tidesStateMap.set(hero, {
            strengthMoveCount: 0,
            lastTideTime: 0,
            lastBubbleTime: 0,
            lastWisdomShieldTime: 0,
        });
    }
    return tidesStateMap.get(hero)!;
}

function getZephyrsState(hero: any): ZephyrsState {
    if (!zephyrsStateMap.has(hero)) {
        zephyrsStateMap.set(hero, {
            lastTornadoTime: 0,
            lastWisdomShieldTime: 0,
        });
    }
    return zephyrsStateMap.get(hero)!;
}

function getEmbersState(hero: any): EmbersState {
    if (!embersStateMap.has(hero)) {
        embersStateMap.set(hero, {
            strengthMoveCount: 0,
            lastStunTime: 0,
            burnedEnemies: new WeakSet(),
            lastWisdomShieldTime: 0,
        });
    }
    return embersStateMap.get(hero)!;
}

function getVenomState(hero: any): VenomState {
    if (!venomStateMap.has(hero)) {
        venomStateMap.set(hero, {
            poisonedEnemies: new WeakSet(),
            lastPoisonAreaTime: 0,
            enemyDebuffs: new WeakMap(),
            lastWisdomShieldTime: 0,
        });
    }
    return venomStateMap.get(hero)!;
}

function getStonesState(hero: any): StonesState {
    if (!stonesStateMap.has(hero)) {
        stonesStateMap.set(hero, {
            lastKnockbackTime: 0,
            lastRockDropTime: 0,
            lastWisdomShieldTime: 0,
        });
    }
    return stonesStateMap.get(hero)!;
}

function applyWisdomShieldInvulnerability(ctx: any): void {
    const hero = ctx?.hero;
    if (!hero) return;

    try {
        const spritesApi = (globalThis as any).sprites;
        if (!spritesApi || typeof spritesApi.readDataNumber !== "function") return;

        const now = Date.now() | 0;
        const invulUntil = spritesApi.readDataNumber(hero, HERO_WISDOM_SHIELD_INVUL_UNTIL_KEY) | 0;
        if (invulUntil > now) {
            ctx.preventDamage = true;
            ctx.damage = 0;
        }
    } catch {
        // Silent fail keeps gameplay stable even if sprite data API is unavailable.
    }
}

function triggerWisdomShieldEffect(ctx: any, shieldVfxId: string): void {
    const hero = ctx?.hero;
    if (!hero || !hero.scene) return;

    try {
        const spritesApi = (globalThis as any).sprites;
        if (spritesApi && typeof spritesApi.setDataNumber === "function") {
            const now = Date.now() | 0;
            const invulUntil = (now + WISDOM_SHIELD_DURATION_MS) | 0;
            spritesApi.setDataNumber(hero, HERO_WISDOM_SHIELD_INVUL_UNTIL_KEY, invulUntil);
        }
    } catch {
        // Silent fail keeps gameplay stable even if sprite data API is unavailable.
    }

    triggerVfx(shieldVfxId, {
        x: hero.x,
        y: hero.y,
        lifespanMs: WISDOM_SHIELD_DURATION_MS,
    });
}

// ---------------------------------------------------------------------------
// ELEMENT OVERRIDE SYSTEM
// Forces the amulet's element onto all of the hero's move VFX so the charge
// arc / cast colour matches the amulet theme, regardless of the Blockly choice.
//
// Engine ELEM constants: NONE=0, GRASS=1, FIRE=2, WATER=3,
//                        ELECTRIC=4, EARTH=5, ICE=6, AIR/WIND=7
// ---------------------------------------------------------------------------
const _HD_STR_PAY_EL   = "strPayEl";        // HERO_DATA.STR_PAYLOAD_EL
const _HD_ELEM         = "elem";            // HERO_DATA.ELEMENT
const _HD_STR_CHARGING = "strChg";          // HERO_DATA.STR_CHARGING (boolean)
const _INT_CAST_ELEM   = "INT_CAST_ELEMENT";// INT_CAST_ELEMENT_KEY
const _HD_RENDERSTYLE  = "RenderStyleMask"; // HERO_DATA.RenderStyleMask

// ELEM.GRASS(1) is the closest engine element to poison, used for Venom.
const AMULET_ELEM: Record<string, number> = {
    "amulet_tides_effect":   3, // WATER
    "amulet_zephyrs_effect": 7, // AIR / WIND
    "amulet_embers_effect":  2, // FIRE
    "amulet_venom_effect":   1, // GRASS  (poison stand-in)
    "amulet_stones_effect":  5, // EARTH
};

// Per-hero desired element — maintained as long as the hero object lives.
const _heroElemOverrides = new Map<any, number>();

/**
 * Records the amulet element for `hero` and writes it to the relevant
 * engine sprite-data keys.  `strPayEl` is patched via microtask so it
 * fires AFTER `executeStrengthMove` overwrites it in the same sync tick.
 */
function _overrideHeroMoveElement(hero: any, elemNum: number): void {
    if (!hero) return;
    _heroElemOverrides.set(hero, elemNum);
    const sp = (globalThis as any).sprites;
    if (!sp) return;
    try { sp.setDataNumber(hero, _HD_ELEM,        elemNum); } catch {}
    try { sp.setDataNumber(hero, _INT_CAST_ELEM,  elemNum); } catch {}
    try { sp.setDataNumber(hero, _HD_RENDERSTYLE, elemNum > 0 ? (1 << elemNum) : 0); } catch {}
    // strPayEl is overwritten by executeStrengthMove after modifyMoveStats returns.
    // Queue a microtask so our value wins after the synchronous game-tick completes.
    queueMicrotask(() => {
        try {
            const sp2 = (globalThis as any).sprites;
            if (sp2) sp2.setDataNumber(hero, _HD_STR_PAY_EL, elemNum);
        } catch {}
    });
}

let _elemPatcherInstalled = false;

/**
 * Installs a 32 ms interval that keeps `strPayEl` locked to the amulet
 * element while the hero is holding a strength charge (multi-frame hold).
 */
function _installElemOverridePatcher(): void {
    if (_elemPatcherInstalled) return;
    _elemPatcherInstalled = true;
    setInterval(() => {
        const sprites = (globalThis as any).sprites;
        if (!sprites) return;
        for (const [hero, elemNum] of _heroElemOverrides) {
            if (!hero || (hero.flags & 4)) { // 4 = sprites.Flag.Destroyed
                _heroElemOverrides.delete(hero);
                continue;
            }
            try {
                sprites.setDataNumber(hero, _HD_ELEM,        elemNum);
                sprites.setDataNumber(hero, _INT_CAST_ELEM,  elemNum);
                sprites.setDataNumber(hero, _HD_RENDERSTYLE, elemNum > 0 ? (1 << elemNum) : 0);
                if (sprites.readDataBoolean(hero, _HD_STR_CHARGING)) {
                    sprites.setDataNumber(hero, _HD_STR_PAY_EL, elemNum);
                }
            } catch {}
        }
    }, 32);
}

export function setupAmuletEffects(api: StudentApi): void {
    _installElemOverridePatcher();
    registerStudentRelicEffectHandler({
        effectKey: "amulet_tides_effect",

        modifyMoveSpeed(ctx: any) {
            // Increase move speed by 15%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 1.15;
            }
        },

        modifyMoveStats(ctx: any) {
            // Override element VFX to match amulet (water).
            _overrideHeroMoveElement(ctx.hero, AMULET_ELEM["amulet_tides_effect"]);
            // Track move types for tide/bubble triggering
            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getTidesState(hero);
            const now = Date.now();

            // Handle Strength moves (push enemies back with tides)
            if (move.family === "strength") {
                state.strengthMoveCount++;

                // Every 5 Strength moves, create tide effect (with 5s cooldown)
                if (state.strengthMoveCount >= 5 && now - state.lastTideTime >= 5000) {
                    state.strengthMoveCount = 0;
                    state.lastTideTime = now;
                    triggerTideEffect(ctx);
                }
                _hudSnapshot.tides.strengthMoveCount = state.strengthMoveCount;
                _hudSnapshot.tides.lastTideTime = state.lastTideTime;
            }

            // Intelligence bubble trigger/cooldown is handled in onHitEnemy
            // so cooldown starts when the crystal actually hits.
            _hudSnapshot.tides.lastBubbleTime = state.lastBubbleTime;

            // Handle Wisdom moves (2.5s shield invulnerability, 30s cooldown)
            if (move.family === "wisdom" && now - state.lastWisdomShieldTime >= WISDOM_SHIELD_COOLDOWN_MS) {
                state.lastWisdomShieldTime = now;
                triggerWisdomShieldEffect(ctx, "amulet_shield_tides");
            }
        },

        onHitEnemy(ctx: any) {
            const hero = ctx?.hero;
            const enemy = ctx?.enemy;
            const move = ctx?.move;
            if (!hero || !enemy || !move) return;
            if (move.family !== "intelligence") return;

            const state = getTidesState(hero);
            const now = Date.now();
            if (now - state.lastBubbleTime < 7000) return;

            state.lastBubbleTime = now;
            _hudSnapshot.tides.lastBubbleTime = state.lastBubbleTime;
            triggerBubbleEffect(ctx, enemy);
        },

        beforeHeroDamage(ctx: any) {
            applyWisdomShieldInvulnerability(ctx);
        },
    });

    registerStudentRelicEffectHandler({
        effectKey: "amulet_zephyrs_effect",

        modifyMoveSpeed(ctx: any) {
            // Increase move speed by 15%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 1.15;
            }
        },

        modifyMoveStats(ctx: any) {
            // Override element VFX to match amulet (wind/air).
            _overrideHeroMoveElement(ctx.hero, AMULET_ELEM["amulet_zephyrs_effect"]);
            // Handle Strength moves (increase their speed by 5%)
            const move = ctx.move;
            if (move && move.family === "strength") {
                if (ctx.stats) {
                    ctx.stats.speed = (ctx.stats.speed || 0) * 1.05;
                }
            }

            // Intelligence tornado trigger/cooldown is handled in onHitEnemy
            // so cooldown starts when the crystal actually hits.
            if (move && move.family === "intelligence") {
                const hero = ctx.hero;
                if (!hero) return;
                const state = getZephyrsState(hero);
                _hudSnapshot.zephyrs.lastTornadoTime = state.lastTornadoTime;
            }

            // Handle Wisdom moves (2.5s shield invulnerability, 30s cooldown)
            if (move && move.family === "wisdom") {
                const hero = ctx.hero;
                if (!hero) return;

                const state = getZephyrsState(hero);
                const now = Date.now();
                if (now - state.lastWisdomShieldTime >= WISDOM_SHIELD_COOLDOWN_MS) {
                    state.lastWisdomShieldTime = now;
                    triggerWisdomShieldEffect(ctx, "amulet_shield_zephyrs");
                }
            }
        },

        onHitEnemy(ctx: any) {
            const hero = ctx?.hero;
            const enemy = ctx?.enemy;
            const move = ctx?.move;
            if (!hero || !enemy || !move) return;
            if (move.family !== "intelligence") return;

            const state = getZephyrsState(hero);
            const now = Date.now();
            if (now - state.lastTornadoTime < 6000) return;

            state.lastTornadoTime = now;
            _hudSnapshot.zephyrs.lastTornadoTime = state.lastTornadoTime;
            triggerTornadoEffect(ctx, enemy);
        },

        beforeHeroDamage(ctx: any) {
            applyWisdomShieldInvulnerability(ctx);
        },
    });

    registerStudentRelicEffectHandler({
        effectKey: "amulet_embers_effect",

        modifyMoveSpeed(ctx: any) {
            // Increase move speed by 10%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 1.1;
            }
        },

        modifyMoveStats(ctx: any) {
            // Override element VFX to match amulet (fire).
            _overrideHeroMoveElement(ctx.hero, AMULET_ELEM["amulet_embers_effect"]);
            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getEmbersState(hero);
            const now = Date.now();

            // Hit-based Strength/Intelligence effects are handled in onHitEnemy.

            // Handle Wisdom moves (2.5s shield invulnerability, 30s cooldown)
            if (move.family === "wisdom" && now - state.lastWisdomShieldTime >= WISDOM_SHIELD_COOLDOWN_MS) {
                state.lastWisdomShieldTime = now;
                triggerWisdomShieldEffect(ctx, "amulet_shield_embers");
            }
        },

        onHitEnemy(ctx: any) {
            const hero = ctx?.hero;
            const enemy = ctx?.enemy;
            const move = ctx?.move;
            if (!hero || !enemy || !move) return;

            const state = getEmbersState(hero);
            const now = Date.now();

            if (move.family === "strength") {
                if (!state.burnedEnemies.has(enemy)) {
                    state.burnedEnemies.add(enemy);
                    triggerBurnEffect(ctx, enemy);
                }

                state.strengthMoveCount++;
                if (state.strengthMoveCount >= 3 && now - state.lastStunTime >= 7000) {
                    state.strengthMoveCount = 0;
                    state.lastStunTime = now;
                    triggerStunEffect(ctx, enemy);
                }
                _hudSnapshot.embers.strengthMoveCount = state.strengthMoveCount;
                _hudSnapshot.embers.lastStunTime = state.lastStunTime;
            }

            if (move.family === "intelligence") {
                triggerExplosionEffect(ctx, enemy);
            }
        },

        beforeHeroDamage(ctx: any) {
            applyWisdomShieldInvulnerability(ctx);
        },
    });

    registerStudentRelicEffectHandler({
        effectKey: "amulet_venom_effect",

        modifyMoveSpeed(ctx: any) {
            // Increase move speed by 12%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 1.12;
            }
        },

        modifyMoveStats(ctx: any) {
            // Override element VFX to match amulet (grass/nature — closest to poison).
            _overrideHeroMoveElement(ctx.hero, AMULET_ELEM["amulet_venom_effect"]);
            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getVenomState(hero);
            const now = Date.now();

            // Strength poison is hit-based and handled in onHitEnemy.

            // Intelligence poison area trigger/cooldown is handled in onHitEnemy
            // so cooldown starts when the crystal actually hits.
            if (move.family === "intelligence") {
                _hudSnapshot.venom.lastPoisonAreaTime = state.lastPoisonAreaTime;
            }

            // Handle Wisdom moves (2.5s shield invulnerability, 30s cooldown)
            if (move.family === "wisdom" && now - state.lastWisdomShieldTime >= WISDOM_SHIELD_COOLDOWN_MS) {
                state.lastWisdomShieldTime = now;
                triggerWisdomShieldEffect(ctx, "amulet_shield_venom");
            }
        },

        onHitEnemy(ctx: any) {
            const hero = ctx?.hero;
            const enemy = ctx?.enemy;
            const move = ctx?.move;
            if (!hero || !enemy || !move) return;
            const state = getVenomState(hero);

            if (move.family === "strength") {
                if (state.poisonedEnemies.has(enemy)) return;
                state.poisonedEnemies.add(enemy);
                triggerPoisonEffect(ctx, enemy, state);
                return;
            }

            if (move.family !== "intelligence") return;
            const now = Date.now();
            if (now - state.lastPoisonAreaTime < 5000) return;

            state.lastPoisonAreaTime = now;
            _hudSnapshot.venom.lastPoisonAreaTime = state.lastPoisonAreaTime;
            triggerPoisonAreaEffect(ctx, enemy);
        },

        beforeHeroDamage(ctx: any) {
            applyWisdomShieldInvulnerability(ctx);
        },
    });

    registerStudentRelicEffectHandler({
        effectKey: "amulet_stones_effect",

        modifyMoveSpeed(ctx: any) {
            // Decrease move speed by 10%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 0.9;
            }
        },

        modifyMoveStats(ctx: any) {
            // Override element VFX to match amulet (earth).
            _overrideHeroMoveElement(ctx.hero, AMULET_ELEM["amulet_stones_effect"]);
            // Increase defense by 20%
            if (ctx.hero && ctx.stats) {
                ctx.stats.defense = (ctx.stats.defense || 1) * 1.2;
            }

            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getStonesState(hero);
            const now = Date.now();

            // Handle Strength moves (knock back enemies in 360 degree radius)
            if (move.family === "strength") {
                if (now - state.lastKnockbackTime >= 4000) {
                    state.lastKnockbackTime = now;
                    triggerKnockbackEffect(ctx);
                }
                _hudSnapshot.stones.lastKnockbackTime = state.lastKnockbackTime;
            }

            // Handle Intelligence moves (drop rock to stun and damage)
            // Intelligence hit handling happens in onHitEnemy.

            // Handle Wisdom moves (2.5s shield invulnerability, 30s cooldown)
            if (move.family === "wisdom" && now - state.lastWisdomShieldTime >= WISDOM_SHIELD_COOLDOWN_MS) {
                state.lastWisdomShieldTime = now;
                triggerWisdomShieldEffect(ctx, "amulet_shield_stones");
            }
        },

        onHitEnemy(ctx: any) {
            const hero = ctx?.hero;
            const enemy = ctx?.enemy;
            const move = ctx?.move;
            if (!hero || !enemy || !move) return;
            if (move.family !== "intelligence") return;

            const state = getStonesState(hero);
            const now = Date.now();
            if (now - state.lastRockDropTime < 12000) return;

            state.lastRockDropTime = now;
            _hudSnapshot.stones.lastRockDropTime = state.lastRockDropTime;
            triggerRockDropEffect(ctx, enemy);
        },

        beforeHeroDamage(ctx: any) {
            applyWisdomShieldInvulnerability(ctx);
        },
    });
}

function triggerTideEffect(ctx: any): void {
    // Push enemies back effect with water tide visual
    const hero = ctx.hero;
    if (!hero || !hero.scene) return;

    const tideRadius = 90; // pixels
    const knockbackForce = 3.5; // pixels per frame
    const knockbackDuration = 500; // milliseconds
    
    // Spawn water tide VFX at hero position
    triggerVfx("amulet_tides_vfx", {
        x: hero.x,
        y: hero.y,
        lifespanMs: 800
    });
    
    // Spawn blue weapon visual
    triggerVfx("amulet_weapon_tides", {
        x: hero.x,
        y: hero.y - 30,
        lifespanMs: 600
    });
    
    // Get all enemies in tide radius and knock them back
    const enemiesInRadius = getEnemiesInRadius(hero.x, hero.y, tideRadius);
    for (const enemy of enemiesInRadius) {
        // Apply knockback away from hero center (wave pushes outward)
        applyKnockbackFrom(enemy, hero.x, hero.y, knockbackForce, knockbackDuration);
    }
}

function triggerBubbleEffect(ctx: any, anchorEnemy: any): void {
    // Trap enemies with bubbles for 2.5 seconds at crystal-hit location.
    const hero = ctx.hero;
    if (!hero || !hero.scene || !anchorEnemy) return;

    const centerX = anchorEnemy.x;
    const centerY = anchorEnemy.y;
    const bubbleRadius = 80; // pixels
    const trapDuration = 2500; // 2.5 seconds

    // Spawn blue weapon visual at hit location.
    triggerVfx("amulet_weapon_tides", {
        x: centerX,
        y: centerY - 30,
        lifespanMs: 600
    });

    // Get all enemies in bubble radius around hit location.
    const enemiesInRadius = getEnemiesInRadius(centerX, centerY, bubbleRadius);
    for (const enemy of enemiesInRadius) {
        // Spawn bubble VFX at each enemy position
        triggerVfx("amulet_tides_vfx", {
            x: enemy.x,
            y: enemy.y,
            lifespanMs: trapDuration
        });
        
        // Apply stun status to trap enemy in place
        applyStun(enemy, trapDuration);
    }
}

function triggerTornadoEffect(ctx: any, anchorEnemy: any): void {
    // Create a small tornado that pulls enemies to crystal-hit location.
    const hero = ctx.hero;
    if (!hero || !hero.scene || !anchorEnemy) return;

    const centerX = anchorEnemy.x;
    const centerY = anchorEnemy.y;
    const tornadoRadius = 100; // pixels
    const pullForce = 4; // pixels per frame
    const pullDuration = 800; // milliseconds

    // Spawn tornado VFX at hit location.
    triggerVfx("amulet_zephyrs_vfx", {
        x: centerX,
        y: centerY,
        lifespanMs: 800
    });

    // Spawn white weapon visual at hit location.
    triggerVfx("amulet_weapon_zephyrs", {
        x: centerX,
        y: centerY - 30,
        lifespanMs: 600
    });

    const enemiesInRadius = getEnemiesInRadius(centerX, centerY, tornadoRadius);
    for (const enemy of enemiesInRadius) {
        // Pull enemies toward tornado center.
        applyKnockbackFrom(enemy, centerX, centerY, pullForce, pullDuration);
    }
}

function triggerBurnEffect(ctx: any, enemy: any): void {
    // Burn enemy for 2% of their health per 0.5 seconds for 2 seconds
    // Total damage: 2% * 4 ticks = 8% of enemy health
    // Non-refreshable until done burning
    if (!enemy) return;

    const hero = ctx.hero;
    const state = getEmbersState(hero);
    const enemyMaxHealth = enemy.maxHealth || enemy.health || 100;
    const damagePerTick = (enemyMaxHealth * 0.02);
    const totalTicks = 4; // 2 seconds / 0.5 seconds = 4 ticks
    let tickCount = 0;

    // Spawn burn VFX on enemy
    triggerVfx("amulet_embers_vfx", {
        x: enemy.x,
        y: enemy.y,
        lifespanMs: 2000
    });
    
    // Spawn orange weapon visual at hero
    if (hero) {
        triggerVfx("amulet_weapon_embers", {
            x: hero.x,
            y: hero.y - 30,
            lifespanMs: 600
        });
    }

    const burnInterval = setInterval(() => {
        if (tickCount >= totalTicks || !enemy) {
            clearInterval(burnInterval);
            // Remove from burned set when burn effect ends
            state.burnedEnemies.delete(enemy);
            return;
        }
        
        // Apply damage (would integrate with actual game damage system)
        if (enemy.takeDamage) {
            enemy.takeDamage(damagePerTick);
        } else if (enemy.health !== undefined) {
            enemy.health -= damagePerTick;
        }

        tickCount++;
    }, 500);
}

function triggerStunEffect(ctx: any, enemy: any): void {
    // Stun enemy for 1 second with fire effect
    if (!enemy) return;

    const stunDuration = 1000; // 1 second
    const hero = ctx.hero;
    
    // Spawn fire stun VFX at enemy position
    triggerVfx("amulet_embers_vfx", {
        x: enemy.x,
        y: enemy.y,
        lifespanMs: stunDuration
    });
    
    // Spawn orange weapon visual at hero
    if (hero) {
        triggerVfx("amulet_weapon_embers", {
            x: hero.x,
            y: hero.y - 30,
            lifespanMs: 600
        });
    }
    
    // Apply stun status to disable enemy actions
    applyStun(enemy, stunDuration);
}

function triggerExplosionEffect(ctx: any, enemy: any): void {
    // Create explosion with fire visual and knockback
    if (!enemy) return;

    const explosionRadius = 60; // pixels
    const knockbackForce = 2.5; // pixels per frame
    const knockbackDuration = 400; // milliseconds
    const centerX = enemy.x;
    const centerY = enemy.y;
    
    // Spawn explosion VFX at enemy position
    triggerVfx("amulet_embers_vfx", {
        x: centerX,
        y: centerY,
        lifespanMs: 600
    });

    // Spawn orange weapon visual at hit location.
    triggerVfx("amulet_weapon_embers", {
        x: centerX,
        y: centerY - 30,
        lifespanMs: 600
    });
    
    // Get all enemies near explosion center and knock them back
    const enemiesInRadius = getEnemiesInRadius(centerX, centerY, explosionRadius);
    for (const nearbyEnemy of enemiesInRadius) {
        // Apply knockback away from explosion center
        applyKnockbackFrom(nearbyEnemy, centerX, centerY, knockbackForce, knockbackDuration);
    }
}

function triggerPoisonEffect(ctx: any, enemy: any, state: VenomState): void {
    // Poison enemy for 2% of their health per 0.5 seconds for 1.5 seconds
    // Total damage: 2% * 3 ticks = 6% of enemy health
    // Non-refreshable until done poisoning
    // Also reduces defense and attack by 5%, caps at 20% (lasts 4.5-5 seconds)
    if (!enemy) return;

    const enemyMaxHealth = enemy.maxHealth || enemy.health || 100;
    const damagePerTick = (enemyMaxHealth * 0.02);
    const totalTicks = 3; // 1.5 seconds / 0.5 seconds = 3 ticks
    let tickCount = 0;

    const hero = ctx.hero;
    
    // Spawn poison VFX on enemy
    triggerVfx("amulet_venom_vfx", {
        x: enemy.x,
        y: enemy.y,
        lifespanMs: 1500
    });
    
    // Spawn purple weapon visual at hero
    if (hero) {
        triggerVfx("amulet_weapon_venom", {
            x: hero.x,
            y: hero.y - 30,
            lifespanMs: 600
        });
    }

    const poisonInterval = setInterval(() => {
        if (tickCount >= totalTicks || !enemy) {
            clearInterval(poisonInterval);
            // Remove from poisoned set when poison effect ends
            state.poisonedEnemies.delete(enemy);
            return;
        }
        
        // Apply damage (would integrate with actual game damage system)
        if (enemy.takeDamage) {
            enemy.takeDamage(damagePerTick);
        } else if (enemy.health !== undefined) {
            enemy.health -= damagePerTick;
        }

        tickCount++;
    }, 500);

    // Apply defense and attack debuff (stack up to 20% reduction)
    applyPoisonDebuff(enemy, state);
}

function applyPoisonDebuff(enemy: any, state: VenomState): void {
    // Each poison reduces defense and attack by 5%, caps at 20%
    if (!enemy) return;

    let debuff = state.enemyDebuffs.get(enemy);
    const now = Date.now();
    const debuffDuration = 4500 + Math.random() * 500; // 4.5-5 seconds

    if (!debuff) {
        debuff = {
            defenseReduction: 0,
            attackReduction: 0,
            debuffEndTime: now + debuffDuration,
        };
    }

    // Stack reduction up to 20% cap (5% per application)
    if (debuff.defenseReduction < 20) {
        debuff.defenseReduction = Math.min(20, debuff.defenseReduction + 5);
        debuff.attackReduction = debuff.defenseReduction; // Both reduced equally
    }

    // Update end time (extend duration on reapplication)
    debuff.debuffEndTime = now + debuffDuration;
    state.enemyDebuffs.set(enemy, debuff);

    // Apply weaken status to reduce enemy attack output
    setEnemyWeaken(enemy, debuff.attackReduction, debuffDuration | 0, now | 0);
}

function triggerPoisonAreaEffect(ctx: any, anchorEnemy: any): void {
    // Create area that slows and damages enemies inside (Cooldown: 5 seconds).
    // Area is created at the crystal-hit location.
    const hero = ctx.hero;
    if (!hero || !hero.scene || !anchorEnemy) return;

    const centerX = anchorEnemy.x;
    const centerY = anchorEnemy.y;
    const areaRadius = 90; // pixels
    const slowDuration = 3000; // 3 seconds
    const slowAmount = 40; // 40% slow
    const areaDuration = 4000; // area persists for 4 seconds
    const damageTickInterval = 500; // damage every 0.5 seconds
    let tickCount = 0;
    const maxTicks = Math.floor(areaDuration / damageTickInterval); // 8 ticks
    
    // Spawn purple weapon visual at hit location.
    triggerVfx("amulet_weapon_venom", {
        x: centerX,
        y: centerY - 30,
        lifespanMs: 600
    });

    // Spawn poison cloud visual centered on the hit location.
    triggerVfx("amulet_venom_vfx", {
        x: centerX,
        y: centerY,
        lifespanMs: areaDuration
    });

    // Apply poison area effect over duration
    const areaInterval = setInterval(() => {
        if (tickCount >= maxTicks) {
            clearInterval(areaInterval);
            return;
        }

        const enemiesInArea = getEnemiesInRadius(centerX, centerY, areaRadius);
        for (const enemy of enemiesInArea) {
            // Apply slow to each enemy in the area
            setEnemySlow(enemy, slowAmount, slowDuration | 0, Date.now() | 0);
            
            // Apply poison damage
            if (enemy && (enemy.takeDamage || enemy.health !== undefined)) {
                const enemyMaxHealth = enemy.maxHealth || enemy.health || 100;
                const damagePerTick = (enemyMaxHealth * 0.02);
                if (enemy.takeDamage) {
                    enemy.takeDamage(damagePerTick);
                } else {
                    enemy.health -= damagePerTick;
                }
            }
        }

        tickCount++;
    }, damageTickInterval);
}

function triggerKnockbackEffect(ctx: any): void {
    // Knock back enemies in 360 degree radius around player
    // Small radius, all around the player
    const hero = ctx.hero;
    if (!hero || !hero.scene) return;

    const knockbackRadius = 80; // pixels
    const knockbackDuration = 300; // milliseconds
    const knockbackForce = 3; // pixels per frame
    
    // Spawn shockwave VFX at hero position
    triggerVfx("amulet_stones_vfx", {
        x: hero.x,
        y: hero.y,
        lifespanMs: 600
    });
    
    // Spawn brown-tinted weapon visual
    triggerVfx("amulet_weapon_stones", {
        x: hero.x,
        y: hero.y - 30, // Offset up slightly so it's more visible
        lifespanMs: 600
    });
    
    // Get all enemies in knockback radius
    const enemiesInRadius = getEnemiesInRadius(hero.x, hero.y, knockbackRadius);
    for (const enemy of enemiesInRadius) {
        // Apply knockback away from hero center
        applyKnockbackFrom(enemy, hero.x, hero.y, knockbackForce, knockbackDuration);
    }
}

function triggerRockDropEffect(ctx: any, enemy: any): void {
    // Drop rock on enemy: stun for 2 seconds and deal extra damage
    if (!enemy) return;
    const stunDuration = 2000;
    const centerX = enemy.x;
    const centerY = enemy.y;
    
    // Spawn rock impact VFX at enemy position
    triggerVfx("amulet_stones_vfx", {
        x: centerX,
        y: centerY,
        lifespanMs: 800
    });

    // Spawn brown weapon visual at hit location.
    triggerVfx("amulet_weapon_stones", {
        x: centerX,
        y: centerY - 30,
        lifespanMs: 600
    });
    
    // Apply stun status to enemy (disable movement/actions for 2 seconds)
    applyStun(enemy, stunDuration);
}

export default setupAmuletEffects;
