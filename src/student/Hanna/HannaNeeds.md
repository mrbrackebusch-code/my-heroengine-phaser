# Hanna Needs — Core Hook Contract (Implementation-Ready)

This is the handoff spec for core integration of Hanna's card minigame.
Student-side code is implemented in `src/student/Hanna/minigame.ts`.

## 1) Required Runtime Hooks

### A) `openOverlay(id: string, data?: any): void`
- Must support `id = "Hanna.CardMinigame"`.
- Core action:
  1. Mount overlay container.
  2. Initialize student module.
  3. Call `onOverlayShown(data)` from `src/student/Hanna/minigame.ts`.

### B) `closeOverlay(id: string): void`
- Must close overlay and cleanup DOM/input state.

### C) `grantPlayerReward(reward: { xp?: number; gold?: number; itemId?: string; relicId?: string }): Promise<boolean>`
- Applies reward to player profile/inventory.
- Called at minigame completion.

## 2) Strongly Recommended Hooks

### D) `persistStudentCards(studentId: string, cardIds: string[]): Promise<boolean> | void`
- Persists only remaining (unplayed) card IDs after minigame ends.
- Student code now consumes played cards automatically and sends remaining list.

### E) `onStudentMinigameComplete(result: SessionEndResult): Promise<void> | void`
- Receives full completion payload for telemetry/UI/post-processing.

Expected `SessionEndResult` shape:

```ts
type SessionEndResult = {
  combos: Array<{ id: string; name: string; tier: number; cards: string[]; reward: any }>;
  reward: { xp?: number; gold?: number; itemId?: string; relicId?: string; notes?: string };
  gameOver: { outcome: "win" | "lose"; reason: "time_expired" | "cards_exhausted" | "no_valid_combo" | "combo_success" | "legendary_chain"; score: number };
  consumedCardIds: string[];
  remainingCardIds: string[];
  awardedRelicIds: string[];
};
```

### F) `applyRelicUseEffect(playerId: string, effect: { relicId: string; healToMax?: boolean; damageMultiplier?: number; durationMs?: number; maxUses?: number; xpBonus?: number }): Promise<boolean>`
- Needed for active legend relic runtime behavior:
  - heal to max HP
  - 2x damage for 30 seconds
  - max 3 uses
  - +25 XP on use
- Apply this when player actively uses legend relic in combat/runtime (not automatically on drop).

Legend relic constants (current student-side model):
- `relicId`: `hanna_legend_relic`
- `healToMax`: `true`
- `damageMultiplier`: `2`
- `durationMs`: `30000`
- `maxUses`: `3`
- `xpBonus`: `25`

### G) `shouldAutoStartAfterBoss(input: { isBossLevel?: boolean; cardCatalog?: Card[]; levelSummary?: { monsters?: Array<{ baseDanger: number; variant?: string | null }> } }): boolean`
- Student helper exported from `minigame.ts` for boss auto-start decision.
- Current policy: auto-start only when:
  - `isBossLevel === true`
  - merged hand size (`cardCatalog + generated level cards, unique by id`) is at least `3` cards.
- If policy returns `false`, core should continue normal flow without opening overlay.
- If policy returns `true`, core should auto-open the minigame and still allow a player-facing `Skip for now` action.

## 3) Overlay Input Data Contract

`onOverlayShown(data)` expects:

```ts
type OverlayData = {
  studentId?: string;
  profile?: string;
  difficulty?: number;         // default 1
  rewardMultiplier?: number;   // default 1
  cardCatalog?: Card[];        // persisted inventory (optional)
  levelSummary?: {
    monsters: Array<{ baseDanger: number; variant?: string | null }>;
  };
};
```

Behavior:
- Session hand = unique merge of `cardCatalog` + generated cards from `levelSummary.monsters`.

## 3.5) Exact Symbol Map (No Guesswork)

Teacher AI should wire these exact names.

### Student exports to import from `src/student/Hanna/minigame.ts`
- `onOverlayShown(data)`
- `closeSession()`
- `shouldAutoStartAfterBoss(input)`

### Runtime globals used by student code at minigame completion
- `globalThis.grantPlayerReward`
- `globalThis.persistStudentCards` (optional)
- `globalThis.onStudentMinigameComplete` (optional)

If your core architecture avoids globals, provide adapters that expose these names during the overlay session.

## 4) Call Sequence Core Should Follow

1. After a boss-win, core evaluates `shouldAutoStartAfterBoss({ isBossLevel: true, cardCatalog, levelSummary })`.
2. If result is `true`, core calls `openOverlay("Hanna.CardMinigame", data)` (with a visible `Skip for now` option).
3. Core mounts overlay and invokes `onOverlayShown(data)`.
4. UI actions call `session.playCard(cardId)`.
5. On end (`finish()`):
  - if reward payload has at least one field (`xp | gold | itemId | relicId`), grant primary reward via `grantPlayerReward(...)`
   - grant additional relics (if any) via extra `grantPlayerReward({ relicId })` calls
   - persist remaining cards via `persistStudentCards(studentId, remainingCardIds)`
   - report full result via `onStudentMinigameComplete(result)`
6. Core calls `closeOverlay("Hanna.CardMinigame")`.

Reference implementation template (pseudo-TypeScript):

```ts
import { onOverlayShown, closeSession, shouldAutoStartAfterBoss } from "src/student/Hanna/minigame";

async function maybeStartHannaAfterBoss(ctx: {
  isBossLevel: boolean;
  studentId: string;
  profile?: string;
  difficulty?: number;
  rewardMultiplier?: number;
  cardCatalog?: Card[];
  levelSummary?: { monsters: Array<{ baseDanger: number; variant?: string | null }> };
}) {
  const shouldStart = shouldAutoStartAfterBoss({
    isBossLevel: ctx.isBossLevel,
    cardCatalog: ctx.cardCatalog,
    levelSummary: ctx.levelSummary,
  });

  if (!shouldStart) return;

  const didSkip = await showSkipForNowPrompt(); // core-owned UX
  if (didSkip) return;

  (globalThis as any).grantPlayerReward = grantPlayerReward;
  (globalThis as any).persistStudentCards = persistStudentCards;
  (globalThis as any).onStudentMinigameComplete = onStudentMinigameComplete;

  openOverlay("Hanna.CardMinigame", {
    studentId: ctx.studentId,
    profile: ctx.profile,
    difficulty: ctx.difficulty ?? 1,
    rewardMultiplier: ctx.rewardMultiplier ?? 1,
    cardCatalog: ctx.cardCatalog ?? [],
    levelSummary: ctx.levelSummary,
  });

  onOverlayShown({
    studentId: ctx.studentId,
    profile: ctx.profile,
    difficulty: ctx.difficulty ?? 1,
    rewardMultiplier: ctx.rewardMultiplier ?? 1,
    cardCatalog: ctx.cardCatalog ?? [],
    levelSummary: ctx.levelSummary,
  });
}

function teardownHannaOverlay() {
  closeSession();
  closeOverlay("Hanna.CardMinigame");
}
```

## 5) Relic Rules Core Should Respect

- Tier 4 (Legendary Chain): always award `hanna_legend_relic`.
- Tier 4 extra: 1/2 chance to award one extra relic from `{hanna_guardian_relic, hanna_combo_relic, hanna_swiftness_relic}` with 1/3 each.
- Tier 3 (no Tier 4): award exactly one of `{guardian, combo, swiftness}` with 1/3 each.
- Tier 1-2 only: no relic awarded.

## 6) Integration Acceptance Checks

- Overlay opens/closes correctly with `Hanna.CardMinigame`.
- Session receives expected input data.
- Rewards are granted with correct payload shape.
- Played cards are removed; remaining cards persisted.
- Full completion payload delivered to callback.
- Legend relic active effect hook functions in combat runtime.

## 7) AI Implementer Notes

- Student-side logic is complete in `src/student/Hanna/minigame.ts` and `src/student/Hanna/relicLogic.ts`.
- Core should avoid changing student combo/reward rules; integrate via hooks only.
- If a hook is temporarily unavailable, fail gracefully and continue session completion without crashing overlay flow.

Requested-by: Hanna
