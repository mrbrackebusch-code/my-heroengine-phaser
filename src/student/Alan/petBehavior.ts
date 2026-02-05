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
            if (hp <= threshold) {
                state.retreating = true;
            }

            // If not retreating or wounded, follow hero and engage
            if (!state.retreating && !state.wounded) {
                // simple follow: request follow position near hero
                if (ctx.hero && typeof ctx.hero.getCenter === "function") {
                    // Request engine to move pet near hero; details implemented in core
                    if (typeof ctx.pet.followHero === "function") ctx.pet.followHero(ctx.hero, { offset: { x: -16, y: 0 } });
                }
                // Attack behavior should be invoked by core combat using pet's ally registration
            } else {
                // Retreating: stay behind hero or stay idle
                if (ctx.hero && typeof ctx.pet.moveTo === "function") {
                    // moveTo is best-effort; core may ignore if not supported
                    const behindX = (ctx.hero.x || 0) - 24;
                    const behindY = ctx.hero.y || 0;
                    try { ctx.pet.moveTo(behindX, behindY); } catch (e) {}
                }
            }

            ctx.pet.__alanState = state;
        },
        onDamage: (ctx: any) => {
            if (!ctx || !ctx.pet) return;
            const hp = (ctx.pet.hp == null) ? ctx.pet.currentHp || 0 : ctx.pet.hp;
            if (hp <= 0) {
                ctx.pet.__alanState = { retreating: true, wounded: true };
            } else {
                const maxHp = ctx.pet.maxHp || ctx.pet.stats?.baseHp || 1;
                if (hp <= Math.max(1, Math.floor(maxHp * 0.3))) {
                    ctx.pet.__alanState = { retreating: true, wounded: false };
                }
            }
        },
        onHeal: (ctx: any) => {
            if (!ctx || !ctx.pet) return;
            const hp = (ctx.pet.hp == null) ? ctx.pet.currentHp || 0 : ctx.pet.hp;
            if (hp > 0) {
                // healed above 30% => stop retreating
                const maxHp = ctx.pet.maxHp || ctx.pet.stats?.baseHp || 1;
                if (hp > Math.max(1, Math.floor(maxHp * 0.3))) {
                    ctx.pet.__alanState = { retreating: false, wounded: false };
                }
            }
        },
    });
}

export default setupPetBehaviors;
