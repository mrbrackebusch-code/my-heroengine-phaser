# Card Asset Templates

This folder contains the card template PNG files used by the card renderer.

## File Structure

```
assets/cards/
  Card_Common_256x360.png      — Common rarity template (stat 1–3)
  Card_Uncommon_256x360.png    — Uncommon rarity template (stat 4–7)
  Card_Rare_256x360.png        — Rare rarity template (stat 8–15)
  Card_Legendary_256x360.png   — Legendary rarity template (stat 16–40)
```

## Naming Convention

All card asset filenames MUST follow the repo's `WxH` standard:

```
Card_<Rarity>_<Width>x<Height>.png
```

**Example:**
- `Card_Common_256x360.png` (256 pixels wide, 360 pixels tall)

## Template Specifications

Each template is a **256×360px PNG** image with:

- **Background**: Base rarity-themed template (designed in Canva)
- **Text placeholders**: The renderer overlays dynamic labels on top
  - Stat (numeric, 1–40) — rendered dynamically in center
  - Rarity (COMMON / UNCOMMON / RARE / LEGENDARY) — rendered at top-right
  - Variant (conditionally shown: SPLIT_MEDIUM or BOSS_GIANT) — rendered below rarity
  - GMGBH — rendered at bottom-left

The PNG serves as the **background template only**. All text labels are rendered dynamically by `cardRenderer.ts` and overlaid on top.

## Integration

The card renderer (`cardRenderer.ts`) loads these templates and renders them with dynamic labels based on the `Card` object passed to `renderCard()`.

No manual label editing needed — the renderer handles all label text generation and updates during gameplay.

## Export from Canva

When exporting from Canva:

1. Ensure each template is **exactly 256×360px**
2. Export as PNG (transparent background recommended, but not required)
3. Name with the rarity tier: `Card_Common_256x360.png`, etc.
4. Place in this folder: `src/student/Hanna/assets/cards/`

**Do NOT include template text labels in the PNG** — the renderer adds these dynamically.
