import Phaser from "phaser";
import { createStudentApi } from "./studentApi";
import { preloadStudentAssets } from "./studentAssets";
import type { StudentDebugApi, StudentDebugContext, StudentDebugDefinition, StudentDebugHeroSpawnOptions, StudentDebugProfileHeroOptions } from "./studentDebugApi";
import { debugSpawnHeroWithAnim } from "./heroAnimGlue";
import { getHeroAtlasFromScene, preloadHeroSheets, type HeroFamily } from "./heroAtlas";

const OVERLAY_MOUNT_ID = "debug-overlay-root";
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const STUDENT_INDEX_MODULES = import.meta.glob("./student/*/index.ts", { eager: true });
const STUDENT_DEBUG_MODULES = import.meta.glob("./student/*/debug.ts", { eager: true });

function _extractStudentName(path: string): string {
    const parts = String(path || "").split("/");
    const studentIndex = parts.indexOf("student");
    if (studentIndex >= 0 && parts.length > studentIndex + 1) {
        return parts[studentIndex + 1] || "";
    }
    return parts.length >= 2 ? parts[parts.length - 2] : "";
}

function _uniq(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        if (!item || seen.has(item)) continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}

const SPECIAL_STUDENTS = ["LongBlond"];

const STUDENT_NAMES = _uniq([...Object.keys(STUDENT_INDEX_MODULES).map(_extractStudentName), ...SPECIAL_STUDENTS])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

function _normalizeDebugModule(mod: any): StudentDebugDefinition | null {
    if (!mod) return null;

    const namedPreload = typeof mod.preload === "function" ? mod.preload : undefined;
    const namedCreate = typeof mod.create === "function" ? mod.create : undefined;
    const namedUpdate = typeof mod.update === "function" ? mod.update : undefined;

    if (namedPreload || namedCreate || namedUpdate) {
        return { preload: namedPreload, create: namedCreate, update: namedUpdate };
    }

    const candidate = mod.default || mod.studentDebug || mod.registerStudentDebug || mod.debug;
    if (typeof candidate === "function") {
        return { create: candidate };
    }

    if (candidate && typeof candidate === "object") {
        const preload = typeof candidate.preload === "function" ? candidate.preload : undefined;
        const create = typeof candidate.create === "function" ? candidate.create : undefined;
        const update = typeof candidate.update === "function" ? candidate.update : undefined;
        if (preload || create || update) return { preload, create, update };
    }

    return null;
}

const DEBUG_DEFS = new Map<string, StudentDebugDefinition>();
for (const [path, mod] of Object.entries(STUDENT_DEBUG_MODULES)) {
    const name = _extractStudentName(path);
    if (!name) continue;
    const def = _normalizeDebugModule(mod);
    if (def) DEBUG_DEFS.set(name, def);
}

function _getParam(name: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get(name);
        return raw ? decodeURIComponent(raw) : null;
    } catch {
        return null;
    }
}

function _setText(id: string, text: string): void {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _renderStudentList(current: string | null): void {
    if (typeof document === "undefined") return;
    const listEl = document.getElementById("debug-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    for (const name of STUDENT_NAMES) {
        const link = document.createElement("a");
        link.href = `debug.html?student=${encodeURIComponent(name)}`;
        link.textContent = name;
        if (current && name === current) link.classList.add("active");
        listEl.appendChild(link);
    }
}

function _setStatus(text: string): void {
    _setText("debug-status", text);
}

function _resolveHeroFamily(scene: Phaser.Scene, heroName: string): HeroFamily | null {
    const atlas = getHeroAtlasFromScene(scene);
    if (!atlas) return null;
    const match = Object.values(atlas).find((set) => set.heroName === heroName);
    return match ? match.family : null;
}

function _createHelpers(scene: Phaser.Scene, student: string) {
    const addLabel = (text: string, opts?: { x?: number; y?: number; fontSize?: number; color?: string }) => {
        const x = opts?.x ?? 16;
        const y = opts?.y ?? 16;
        const fontSize = opts?.fontSize ?? 16;
        const color = opts?.color ?? "#e7e9ee";
        return scene.add.text(x, y, text, { fontSize: `${fontSize}px`, color });
    };

    const addPlaceholderHero = (opts?: { x?: number; y?: number; label?: string; color?: number }) => {
        const x = opts?.x ?? scene.cameras.main.centerX;
        const y = opts?.y ?? scene.cameras.main.centerY;
        const color = opts?.color ?? 0x5aa6ff;
        const label = opts?.label ?? "Hero";

        const body = scene.add.rectangle(0, 0, 48, 64, color, 0.9).setStrokeStyle(2, 0xffffff, 0.5);
        const text = scene.add.text(0, 44, label, { fontSize: "14px", color: "#ffffff" }).setOrigin(0.5, 0);
        return scene.add.container(x, y, [body, text]);
    };

    const addGrid = (opts?: { cell?: number; color?: number; alpha?: number }) => {
        const cell = opts?.cell ?? 40;
        const color = opts?.color ?? 0x2b3147;
        const alpha = opts?.alpha ?? 0.6;
        const g = scene.add.graphics();
        g.lineStyle(1, color, alpha);
        for (let x = 0; x <= GAME_WIDTH; x += cell) g.lineBetween(x, 0, x, GAME_HEIGHT);
        for (let y = 0; y <= GAME_HEIGHT; y += cell) g.lineBetween(0, y, GAME_WIDTH, y);
        return g;
    };

    const spawnHero = (opts?: StudentDebugHeroSpawnOptions) => {
        const heroName = String(opts?.heroName || student || "").trim();
        if (!heroName) return null;
        const family = opts?.family || _resolveHeroFamily(scene, heroName);
        if (!family) return null;
        return debugSpawnHeroWithAnim(scene, {
            heroName,
            family,
            phase: opts?.phase,
            dir: opts?.dir,
            x: opts?.x,
            y: opts?.y
        }) || null;
    };

    const spawnProfileHero = (opts?: StudentDebugProfileHeroOptions) => {
        const profile = String(opts?.profile || student || "").trim();
        if (!profile) return null;
        return spawnHero({
            heroName: profile,
            family: opts?.family,
            phase: opts?.phase,
            dir: opts?.dir,
            x: opts?.x,
            y: opts?.y
        });
    };

    return { addLabel, addPlaceholderHero, addGrid, spawnHero, spawnProfileHero };
}

function _createDebugApi(scene: Phaser.Scene, game: Phaser.Game, student: string): StudentDebugApi {
    const base = createStudentApi({ id: student, name: student });
    const helpers = _createHelpers(scene, student);
    const ui = {
        ...base.ui,
        createOverlay: (opts: Parameters<typeof base.ui.createOverlay>[0]) => {
            return base.ui.createOverlay({ mountId: OVERLAY_MOUNT_ID, ...opts });
        },
    };

    return { ...base, scene, game, helpers, overlayMountId: OVERLAY_MOUNT_ID, ui };
}

function _isSpecialStudent(name: string): boolean {
    return SPECIAL_STUDENTS.includes(name);
}

function _defaultSceneDemo(ctx: StudentDebugContext): void {
    const { scene, api, student } = ctx;
    api.helpers.addGrid({ cell: 48, alpha: 0.3 });
    if (_isSpecialStudent(student)) {
        const hero = api.helpers.spawnProfileHero({ profile: "LongBlond", phase: "idle", dir: "down" });
        if (!hero) api.helpers.addPlaceholderHero({ label: student });
    } else {
        api.helpers.addPlaceholderHero({ label: student });
    }
    api.helpers.addLabel(`Debug sandbox for ${student}`, { x: 16, y: 16, fontSize: 18 });
    if (_isSpecialStudent(student)) {
        api.helpers.addLabel("This is for LongBlond", { x: 16, y: 42, fontSize: 16, color: "#7cc4ff" });
    }
}

function _bootSelectedStudent(student: string): void {
    const gameRoot = typeof document !== "undefined" ? document.getElementById("debug-game") : null;
    if (!gameRoot) return;

    const def = DEBUG_DEFS.get(student) || null;
    _setStatus(def ? `Loaded debug hook for ${student}.` : `No debug hook found for ${student}.`);
    _setText("debug-url", `${window.location.origin}/debug.html?student=${encodeURIComponent(student)}`);

    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: "debug-game",
        backgroundColor: "#0b0d12",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
        scene: {
            preload() {
                preloadHeroSheets(this);
                const api = _createDebugApi(this, this.game, student);
                const ctx: StudentDebugContext = { student, api, scene: this, game: this.game };
                if (def?.preload) def.preload(ctx);
                preloadStudentAssets(this);
            },
            create() {
                const api = _createDebugApi(this, this.game, student);
                const ctx: StudentDebugContext = { student, api, scene: this, game: this.game };
                if (def?.create) {
                    def.create(ctx);
                    return;
                }
                _defaultSceneDemo(ctx);
            },
            update(time: number, delta: number) {
                if (!def?.update) return;
                const api = _createDebugApi(this, this.game, student);
                const ctx: StudentDebugContext = { student, api, scene: this, game: this.game };
                def.update(ctx, time, delta);
            },
        },
    };

    new Phaser.Game(config);
}

function _main(): void {
    const selected = _getParam("student") || _getParam("profile");
    _renderStudentList(selected);

    if (!selected) {
        _setStatus("Pick a student from the list.");
        return;
    }

    if (!STUDENT_NAMES.includes(selected)) {
        _setStatus(`Unknown student "${selected}".`);
        return;
    }

    _setText("debug-current", `Student: ${selected}`);
    _bootSelectedStudent(selected);
}

_main();
