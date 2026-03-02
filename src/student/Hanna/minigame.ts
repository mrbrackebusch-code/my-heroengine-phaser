import { registerStudentOverlay, requestHook } from "../../studentSystemsHooks";
import type { Card, Combo, Reward, SessionEndResult, SessionParams } from "./types";
import { cardsFromLevel } from "./cardFactory";
import { renderCard, renderCardGrid, updateCardLabels } from "./cardRenderer";  
import { getRewardVisuals } from "./rewardAssets";
import { applyRelicRewardEffect, HANNA_RELIC_DEFINITIONS, listAwardedRelicsForCombos } from "./relicLogic";

type ComboKind = "pair" | "sequence" | "set" | "legendaryChain";

type ComboRewardSpec = {
    name: string;
    tier: number;
    baseXp?: number;
    baseGold?: number;
    relicId?: string;
};

type SessionEndTrigger = "time_expired" | "cards_exhausted" | "manual";

type AutoStartDecisionInput = {
    isBossLevel?: boolean;
    cardCatalog?: unknown;
    levelSummary?: { monsters?: Array<{ baseDanger: number; variant?: string | null }> };
};

const COMBO_REWARD_TABLE: Record<ComboKind, ComboRewardSpec> = {
    pair: { name: "Pair", tier: 1, baseXp: 1 },
    sequence: { name: "Sequence", tier: 2, baseGold: 5 },
    set: { name: "Set", tier: 3, baseXp: 5 },
    legendaryChain: { name: "Legendary Chain", tier: 4, relicId: "hanna_legend_relic" },
};

const GAME_OVER_RULES = {
    minScoreToWin: 5,
    relicAutoWin: true,
} as const;

const AUTO_START_POLICY = {
    minCardsToAutoStart: 3,
} as const;

function _toReward(spec: ComboRewardSpec, multiplier: number): Reward {
    const reward: Reward = {};
    if (spec.baseXp) reward.xp = spec.baseXp * multiplier;
    if (spec.baseGold) reward.gold = spec.baseGold * multiplier;
    if (spec.relicId) reward.relicId = spec.relicId;
    return reward;
}

function _toGrantRewardPayload(reward: Reward): { xp?: number; gold?: number; itemId?: string; relicId?: string } {
    const payload: { xp?: number; gold?: number; itemId?: string; relicId?: string } = {};
    if (typeof reward.xp === "number" && reward.xp > 0) payload.xp = reward.xp;
    if (typeof reward.gold === "number" && reward.gold > 0) payload.gold = reward.gold;
    if (reward.itemId) payload.itemId = reward.itemId;
    if (reward.relicId) payload.relicId = reward.relicId;
    return payload;
}

function _isCard(value: unknown): value is Card {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<Card>;
    return typeof candidate.id === "string"
        && typeof candidate.name === "string"
        && typeof candidate.type === "string"
        && typeof candidate.stat === "number"
        && typeof candidate.rarity === "string";
}

function _normalizeIncomingCards(raw: unknown): Card[] {
    if (!Array.isArray(raw)) return [];
    const cards: Card[] = [];
    for (const item of raw) {
        if (_isCard(item)) cards.push(item);
    }
    return cards;
}

function _mergeUniqueCards(first: Card[], second: Card[]): Card[] {
    const seen = new Set<string>();
    const out: Card[] = [];
    for (const card of [...first, ...second]) {
        if (!card?.id || seen.has(card.id)) continue;
        seen.add(card.id);
        out.push(card);
    }
    return out;
}

export function getComboCatalog(): Array<{ key: ComboKind; name: string; tier: number; reward: Reward }> {
    return (Object.keys(COMBO_REWARD_TABLE) as ComboKind[]).map((key) => {
        const spec = COMBO_REWARD_TABLE[key];
        return {
            key,
            name: spec.name,
            tier: spec.tier,
            reward: _toReward(spec, 1),
        };
    });
}

export function getGameOverRules() {
    return { ...GAME_OVER_RULES };
}

export function getBossAutoStartPolicy() {
    return { ...AUTO_START_POLICY };
}

export function shouldAutoStartAfterBoss(input?: AutoStartDecisionInput): boolean {
    if (!input?.isBossLevel) return false;
    const persistedCards = _normalizeIncomingCards(input.cardCatalog);
    const generatedCards = (input.levelSummary && Array.isArray(input.levelSummary.monsters))
        ? cardsFromLevel(input.levelSummary.monsters)
        : [];
    const mergedCards = _mergeUniqueCards(persistedCards, generatedCards);
    return mergedCards.length >= AUTO_START_POLICY.minCardsToAutoStart;
}

// Register overlay definition (student-owned definition only)
registerStudentOverlay({
    id: "Hanna.CardMinigame",
    purpose: "Card combo minigame overlay for Hanna",
    blocksInput: true,
});

// Request runtime hooks we need from core (documented for maintainers)
requestHook({
    id: "Hanna.OpenOverlay",
    summary: "Provide a runtime API to open/close student overlays by id",
    details:
        "We register an overlay id 'Hanna.CardMinigame'. We need core to provide `openOverlay(id:string, data?:any)` and `closeOverlay(id:string)` that mount the overlay DOM and call back into exported overlay handlers.",
    suggestedSignature: "openOverlay(id: string, data?: any): void; closeOverlay(id: string): void;",
    requestedBy: "Hanna",
});

requestHook({
    id: "Hanna.AutoStartAfterBoss",
    summary: "Auto-start Hanna minigame after boss win when hand is large enough",
    details:
        "Core should evaluate boss-win flow using shouldAutoStartAfterBoss(...). If true, open overlay automatically. If false, continue normal game flow without auto-opening.",
    suggestedSignature: "shouldAutoStartAfterBoss(input: { isBossLevel?: boolean; cardCatalog?: Card[]; levelSummary?: { monsters?: Array<{ baseDanger: number; variant?: string | null }> } }): boolean",
    requestedBy: "Hanna",
});

requestHook({
    id: "Hanna.PersistCards",
    summary: "Persist remaining unplayed card IDs after minigame completion",
    details:
        "Student minigame consumes played cards and should persist only remaining card IDs. Core should provide `persistStudentCards(studentId, cardIds)` for durable catalog state.",
    suggestedSignature: "persistStudentCards(studentId: string, cardIds: string[]): Promise<boolean> | void",
    requestedBy: "Hanna",
});

requestHook({
    id: "Hanna.MinigameComplete",
    summary: "Optional completion callback for telemetry and post-processing",
    details:
        "After minigame end, student code can send full session result payload so core can record telemetry and trigger follow-up UI.",
    suggestedSignature: "onStudentMinigameComplete(result: SessionEndResult): Promise<void> | void",
    requestedBy: "Hanna",
});

requestHook({
    id: "Hanna.ApplyRelicUseEffect",
    summary: "Apply active legend relic use effects in combat runtime",
    details:
        "Legend relic effects are active-use only and must be applied at combat use time (heal-to-max, +25 XP, 2x damage for 30s, max 3 uses).",
    suggestedSignature: "applyRelicUseEffect(playerId: string, effect: { relicId: string; healToMax?: boolean; damageMultiplier?: number; durationMs?: number; maxUses?: number; xpBonus?: number }): Promise<boolean>",
    requestedBy: "Hanna",
});

requestHook({
    id: "Hanna.GrantReward",
    summary: "Provide an API for student systems to grant computed rewards to the player",
    details:
        "After the minigame finishes, we will compute a Reward object. Core should provide `grantPlayerReward(reward)` to apply xp/gold/items/relics to the player's profile.",
    suggestedSignature: "grantPlayerReward(reward: { xp?: number; gold?: number; itemId?: string; relicId?: string }): Promise<boolean>",
    requestedBy: "Hanna",
});

// --- Minigame core logic (engine-agnostic) ---------------------------------

export class CardMinigameSession {
    params: SessionParams;
    hand: Card[] = [];
    played: Card[] = [];
    combos: Combo[] = [];
    startTs = 0;
    endTs = 0;
    timerId: any = null;
    endTrigger: SessionEndTrigger = "manual";
    onTick: ((remainingMs: number) => void) | null = null;
    onEnd: ((result: SessionEndResult) => void) | null = null;

    constructor(params?: SessionParams) {
        this.params = {
            difficulty: params?.difficulty || 1,
            rewardMultiplier: params?.rewardMultiplier || 1,
            maxDurationMs: params?.maxDurationMs || 90_000,
        };
    }

    start() {
        this.endTrigger = "manual";
        this.startTs = Date.now();
        this.endTs = this.startTs + (this.params.maxDurationMs || 90_000);
        // start a tick loop
        this.timerId = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, this.endTs - now);
            if (this.onTick) this.onTick(remaining);
            if (remaining <= 0) {
                this.endTrigger = "time_expired";
                this.finish();
            }
        }, 250);
    }

    stop() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
    }

    finish() {
        this.stop();
        if (this.endTrigger === "manual" && this.hand.length === 0) {
            this.endTrigger = "cards_exhausted";
        }
        const consumedCardIds = this.played.map((card) => card.id);
        const remainingCardIds = this.hand.map((card) => card.id);
        const combos = this.evaluateCombos();
        const awardedRelicIds = listAwardedRelicsForCombos(combos);
        this.combos = combos;
        const reward = this.computeReward(combos, awardedRelicIds);
        const gameOver = this.computeGameOver(combos, reward, this.endTrigger);

        // Played cards are consumed; only unplayed cards remain in hand.
        this.played = [];

        if (this.onEnd) this.onEnd({ combos, reward, gameOver, consumedCardIds, remainingCardIds, awardedRelicIds });
    }

    // Player action: play a card from hand
    playCard(cardId: string) {
        const idx = this.hand.findIndex((c) => c.id === cardId);
        if (idx < 0) return false;
        const [card] = this.hand.splice(idx, 1);
        this.played.push(card);
        if (this.hand.length === 0) {
            this.endTrigger = "cards_exhausted";
            this.finish();
        }
        return true;
    }

    // Simple combo evaluation logic — pure and testable
    evaluateCombos(): Combo[] {
        const combos: Combo[] = [];
        const played = this.played.slice();
        const multiplier = this.params.rewardMultiplier || 1;
        if (!played.length) return combos;

        // Example rules (simple):
        // - Any adjacent pair of same type => Pair (tier 1)
        // - Any ascending sequence of 3 by power => Sequence (tier 2)
        // - Any three of same rarity => Set (tier 3)
        // - 4+ played with mixed high rarity => Legendary chain (tier 4)

        // Pairs
        for (let i = 0; i < played.length - 1; i++) {
            const a = played[i];
            const b = played[i + 1];
            if (a.type === b.type) {
                const spec = COMBO_REWARD_TABLE.pair;
                combos.push({
                    id: `pair-${i}`,
                    name: spec.name,
                    tier: spec.tier,
                    cards: [a.id, b.id],
                    reward: _toReward(spec, multiplier),
                });
            }
        }

        // Sequences of length 3 by increasing power
        for (let i = 0; i < played.length - 2; i++) {
            const a = played[i];
            const b = played[i + 1];
            const c = played[i + 2];
            if (a.stat < b.stat && b.stat < c.stat) {
                const spec = COMBO_REWARD_TABLE.sequence;
                combos.push({
                    id: `seq-${i}`,
                    name: spec.name,
                    tier: spec.tier,
                    cards: [a.id, b.id, c.id],
                    reward: _toReward(spec, multiplier),
                });
            }
        }

        // Sets (three same rarity)
        for (let i = 0; i < played.length - 2; i++) {
            const a = played[i];
            const b = played[i + 1];
            const c = played[i + 2];
            if (a.rarity === b.rarity && b.rarity === c.rarity) {
                const spec = COMBO_REWARD_TABLE.set;
                combos.push({
                    id: `set-${i}`,
                    name: spec.name,
                    tier: spec.tier,
                    cards: [a.id, b.id, c.id],
                    reward: _toReward(spec, multiplier),
                });
            }
        }

        // Legendary chain
        const highRarity = played.filter((p) => p.rarity === "legendary");
        if (played.length >= 4 && highRarity.length >= 2) {
            const spec = COMBO_REWARD_TABLE.legendaryChain;
            combos.push({
                id: "legend-chain",
                name: spec.name,
                tier: spec.tier,
                cards: played.map((p) => p.id),
                reward: _toReward(spec, multiplier),
            });
        }

        return combos;
    }

    computeReward(combos: Combo[], awardedRelicIds: string[] = []): Reward {
        // Aggregate rewards simply: sum XP and gold; prefer relic if any combo has one.
        const reward: Reward = { xp: 0, gold: 0 };
        for (const c of combos) {
            if (c.reward.xp) reward.xp = (reward.xp || 0) + c.reward.xp;
            if (c.reward.gold) reward.gold = (reward.gold || 0) + c.reward.gold;
            if (c.reward.itemId && !reward.itemId) reward.itemId = c.reward.itemId;
            if (c.reward.relicId && !reward.relicId) reward.relicId = c.reward.relicId;
        }

        // Ensure all Hanna relics can be awarded based on combo tiers.
        const selectedRelic = reward.relicId || awardedRelicIds[0];
        if (selectedRelic && !reward.relicId) {
            reward.relicId = selectedRelic;
        }

        const peakTier = combos.reduce((maxTier, combo) => Math.max(maxTier, combo.tier), 0);
        const difficulty = this.params.difficulty || 1;

        let poweredReward = { ...reward };
        const uniqueRelics = Array.from(new Set(awardedRelicIds));
        for (const relicId of uniqueRelics) {
            poweredReward = applyRelicRewardEffect(poweredReward, relicId, { difficulty, peakTier });
        }

        return poweredReward;
    }

    computeGameOver(combos: Combo[], reward: Reward, endTrigger: SessionEndTrigger): SessionEndResult["gameOver"] {
        const comboScore = combos.reduce((sum, combo) => sum + (combo.tier * combo.cards.length), 0);
        const rewardScore = (reward.xp || 0) + (reward.gold || 0);
        const score = comboScore + rewardScore;

        if (GAME_OVER_RULES.relicAutoWin && reward.relicId) {
            return {
                outcome: "win",
                reason: "legendary_chain",
                score,
            };
        }

        if (combos.length <= 0) {
            return {
                outcome: "lose",
                reason: "no_valid_combo",
                score,
            };
        }

        if (score >= GAME_OVER_RULES.minScoreToWin) {
            return {
                outcome: "win",
                reason: "combo_success",
                score,
            };
        }

        if (endTrigger === "cards_exhausted") {
            return {
                outcome: "lose",
                reason: "cards_exhausted",
                score,
            };
        }

        return {
            outcome: "lose",
            reason: "time_expired",
            score,
        };
    }
}

// Exported entry points for core to call into when overlay is shown
let _currentSession: CardMinigameSession | null = null;

export function createSession(params?: SessionParams) {
    return new CardMinigameSession(params);
}

export function getCurrentSession(): CardMinigameSession | null {
    return _currentSession;
}

export function resolveRewardVisuals(reward: Reward) {
    return getRewardVisuals(reward);
}

export function listHannaRelicDefinitions() {
    return Object.values(HANNA_RELIC_DEFINITIONS);
}

export function onOverlayShown(data?: any) {
    // Core should call this after opening the overlay with id 'Hanna.CardMinigame'
    _currentSession = createSession({
        difficulty: data?.difficulty || 1,
        rewardMultiplier: data?.rewardMultiplier || 1,
    });

    // Hook up simple lifecycle handlers (core can override by calling session methods directly)
    _currentSession.onTick = (remaining) => {
        // We intentionally do not call console.*; core overlay renderer should poll session state.
    };

    _currentSession.onEnd = async ({ combos, reward, gameOver, consumedCardIds, remainingCardIds, awardedRelicIds }) => {
        // Ask core to grant reward. We documented the hook above.
        try {
            // attempt to call global hook if core exposes it (non-core call — best-effort)
            const fn: any = (globalThis as any).grantPlayerReward;
            if (typeof fn === "function") {
                const primaryPayload = _toGrantRewardPayload(reward);
                if (Object.keys(primaryPayload).length > 0) {
                    await Promise.resolve(fn(primaryPayload));
                }

                // Grant any additional relics without duplicating XP/Gold.
                const primaryRelicId = reward.relicId;
                const extraRelics = awardedRelicIds.filter((id) => id && id !== primaryRelicId);
                for (const relicId of extraRelics) {
                    await Promise.resolve(fn({ relicId }));
                }
            }

            // Persist remaining (unplayed) cards so played cards are removed.
            const persistFn: any = (globalThis as any).persistStudentCards;
            if (typeof persistFn === "function") {
                const studentId = String(data?.studentId || data?.profile || "Hanna");
                await Promise.resolve(persistFn(studentId, remainingCardIds));
            }

            // optional richer callback for overlay/UI analytics
            const reportFn: any = (globalThis as any).onStudentMinigameComplete;
            if (typeof reportFn === "function") {
                await Promise.resolve(reportFn({ combos, reward, gameOver, consumedCardIds, remainingCardIds, awardedRelicIds } as SessionEndResult));
            }
        } catch {
            // ignore; core may implement properly later
        }
    };

    // Load persisted card catalog if provided by core.
    // Expected: data.cardCatalog: Card[]
    const persistedCards = _normalizeIncomingCards(data?.cardCatalog);

    // If overlay was opened with `data.levelSummary` we can generate cards now.
    // Expected `data.levelSummary` structure: { monsters: Array<{ baseDanger:number, variant?:string }> }
    const generatedCards = (data && data.levelSummary && Array.isArray(data.levelSummary.monsters))
        ? cardsFromLevel(data.levelSummary.monsters)
        : [];

    // Session hand is persisted catalog merged with newly generated level cards.
    _currentSession.hand = _mergeUniqueCards(persistedCards, generatedCards);

    _currentSession.start();
    return _currentSession;
}

export function closeSession() {
    if (_currentSession) {
        _currentSession.stop();
        _currentSession = null;
    }
}

// --- Card Rendering Exports ---
// Overlay can use these to render cards with dynamic labels

export { renderCard, renderCardGrid, updateCardLabels } from "./cardRenderer";
export type { CardRendererOptions } from "./cardRenderer";
