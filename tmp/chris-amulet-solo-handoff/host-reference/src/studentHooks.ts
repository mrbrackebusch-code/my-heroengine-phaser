import type { VfxContext, VfxHelpers, VfxRegistry } from "./vfxRegistry";

export type StudentRelicIconSpec = {
    sheet: string;
    x: number;
    y: number;
};

export type StudentRelicUiHints = {
    kind?: string;
    glyphText?: string;
};

export type StudentRelicDefinition = {
    id: string;
    name: string;
    effectText?: string;
    flavorText?: string;
    rarity?: string;
    iconPrimary?: StudentRelicIconSpec;
    iconAlt?: StudentRelicIconSpec;
    iconUrl?: string;
    iconAltUrl?: string;
    uiHints?: StudentRelicUiHints;
    effectKey?: string;
};

const _studentRelicsById: Record<string, StudentRelicDefinition> = Object.create(null);

export function registerStudentRelic(def: StudentRelicDefinition): string {
    const id = String(def?.id || "").trim();
    if (!id) return "";
    _studentRelicsById[id] = { ...def, id };
    return id;
}

export function listStudentRelics(): StudentRelicDefinition[] {
    return Object.values(_studentRelicsById);
}

export function applyStudentRelicDefinitions(catalog: Record<string, any>): void {
    if (!catalog) return;
    for (const def of Object.values(_studentRelicsById)) {
        if (!def || !def.id) continue;
        catalog[def.id] = def as any;
    }
}

export type StudentVfxPreset<TParams = any> = (ctx: VfxContext, params: TParams, helpers: VfxHelpers) => void;

const _studentVfxPresets: Array<{ id: string; preset: StudentVfxPreset<any> }> = [];

export function registerStudentVfxPreset(id: string, preset: StudentVfxPreset<any>): string {
    const key = String(id || "").trim();
    if (!key || typeof preset !== "function") return "";
    _studentVfxPresets.push({ id: key, preset });
    return key;
}

export function applyStudentVfxPresets(registry: VfxRegistry, helpers: VfxHelpers): void {
    if (!registry) return;
    for (const entry of _studentVfxPresets) {
        if (!entry || !entry.id || typeof entry.preset !== "function") continue;
        registry.register(entry.id, (ctx, params) => entry.preset(ctx, params, helpers));
    }
}
