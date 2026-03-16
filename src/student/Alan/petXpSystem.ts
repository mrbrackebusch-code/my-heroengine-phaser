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
    // Keep runtime pet.level in sync so combat systems can read it
    pet.level = 1;
}

/**
 * Get pet's current XP state.
 */
export function getPetXpState(pet: any): any {
    return pet?.__alanXp || { currentXp: 0, totalXpEarned: 0, level: 1, xpToNextLevel: 100 };
}

/**
 * Get pet's XP progress as a percentage (0-100) towards next level.
 */
export function getPetXpProgress(pet: any): number {
    const xpState = getPetXpState(pet);
    if (!xpState || xpState.level >= 10) return 100; // Max level
    return Math.min(100, (xpState.currentXp / xpState.xpToNextLevel) * 100);
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
 * Award XP from non-combat sources (e.g., exploration, quests, healing).
 * Useful for future expansion.
 */
export function awardPetXpFromEvent(pet: any, xpAmount: number, reason?: string): void {
    if (!pet || !xpAmount || xpAmount <= 0) return;
    
    const xpState = getPetXpState(pet);
    if (!xpState) return;
    
    xpState.currentXp += xpAmount;
    xpState.totalXpEarned += xpAmount;
    
    // Check for level-up(s)
    while (xpState.currentXp >= xpState.xpToNextLevel && xpState.level < 10) {
        _levelUpPet(pet, xpState);
    }
    
    pet.__alanXp = xpState;
    
    // Log event
    if (typeof console !== 'undefined' && console.log) {
        console.log(`[PET] ${pet.name || 'Pet'} gained ${xpAmount} XP from ${reason || 'event'}!`);
    }
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

    // Keep runtime pet.level in sync with XP state
    if (pet) {
        pet.level = xpState.level;
    }

    // Store old stats for comparison
    const oldMaxHp = pet.maxHp || 40;
    const oldAtk = pet.atk || 6;

    // Grow stats based on growth rates
    _applyStatGrowth(pet, oldLevel, xpState.level);
    
    // Calculate stat increases
    const hpIncrease = (pet.maxHp || 40) - oldMaxHp;
    const atkIncrease = (pet.atk || 6) - oldAtk;
    
    // Recalculate XP to next level (can scale with level)
    xpState.xpToNextLevel = _calculateXpThreshold(xpState.level);
    
    // Trigger level-up callback (for animations, VFX, UI updates)
    _triggerLevelUpEvent(pet, xpState, { hpIncrease, atkIncrease, oldLevel });
    
    // Log level-up event with details
    if (typeof console !== 'undefined' && console.log) {
        console.log(`[PET_LEVELUP] ${pet.name || 'Pet'} → Level ${xpState.level}! HP +${hpIncrease}, ATK +${atkIncrease}`);
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
 * Trigger level-up event callback for animations, VFX, and UI updates.
 * Can be hooked into by external systems.
 */
let levelUpCallback: ((pet: any, xpState: any, details: any) => void) | null = null;

export function registerLevelUpCallback(callback: (pet: any, xpState: any, details: any) => void): void {
    levelUpCallback = callback;
}

function _triggerLevelUpEvent(pet: any, xpState: any, details: any): void {
    if (levelUpCallback) {
        try {
            levelUpCallback(pet, xpState, details);
        } catch (e) {
            console.error("[PET] Level-up callback error:", e);
        }
    }
}

/**
 * Calculate XP threshold for next level.
 * 
 * ============================================================================
 * TUNING CONSTANTS (Elizabeth: adjust these for pacing)
 * ============================================================================
 * 
 * Current Formula: baseIncrement + (levelBonus × level)
 * With baseIncrement=50, levelBonus=50:
 * - Level 2: 100 XP (quick start)
 * - Level 3: 150 XP
 * - Level 5: 300 XP (mid-game)
 * - Level 8: 450 XP
 * - Level 10: 600 XP (capped, max level is rare)
 * 
 * Pacing Guidelines:
 * - Faster progression: lower baseIncrement/levelBonus (e.g., 40/40)
 * - Slower progression: higher baseIncrement/levelBonus (e.g., 75/75)
 * - Balanced: ~4-6 defeated weak enemies (~25-30 XP each) per level in early game
 * 
 * Elizabeth: Test with actual enemy XP values to ensure good player rhythm.
 * ============================================================================
 */
function _calculateXpThreshold(level: number): number {
    // === TUNING: Adjust these constants to change progression pace ===
    const baseIncrement = 50;  // Base XP for early levels
    const levelBonus = 50;     // XP increase per level
    const maxCap = 600;        // Maximum XP for any level
    // ===================================================================
    
    const threshold = baseIncrement + (levelBonus * level);
    return Math.min(threshold, maxCap);
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

// ============================================================================
// DEBUG & TEST UTILITIES (for tuning & verification)
// ============================================================================

/**
 * Print progression table for debugging/tuning.
 * Shows XP required for each level and example stat progression.
 */
export function printProgressionTable(): void {
    console.log("\n=== PET XP PROGRESSION TABLE ===");
    console.log("Level | XP to Next | Cumulative | Example ATK | Example HP");
    console.log("------|------------|------------|-------------|----------");
    
    let cumulativeXp = 0;
    for (let level = 1; level <= 10; level++) {
        const xpToNext = _calculateXpThreshold(level);
        cumulativeXp += xpToNext;
        const exampleAtk = 6 + (1 * (level - 1)); // baseAtk + (growthAtk × (level-1))
        const exampleHp = 40 + (6 * (level - 1)); // baseHp + (growthHp × (level-1))
        
        console.log(`  ${level}   | ${xpToNext.toString().padStart(10)} | ${cumulativeXp.toString().padStart(10)} | ${exampleAtk.toString().padStart(11)} | ${exampleHp.toString().padStart(8)}`);
    }
    console.log("================================\n");
}

/**
 * Simulate XP awards and level-ups for testing.
 */
export function testLevelUpFlow(pet: any, xpAmounts: number[]): void {
    if (!pet) {
        console.error("[TEST] No pet provided");
        return;
    }
    
    initPetXpState(pet);
    pet.__alanPetStats = { baseHp: 40, baseAtk: 6, growthHp: 6, growthAtk: 1 };
    pet.maxHp = 40;
    pet.hp = 40;
    pet.atk = 6;
    
    console.log(`[TEST] Starting: Level ${pet.__alanXp.level}, XP: ${pet.__alanXp.currentXp}/${pet.__alanXp.xpToNextLevel}`);
    
    for (const xp of xpAmounts) {
        awardPetXp(pet, xp);
        const state = pet.__alanXp;
        console.log(`[TEST] After +${xp} XP: Level ${state.level}, XP: ${state.currentXp}/${state.xpToNextLevel}, HP: ${pet.hp}/${pet.maxHp}, ATK: ${pet.atk}`);
    }
    
    console.log(`[TEST] Final: Level ${pet.__alanXp.level}, Total XP earned: ${pet.__alanXp.totalXpEarned}`);
}

/**
 * Get pet level-up stats for UI display.
 * Returns object with level, progress, and next milestone XP.
 */
export function getPetLevelUpStats(pet: any): { level: number; xpProgress: number; xpToNext: number; nextLevel: number } {
    const xpState = getPetXpState(pet);
    return {
        level: xpState.level,
        xpProgress: xpState.currentXp,
        xpToNext: xpState.xpToNextLevel,
        nextLevel: xpState.level < 10 ? xpState.level + 1 : 10,
    };
}

export default setupPetXpProgression;
