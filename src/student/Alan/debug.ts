import type { StudentDebugContext } from "../../studentSystemsHooks";
import { getPetStats } from "../../studentSystemsHooks";
import { initPetXpState } from "./petXpSystem";

export default function debug(ctx: StudentDebugContext): void {
    const { api, student, scene } = ctx;
    const profile = student;

    api.helpers.addGrid({ cell: 48, alpha: 0.3 });
    api.helpers.addLabel(`Debug sandbox: ${profile}`, { x: 16, y: 16, fontSize: 18 });

    const hero = api.helpers.spawnProfileHero({ profile, phase: "idle", dir: "down", x: 240, y: 160 });
    if (!hero) {
        api.helpers.addPlaceholderHero({ label: profile });
    }

    // --- Pet debug spawn ---
    // Try to create a visible placeholder pet for testing pet systems.
    let pet: any = null;

    try {
        // Create a simple circle as a visual placeholder for the pet
        const px = (hero && hero.x) ? hero.x - 48 : 200;
        const py = (hero && hero.y) ? hero.y : 160;
        const circle = scene.add.circle(px, py, 10, 0x66ccff).setDepth(50);
        const label = scene.add.text(px - 12, py - 22, "Wisp", { fontSize: "12px", color: "#ffffff" }).setDepth(50);

        // Attach basic pet runtime fields so student hooks can operate on this object
        pet = circle;
        pet.name = "Wisp";
        pet.level = 1;
        pet.hp = 40;
        pet.maxHp = 40;
        pet.atk = 6;

        // Attach pet stats from registered defs if available
        const stats = getPetStats(api.key("wisp_pet")) || { baseHp: 40, baseAtk: 6, growthHp: 6, growthAtk: 1 };
        pet.__alanPetStats = stats;

        // Initialize XP state (from petXpSystem)
        initPetXpState(pet);

        // Initialize alan runtime state expected by petBehavior
        pet.__alanState = { retreating: false, wounded: false };

        // Simple follow behavior: keep pet near hero unless wounded/retreating
        scene.events.on("update", () => {
            if (!pet || !hero) return;
            const state = pet.__alanState || { retreating: false, wounded: false };
            if (!state.retreating && !state.wounded) {
                pet.x = hero.x - 24;
                pet.y = hero.y;
                label.x = pet.x - 12;
                label.y = pet.y - 22;
            } else {
                // retreat behind hero
                pet.x = hero.x - 40;
                pet.y = hero.y + 8;
                label.x = pet.x - 12;
                label.y = pet.y - 22;
            }
        });

        api.helpers.addLabel("Pet placeholder spawned", { x: 16, y: 40, fontSize: 14 });
    } catch (e) {
        // Non-fatal: debug harness should not crash
        console.error("[Alan debug] could not spawn pet placeholder", e);
    }
}
