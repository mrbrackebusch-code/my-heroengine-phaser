# ChrisS Amulet System - Teacher Handoff

Status: Student-side implementation is complete.

Current design:
- Floor 1 now uses a separate student-side Amulet Chest.
- The normal starter relic chest should remain a normal relic chest.
- Amulets are no longer registered into the starter relic pool at scene startup.

## Already complete (student side)

- 5 amulets implemented: Tides, Zephyrs, Embers, Venom, Stones.
- Selection UI implemented, including real icon sprites from `ProjectUtumno_full`.
- Strength/Intelligence/Wisdom behaviors and VFX implemented.
- Wisdom shield invulnerability + cooldown implemented.

## Core dependency

### Keep `addRelicToHero(heroIndex, amuletId)` exposed

File: `src/HeroEngineInPhaser.ts`

This is still required by the student-side Amulet Chest flow.

Expected helper:

```ts
export function addRelicToHero(heroIndex: number, amuletId: string): void {
    const hi = heroIndex | 0
    const rid = String(amuletId || "").trim()
    if (!rid) return

    const pid = _relicResolvePidFromHeroIndex(hi) | 0
    if (pid <= 0) return

    _relicGrantToPid(pid, rid, "student-floor1-reward")
}

(globalThis as any).addRelicToHero = addRelicToHero
```

Why: Student Amulet Chest UI confirms an amulet and then calls `globalThis.addRelicToHero(heroIndex, amuletId)`.

## Acceptance checks (teacher)

1. Spawn into floor 1 entrance.
2. Verify two separate reward sources exist:
    - normal starter relic chest
    - separate Amulet Chest
3. Verify the normal starter relic chest does not include amulets.
4. Open the Amulet Chest.

Expected:
- It shows all 5 amulet options.
- Confirming an amulet grants the relic.
- Amulet effects work on later floors.

Notes:
- The old `he:dungeonFloorComplete` reward flow is no longer required for the amulet chest.
- If `addRelicToHero` remains exposed in core, no further teacher changes should be needed for the chest flow.


