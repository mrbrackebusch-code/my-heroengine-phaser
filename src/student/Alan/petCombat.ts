import type { StudentApi } from "../../studentApi";
import { registerPetBehavior, getPetStats } from "../../studentSystemsHooks";

/**
 * Pet Combat System for Alan
 * 
 * Mechanics:
 * - Pet deals independent damage to enemies based on its attack stat
 * - Attack cooldown prevents spam; scales with pet stats
 * - Damage variance (randomness) for combat feel
 * - Pet retreats at 30% HP (handled in petBehavior.ts)
 * - Combat hooks integrate with core battle system
 */

// ============================================================================
// DAMAGE CALCULATION
// ============================================================================

export type PetAttackContext = {
    pet: any;           // Runtime pet sprite/entity
    petId: string;      // Pet definition ID
    petStats: any;      // Pet stats object (baseAtk, growthAtk, etc.)
    currentLevel: number; // Pet level (1-10 default)
    enemy: any;         // Target enemy
    now?: number;       // Current timestamp
    scene?: any;        // Phaser scene
    variance?: number;  // Damage variance 0.0-1.0
};

/**
 * Calculate base damage from pet attack stat.
 * Formula: baseAtk + (growthAtk * (level - 1)) + variance
 * Pet damage is intentionally low—player is primary damage dealer.
 * Pet is a *support* companion, not a solo threat.
 */
export function calculatePetDamage(ctx: PetAttackContext): number {
    const stats = ctx.petStats || { baseAtk: 6, growthAtk: 1 };
    const level = Math.max(1, Math.min(10, ctx.currentLevel || 1));
    
    // Low base damage (3 instead of 6) + modest growth
    // At level 1: ~3 damage. At level 10: ~12 damage.
    // Pet deals supplementary damage; player is main threat.
    const baseDmg = (stats.baseAtk || 3) * 0.5 + ((stats.growthAtk || 1) * (level - 1));
    
    // Variance: ±20% damage
    const variance = ctx.variance ?? 0.2;
    const randomMult = 1 - variance + Math.random() * (variance * 2);
    const final = Math.max(1, Math.floor(baseDmg * randomMult));
    
    return final;
}

/**
 * Calculate attack cooldown from pet stats.
 * Lower attack stat = longer cooldown (risk/reward).
 * Pet attacks slowly to be a *support* damage dealer, not primary threat.
 */
export function calculateAttackCooldown(ctx: PetAttackContext): number {
    const stats = ctx.petStats || { baseAtk: 6 };
    const level = Math.max(1, Math.min(10, ctx.currentLevel || 1));
    
    // Base cooldown: 3000ms (3 sec), reduced by 100ms per attack point
    // At level 1: ~2500ms (pet attacks every 2.5 sec, supporting not soloing)
    const baseCooldown = 3000;
    const reduction = (stats.baseAtk || 6) * 100;
    const cooldownMs = Math.max(1000, baseCooldown - reduction - (level * 50));
    
    return cooldownMs;
}

// ============================================================================
// ATTACK STATE & COOLDOWN TRACKING
// ============================================================================

/**
 * Initialize pet combat state (cooldown, last attack time, etc.).
 */
export function initPetCombatState(pet: any): void {
    if (!pet) return;
    pet.__alanCombat = {
        lastAttackTime: 0,
        attackCooldownMs: 1500,
        isAttacking: false,
        totalDamageDealt: 0,
        attackCount: 0,
    };
}

/**
 * Check if pet can attack (cooldown ready).
 */
export function canPetAttack(pet: any, now: number = Date.now()): boolean {
    if (!pet || !pet.__alanCombat) return false;
    const lastAttack = pet.__alanCombat.lastAttackTime || 0;
    const cooldown = pet.__alanCombat.attackCooldownMs || 1500;
    return (now - lastAttack) >= cooldown;
}

/**
 * Record pet attack and update cooldown.
 */
export function recordPetAttack(
    pet: any,
    damageDealt: number,
    now: number = Date.now()
): void {
    if (!pet || !pet.__alanCombat) return;
    pet.__alanCombat.lastAttackTime = now;
    pet.__alanCombat.totalDamageDealt = (pet.__alanCombat.totalDamageDealt || 0) + damageDealt;
    pet.__alanCombat.attackCount = (pet.__alanCombat.attackCount || 0) + 1;
}

// ============================================================================
// COMBAT BEHAVIOR REGISTRATION
// ============================================================================

/**
 * Setup pet combat behaviors and attack callbacks.
 * This registers the pet to participate in the core combat loop.
 */
export function setupPetCombat(api: StudentApi): void {
    const petId = api.key("wisp_pet");
    const petBehaviorId = api.key("wisp_combat_behavior");

    registerPetBehavior({
        id: petBehaviorId,
        petId,
        
        onSpawn: (ctx: any) => {
            // Initialize combat state
            if (ctx && ctx.pet) {
                initPetCombatState(ctx.pet);
                // Load pet stats for damage calculation
                const petStats = getPetStats(petId);
                if (petStats) {
                    ctx.pet.__alanPetStats = petStats;
                    ctx.pet.__alanCombat.attackCooldownMs = calculateAttackCooldown({
                        pet: ctx.pet,
                        petId,
                        petStats,
                        currentLevel: ctx.pet.level || 1,
                        enemy: null, // Cooldown calc doesn't need enemy
                        scene: ctx.scene,
                    });
                }
            }
        },

        onUpdate: (ctx: any) => {
            if (!ctx || !ctx.pet || !ctx.scene) return;
            const now = ctx.now || Date.now();
            
            // Skip if pet is retreated/wounded
            const state = ctx.pet.__alanState || { retreating: false, wounded: false };
            if (state.retreating || state.wounded) return;
            
            // Check if pet can attack and has a valid target
            if (canPetAttack(ctx.pet, now)) {
                const enemies = _findNearbyEnemies(ctx.pet, ctx.scene);
                if (enemies && enemies.length > 0) {
                    const target = enemies[0]; // Attack closest
                    _executePetAttack(ctx.pet, target, ctx);
                }
            }
        },

        onDamage: (ctx: any) => {
            // Damage handler already in petBehavior.ts
            // Can add combat-specific reactions here if needed
        },

        onHeal: (ctx: any) => {
            // Reset attack state on heal if desired
            if (ctx && ctx.pet && ctx.pet.__alanCombat) {
                ctx.pet.__alanCombat.isAttacking = false;
            }
        },
    });
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Find nearby enemies for the pet to target.
 * TODO: This is a stub; core system integration needed to access enemies.
 * See AlanNeeds.md for hooks required.
 * 
 * ASSUMPTIONS (awaiting maintainer confirmation):
 * - scene.data.get('enemies') returns array of active enemy sprites, OR
 * - scene.registry.get('enemies') returns array of active enemy sprites
 * - Enemies have .x, .y, .active, .hp (or .currentHp) properties
 */
function _findNearbyEnemies(pet: any, scene: any): any[] {
    if (!pet || !scene) return [];
    
    const petX = pet.x || 0;
    const petY = pet.y || 0;
    const searchRadius = 200; // pixels
    
    // Try multiple enemy access patterns
    let enemies: any[] = [];
    
    try {
        // Pattern 1: scene.data.get('enemies')
        if (typeof scene.data?.get === 'function') {
            const candidates = scene.data.get('enemies');
            if (Array.isArray(candidates)) {
                enemies = candidates;
            }
        }
    } catch (e) {}
    
    // Pattern 2: scene.registry.get('enemies')
    if (!enemies || enemies.length === 0) {
        try {
            if (scene.registry && typeof scene.registry.get === 'function') {
                const candidates = scene.registry.get('enemies');
                if (Array.isArray(candidates)) {
                    enemies = candidates;
                }
            }
        } catch (e) {}
    }
    
    // Filter: active, alive, within range
    const nearby = enemies
        .filter((e: any) => {
            if (!e) return false;
            if (e.active === false) return false;
            const hp = e.hp || e.currentHp || 0;
            if (hp <= 0) return false;
            const dist = Math.hypot((e.x || 0) - petX, (e.y || 0) - petY);
            return dist <= searchRadius;
        })
        .sort((a: any, b: any) => {
            // Sort by distance (closest first)
            const distA = Math.hypot((a.x || 0) - petX, (a.y || 0) - petY);
            const distB = Math.hypot((b.x || 0) - petX, (b.y || 0) - petY);
            return distA - distB;
        });
    
    return nearby;
}

/**
 * Execute a pet attack on target.
 * 
 * ASSUMPTIONS (awaiting maintainer confirmation):
 * - target.takeDamage(dmg) OR target.damage(dmg) OR reduce target.hp directly
 * - target.hp or target.currentHp indicates health
 */
function _executePetAttack(pet: any, target: any, ctx: any): void {
    if (!pet || !target) return;
    
    const now = ctx.now || Date.now();
    
    // Calculate damage
    const petStats = pet.__alanPetStats || { baseAtk: 6, growthAtk: 1 };
    const dmg = calculatePetDamage({
        pet,
        petId: "student.alan.wisp_pet",
        petStats,
        currentLevel: pet.level || 1,
        enemy: target,
        now,
        scene: ctx.scene,
        variance: 0.2,
    });
    
    // Apply damage to target (try multiple methods for compatibility)
    let damageApplied = false;
    
    if (typeof target.takeDamage === 'function') {
        try {
            target.takeDamage(dmg);
            damageApplied = true;
        } catch (e) {}
    }
    
    if (!damageApplied && typeof target.damage === 'function') {
        try {
            target.damage(dmg);
            damageApplied = true;
        } catch (e) {}
    }
    
    if (!damageApplied) {
        // Fallback: direct HP manipulation
        try {
            const currentHp = target.hp != null ? target.hp : (target.currentHp || 0);
            target.hp = Math.max(0, currentHp - dmg);
            damageApplied = true;
        } catch (e) {}
    }
    
    // Record attack regardless of application success (for stats)
    recordPetAttack(pet, dmg, now);
    
    // Check if enemy is defeated (hp <= 0)
    const enemyHp = target.hp != null ? target.hp : (target.currentHp || 0);
    if (enemyHp <= 0) {
        _onEnemyDefeated(pet, target, ctx);
    }
    
    // TODO: Play attack animation (once Lourdes provides sprites)
    // if (pet.play && pet.__alanAnimKey?.attack) {
    //     pet.play(pet.__alanAnimKey.attack);
    // }
}

/**
 * Called when the pet defeats an enemy.
 * Triggers XP gain and progression hooks (Elizabeth's domain).
 */
function _onEnemyDefeated(pet: any, enemy: any, ctx: any): void {
    if (!pet) return;
    
    // Sanity check: ensure enemy is actually defeated
    const enemyHp = enemy?.hp != null ? enemy.hp : (enemy?.currentHp || 0);
    if (enemyHp > 0) return;
    
    // Calculate XP reward
    const xpReward = _calculateXpReward(enemy);
    
    // Track in pet's XP gains array (for debugging/stats)
    if (!pet.__alanXpGains) {
        pet.__alanXpGains = [];
    }
    pet.__alanXpGains.push({
        timestamp: ctx.now || Date.now(),
        enemyId: enemy?.id || "unknown",
        enemyType: enemy?.type || "enemy",
        xpAmount: xpReward,
    });
    
    // Call registered XP hook (Elizabeth's implementation)
    if (typeof _petXpGainHook === 'function') {
        try {
            _petXpGainHook({
                pet,
                petId: "student.alan.wisp_pet",
                xpAmount: xpReward,
                enemyId: enemy?.id,
                enemyType: enemy?.type,
                scene: ctx.scene,
                now: ctx.now,
            });
        } catch (e) {
            // Silently fail; don't crash combat if XP hook has issues
        }
    }
}

/**
 * Calculate XP reward from defeated enemy.
 * Simple formula: baseXp varies by enemy type/level.
 * TODO: Elizabeth will enhance this with difficulty scaling.
 */
function _calculateXpReward(enemy: any): number {
    // Placeholder: 25 XP base, more for stronger enemies
    const baseXp = 25;
    const levelMultiplier = (enemy.level || 1) * 5;
    return Math.max(10, baseXp + levelMultiplier);
}

// ============================================================================
// XP PROGRESSION HOOK
// ============================================================================

/**
 * Global hook for XP progression.
 * Elizabeth's petProgression.ts will set this.
 */
export type PetXpGainContext = {
    pet: any;
    petId: string;
    xpAmount: number;
    enemyId?: string;
    enemyType?: string;
    scene?: any;
    now?: number;
};

let _petXpGainHook: ((ctx: PetXpGainContext) => void) | null = null;

/**
 * Register XP gain hook (called by petProgression.ts).
 */
export function registerPetXpGainHook(hook: (ctx: PetXpGainContext) => void): void {
    _petXpGainHook = hook;
}

/**
 * Get current XP hook (for testing/debugging).
 */
export function getPetXpGainHook(): typeof _petXpGainHook {
    return _petXpGainHook;
}

/**
 * Simple distance check (Euclidean).
 */
function _distTo(a: any, b: any): number {
    if (!a || !b) return Infinity;
    const dx = (a.x || 0) - (b.x || 0);
    const dy = (a.y || 0) - (b.y || 0);
    return Math.hypot(dx, dy);
}

export default setupPetCombat;
