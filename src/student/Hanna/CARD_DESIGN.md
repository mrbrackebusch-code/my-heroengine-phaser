# Card Design — Hanna Card Combo Minigame

Purpose
- Define the card data model, stat semantics, rarity mapping, and deterministic factory used to create cards after a level.

Key constraints
- All code and assets remain inside `src/student/Hanna/`.
- Card stats are computed from the monster `danger` and variant multiplier using the formula defined in `NOTES.md`.
- Card stats are clamped to [1, 40].
- Baby / baby_ranged / split_small variants never produce cards.
- One card is awarded per distinct effective danger present in a won level.

Data model (summary)
- `Card` (runtime representation)
  - `id`: string — unique id (e.g., `card:d4:m` meaning danger 4, normal)
  - `name`: string — human-readable name (e.g., "Beetle's Fang") — placeholder until designer fills
  - `baseDanger`: number — base danger `D` from `MONSTER_CATALOG`
  - `variant`: string | null — e.g., `normal`, `split_medium`, `boss_giant`
  - `multiplier`: number — variant multiplier `M` (1, 2, 4, or 0.5)
  - `stat`: number — computed stat `(1 + (D - 2)) * M`, clamped to 1..40
  - `rarity`: "common" | "uncommon" | "rare" | "legendary" — derived from `stat`
  - `data`: any — optional extension field for effects

Rarity mapping (suggested)
- stat 1–3: `common`
- stat 4–7: `uncommon`
- stat 8–15: `rare`
- stat 16+: `legendary`

Factory behavior
- Pure deterministic function `createCard(D: number, variant: string | null)` returns the `Card` object.
- Helper `cardsFromLevel(monsters: Array<{ baseId?:string, baseDanger:number, variant?:string }>)`:
  1. Map each monster to effective danger `E = Math.round(baseDanger * M)`; skip if `E < 2` or variant is baby-type.
  2. Collect distinct effective dangers; for each distinct danger, create one `Card` using the card factory. Use `baseDanger` of the representative monsters for stat formula as described in NOTES.

Extensibility
- Designers can add `name`, `iconKey`, and `data` fields later for each card.
- If persistent card catalogs are desired (survive death), a core hook will be requested and documented in `HannaNeeds.md`.

Implementation guidance
- Keep all card-generation logic pure and testable (no DOM or core side effects).
- Place the card factory in `cardFactory.ts` and export functions used by `minigame.ts`.
