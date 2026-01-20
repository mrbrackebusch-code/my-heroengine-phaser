// monsterAnimGlue.ts
import type Phaser from "phaser";
import type { MonsterAtlas } from "./monsterAtlas";
import { MONSTER_AURA_FEET } from "./generated/monsterAuraFeet";

type Dir = "up" | "down" | "left" | "right";
type Phase = "walk" | "attack" | "death";

const ATTACK_INDEX_KEY = "atkIndex";
const ATTACK_REVERSE_KEY = "attackReverse";
const ATTACK_ONESHOT_KEY = "attackOneShot";
const ANIM_NO_RANDOM_KEY = "__animNoRandomStart";
const MONSTER_AURA_ALIAS: { [id: string]: string } = {
    "worm small": "small worm",
    "worm big": "big worm"
};

function resolveMonsterAuraId(monsterId: string): string {
    const key = (monsterId || "").trim().toLowerCase();
    return MONSTER_AURA_ALIAS[key] || key;
}

function overrideAttackDir(monsterId: string, attackIndex: number, dir: Dir): Dir {
    const id = (monsterId || "").trim().toLowerCase();
    if (id === "andromalius" && attackIndex === 2) {
        if (dir === "up") return "left";
        if (dir === "down") return "right";
    }
    return dir;
}

// Data keys we use on the Phaser sprite
const LAST_ANIM_KEY  = "__monsterLastAnimKey";
const LAST_PHASE_KEY = "__monsterLastPhase";
const LAST_DIR_KEY   = "__monsterLastDir";
const LAST_ATK_INDEX_KEY = "__monsterLastAttackIndex";
const LAST_ATK_REV_KEY = "__monsterLastAttackReverse";
const LAST_ATK_ONESHOT_KEY = "__monsterLastAttackOneShot";

// Fallback FPS if we don't have per-phase durations
const FALLBACK_WALK_FPS   = 4;
const FALLBACK_ATTACK_FPS = 4;
const FALLBACK_DEATH_FPS  = 4;

// ---------------------------------------------------------------------
// Helper: locate the MonsterAtlas regardless of where we stashed it.
// ---------------------------------------------------------------------
function getMonsterAtlasFromScene(scene?: Phaser.Scene | null): MonsterAtlas | undefined {
    const anyScene = scene as any;
    const fromRegistry = scene
        ? ((scene.registry?.get?.("monsterAtlas") as MonsterAtlas | undefined) || undefined)
        : undefined;

    return (
        // preferred: Phaser registry
        fromRegistry ||
        // also allow scene fields
        (anyScene?.monsterAtlas as MonsterAtlas | undefined) ||
        (anyScene?.__monsterAtlas as MonsterAtlas | undefined) ||
        // and global escape hatch
        ((globalThis as any).__monsterAtlas as MonsterAtlas | undefined)
    );
}

// ---------------------------------------------------------------------
// Helper: per-phase duration → FPS
// ---------------------------------------------------------------------
function getPhaseDurationMs(phase: Phase, data: any): number {
    if (!data || !data.get) return 0;

    if (phase === "death") {
        // Set by applyDamageToEnemyIndex on the MakeCode side
        return (data.get("deathAnimMs") as number) || 0;
    }

    if (phase === "attack") {
        // Set by updateEnemyHoming when an attack starts
        return (data.get("attackAnimMs") as number) || 0;
    }

    return 0;
}

function computePhaseFps(
    phase: Phase,
    frameCount: number,
    data: any
): number {
    const durationMs = getPhaseDurationMs(phase, data);

    if (durationMs > 0 && frameCount > 0) {
        const durationSec = durationMs / 1000;
        let fps = frameCount / durationSec;

        // Clamp to something sane so you don't get 0.0001 FPS or 200 FPS
        if (fps < 2) fps = 2;
        if (fps > 24) fps = 24;

        return fps;
    }

    // Fallback: your old global values
    if (phase === "walk")   return FALLBACK_WALK_FPS;
    if (phase === "attack") return FALLBACK_ATTACK_FPS;
    if (phase === "death")  return FALLBACK_DEATH_FPS;

    return FALLBACK_WALK_FPS;
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
    if (!scene || !(scene as any).anims || !sprite.anims) return;

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
    const monsterIdNorm = String(monsterIdRaw || "").trim().toLowerCase();
    const attackIndexRaw =
        (data.get(ATTACK_INDEX_KEY) as number | undefined) ??
        (data.get("attackIndex") as number | undefined);
    const attackIndex = Math.max(1, Number.isFinite(attackIndexRaw as number) ? (attackIndexRaw as number) | 0 : 1);
    const attackReverse =
        phase === "attack" &&
        !!((data.get(ATTACK_REVERSE_KEY) as any) || (data.get("__attackReverse") as any));
    const attackOneShot =
        phase === "attack" &&
        !!((data.get(ATTACK_ONESHOT_KEY) as any) || (data.get("__attackOneShot") as any));
    const noRandomStart = !!(data.get(ANIM_NO_RANDOM_KEY) as any);

    // Early-out if nothing changed since last tick
    const lastAnimKey  = data.get(LAST_ANIM_KEY)  as string | undefined;
    const lastPhase    = data.get(LAST_PHASE_KEY) as Phase  | undefined;
    const lastDir      = data.get(LAST_DIR_KEY)   as Dir    | undefined;
    const lastAtkIndex = data.get(LAST_ATK_INDEX_KEY) as number | undefined;
    const lastAtkRev   = data.get(LAST_ATK_REV_KEY) as number | undefined;
    const lastAtkOnce  = data.get(LAST_ATK_ONESHOT_KEY) as number | undefined;
    const currentAnim  = sprite.anims?.currentAnim?.key;

    if (
        lastAnimKey &&
        lastAnimKey === currentAnim &&
        lastPhase === phase &&
        lastDir   === dir &&
        (lastAtkIndex | 0) === (attackIndex | 0) &&
        (lastAtkRev | 0) === (attackReverse ? 1 : 0) &&
        (lastAtkOnce | 0) === (attackOneShot ? 1 : 0)
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

    let perPhase = phases[phase];
    if (phase === "attack" && Array.isArray(animSet.attacks)) {
        const attacks = animSet.attacks as Record<Dir, number[]>[];
        const idx = Math.min(attacks.length, Math.max(1, attackIndex)) - 1;
        if (attacks[idx]) perPhase = attacks[idx];
    }
    if (phase === "attack" && monsterIdNorm === "eyeball" && perPhase) {
        const trimmed: Record<Dir, number[]> = {} as any;
        for (const key of ["up", "down", "left", "right"] as Dir[]) {
            const frames = perPhase[key];
            if (frames && frames.length > 2) trimmed[key] = frames.slice(0, 2);
            else if (frames) trimmed[key] = frames.slice();
        }
        perPhase = trimmed;
    }
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

    const animDir = (phase === "attack") ? overrideAttackDir(animSet.id, attackIndex, dir) : dir;
    let frames = perPhase[animDir];
    if (!frames || frames.length === 0) {
        console.warn(
            "[MonsterAnimGlue] no frames for",
            animSet.id,
            "phase=",
            phase,
            "dir=",
            animDir,
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
    const dirKey   = animDir.toString().toLowerCase() as Dir;
    const attackKey = (phase === "attack") ? `_a${attackIndex}` : "";
    const revKey = (attackReverse ? "_rev" : "");
    const onceKey = (attackOneShot ? "_once" : "");
    const animKey  = `${safeMonsterId}_${phaseKey}${attackKey}_${dirKey}${revKey}${onceKey}`;

    if (attackReverse) frames = frames.slice().reverse();

    // Expose aura info for downstream consumers (telegraphs/projectile origins).
    if (animSet.auraTextureKey) {
        data.set("__monsterAuraTex", animSet.auraTextureKey);
        data.set("__monsterAuraFrameW", animSet.frameWidth | 0);
        data.set("__monsterAuraFrameH", animSet.frameHeight | 0);
        const auraId = resolveMonsterAuraId(animSet.id);
        const foot = MONSTER_AURA_FEET[auraId];
        if (!foot) {
            throw new Error(
                `[AURA-MISSING] Missing monster aura foot data for ${animSet.id}. Run: npm run gen-monster-feet`
            );
        }
        const dirFoot = (foot && (foot as any).dirs && (foot as any).dirs[dir]) ? (foot as any).dirs[dir] : foot;
        if (dirFoot && typeof dirFoot.footBottom === "number") {
            data.set("__monsterAuraFootBottom", dirFoot.footBottom | 0);
        }
        if (dirFoot && Array.isArray(dirFoot.outline)) {
            data.set("__monsterAuraOutline", dirFoot.outline);
        }
        if (dirFoot && typeof dirFoot.outlineSides === "number") {
            data.set("__monsterAuraOutlineSides", dirFoot.outlineSides | 0);
        }
        if (dirFoot && typeof dirFoot.minX === "number") {
            data.set("__monsterAuraMinX", dirFoot.minX | 0);
        }
        if (dirFoot && typeof dirFoot.minY === "number") {
            data.set("__monsterAuraMinY", dirFoot.minY | 0);
        }
        if (dirFoot && typeof dirFoot.maxX === "number") {
            data.set("__monsterAuraMaxX", dirFoot.maxX | 0);
        }
        if (dirFoot && typeof dirFoot.maxY === "number") {
            data.set("__monsterAuraMaxY", dirFoot.maxY | 0);
        }
        if (dirFoot && typeof dirFoot.centerX === "number") {
            data.set("__monsterAuraCenterX", dirFoot.centerX | 0);
        }
        if (dirFoot && typeof dirFoot.centerY === "number") {
            data.set("__monsterAuraCenterY", dirFoot.centerY | 0);
        }
    }

    const mgr = scene.anims;

    if (!mgr.exists(animKey)) {
        // Prefer a per-phase texture key if provided by the atlas
        const phaseTexture: Partial<Record<Phase, string>> | undefined = animSet.phaseTexture;

        const textureKey: string =
            (phaseTexture && phaseTexture[phase]) ||
            (animSet.textureKeys && animSet.textureKeys[0]) ||
            (animSet.textureKey as string) ||
            animSet.id;

        // FPS from per-sprite duration if present, otherwise fallback
        const fps = computePhaseFps(phase, frames.length, data);
        const repeat = (phase === "death" || attackOneShot) ? 0 : -1;

        if (false) {
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

        }

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
    if (isNewAnim && !noRandomStart) {
        sprite.anims.setProgress(Math.random());
    }
    if (noRandomStart) data.set(ANIM_NO_RANDOM_KEY, 0);

    // Remember last state so we can early-out next tick
    data.set(LAST_ANIM_KEY,  animKey);
    data.set(LAST_PHASE_KEY, phaseKey);
    data.set(LAST_DIR_KEY,   dirKey);
    data.set(LAST_ATK_INDEX_KEY, attackIndex | 0);
    data.set(LAST_ATK_REV_KEY, attackReverse ? 1 : 0);
    data.set(LAST_ATK_ONESHOT_KEY, attackOneShot ? 1 : 0);
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
