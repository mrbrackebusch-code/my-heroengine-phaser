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

Runtime flow (integration contract)
- On boss-win, core evaluates `shouldAutoStartAfterBoss({ isBossLevel, cardCatalog, levelSummary })` from `minigame.ts`.
- If true (boss level and merged hand size >= 3), core auto-opens overlay id `Hanna.CardMinigame` and then calls `onOverlayShown(data)`.
- Auto-start path should still offer player `Skip for now`.
- `onOverlayShown(data)` creates and starts a `CardMinigameSession`.
- `data.cardCatalog` (Card[]) may be provided to preload persisted player cards.
- `data.levelSummary.monsters` may be provided to generate new cards from current level results.
- Session hand is the unique merge of persisted cards + newly generated cards.
- Player actions call `session.playCard(cardId)`.
- Session ends when timer expires or when all cards are played.
- End payload shape is `SessionEndResult` (see `types.ts`):
	- `combos: Combo[]`
	- `reward: { xp?, gold?, itemId?, relicId? }`
	- `gameOver: { outcome: "win" | "lose", reason, score }`
- Reward grant uses a strict core-safe payload: `{ xp?, gold?, itemId?, relicId? }`.
- Optional reporting callback supported: `globalThis.onStudentMinigameComplete(result)`.

Controls (current expected)
- Open minigame overlay through core integration (`openOverlay("Hanna.CardMinigame", data)`).
- Select and play cards through overlay UI by sending chosen `cardId` into `playCard(cardId)`.
- Close overlay via core (`closeOverlay("Hanna.CardMinigame")`) or after end flow.

Combo and reward table
- Pair (tier 1): +1 XP (before multiplier)
- Sequence (tier 2): +5 Gold (before multiplier)
- Set (tier 3): +5 XP (before multiplier)
- Legendary Chain (tier 4): relic `hanna_legend_relic`

Reward visual assets
- Relic asset mapping is defined in `rewardAssets.ts`.
- Current mapping:
	- `hanna_legend_relic` -> `/src/student/Hanna/assets/relics/hanna_legend_relic_32x32.png`
	- `hanna_combo_relic` -> `/src/student/Hanna/assets/relics/hanna_combo_relic_32x32.png`
	- `hanna_guardian_relic` -> `/src/student/Hanna/assets/relics/hanna_guardian_relic_32x32.png`
	- `hanna_swiftness_relic` -> `/src/student/Hanna/assets/relics/hanna_swiftness_relic_32x32.png`
- Integration helper: `resolveRewardVisuals(reward)` exported from `minigame.ts`.

Relic gameplay functions (implemented)
- `hanna_legend_relic`: active-use model: full heal, `+25 XP` on use, `2x` damage for `30s`, max `3` uses.
- `hanna_combo_relic`: combo-focused power (`+2 XP`) plus difficulty scaling.
- `hanna_guardian_relic`: defensive power (`+2 Gold`) plus difficulty scaling.
- `hanna_swiftness_relic`: speed power (`+1 XP`, `+1 Gold`) plus difficulty scaling and extra bonus on Legendary Chain.

Relic selection priority
- Tier 4 (Legendary Chain): always `hanna_legend_relic`.
- Tier 4 extra roll: 1/2 chance to grant one additional relic.
- If extra roll succeeds: additional relic is one of {guardian, combo, swiftness} with 1/3 each.
- Tier 3 (Set, no tier 4): exactly one relic from {guardian, combo, swiftness} with 1/3 each.
- Tier 1-2 only runs: no relic.

Game-over rules
- Score is computed from combo tier/card contributions plus reward points.
- Auto-win if relic is awarded (`legendary_chain`).
- Lose if no valid combos are formed.
- Win if score is at least 5.
- Otherwise lose with `cards_exhausted` if all cards were played first, or `time_expired` if timer ended first.

Step-6 test checklist
- Start session through `onOverlayShown(data)` and verify timer starts.
- Confirm cards are generated from `data.levelSummary.monsters` when provided.
- Play cards and verify combo detection: Pair, Sequence, Set, Legendary Chain.
- Validate reward aggregation (XP/Gold sums and relic assignment).
- Validate game-over outcomes and reasons (`win/lose`, reason, score).
- Verify core reward hook receives only `{ xp?, gold?, itemId?, relicId? }`.
- Verify optional completion callback receives full `SessionEndResult`.

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
- Use `CORE_READY_SIGNOFF.md` as the final core integration and approval checklist.
