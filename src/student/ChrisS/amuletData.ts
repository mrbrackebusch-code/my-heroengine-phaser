import type { StudentRelicDefinition } from "../../studentSystemsHooks";

export type AmuletDefinition = {
    id: string;
    effectKey: string;
    name: string;
    effectText: string;
    flavorText: string;
    color: string;
    stats: string[];
    iconX: number;
    iconY: number;
};

export const AMULETS: readonly AmuletDefinition[] = [
    {
        id: "amulet_water",
        effectKey: "amulet_tides_effect",
        name: "Amulet of Tides",
        effectText: "Grants water affinity; slows burning.",
        flavorText: "A star-shaped amulet with a blue sheen. Harnesses the power of the tides.",
        color: "blue",
        stats: [
            "Movement Speed: +15%",
            "Every 5 Strength moves: Knockback wave",
            "Intelligence: Bubble trap (2.5s stun)",
        ],
        iconX: 23,
        iconY: 69,
    },
    {
        id: "amulet_wind",
        effectKey: "amulet_zephyrs_effect",
        name: "Amulet of Zephyrs",
        effectText: "Increases dodge chance; boosts speed.",
        flavorText: "A star-shaped amulet with a white shimmer. Calls upon the swiftness of the gale.",
        color: "white",
        stats: [
            "Movement Speed: +15%",
            "Strength Moves: +5% speed boost",
            "Intelligence: Tornado pull (pulls enemies)",
        ],
        iconX: 28,
        iconY: 62,
    },
    {
        id: "amulet_fire",
        effectKey: "amulet_embers_effect",
        name: "Amulet of Embers",
        effectText: "Adds fire damage to attacks; ignites small foes.",
        flavorText: "A star-shaped amulet with a warm red glow. Contains the fury of an ever-burning ember.",
        color: "red",
        stats: [
            "Movement Speed: +10%",
            "Strength: Burn on hit (2% enemy health/0.5s for 2s)",
            "Strength Combo: Every 3 Strength hits, apply 1s stun",
            "Intelligence: Explosion on hit (small AoE knockback)",
        ],
        iconX: 39,
        iconY: 68,
    },
    {
        id: "amulet_poison",
        effectKey: "amulet_venom_effect",
        name: "Amulet of Venom",
        effectText: "Attacks apply minor poison over time.",
        flavorText: "A star-shaped amulet with a purple tint. Infused with a slow-acting, potent toxin.",
        color: "purple",
        stats: [
            "Movement Speed: +12%",
            "Strength: Poison on hit (2% health/0.5s for 1.5s)",
            "Strength Debuff: -5% defense & attack per stack (max -20%)",
            "Intelligence: Poison area around hero (5s cooldown)",
        ],
        iconX: 34,
        iconY: 65,
    },
    {
        id: "amulet_earth",
        effectKey: "amulet_stones_effect",
        name: "Amulet of Stones",
        effectText: "Increases defense and resistance to knockback.",
        flavorText: "A star-shaped amulet with an earthy brown luster. Anchored with the strength of the earth.",
        color: "brown",
        stats: [
            "Movement Speed: -10%",
            "Defense: +20%",
            "Strength: 360° knockback (4s cooldown)",
            "Intelligence: Rock drop (2s stun)",
        ],
        iconX: 28,
        iconY: 29,
    },
] as const;

export function getAmuletDefinition(amuletId: string): AmuletDefinition | null {
    const id = String(amuletId || "").trim();
    if (!id) return null;
    for (const amulet of AMULETS) {
        if (amulet.id === id) return amulet;
    }
    return null;
}

export function buildAmuletRelicDefinition(amuletId: string): StudentRelicDefinition | null {
    const amulet = getAmuletDefinition(amuletId);
    if (!amulet) return null;

    return {
        id: amulet.id,
        name: amulet.name,
        effectText: amulet.effectText,
        flavorText: amulet.flavorText,
        rarity: "relic",
        iconPrimary: { sheet: "ProjectUtumno_full", x: amulet.iconX, y: amulet.iconY },
        uiHints: { kind: "amulet", glyphText: amulet.color },
        effectKey: amulet.effectKey,
    };
}

export function ensureAmuletInCoreCatalog(amuletId: string): boolean {
    const g = globalThis as any;
    const catalog = g && g.__heRelicCatalog;
    if (!catalog || typeof catalog !== "object") return false;

    const relicDef = buildAmuletRelicDefinition(amuletId);
    if (!relicDef) return false;

    catalog[relicDef.id] = relicDef;
    return true;
}