import type { StudentApi } from "../../studentApi";
import { registerStudentRelicEffectHandler } from "../../studentSystemsHooks";
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
};

const tidesStateMap = new WeakMap<any, TidesState>();
const zephyrsStateMap = new WeakMap<any, ZephyrsState>();
const embersStateMap = new WeakMap<any, EmbersState>();
const venomStateMap = new WeakMap<any, VenomState>();
const stonesStateMap = new WeakMap<any, StonesState>();

function getTidesState(hero: any): TidesState {
    if (!tidesStateMap.has(hero)) {
        tidesStateMap.set(hero, {
            strengthMoveCount: 0,
            lastTideTime: 0,
            lastBubbleTime: 0,
        });
    }
    return tidesStateMap.get(hero)!;
}

function getZephyrsState(hero: any): ZephyrsState {
    if (!zephyrsStateMap.has(hero)) {
        zephyrsStateMap.set(hero, {
            lastTornadoTime: 0,
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
        });
    }
    return venomStateMap.get(hero)!;
}

function getStonesState(hero: any): StonesState {
    if (!stonesStateMap.has(hero)) {
        stonesStateMap.set(hero, {
            lastKnockbackTime: 0,
            lastRockDropTime: 0,
        });
    }
    return stonesStateMap.get(hero)!;
}

export function setupAmuletEffects(api: StudentApi): void {
    registerStudentRelicEffectHandler({
        effectKey: "amulet_tides_effect",

        modifyMoveSpeed(ctx: any) {
            // Increase move speed by 15%
            if (ctx.hero && ctx.stats) {
                ctx.stats.speed = (ctx.stats.speed || 0) * 1.15;
            }
        },

        modifyMoveStats(ctx: any) {
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
            }

            // Handle Intelligence moves (trap enemies with bubbles)
            if (move.family === "intelligence") {
                const cooldownElapsed = now - state.lastBubbleTime >= 7000;
                if (cooldownElapsed) {
                    state.lastBubbleTime = now;
                    triggerBubbleEffect(ctx);
                }
            }
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
            // Handle Strength moves (increase their speed by 5%)
            const move = ctx.move;
            if (move && move.family === "strength") {
                if (ctx.stats) {
                    ctx.stats.speed = (ctx.stats.speed || 0) * 1.05;
                }
            }

            // Handle Intelligence moves (create tornado that pulls enemies)
            if (move && move.family === "intelligence") {
                const hero = ctx.hero;
                if (!hero) return;

                const state = getZephyrsState(hero);
                const now = Date.now();

                // Tornado with 6 second cooldown
                if (now - state.lastTornadoTime >= 6000) {
                    state.lastTornadoTime = now;
                    triggerTornadoEffect(ctx);
                }
            }
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
            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getEmbersState(hero);
            const now = Date.now();

            // Handle Strength moves
            if (move.family === "strength") {
                state.strengthMoveCount++;

                // Apply burn to hit enemies (if not already burning)
                if (ctx.hitEnemies && Array.isArray(ctx.hitEnemies)) {
                    for (const enemy of ctx.hitEnemies) {
                        if (enemy && !state.burnedEnemies.has(enemy)) {
                            state.burnedEnemies.add(enemy);
                            triggerBurnEffect(ctx, enemy);
                        }
                    }
                }

                // Every 3 Strength moves, apply stun (with 7s cooldown)
                if (state.strengthMoveCount >= 3 && now - state.lastStunTime >= 7000) {
                    state.strengthMoveCount = 0;
                    state.lastStunTime = now;
                    if (ctx.hitEnemies && Array.isArray(ctx.hitEnemies)) {
                        for (const enemy of ctx.hitEnemies) {
                            triggerStunEffect(ctx, enemy);
                        }
                    }
                }
            }

            // Handle Intelligence moves (create explosion when enemies are hit)
            if (move.family === "intelligence") {
                if (ctx.hitEnemies && Array.isArray(ctx.hitEnemies)) {
                    for (const enemy of ctx.hitEnemies) {
                        triggerExplosionEffect(ctx, enemy);
                    }
                }
            }
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
            const hero = ctx.hero;
            const move = ctx.move;
            
            if (!hero || !move) return;

            const state = getVenomState(hero);
            const now = Date.now();

            // Handle Strength moves (apply poison)
            if (move.family === "strength") {
                if (ctx.hitEnemies && Array.isArray(ctx.hitEnemies)) {
                    for (const enemy of ctx.hitEnemies) {
                        if (enemy && !state.poisonedEnemies.has(enemy)) {
                            state.poisonedEnemies.add(enemy);
                            triggerPoisonEffect(ctx, enemy, state);
                        }
                    }
                }
            }

            // Handle Intelligence moves (create poison area)
            if (move.family === "intelligence") {
                if (now - state.lastPoisonAreaTime >= 5000) {
                    state.lastPoisonAreaTime = now;
                    triggerPoisonAreaEffect(ctx);
                }
            }
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
            }

            // Handle Intelligence moves (drop rock to stun and damage)
            if (move.family === "intelligence") {
                if (now - state.lastRockDropTime >= 12000) {
                    state.lastRockDropTime = now;
                    if (ctx.hitEnemies && Array.isArray(ctx.hitEnemies)) {
                        for (const enemy of ctx.hitEnemies) {
                            triggerRockDropEffect(ctx, enemy);
                        }
                    }
                }
            }
        },
    });
}

function triggerTideEffect(ctx: any): void {
    // Push enemies back effect
    // This would typically interact with the combat system to push all nearby enemies
    // For now, we document the intent; actual VFX implementation can use ctx.api.vfx
    const hero = ctx.hero;
    if (hero && hero.scene) {
        // TODO: Implement tide visual effect and enemy knockback
        // Asset: Water 150x150.png (assets/effects/otherEffects/cool spells not used yet)
        // Spawn water wave expanding from hero position with knockback force
    }
}

function triggerBubbleEffect(ctx: any): void {
    // Trap enemies with bubbles for 2.5 seconds
    // This would typically apply a status effect to nearby enemies
    const hero = ctx.hero;
    if (hero && hero.scene) {
        // TODO: Implement bubble visual effect and trap status (slow/stun for 2.5s)
        // Asset: Water 150x150.png (assets/effects/otherEffects/cool spells not used yet)
        // Spawn bubble at target enemy position, apply slow/stun status
    }
}

function triggerTornadoEffect(ctx: any): void {
    // Create a small tornado that pulls enemies to center
    // This would typically create a vortex VFX and apply pull forces to nearby enemies
    const hero = ctx.hero;
    if (hero && hero.scene) {
        const tornadoRadius = 100; // pixels
        const pullForce = 4; // pixels per frame
        const pullDuration = 800; // milliseconds
        
        const enemiesInRadius = getEnemiesInRadius(hero.x, hero.y, tornadoRadius);
        for (const enemy of enemiesInRadius) {
            // Pull enemies toward hero center (tornado vortex)
            applyKnockbackFrom(enemy, hero.x, hero.y, pullForce, pullDuration);
        }
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

    // TODO: Implement burn visual effect (flame particles/glow on enemy)
}

function triggerStunEffect(ctx: any, enemy: any): void {
    // Stun enemy for 1 second
    if (!enemy) return;

    // TODO: Implement stun visual effect and disable enemy actions for 1 second
    // Could apply a status effect or animation freeze to the enemy
}

function triggerExplosionEffect(ctx: any, enemy: any): void {
    // Create small explosion when enemies are hit by intelligence move
    if (!enemy) return;

    // TODO: Implement explosion visual effect at enemy location
    // Could trigger a VFX and apply knockback to nearby enemies
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

    // TODO: Implement poison visual effect (purple particles/glow on enemy)
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

function triggerPoisonAreaEffect(ctx: any): void {
    // Create area that slows and damages enemies inside (Cooldown: 5 seconds)
    // Area is created centered on hero position
    const hero = ctx.hero;
    if (!hero || !hero.scene) return;

    const areaRadius = 90; // pixels
    const slowDuration = 3000; // 3 seconds
    const slowAmount = 40; // 40% slow
    const areaDuration = 4000; // area persists for 4 seconds
    const damageTickInterval = 500; // damage every 0.5 seconds
    let tickCount = 0;
    const maxTicks = Math.floor(areaDuration / damageTickInterval); // 8 ticks

    // Apply poison area effect over duration
    const areaInterval = setInterval(() => {
        if (tickCount >= maxTicks) {
            clearInterval(areaInterval);
            return;
        }

        const enemiesInArea = getEnemiesInRadius(hero.x, hero.y, areaRadius);
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
    
    // Get all enemies in knockback radius
    const enemiesInRadius = getEnemiesInRadius(hero.x, hero.y, knockbackRadius);
    for (const enemy of enemiesInRadius) {
        // Apply knockback away from hero center
        applyKnockbackFrom(enemy, hero.x, hero.y, knockbackForce, knockbackDuration);
    }

    // TODO: Implement visual effect (shockwave/earth rupture around hero)
    }
}

function triggerRockDropEffect(ctx: any, enemy: any): void {
    // Drop rock on enemy: stun for 2 seconds and deal extra damage
    
    // Apply stun status to enemy (disable movement/actions for 2 seconds)
    applyStun(enemy, stunDuration);

    // TODO: Implement rock visual effect (stone falling, impact animation)
    // TODO: Deal extra damage on impact
}

export default setupAmuletEffects;
