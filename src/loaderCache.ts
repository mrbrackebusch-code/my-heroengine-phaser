import type Phaser from "phaser";

function _toAbsUrl(url: string): string {
    try {
        return new URL(url, window.location.href).toString();
    } catch {
        return url;
    }
}

export function queueSpritesheetOnce(
    scene: Phaser.Scene,
    textureKey: string,
    url: string,
    frameWidth: number,
    frameHeight: number
): boolean {
    const existing = scene.textures.get(textureKey);
    const existingSrc = existing?.getSourceImage?.()?.src;
    const nextSrc = _toAbsUrl(url);
    if (existing && existingSrc && existingSrc === nextSrc) return false;

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
    if (tex && typeof tex.exists === "function") {
        if (tex.exists(textureKey)) return false;
    } else {
        const existing = scene.textures.get(textureKey);
        if (existing) return false;
    }
    if (!url) return false;
    scene.load.atlas(textureKey, url, atlasData);
    return true;
}
