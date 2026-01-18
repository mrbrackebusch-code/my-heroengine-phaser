// src/effectAnimGlue.ts
import type Phaser from "phaser";
import type { EffectAtlas, EffectDir } from "./effectAtlas";
import { getMissingEffectSizeNames } from "./effectAtlas";
import { DEBUG_EFFECT_ANIMS } from "./debugFlags";

const EFFECT_SKIN_KEY = "effectSkin";
const EFFECT_DIR_KEY = "effectDir";
const EFFECT_DEBUG_ID_KEY = "effectDebugId";

const LAST_EFFECT_ANIM_KEY = "__effectLastAnimKey";
const LAST_EFFECT_SKIN_KEY = "__effectLastSkin";
const LAST_EFFECT_DIR_KEY = "__effectLastDir";
const MISSING_EFFECT_ONCE = new Set<string>();

function getEffectAtlasFromScene(scene: Phaser.Scene): EffectAtlas | undefined {
    const anyScene = scene as any;
    return (
        (scene.registry?.get?.("effectAtlas") as EffectAtlas | undefined) ||
        (anyScene.effectAtlas as EffectAtlas | undefined) ||
        (anyScene.__effectAtlas as EffectAtlas | undefined) ||
        ((globalThis as any).__effectAtlas as EffectAtlas | undefined)
    );
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

    const dirRaw = (data.get(EFFECT_DIR_KEY) as string | undefined) || "";
    const dir = (dirRaw as EffectDir) || "none";

    let resolved = atlas[skinId];
    let resolvedId = skinId;
    if (!resolved && dirRaw) {
        const dirLower = String(dirRaw || "").trim().toLowerCase();
        const suffixes = [`_${dirLower}`, `-${dirLower}`, ` ${dirLower}`];
        for (const suffix of suffixes) {
            const candidate = `${skinId}${suffix}`;
            if (atlas[candidate]) {
                resolved = atlas[candidate];
                resolvedId = candidate;
                break;
            }
        }
    }

    if (!resolved) {
        if (!MISSING_EFFECT_ONCE.has(skinId)) {
            MISSING_EFFECT_ONCE.add(skinId);
            const missing = getMissingEffectSizeNames();
            const missingMsg = missing.length <= 6
                ? (missing.length ? ` Missing-size sheets: ${missing.join(", ")}` : "")
                : ` Missing-size sheets: ${missing.length} files.`;
            console.error(
                `[effectAnim] Missing effect \"${skinId}\". ` +
                `Effect sheets must include WxH in filename (e.g. \"${skinId} 32x32.png\").` +
                missingMsg
            );
        }
        try {
            const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
            const g: any = globalThis as any;
            if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
                g.__heEffectDebug.mark(dbgId, "skin_missing", { skin: skinId, dir }, true);
            }
        } catch { }
        return;
    }

    const lastSkin = data.get(LAST_EFFECT_SKIN_KEY) as string | undefined;
    const lastDir = data.get(LAST_EFFECT_DIR_KEY) as string | undefined;
    const lastAnim = data.get(LAST_EFFECT_ANIM_KEY) as string | undefined;

    const fpsOverrideRaw = data.get("effectFps") ?? data.get("effectFrameRate");
    const repeatOverrideRaw = data.get("effectRepeat");
    const fpsOverride = (typeof fpsOverrideRaw === "number") ? fpsOverrideRaw : Number(fpsOverrideRaw);
    const repeatOverride = (typeof repeatOverrideRaw === "number") ? repeatOverrideRaw : Number(repeatOverrideRaw);

    const frameRate = (Number.isFinite(fpsOverride) && fpsOverride > 0)
        ? (fpsOverride as number)
        : resolved.frameRate;
    const repeat = (Number.isFinite(repeatOverride))
        ? (repeatOverride as number)
        : resolved.repeat;

    const safeSkin = resolvedId.replace(/\s+/g, "_").toLowerCase();
    const dirKey = String(dir || "none").toLowerCase();
    const animKey = (frameRate === resolved.frameRate && repeat === resolved.repeat)
        ? `effect_${safeSkin}`
        : `effect_${safeSkin}_fps${frameRate}_r${repeat}`;

    if (lastAnim && lastAnim === animKey && lastSkin === resolvedId && lastDir === dirKey) {
        return;
    }

    const mgr = scene.anims;
    if (!mgr.exists(animKey)) {
        mgr.create({
            key: animKey,
            frames: mgr.generateFrameNumbers(resolved.textureKey, { frames: resolved.frameIndices }),
            frameRate,
            repeat
        });
    }

    let played = false;
    try {
        sprite.play(animKey, true);
        played = true;
    } catch { }

    if (DEBUG_EFFECT_ANIMS) {
        const curAnim = sprite.anims ? sprite.anims.currentAnim : null;
        console.log("[effectAnim] apply", {
            skin: resolvedId,
            dir: dirKey,
            animKey,
            textureKey: resolved.textureKey,
            frameCount: resolved.frameIndices.length,
            fps: frameRate,
            repeat,
            played,
            curAnimKey: curAnim ? curAnim.key : "",
            isPlaying: sprite.anims ? !!sprite.anims.isPlaying : false,
            nativeTex: (sprite as any).texture?.key ?? "",
            nativeFrame: (sprite as any).frame?.name ?? ""
        });
    }

    data.set(LAST_EFFECT_ANIM_KEY, animKey);
    data.set(LAST_EFFECT_SKIN_KEY, resolvedId);
    data.set(LAST_EFFECT_DIR_KEY, dirKey);

    try {
        const dbgId = (data.get(EFFECT_DEBUG_ID_KEY) as number | undefined) || 0;
        const g: any = globalThis as any;
        if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId) {
            g.__heEffectDebug.mark(dbgId, "apply", {
                skin: resolvedId,
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
