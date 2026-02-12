# Hanna Minigame — Notes & Brainstorm

Use this file to jot down ideas, design decisions, and progress notes.

## Ideas

## Design Decisions

## TODO / In Progress

## Questions

## Reference Notes

### Card Stats Scaling, Card Gain Rules, and Level Aggregation

**Initial card stats = 1**

Core rules:
- Minimum danger to *grant any card* for a level is **2**. Any monster whose effective danger (after variant multiplier) is < 2 does NOT create a card entry for the level.
- **baby / baby_ranged / split_small** variants (they use ×0.5 multiplier) never grant cards at all (explicit exception).

Stat formula (applies to all numeric card stats and is also used as a proxy for rarity):
- Start with base danger value `D` (the monster's `danger` from `MONSTER_CATALOG`).
- Apply variant multiplier `M` (1 for normal, 2 for `split_medium`, 4 for `boss_giant`, 0.5 for baby variants).
- Effective danger = `E = Math.round(D * M)` (round after multiplier).
- If `E < 2` then this monster does not contribute a card for the level.
- Otherwise the card stat value = `(1 + (D - 2)) * M` (i.e., compute `1 + (D - 2)` using the base danger, then multiply by `M`).

Notes on formula application and edge cases:
- The formula is defined for any integer danger (including 1 and 3) but cards are only awarded when the **effective danger `E` ≥ 2**.
- Example: danger 3 (normal): stats = 1 + (3 - 2) = 2 (and can produce a card because E=3≥2).
- Example: danger 1 (normal): stats = 1 + (1 - 2) = 0 → clamp to minimum 1 if you ever need a non-zero stat, but by rule monsters with danger <2 produce no card.
- Example with variants: a `split_medium` bee (D=4, M=2) → stats = (1 + (4 - 2)) × 2 = 6.

Per-level card awarding rules:
- Cards are awarded **only after a won level** (end of level).
- For each *distinct effective danger value present in the level* (after applying variant multipliers and excluding `E < 2` and baby variants), the player receives **one card** whose stats are computed by the formula above. The number of monsters of that danger does NOT increase card count.
- Example: Level with 12 monsters rated 2, 5 monsters rated 6, and 3 monsters rated 13 → player receives:
	- one card for danger 2 → stats = 1
	- one card for danger 6 → stats = 1 + (6 - 2) = 5
	- one card for danger 13 → stats = 1 + (13 - 2) = 12

Other notes:
- Cards cannot be boosted during the minigame session; they are static for that session and used only in post-level combo evaluation to grant rewards.
- Card `stat` value is used as a proxy for rarity: higher-stat cards are rarer and harder to obtain.
- This section defines base stat generation only; we will design per-card effects and reward mappings later.

Stat clamping:
- After computing the card stat value using `(1 + (D - 2)) * M`, clamp the result to a minimum of **1** and a maximum of **40**. This ensures cards always have at least baseline usefulness and prevents unbounded stat explosion from extreme variant multipliers.

Remark: With the current catalog values and multipliers, the `boss_giant` multiplier can produce very large values; the `40` cap keeps legendary cards bounded while still providing clear rarity separation.

### Monster Danger Ratings (from MONSTER_CATALOG)
- Slime variants: danger 2 (weakest)
- Bee: danger 4
- Bat: danger 5
- Beetle: danger 6
- Wolf: danger 7
- Spider variants: danger 8
- Googon: danger 9
- Minotaur: danger 12
- Imp variants: danger 13

Variants modify danger:
- baby / baby_ranged / split_small: × 0.5
- split_medium: × 2
- boss_giant: × 4

### Per-monster Card Awards (danger 1–13)

For each base danger `D` (1..13) below we list the resulting card stat for the common variant types. Rules recap:
- Normal: `M=1`, effective danger `E = D` — card awarded if `E >= 2`.
- `split_medium`: `M=2`, effective danger `E = round(2*D)` — card awarded if `E >= 2`.
- `boss_giant`: `M=4`, effective danger `E = round(4*D)` — card awarded if `E >= 2`.
- `baby` / `baby_ranged` / `split_small` (`M=0.5`) never grant cards (explicit exception).
- Card stat calculation: `stat = clamp( (1 + (D - 2)) * M, 1, 40 )`.

- D=1: Normal: no card (E=1). split_medium: stat=1 (E=2) — grants card. boss_giant: stat=4 (E=4).
- D=2: Normal: stat=1 (E=2). split_medium: stat=2 (E=4). boss_giant: stat=4 (E=8).
- D=3: Normal: stat=2. split_medium: stat=4. boss_giant: stat=8.
- D=4: Normal: stat=3. split_medium: stat=6. boss_giant: stat=12.
- D=5: Normal: stat=4. split_medium: stat=8. boss_giant: stat=16.
- D=6: Normal: stat=5. split_medium: stat=10. boss_giant: stat=20.
- D=7: Normal: stat=6. split_medium: stat=12. boss_giant: stat=24.
- D=8: Normal: stat=7. split_medium: stat=14. boss_giant: stat=28.
- D=9: Normal: stat=8. split_medium: stat=16. boss_giant: stat=32.
- D=10: Normal: stat=9. split_medium: stat=18. boss_giant: stat=36.
- D=11: Normal: stat=10. split_medium: stat=20. boss_giant: stat=40 (clamped).
- D=12: Normal: stat=11. split_medium: stat=22. boss_giant: stat=40 (clamped).
- D=13: Normal: stat=12. split_medium: stat=24. boss_giant: stat=40 (clamped).

Notes:
- These stat numbers are the base numeric attribute used across card fields and as a rarity proxy. The actual card effects and reward mappings are designed separately.
- At end of a won level, one card is awarded per *distinct effective danger* present among the level's monsters (see earlier examples). Baby variants are excluded and do not produce cards.

### Card Rarity Mapping (organized by stat ranges)

Rarity tiers based on card stat value:

| Rarity | Stat Range | Examples |
|--------|-----------|----------|
| **Common** | 1–3 | Slime (D=2, stat=1) |
| **Uncommon** | 4–7 | Bee (D=4, stat=3), Bat (D=5, stat=4), Beetle (D=6, stat=5), Wolf (D=7, stat=6) |
| **Rare** | 8–15 | Spider (D=8, stat=7), Googon (D=9, stat=8), Minotaur (D=12, stat=11), Imp (D=13, stat=12) |
| **Legendary** | 16+ | split_medium variants (D=8 split_medium→stat=14, D=13 split_medium→stat=24), boss_giant variants (D=8 boss_giant→stat=28, D=13 boss_giant→stat=40) |

Rarity implementation
- Rarity is computed deterministically from card stat in `cardFactory.ts`: `deriveRarity(stat)` function.
  - Common: `stat <= 3`
  - Uncommon: `4 <= stat <= 7`
  - Rare: `8 <= stat <= 15`
  - Legendary: `stat >= 16`

