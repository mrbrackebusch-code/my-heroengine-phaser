import type { StudentSystemDefinition } from "./studentApi";
import { registerStudentSystem } from "./studentSystems";

function _registerFromModule(mod: any): void {
    if (!mod) return;

    const candidate = mod.default || mod.studentSystem || null;
    if (candidate && typeof candidate === "object") {
        registerStudentSystem(candidate as StudentSystemDefinition);
        return;
    }

    if (typeof candidate === "function") {
        const result = candidate();
        if (result && typeof result === "object") {
            registerStudentSystem(result as StudentSystemDefinition);
        }
    }
}

const modules = import.meta.glob("./student/**/index.ts", { eager: true });
for (const mod of Object.values(modules)) {
    _registerFromModule(mod as any);
}
