# Hanna Needs — Runtime Hooks Requested

This file documents runtime hooks we expect the main game to provide. DO NOT implement core changes here; instead the maintainer will review and add these hooks.

Requested hooks (runtime):

1) `openOverlay(id: string, data?: any): void`
   - Purpose: Open a registered student overlay (registered via `registerStudentOverlay`) and pass `data` to it. Core should mount overlay DOM and, when ready, call `onOverlayShown(data)` exported by the student module.

2) `closeOverlay(id: string): void`
   - Purpose: Close a mounted overlay and clean up any DOM.

3) `grantPlayerReward(reward: { xp?: number; gold?: number; itemId?: string; relicId?: string }): Promise<boolean>`
   - Purpose: Apply computed rewards from a student minigame session to the player's account/inventory and return success/failure.

4) (Optional) `persistStudentCards(studentId: string, cardIds: string[]): void`
   - Purpose: Allow students to persist unlocked cards to a central store. If unavailable, the student folder may manage unlocked cards locally.

How student code uses these hooks:
- `minigame.ts` calls `requestHook(...)` to add these requests to the student hook queue.
- At runtime, core should implement these functions and call into the student overlay entrypoint `onOverlayShown(data)` once the overlay DOM is mounted.

Requested-by: Hanna
