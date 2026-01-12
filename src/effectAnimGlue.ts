// src/effectAnimGlue.ts
import type Phaser from "phaser";
import type { EffectAtlas, EffectDir } from "./effectAtlas";

const EFFECT_SKIN_KEY = "effectSkin";
const EFFECT_DIR_KEY = "effectDir";

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
    if (!atlas) return;

    const skin = atlas[skinId];
    if (!skin) return;

    const dirRaw = (data.get(EFFECT_DIR_KEY) as string | undefined) || "";
    const dir = (dirRaw as EffectDir) || skin.defaultDir || "down";

    const resolved = pickResolvedDir(skin.dirs, dir, skin.defaultDir || "down");
    if (!resolved) return;

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
}

export function tryAttachEffectSprite(sprite: Phaser.GameObjects.Sprite): void {
    applyEffectAnimationForSprite(sprite);
}
