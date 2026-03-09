import { registerStudentSystem } from "../../studentSdk";
import { registerStudentVfxPreset } from "../../studentHooks";
import { _setVfxRegistry } from "../../studentSystemsHooks";
import { setupAmuletEffects } from "./amuletEffects";
import { showAmuletSelectionUI } from "./amuletSelectionUI";

// Connect to VFX registry when available
function initializeVfxConnection(): void {
    const tryConnect = () => {
        try {
            const g = (globalThis as any);
            if (g.__heroEngineVfxRegistry) {
                _setVfxRegistry(g.__heroEngineVfxRegistry);
            }
        } catch (e) {
            // Silent failure
        }
    };
    tryConnect();
    setTimeout(tryConnect, 100);
}

// Setup event listener for floor 1 completion (reward screen)
function setupFloor1RewardListener(): void {
    try {
        const g = (globalThis as any);
        if (typeof g.addEventListener === "function") {
            g.addEventListener("he:dungeonFloorComplete", (ev: any) => {
                const detail = ev?.detail || {};
                const floorIndex = detail.floorIndex ?? -1;
                
                // Floor 1 (index 1) - player completes and should get amulet reward
                if (floorIndex === 1) {
                    setTimeout(() => {
                        showAmuletSelectionUIOnFloor1();
                    }, 500); // Delay to let UI settle
                }
            });
        }

        // Also listen for treasure floor opened events in case the above hook doesn't fire
        g.addEventListener("he:treasureOpened", (ev: any) => {
            const detail = ev?.detail || {};
            const floorIndex = detail.floorIndex ?? -1;
            
            if (floorIndex === 1) {
                setTimeout(() => {
                    showAmuletSelectionUIOnFloor1();
                }, 500);
            }
        });
    } catch (e) {
        // Silent failure - hook may not be available
    }
}

// Global state to track if amulet was already offered
let _floor1AmuletOffered = false;

function showAmuletSelectionUIOnFloor1(): void {
    // Only offer once per floor 1 completion
    if (_floor1AmuletOffered) return;
    _floor1AmuletOffered = true;

    // Get the registerStudentSystem function's api to pass to showAmuletSelectionUI
    const g = (globalThis as any);
    const api = g.__christhsStudentApi;

    if (!api) {
        console.warn("[AMULET] Student API not available for floor 1 reward");
        return;
    }

    showAmuletSelectionUI(api, (amuletId: string) => {
        console.log("[AMULET] Player selected:", amuletId);
        
        // Add the amulet to player inventory/relics
        try {
            // Try to dispatch to core game to add the relic
            const heroIndex = g.__currentHeroIndex ?? 0;
            if (g.addRelicToHero && typeof g.addRelicToHero === "function") {
                g.addRelicToHero(heroIndex, amuletId);
            }
        } catch (e) {
            console.error("[AMULET] Error adding relic to hero:", e);
        }
    });
}

registerStudentSystem({
    id: "ChrisS",
    name: "ChrisS",
    register(api) {
        // Store API globally for floor 1 reward handler
        const g = (globalThis as any);
        g.__christhsStudentApi = api;

        const base = (id: string, name: string, effectText: string, flavor: string, color: string) => ({
            id,
            name,
            effectText,
            flavorText: flavor || "",
            rarity: "relic",
            uiHints: { kind: "amulet", glyphText: color },
        });

        api.relics.register({
            ...base("amulet_water", "Amulet of Tides", "Grants water affinity; slows burning.", "A star-shaped amulet with a blue sheen. Harnesses the power of the tides.", "blue"),
            iconPrimary: { sheet: "ProjectUtumno_full", x: 23, y: 69 },
        });
        api.relics.register({
            ...base("amulet_wind", "Amulet of Zephyrs", "Increases dodge chance; boosts speed.", "A star-shaped amulet with a white shimmer. Calls upon the swiftness of the gale.", "white"),
            iconPrimary: { sheet: "ProjectUtumno_full", x: 28, y: 62 },
        });
        api.relics.register({
            ...base("amulet_fire", "Amulet of Embers", "Adds fire damage to attacks; ignites small foes.", "A star-shaped amulet with a warm red glow. Contains the fury of an ever-burning ember.", "red"),
            iconPrimary: { sheet: "ProjectUtumno_full", x: 39, y: 68 },
        });
        api.relics.register({
            ...base("amulet_poison", "Amulet of Venom", "Attacks apply minor poison over time.", "A star-shaped amulet with a purple tint. Infused with a slow-acting, potent toxin.", "purple"),
            iconPrimary: { sheet: "ProjectUtumno_full", x: 34, y: 65 },
        });
        api.relics.register({
            ...base("amulet_earth", "Amulet of Stones", "Increases defense and resistance to knockback.", "A star-shaped amulet with an earthy brown luster. Anchored with the strength of the earth.", "brown"),
            iconPrimary: { sheet: "ProjectUtumno_full", x: 28, y: 29 },
        });
        
        // Setup amulet effect handlers
        setupAmuletEffects(api);
        
        // Connect to VFX registry for particle effects
        initializeVfxConnection();
        
        // Setup floor 1 reward listener
        setupFloor1RewardListener();
    },
});

// Register VFX presets for amulets
registerStudentVfxPreset("amulet_zephyrs_vfx", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "LightEffects 150x150",
            lifespanMs: params.lifespanMs || 800,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][ZEPHYRS][VFX]", e);
    }
});

registerStudentVfxPreset("amulet_embers_vfx", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "FireWrath 200x200",
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][EMBERS][VFX]", e);
    }
});

registerStudentVfxPreset("amulet_venom_vfx", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "CosmicTime 150x150",
            lifespanMs: params.lifespanMs || 700,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][VENOM][VFX]", e);
    }
});

registerStudentVfxPreset("amulet_stones_vfx", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "EarthImpact 150x150",
            lifespanMs: params.lifespanMs || 800,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][STONES][VFX]", e);
    }
});

registerStudentVfxPreset("amulet_tides_vfx", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "Water 150x150",
            lifespanMs: params.lifespanMs || 800,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][TIDES][VFX]", e);
    }
});

// Elemental weapon visuals (decorative only, no gameplay effect)
registerStudentVfxPreset("amulet_weapon_stones", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        const weapon = helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "ElementalWeapons 77x189",
            // White weapon base frame, tinted brown for stones.
            opts: { frameIndex: 48 },
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
        // Brown tint for earth/stones
        try { (weapon as any).setTint?.(0x8B4513); } catch { }
    } catch (e) {
        console.error("[AMULET][STONES][WEAPON]", e);
    }
});

registerStudentVfxPreset("amulet_weapon_venom", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "ElementalWeapons 77x189",
            // Native purple weapon frames start at index 0.
            opts: { frameIndex: 0 },
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][VENOM][WEAPON]", e);
    }
});

registerStudentVfxPreset("amulet_weapon_tides", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "ElementalWeapons 77x189",
            // Native blue weapon frames start at index 36.
            opts: { frameIndex: 36 },
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][TIDES][WEAPON]", e);
    }
});

registerStudentVfxPreset("amulet_weapon_embers", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "ElementalWeapons 77x189",
            // Native light red/orange weapon frames start at index 24.
            opts: { frameIndex: 24 },
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][EMBERS][WEAPON]", e);
    }
});

registerStudentVfxPreset("amulet_weapon_zephyrs", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "ElementalWeapons 77x189",
            // Native white weapon frames start at index 48.
            opts: { frameIndex: 48 },
            lifespanMs: params.lifespanMs || 600,
            ghost: true,
        });
    } catch (e) {
        console.error("[AMULET][ZEPHYRS][WEAPON]", e);
    }
});

// Wisdom shield visuals (decorative + invulnerability timing in amuletEffects.ts)
registerStudentVfxPreset("amulet_shield_stones", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        const shield = helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "AngelShield 250x200",
            // White shield sequence (small -> cross), tinted brown for stones.
            opts: { frameList: [0, 1, 2, 3, 4], fps: 2, repeat: 0 },
            lifespanMs: params.lifespanMs || 2500,
            ghost: true,
        });
        try { (shield as any).setTint?.(0x8B4513); } catch { }
    } catch {
        // Silent failure keeps gameplay stable if shield VFX fails.
    }
});

registerStudentVfxPreset("amulet_shield_venom", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "AngelShield 250x200",
            // Native purple shield sequence (small -> cross).
            opts: { frameList: [15, 16, 17, 18, 19], fps: 2, repeat: 0 },
            lifespanMs: params.lifespanMs || 2500,
            ghost: true,
        });
    } catch {
        // Silent failure keeps gameplay stable if shield VFX fails.
    }
});

registerStudentVfxPreset("amulet_shield_embers", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "AngelShield 250x200",
            // Native light red/orange shield sequence (small -> cross).
            opts: { frameList: [5, 6, 7, 8, 9], fps: 2, repeat: 0 },
            lifespanMs: params.lifespanMs || 2500,
            ghost: true,
        });
    } catch {
        // Silent failure keeps gameplay stable if shield VFX fails.
    }
});

registerStudentVfxPreset("amulet_shield_tides", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "AngelShield 250x200",
            // Native blue shield sequence (small -> cross).
            opts: { frameList: [10, 11, 12, 13, 14], fps: 2, repeat: 0 },
            lifespanMs: params.lifespanMs || 2500,
            ghost: true,
        });
    } catch {
        // Silent failure keeps gameplay stable if shield VFX fails.
    }
});

registerStudentVfxPreset("amulet_shield_zephyrs", (ctx, params: { x: number; y: number; lifespanMs?: number }, helpers) => {
    if (!helpers) return;
    try {
        helpers.spawnEffect({
            x: params.x | 0,
            y: params.y | 0,
            skinId: "AngelShield 250x200",
            // Native white shield sequence (small -> cross).
            opts: { frameList: [0, 1, 2, 3, 4], fps: 2, repeat: 0 },
            lifespanMs: params.lifespanMs || 2500,
            ghost: true,
        });
    } catch {
        // Silent failure keeps gameplay stable if shield VFX fails.
    }
});

