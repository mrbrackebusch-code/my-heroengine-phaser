// src/effectAnimGlue.ts
import type Phaser from "phaser";
import type { EffectAtlas, EffectDir } from "./effectAtlas";
import type { MonsterAtlas } from "./monsterAtlas";
import { getMissingEffectSizeNames } from "./effectAtlas";
import { DEBUG_EFFECT_ANIMS } from "./debugFlags";

const EFFECT_SKIN_KEY = "effectSkin";
const EFFECT_DIR_KEY = "effectDir";
const EFFECT_DEBUG_ID_KEY = "effectDebugId";
const EFFECT_ANIM_DELAY_MS_KEY = "effectAnimDelayMs";
const EFFECT_ANIM_DELAY_START_MS_KEY = "effectAnimDelayStartMs";
const EFFECT_FRAME_WINDOW_MS_KEY = "effectFrameWindowMs";
const EFFECT_FRAME_WINDOW_START_KEY = "effectFrameWindowStart";
const EFFECT_FRAME_INDEX_KEY = "effectFrameIndex";
const EFFECT_FRAME_INDEX_IS_RAW_KEY = "effectFrameIndexIsRaw";
const EFFECT_FRAME_LIST_KEY = "effectFrameList";
const EFFECT_FRAME_LIST_IS_RAW_KEY = "effectFrameListIsRaw";
const EFFECT_YOYO_KEY = "effectYoyo";

const LAST_EFFECT_ANIM_KEY = "__effectLastAnimKey";
const LAST_EFFECT_SKIN_KEY = "__effectLastSkin";
const LAST_EFFECT_DIR_KEY = "__effectLastDir";
const MISSING_EFFECT_ONCE = new Set<string>();
const MISSING_EFFECT_TEX_ONCE = new Set<string>();
const EFFECT_PENDING_TEX_LOAD = new Set<string>();
const EFFECT_HIDE_MISSING_TEX_KEY = "__effectHideMissingTex";
const MONSTER_FRAME_PREFIX = "monsterframe:";

type MonsterFrameRef = {
    id: string;
    phase: "walk" | "attack" | "death";
    frameIndex: number;
};

function selectCenteredFrameWindow(
    frames: number[],
    windowCount: number
): { frames: number[]; start: number; end: number } {
    const total = frames.length | 0;
    if (windowCount >= total) return { frames: frames.slice(), start: 0, end: total - 1 };
    const center = Math.floor(total / 2);
    const left = Math.ceil((windowCount - 1) / 2);
    const right = (windowCount - 1) - left;
    let start = center - left;
    let end = center + right;

    if (start < 0) {
        end = Math.min(total - 1, end + (-start));
        start = 0;
    }
    if (end > total - 1) {
        const over = end - (total - 1);
        start = Math.max(0, start - over);
        end = total - 1;
    }
    return { frames: frames.slice(start, end + 1), start, end };
}

function _parseFrameList(raw: unknown, maxFrames: number): number[] | null {
    if (raw == null) return null;
    const max = Math.max(0, maxFrames | 0);
    if (Array.isArray(raw)) {
        const out: number[] = [];
        for (const v of raw) {
            const n = (typeof v === "number") ? v : parseInt(String(v || ""), 10);
            if (!Number.isFinite(n)) continue;
            const idx = Math.max(0, Math.min(max - 1, n | 0));
            out.push(idx);
        }
        return out.length ? out : null;
    }
    if (typeof raw === "number") {
        if (!Number.isFinite(raw)) return null;
        const idx = Math.max(0, Math.min(max - 1, raw | 0));
        return [idx];
    }
    const s = String(raw || "").trim();
    if (!s) return null;
    const out: number[] = [];
    const tokens = s.split(/[\s,]+/);
    for (const tok of tokens) {
        if (!tok) continue;
        const rangeMatch = tok.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
        if (rangeMatch) {
            const a = parseInt(rangeMatch[1], 10);
            const b = parseInt(rangeMatch[2], 10);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            const step = a <= b ? 1 : -1;
            for (let v = a; step > 0 ? v <= b : v >= b; v += step) {
                const idx = Math.max(0, Math.min(max - 1, v | 0));
                out.push(idx);
            }
            continue;
        }
        const n = parseInt(tok, 10);
        if (!Number.isFinite(n)) continue;
        const idx = Math.max(0, Math.min(max - 1, n | 0));
        out.push(idx);
    }
    return out.length ? out : null;
}

function _parseBool(raw: unknown): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return Number.isFinite(raw) && raw !== 0;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        return s === "1" || s === "true" || s === "yes" || s === "on";
    }
    return false;
}

function _buildRawToLogical(frames: number[]): Map<number, number> {
    const map = new Map<number, number>();
    for (let i = 0; i < frames.length; i++) {
        map.set(frames[i] | 0, i | 0);
    }
    return map;
}

function getEffectAtlasFromScene(scene: Phaser.Scene): EffectAtlas | undefined {
    const anyScene = scene as any;
    return (
        (scene.registry?.get?.("effectAtlas") as EffectAtlas | undefined) ||
        (anyScene.effectAtlas as EffectAtlas | undefined) ||
        (anyScene.__effectAtlas as EffectAtlas | undefined) ||
        ((globalThis as any).__effectAtlas as EffectAtlas | undefined)
    );
}

function getMonsterAtlasFromScene(scene: Phaser.Scene): MonsterAtlas | undefined {
    const anyScene = scene as any;
    return (
        (scene.registry?.get?.("monsterAtlas") as MonsterAtlas | undefined) ||
        (anyScene.monsterAtlas as MonsterAtlas | undefined) ||
        (anyScene.__monsterAtlas as MonsterAtlas | undefined) ||
        ((globalThis as any).__monsterAtlas as MonsterAtlas | undefined)
    );
}

function parseMonsterFrameSkin(skinId: string): MonsterFrameRef | null {
    if (!skinId) return null;
    const raw = String(skinId || "").trim();
    if (!raw.toLowerCase().startsWith(MONSTER_FRAME_PREFIX)) return null;
    const parts = raw.slice(MONSTER_FRAME_PREFIX.length).split(":");
    if (parts.length < 3) return null;
    const idToken = String(parts[0] || "").trim();
    const phaseRaw = String(parts[1] || "").trim().toLowerCase();
    const frameRaw = parseInt(String(parts[2] || "").trim(), 10);
    if (!idToken) return null;
    if (phaseRaw !== "walk" && phaseRaw !== "attack" && phaseRaw !== "death") return null;
    if (!Number.isFinite(frameRaw) || frameRaw <= 0) return null;
    const id = idToken.replace(/_/g, " ");
    return { id, phase: phaseRaw as MonsterFrameRef["phase"], frameIndex: frameRaw | 0 };
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

    const dirRaw = (data.get(EFFECT_DIR_KEY) as string | undefined) || "";
    const dir = (dirRaw as EffectDir) || "none";

    const monsterFrame = parseMonsterFrameSkin(skinId);
    if (monsterFrame) {
        const delayRaw = data.get(EFFECT_ANIM_DELAY_MS_KEY);
        const delayMs = (typeof delayRaw === "number") ? delayRaw : Number(delayRaw);
        if (Number.isFinite(delayMs) && delayMs > 0) {
            const nowMs = (scene.time && typeof scene.time.now === "number") ? scene.time.now : Date.now();
            let startMsRaw = data.get(EFFECT_ANIM_DELAY_START_MS_KEY);
            let startMs = (typeof startMsRaw === "number") ? startMsRaw : Number(startMsRaw);
            if (!(startMs > 0)) {
                startMs = nowMs | 0;
                try { data.set(EFFECT_ANIM_DELAY_START_MS_KEY, startMs | 0); } catch { }
            }
            if (nowMs < ((startMs | 0) + (delayMs | 0))) return;
        }

        const monsterAtlas = getMonsterAtlasFromScene(scene);
        if (!monsterAtlas) return;
        const keyRaw = monsterFrame.id;
        const animSet =
            monsterAtlas[keyRaw] ||
            monsterAtlas[keyRaw.toLowerCase()] ||
            monsterAtlas[keyRaw.toUpperCase()];
        if (!animSet) return;

        let perPhase = (animSet.phases as any)?.[monsterFrame.phase] as any;
        if (monsterFrame.phase === "attack" && Array.isArray(animSet.attacks) && animSet.attacks.length > 0) {
            perPhase = animSet.attacks[0];
        }
        if (!perPhase) return;

        const dirKeyRaw = String(dirRaw || "").trim().toLowerCase();
        const dirKey = (dirKeyRaw === "none" || !dirKeyRaw) ? "down" : dirKeyRaw;
        const frames =
            (perPhase as any)[dirKey] ||
            (perPhase as any).down ||
            (perPhase as any).up ||
            (perPhase as any).left ||
            (perPhase as any).right;
        if (!frames || !frames.length) return;

        const idx = Math.min(frames.length - 1, Math.max(0, (monsterFrame.frameIndex | 0) - 1)) | 0;
        const frame = frames[idx];
        const texKey =
            (animSet.phaseTexture && (animSet.phaseTexture as any)[monsterFrame.phase]) ||
            (animSet.textureKeys && animSet.textureKeys[0]) ||
            "";
        if (!texKey) return;

        if (!(scene.textures && scene.textures.exists(texKey))) return;

        try {
            sprite.setTexture(texKey, frame);
            if (sprite.anims && sprite.anims.isPlaying) sprite.anims.stop();
        } catch { }

        const animKey = `effect_${monsterFrame.id.replace(/\\s+/g, "_").toLowerCase()}_${monsterFrame.phase}_${monsterFrame.frameIndex}_${dirKey}`;
        try {
            data.set(LAST_EFFECT_SKIN_KEY, skinId);
            data.set(LAST_EFFECT_DIR_KEY, dirKey);
            data.set(LAST_EFFECT_ANIM_KEY, animKey);
        } catch { }
        return;
    }

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

    const texKey = resolved.textureKey;
    const texExists = !!(texKey && scene.textures && scene.textures.exists(texKey));
    if (!texExists) {
        if (!MISSING_EFFECT_TEX_ONCE.has(texKey)) {
            MISSING_EFFECT_TEX_ONCE.add(texKey);
            console.error(
                "[effectAnim] Missing texture for effect",
                { skin: resolvedId, textureKey: texKey }
            );
        }

        try {
            data.set(EFFECT_HIDE_MISSING_TEX_KEY, 1);
            sprite.setVisible(false);
        } catch { }

        if (resolved.url && scene.load && typeof scene.load.spritesheet === "function") {
            if (!EFFECT_PENDING_TEX_LOAD.has(texKey)) {
                EFFECT_PENDING_TEX_LOAD.add(texKey);
                try {
                    scene.load.spritesheet(texKey, resolved.url, {
                        frameWidth: resolved.frameW,
                        frameHeight: resolved.frameH
                    });
                } catch { }

                try {
                    scene.load.once("complete", () => {
                        EFFECT_PENDING_TEX_LOAD.delete(texKey);
                    });
                    if (!scene.load.isLoading()) scene.load.start();
                } catch { }
            }
        }
        return;
    }

    const frameIndexIsRaw = _parseBool(data.get(EFFECT_FRAME_INDEX_IS_RAW_KEY));
    const frameListIsRaw = _parseBool(data.get(EFFECT_FRAME_LIST_IS_RAW_KEY));
    const rawToLogical = (frameIndexIsRaw || frameListIsRaw) ? _buildRawToLogical(resolved.frameIndices) : null;

    const frameIndexRaw = data.get(EFFECT_FRAME_INDEX_KEY);
    const frameIndex = (typeof frameIndexRaw === "number") ? frameIndexRaw : Number(frameIndexRaw);
    if (Number.isFinite(frameIndex) && frameIndex >= 0) {
        const frames = resolved.frameIndices;
        if (!frames || !frames.length) return;
        let logicalIdx = frameIndex | 0;
        if (frameIndexIsRaw && rawToLogical) {
            const mapped = rawToLogical.get(logicalIdx | 0);
            if (mapped != null) logicalIdx = mapped | 0;
        }
        const idx = Math.min(frames.length - 1, Math.max(0, logicalIdx | 0));
        const frame = frames[idx];
        try {
            sprite.setTexture(resolved.textureKey, frame);
            if (sprite.anims && sprite.anims.isPlaying) sprite.anims.stop();
        } catch { }

        const hidMissing = !!data.get(EFFECT_HIDE_MISSING_TEX_KEY);
        if (hidMissing) {
            try {
                data.set(EFFECT_HIDE_MISSING_TEX_KEY, 0);
                sprite.setVisible(true);
            } catch { }
        }

        try {
            data.set(LAST_EFFECT_SKIN_KEY, resolvedId);
            data.set(LAST_EFFECT_DIR_KEY, String(dir || "none").toLowerCase());
            data.set(LAST_EFFECT_ANIM_KEY, `manual_${resolvedId}`);
        } catch { }
        return;
    }

    const delayRaw = data.get(EFFECT_ANIM_DELAY_MS_KEY);
    const delayMs = (typeof delayRaw === "number") ? delayRaw : Number(delayRaw);
    if (Number.isFinite(delayMs) && delayMs > 0) {
        const nowMs = (scene.time && typeof scene.time.now === "number") ? scene.time.now : Date.now();
        let startMsRaw = data.get(EFFECT_ANIM_DELAY_START_MS_KEY);
        let startMs = (typeof startMsRaw === "number") ? startMsRaw : Number(startMsRaw);
        if (!(startMs > 0)) {
            startMs = nowMs | 0;
            try { data.set(EFFECT_ANIM_DELAY_START_MS_KEY, startMs | 0); } catch { }
        }
        if (nowMs < ((startMs | 0) + (delayMs | 0))) {
            try {
                sprite.setTexture(resolved.textureKey, resolved.frameIndices[0]);
                if (sprite.anims && sprite.anims.isPlaying) sprite.anims.stop();
            } catch { }
            const hidMissing = !!data.get(EFFECT_HIDE_MISSING_TEX_KEY);
            if (hidMissing) {
                try {
                    data.set(EFFECT_HIDE_MISSING_TEX_KEY, 0);
                    sprite.setVisible(true);
                } catch { }
            }
            return;
        }
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

    const windowMsRaw = data.get(EFFECT_FRAME_WINDOW_MS_KEY);
    const windowMs = (typeof windowMsRaw === "number") ? windowMsRaw : Number(windowMsRaw);
    const windowStartRaw = data.get(EFFECT_FRAME_WINDOW_START_KEY);
    const windowStart = (typeof windowStartRaw === "number") ? windowStartRaw : Number(windowStartRaw);
    const frameListRaw = data.get(EFFECT_FRAME_LIST_KEY);
    const frameList = _parseFrameList(frameListRaw, resolved.frameIndices.length);
    const yoyoRaw = data.get(EFFECT_YOYO_KEY);
    let yoyo = false;
    if (typeof yoyoRaw === "boolean") yoyo = yoyoRaw;
    else if (typeof yoyoRaw === "number") yoyo = yoyoRaw !== 0;
    else if (typeof yoyoRaw === "string") {
        const s = yoyoRaw.trim().toLowerCase();
        yoyo = s === "1" || s === "true" || s === "yes" || s === "on";
    }

    let useFrames = resolved.frameIndices;
    let frameWindowCount = 0;
    let frameWindowStart = 0;
    let frameWindowEnd = useFrames.length ? (useFrames.length - 1) : 0;
    let usingFrameList = false;
    if (frameList && frameList.length) {
        const mapped: number[] = [];
        for (const idx of frameList) {
            if (!(idx >= 0)) continue;
            let logicalIdx = idx | 0;
            if (frameListIsRaw && rawToLogical) {
                const mappedIdx = rawToLogical.get(logicalIdx | 0);
                if (mappedIdx != null) logicalIdx = mappedIdx | 0;
            }
            if (logicalIdx >= resolved.frameIndices.length) continue;
            mapped.push(resolved.frameIndices[logicalIdx]);
        }
        if (mapped.length) {
            useFrames = mapped;
            usingFrameList = true;
            frameWindowCount = mapped.length | 0;
            frameWindowStart = 0;
            frameWindowEnd = mapped.length ? (mapped.length - 1) : 0;
        }
    }
    if (!usingFrameList) {
        if (Number.isFinite(windowMs) && windowMs > 0 && frameRate > 0) {
            const calc = Math.floor((windowMs * frameRate) / 1000);
            frameWindowCount = Math.max(1, Math.min(useFrames.length, calc | 0));
            if (frameWindowCount > 0 && frameWindowCount < useFrames.length) {
                const useStartOverride = Number.isFinite(windowStart) && (windowStart | 0) >= 0;
                if (useStartOverride) {
                    const startIdx = Math.max(0, Math.min(useFrames.length - 1, windowStart | 0));
                    const endIdx = Math.max(startIdx, Math.min(useFrames.length - 1, (startIdx + frameWindowCount - 1) | 0));
                    useFrames = useFrames.slice(startIdx, endIdx + 1);
                    frameWindowStart = startIdx | 0;
                    frameWindowEnd = endIdx | 0;
                } else {
                    const picked = selectCenteredFrameWindow(useFrames, frameWindowCount | 0);
                    useFrames = picked.frames;
                    frameWindowStart = picked.start | 0;
                    frameWindowEnd = picked.end | 0;
                }
            } else {
                frameWindowStart = 0;
                frameWindowEnd = useFrames.length ? (useFrames.length - 1) : 0;
            }
        } else {
            frameWindowStart = 0;
            frameWindowEnd = useFrames.length ? (useFrames.length - 1) : 0;
        }
    }

    const safeSkin = resolvedId.replace(/\s+/g, "_").toLowerCase();
    const dirKey = String(dir || "none").toLowerCase();
    const animKeyBase = (frameRate === resolved.frameRate && repeat === resolved.repeat && !yoyo)
        ? `effect_${safeSkin}`
        : `effect_${safeSkin}_fps${frameRate}_r${repeat}${yoyo ? "_y" : ""}`;
    const listKey = usingFrameList ? `_list${useFrames.join("_")}` : "";
    const animKey = (usingFrameList || useFrames.length < resolved.frameIndices.length)
        ? `${animKeyBase}${listKey}_w${useFrames.length}_s${frameWindowStart}`
        : animKeyBase;

    if (lastAnim && lastAnim === animKey && lastSkin === resolvedId && lastDir === dirKey) {
        return;
    }

    const mgr = scene.anims;
    if (!mgr.exists(animKey)) {
        mgr.create({
            key: animKey,
            frames: mgr.generateFrameNumbers(resolved.textureKey, { frames: useFrames }),
            frameRate,
            repeat,
            yoyo
        });
    }

    let played = false;
    let playErr = "";
    try {
        sprite.play(animKey, true);
        played = true;
    } catch (err) {
        playErr = (err instanceof Error) ? err.message : String(err || "");
    }

    const hidMissing = !!data.get(EFFECT_HIDE_MISSING_TEX_KEY);
    if (hidMissing) {
        try {
            data.set(EFFECT_HIDE_MISSING_TEX_KEY, 0);
            sprite.setVisible(true);
        } catch { }
    }

    if (DEBUG_EFFECT_ANIMS) {
        const curAnim = sprite.anims ? sprite.anims.currentAnim : null;
        console.log(
            "[EFFECT][ANIM]" +
            " skin=" + resolvedId +
            " dir=" + dirKey +
            " anim=" + animKey +
            " tex=" + resolved.textureKey +
            " texExists=" + (texExists ? 1 : 0) +
            " frames=" + (resolved.frameIndices.length | 0) +
            " listFrames=" + (usingFrameList ? (useFrames.length | 0) : 0) +
            " yoyo=" + (yoyo ? 1 : 0) +
            " fps=" + (frameRate | 0) +
            " repeat=" + (repeat | 0) +
            " played=" + (played ? 1 : 0) +
            " err=" + (playErr || "") +
            " windowMs=" + (Number.isFinite(windowMs) ? (windowMs | 0) : 0) +
            " windowFrames=" + (useFrames.length | 0) +
            " windowStart=" + (frameWindowStart | 0) +
            " windowEnd=" + (frameWindowEnd | 0) +
            " curAnim=" + (curAnim ? curAnim.key : "") +
            " isPlaying=" + (sprite.anims ? (sprite.anims.isPlaying ? 1 : 0) : 0) +
            " nativeTex=" + ((sprite as any).texture?.key ?? "") +
            " nativeFrame=" + ((sprite as any).frame?.name ?? "") +
            " visible=" + (((sprite as any).visible ?? true) ? 1 : 0) +
            " alpha=" + ((sprite as any).alpha ?? 1) +
            " depth=" + ((sprite as any).depth ?? 0) +
            " displayW=" + ((sprite as any).displayWidth ?? (sprite as any).width ?? 0) +
            " displayH=" + ((sprite as any).displayHeight ?? (sprite as any).height ?? 0) +
            " hasAnims=" + ((sprite as any).anims ? 1 : 0)
        );
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
