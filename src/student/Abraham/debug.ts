import type { StudentDebugContext } from "../../studentSystemsHooks";

export default function debug(ctx: StudentDebugContext): void {
    const { api, student } = ctx;
    const profile = student;

    api.helpers.addGrid({ cell: 48, alpha: 0.3 });
    api.helpers.addLabel(`Debug sandbox: ${profile}`, { x: 16, y: 16, fontSize: 18 });

    const hero = api.helpers.spawnProfileHero({ profile, phase: "idle", dir: "down" });
    if (!hero) {
        api.helpers.addPlaceholderHero({ label: profile });
    }
}
