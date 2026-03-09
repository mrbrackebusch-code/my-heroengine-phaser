import { registerStudentSystem } from "../../studentSdk";
import { CombatArenaFloor, type ArenaPlayer, type ArenaCombat } from "./combatArenaFloor";
import { ArenaEntrance, type EntranceState } from "./arenaEntrance";
import { PostCombatManager, type PostCombatState, type PostCombatSession } from "./postCombatManager";
import { ArenaJoinButton } from "./arenaJoinButton";
import { ArenaLiveTestOverlay } from "./arenaLiveTestOverlay";
import { sendReadyPlayersToCombatArenaFloor } from "./arenaLocalPlayer";

// Initialize systems
const combatArena = new CombatArenaFloor();
const arenaEntrance = new ArenaEntrance();
const postCombatManager = new PostCombatManager();

registerStudentSystem({
    id: "Daniel",
    name: "Daniel",
    init: ({ scene }) => {
        const ensureArenaUi = (targetScene: any): void => {
            if (!targetScene || targetScene.scene?.key !== "hero") return;
            if ((targetScene as any).__danielArenaJoinButton) return;

            const joinButton = new ArenaJoinButton(targetScene, arenaEntrance, combatArena);
            joinButton.create();
            (targetScene as any).__danielArenaJoinButton = joinButton;

            targetScene.events.once("shutdown", () => {
                try {
                    const existing = (targetScene as any).__danielArenaJoinButton as ArenaJoinButton | undefined;
                    if (existing) existing.destroy();
                    delete (targetScene as any).__danielArenaJoinButton;

                    const overlay = (targetScene as any).__danielArenaOverlay as ArenaLiveTestOverlay | undefined;
                    if (overlay) overlay.destroy();
                    delete (targetScene as any).__danielArenaOverlay;
                } catch {
                    // no-op
                }
            });

            if (!(targetScene as any).__danielArenaOverlay) {
                const overlay = new ArenaLiveTestOverlay(targetScene, combatArena, arenaEntrance, postCombatManager);
                overlay.create();
                (targetScene as any).__danielArenaOverlay = overlay;
            }

            arenaEntrance.setAllReadyCallback((playerIds) => {
                sendReadyPlayersToCombatArenaFloor(targetScene, playerIds);
                const overlay = (targetScene as any).__danielArenaOverlay as ArenaLiveTestOverlay | undefined;
                overlay?.onAllPlayersReady();
            });
        };

        ensureArenaUi(scene as any);

        const managerEvents: any = (scene as any)?.game?.scene?.events;
        if (managerEvents && !(scene as any).__danielArenaUiHooksInstalled) {
            (scene as any).__danielArenaUiHooksInstalled = true;
            managerEvents.on("start", (startedScene: any) => ensureArenaUi(startedScene));
            managerEvents.on("wake", (wokenScene: any) => ensureArenaUi(wokenScene));
        }
    },
});

// Export arena systems
export { combatArena, CombatArenaFloor, arenaEntrance, ArenaEntrance, postCombatManager, PostCombatManager, ArenaJoinButton };
export type { ArenaPlayer, ArenaCombat, EntranceState, PostCombatState, PostCombatSession };
