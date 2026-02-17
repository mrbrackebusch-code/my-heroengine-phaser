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

            // If not retreating or wounded, follow hero and engage
            if (!state.retreating && !state.wounded) {
                // Simple follow: request follow position near hero
                if (ctx.hero) {
                    try {
                        if (typeof ctx.pet.followHero === 'function') {
                            ctx.pet.followHero(ctx.hero, { offset: { x: -16, y: 0 } });
                        }
                    } catch (e) {}
                }
                // Attack behavior is handled by petCombat.ts
            } else {
                // Retreating: stay behind hero or stay idle
                if (ctx.hero && typeof ctx.pet.moveTo === 'function') {
                    try {
                        const behindX = (ctx.hero.x || 0) - 24;
                        const behindY = ctx.hero.y || 0;
                        ctx.pet.moveTo(behindX, behindY);
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
