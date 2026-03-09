# ChrisS Amulet System - Teacher Handoff

Status: Student-side implementation is complete. Two core-engine hooks are still required.

Verified on local main branch (Mar 9, 2026):
- `he:dungeonFloorComplete` is not dispatched from core.
- `addRelicToHero` is not defined/exposed in core.

## Already complete (student side)

- 5 amulets implemented: Tides, Zephyrs, Embers, Venom, Stones.
- Selection UI implemented, including real icon sprites from `ProjectUtumno_full`.
- Strength/Intelligence/Wisdom behaviors and VFX implemented.
- Wisdom shield invulnerability + cooldown implemented.

## Required core changes

### 1) Dispatch floor-complete event when objective chest flow completes

File: `src/HeroEngineInPhaser.ts`

Find this block (near the line with `chest opened by P${pid}; pad powered`):

```ts
if (!pending) {
    _dunObjectiveDone = true
    _dunSetPadPowered(true)
    _dunLog(`chest opened by P${pid}; pad powered`)
}
```

Add this immediately after the `_dunLog(...)` line:

```ts
try {
    globalThis.dispatchEvent(new CustomEvent("he:dungeonFloorComplete", {
        detail: { floorIndex: _dunFloorIndex }
    }))
} catch { }
```

Why: Student system listens for this event and opens the amulet reward UI only when `floorIndex === 1`.

### 2) Add and expose `addRelicToHero(heroIndex, amuletId)`

File: `src/HeroEngineInPhaser.ts`

Add this helper at module scope (near relic helper functions):

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

Why: Student selection UI confirms an amulet and calls `globalThis.addRelicToHero(heroIndex, amuletId)`.

## Acceptance checks (teacher)

After implementing the two changes above:

1. Search in `src/HeroEngineInPhaser.ts` for `he:dungeonFloorComplete` and `addRelicToHero`.
2. Run game and trigger this in browser console:

```js
globalThis.dispatchEvent(new CustomEvent("he:dungeonFloorComplete", { detail: { floorIndex: 1 } }))
```

Expected: Amulet selection UI appears.

3. Complete floor 1 chest objective normally.

Expected:
- Reward UI appears automatically.
- Confirming an amulet grants the relic.
- Amulet effects work on later floors.


