import type { StudentApi } from "../../studentApi";
import { registerInventoryItem, registerInventoryHooks } from "../../studentSystemsHooks";

// Inventory items: food (restore HP) and bandage (revive from wounded)

export function setupPetInventory(api: StudentApi): void {
    const foodId = api.key("wisp_food");
    const superFoodId = api.key("wisp_super_food");
    const bandageId = api.key("wisp_bandage");

    // Register images (students should place files under src/student/Alan/assets/pets/)
    try {
        api.assets.registerImage(api.key("wisp_food_icon"), "src/student/Alan/assets/pets/wisp_food 16x16.png");
    } catch (e) {}
    try {
        api.assets.registerImage(api.key("wisp_super_food_icon"), "src/student/Alan/assets/pets/wisp_super_food 16x16.png");
    } catch (e) {}
    try {
        api.assets.registerImage(api.key("wisp_bandage_icon"), "src/student/Alan/assets/pets/wisp_bandage 16x16.png");
    } catch (e) {}

    registerInventoryItem({ id: foodId, name: "Wisp Food", iconKey: api.assets.key("wisp_food_icon") });
    registerInventoryItem({ id: superFoodId, name: "Wisp Super Food", iconKey: api.assets.key("wisp_super_food_icon") });
    registerInventoryItem({ id: bandageId, name: "Bandage", iconKey: api.assets.key("wisp_bandage_icon") });

    registerInventoryHooks({
        onItemUse: (ctx: any) => {
            // Generic item-use hook (not strictly required for pet-only items)
        },
        onPetFeed: (ctx: any) => {
            // ctx: { petId, pet, hero, itemId, count }
            try {
                if (!ctx || !ctx.pet || !ctx.itemId) return;
                const pet = ctx.pet;
                const maxHp = pet.maxHp || pet.stats?.baseHp || 1;

                if (ctx.itemId === foodId) {
                    // Basic food: small heal
                    const heal = 20;
                    pet.hp = Math.min(maxHp, (pet.hp || pet.currentHp || 0) + heal);
                } else if (ctx.itemId === superFoodId) {
                    // Super food: larger heal + temporary attack buff
                    const heal = 60;
                    pet.hp = Math.min(maxHp, (pet.hp || pet.currentHp || 0) + heal);

                    // Apply temporary buff: +4 atk for 30s
                    const now = Date.now();
                    pet.__alanBuff = pet.__alanBuff || {};
                    pet.__alanBuff.atk = (pet.__alanBuff.atk || 0) + 4;
                    pet.__alanBuff.expires = now + 30000;
                }

                // If healed above 30% threshold, clear retreating/wounded
                if (pet.hp > Math.max(1, Math.floor(maxHp * 0.3))) {
                    if (pet.__alanState) pet.__alanState.retreating = false;
                    if (pet.__alanState && pet.__alanState.wounded && pet.hp > 0) pet.__alanState.wounded = false;
                }
            } catch (e) {}
        },
        onPetHeal: (ctx: any) => {
            // Bandage / revive logic
            try {
                if (!ctx || !ctx.pet) return;
                const pet = ctx.pet;
                // If pet is wounded (hp <= 0), bandage revives to 30% HP
                if ((pet.hp || pet.currentHp || 0) <= 0) {
                    const maxHp = pet.maxHp || pet.stats?.baseHp || 1;
                    pet.hp = Math.max(1, Math.floor(maxHp * 0.3));
                    if (!pet.__alanState) pet.__alanState = {};
                    pet.__alanState.wounded = false;
                    pet.__alanState.retreating = true; // stay behind until fed more
                } else {
                    // Regular heal
                    const heal = 15;
                    pet.hp = Math.min((pet.maxHp || 1), (pet.hp || pet.currentHp || 0) + heal);
                    const maxHp = pet.maxHp || pet.stats?.baseHp || 1;
                    if (pet.hp > Math.max(1, Math.floor(maxHp * 0.3))) {
                        if (pet.__alanState) pet.__alanState.retreating = false;
                    }
                }
            } catch (e) {}
        },
    });
}

export default setupPetInventory;
