// monsterAnimGlue.ts
import type Phaser from "phaser";
import type { MonsterAtlas } from "./monsterAtlas";

type Dir = "up" | "down" | "left" | "right";
type Phase = "walk" | "attack" | "death";

// Data keys we use on the Phaser sprite
const LAST_ANIM_KEY  = "__monsterLastAnimKey";
const LAST_PHASE_KEY = "__monsterLastPhase";
const LAST_DIR_KEY   = "__monsterLastDir";

const MONSTER_WALK_FPS   = 4;   // nice and chill walk
const MONSTER_ATTACK_FPS = 4;  // a bit snappier
const MONSTER_DEATH_FPS  = 4;   // slow enough to see the death

// ---------------------------------------------------------------------
// Helper: locate the MonsterAtlas regardless of where we stashed it.
// ---------------------------------------------------------------------
function getMonsterAtlasFromScene(scene: Phaser.Scene): MonsterAtlas | undefined {
    const anyScene = scene as any;

    return (
        // preferred: Phaser registry
        (scene.registry?.get?.("monsterAtlas") as MonsterAtlas | undefined) ||
        // also allow scene fields
        (anyScene.monsterAtlas as MonsterAtlas | undefined) ||
        (anyScene.__monsterAtlas as MonsterAtlas | undefined) ||
        // and global escape hatch
        ((globalThis as any).__monsterAtlas as MonsterAtlas | undefined)
    );
}

// ---------------------------------------------------------------------
// Core: read data fields (monsterId/name/phase/dir) and play the right anim
// ---------------------------------------------------------------------
export function applyMonsterAnimationForSprite(
    sprite: Phaser.GameObjects.Sprite
): void {
    const scene = sprite.scene;
    const data = sprite.getDataManager ? sprite.getDataManager() : sprite.data;
    if (!data) return;

    const atlas = getMonsterAtlasFromScene(scene);
    if (!atlas) {
        // Atlas not built yet – just skip.
        return;
    }

    // Prefer explicit monsterId/monsterName; fall back to "name"
    const monsterIdRaw: string | undefined =
        (data.get("monsterId")   as string | undefined) ||
        (data.get("monsterName") as string | undefined) ||
        (data.get("name")        as string | undefined) ||
        (sprite.name             as string | undefined);

    if (!monsterIdRaw) {
        console.warn("[MonsterAnimGlue] sprite missing monster id/name", sprite);
        return;
    }

    const phase = ((data.get("phase") as Phase) || "walk") as Phase;
    const dir   = ((data.get("dir")   as Dir)   || "down") as Dir;

    // Early-out if nothing changed since last tick
    const lastAnimKey  = data.get(LAST_ANIM_KEY)  as string | undefined;
    const lastPhase    = data.get(LAST_PHASE_KEY) as Phase  | undefined;
    const lastDir      = data.get(LAST_DIR_KEY)   as Dir    | undefined;
    const currentAnim  = sprite.anims?.currentAnim?.key;

    if (
        lastAnimKey &&
        lastAnimKey === currentAnim &&
        lastPhase === phase &&
        lastDir   === dir
    ) {
        // Same animation, same phase + dir → no work
        return;
    }

    // -----------------------------------------------------------------
    // Look up the MonsterAnimSet in the atlas using the raw id.
    // Your atlas keys include "slime brown", "imp blue", etc.
    // -----------------------------------------------------------------
    const candidates = [
        monsterIdRaw,
        monsterIdRaw.toLowerCase(),
        monsterIdRaw.toUpperCase()
    ];

    let animSet: any = undefined;
    let chosenKey: string | undefined;

    for (const k of candidates) {
        if ((atlas as any)[k]) {
            animSet = (atlas as any)[k];
            chosenKey = k;
            break;
        }
    }

    if (!animSet) {
        console.warn("[MonsterAnimGlue] no animSet in atlas for", monsterIdRaw);
        return;
    }

    const phases = animSet.phases as {
        walk?:   Record<Dir, number[]>;
        attack?: Record<Dir, number[]>;
        death?:  Record<Dir, number[]>;
    };

    const perPhase = phases[phase];
    if (!perPhase) {
        console.warn(
            "[MonsterAnimGlue] no phase",
            phase,
            "for",
            animSet.id,
            "atlasKey=",
            chosenKey
        );
        return;
    }

    const frames = perPhase[dir];
    if (!frames || frames.length === 0) {
        console.warn(
            "[MonsterAnimGlue] no frames for",
            animSet.id,
            "phase=",
            phase,
            "dir=",
            dir,
            "perPhase=",
            perPhase
        );
        return;
    }

    // -----------------------------------------------------------------
    // Build / play Phaser animation
    // -----------------------------------------------------------------
    const safeMonsterId = monsterIdRaw.replace(/\s+/g, "_").toLowerCase();
    const phaseKey = phase.toString().toLowerCase() as Phase;
    const dirKey   = dir.toString().toLowerCase() as Dir;
    const animKey  = `${safeMonsterId}_${phaseKey}_${dirKey}`;

    const mgr = scene.anims;

    if (!mgr.exists(animKey)) {
        const textureKey: string = animSet.textureKeys
            ? animSet.textureKeys[0]
            : animSet.textureKey || animSet.id;

        // Pick FPS + repeat based on phase
        let fps: number;
        if (phase === "walk") {
            fps = MONSTER_WALK_FPS;
        } else if (phase === "attack") {
            fps = MONSTER_ATTACK_FPS;
        } else if (phase === "death") {
            fps = MONSTER_DEATH_FPS;
        } else {
            fps = MONSTER_WALK_FPS;
        }

        const repeat = (phase === "death") ? 0 : -1;

        console.log(
            "[MonsterAnimGlue] creating anim",
            animKey,
            "for monster=",
            animSet.id,
            "using texture=",
            textureKey,
            "phase=",
            phase,
            "frames=",
            frames,
            "fps=",
            fps,
            "repeat=",
            repeat
        );

        mgr.create({
            key: animKey,
            frames: frames.map((frameIndex: number) => ({
                key: textureKey,
                frame: frameIndex
            })),
            frameRate: fps,
            repeat
        });
    }

    const isNewAnim = lastAnimKey !== animKey;

    sprite.anims.play(animKey, true);

    // Randomize starting phase so large groups don't look like a marching band
    if (isNewAnim) {
        sprite.anims.setProgress(Math.random());
    }

    // Remember last state so we can early-out next tick
    data.set(LAST_ANIM_KEY,  animKey);
    data.set(LAST_PHASE_KEY, phaseKey);
    data.set(LAST_DIR_KEY,   dirKey);
}

// Tiny helper if you want it from arcadeCompat (returns success/fail)
export function tryAttachMonsterSprite(sprite: Phaser.GameObjects.Sprite): boolean {
    try {
        applyMonsterAnimationForSprite(sprite);
        return true;
    } catch (e) {
        console.warn("[monsterAnimGlue.tryAttachMonsterSprite] failed", e);
        return false;
    }
}
