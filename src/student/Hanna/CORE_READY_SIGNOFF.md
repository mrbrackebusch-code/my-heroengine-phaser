# Hanna Card Minigame — Core Ready Signoff

Use this checklist during core integration and final approval.

## A) Student-Side Status (already implemented)

- [x] Card generation + rarity logic
- [x] Combo detection + reward aggregation
- [x] Relic IDs + asset mapping
- [x] Relic probability model (tier3 and tier4 rules)
- [x] Legend relic active-use model (heal max, +25 XP, 2x damage 30s, max 3 uses)
- [x] Played-card consumption and remaining-card persistence payload
- [x] End payload type and completion reporting fields

## B) Core Integration Tasks (maintainer/teacher AI)

- [ ] Wire boss-win trigger to `shouldAutoStartAfterBoss(...)` from `minigame.ts`.
- [ ] Enforce policy threshold: auto-start only when merged hand size is at least 3 cards.
- [ ] Provide player-visible `Skip for now` option when auto-start trigger fires.
- [ ] Implement `openOverlay("Hanna.CardMinigame", data)` and call `onOverlayShown(data)`.
- [ ] Implement `closeOverlay("Hanna.CardMinigame")` cleanup.
- [ ] Implement `grantPlayerReward({ xp?, gold?, itemId?, relicId? })`.
- [ ] Implement `persistStudentCards(studentId, remainingCardIds)`.
- [ ] Implement optional `onStudentMinigameComplete(result)` telemetry callback.
- [ ] Implement optional `applyRelicUseEffect(...)` combat hook for legend relic active effect.

## C) Runtime Contract Validation

- [ ] `data.cardCatalog` is accepted and merged with generated level cards.
- [ ] `data.levelSummary.monsters` generates expected cards.
- [ ] No-combo sessions return no reward payload fields (no fallback consolation XP).
- [ ] `SessionEndResult` is returned with:
  - [ ] `combos`
  - [ ] `reward`
  - [ ] `gameOver`
    - [ ] `gameOver.reason` is one of `time_expired | cards_exhausted | no_valid_combo | combo_success | legendary_chain`
  - [ ] `consumedCardIds`
  - [ ] `remainingCardIds`
  - [ ] `awardedRelicIds`

## D) Relic Rule Validation

- [ ] Tier 4 always grants `hanna_legend_relic`.
- [ ] Tier 4 extra roll grants one additional relic with 1/2 chance.
- [ ] Additional relic (if any) is one of guardian/combo/swiftness with 1/3 each.
- [ ] Tier 3 (no tier4) grants exactly one of guardian/combo/swiftness with 1/3 each.
- [ ] Tier 1-2 only grants no relic.

## E) Legend Active Effect Validation

- [ ] On use: HP resets to max.
- [ ] On use: +25 XP granted.
- [ ] On use: damage multiplier = 2.0.
- [ ] Damage boost duration = 30 seconds.
- [ ] Usage cap = 3 uses.

## F) End-to-End Final Test

- [ ] Boss win with >=3 merged cards auto-opens minigame prompt/overlay.
- [ ] Boss win with <3 merged cards does not auto-open minigame.
- [ ] Auto-start path still allows `Skip for now` and returns to normal flow.
- [ ] Open minigame from real game flow.
- [ ] Play cards and end session.
- [ ] Rewards and relics granted correctly.
- [ ] Remaining cards persisted and loaded next session.
- [ ] Overlay closes cleanly with no input lock.

## Result

- [ ] APPROVED FOR CORE INTEGRATION
