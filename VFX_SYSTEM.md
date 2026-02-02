# VFX System Guide

This document is the single source of truth for how VFX work in this repo,
how to request new effects, and how to implement them without scattering logic.

## 1) Core Effect Pipeline (what already exists)

Effects are powered by an atlas + animation glue + sync layer:

- Assets live under `assets/effects/**` and are auto-discovered.
- `src/effectAtlas.ts` builds the atlas and resolves effect sheets.
- `src/effectAnimGlue.ts` picks frames/animations based on effect data.
- `src/arcadeCompat.ts` syncs effect data into Phaser sprites each tick.
- `applyEffectToSprite(...)` (in `src/HeroEngineInPhaser.ts`) is the
  game-level helper that sets effect data keys.

This pipeline is solid. What we are missing is a centralized **VFX authoring
layer** (presets/registry) so feature VFX are not hardcoded in gameplay files.

## 2) Asset Rules (non-negotiable)

- PNG filenames **must** include `WxH` (e.g., `Smoke 128x128.png`).
- No runtime trimming or auto-fix of sheet sizes.
- Sheets must be exact multiples of their frame size.
- Aura variants use suffix `_aura_rN` (e.g., `smoke 128x128_aura_r2.png`).
- Do not modify `assets/` or `src/generated/` unless explicitly requested.

When new assets are added, run:
`node scripts/genEffectAtlasMeta.mjs`
This regenerates `src/generated/effectAtlasMeta.ts`.

## 3) Effect IDs and Naming

Effect IDs are the **filename base** (minus `.png`), including spaces.
Example: `smoke 128x128` (from `smoke 128x128.png`).

These IDs are used as `effectSkin` values in code.

## 4) Effect Capabilities (what the system can do)

`applyEffectToSprite(...)` supports:
- alpha, tint, blend
- repeat, fps, yoyo
- scale or fitRadiusPx (auto scale)
- offsetX, offsetY
- frameIndex or frameList
- intro/pop timing
- forceTop depth
- masks (hero/sprite/circle)

This gives enough control for most VFX without custom shaders.

## 5) Layered VFX (recommended for reuse)

To maximize reuse (e.g., dust, poison cloud, sky cloud) use **layered presets**:

- Base layer: the geometric "shape" (e.g., smoke sheet).
- Overlay layer: elemental texture (from `assets/effects/heroEffects`).
- Optional aura layer: `_aura_rN` variants for soft fog edges.

Use blend modes (`add`, `screen`, `multiply`) and low alpha on overlays to keep
the base readable. Favor `fitRadiusPx`, `frameWindowMs`, and `yoyo` to vary feel
without new art.

Important: for elemental theming, prefer **overlay textures** over plain tint.
Never use `heroEffects` assets on enemy VFX.

### Proven masking pattern (important)
When masking an animated fill, keep **both mask + fill inside the effect system**:
- Mask sprite uses `frameIndex: 0` (static).
- Fill sprite uses `mode: "projectile"` with `maskSprite: maskFx` and animates via `effectAnimGlue`.

Avoid applying a BitmapMask from a live **effect sprite** onto a native Phaser
`Sprite` or `TileSprite` — that path can stop target animation.

## 5a) Element Palettes (tints only)

Element palettes live in `src/vfxPalettes.ts`:

- `HERO_EFFECT_PALETTES`: sampled from heroEffects to reflect existing hero VFX.
- `ENEMY_EFFECT_PALETTES`: darker/more muted versions for enemy VFX.
- `VFX_ELEMENT_ALIASES`: maps `electric` -> `lightning`, `grass` -> `poison`, `wind` -> `air`.

Use enemy palettes for **all** enemy VFX tinting. Do not reuse hero palettes for enemies.

### Textured fill (mask + tiling)
For animated seamless textures (e.g., `assets/effects/textures`), use a layered
approach:

- Spawn the base mask (smoke) as a normal effect.
- Stamp multiple texture tiles across the target area.
- Apply the smoke sprite as a bitmap mask to each tile.
- Optionally add a second overlay layer (heroEffects) with lower alpha.

## 6) REQUIRED Workflow for New Effects

Whenever an effect is requested:

1) Log the request in `VFX_REQUESTS.md` with **assets needed**.
2) Ask the user to choose assets (existing sheets or new art).
3) Implement via a VFX preset (not direct gameplay code).
4) Update this document if a new preset is added.

NOTE: The assistant must never author or edit pixel assets. Asset selection
must come from the user.

## 7) Current Hardcoded VFX (to migrate later)

Example: Teleport pad sink smoke is currently spawned directly in
`_dunSpawnPadSinkDust(...)` in `src/HeroEngineInPhaser.ts`.

This uses the effect system, but the spawn logic is feature-local. The correct
future home is a VFX preset.

## 8) VFX Registry (implemented)

Registry + helper utilities live in:
`src/vfxRegistry.ts`

Use it to register named presets and spawn effects through helpers rather than
hardcoding effect spawns in gameplay code.

## 9) Debug VFX Gallery

Enable `DEBUG_VFX_GALLERY` (and related flags) to show a grid of effect sheets
in a fixed overlay. This is intended for quick inspection of existing assets.

## 10) Screen Visual Debug Pipeline (snapshot + expected)

Use this to answer: "what pixels are actually on-screen here?" and
"what *should* have been there based on sprite positions, masks, and depth?"

### How it works
- A **snapshot pump** queues many pixel sample requests but executes **one** `snapshotArea` per frame.
- Each request can include **sample points** and optional **expected** analysis.
- Expected analysis uses current sprite/mask positions + alpha testing to infer
  which sprites *should* cover a pixel, then ranks them by depth.

### Quick usage (effects hall)
- Ensure `DEBUG_EFFECTS_HALL_TRACE` and `DEBUG_DEBUG_DUMP` are true.
- Start the hall, press any key to begin trace.
- Logs show `[VFX][HALL][TRACE] started` and `[VFX][HALL][TRACE] completed samples=N`.
- The trace dump includes:
  - `effectsHallTraceLive` (per-sample logs)
  - `screenSample` entries (observed RGBA + expected contributors)
  - `screenSnapResults` (last few raw snapshot batches)

### Manual sampling (global)
Call in console:

```js
__heQueueScreenSamples({
  label: "custom-probe",
  includeExpected: true,
  expectedAlphaMin: 0.05,
  samples: [
    { label: "center", worldX: 320, worldY: 180 },
    { label: "offset", worldX: 360, worldY: 200 }
  ]
});
```

Notes:
- `samples` can use `worldX/worldY` or `screenX/screenY`.
- `includeExpected: true` attaches a ranked list of expected contributors
  (depth, alpha, mask alpha, effective alpha).

### Interpreting results
- **Observed RGBA** comes from the snapshot (ground truth).
- **Expected candidates** are the "what should be here" list derived from:
  - sprite positions
  - alpha tested against sprite/mask pixels
  - depth ordering
- If observed alpha is low but expected shows a strong topmost candidate,
  the mask or fill is likely incorrect.

This pipeline is the intended long-term "pixel truth" debugger. Extend it as
new systems (tilemaps, particles, post-FX) need to be covered.

## 11) Future Direction (planned)

- Expand preset library as assets are approved.
- Provide optional tooling helpers for authoring/paging in the gallery.
