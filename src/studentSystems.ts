import type { StudentRuntimeContextBase, StudentSystemDefinition } from "./studentApi";
import { createStudentApi, normalizeStudentId } from "./studentApi";
import { DEBUG_STUDENT_SYSTEMS_LOGS } from "./debugFlags";

const _systemsById = new Map<string, StudentSystemDefinition>();
let _modulesLoaded = false;
let _systemsInited = false;
const _logStudentSystems = (msg: string): void => {
    if (!DEBUG_STUDENT_SYSTEMS_LOGS) return;
    console.log(msg);
};

export function registerStudentSystem(def: StudentSystemDefinition): void {
    const rawId = String(def?.id || "").trim();
    const id = normalizeStudentId(rawId);
    if (!id) return;

    if (_systemsById.has(id)) return;

    const system: StudentSystemDefinition = {
        ...def,
        id,
        name: def?.name || rawId || id,
    };

    _systemsById.set(id, system);
    _logStudentSystems(`[STUDENT][SYSTEM] register id=${id} name=${system.name} hasRegister=${typeof system.register === "function" ? 1 : 0} hasInit=${typeof system.init === "function" ? 1 : 0}`);

    if (typeof system.register === "function") {
        const api = createStudentApi(system);
        system.register(api);
    }
}

export function loadStudentModules(): void {
    if (_modulesLoaded) return;
    _modulesLoaded = true;
    void import("./studentAutoLoad");
}

export function listStudentSystems(): StudentSystemDefinition[] {
    return Array.from(_systemsById.values());
}

export function initStudentSystems(ctx: StudentRuntimeContextBase): void {
    if (!_modulesLoaded) loadStudentModules();
    if (_systemsInited) return;
    _systemsInited = true;

    for (const system of _systemsById.values()) {
        if (typeof system.init !== "function") continue;
        const api = createStudentApi(system);
        _logStudentSystems(`[STUDENT][SYSTEM] init id=${system.id} name=${system.name}`);
        system.init({ ...ctx, api });
    }
}
