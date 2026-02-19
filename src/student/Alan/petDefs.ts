import type { StudentApi } from "../../studentApi";
import {
    registerPetAtlas,
    registerPetStats,
    registerPetAcquisition,
    registerAlly,
} from "../../studentSystemsHooks";

/**
 * Pet Definitions for Alan's Pet System (Lourdes: visuals here)
 * 
 * ============================================================================
 * SPRITE REQUIREMENTS FOR LOURDES
 * ============================================================================
 * 
 * File: `wisp 32x32.png` (or agreed path in assets/pets/ or assets/)
 * - Size: 32×32 pixels per frame (CRITICAL: WxH naming required)
 * - Frame layout: Horizontal strip (all frames in one row)
 * 
 * Animation frames needed (update frame ranges below as you create them):
 * 
 * Animation   | Frames | Purpose
 * ------------|--------|-----------------------------------------------
 * idle        | 0-3    | Pet standing still, breathing/flickering
 * walk        | 4-7    | Pet moving alongside player
 * hurt        | 8-11   | Pet recoiling from damage (short duration)
 * interact    | 12-15  | Pet celebrating/reacting to events
 * 
 * TOTAL FRAMES: 16 frames (0-15)
 * 
 * Frame mapping example:
 * - Frames 0,1,2,3 = idle animation (4 frames, plays at 10 fps = 400ms loop)
 * - Frames 4,5,6,7 = walk animation (4 frames, plays at 10 fps = 400ms loop)
 * - Frames 8,9,10,11 = hurt animation (4 frames, faster = 12 fps = 333ms)
 * - Frames 12,13,14,15 = interact animation (4 frames, slow = 8 fps = 500ms)
 * 
 * ============================================================================
 * INVENTORY ITEM ICONS (small icons for inventory UI)
 * ============================================================================
 * 
 * File: `wisp_food 16x16.png`
 * - Size: 16×16 pixels
 * - Single frame (no animation)
 * - Purpose: Food item icon in inventory menu
 * 
 * File: `wisp_bandage 16x16.png`
 * - Size: 16×16 pixels
 * - Single frame (no animation)
 * - Purpose: Bandage item icon in inventory menu
 * 
 * ============================================================================
 */

export function setupPetDefinitions(api: StudentApi): void {
    const petId = api.key("wisp_pet");
    const textureKey = api.assets.key("wisp_spritesheet");

    /**
     * Animation frame definitions.
     * LOURDES: Update these ranges once you finalize the spritesheet layout.
     * 
     * Format: { start: firstFrameIndex, end: lastFrameIndex, frameRate: fps }
     * 
     * These must match your spritesheet layout exactly.
     * For example, if idle uses frames 0-3, update animFrames.idle.end to 3.
     */
    const animFrames = {
        idle: { start: 0, end: 3, frameRate: 10 },      // Breathing/idle loop
        walk: { start: 4, end: 7, frameRate: 10 },      // Walking alongside hero
        hurt: { start: 8, end: 11, frameRate: 12 },     // Damage reaction
        interact: { start: 12, end: 15, frameRate: 8 }, // Celebration/interact
    };

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
            description: "Alan's companion wisp",
            version: "1.0",
            // Store frame data for animation setup
            animFrames,
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
