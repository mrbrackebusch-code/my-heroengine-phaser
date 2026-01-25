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
    const nextSrc = _toAbsUrl(url);
    const forceReload = _forceReload(textureKey);
    if (!forceReload && exists && existingSrc && existingSrc === nextSrc) return false;
    if (exists && (forceReload || (existingSrc && existingSrc !== nextSrc))) {
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
