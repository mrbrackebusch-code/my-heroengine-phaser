import type Phaser from "phaser";
import { DEBUG_EFFECT_FORCE_RELOAD } from "./debugFlags";

const FORCE_RELOAD_PREFIXES = ["effects."];

function _toAbsUrl(url: string): string {
    try {
        return new URL(url, window.location.href).toString();
    } catch {
        return url;
    }
}

function _forceReload(textureKey: string): boolean {
    if (!DEBUG_EFFECT_FORCE_RELOAD) return false;
    const key = String(textureKey || "");
    for (const prefix of FORCE_RELOAD_PREFIXES) {
        if (key.startsWith(prefix)) return true;
    }
    return false;
}

function _existingFrameSize(texture: any): { w: number; h: number } | null {
    if (!texture) return null;
    try {
        const names: any[] = (typeof texture.getFrameNames === "function") ? texture.getFrameNames() : [];
        for (const name of names) {
            if (name === "__BASE") continue;
            const fr = (typeof texture.get === "function") ? texture.get(name) : null;
            const w = fr?.width | 0;
            const h = fr?.height | 0;
            if (w > 0 && h > 0) return { w, h };
        }
        const base = (typeof texture.get === "function") ? texture.get("__BASE") : null;
        const bw = base?.width | 0;
        const bh = base?.height | 0;
        if (bw > 0 && bh > 0) return { w: bw, h: bh };
    } catch { }
    return null;
}

export function queueSpritesheetOnce(
    scene: Phaser.Scene,
    textureKey: string,
    url: string,
    frameWidth: number,
    frameHeight: number
): boolean {
    const tex: any = scene.textures as any;
    const exists = (tex && typeof tex.exists === "function") ? !!tex.exists(textureKey) : false;
    const existing = exists ? scene.textures.get(textureKey) : null;
    const existingSrc = existing?.getSourceImage?.()?.src;
    const existingSize = _existingFrameSize(existing);
    const nextSrc = _toAbsUrl(url);
    const forceReload = _forceReload(textureKey);
    const sizeMismatch = !!(
        existingSize &&
        ((existingSize.w | 0) !== (frameWidth | 0) || (existingSize.h | 0) !== (frameHeight | 0))
    );
    if (!forceReload && !sizeMismatch && exists && existingSrc && existingSrc === nextSrc) return false;
    if (exists && (forceReload || sizeMismatch || (existingSrc && existingSrc !== nextSrc))) {
        // Hot-reload friendly: drop the old texture so the new sheet can load.
        try { scene.textures.remove(textureKey); } catch { }
    }

    scene.load.spritesheet(textureKey, url, {
        frameWidth,
        frameHeight
    });
    return true;
}

export function queueAtlasOnce(
    scene: Phaser.Scene,
    textureKey: string,
    url: string,
    atlasData: any
): boolean {
    const tex: any = scene.textures;
    const forceReload = _forceReload(textureKey);
    if (tex && typeof tex.exists === "function") {
        if (tex.exists(textureKey)) {
            if (!forceReload) return false;
            try { scene.textures.remove(textureKey); } catch { }
        }
    } else {
        const existing = scene.textures.get(textureKey);
        const existingKey = (existing as any)?.key || "";
        if (existingKey && existingKey !== "__MISSING") {
            if (!forceReload) return false;
            try { scene.textures.remove(textureKey); } catch { }
        }
    }
    if (!url) return false;
    scene.load.atlas(textureKey, url, atlasData);
    return true;
}

export function queueBinaryOnce(
    scene: Phaser.Scene,
    cacheKey: string,
    url: string
): boolean {
    if (!scene || !scene.load || !scene.cache) return false;
    const binCache: any = (scene as any).cache?.binary;
    const exists = binCache && typeof binCache.get === "function"
        ? !!binCache.get(cacheKey)
        : false;
    if (exists) return false;
    if (!url) return false;
    try {
        (scene.load as any).binary(cacheKey, url);
        return true;
    } catch {
        return false;
    }
}
