import type { Card, CardRarity } from "./types";

const MIN_STAT = 1;
const MAX_STAT = 40;

function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, Math.round(v)));
}

function deriveRarity(stat: number): CardRarity {
    if (stat <= 3) return "common";
    if (stat <= 7) return "uncommon";
    if (stat <= 15) return "rare";
    return "legendary";
}

/** Compute the display rarity text for a card */
export function getRarityDisplay(rarity: CardRarity): string {
    const map: Record<CardRarity, string> = {
        common: "COMMON",
        uncommon: "UNCOMMON",
        rare: "RARE",
        legendary: "LEGENDARY",
    };
    return map[rarity] || "UNKNOWN";
}

/** Compute the display variant text; returns empty if normal */
export function getVariantDisplay(variant?: string | null): string {
    if (!variant) return "";
    const v = String(variant).toLowerCase();
    if (v === "normal") return "";
    if (v === "split_medium") return "SPLIT_MEDIUM";
    if (v === "boss_giant") return "BOSS_GIANT";
    return "";
}


export function createCardFromDanger(baseDanger: number, variant?: string | null): Card {
    const variantNorm = String(variant || "normal").toLowerCase();
    let multiplier = 1;
    if (variantNorm === "split_medium") multiplier = 2;
    else if (variantNorm === "boss_giant") multiplier = 4;
    else if (variantNorm === "baby" || variantNorm === "baby_ranged" || variantNorm === "split_small") multiplier = 0.5;

    // Per rules: baby variants never produce cards — caller should skip those.

    const raw = (1 + (baseDanger - 2)) * multiplier;
    const stat = clamp(raw, MIN_STAT, MAX_STAT);
    const rarity = deriveRarity(stat);

    const id = `card:d${baseDanger}:${variantNorm}:${stat}`;
    const name = `Card D${baseDanger} ${variantNorm}`;

    const card: Card = {
        id,
        name,
        type: "skill",
        baseDanger,
        variant: variantNorm,
        multiplier,
        stat,
        rarity,
    };

    return card;
}

export function cardsFromLevel(monsters: Array<{ baseDanger: number; variant?: string | null }>): Card[] {
    const seen = new Map<number, { baseDanger: number; variant?: string | null }>();

    for (const m of monsters || []) {
        const base = Math.max(0, Math.round(m.baseDanger || 0));
        const variant = m.variant ? String(m.variant).toLowerCase() : "normal";

        // Skip baby-like variants entirely (they produce no cards)
        if (variant === "baby" || variant === "baby_ranged" || variant === "split_small") continue;

        const multiplier = (variant === "split_medium") ? 2 : (variant === "boss_giant" ? 4 : 1);
        const effective = Math.round(base * multiplier);
        if (effective < 2) continue;

        if (!seen.has(effective)) {
            // store representative base danger and variant for that effective danger
            seen.set(effective, { baseDanger: base, variant });
        }
    }

    const out: Card[] = [];
    for (const [effective, rep] of seen.entries()) {
        if (!rep) continue;
        out.push(createCardFromDanger(rep.baseDanger, rep.variant));
    }

    // Sort by stat ascending for predictable order
    out.sort((a, b) => (a.stat - b.stat));
    return out;
}
