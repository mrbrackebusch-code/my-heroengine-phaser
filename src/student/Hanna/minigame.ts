import { registerStudentOverlay, requestHook } from "../../studentSystemsHooks";
import type { Card, Combo, Reward, SessionParams } from "./types";
import { cardsFromLevel } from "./cardFactory";
import { renderCard, renderCardGrid, updateCardLabels } from "./cardRenderer";  

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
    onTick: ((remainingMs: number) => void) | null = null;
    onEnd: ((result: { combos: Combo[]; reward: Reward }) => void) | null = null;

    constructor(params?: SessionParams) {
        this.params = {
            difficulty: params?.difficulty || 1,
            rewardMultiplier: params?.rewardMultiplier || 1,
            maxDurationMs: params?.maxDurationMs || 90_000,
        };
    }

    start() {
        this.startTs = Date.now();
        this.endTs = this.startTs + (this.params.maxDurationMs || 90_000);
        // start a tick loop
        this.timerId = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, this.endTs - now);
            if (this.onTick) this.onTick(remaining);
            if (remaining <= 0) this.finish();
        }, 250);
    }

    stop() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
    }

    finish() {
        this.stop();
        const combos = this.evaluateCombos();
        this.combos = combos;
        const reward = this.computeReward(combos);
        if (this.onEnd) this.onEnd({ combos, reward });
    }

    // Player action: play a card from hand
    playCard(cardId: string) {
        const idx = this.hand.findIndex((c) => c.id === cardId);
        if (idx < 0) return false;
        const [card] = this.hand.splice(idx, 1);
        this.played.push(card);
        return true;
    }

    // Simple combo evaluation logic — pure and testable
    evaluateCombos(): Combo[] {
        const combos: Combo[] = [];
        const played = this.played.slice();
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
                combos.push({
                    id: `pair-${i}`,
                    name: "Pair",
                    tier: 1,
                    cards: [a.id, b.id],
                    reward: { xp: 1 * (this.params.rewardMultiplier || 1) },
                });
            }
        }

        // Sequences of length 3 by increasing power
        for (let i = 0; i < played.length - 2; i++) {
            const a = played[i];
            const b = played[i + 1];
            const c = played[i + 2];
            if (a.stat < b.stat && b.stat < c.stat) {
                combos.push({
                    id: `seq-${i}`,
                    name: "Sequence",
                    tier: 2,
                    cards: [a.id, b.id, c.id],
                    reward: { gold: 5 * (this.params.rewardMultiplier || 1) },
                });
            }
        }

        // Sets (three same rarity)
        for (let i = 0; i < played.length - 2; i++) {
            const a = played[i];
            const b = played[i + 1];
            const c = played[i + 2];
            if (a.rarity === b.rarity && b.rarity === c.rarity) {
                combos.push({
                    id: `set-${i}`,
                    name: "Set",
                    tier: 3,
                    cards: [a.id, b.id, c.id],
                    reward: { xp: 5 * (this.params.rewardMultiplier || 1) },
                });
            }
        }

        // Legendary chain
        const highRarity = played.filter((p) => p.rarity === "legendary");
        if (played.length >= 4 && highRarity.length >= 2) {
            combos.push({
                id: "legend-chain",
                name: "Legendary Chain",
                tier: 4,
                cards: played.map((p) => p.id),
                reward: { relicId: "hanna_legend_relic" },
            });
        }

        return combos;
    }

    computeReward(combos: Combo[]): Reward {
        // Aggregate rewards simply: sum XP and gold; prefer relic if any combo has one.
        const reward: Reward = { xp: 0, gold: 0 };
        for (const c of combos) {
            if (c.reward.xp) reward.xp = (reward.xp || 0) + c.reward.xp;
            if (c.reward.gold) reward.gold = (reward.gold || 0) + c.reward.gold;
            if (c.reward.itemId && !reward.itemId) reward.itemId = c.reward.itemId;
            if (c.reward.relicId && !reward.relicId) reward.relicId = c.reward.relicId;
        }

        // Fallback small reward if nothing formed
        if ((!reward.xp || reward.xp <= 0) && (!reward.gold || reward.gold <= 0) && !reward.relicId) {
            reward.xp = 1; // small consolation XP
        }

        return reward;
    }
}

// Exported entry points for core to call into when overlay is shown
let _currentSession: CardMinigameSession | null = null;

export function createSession(params?: SessionParams) {
    return new CardMinigameSession(params);
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

    _currentSession.onEnd = async ({ combos, reward }) => {
        // Ask core to grant reward. We documented the hook above.
        try {
            // attempt to call global hook if core exposes it (non-core call — best-effort)
            const fn: any = (globalThis as any).grantPlayerReward;
            if (typeof fn === "function") {
                await Promise.resolve(fn(reward));
            }
        } catch {
            // ignore; core may implement properly later
        }
    };

    // If overlay was opened with `data.levelSummary` we can generate cards now
    // Expected `data.levelSummary` structure: { monsters: Array<{ baseDanger:number, variant?:string }> }
    if (data && data.levelSummary && Array.isArray(data.levelSummary.monsters)) {
        const cards: Card[] = cardsFromLevel(data.levelSummary.monsters);
        // Store cards in session for later combo use
        _currentSession.hand = cards as any as Card[]; // hand field reused to hold awarded cards
    }

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
