import type { StudentApi } from "../../studentApi";
import { registerPetXpGainHook, type PetXpGainContext } from "./petCombat";

/**
 * Pet XP & Progression System (Elizabeth's domain)
 * 
 * This is the hook that receives XP events from petCombat.ts
 * and implements leveling, stat growth, and progression mechanics.
 * 
 * ============================================================================
 * XP PROGRESSION REFERENCE (for tuning & debugging)
 * ============================================================================
 * 
 * Current progression formula: baseXp (100) + bonusPerLevel (50 × level)
 * 
 * Progression table (adjust via tuning constants):
 * 
 * Level | XP to Reach | Example Damage | Health
 * ------|-------------|----------------|--------
 *   1   | —           | 3 dmg          | 40 HP
 *   2   | 100 XP      | 4 dmg          | 46 HP
 *   3   | 250 XP      | 5 dmg          | 52 HP
 *   4   | 450 XP      | 6 dmg          | 58 HP
 *   5   | 700 XP      | 7 dmg          | 64 HP
 *   6   | 1000 XP     | 8 dmg          | 70 HP
 *   7   | 1350 XP     | 9 dmg          | 76 HP
 *   8   | 1750 XP     | 10 dmg         | 82 HP
 *   9   | 2200 XP     | 11 dmg         | 88 HP
 *  10   | 2700 XP     | 12 dmg         | 94 HP
 * 
 * Leveling rhythm:
 * - Early (Lv1-3): Fast progression, encourages engagement
 * - Mid (Lv4-7): Moderate pace, requires strategy
 * - Late (Lv8-10): Slow grind, max level is aspirational
 * 
 * These values assume ~25-30 XP per defeated weak enemy.
 * Elizabeth: Adjust baseXp and bonusPerLevel in _calculateXpThreshold() to change pace.
 * 
 * ============================================================================
 */

// ============================================================================
// XP TRACKING STATE
// ============================================================================

/**
 * Initialize XP tracking for a pet instance.
 */
export function initPetXpState(pet: any): void {
    if (!pet) return;
    pet.__alanXp = {
        currentXp: 0,
        totalXpEarned: 0,
        level: 1,
        xpToNextLevel: 100, // Elizabeth: tune this value
    };
}

/**
 * Get pet's current XP state.
 */
export function getPetXpState(pet: any): any {
    return pet?.__alanXp || { currentXp: 0, totalXpEarned: 0, level: 1, xpToNextLevel: 100 };
}

// ============================================================================
// XP GAIN & LEVELING
// ============================================================================

/**
 * Award XP to pet and check for level-up.
 * Called by petCombat.ts when enemy is defeated.
 */
export function awardPetXp(pet: any, xpAmount: number, ctx?: any): void {
    if (!pet || !xpAmount || xpAmount <= 0) return;
    
    const xpState = getPetXpState(pet);
    if (!xpState) return;
    
    xpState.currentXp += xpAmount;
    xpState.totalXpEarned += xpAmount;
    
    // Check for level-up(s) — pet can level up multiple times if XP is high
    while (xpState.currentXp >= xpState.xpToNextLevel && xpState.level < 10) {
        _levelUpPet(pet, xpState, ctx);
    }
    
    pet.__alanXp = xpState;
}

/**
 * Level up the pet: increase level, reset XP, grow stats.
 */
function _levelUpPet(pet: any, xpState: any, ctx?: any): void {
    // Deduct XP cost for this level
    xpState.currentXp -= xpState.xpToNextLevel;
    
    // Increase level
    const oldLevel = xpState.level;
    xpState.level = Math.min(10, xpState.level + 1);
    
    // Grow stats based on growth rates
    _applyStatGrowth(pet, oldLevel, xpState.level);
    
    // Recalculate XP to next level (can scale with level)
    xpState.xpToNextLevel = _calculateXpThreshold(xpState.level);
    
    // Log level-up event
    if (typeof console !== 'undefined' && console.log) {
        console.log(`[PET] ${pet.name || 'Pet'} leveled up to ${xpState.level}!`);
    }
}

/**
 * Apply stat growth on level-up.
 * Uses growth rates from pet stats (growthHp, growthAtk, etc.)
 */
function _applyStatGrowth(pet: any, fromLevel: number, toLevel: number): void {
    if (!pet || !pet.__alanPetStats) return;
    
    const stats = pet.__alanPetStats;
    const growthHp = stats.growthHp || 6;
    const growthAtk = stats.growthAtk || 1;
    
    // Formula: baseHp + (growthHp * (level - 1))
    const newMaxHp = (stats.baseHp || 40) + (growthHp * (toLevel - 1));
    const newAtk = (stats.baseAtk || 6) + (growthAtk * (toLevel - 1));
    
    // Update pet runtime stats
    if (pet.maxHp != null) pet.maxHp = newMaxHp;
    if (pet.hp != null && pet.hp > newMaxHp) {
        pet.hp = newMaxHp; // Cap HP at new max
    }
    if (pet.atk != null) pet.atk = newAtk;
    
    // Store calculated stats for later reference/debugging
    pet.__alanCalculatedStats = { maxHp: newMaxHp, atk: newAtk, level: toLevel };
}

/**
 * Calculate XP threshold for next level.
 * 
 * Progression design:
 * - Level 1→2: 100 XP (quick early progression)
 * - Level 5→6: 300 XP (mid-game tempo)
 * - Level 9→10: 550 XP (max level is rare)
 * 
 * Formula: baseXp (100) + bonusPerLevel (50 × level)
 * This gives smooth, increasing difficulty without harsh curves.
 * 
 * Elizabeth: Tune baseXp and bonusPerLevel constants to match desired pacing.
 */
function _calculateXpThreshold(level: number): number {
    const baseXp = 100;
    const bonusPerLevel = 50;
    const threshold = baseXp + (bonusPerLevel * level);
    
    // Cap at reasonable values for levels 1-10
    return Math.min(threshold, 600); // Max 600 XP for level 10
}

// ============================================================================
// SETUP & REGISTRATION
// ============================================================================

/**
 * Setup pet XP progression system.
 * Called from index.ts; wires the XP hook.
 * 
 * This registers the callback that petCombat.ts calls when pet defeats an enemy.
 */
export function setupPetXpProgression(_api: StudentApi): void {
    // Register the XP gain hook
    // This gets called by petCombat.ts whenever pet defeats an enemy
    registerPetXpGainHook((ctx: PetXpGainContext) => {
        if (!ctx || !ctx.pet) return;
        
        // Initialize XP state if needed
        if (!ctx.pet.__alanXp) {
            initPetXpState(ctx.pet);
        }
        
        // Award XP and handle level-ups automatically
        awardPetXp(ctx.pet, ctx.xpAmount, ctx);
    });
}

export default setupPetXpProgression;
