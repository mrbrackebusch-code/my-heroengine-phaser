import { registerStudentSystem } from "../../studentSdk";
import { registerStudentVfxPreset } from "../../studentHooks";
import { _setVfxRegistry } from "../../studentSystemsHooks";
import { setupAmuletEffects } from "./amuletEffects";
import { initAmuletChestRuntime } from "./amuletChest";
import { initAmuletHud } from "./amuletHud";

// Connect to VFX registry when available
function initializeVfxConnection(): void {
    let attempts = 0;
    const maxAttempts = 80; // ~20s at 250ms

    const tryConnect = () => {
        attempts++;
        try {
            const g = (globalThis as any);
            if (g.__heroEngineVfxRegistry) {
                _setVfxRegistry(g.__heroEngineVfxRegistry);
                return true;
            }
        } catch {
            // Silent failure
        }
        return false;
    };

    if (tryConnect()) return;

    const timer = setInterval(() => {
        if (tryConnect() || attempts >= maxAttempts) {
            clearInterval(timer);
        }
    }, 250);
}

registerStudentSystem({
    id: "ChrisS",
    name: "ChrisS",
    register(api) {
        // Setup amulet effect handlers
        setupAmuletEffects(api);
        
        // Connect to VFX registry for particle effects
        initializeVfxConnection();
    },
    init(ctx) {
        initializeVfxConnection();
        initAmuletChestRuntime(ctx);
        initAmuletHud();
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

