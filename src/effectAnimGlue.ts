// src/effectAnimGlue.ts
import type Phaser from "phaser";
import type { EffectAtlas, EffectDir } from "./effectAtlas";

const EFFECT_SKIN_KEY = "effectSkin";
const EFFECT_DIR_KEY = "effectDir";
const EFFECT_DEBUG_ID_KEY = "effectDebugId";

const LAST_EFFECT_ANIM_KEY = "__effectLastAnimKey";
const LAST_EFFECT_SKIN_KEY = "__effectLastSkin";
const LAST_EFFECT_DIR_KEY = "__effectLastDir";

function getEffectAtlasFromScene(scene: Phaser.Scene): EffectAtlas | undefined {
    const anyScene = scene as any;
    return (
        (scene.registry?.get?.("effectAtlas") as EffectAtlas | undefined) ||
        (anyScene.effectAtlas as EffectAtlas | undefined) ||
        (anyScene.__effectAtlas as EffectAtlas | undefined) ||
        ((globalThis as any).__effectAtlas as EffectAtlas | undefined)
    );
}

function pickResolvedDir(skinDirs: Partial<Record<EffectDir, any>>, desired: EffectDir, fallback: EffectDir): any {
    if (skinDirs[desired]) return skinDirs[desired];
    if (skinDirs[fallback]) return skinDirs[fallback];
    const firstKey = Object.keys(skinDirs)[0] as EffectDir | undefined;
    return firstKey ? skinDirs[firstKey] : null;
}

export function applyEffectAnimationForSprite(sprite: Phaser.GameObjects.Sprite): void {
    const scene = sprite.scene;
    const data = sprite.getDataManager ? sprite.getDataManager() : sprite.data;
    if (!data) return;

    const skinIdRaw =
        (data.get(EFFECT_SKIN_KEY) as string | undefined) ||
        (data.get("effectSkinId") as string | undefined) ||
        "";

    const skinId = String(skinIdRaw || "").trim();
    if (!skinId) return;

    const atlas = getEffectAtlasFromScene(scene);
    if (!atlas) {
        try {
            const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
            const g: any = globalThis as any;
            if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
                g.__heEffectDebug.mark(dbgId, "atlas_missing", { skin: skinId }, true);
            }
        } catch { }
        return;
    }

    const skin = atlas[skinId];
    if (!skin) {
        try {
            const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
            const g: any = globalThis as any;
            if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
                g.__heEffectDebug.mark(dbgId, "skin_missing", { skin: skinId }, true);
            }
        } catch { }
        return;
    }

    const dirRaw = (data.get(EFFECT_DIR_KEY) as string | undefined) || "";
    const dir = (dirRaw as EffectDir) || skin.defaultDir || "down";

    const resolved = pickResolvedDir(skin.dirs, dir, skin.defaultDir || "down");
    if (!resolved) {
        try {
            const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
            const g: any = globalThis as any;
            if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
                g.__heEffectDebug.mark(dbgId, "clip_missing", { skin: skinId, dir }, true);
            }
        } catch { }
        return;
    }

    const lastSkin = data.get(LAST_EFFECT_SKIN_KEY) as string | undefined;
    const lastDir = data.get(LAST_EFFECT_DIR_KEY) as string | undefined;
    const lastAnim = data.get(LAST_EFFECT_ANIM_KEY) as string | undefined;

    const safeSkin = skinId.replace(/\s+/g, "_").toLowerCase();
    const dirKey = String(dir || skin.defaultDir || "down").toLowerCase();
    const animKey = `effect_${safeSkin}_${dirKey}`;

    if (lastAnim && lastAnim === animKey && lastSkin === skinId && lastDir === dirKey) {
        return;
    }

    const mgr = scene.anims;
    if (!mgr.exists(animKey)) {
        mgr.create({
            key: animKey,
            frames: mgr.generateFrameNumbers(resolved.textureKey, { frames: resolved.frameIndices }),
            frameRate: resolved.frameRate,
            repeat: resolved.repeat
        });
    }

    try {
        sprite.play(animKey, true);
    } catch { }

    data.set(LAST_EFFECT_ANIM_KEY, animKey);
    data.set(LAST_EFFECT_SKIN_KEY, skinId);
    data.set(LAST_EFFECT_DIR_KEY, dirKey);

    try {
        const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
        const g: any = globalThis as any;
        if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
            g.__heEffectDebug.mark(dbgId, "apply", {
                skin: skinId,
                dir: dirKey,
                animKey,
                textureKey: resolved.textureKey,
                frameCount: resolved.frameIndices.length
            }, true);
        }
    } catch { }
}

export function tryAttachEffectSprite(sprite: Phaser.GameObjects.Sprite): void {
    applyEffectAnimationForSprite(sprite);
}
