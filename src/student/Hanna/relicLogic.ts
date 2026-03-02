import type { Combo, Reward } from "./types";

export type HannaRelicId =
    | "hanna_legend_relic"
    | "hanna_combo_relic"
    | "hanna_guardian_relic"
    | "hanna_swiftness_relic";

export type HannaRelicDefinition = {
    id: HannaRelicId;
    name: string;
    effectSummary: string;
};

export const LEGEND_RELIC_MAX_USES = 3;
export const LEGEND_RELIC_DAMAGE_MULTIPLIER = 2;
export const LEGEND_RELIC_DAMAGE_BOOST_MS = 30_000;
export const LEGEND_RELIC_XP_ON_USE = 25;

export type LegendRelicState = {
    usesConsumed: number;
    damageBoostUntilMs: number;
};

export type LegendRelicUseResult = {
    activated: boolean;
    healToMax: boolean;
    xpBonus: number;
    boostedDamage: number;
    nextState: LegendRelicState;
    reason?: "no_uses_left";
};

type RelicPowerProfile = {
    xpBase?: number;
    goldBase?: number;
    xpPerDifficulty?: number;
    goldPerDifficulty?: number;
    bonusIfLegendaryChain?: { xp?: number; gold?: number };
};

export const HANNA_RELIC_DEFINITIONS: Record<HannaRelicId, HannaRelicDefinition> = {
    hanna_legend_relic: {
        id: "hanna_legend_relic",
        name: "Legend Relic",
        effectSummary: "Active use: full heal, +25 XP, and 2x damage for 30s (max 3 uses).",
    },
    hanna_combo_relic: {
        id: "hanna_combo_relic",
        name: "Combo Relic",
        effectSummary: "Combo bonus: +2 XP.",
    },
    hanna_guardian_relic: {
        id: "hanna_guardian_relic",
        name: "Guardian Relic",
        effectSummary: "Defensive payout: +2 Gold.",
    },
    hanna_swiftness_relic: {
        id: "hanna_swiftness_relic",
        name: "Swiftness Relic",
        effectSummary: "Fast-clear bonus: +1 XP and +1 Gold.",
    },
};

const RELIC_POWER_BY_ID: Record<HannaRelicId, RelicPowerProfile> = {
    hanna_legend_relic: {
        xpBase: 25,
        xpPerDifficulty: 2,
    },
    hanna_combo_relic: {
        xpBase: 2,
        xpPerDifficulty: 1,
    },
    hanna_guardian_relic: {
        goldBase: 2,
        goldPerDifficulty: 1,
    },
    hanna_swiftness_relic: {
        xpBase: 1,
        goldBase: 1,
        xpPerDifficulty: 1,
        goldPerDifficulty: 1,
        bonusIfLegendaryChain: { xp: 1, gold: 1 },
    },
};

export function createLegendRelicState(): LegendRelicState {
    return {
        usesConsumed: 0,
        damageBoostUntilMs: 0,
    };
}

export function isLegendRelicDamageBoostActive(state: LegendRelicState, nowMs: number): boolean {
    return (state?.damageBoostUntilMs || 0) > nowMs;
}

export function applyLegendRelicDamageMultiplier(baseDamage: number, state: LegendRelicState, nowMs: number): number {
    if (isLegendRelicDamageBoostActive(state, nowMs)) {
        return baseDamage * LEGEND_RELIC_DAMAGE_MULTIPLIER;
    }
    return baseDamage;
}

export function activateLegendRelic(params: {
    state: LegendRelicState;
    nowMs: number;
    baseDamage: number;
}): LegendRelicUseResult {
    const state = params.state || createLegendRelicState();
    const nowMs = Math.max(0, Math.round(params.nowMs || 0));
    const baseDamage = Math.max(0, Number(params.baseDamage || 0));

    if (state.usesConsumed >= LEGEND_RELIC_MAX_USES) {
        return {
            activated: false,
            healToMax: false,
            xpBonus: 0,
            boostedDamage: applyLegendRelicDamageMultiplier(baseDamage, state, nowMs),
            nextState: { ...state },
            reason: "no_uses_left",
        };
    }

    const nextState: LegendRelicState = {
        usesConsumed: state.usesConsumed + 1,
        damageBoostUntilMs: nowMs + LEGEND_RELIC_DAMAGE_BOOST_MS,
    };

    return {
        activated: true,
        healToMax: true,
        xpBonus: LEGEND_RELIC_XP_ON_USE,
        boostedDamage: baseDamage * LEGEND_RELIC_DAMAGE_MULTIPLIER,
        nextState,
    };
}

type RelicAwardPlan = {
    primaryRelicId?: HannaRelicId;
    additionalRelicIds: HannaRelicId[];
};

const TIER3_POOL: HannaRelicId[] = [
    "hanna_guardian_relic",
    "hanna_combo_relic",
    "hanna_swiftness_relic",
];

function _pickOneOfThree(rng: () => number): HannaRelicId {
    const roll = Math.max(0, Math.min(0.999999, rng()));
    const idx = Math.floor(roll * 3);
    return TIER3_POOL[idx] || "hanna_guardian_relic";
}

function planRelicAward(combos: Combo[], rng: () => number): RelicAwardPlan {
    if (!combos.length) {
        return { primaryRelicId: undefined, additionalRelicIds: [] };
    }

    const hasTier4 = combos.some((combo) => combo.tier >= 4);
    if (hasTier4) {
        const addExtraRelic = rng() < 0.5; // 1/2 probability
        return {
            primaryRelicId: "hanna_legend_relic",
            additionalRelicIds: addExtraRelic ? [_pickOneOfThree(rng)] : [],
        };
    }

    const hasTier3 = combos.some((combo) => combo.tier === 3);
    if (hasTier3) {
        return {
            primaryRelicId: _pickOneOfThree(rng), // 1/3 each
            additionalRelicIds: [],
        };
    }

    return { primaryRelicId: undefined, additionalRelicIds: [] };
}

export function chooseRelicForCombos(combos: Combo[]): HannaRelicId | undefined {
    return planRelicAward(combos, Math.random).primaryRelicId;
}

export function listAwardedRelicsForCombos(combos: Combo[]): HannaRelicId[] {
    const plan = planRelicAward(combos, Math.random);
    if (!plan.primaryRelicId) return [];
    return [plan.primaryRelicId, ...plan.additionalRelicIds];
}

export function applyRelicRewardEffect(
    reward: Reward,
    relicId?: string,
    context?: { difficulty?: number; peakTier?: number },
): Reward {
    const out: Reward = { ...reward };
    const difficultyRaw = context?.difficulty ?? 1;
    const difficulty = Math.max(1, Math.min(5, Math.round(difficultyRaw)));
    const peakTier = Math.max(0, Math.round(context?.peakTier ?? 0));

    const profile = relicId ? RELIC_POWER_BY_ID[relicId as HannaRelicId] : undefined;
    if (!profile) return out;

    const xpBonus = (profile.xpBase || 0) + ((profile.xpPerDifficulty || 0) * (difficulty - 1));
    const goldBonus = (profile.goldBase || 0) + ((profile.goldPerDifficulty || 0) * (difficulty - 1));

    if (xpBonus) out.xp = (out.xp || 0) + xpBonus;
    if (goldBonus) out.gold = (out.gold || 0) + goldBonus;

    if (peakTier >= 4 && profile.bonusIfLegendaryChain) {
        if (profile.bonusIfLegendaryChain.xp) out.xp = (out.xp || 0) + profile.bonusIfLegendaryChain.xp;
        if (profile.bonusIfLegendaryChain.gold) out.gold = (out.gold || 0) + profile.bonusIfLegendaryChain.gold;
    }

    return out;
}
