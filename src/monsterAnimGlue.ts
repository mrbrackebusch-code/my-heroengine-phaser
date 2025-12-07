// monsterAnimGlue.ts
import type Phaser from "phaser";
import {
    getMonsterAnimForSprite,
    type Phase as MonsterPhase
} from "./monsterAtlas";

type Dir = "up" | "down" | "left" | "right";
type Phase = "walk" | "attack" | "death";

/**
 * Reads name/phase/dir from a Phaser sprite's data and plays the right anim.
 * Uses the MonsterAtlas built in HeroScene.create().
 *
 * Expected animation keys: `${monsterId}_${phase}_${dir}`
 * e.g. "imp blue_walk_right"
 */
export function applyMonsterAnimationForSprite(
    sprite: Phaser.GameObjects.Sprite
): void {
    const scene = sprite.scene;
    if (!scene || !sprite.anims) return;

    const monsterIdRaw = (sprite.getData("name") as string) || "";
    if (!monsterIdRaw) return; // not one of our monsters

    const phase = ((sprite.getData("phase") as Phase) || "walk") as MonsterPhase;
    const dir   = (sprite.getData("dir")   as Dir)   || "down";

    // Look up atlas — HeroScene sets both a scene field and a global
    const anyScene: any = scene as any;
    const atlas =
        anyScene.__monsterAtlas || (globalThis as any).__monsterAtlas;
    if (!atlas) {
        // Atlas not ready yet; keep placeholder
        return;
    }

    const animSet = getMonsterAnimForSprite(atlas, sprite);
    if (!animSet) {
        console.warn("[MonsterAnimGlue] no animSet in atlas for", monsterIdRaw);
        return;
    }

    const perPhase = animSet.phases[phase];
    if (!perPhase) {
        console.warn("[MonsterAnimGlue] no phase", phase, "for", animSet.id);
        return;
    }

    const frames = perPhase[dir];
    if (!frames || frames.length === 0) {
        console.warn(
            "[MonsterAnimGlue] no frames for",
            "id=", animSet.id,
            "phase=", phase,
            "dir=", dir,
            "texKey=", sprite.texture && sprite.texture.key,
            "name=", sprite.getData("name"),
            "rawPhase=", sprite.getData("phase"),
            "rawDir=", sprite.getData("dir")
        );

        return;
    }

    const monsterId = animSet.id; // canonical id from atlas ("imp blue")
    const animKey = `${monsterId}_${phase}_${dir}`;
    const mgr = scene.anims;


    // Lazily create the animation on first use
    if (!mgr.exists(animKey)) {

        const phaseKey = Phaser.Utils.String.Trim(phase).toLowerCase() as SimplePhase;
        const dirKey = Phaser.Utils.String.Trim(dir).toLowerCase() as MonsterAnimDirKey;

        const perPhase = animSet.phases[phaseKey];
        if (!perPhase) {
            console.warn(`[MonsterAnimGlue] no phase data for id= ${monsterId} phase= ${phaseKey}`);
            return;
        }

        const frames = perPhase[dirKey];
        if (!frames || frames.length === 0) {
            console.warn(`[MonsterAnimGlue] no frames for id= ${monsterId} phase= ${phaseKey} dir= ${dirKey}`);
            return;
        }

        // --- Choose a texture key that matches this phase ---
        // Many LPC monsters use separate sheets (1Walk / 1Attack / 1Death),
        // so we try to pick the sheet whose name actually contains the phase.
        const tryMatch = (needle: string): string | undefined => {
            const n = needle.toLowerCase();
            for (const k of animSet.textureKeys) {
                if (k.toLowerCase().includes(n)) return k;
            }
            return undefined;
        };

        let texKey: string | undefined;

        // Direct phase match
        texKey = tryMatch(phaseKey);

        // Common aliases / fallbacks
        if (!texKey && phaseKey === "idle") {
            texKey = tryMatch("walk");
        }
        if (!texKey && phaseKey === "walk") {
            // Some sheets call it "move" instead of "walk"
            texKey = tryMatch("walk") || tryMatch("move");
        }
        if (!texKey && phaseKey === "attack") {
            texKey = tryMatch("attack") || tryMatch("atk");
        }
        if (!texKey && phaseKey === "death") {
            texKey = tryMatch("death");
        }

        // Ultimate fallback – if nothing matches, just use the first sheet
        if (!texKey) {
            texKey = animSet.textureKeys[0];
        }

        console.log("[MonsterAnimGlue] creating anim", animKey,
            "texKey=", texKey,
            "frames=", frames
        );

        mgr.create({
            key: animKey,
            frames: frames.map(f => ({ key: texKey!, frame: f })),
            frameRate: 8,
            repeat: -1
        });
    }




    // Avoid restarting the same animation every frame
    const currentKey = sprite.anims.currentAnim?.key;
    if (currentKey !== animKey) {
        sprite.play(animKey, true);
    }
}


export function tryAttachMonsterSprite(sprite: Phaser.GameObjects.Sprite): boolean {
    // This will read name/phase/dir from sprite.getData()
    try {
        return applyMonsterAnimationForSprite(sprite);
    } catch (e) {
        console.warn("[monsterAnimGlue.tryAttachMonsterSprite] failed", e);
        return false;
    }
}
