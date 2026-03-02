# Card Design Specification for Canva — All Characteristics

Use this specification to design card visuals and templates in Canva. All cards follow these exact rules.

## Card Data Model

Each card has these properties:

### Core Identifiers
- **id**: Unique identifier (e.g., `card:d4:normal:3`)
- **name**: Human-readable name (placeholder: e.g., "Bee's Sting"; designer to fill with flavor text)
- **type**: Fixed to `"skill"` (all cards are skills for now)

### Numeric Properties
- **baseDanger**: The monster danger value (1–13) that spawned this card. Range: 1–13.
- **stat**: Computed numeric value clamped to **1–40**. Used for card power/rarity.
  - Formula: `stat = clamp( (1 + (baseDanger - 2)) * variant_multiplier, 1, 40 )`
  - stat is your **primary visual indicator** of power and rarity
- **multiplier**: Variant modifier (1.0 for normal, 2.0 for split_medium, 4.0 for boss_giant, 0.5 for baby — but baby variants never produce cards)
- **variant**: Origin variant (`"normal"`, `"split_medium"`, `"boss_giant"`; baby variants never appear in cards)

### Rarity (visual tier)
- **Rarity**: Enum computed deterministically from `stat`:
  - **Common**: stat 1–3
  - **Uncommon**: stat 4–7
  - **Rare**: stat 8–15
  - **Legendary**: stat 16–40

### Additional Field
- **data**: Optional extension field for future card effects (currently unused; reserved for later).

---

## Visual Design Guidelines

### Stat-to-Visual Mapping
Use `stat` value (1–40) as your primary design input:

- **Stat 1 (Common)**: Minimal adornment, neutral colors, basic border
- **Stat 2–3 (Common)**: Slightly enhanced detail
- **Stat 4–7 (Uncommon)**: Colored border, mild glow, thematic details
- **Stat 8–15 (Rare)**: Ornate border, brighter glow, more complex central imagery
- **Stat 16–40 (Legendary)**: Elaborate frame, intense glow/effects, premium appearance

Design one template per stat range and scale details accordingly.

### Monster Origin (Context)
Cards originate from specific monsters by `baseDanger`:

| Danger | Monster Example | Stat (Normal) | Stat (split_medium) | Stat (boss_giant) |
|--------|-----------------|---------------|---------------------|-------------------|
| 1 | (none common) | no card | stat=1 (E=2) | stat=4 (E=4) |
| 2 | Slime | stat=1 | stat=2 | stat=4 |
| 3 | (none current) | stat=2 | stat=4 | stat=8 |
| 4 | Bee | stat=3 | stat=6 | stat=12 |
| 5 | Bat | stat=4 | stat=8 | stat=16 |
| 6 | Beetle | stat=5 | stat=10 | stat=20 |
| 7 | Wolf | stat=6 | stat=12 | stat=24 |
| 8 | Spider | stat=7 | stat=14 | stat=28 |
| 9 | Googon | stat=8 | stat=16 | stat=32 |
| 10 | (none current) | stat=9 | stat=18 | stat=36 |
| 11 | (none current) | stat=10 | stat=20 | stat=40 (clamped) |
| 12 | Minotaur | stat=11 | stat=22 | stat=40 (clamped) |
| 13 | Imp | stat=12 | stat=24 | stat=40 (clamped) |

You may optionally include thematic elements from the origin monster on the card (e.g., spider imagery for danger 8, bee imagery for danger 4) but this is decorative.

### Required Text Fields on Card

- **GMGBH** (General Mini Game By Hanna): Placeholder for unique skill name per card (e.g., "Bee's Sting", "Spider's Trap", "Slime Surge")
- **Stat**: Numeric value 1–40 (must be clearly visible; replace "Stats" label with the actual number)
- **Rarity**: Display one of: COMMON / UNCOMMON / RARE / LEGENDARY (derived from stat; see CARD_LABEL_REFERENCE.md)
- **Variant** (conditional): Show only if NOT "normal"; display "SPLIT_MEDIUM" or "BOSS_GIANT"; hide if normal variant

Implementation note: Helper functions in `cardFactory.ts` compute these labels:
- `getRarityDisplay(rarity: CardRarity)` → "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY"
- `getVariantDisplay(variant?: string)` → "" (empty if normal) | "SPLIT_MEDIUM" | "BOSS_GIANT"

### Size & Format (placeholder suggestion)
- Standard card dimensions: suggest web card (e.g., 300×400px or similar for game UI)
- Ensure text is readable at typical game UI scales
- Follow the game's existing art style and color palette if available

---

## Card Generation Logic (Reference)

Cards are generated from defeated monsters at end-of-level:
- One card per *distinct effective danger* in that level (not per monster count)
- Baby-variant monsters never produce cards
- Multiple of the same danger level count as one card
- Example: level with 12 Slimes (D=2), 5 Beetles (D=6), 3 Imps (D=13) → 3 cards (stats 1, 5, 12)
- Cards are awarded immediately after level win and added to player's deck
- Cards are used later in the combo minigame to form combos and earn rewards

---

## Design Checklist for Canva Templates

- [ ] One master design per rarity tier (Common, Uncommon, Rare, Legendary)
- [ ] Clear stat number display (1-40)
- [ ] Rarity color/text indicator
- [ ] Name field (text placeholder)
- [ ] Optional variant indicator (Normal / split_medium / boss_giant)
- [ ] Border/frame matches game aesthetic
- [ ] All text legible at UI scale
- [ ] Optional monster-origin thematic elements

---

## Summary of Constraints

- **Stat range**: 1–40 (always clamped). This is your primary visual lever.
- **Rarity**: Always computed from stat (no manual override).
- **Variant**: One of: `normal` (M=1), `split_medium` (M=2), `boss_giant` (M=4). Baby variants never appear.
- **Base danger**: 1–13, used to compute stat via formula `stat = (1 + (D - 2)) * M` clamped [1, 40].
- **Card type**: Always `"skill"`.
- **Name**: Designer-assigned; currently placeholder.

Use stat as your main design parameter. All other fields are derived or contextual.
