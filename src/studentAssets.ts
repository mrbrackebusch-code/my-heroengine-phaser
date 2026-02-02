import type Phaser from "phaser";

export type StudentAssetKind = "image" | "spritesheet" | "atlas" | "audio" | "json";

export type StudentAsset = {
    kind: StudentAssetKind;
    key: string;
    url: string | string[];
    dataUrl?: string;
    frameWidth?: number;
    frameHeight?: number;
};

const _assetsByKey = new Map<string, StudentAsset>();

function _registerAsset(asset: StudentAsset): string {
    const key = String(asset?.key || "").trim();
    if (!key) return "";
    _assetsByKey.set(key, { ...asset, key });
    return key;
}

export function registerStudentImage(key: string, url: string | string[]): string {
    const k = String(key || "").trim();
    if (!k || !url) return "";
    return _registerAsset({ kind: "image", key: k, url });
}

export function registerStudentSpritesheet(
    key: string,
    url: string | string[],
    frameWidth: number,
    frameHeight: number
): string {
    const k = String(key || "").trim();
    const fw = frameWidth | 0;
    const fh = frameHeight | 0;
    if (!k || !url || fw <= 0 || fh <= 0) return "";
    return _registerAsset({ kind: "spritesheet", key: k, url, frameWidth: fw, frameHeight: fh });
}

export function registerStudentAtlas(key: string, imageUrl: string, atlasUrl: string): string {
    const k = String(key || "").trim();
    const img = String(imageUrl || "").trim();
    const data = String(atlasUrl || "").trim();
    if (!k || !img || !data) return "";
    return _registerAsset({ kind: "atlas", key: k, url: img, dataUrl: data });
}

export function registerStudentAudio(key: string, url: string | string[]): string {
    const k = String(key || "").trim();
    if (!k || !url) return "";
    return _registerAsset({ kind: "audio", key: k, url });
}

export function registerStudentJson(key: string, url: string | string[]): string {
    const k = String(key || "").trim();
    if (!k || !url) return "";
    return _registerAsset({ kind: "json", key: k, url });
}

export function listStudentAssets(): StudentAsset[] {
    return Array.from(_assetsByKey.values());
}

export function preloadStudentAssets(scene: Phaser.Scene): void {
    if (!scene || !scene.load) return;

    for (const asset of _assetsByKey.values()) {
        const key = asset.key;
        if (!key) continue;

        switch (asset.kind) {
            case "image":
                scene.load.image(key, asset.url as any);
                break;
            case "spritesheet":
                scene.load.spritesheet(key, asset.url as any, {
                    frameWidth: asset.frameWidth || 1,
                    frameHeight: asset.frameHeight || 1,
                });
                break;
            case "atlas":
                if (!asset.dataUrl) break;
                scene.load.atlas(key, asset.url as any, asset.dataUrl as any);
                break;
            case "audio":
                scene.load.audio(key, asset.url as any);
                break;
            case "json":
                scene.load.json(key, asset.url as any);
                break;
            default:
                break;
        }
    }
}
