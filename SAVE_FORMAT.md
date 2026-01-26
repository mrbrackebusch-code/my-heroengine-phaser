# Save Format (heroesSaveV1)

This document describes the current on-disk save payload produced by the host and persisted
by the multiplayer server. All fields are JSON-safe.

Top-level fields
- type: fixed string `heroesSaveV1`.
- savedAt: unix epoch milliseconds at save creation (Number).
- saveKind: `"auto"` or `"manual"` (optional; defaults to `"auto"` when missing).
- label: human label for manual saves (optional).
- profiles: array of profile names included in this save.
- floor: `{ index, kind, baseFamily, wallFamily }` (floor identity + theme hints).
- next: `{ index, kind }` (next floor target at time of save).
- floorState: `{ floorIndex, floorKind, safe, objectiveDone, padPowered, doorState, combatWavesComplete }` (optional).
- worldSnapshot: snapshot from `netWorld.capture()` (non-hero sprites, host auth).
- heroSprites: array of hero sprite snapshots (per profile).
- npcSprites: array of NPC sprite snapshots (optional).
- blocklyXmlByProfile: map of profile -> Blockly XML string.
- tilemap: cached tilemap message (optional).
- decor: cached decor payload `{ rev, decals, props }` (optional).

Notes
- Saves are host-only.
- Autosaves may be pruned on the server; manual saves should not be pruned.
- Load behavior:
  - Autosave (`saveKind="auto"`) loads into `next` and ignores floor-local artifacts (tilemap, decor, npcSprites, floorState).
  - Manual save (`saveKind="manual"`) loads into `floor` and applies floor-local artifacts (tilemap, decor, npcSprites, floorState).
- Snapshot payloads include only primitive `sprite.data` keys and serialized pixels.
