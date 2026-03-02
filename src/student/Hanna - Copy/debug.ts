        // Add a button to show a relic reward overlay example
        const relicBtn = document.createElement("button");
        relicBtn.textContent = "Show Relic Reward Overlay";
        relicBtn.style.position = "absolute";
        relicBtn.style.top = "52px";
        relicBtn.style.right = "24px";
        relicBtn.style.zIndex = "2000";
        relicBtn.onclick = () => {
            showRelicOverlay("You earned a relic!", "hanna_legend_relic");
        };
        document.body.appendChild(relicBtn);

        // Relic overlay function
        function showRelicOverlay(message: string, relicId: string) {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.background = "rgba(0,0,0,0.7)";
            overlay.style.display = "flex";
            overlay.style.flexDirection = "column";
            overlay.style.justifyContent = "center";
            overlay.style.alignItems = "center";
            overlay.style.zIndex = "9999";

            const msg = document.createElement("div");
            msg.textContent = message;
            msg.style.fontSize = "2.2rem";
            msg.style.color = "#fff";
            msg.style.marginBottom = "18px";
            overlay.appendChild(msg);

            const relic = document.createElement("div");
            relic.textContent = `Relic ID: ${relicId}`;
            relic.style.fontSize = "1.3rem";
            relic.style.color = "#ffe066";
            relic.style.marginBottom = "24px";
            overlay.appendChild(relic);

            const btn = document.createElement("button");
            btn.textContent = "Close";
            btn.style.fontSize = "1.1rem";
            btn.style.padding = "10px 28px";
            btn.onclick = () => overlay.remove();
            overlay.appendChild(btn);

            document.body.appendChild(overlay);
        }
import type { StudentDebugContext } from "../../studentSystemsHooks";
import { renderCardGrid } from "./cardRenderer";
import type { Card } from "./types";

export default function debug(ctx: StudentDebugContext): void {
        const { api, student } = ctx;
        const profile = student;

        api.helpers.addGrid({ cell: 48, alpha: 0.3 });
        api.helpers.addLabel(`Debug sandbox: ${profile}`, { x: 16, y: 16, fontSize: 18 });

        // Render test cards for all rarities/variants
        const testCards: Card[] = [
            {
                id: "c1",
                name: "Common Card",
                type: "skill",
                baseDanger: 1,
                variant: "normal",
                multiplier: 1,
                stat: 2,
                rarity: "common"
            },
            {
                id: "c2",
                name: "Uncommon Card",
                type: "skill",
                baseDanger: 4,
                variant: "split_medium",
                multiplier: 2,
                stat: 6,
                rarity: "uncommon"
            },
            {
                id: "c3",
                name: "Rare Card",
                type: "skill",
                baseDanger: 10,
                variant: "boss_giant",
                multiplier: 4,
                stat: 32,
                rarity: "rare"
            },
            {
                id: "c4",
                name: "Legendary Card",
                type: "skill",
                baseDanger: 20,
                variant: "normal",
                multiplier: 1,
                stat: 40,
                rarity: "legendary"
            }
        ];

        const grid = renderCardGrid(testCards, { columns: 4 });
        // Mount to overlay root if available, else document.body
        const mount = document.getElementById("debug-overlay-root") || document.body;
        mount.appendChild(grid);

        // Add a button to show a game-over overlay example
        const btn = document.createElement("button");
        btn.textContent = "Show Game Over Overlay";
        btn.style.position = "absolute";
        btn.style.top = "12px";
        btn.style.right = "24px";
        btn.style.zIndex = "2000";
        btn.onclick = () => {
            showGameOverOverlay("Game Over!", () => window.location.reload());
        };
        document.body.appendChild(btn);

        // Overlay function
        function showGameOverOverlay(message: string, onRestart: () => void) {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.background = "rgba(0,0,0,0.7)";
            overlay.style.display = "flex";
            overlay.style.flexDirection = "column";
            overlay.style.justifyContent = "center";
            overlay.style.alignItems = "center";
            overlay.style.zIndex = "9999";

            const msg = document.createElement("div");
            msg.textContent = message;
            msg.style.fontSize = "2.5rem";
            msg.style.color = "#fff";
            msg.style.marginBottom = "24px";
            overlay.appendChild(msg);

            const btn = document.createElement("button");
            btn.textContent = "Restart";
            btn.style.fontSize = "1.2rem";
            btn.style.padding = "12px 32px";
            btn.onclick = () => {
                overlay.remove();
                onRestart();
            };
            overlay.appendChild(btn);

            document.body.appendChild(overlay);
        }
}
