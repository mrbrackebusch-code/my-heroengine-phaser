import type { StudentApi, StudentRuntimeContext } from "../../studentSystemsHooks";
import { AMULETS, ensureAmuletInCoreCatalog } from "./amuletData";
import { showAmuletSelectionUI } from "./amuletSelectionUI";

const AMULET_CHEST_TEXTURE_KEY = "tiles.ProjectUtumno_full";
const AMULET_CHEST_TILE_COL = 35;
const AMULET_CHEST_TILE_ROW = 1;
const AMULET_CHEST_OPEN_DISTANCE_PX = 28;
const AMULET_CHEST_PROMPT_DISTANCE_PX = 54;
const AMULET_CHEST_OPEN_COOLDOWN_MS = 300;
const AMULET_CHEST_SCALE = 2;
const HERO_INDEX_DATA_KEY = "heroIndex";

type AmuletChestState = {
    scene: any | null;
    api: StudentApi | null;
    chestSprite: any | null;
    titleText: any | null;
    promptText: any | null;
    floorKey: string;
    claimed: boolean;
    uiOpen: boolean;
    spawnReadyAtMs: number;
    baseX: number;
    baseY: number;
    interactKey: any | null;
    wasInteractKeyDown: boolean;
};

const state: AmuletChestState = {
    scene: null,
    api: null,
    chestSprite: null,
    titleText: null,
    promptText: null,
    floorKey: "",
    claimed: false,
    uiOpen: false,
    spawnReadyAtMs: 0,
    baseX: 0,
    baseY: 0,
    interactKey: null,
    wasInteractKeyDown: false,
};

function getInternals(): any {
    const g = globalThis as any;
    return g ? g.__HeroEnginePhaserInternals : null;
}

function getLocalHeroIndex(): number {
    const g = globalThis as any;
    const internals = getInternals();
    const localProfile = (typeof g?.__localHeroProfileName === "string" && g.__localHeroProfileName.trim())
        ? g.__localHeroProfileName.trim()
        : "";

    if (internals && typeof internals.getHeroIndexForProfile === "function" && localProfile) {
        const hi = internals.getHeroIndexForProfile(localProfile) | 0;
        if (hi >= 0) return hi;
    }

    // allOfKind is not implemented; use _getAllSprites fallback
    const spritesNS: any = (globalThis as any).sprites;
    const all: any[] = (spritesNS && typeof spritesNS._getAllSprites === "function")
        ? (spritesNS._getAllSprites() as any[])
        : [];
    for (let i = 0; i < all.length; i++) {
        const s = all[i];
        if (!s) continue;
        const hi = sprites.readDataNumber(s, HERO_INDEX_DATA_KEY) | 0;
        if (hi >= 0) return hi;
    }

    return 0;
}

function getFloorKey(): string {
    const internals = getInternals();
    if (!internals) return "";

    const floorIndex = (typeof internals.getFloorIndex === "function") ? (internals.getFloorIndex() | 0) : -1;
    const floorKind = (typeof internals.getFloorKind === "function") ? String(internals.getFloorKind() || "") : "";
    return `${floorIndex}:${floorKind}`;
}

function isFirstFloorEntrance(): boolean {
    const internals = getInternals();
    if (!internals) return false;

    const floorKind = (typeof internals.getFloorKind === "function") ? String(internals.getFloorKind() || "") : "";
    return floorKind === "entrance";
}



function getChestFrameIndex(scene: any): number {
    try {
        const texture = scene?.textures?.get?.(AMULET_CHEST_TEXTURE_KEY);
        const sourceImage = texture?.source?.[0]?.image;
        const width = Number(sourceImage?.width || 0) | 0;
        const cols = Math.max(1, Math.floor(width / 32) | 0);
        return ((AMULET_CHEST_TILE_ROW * cols) + AMULET_CHEST_TILE_COL) | 0;
    } catch {
        return 0;
    }
}

function destroyChestVisuals(): void {
    if (state.chestSprite && typeof state.chestSprite.destroy === "function") state.chestSprite.destroy();
    if (state.titleText && typeof state.titleText.destroy === "function") state.titleText.destroy();
    if (state.promptText && typeof state.promptText.destroy === "function") state.promptText.destroy();
    state.chestSprite = null;
    state.titleText = null;
    state.promptText = null;
    state.baseX = 0;
    state.baseY = 0;
}

function computeChestPosition(): { x: number; y: number } | null {
    if (!state.scene) return null;
    // Use camera world-center — reliable regardless of sprite-kind issues
    const cam = state.scene.cameras?.main;
    if (cam) {
        return {
            x: (cam.scrollX + cam.width * 0.5) | 0,
            y: (cam.scrollY + cam.height * 0.5) | 0,
        };
    }
    return null;
}

function ensureChestVisuals(): void {
    if (!state.scene || state.chestSprite) return;

    const pos = computeChestPosition();
    if (!pos) return;

    const frameIndex = getChestFrameIndex(state.scene);

    state.baseX = pos.x | 0;
    state.baseY = pos.y | 0;
    state.spawnReadyAtMs = Date.now() + AMULET_CHEST_OPEN_COOLDOWN_MS;

    const chest = state.scene.add.image(state.baseX, state.baseY, AMULET_CHEST_TEXTURE_KEY, frameIndex);
    chest.setOrigin(0.5, 1);
    chest.setScale(AMULET_CHEST_SCALE);
    chest.setDepth((state.baseY | 0) + 1000);

    const title = state.scene.add.text(state.baseX, state.baseY - 58, "Amulet Chest", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#fff3b0",
        stroke: "#1a1a1a",
        strokeThickness: 3,
        align: "center",
    });
    title.setOrigin(0.5, 1);
    title.setDepth(chest.depth + 1);

    const prompt = state.scene.add.text(state.baseX, state.baseY - 30, "Press F to open", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#d7ecff",
        stroke: "#1a1a1a",
        strokeThickness: 3,
        align: "center",
    });
    prompt.setOrigin(0.5, 1);
    prompt.setDepth(chest.depth + 1);
    prompt.setVisible(true);

    state.chestSprite = chest;
    state.titleText = title;
    state.promptText = prompt;
}

function updateChestVisuals(nowMs: number): void {
    if (!state.chestSprite) return;

    // Position is locked on spawn — don't follow the player after that.

    const bob = Math.sin((nowMs | 0) * 0.004) * 2;
    const chestY = state.baseY + bob;
    state.chestSprite.setPosition(state.baseX, chestY);
    state.chestSprite.setDepth((chestY | 0) + 1000);

    if (state.titleText) {
        state.titleText.setPosition(state.baseX, chestY - 58);
        state.titleText.setDepth(state.chestSprite.depth + 1);
    }

    if (state.promptText) {
        state.promptText.setPosition(state.baseX, chestY - 30);
        state.promptText.setDepth(state.chestSprite.depth + 1);
    }
}

function openAmuletChest(): void {
    if (state.uiOpen || state.claimed || !state.api) return;

    state.uiOpen = true;
    showAmuletSelectionUI(state.api, (amuletId: string) => {
        const g = globalThis as any;
        const heroIndex = getLocalHeroIndex() | 0;

        ensureAmuletInCoreCatalog(amuletId);

        try {
            if (g && typeof g.addRelicToHero === "function") {
                g.addRelicToHero(heroIndex, amuletId);
                state.claimed = true;
            }
        } finally {
            state.uiOpen = false;
            if (state.claimed) destroyChestVisuals();
        }
    });
}

function onSceneUpdate(): void {
    const nowMs = Date.now() | 0;
    const floorKey = getFloorKey();
    if (floorKey !== state.floorKey) {
        state.floorKey = floorKey;
        destroyChestVisuals();
    }

    if (state.claimed || !isFirstFloorEntrance()) {
        destroyChestVisuals();
        return;
    }

    ensureChestVisuals();
    updateChestVisuals(nowMs);

    if (!state.chestSprite) return;

    // F key press — no distance gate; just works anywhere on the entrance floor
    const interactDown = !!state.interactKey?.isDown;
    const interactJustPressed = interactDown && !state.wasInteractKeyDown;
    state.wasInteractKeyDown = interactDown;

    if (!state.uiOpen && nowMs >= (state.spawnReadyAtMs | 0) && interactJustPressed) {
        openAmuletChest();
    }
}

export function initAmuletChestRuntime(ctx: StudentRuntimeContext): void {
    if (!ctx?.scene || state.scene === ctx.scene) {
        if (ctx?.api) state.api = ctx.api;
        return;
    }

    state.scene = ctx.scene;
    state.api = ctx.api;
    state.floorKey = "";
    state.claimed = false;
    state.uiOpen = false;
    state.spawnReadyAtMs = 0;
    state.baseX = 0;
    state.baseY = 0;
    state.interactKey = ctx.scene.input?.keyboard?.addKey?.("F") || null;
    state.wasInteractKeyDown = false;

    ctx.scene.events.on("update", onSceneUpdate);
    ctx.scene.events.once("shutdown", destroyChestVisuals);
    ctx.scene.events.once("destroy", destroyChestVisuals);
}

export function getAmuletCount(): number {
    return AMULETS.length | 0;
}