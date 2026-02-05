import type { StudentApi } from "../../studentApi";
import {
    registerPetAtlas,
    registerPetStats,
    registerPetAcquisition,
    registerAlly,
} from "../../studentSystemsHooks";

// Placeholder pet definitions for Alan's pet system.
// These use api.key(...) to namespace ids and texture keys so students
// can later swap in real assets without touching core code.

export function setupPetDefinitions(api: StudentApi): void {
    const petId = api.key("wisp_pet");
    const textureKey = api.assets.key("wisp_spritesheet");

    // Pet atlas registration (placeholder - swap when real sprites available)
    // Note: actually loading the texture is optional here; the key is reserved.
    registerPetAtlas({
        id: petId,
        textureKey,
        anims: {
            idle: api.key("wisp_idle"),
            walk: api.key("wisp_walk"),
            hurt: api.key("wisp_hurt"),
            interact: api.key("wisp_interact"),
        },
        data: {
            description: "Alan's companion wisp (placeholder)",
        },
    });

    // Pet stats: lower HP than player, modest attack
    registerPetStats({
        id: petId,
        baseHp: 40,
        baseAtk: 6,
        growthHp: 6,
        growthAtk: 1,
        maxLevel: 10,
    });

    // Acquisition: for now a starter acquisition so the pet is available
    registerPetAcquisition({
        id: api.key("wisp_start"),
        petId,
        kind: "summon",
        condition: "starter",
    });

    // Register as an ally type for combat systems
    registerAlly({ id: api.key("ally_wisp"), kind: "pet", data: { petId } });
}

export default setupPetDefinitions;
