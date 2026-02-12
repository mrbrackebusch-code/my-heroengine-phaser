export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

export type CardType = "attack" | "defense" | "skill" | "utility";

export type Card = {
    id: string;
    name: string;
    type: CardType;
    baseDanger?: number; // the monster danger this card originated from
    variant?: string | null; // e.g., "normal", "split_medium", "boss_giant"
    multiplier?: number; // variant multiplier applied
    stat: number; // computed numeric stat (clamped 1..40) — used for power/rarity
    rarity: CardRarity;
    data?: any;
};

export type Combo = {
    id: string;
    name: string;
    tier: number; // 1 = small, 2 = medium, 3 = large, 4 = legendary
    cards: string[]; // card ids that composed combo
    reward: Reward;
};

export type Reward = {
    xp?: number;
    gold?: number;
    itemId?: string;
    relicId?: string;
    notes?: string;
};

export type SessionParams = {
    difficulty?: number; // 1..5
    rewardMultiplier?: number; // applied after evaluation
    maxDurationMs?: number;
};
