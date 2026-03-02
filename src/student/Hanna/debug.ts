import type { StudentDebugContext } from "../../studentSystemsHooks";
import { renderCardGrid } from "./cardRenderer";
import { createSession, getComboCatalog } from "./minigame";
import type { Card } from "./types";

function renderComboCatalog(mount: HTMLElement): void {
    const catalog = getComboCatalog();
    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.left = "12px";
    panel.style.top = "56px";
    panel.style.zIndex = "2100";
    panel.style.width = "320px";
    panel.style.maxHeight = "420px";
    panel.style.overflowY = "auto";
    panel.style.padding = "10px 12px";
    panel.style.borderRadius = "8px";
    panel.style.background = "rgba(10,14,24,0.88)";
    panel.style.border = "1px solid rgba(124,196,255,0.35)";
    panel.style.color = "#e7e9ee";
    panel.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
    panel.style.fontSize = "13px";

    const title = document.createElement("div");
    title.textContent = "Combo / Reward Catalog";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    panel.appendChild(title);

    const summary = document.createElement("div");
    summary.style.marginBottom = "10px";
    summary.style.padding = "6px 8px";
    summary.style.background = "rgba(255,255,255,0.06)";
    summary.style.borderRadius = "6px";
    summary.textContent = "Production source of truth from minigame combo table.";
    panel.appendChild(summary);

    for (const combo of catalog) {
        const row = document.createElement("div");
        row.style.padding = "6px 0";
        row.style.borderTop = "1px solid rgba(255,255,255,0.08)";

        const name = document.createElement("div");
        name.textContent = `${combo.name} (Tier ${combo.tier})`;
        name.style.fontWeight = "600";
        row.appendChild(name);

        const parts: string[] = [];
        if (combo.reward.xp) parts.push(`XP +${combo.reward.xp}`);
        if (combo.reward.gold) parts.push(`Gold +${combo.reward.gold}`);
        if (combo.reward.relicId) parts.push(`Relic: ${combo.reward.relicId}`);

        const reward = document.createElement("div");
        reward.textContent = parts.length ? parts.join(" • ") : "No reward";
        reward.style.opacity = "0.9";
        row.appendChild(reward);

        panel.appendChild(row);
    }

    mount.appendChild(panel);
}

type PlaytestCase = {
    name: string;
    cards: Card[];
    expectOutcome: "win" | "lose";
    expectReason: string;
    expectRelic?: boolean;
};

function runPlaytestCase(testCase: PlaytestCase): { pass: boolean; details: string } {
    const session = createSession({ rewardMultiplier: 1 });
    session.played = testCase.cards.slice();
    const combos = session.evaluateCombos();
    const reward = session.computeReward(combos);
    const gameOver = session.computeGameOver(combos, reward, "manual");

    const outcomePass = gameOver.outcome === testCase.expectOutcome;
    const reasonPass = gameOver.reason === testCase.expectReason;
    const relicPass = typeof testCase.expectRelic === "boolean"
        ? Boolean(reward.relicId) === testCase.expectRelic
        : true;

    const pass = outcomePass && reasonPass && relicPass;
    const comboNames = combos.map((combo) => combo.name).join(", ") || "none";
    const rewardSummary = [
        reward.xp ? `XP:${reward.xp}` : null,
        reward.gold ? `Gold:${reward.gold}` : null,
        reward.relicId ? `Relic:${reward.relicId}` : null,
    ].filter(Boolean).join(" | ") || "No reward";

    return {
        pass,
        details: `outcome=${gameOver.outcome}, reason=${gameOver.reason}, score=${gameOver.score}, combos=[${comboNames}], reward=[${rewardSummary}]`,
    };
}

function renderStep8PlaytestReport(mount: HTMLElement): void {
    const tests: PlaytestCase[] = [
        {
            name: "normal",
            cards: [
                { id: "n1", name: "N1", type: "skill", stat: 2, rarity: "common" },
                { id: "n2", name: "N2", type: "skill", stat: 6, rarity: "uncommon" },
                { id: "n3", name: "N3", type: "skill", stat: 32, rarity: "rare" },
            ],
            expectOutcome: "win",
            expectReason: "combo_success",
        },
        {
            name: "no-combo",
            cards: [
                { id: "x1", name: "X1", type: "attack", stat: 10, rarity: "rare" },
                { id: "x2", name: "X2", type: "defense", stat: 5, rarity: "uncommon" },
                { id: "x3", name: "X3", type: "skill", stat: 8, rarity: "rare" },
                { id: "x4", name: "X4", type: "utility", stat: 7, rarity: "common" },
            ],
            expectOutcome: "lose",
            expectReason: "no_valid_combo",
            expectRelic: false,
        },
        {
            name: "high-combo",
            cards: [
                { id: "h1", name: "H1", type: "skill", stat: 20, rarity: "legendary" },
                { id: "h2", name: "H2", type: "skill", stat: 25, rarity: "legendary" },
                { id: "h3", name: "H3", type: "skill", stat: 30, rarity: "legendary" },
                { id: "h4", name: "H4", type: "skill", stat: 35, rarity: "rare" },
            ],
            expectOutcome: "win",
            expectReason: "legendary_chain",
            expectRelic: true,
        },
        {
            name: "timeout",
            cards: [
                { id: "t1", name: "T1", type: "attack", stat: 7, rarity: "uncommon" },
                { id: "t2", name: "T2", type: "attack", stat: 6, rarity: "rare" },
            ],
            expectOutcome: "lose",
            expectReason: "time_expired",
            expectRelic: false,
        },
    ];

    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.right = "12px";
    panel.style.top = "56px";
    panel.style.zIndex = "2100";
    panel.style.width = "420px";
    panel.style.maxHeight = "420px";
    panel.style.overflowY = "auto";
    panel.style.padding = "10px 12px";
    panel.style.borderRadius = "8px";
    panel.style.background = "rgba(10,14,24,0.9)";
    panel.style.border = "1px solid rgba(124,196,255,0.35)";
    panel.style.color = "#e7e9ee";
    panel.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
    panel.style.fontSize = "13px";

    const title = document.createElement("div");
    title.textContent = "Step 8 Playtest Report";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    panel.appendChild(title);

    let passCount = 0;
    for (const testCase of tests) {
        const result = runPlaytestCase(testCase);
        if (result.pass) passCount += 1;

        const row = document.createElement("div");
        row.style.padding = "7px 0";
        row.style.borderTop = "1px solid rgba(255,255,255,0.08)";

        const name = document.createElement("div");
        name.textContent = `${result.pass ? "PASS" : "FAIL"} — ${testCase.name}`;
        name.style.fontWeight = "700";
        name.style.color = result.pass ? "#77dd77" : "#ff8a80";
        row.appendChild(name);

        const details = document.createElement("div");
        details.textContent = result.details;
        details.style.opacity = "0.92";
        row.appendChild(details);

        panel.appendChild(row);
    }

    const footer = document.createElement("div");
    footer.style.marginTop = "10px";
    footer.style.padding = "6px 8px";
    footer.style.borderRadius = "6px";
    footer.style.background = "rgba(255,255,255,0.06)";
    footer.textContent = `Summary: ${passCount}/${tests.length} scenarios passed.`;
    panel.appendChild(footer);

    mount.appendChild(panel);
}

export default function debug(ctx: StudentDebugContext): void {
    const { api, student } = ctx;
    const profile = student;
    const mount = document.getElementById("debug-overlay-root") || document.body;

    api.helpers.addGrid({ cell: 48, alpha: 0.3 });
    api.helpers.addLabel(`Debug sandbox: ${profile}`, { x: 16, y: 16, fontSize: 18 });

    const testCards: Card[] = [
        { id: "c1", name: "Common Card", type: "skill", baseDanger: 1, variant: "normal", multiplier: 1, stat: 2, rarity: "common" },
        { id: "c2", name: "Uncommon Card", type: "skill", baseDanger: 4, variant: "split_medium", multiplier: 2, stat: 6, rarity: "uncommon" },
        { id: "c3", name: "Rare Card", type: "skill", baseDanger: 10, variant: "boss_giant", multiplier: 4, stat: 32, rarity: "rare" },
        { id: "c4", name: "Legendary Card", type: "skill", baseDanger: 20, variant: "normal", multiplier: 1, stat: 40, rarity: "legendary" },
    ];

    const grid = renderCardGrid(testCards, { columns: 4 });
    mount.appendChild(grid);

    renderComboCatalog(mount);
    renderStep8PlaytestReport(mount);
}
