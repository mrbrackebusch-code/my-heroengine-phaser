import type Phaser from "phaser";
import type { DecorVisualRef } from "./tileAtlas";
import type { PropSpec } from "./propSpecs";
import type { TrapDefinition } from "./trapRegistry";

import {
    registerStudentImage,
    registerStudentSpritesheet,
    registerStudentAtlas,
    registerStudentAudio,
    registerStudentJson,
    listStudentAssets,
} from "./studentAssets";
import { registerPropSpec } from "./propSpecs";
import { registerDecalVisual, registerPropVisual, registerExternalTileSheet } from "./tileAtlas";
import { registerTrapDefinition } from "./trapRegistry";
import { registerStudentRelic, registerStudentVfxPreset, type StudentVfxPreset, type StudentRelicDefinition } from "./studentHooks";

export type StudentDataEntry = {
    id?: string;
    name: string;
    description?: string;
    iconKey?: string;
    tags?: string[];
    data?: any;
};

export type StudentDataKind = string;

type StudentDataStore = Map<string, Map<string, StudentDataEntry>>;

const _studentDataByKind: StudentDataStore = new Map();

function _registerStudentData(kind: StudentDataKind, entry: StudentDataEntry): string {
    const k = String(kind || "").trim();
    if (!k) return "";
    const id = String(entry?.id || entry?.name || "").trim();
    if (!id) return "";

    let store = _studentDataByKind.get(k);
    if (!store) {
        store = new Map();
        _studentDataByKind.set(k, store);
    }
    store.set(id, { ...entry, id });
    return id;
}

function _listStudentData(kind: StudentDataKind): StudentDataEntry[] {
    const k = String(kind || "").trim();
    if (!k) return [];
    const store = _studentDataByKind.get(k);
    return store ? Array.from(store.values()) : [];
}

function _getStudentData(kind: StudentDataKind, id: string): StudentDataEntry | null {
    const k = String(kind || "").trim();
    const key = String(id || "").trim();
    if (!k || !key) return null;
    const store = _studentDataByKind.get(k);
    return (store && store.get(key)) || null;
}

function _normalizeDomId(raw: string): string {
    const s = String(raw || "").trim().toLowerCase();
    const cleaned = s.replace(/[^a-z0-9_-]+/g, "-");
    return cleaned.replace(/^-+/, "").replace(/-+$/, "");
}

export type StudentOverlayOptions = {
    id: string;
    html?: string;
    className?: string;
    visible?: boolean;
    mountId?: string;
    style?: Partial<CSSStyleDeclaration>;
};

const _overlayById = new Map<string, HTMLElement>();

function _createOverlay(overlayId: string, opts: StudentOverlayOptions): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const existing = document.getElementById(overlayId) as HTMLElement | null;
    if (existing) return existing;

    const el = document.createElement("div");
    el.id = overlayId;
    if (opts.className) el.className = opts.className;
    if (typeof opts.html === "string") el.innerHTML = opts.html;
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.display = opts.visible === false ? "none" : "block";

    if (opts.style) {
        Object.assign(el.style, opts.style);
    }

    const mount = opts.mountId ? document.getElementById(opts.mountId) : null;
    (mount || document.body).appendChild(el);
    _overlayById.set(overlayId, el);
    return el;
}

function _getOverlay(overlayId: string): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const el = document.getElementById(overlayId) as HTMLElement | null;
    if (el) return el;
    return _overlayById.get(overlayId) || null;
}

function _removeOverlay(overlayId: string): void {
    const el = _getOverlay(overlayId);
    if (!el) return;
    if (el.parentElement) el.parentElement.removeChild(el);
    _overlayById.delete(overlayId);
}

export type StudentApi = {
    id: string;
    name: string;
    namespace: string;
    key: (raw: string) => string;
    assets: {
        key: (raw: string) => string;
        registerImage: (id: string, url: string | string[]) => string;
        registerSpritesheet: (id: string, url: string | string[], frameW: number, frameH: number) => string;
        registerAtlas: (id: string, imageUrl: string, atlasUrl: string) => string;
        registerAudio: (id: string, url: string | string[]) => string;
        registerJson: (id: string, url: string | string[]) => string;
        registerTileSheet: (id: string, url: string | string[], frameW: number, frameH: number, cols?: number, rows?: number, requireAura?: boolean) => string;
        listAll: () => ReturnType<typeof listStudentAssets>;
    };
    data: {
        register: (kind: StudentDataKind, entry: StudentDataEntry) => string;
        list: (kind: StudentDataKind) => StudentDataEntry[];
        get: (kind: StudentDataKind, id: string) => StudentDataEntry | null;
    };
    props: {
        registerSpec: (spec: PropSpec) => PropSpec | null;
        registerVisual: (name: string, visual: DecorVisualRef) => string;
        registerDecal: (name: string, visual: DecorVisualRef) => string;
    };
    traps: {
        registerDefinition: (def: TrapDefinition) => void;
    };
    relics: {
        register: (def: StudentRelicDefinition) => string;
    };
    vfx: {
        register: (id: string, preset: StudentVfxPreset<any>) => string;
    };
    ui: {
        createOverlay: (opts: StudentOverlayOptions) => HTMLElement | null;
        getOverlay: (id: string) => HTMLElement | null;
        removeOverlay: (id: string) => void;
    };
};

export type StudentSystemDefinition = {
    id: string;
    name?: string;
    description?: string;
    register?: (api: StudentApi) => void;
    init?: (ctx: StudentRuntimeContext) => void;
};

export type StudentRuntimeContextBase = {
    scene: Phaser.Scene;
    isHost: () => boolean;
    getGlobals: () => any;
};

export type StudentRuntimeContext = StudentRuntimeContextBase & { api: StudentApi };

export function normalizeStudentId(rawId: string): string {
    const s = String(rawId || "").trim().toLowerCase();
    if (!s) return "";
    const cleaned = s.replace(/[^a-z0-9_-]+/g, "_");
    return cleaned.replace(/^_+/, "").replace(/_+$/, "");
}

function _studentNamespace(id: string): string {
    const norm = normalizeStudentId(id);
    return norm ? `student.${norm}.` : "student.";
}

function _prefixKey(namespace: string, raw: string): string {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith(namespace)) return s;
    return `${namespace}${s}`;
}

export function createStudentApi(system: StudentSystemDefinition): StudentApi {
    const rawId = String(system?.id || "").trim();
    const normId = normalizeStudentId(rawId);
    const name = String(system?.name || rawId || normId || "student");
    const namespace = _studentNamespace(normId || rawId || name);
    const domPrefix = _normalizeDomId(normId || rawId || name);

    const key = (raw: string) => _prefixKey(namespace, raw);

    const assets = {
        key,
        registerImage: (id: string, url: string | string[]) => registerStudentImage(key(id), url),
        registerSpritesheet: (id: string, url: string | string[], frameW: number, frameH: number) =>
            registerStudentSpritesheet(key(id), url, frameW, frameH),
        registerAtlas: (id: string, imageUrl: string, atlasUrl: string) =>
            registerStudentAtlas(key(id), imageUrl, atlasUrl),
        registerAudio: (id: string, url: string | string[]) => registerStudentAudio(key(id), url),
        registerJson: (id: string, url: string | string[]) => registerStudentJson(key(id), url),
        registerTileSheet: (id: string, url: string | string[], frameW: number, frameH: number, cols?: number, rows?: number, requireAura?: boolean) => {
            const tk = key(id);
            const urlStr = Array.isArray(url) ? String(url[0] || "") : String(url || "");
            registerExternalTileSheet({
                textureKey: tk,
                url: urlStr,
                cols: cols == null ? 1 : (cols | 0),
                rows: rows == null ? 1 : (rows | 0),
                frameW: frameW | 0,
                frameH: frameH | 0,
                requireAura: requireAura === true,
            });
            return tk;
        },
        listAll: () => listStudentAssets(),
    };

    const data = {
        register: (kind: StudentDataKind, entry: StudentDataEntry) => {
            const raw = entry?.id || entry?.name || "";
            const id = key(raw);
            return _registerStudentData(kind, { ...entry, id });
        },
        list: (kind: StudentDataKind) => {
            const list = _listStudentData(kind);
            return list.filter((entry) => entry && typeof entry.id === "string" && entry.id.startsWith(namespace));
        },
        get: (kind: StudentDataKind, id: string) => _getStudentData(kind, key(id)),
    };

    const props = {
        registerSpec: (spec: PropSpec) => {
            const nameKey = key(spec?.name || "");
            return registerPropSpec({ ...spec, name: nameKey });
        },
        registerVisual: (name: string, visual: DecorVisualRef) => registerPropVisual(key(name), visual),
        registerDecal: (name: string, visual: DecorVisualRef) => registerDecalVisual(key(name), visual),
    };

    const traps = {
        registerDefinition: (def: TrapDefinition) => {
            const propBase = key(def?.propBase || "");
            registerTrapDefinition({ ...def, propBase });
        },
    };

    const relics = {
        register: (def: StudentRelicDefinition) => {
            const id = key(def?.id || def?.name || "");
            return registerStudentRelic({ ...def, id });
        },
    };

    const vfx = {
        register: (id: string, preset: StudentVfxPreset<any>) => registerStudentVfxPreset(key(id), preset),
    };

    const ui = {
        createOverlay: (opts: StudentOverlayOptions) => {
            const raw = opts?.id || "";
            const domId = `student-${domPrefix}-${_normalizeDomId(raw)}`;
            return _createOverlay(domId, opts);
        },
        getOverlay: (id: string) => {
            const domId = `student-${domPrefix}-${_normalizeDomId(id)}`;
            return _getOverlay(domId);
        },
        removeOverlay: (id: string) => {
            const domId = `student-${domPrefix}-${_normalizeDomId(id)}`;
            _removeOverlay(domId);
        },
    };

    return { id: normId || rawId, name, namespace, key, assets, data, props, traps, relics, vfx, ui };
}
