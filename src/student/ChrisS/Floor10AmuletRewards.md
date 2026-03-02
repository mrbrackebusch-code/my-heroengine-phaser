# Floor 10 Amulet Rewards — Teacher Action Required

## Current Status
Amulets are registered as relics and will appear randomly in treasure chests throughout the game. To **guarantee** all 5 amulets are available as rewards specifically on **floor 10**, the teacher needs to add a hook.

## What Needs to Happen

In `src/HeroEngineInPhaser.ts`, find the `_dunEnterFloor_setupTreasureFloor` function (~line 20417).

Replace it with this modified version to offer amulets on floor 10:

```typescript
function _dunEnterFloor_setupTreasureFloor(nowMs: number): void {
    DUNGEON_BLOCK_INTENTS = true

    // Floor 10: Special amulet reward
    if ((_dunFloorIndex | 0) === 10) {
        const rows = _dunWorldRows() | 0
        const cols = _dunWorldCols() | 0
        if (rows > 0 && cols > 0) {
            const padR = _dunPadTileR | 0
            const padC = _dunPadTileC | 0
            const chestX = _dunColToX((padC - 2) | 0)
            const chestY = _dunRowToY((padR + 3) | 0)
            const chest = _dunSpawnChest(nowMs, chestX, chestY, "chest_gold")
            if (chest && !(chest.flags & sprites.Flag.Destroyed)) {
                sprites.setDataString(chest, INTERACT_DATA.CHEST_ROLE, "floor_10_amulet")
                // Offer all 5 amulets as choices
                _dunConfigureChestRelicOffer(chest, {
                    poolIds: [
                        "amulet_water",
                        "amulet_wind",
                        "amulet_fire",
                        "amulet_poison",
                        "amulet_earth"
                    ],
                    title: "The Five Amulets",
                    flavorText: "Choose one amulet to claim.",
                    theme: "treasure",
                    count: 1,
                })
                _dunChestSetStyle(chest, "chest_gold")
            }
        }
    } else {
        _dunEnterFloor_spawnRelicEventChests(nowMs)
    }
}
```

## Alternative: Simple Global Addition

If you just want amulets to appear randomly in ALL treasure chests (not just floor 10), they're already registered and will show up naturally in relic pools.

To make them more common on floor 10 specifically, ask the maintainer to add them to a `_relicFloor10Pool()` function or similar.

## Result

After integration, players will encounter a special gold chest on floor 10 containing all 5 amulets to choose from.
