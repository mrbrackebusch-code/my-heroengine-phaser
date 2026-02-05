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
 */
export function calculatePetDamage(ctx: PetAttackContext): number {
    const stats = ctx.petStats || { baseAtk: 6, growthAtk: 1 };
    const level = Math.max(1, Math.min(10, ctx.currentLevel || 1));
    const baseDmg = (stats.baseAtk || 6) + ((stats.growthAtk || 1) * (level - 1));
    
    // Variance: ±20% damage
    const variance = ctx.variance ?? 0.2;
    const randomMult = 1 - variance + Math.random() * (variance * 2);
    const final = Math.max(1, Math.floor(baseDmg * randomMult));
    
    return final;
}

/**
 * Calculate attack cooldown from pet stats.
 * Lower attack stat = longer cooldown (risk/reward).
 */
export function calculateAttackCooldown(ctx: PetAttackContext): number {
    const stats = ctx.petStats || { baseAtk: 6 };
    const level = Math.max(1, Math.min(10, ctx.currentLevel || 1));
    
    // Base cooldown: 1500ms, reduced by 50ms per attack point
    const baseCooldown = 1500;
    const reduction = (stats.baseAtk || 6) * 50;
    const cooldownMs = Math.max(300, baseCooldown - reduction - (level * 20));
    
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
 */
function _findNearbyEnemies(pet: any, scene: any): any[] {
    if (!scene) return [];
    
    // Placeholder: try to access enemies via scene globals or registry
    try {
        // Option 1: scene.data.get('enemies') or similar
        if (typeof scene.data?.get === 'function') {
            const enemies = scene.data.get('enemies');
            if (Array.isArray(enemies)) {
                return enemies.filter((e: any) => e && e.active && _distTo(pet, e) < 200);
            }
        }
        
        // Option 2: scene registry
        if (scene.registry && typeof scene.registry.get === 'function') {
            const enemies = scene.registry.get('enemies');
            if (Array.isArray(enemies)) {
                return enemies.filter((e: any) => e && e.active && _distTo(pet, e) < 200);
            }
        }
    } catch (e) {}
    
    return [];
}

/**
 * Execute a pet attack on target.
 */
function _executePetAttack(pet: any, target: any, ctx: any): void {
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
    
    // Apply damage to target
    if (typeof target.takeDamage === 'function') {
        target.takeDamage(dmg);
    } else if (typeof target.damage === 'function') {
        target.damage(dmg);
    } else {
        target.hp = Math.max(0, (target.hp || 0) - dmg);
    }
    
    // Record attack
    recordPetAttack(pet, dmg, now);
    
    // TODO: Play attack animation (once sprites available)
    // if (pet.play && pet.__alanAnimKey) pet.play(pet.__alanAnimKey.attack);
}

/**
 * Simple distance check.
 */
function _distTo(a: any, b: any): number {
    const dx = (a.x || 0) - (b.x || 0);
    const dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

export default setupPetCombat;
