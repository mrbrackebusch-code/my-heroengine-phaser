import { ENEMY_EFFECT_PALETTES_BY_DARKEN_PCT } from "./vfxEnemyPalettes";

export type VfxElementKey =
    | "none"
    | "fire"
    | "water"
    | "lightning"
    | "earth"
    | "ice"
    | "air"
    | "poison";

export const VFX_ELEMENT_KEYS: VfxElementKey[] = [
    "none",
    "fire",
    "water",
    "lightning",
    "earth",
    "ice",
    "air",
    "poison"
];

export const VFX_ELEMENT_ALIASES: Record<string, VfxElementKey> = {
    electric: "lightning",
    wind: "air",
    grass: "poison"
};

export const HERO_EFFECT_PALETTES: Record<VfxElementKey, number[]> = {
    none: [0x535C4D, 0x758156, 0x878F60, 0xB5BF93, 0xC7CD9D, 0xF8F8D6],
    fire: [0xC00F06, 0xD21D10, 0xF66006, 0xFFA800, 0xFFE25B],
    water: [0x001A5F, 0x0F2E6D, 0x3761B7, 0x486EBC, 0x93AFE7],
    lightning: [0xCA8116, 0xDC8F20, 0xF1C339, 0xF1E6BB],
    earth: [0x663E2E, 0x996B4A, 0xAE764B, 0xC39753, 0xD9B75C, 0xDCC381],
    air: [0x535C4D, 0x758156, 0x878F60, 0xB5BF93, 0xC7CD9D, 0xF8F8D6],
    poison: [0x008514, 0x0BC200, 0x12931E, 0x1DD000, 0x7EE604, 0x90F40E],
    ice: [0x3B77BA, 0x679FB1, 0x84BAD0, 0x89D4E7, 0xA7DADB, 0xB6F9FF]
};

export const ENEMY_EFFECT_DARKEN_PCT_DEFAULT = 1;
export const ENEMY_EFFECT_PALETTES: Record<VfxElementKey, number[]> =
    ENEMY_EFFECT_PALETTES_BY_DARKEN_PCT[ENEMY_EFFECT_DARKEN_PCT_DEFAULT] ||
    ENEMY_EFFECT_PALETTES_BY_DARKEN_PCT[0] ||
    HERO_EFFECT_PALETTES;
