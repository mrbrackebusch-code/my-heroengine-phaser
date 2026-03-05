import type { StudentDebugContext } from "../../studentSystemsHooks";
import { getPetStats } from "../../studentSystemsHooks";
import { initPetXpState, registerLevelUpCallback, getPetLevelUpStats, printProgressionTable, testLevelUpFlow } from "./petXpSystem";

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
    let pet: any = null;
    let label: any = null;
    const px = (hero && hero.x) ? hero.x - 48 : 200;
    const py = (hero && hero.y) ? hero.y : 160;

    try {
        const textureKey = api.assets.key("wisp_spritesheet");

        if (textureKey && scene.textures && scene.textures.exists && scene.textures.exists(textureKey)) {
            // If the spritesheet texture exists, spawn a sprite and use frame 0
            pet = scene.add.sprite(px, py, textureKey, 0).setDepth(50);
            label = scene.add.text(px - 12, py - 22, "Wisp", { fontSize: "12px", color: "#ffffff" }).setDepth(50);
        } else {
            // Fallback: visual placeholder circle
            pet = scene.add.circle(px, py, 10, 0x66ccff).setDepth(50);
            label = scene.add.text(px - 12, py - 22, "Wisp", { fontSize: "12px", color: "#ffffff" }).setDepth(50);
        }

        // Attach runtime fields for pet systems
        pet.name = "Wisp";
        pet.level = 1;
        pet.hp = 40;
        pet.maxHp = 40;
        pet.atk = 6;

        const stats = getPetStats(api.key("wisp_pet")) || { baseHp: 40, baseAtk: 6, growthHp: 6, growthAtk: 1 };
        pet.__alanPetStats = stats;
        initPetXpState(pet);
        pet.__alanState = { retreating: false, wounded: false };

        // Register level-up callback for visual feedback
        registerLevelUpCallback((leveledPet: any, xpState: any, details: any) => {
            try {
                if (scene && scene.cameras && scene.cameras.main) {
                    // Flash camera on level-up
                    scene.cameras.main.flash(200, 255, 215, 0); // Gold flash
                }
            } catch (e) {}
            
            console.log(`[DEBUG] Pet leveled up! Level ${xpState.level}, HP +${details.hpIncrease}, ATK +${details.atkIncrease}`);
        });

        // UI overlay for pet status and controls
        const overlayId = "pet_status";
        api.ui.createOverlay({ 
            id: overlayId, 
            html: "", 
            visible: true, 
            style: { 
                position: "absolute", 
                right: "12px", 
                top: "12px", 
                width: "240px", 
                background: "rgba(0,0,0,0.75)", 
                color: "#fff", 
                padding: "12px", 
                borderRadius: "6px", 
                fontFamily: "monospace", 
                fontSize: "12px",
                border: "2px solid #66ccff"
            } 
        });

        // Control buttons
        const buttonContainerId = "pet_controls";
        api.ui.createOverlay({ 
            id: buttonContainerId, 
            html: `
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                    <button id="btn_award_50xp" style="padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                        +50 XP
                    </button>
                    <button id="btn_award_100xp" style="padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                        +100 XP
                    </button>
                    <button id="btn_damage_pet" style="padding: 6px 10px; background: #FF5722; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                        Damage -10 HP
                    </button>
                    <button id="btn_heal_pet" style="padding: 6px 10px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                        Heal +10 HP
                    </button>
                </div>
            `, 
            visible: true, 
            style: { 
                position: "absolute", 
                right: "12px", 
                top: "220px", 
                width: "240px", 
                background: "rgba(0,0,0,0.75)", 
                padding: "12px", 
                borderRadius: "6px",
                border: "2px solid #66ccff"
            } 
        });

        // Attach button event handlers (document-based for simplicity)
        setTimeout(() => {
            const btn50 = document.getElementById("btn_award_50xp");
            const btn100 = document.getElementById("btn_award_100xp");
            const btnDmg = document.getElementById("btn_damage_pet");
            const btnHeal = document.getElementById("btn_heal_pet");
            
            if (btn50) btn50.addEventListener("click", () => {
                (pet as any).__alanXp.currentXp += 50;
                console.log("[DEBUG] Awarded 50 XP manually");
            });
            if (btn100) btn100.addEventListener("click", () => {
                const { awardPetXp } = require("./petXpSystem");
                awardPetXp(pet, 100);
                console.log("[DEBUG] Awarded 100 XP manually");
            });
            if (btnDmg) btnDmg.addEventListener("click", () => {
                pet.hp = Math.max(0, pet.hp - 10);
                console.log(`[DEBUG] Damaged pet: ${pet.hp}/${pet.maxHp}`);
            });
            if (btnHeal) btnHeal.addEventListener("click", () => {
                pet.hp = Math.min(pet.maxHp, pet.hp + 10);
                console.log(`[DEBUG] Healed pet: ${pet.hp}/${pet.maxHp}`);
            });
        }, 100);

        // Update loop: follow hero and refresh overlay
        scene.events.on("update", () => {
            if (!pet || !hero) return;
            const state = pet.__alanState || { retreating: false, wounded: false };

            // follow logic
            if (!state.retreating && !state.wounded) {
                pet.x = hero.x - 24;
                pet.y = hero.y;
                label.x = pet.x - 12;
                label.y = pet.y - 22;
            } else {
                pet.x = hero.x - 40;
                pet.y = hero.y + 8;
                label.x = pet.x - 12;
                label.y = pet.y - 22;
            }

            // Overlay update
            try {
                const xp = pet.__alanXp || { currentXp: 0, xpToNextLevel: 100, level: pet.level || 1 };
                const hpText = `${Math.max(0, pet.hp || 0)} / ${pet.maxHp || 0}`;
                const progress = xp.xpToNextLevel ? Math.floor((xp.currentXp / xp.xpToNextLevel) * 100) : 0;
                const progressBar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));
                const html = `
                    <div style="font-weight:bold;margin-bottom:8px;color:#66ccff">Pet: ${pet.name || "Wisp"}</div>
                    <div>Level: ${xp.level || pet.level}</div>
                    <div style="margin-top: 4px;">XP Progress:</div>
                    <div style="font-family: 'Courier New'; font-size: 10px;">[${progressBar}]</div>
                    <div>${xp.currentXp || 0} / ${xp.xpToNextLevel || 100} (${progress}%)</div>
                    <div style="margin-top: 6px;">HP: ${hpText}</div>
                    <div>ATK: ${pet.atk || 6}</div>
                `;
                api.ui.setOverlayHtml(overlayId, html);
            } catch (e) {
                // ignore overlay errors
            }
        });

        api.helpers.addLabel("Pet placeholder spawned", { x: 16, y: 40, fontSize: 14 });
    } catch (e) {
        console.error("[Alan debug] could not spawn pet placeholder", e);
    }
}
