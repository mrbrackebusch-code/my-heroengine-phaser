/**
 * amuletUtils.ts - Safe student-facing wrappers for enemy interactions
 * 
 * These functions provide a clean, type-safe surface for student amulet effects
 * to apply status effects, damage, and knockback without directly manipulating
 * sprite data structures.
 */

/**
 * Apply slow effect to an enemy.
 * 
 * @param enemy Enemy sprite object
 * @param slowPct Slow percentage (0-100, e.g., 30 = 30% slower)
 * @param durationMs How long the slow lasts in milliseconds
 * @param now Current game time (optional, defaults to Date.now())
 */
export function setEnemySlow(enemy: any, slowPct: number, durationMs: number, now?: number): void {
    if (!enemy) return;
    
    const currentTime = now || (Date.now() | 0);
    const endTime = (currentTime + durationMs) | 0;
    const pct = Math.max(0, Math.min(100, slowPct | 0));
    
    try {
        // Update sprite data (assuming ENEMY_DATA.SLOW_PCT and SLOW_UNTIL exist)
        const sprites = (globalThis as any).sprites;
        if (sprites && sprites.setDataNumber) {
            sprites.setDataNumber(enemy, "slowPct", pct);
            sprites.setDataNumber(enemy, "slowUntil", endTime);
        }
    } catch (e) {
        console.error("[AMULET][SLOW][ERROR]", e);
    }
}

/**
 * Apply weaken effect to an enemy (reduces damage output).
 * 
 * @param enemy Enemy sprite object
 * @param weakenPct Weaken percentage (0-100, e.g., 20 = 20% less damage)
 * @param durationMs How long the weaken lasts in milliseconds
 * @param now Current game time (optional)
 */
export function setEnemyWeaken(enemy: any, weakenPct: number, durationMs: number, now?: number): void {
    if (!enemy) return;
    
    const currentTime = now || (Date.now() | 0);
    const endTime = (currentTime + durationMs) | 0;
    const pct = Math.max(0, Math.min(100, weakenPct | 0));
    
    try {
        const sprites = (globalThis as any).sprites;
        if (sprites && sprites.setDataNumber) {
            sprites.setDataNumber(enemy, "weakPct", pct);
            sprites.setDataNumber(enemy, "weakUntil", endTime);
        }
    } catch (e) {
        console.error("[AMULET][WEAKEN][ERROR]", e);
    }
}

/**
 * Apply knockback velocity to an enemy.
 * 
 * @param enemy Enemy sprite object
 * @param vx Velocity in X direction (pixels per frame)
 * @param vy Velocity in Y direction (pixels per frame)
 * @param durationMs How long to apply knockback (enemy will stop afterward)
 * @param now Current game time (optional)
 */
export function applyKnockback(enemy: any, vx: number, vy: number, durationMs: number, now?: number): void {
    if (!enemy) return;
    
    const currentTime = now || (Date.now() | 0);
    const endTime = (currentTime + durationMs) | 0;
    
    try {
        const sprites = (globalThis as any).sprites;
        if (sprites && sprites.setDataNumber) {
            // Set velocity
            enemy.vx = vx;
            enemy.vy = vy;
            // Store end time so core can clear velocity when knockback expires
            sprites.setDataNumber(enemy, "kbUntil", endTime);
        }
    } catch (e) {
        console.error("[AMULET][KNOCKBACK][ERROR]", e);
    }
}

/**
 * Apply knockback from a source point.
 * Calculates direction and magnitude automatically.
 * 
 * @param enemy Enemy sprite object
 * @param sourceX Origin X position
 * @param sourceY Origin Y position
 * @param forceMultiplier Force strength (recommend 2-5)
 * @param durationMs How long to apply knockback
 * @param now Current game time (optional)
 */
export function applyKnockbackFrom(enemy: any, sourceX: number, sourceY: number, forceMultiplier: number, durationMs: number, now?: number): void {
    if (!enemy) return;
    
    const dx = enemy.x - sourceX;
    const dy = enemy.y - sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    
    const force = forceMultiplier || 2;
    const vx = nx * force;
    const vy = ny * force;
    
    applyKnockback(enemy, vx, vy, durationMs, now);
}

/**
 * Apply stun effect to an enemy (stops movement/actions).
 * 
 * Note: This is a placeholder for future stun implementation.
 * Currently stores stun duration in a custom field.
 * 
 * @param enemy Enemy sprite object
 * @param durationMs How long the stun lasts in milliseconds
 * @param now Current game time (optional)
 */
export function applyStun(enemy: any, durationMs: number, now?: number): void {
    if (!enemy) return;
    
    const currentTime = now || (Date.now() | 0);
    const endTime = (currentTime + durationMs) | 0;
    
    try {
        const sprites = (globalThis as any).sprites;
        if (sprites && sprites.setDataNumber) {
            // Store stun end time; core should check this and disable enemy actions
            sprites.setDataNumber(enemy, "stunUntil", endTime);
        }
    } catch (e) {
        console.error("[AMULET][STUN][ERROR]", e);
    }
}

/**
 * Apply damage to an enemy.
 * Safe wrapper around core damage function.
 * 
 * @param eIndex Enemy index (from getEnemyIndex)
 * @param damage Damage amount
 * @param sourceHeroIndex Hero dealing damage (optional, -1 = environment)
 * @param hitPacket Additional hit properties (element, knockback, etc.)
 */
export function applyDamageToEnemy(eIndex: number, damage: number, sourceHeroIndex?: number, hitPacket?: any): void {
    try {
        // Access core damage function via globalThis hook
        const HE = (globalThis as any).HeroEngine;
        if (HE && typeof HE.applyDamageToEnemyIndex === "function") {
            HE.applyDamageToEnemyIndex(eIndex, damage | 0, sourceHeroIndex ?? -1, hitPacket);
        }
    } catch (e) {
        console.error("[AMULET][DAMAGE][ERROR]", e);
    }
}

/**
 * Get enemy by index from the engine's enemy list.
 * 
 * @param eIndex Enemy index
 * @returns Enemy sprite or null if not found
 */
export function getEnemyByIndex(eIndex: number): any {
    try {
        const HE = (globalThis as any).HeroEngine;
        if (HE && Array.isArray(HE.enemies)) {
            return HE.enemies[eIndex] || null;
        }
    } catch (e) {
        console.error("[AMULET][GET_ENEMY][ERROR]", e);
    }
    return null;
}

/**
 * Get all enemies currently in the arena.
 * 
 * @returns Array of enemy sprites
 */
export function getAllEnemies(): any[] {
    try {
        const HE = (globalThis as any).HeroEngine;
        if (HE && Array.isArray(HE.enemies)) {
            return HE.enemies.filter((e: any) => e && !(e.flags & 1)); // Filter out destroyed
        }
    } catch (e) {
        console.error("[AMULET][GET_ALL_ENEMIES][ERROR]", e);
    }
    return [];
}

/**
 * Get enemies within a radius of a point.
 * Useful for area effects.
 * 
 * @param x Center X position
 * @param y Center Y position
 * @param radius Search radius in pixels
 * @returns Array of enemy sprites within radius
 */
export function getEnemiesInRadius(x: number, y: number, radius: number): any[] {
    const enemies = getAllEnemies();
    const result: any[] = [];
    
    for (const enemy of enemies) {
        if (!enemy) continue;
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
            result.push(enemy);
        }
    }
    
    return result;
}

/**
 * Check if an enemy is currently alive (not destroyed, not dead).
 * 
 * @param enemy Enemy sprite
 * @returns True if alive and active
 */
export function isEnemyAlive(enemy: any): boolean {
    if (!enemy) return false;
    try {
        // Flag 1 = Destroyed
        if (enemy.flags & 1) return false;
        // Check if has health > 0
        if (enemy.health !== undefined && enemy.health <= 0) return false;
        return true;
    } catch {
        return false;
    }
}

export default {
    setEnemySlow,
    setEnemyWeaken,
    applyKnockback,
    applyKnockbackFrom,
    applyStun,
    applyDamageToEnemy,
    getEnemyByIndex,
    getAllEnemies,
    getEnemiesInRadius,
    isEnemyAlive,
};
