import "./student/Hanna/cards.css";

import { DEBUG_ENABLE_HANNA_CARD_GAME } from "./debugFlags";
import { registerStudentRelic } from "./studentHooks";
import { createOverlay, removeOverlay } from "./ui/overlayManager";
import { cardsFromLevel } from "./student/Hanna/cardFactory";
import {
    closeSession,
    getCurrentSession,
    listHannaRelicDefinitions,
    onOverlayShown,
    renderCard,
    resolveRewardVisuals,
    shouldAutoStartAfterBoss,
} from "./student/Hanna/minigame";
import type { Card, SessionEndResult } from "./student/Hanna/types";

const HANNA_OVERLAY_ID = "Hanna.CardMinigame";
const HANNA_OVERLAY_DOM_ID = "hanna-card-minigame-overlay";

type HannaLevelSummary = {
    monsters: Array<{ baseDanger: number; variant?: string | null }>;
};

type HannaCombatClearedPayload = {
    floorIndex?: number;
    floorKind?: string;
    isBossLevel?: boolean;
    levelSummary?: HannaLevelSummary;
};

type HannaOverlayRequest = {
    studentId?: string;
    profile?: string;
    playerId?: number;
    difficulty?: number;
    rewardMultiplier?: number;
    cardCatalog?: Card[];
    levelSummary?: HannaLevelSummary;
    autoStarted?: boolean;
};

type HannaSession = NonNullable<ReturnType<typeof getCurrentSession>>;

type HannaOverlayState = {
    autoStarted: boolean;
    endedResult: SessionEndResult | null;
    mergedCards: Card[];
    mount: HTMLElement;
    playerId: number;
    profile: string;
    session: HannaSession;
};

type HannaRewardPayload = {
    xp?: number;
    gold?: number;
    itemId?: string;
    relicId?: string;
};

const HANNA_RELIC_ICON_URLS: Record<string, string> = {
    hanna_combo_relic: new URL("./student/Hanna/assets/relics/hanna_combo_relic_32x32.png", import.meta.url).href,
    hanna_guardian_relic: new URL("./student/Hanna/assets/relics/hanna_guardian_relic_32x32.png", import.meta.url).href,
    hanna_legend_relic: new URL("./student/Hanna/assets/relics/hanna_legend_relic_32x32.png", import.meta.url).href,
    hanna_swiftness_relic: new URL("./student/Hanna/assets/relics/hanna_swiftness_relic_32x32.png", import.meta.url).href,
};

const HANNA_RELIC_FLAVOR_BY_ID: Record<string, string> = {
    hanna_combo_relic: "A keepsake for chaining small victories into larger ones.",
    hanna_guardian_relic: "A steady charm that turns survival into reward.",
    hanna_legend_relic: "A rare relic that surges with stored battle momentum.",
    hanna_swiftness_relic: "A light relic that rewards fast, decisive clears.",
};

let _installed = false;
let _activeOverlay: HannaOverlayState | null = null;

const _cardCatalogByProfile: Record<string, Card[]> = Object.create(null);
const _lastSessionCardsByProfile: Record<string, Card[]> = Object.create(null);

function _style(el: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLElement {
    Object.assign(el.style, style);
    return el;
}

function _normalizeProfileKey(raw: unknown): string {
    return String(raw || "").trim();
}

function _normalizePlayerId(raw: unknown): number {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? (value | 0) : 0;
}

function _cloneCard(card: Card): Card {
    return {
        ...card,
        data: card && typeof card.data === "object" && card.data != null ? { ...card.data } : card.data,
    };
}

function _cloneCards(cards: Card[]): Card[] {
    const out: Card[] = [];
    for (const card of cards || []) {
        if (!card?.id) continue;
        out.push(_cloneCard(card));
    }
    return out;
}

function _mergeUniqueCards(cards: Card[]): Card[] {
    const out: Card[] = [];
    const seen = new Set<string>();
    for (const card of cards || []) {
        if (!card?.id || seen.has(card.id)) continue;
        seen.add(card.id);
        out.push(_cloneCard(card));
    }
    return out;
}

function _getCatalog(profile: string): Card[] {
    const key = _normalizeProfileKey(profile);
    if (!key) return [];
    return _cloneCards(_cardCatalogByProfile[key] || []);
}

function _setCatalog(profile: string, cards: Card[]): void {
    const key = _normalizeProfileKey(profile);
    if (!key) return;
    _cardCatalogByProfile[key] = _mergeUniqueCards(cards || []);
}

function _mergeCardsIntoCatalog(profile: string, cards: Card[]): void {
    if (!cards.length) return;
    _setCatalog(profile, [..._getCatalog(profile), ...cards]);
}

function _generatedCards(levelSummary?: HannaLevelSummary): Card[] {
    if (!levelSummary || !Array.isArray(levelSummary.monsters)) return [];
    return cardsFromLevel(levelSummary.monsters || []);
}

function _persistRemainingCardIds(profile: string, remainingCardIds: string[]): boolean {
    const key = _normalizeProfileKey(profile);
    if (!key) return false;
    const source = _lastSessionCardsByProfile[key] || _cardCatalogByProfile[key] || [];
    const byId = new Map<string, Card>();
    for (const card of source) {
        if (!card?.id) continue;
        byId.set(card.id, card);
    }

    const next: Card[] = [];
    for (const id of remainingCardIds || []) {
        const card = byId.get(String(id || ""));
        if (!card) continue;
        next.push(card);
    }

    _setCatalog(key, next);
    return true;
}

function _resetCardsForProfile(profile: unknown): void {
    const key = _normalizeProfileKey(profile);
    if (!key) return;
    delete _cardCatalogByProfile[key];
    delete _lastSessionCardsByProfile[key];
}

function _resetAllCards(): void {
    for (const key of Object.keys(_cardCatalogByProfile)) delete _cardCatalogByProfile[key];
    for (const key of Object.keys(_lastSessionCardsByProfile)) delete _lastSessionCardsByProfile[key];
}

function _getLocalPlayerId(): number {
    const g: any = globalThis as any;
    const net: any = g ? (g.__net || g.net) : null;
    return net && typeof net.playerId === "number" ? (net.playerId | 0) : 0;
}

function _getProfileForPlayerId(playerId: number): string {
    const pid = _normalizePlayerId(playerId);
    const g: any = globalThis as any;
    if (pid > 0 && g?.__netProfileByPid && typeof g.__netProfileByPid[pid] === "string") {
        return _normalizeProfileKey(g.__netProfileByPid[pid]);
    }
    if (typeof g?.__localHeroProfileName === "string" && g.__localHeroProfileName.trim()) {
        return _normalizeProfileKey(g.__localHeroProfileName);
    }
    if (typeof g?.__netHelloProfile === "string" && g.__netHelloProfile.trim()) {
        return _normalizeProfileKey(g.__netHelloProfile);
    }
    return "";
}

function _ensureHannaRelicsRegistered(): void {
    const defs = listHannaRelicDefinitions();
    for (const def of defs) {
        if (!def?.id) continue;
        registerStudentRelic({
            id: def.id,
            name: def.name,
            effectKey: def.id,
            effectText: def.effectSummary,
            flavorText: HANNA_RELIC_FLAVOR_BY_ID[def.id] || "",
            iconUrl: HANNA_RELIC_ICON_URLS[def.id],
            rarity: def.id === "hanna_legend_relic" ? "legendary" : "rare",
        } as any);
    }
}

async function _engineGrantReward(playerId: number, reward: HannaRewardPayload): Promise<boolean> {
    const g: any = globalThis as any;
    const pid = _normalizePlayerId(playerId) || _getLocalPlayerId();
    const fn = g ? g.__heGrantPlayerReward : null;
    if (typeof fn === "function") {
        try {
            const res = await Promise.resolve(fn({ playerId: pid | 0, reward }));
            return !!(res && res.ok !== false);
        } catch {
            // fall through to command relay path
        }
    }
    const cmd = { playerId: pid | 0, type: "grantReward", reward };
    if (typeof g?.__net?.sendUiCommand === "function") {
        try {
            const res = await Promise.resolve(g.__net.sendUiCommand(cmd));
            return !!(res && res.ok);
        } catch {
            return false;
        }
    }
    if (typeof g?.__heUiCommand === "function") {
        try {
            const res = await Promise.resolve(g.__heUiCommand(cmd));
            return !!(res && res.ok);
        } catch {
            return false;
        }
    }
    return false;
}

async function _engineApplyRelicUseEffect(playerId: number, effect: any): Promise<boolean> {
    const pid = _normalizePlayerId(playerId) || _getLocalPlayerId();
    const g: any = globalThis as any;
    if (typeof g?.__heApplyRelicUseEffect === "function") {
        try {
            const res = await Promise.resolve(g.__heApplyRelicUseEffect({ playerId: pid | 0, effect }));
            return !!(res && res.ok !== false);
        } catch {
            return false;
        }
    }
    const cmd = {
        playerId: pid | 0,
        type: "applyRelicUseEffect",
        effect,
    };
    if (typeof g?.__net?.sendUiCommand === "function") {
        try {
            const res = await Promise.resolve(g.__net.sendUiCommand(cmd));
            return !!(res && res.ok);
        } catch {
            return false;
        }
    }
    if (typeof g?.__heUiCommand === "function") {
        try {
            const res = await Promise.resolve(g.__heUiCommand(cmd));
            return !!(res && res.ok);
        } catch {
            return false;
        }
    }
    return false;
}

function _formatMs(remainingMs: number): string {
    const total = Math.max(0, Math.ceil((remainingMs || 0) / 1000));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function _labelForCard(card: Card): string {
    const parts = [`${card.stat}`];
    if (card.rarity) parts.push(card.rarity);
    if (card.variant && card.variant !== "normal") parts.push(card.variant);
    return parts.join(" / ");
}

function _closeOverlay(id: string): boolean {
    if (String(id || "").trim() !== HANNA_OVERLAY_ID) return false;
    closeSession();
    removeOverlay(HANNA_OVERLAY_DOM_ID);
    _activeOverlay = null;
    return true;
}

function _renderPlayView(shell: HTMLElement, state: HannaOverlayState): void {
    const { session } = state;
    const remainingMs = Math.max(0, (session.endTs | 0) - Date.now());

    const header = _style(document.createElement("div"), {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        marginBottom: "12px",
    });

    const titleWrap = document.createElement("div");
    const title = _style(document.createElement("div"), {
        fontSize: "28px",
        fontWeight: "700",
        color: "#f7f1df",
    });
    title.textContent = "Hanna's Card Game";
    const subtitle = _style(document.createElement("div"), {
        fontSize: "14px",
        color: "#d7ccb2",
        marginTop: "4px",
    });
    subtitle.textContent = `Profile: ${state.profile || "Unknown"} | Floor ${String((globalThis as any)?.HeroEngine?.dungeonFloor || "")}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const timer = _style(document.createElement("div"), {
        padding: "10px 14px",
        borderRadius: "999px",
        background: "rgba(250, 226, 162, 0.14)",
        border: "1px solid rgba(250, 226, 162, 0.28)",
        color: "#fae2a2",
        fontSize: "20px",
        fontWeight: "700",
        minWidth: "88px",
        textAlign: "center",
    });
    timer.textContent = _formatMs(remainingMs);

    header.appendChild(titleWrap);
    header.appendChild(timer);
    shell.appendChild(header);

    const summary = _style(document.createElement("div"), {
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "14px",
    });
    for (const text of [
        `Cards left: ${session.hand.length}`,
        `Cards played: ${session.played.length}`,
        `Reward x${Math.max(1, Math.round(session.params.rewardMultiplier || 1))}`,
        "Tap cards to play them",
    ]) {
        const pill = _style(document.createElement("div"), {
            padding: "8px 12px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
            color: "#efe7d3",
            fontSize: "13px",
        });
        pill.textContent = text;
        summary.appendChild(pill);
    }
    shell.appendChild(summary);

    const actions = _style(document.createElement("div"), {
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "16px",
    });

    const endBtn = _style(document.createElement("button"), {
        border: "0",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "700",
        padding: "10px 14px",
        background: "#f4d35e",
        color: "#1f1303",
    }) as HTMLButtonElement;
    endBtn.type = "button";
    endBtn.textContent = "End Session";
    endBtn.addEventListener("click", () => {
        if (_activeOverlay?.session) _activeOverlay.session.finish();
    });

    const skipBtn = _style(document.createElement("button"), {
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.06)",
        color: "#f0e6d2",
    }) as HTMLButtonElement;
    skipBtn.type = "button";
    skipBtn.textContent = session.played.length > 0 ? "Close" : (state.autoStarted ? "Skip for now" : "Close");
    skipBtn.disabled = session.played.length > 0;
    skipBtn.style.opacity = skipBtn.disabled ? "0.55" : "1";
    skipBtn.addEventListener("click", () => {
        if (!_activeOverlay) return;
        _setCatalog(_activeOverlay.profile, _activeOverlay.mergedCards);
        _closeOverlay(HANNA_OVERLAY_ID);
    });

    actions.appendChild(endBtn);
    actions.appendChild(skipBtn);
    shell.appendChild(actions);

    if (session.hand.length <= 0 && session.played.length <= 0) {
        const empty = _style(document.createElement("div"), {
            padding: "18px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.06)",
            color: "#efe7d3",
            fontSize: "16px",
            textAlign: "center",
        });
        empty.textContent = "No cards are stored yet. Clear more combat floors before starting Hanna's minigame.";
        shell.appendChild(empty);
        return;
    }

    const board = _style(document.createElement("div"), {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "14px",
        alignItems: "start",
    });

    for (const card of session.hand) {
        const cardEl = renderCard(card, {
            width: 160,
            height: 225,
            onCardClick: () => {
                if (!_activeOverlay || _activeOverlay.endedResult) return;
                _activeOverlay.session.playCard(card.id);
                _renderOverlay();
            },
        });
        _style(cardEl, {
            margin: "0 auto",
        });
        board.appendChild(cardEl);
    }
    shell.appendChild(board);

    const playedTitle = _style(document.createElement("div"), {
        marginTop: "18px",
        marginBottom: "8px",
        fontSize: "14px",
        fontWeight: "700",
        color: "#f7f1df",
    });
    playedTitle.textContent = "Played This Session";
    shell.appendChild(playedTitle);

    const playedWrap = _style(document.createElement("div"), {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        minHeight: "36px",
    });
    for (const card of session.played) {
        const chip = _style(document.createElement("div"), {
            padding: "8px 10px",
            borderRadius: "999px",
            background: "rgba(252, 203, 110, 0.14)",
            border: "1px solid rgba(252, 203, 110, 0.24)",
            color: "#ffe9b4",
            fontSize: "12px",
        });
        chip.textContent = _labelForCard(card);
        playedWrap.appendChild(chip);
    }
    if (session.played.length <= 0) {
        const hint = _style(document.createElement("div"), {
            color: "#c8baa1",
            fontSize: "13px",
        });
        hint.textContent = "No cards played yet.";
        playedWrap.appendChild(hint);
    }
    shell.appendChild(playedWrap);
}

function _renderResultView(shell: HTMLElement, state: HannaOverlayState): void {
    const result = state.endedResult;
    if (!result) return;

    const outcome = _style(document.createElement("div"), {
        fontSize: "30px",
        fontWeight: "700",
        color: result.gameOver.outcome === "win" ? "#f7e39b" : "#ffd7c2",
        marginBottom: "8px",
    });
    outcome.textContent = result.gameOver.outcome === "win" ? "Session Complete" : "Session Over";
    shell.appendChild(outcome);

    const meta = _style(document.createElement("div"), {
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "16px",
    });
    for (const text of [
        `Outcome: ${result.gameOver.outcome}`,
        `Reason: ${result.gameOver.reason}`,
        `Score: ${result.gameOver.score}`,
        `Remaining cards: ${result.remainingCardIds.length}`,
    ]) {
        const pill = _style(document.createElement("div"), {
            padding: "8px 12px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
            color: "#efe7d3",
            fontSize: "13px",
        });
        pill.textContent = text;
        meta.appendChild(pill);
    }
    shell.appendChild(meta);

    const rewardWrap = _style(document.createElement("div"), {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        marginBottom: "18px",
        padding: "14px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.06)",
    });
    const rewardText = _style(document.createElement("div"), {
        display: "grid",
        gap: "6px",
        color: "#f7f1df",
        fontSize: "14px",
    });
    const rewardLines: string[] = [];
    if (result.reward.xp) rewardLines.push(`XP +${result.reward.xp}`);
    if (result.reward.gold) rewardLines.push(`Gold +${result.reward.gold}`);
    if (result.reward.relicId) rewardLines.push(`Relic: ${result.reward.relicId}`);
    if (rewardLines.length <= 0) rewardLines.push("No reward granted");
    rewardText.textContent = rewardLines.join(" | ");
    rewardWrap.appendChild(rewardText);

    const visuals = resolveRewardVisuals(result.reward);
    if (visuals?.relicAssetPath) {
        const img = document.createElement("img");
        img.src = visuals.relicAssetPath;
        img.alt = String(result.reward.relicId || "Relic reward");
        _style(img, {
            width: "48px",
            height: "48px",
            imageRendering: "pixelated",
        });
        rewardWrap.appendChild(img);
    }
    shell.appendChild(rewardWrap);

    const combos = _style(document.createElement("div"), {
        display: "grid",
        gap: "10px",
        marginBottom: "18px",
    });
    const combosTitle = _style(document.createElement("div"), {
        fontSize: "15px",
        fontWeight: "700",
        color: "#f7f1df",
    });
    combosTitle.textContent = "Combos";
    combos.appendChild(combosTitle);

    if (result.combos.length <= 0) {
        const none = _style(document.createElement("div"), {
            color: "#c8baa1",
            fontSize: "13px",
        });
        none.textContent = "No valid combos were formed.";
        combos.appendChild(none);
    } else {
        for (const combo of result.combos) {
            const row = _style(document.createElement("div"), {
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                color: "#efe7d3",
                fontSize: "13px",
            });
            const rewards: string[] = [];
            if (combo.reward.xp) rewards.push(`XP +${combo.reward.xp}`);
            if (combo.reward.gold) rewards.push(`Gold +${combo.reward.gold}`);
            if (combo.reward.relicId) rewards.push(`Relic ${combo.reward.relicId}`);
            row.textContent = `${combo.name} (Tier ${combo.tier}) | ${combo.cards.join(", ")}${rewards.length ? ` | ${rewards.join(" | ")}` : ""}`;
            combos.appendChild(row);
        }
    }
    shell.appendChild(combos);

    const doneBtn = _style(document.createElement("button"), {
        border: "0",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "700",
        padding: "10px 14px",
        background: "#f4d35e",
        color: "#1f1303",
    }) as HTMLButtonElement;
    doneBtn.type = "button";
    doneBtn.textContent = "Continue";
    doneBtn.addEventListener("click", () => {
        _closeOverlay(HANNA_OVERLAY_ID);
    });
    shell.appendChild(doneBtn);
}

function _renderOverlay(): void {
    const state = _activeOverlay;
    if (!state) return;

    state.mount.innerHTML = "";

    const shell = _style(document.createElement("div"), {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(1100px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        borderRadius: "24px",
        padding: "24px",
        boxSizing: "border-box",
        background: "linear-gradient(180deg, #2c2016 0%, #1a1310 100%)",
        border: "1px solid rgba(255, 223, 161, 0.18)",
        boxShadow: "0 30px 80px rgba(0, 0, 0, 0.55)",
        fontFamily: "\"Trebuchet MS\", Verdana, sans-serif",
    });

    state.mount.appendChild(shell);

    if (state.endedResult) {
        _renderResultView(shell, state);
        return;
    }

    _renderPlayView(shell, state);
}

function _openOverlay(id: string, request?: HannaOverlayRequest): boolean {
    if (String(id || "").trim() !== HANNA_OVERLAY_ID) return false;
    if (!DEBUG_ENABLE_HANNA_CARD_GAME) return false;

    if (_activeOverlay) _closeOverlay(HANNA_OVERLAY_ID);

    const playerId = _normalizePlayerId(request?.playerId) || _getLocalPlayerId();
    const profile =
        _normalizeProfileKey(request?.profile) ||
        _getProfileForPlayerId(playerId) ||
        _normalizeProfileKey(request?.studentId);

    if (!profile) return false;

    const mount = createOverlay({
        id: HANNA_OVERLAY_DOM_ID,
        blocksInput: true,
        visible: true,
        style: {
            background: "rgba(9, 8, 7, 0.7)",
            display: "block",
            inset: "0",
            zIndex: "4900",
        },
    });
    if (!mount) return false;

    const overlayData: HannaOverlayRequest = {
        ...request,
        playerId,
        profile,
        studentId: profile,
        cardCatalog: Array.isArray(request?.cardCatalog) ? request?.cardCatalog : _getCatalog(profile),
    };

    const session = onOverlayShown(overlayData) as HannaSession | null;
    if (!session) {
        removeOverlay(HANNA_OVERLAY_DOM_ID);
        return false;
    }

    const mergedCards = _cloneCards(session.hand);
    _lastSessionCardsByProfile[profile] = _cloneCards(mergedCards);

    const prevOnTick = session.onTick;
    session.onTick = (remainingMs: number) => {
        try { prevOnTick?.(remainingMs); } catch { }
        _renderOverlay();
    };

    const prevOnEnd = session.onEnd;
    session.onEnd = async (result: SessionEndResult) => {
        try {
            await Promise.resolve(prevOnEnd?.(result));
        } finally {
            if (_activeOverlay && _activeOverlay.profile === profile) {
                _activeOverlay.endedResult = result;
                _renderOverlay();
            }
        }
    };

    _activeOverlay = {
        autoStarted: request?.autoStarted !== false,
        endedResult: null,
        mergedCards,
        mount,
        playerId,
        profile,
        session,
    };

    _renderOverlay();
    return true;
}

async function _handleCombatCleared(payload?: HannaCombatClearedPayload): Promise<void> {
    if (!DEBUG_ENABLE_HANNA_CARD_GAME) return;
    const localPlayerId = _getLocalPlayerId();
    const profile = _getProfileForPlayerId(localPlayerId);
    if (!profile) return;

    const currentCatalog = _getCatalog(profile);
    const currentLevelSummary = payload?.levelSummary;
    const shouldStart = shouldAutoStartAfterBoss({
        isBossLevel: !!payload?.isBossLevel,
        cardCatalog: currentCatalog,
        levelSummary: currentLevelSummary,
    });

    if (!payload?.isBossLevel || !shouldStart) {
        const generated = _generatedCards(currentLevelSummary);
        if (generated.length) _mergeCardsIntoCatalog(profile, generated);
        return;
    }

    const didOpen = _openOverlay(HANNA_OVERLAY_ID, {
        autoStarted: true,
        cardCatalog: currentCatalog,
        difficulty: 1,
        levelSummary: currentLevelSummary,
        playerId: localPlayerId,
        profile,
        rewardMultiplier: 1,
        studentId: profile,
    });

    if (!didOpen) {
        const generated = _generatedCards(currentLevelSummary);
        if (generated.length) _mergeCardsIntoCatalog(profile, generated);
    }
}

_ensureHannaRelicsRegistered();

export function installHannaCardGameIntegration(): void {
    if (_installed) return;
    _installed = true;

    const g: any = globalThis as any;
    if (!g) return;

    const prevOpenOverlay = typeof g.openOverlay === "function" ? g.openOverlay.bind(g) : null;
    const prevCloseOverlay = typeof g.closeOverlay === "function" ? g.closeOverlay.bind(g) : null;
    const prevGrantPlayerReward = typeof g.grantPlayerReward === "function" ? g.grantPlayerReward.bind(g) : null;
    const prevPersistStudentCards = typeof g.persistStudentCards === "function" ? g.persistStudentCards.bind(g) : null;
    const prevOnStudentMinigameComplete =
        typeof g.onStudentMinigameComplete === "function" ? g.onStudentMinigameComplete.bind(g) : null;
    const prevApplyRelicUseEffect = typeof g.applyRelicUseEffect === "function" ? g.applyRelicUseEffect.bind(g) : null;

    g.openOverlay = (id: string, data?: HannaOverlayRequest): boolean => {
        if (String(id || "").trim() === HANNA_OVERLAY_ID) return _openOverlay(id, data);
        return prevOpenOverlay ? !!prevOpenOverlay(id, data) : false;
    };
    g.closeOverlay = (id: string): boolean => {
        if (String(id || "").trim() === HANNA_OVERLAY_ID) return _closeOverlay(id);
        return prevCloseOverlay ? !!prevCloseOverlay(id) : false;
    };
    g.grantPlayerReward = async (reward: HannaRewardPayload): Promise<boolean> => {
        if (_activeOverlay) return _engineGrantReward(_activeOverlay.playerId, reward);
        if (prevGrantPlayerReward) return !!(await Promise.resolve(prevGrantPlayerReward(reward)));
        return false;
    };
    g.persistStudentCards = async (studentId: string, remainingCardIds: string[]): Promise<boolean> => {
        const profile = _activeOverlay?.profile || _normalizeProfileKey(studentId);
        if (profile) return _persistRemainingCardIds(profile, Array.isArray(remainingCardIds) ? remainingCardIds : []);
        if (prevPersistStudentCards) return !!(await Promise.resolve(prevPersistStudentCards(studentId, remainingCardIds)));
        return false;
    };
    g.onStudentMinigameComplete = async (result: SessionEndResult): Promise<boolean> => {
        g.__hannaLastMinigameResult = result;
        if (prevOnStudentMinigameComplete) {
            await Promise.resolve(prevOnStudentMinigameComplete(result));
        }
        return true;
    };
    g.applyRelicUseEffect = async (playerId: number, effect: any): Promise<boolean> => {
        const ok = await _engineApplyRelicUseEffect(playerId, effect);
        if (ok) return true;
        if (prevApplyRelicUseEffect) return !!(await Promise.resolve(prevApplyRelicUseEffect(playerId, effect)));
        return false;
    };
    g.__heHannaOnCombatCleared = (payload?: HannaCombatClearedPayload): void => {
        void _handleCombatCleared(payload);
    };
    g.__heHannaResetCardsForProfile = (profile: string): void => {
        _resetCardsForProfile(profile);
    };
    g.__heHannaResetAllCards = (): void => {
        _resetAllCards();
    };
}
