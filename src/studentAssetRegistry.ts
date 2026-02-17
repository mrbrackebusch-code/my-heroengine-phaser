// Student asset registry (explicit, code-driven lists).
// Registry modules live under: src/student/<Name>/assets/registry.js (or .mjs)

export type StudentMonsterSheetEntry = {
    name: string;
    url: string | URL;
    group?: "monsters" | "bosses";
    source?: string;
};

export type StudentAssetRegistryModule = {
    monsterSheets?: StudentMonsterSheetEntry[];
    monsters?: StudentMonsterSheetEntry[];
    bossSheets?: StudentMonsterSheetEntry[];
    bosses?: StudentMonsterSheetEntry[];
};

type StudentMonsterSheet = {
    name: string;
    url: string;
    group: "monsters" | "bosses";
    source: string;
};

const _monsterSheets: StudentMonsterSheet[] = [];
const _monsterSheetKeys = new Set<string>();
let _registriesLoaded = false;

function _normalizeUrl(raw: string | URL): string {
    if (raw instanceof URL) return raw.toString();
    return String(raw || "").trim();
}

function _basenameFromUrl(url: string): string {
    const s = String(url || "");
    if (!s) return "";
    const clean = s.split("#")[0].split("?")[0];
    const file = clean.split(/[\\/]/).pop() || "";
    if (!file.toLowerCase().endsWith(".png")) return "";
    const base = file.slice(0, -4);
    try {
        return decodeURIComponent(base);
    } catch {
        return base;
    }
}

function _pushMonsterSheet(entry: StudentMonsterSheetEntry, source: string, group: "monsters" | "bosses"): void {
    const name = String(entry?.name || "").trim();
    const url = _normalizeUrl(entry?.url as any);
    if (!name || !url) {
        throw new Error(`[studentAssets] Invalid monster sheet registration (missing name/url) source=${source || "unknown"}`);
    }
    const baseName = _basenameFromUrl(url);
    if (baseName && baseName !== name) {
        throw new Error(`[studentAssets] Monster registry name mismatch name="${name}" file="${baseName}" source=${source || "unknown"}`);
    }
    const key = `${group}|${name}`;
    if (_monsterSheetKeys.has(key)) return;
    _monsterSheetKeys.add(key);
    _monsterSheets.push({
        name,
        url,
        group,
        source: source || "",
    });
}

function _readRegistryExports(mod: any): StudentAssetRegistryModule {
    if (!mod) return {};
    const base = (mod && typeof mod === "object" && mod.default && typeof mod.default === "object")
        ? mod.default
        : mod;
    return base as StudentAssetRegistryModule;
}

export function loadStudentAssetRegistries(): void {
    if (_registriesLoaded) return;
    _registriesLoaded = true;

    const modules = {
        ...import.meta.glob("./student/**/assets/registry.js", { eager: true }),
        ...import.meta.glob("./student/**/assets/registry.mjs", { eager: true }),
    } as Record<string, any>;

    for (const [path, mod] of Object.entries(modules)) {
        const reg = _readRegistryExports(mod);
        const source = String(path || "");
        const monsterSheets = reg.monsterSheets || reg.monsters || [];
        const bossSheets = reg.bossSheets || reg.bosses || [];

        if (Array.isArray(monsterSheets)) {
            for (const entry of monsterSheets) {
                _pushMonsterSheet(entry, source, "monsters");
            }
        }
        if (Array.isArray(bossSheets)) {
            for (const entry of bossSheets) {
                _pushMonsterSheet(entry, source, "bosses");
            }
        }
    }
}

export function listStudentMonsterSheets(): StudentMonsterSheet[] {
    return _monsterSheets.slice();
}
