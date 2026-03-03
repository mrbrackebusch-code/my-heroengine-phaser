import type { StudentApi } from "../../studentApi";
import { registerPetBehavior } from "../../studentSystemsHooks";

// Behavior: follow player, assist in combat, retreat at 30% HP, wounded at 0

export function setupPetBehaviors(_api: StudentApi): void {
    const petBehaviorId = "alan_wisp_behavior";
    const petId = "student.alan.wisp_pet";

    registerPetBehavior({
        id: petBehaviorId,
        petId,
        onSpawn: (ctx: any) => {
            // Initialize runtime state for this pet instance
            try {
                if (!ctx || !ctx.pet) return;
                ctx.pet.__alanState = ctx.pet.__alanState || {
                    retreating: false,
                    wounded: false,
                };
            } catch (e) {}
        },
        onUpdate: (ctx: any) => {
            // Expected ctx fields (best-effort): pet, hero, now, scene
            if (!ctx || !ctx.pet) return;
            const state = ctx.pet.__alanState || { retreating: false, wounded: false };

            const hp = (ctx.pet.hp == null) ? ctx.pet.currentHp || 0 : ctx.pet.hp;
            const maxHp = (ctx.pet.maxHp == null) ? ctx.pet.stats?.baseHp || 1 : ctx.pet.maxHp;

            // If wounded (0 HP), ensure pet stays down
            if (hp <= 0) {
                state.wounded = true;
                state.retreating = true;
                ctx.pet.__alanState = state;
                return;
            }

            // Retreat when below 30% HP
            const threshold = Math.max(1, Math.floor(maxHp * 0.3));
            if (hp <= threshold && !state.retreating) {
                state.retreating = true;
            }

            // Calculate distance to hero for follow/retreat decisions
            let distanceToHero = Infinity;
            if (ctx.hero && ctx.pet.x != null && ctx.pet.y != null) {
                const dx = ctx.pet.x - (ctx.hero.x || 0);
                const dy = ctx.pet.y - (ctx.hero.y || 0);
                distanceToHero = Math.sqrt(dx * dx + dy * dy);
            }

            // If not retreating or wounded, follow hero and engage
            if (!state.retreating && !state.wounded) {
                // Follow only if far from hero
                const followDistance = 48; // pixels
                if (distanceToHero > followDistance && ctx.hero) {
                    try {
                        if (typeof ctx.pet.followHero === 'function') {
                            ctx.pet.followHero(ctx.hero, { offset: { x: -16, y: 0 } });
                        }
                    } catch (e) {}
                }
                // Attack behavior is handled by petCombat.ts
            } else {
                // Retreating: stay behind hero at a safe distance
                if (ctx.hero && typeof ctx.pet.moveTo === 'function') {
                    try {
                        const safeDistance = 64; // pixels behind
                        const behindX = (ctx.hero.x || 0) - safeDistance;
                        const behindY = ctx.hero.y || 0;
                        // Only move if not already close to safe position
                        const dx = ctx.pet.x - behindX;
                        const dy = ctx.pet.y - behindY;
                        const distToSafe = Math.sqrt(dx * dx + dy * dy);
                        if (distToSafe > 16) { // threshold to avoid jitter
                            ctx.pet.moveTo(behindX, behindY);
                        }
                    } catch (e) {}
                }
            }

            // Handle temporary buffs (expire and apply)
            try {
                const buff = ctx.pet.__alanBuff;
                const now = ctx.now || Date.now();
                // If buff expired, remove it
                if (buff && buff.expires && now >= buff.expires) {
                    // subtract buff value
                    const atkBuff = buff.atk || 0;
                    // Clear buff
                    ctx.pet.__alanBuff = null;
                    // Recompute atk from base stats
                    const baseAtk = ctx.pet.__alanCalculatedStats?.atk || ctx.pet.__alanPetStats?.baseAtk || ctx.pet.atk || 0;
                    ctx.pet.atk = baseAtk;
                } else if (buff && buff.atk) {
                    // Ensure current atk includes buff
                    const baseAtk = ctx.pet.__alanCalculatedStats?.atk || ctx.pet.__alanPetStats?.baseAtk || ctx.pet.atk || 0;
                    ctx.pet.atk = baseAtk + (buff.atk || 0);
                }
            } catch (e) {}

            ctx.pet.__alanState = state;
        },
        onDamage: (ctx: any) => {
            if (!ctx || !ctx.pet) return;
            const hp = (ctx.pet.hp == null) ? ctx.pet.currentHp || 0 : ctx.pet.hp;
            const maxHp = (ctx.pet.maxHp == null) ? ctx.pet.stats?.baseHp || 1 : ctx.pet.maxHp;
            const threshold = Math.max(1, Math.floor(maxHp * 0.3));
            
            if (!ctx.pet.__alanState) ctx.pet.__alanState = {};
            
            if (hp <= 0) {
                ctx.pet.__alanState.retreating = true;
                ctx.pet.__alanState.wounded = true;
            } else if (hp <= threshold) {
                ctx.pet.__alanState.retreating = true;
            }
        },
        onHeal: (ctx: any) => {
            if (!ctx || !ctx.pet) return;
            const hp = (ctx.pet.hp == null) ? ctx.pet.currentHp || 0 : ctx.pet.hp;
            const maxHp = (ctx.pet.maxHp == null) ? ctx.pet.stats?.baseHp || 1 : ctx.pet.maxHp;
            const threshold = Math.max(1, Math.floor(maxHp * 0.3));
            
            if (!ctx.pet.__alanState) ctx.pet.__alanState = {};
            
            if (hp > threshold) {
                // healed above 30% => stop retreating
                ctx.pet.__alanState.retreating = false;
                ctx.pet.__alanState.wounded = false;
            } else if (hp > 0) {
                // Healed but still low; no longer wounded but still retreating
                ctx.pet.__alanState.wounded = false;
            }
        },
    });
}

export default setupPetBehaviors;
