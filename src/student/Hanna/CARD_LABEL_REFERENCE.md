# Card Label Reference — Exact Display Values for Canva Templates

Use this guide to update your Canva card templates. Each card displays these labels based on its stat value and variant.

## Label Display Logic

### Rarity Label (top-right area)
Displayed based on computed stat value:
- **Stat 1–3**: Display "COMMON"
- **Stat 4–7**: Display "UNCOMMON"
- **Stat 8–15**: Display "RARE"
- **Stat 16–40**: Display "LEGENDARY"

### Variant Label (optional, below rarity)
Displayed based on card variant:
- **variant === "normal"**: HIDE this label (do not display)
- **variant === "split_medium"**: Display "SPLIT_MEDIUM"
- **variant === "boss_giant"**: Display "BOSS_GIANT"

### Stat Numeric (center or prominent location)
- Replace "Stats" text label with the actual numeric value (1–40)
- Example: Show "12" instead of "Stats"

### GMGBH Label (bottom-left)
- Always display "GMGBH"
- Placeholder for unique skill name; will be filled per-card later

---

## Template Updates Required

### Common Template (Cream background)
- **Rarity**: "COMMON"
- **Variant**: Hidden (only show if not normal)
- **Stat**: Numeric value (1–3 range for common)
- **GMGBH**: Always visible

### Uncommon Template (Silver/gray background)
- **Rarity**: "UNCOMMON"
- **Variant**: Hidden unless split_medium or boss_giant
- **Stat**: Numeric value (4–7 range for uncommon)
- **GMGBH**: Always visible

### Rare Template (Green background)
- **Rarity**: "RARE"
- **Variant**: Hidden unless split_medium or boss_giant
- **Stat**: Numeric value (8–15 range for rare)
- **GMGBH**: Always visible

### Legendary Template (Blue + gold background)
- **Rarity**: "LEGENDARY"
- **Variant**: Hidden unless split_medium or boss_giant
- **Stat**: Numeric value (16–40 range for legendary)
- **GMGBH**: Always visible

---

## Example Cards (What They Should Display)

| Card | Base Danger | Variant | Stat | Rarity | Variant Label | GMGBH |
|------|-------------|---------|------|--------|---------------|-------|
| Slime (normal) | 2 | normal | 1 | COMMON | (hidden) | GMGBH |
| Bee (normal) | 4 | normal | 3 | COMMON | (hidden) | GMGBH |
| Bee (split_medium) | 4 | split_medium | 6 | UNCOMMON | SPLIT_MEDIUM | GMGBH |
| Spider (normal) | 8 | normal | 7 | UNCOMMON | (hidden) | GMGBH |
| Spider (split_medium) | 8 | split_medium | 14 | RARE | SPLIT_MEDIUM | GMGBH |
| Spider (boss_giant) | 8 | boss_giant | 28 | LEGENDARY | BOSS_GIANT | GMGBH |
| Imp (boss_giant) | 13 | boss_giant | 40 | LEGENDARY | BOSS_GIANT | GMGBH |

---

## Implementation Checklist

- [ ] Common template: Change "Rarity" label to "COMMON"; hide variant unless needed
- [ ] Uncommon template: Change "Rarity" label to "UNCOMMON"; hide variant unless needed
- [ ] Rare template: Change "Rarity" label to "RARE"; hide variant unless needed
- [ ] Legendary template: Change "Rarity" label to "LEGENDARY"; hide variant unless needed
- [ ] All templates: Replace "Stats" with numeric placeholder or badge area
- [ ] All templates: Add conditional variant display logic (hide if normal, show if split_medium/boss_giant)
- [ ] All templates: Export at 256×360px

---

## Notes

- The numeric stat field (1–40) is your primary visual indicator. Consider styling it prominently (larger font, different color, or badge).
- Variant labels should only appear when NOT normal, keeping common/normal cards cleaner.
- Once exported, file names should be: `Card_Common_256x360.png`, `Card_Uncommon_256x360.png`, `Card_Rare_256x360.png`, `Card_Legendary_256x360.png`.
