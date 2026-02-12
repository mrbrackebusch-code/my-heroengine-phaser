# Hanna — Card Combo Minigame

Owner: Hanna

Overview
- Short optional minigame (<= 90s) offered after boss fights or when player stats are low.
- Players collect cards awarded after a *won* level and later use those cards in the card-combo minigame to earn rewards.

Key rules (summary)
- Cards are awarded only at the end of a won level. For each distinct effective monster danger present in the level (after applying variant multipliers and excluding very small variants), the player receives exactly one card corresponding to that danger — monster count does not multiply cards.
- Minimum effective danger to grant a card is **2**. Monsters or variants with effective danger < 2 (including baby / baby_ranged / split_small variants) do not grant cards.
- Card stat formula (applies to all numeric card stats and is used as a rarity proxy): compute base `D` from `MONSTER_CATALOG`, multiplier `M` from variant, then card stat = clamp( (1 + (D - 2)) * M, 1, 40 ).
- Cards are immutable for a session (no in-session stat boosts) and used later for combo evaluation to determine rewards.
- The player's card catalog is reset when the player dies or when the game restarts; persistent storage is optional and requires a core hook (documented in `HannaNeeds.md`).

Integration notes
- This folder implements only student-side logic and assets. Runtime hooks (open/close overlay, grant reward, optional persistence) are requested via `HannaNeeds.md` and `requestHook(...)` from `minigame.ts`.
- The overlay id registered by this minigame is `Hanna.CardMinigame` (see `minigame.ts`). Core should call `onOverlayShown(data)` after mounting the overlay DOM.

Files in this folder
- `MINIGAME_DESIGN.md` — detailed design and level-aggregation rules.
- `NOTES.md` — working notes, formulas, and examples.
- `CARD_DESIGN.md` — card data model and rarity mapping.
- `CARD_DESIGN_FOR_CANVA.md` — visual design specification for Canva templates.
- `CARD_LABEL_REFERENCE.md` — exact label display values per rarity/variant.
- `types.ts` — shared TypeScript types for cards, combos, and rewards.
- `cardFactory.ts` — pure card generation and label computation.
- `cardRenderer.ts` — DOM card renderer with dynamic labels (used by overlay).
- `cards.css` — styling for rendered cards.
- `CARD_RENDERER_USAGE.md` — how to use the card renderer in your overlay.
- `minigame.ts` — core minigame logic, overlay registration, session APIs, and hook requests.
- `HannaNeeds.md` — requested core hooks and signatures.
- `assets/cards/` — card template PNG files (256×360px; one per rarity tier).

Next steps
- Implement the on-disk or core-persisted catalog hook if you want cards to survive death; otherwise the catalog will reset on player death as designed.
