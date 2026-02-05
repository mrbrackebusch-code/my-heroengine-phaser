import type { StudentApi } from "../../studentApi";
import { registerInventoryItem, registerInventoryHooks } from "../../studentSystemsHooks";

// Inventory items: food (restore HP) and bandage (revive from wounded)

export function setupPetInventory(api: StudentApi): void {
    const foodId = api.key("wisp_food");
    const bandageId = api.key("wisp_bandage");

    registerInventoryItem({ id: foodId, name: "Wisp Food", iconKey: api.assets.key("wisp_food_icon") });
    registerInventoryItem({ id: bandageId, name: "Bandage", iconKey: api.assets.key("wisp_bandage_icon") });

    registerInventoryHooks({
        onItemUse: (ctx: any) => {
            // Generic item-use hook (not strictly required for pet-only items)
        },
        onPetFeed: (ctx: any) => {
            // ctx: { petId, pet, hero, itemId, count }
            try {
                if (!ctx || !ctx.pet) return;
                // Feed restores HP (flat amount for now)
                const heal = 20;
                ctx.pet.hp = Math.min((ctx.pet.maxHp || 1), (ctx.pet.hp || ctx.pet.currentHp || 0) + heal);
                // If healed above 30% threshold, clear retreating/wounded
                const maxHp = ctx.pet.maxHp || ctx.pet.stats?.baseHp || 1;
                if (ctx.pet.hp > Math.max(1, Math.floor(maxHp * 0.3))) {
                    if (ctx.pet.__alanState) ctx.pet.__alanState.retreating = false;
                    if (ctx.pet.__alanState && ctx.pet.__alanState.wounded && ctx.pet.hp > 0) ctx.pet.__alanState.wounded = false;
                }
            } catch (e) {}
        },
        onPetHeal: (ctx: any) => {
            // Bandage / revive logic
            try {
                if (!ctx || !ctx.pet) return;
                // If pet is wounded (hp <= 0), bandage revives to 30% HP
                if ((ctx.pet.hp || ctx.pet.currentHp || 0) <= 0) {
                    const maxHp = ctx.pet.maxHp || ctx.pet.stats?.baseHp || 1;
                    ctx.pet.hp = Math.max(1, Math.floor(maxHp * 0.3));
                    if (!ctx.pet.__alanState) ctx.pet.__alanState = {};
                    ctx.pet.__alanState.wounded = false;
                    ctx.pet.__alanState.retreating = true; // stay behind until fed more
                } else {
                    // Regular heal
                    const heal = 15;
                    ctx.pet.hp = Math.min((ctx.pet.maxHp || 1), (ctx.pet.hp || ctx.pet.currentHp || 0) + heal);
                    const maxHp = ctx.pet.maxHp || ctx.pet.stats?.baseHp || 1;
                    if (ctx.pet.hp > Math.max(1, Math.floor(maxHp * 0.3))) {
                        if (ctx.pet.__alanState) ctx.pet.__alanState.retreating = false;
                    }
                }
            } catch (e) {}
        },
    });
}

export default setupPetInventory;
