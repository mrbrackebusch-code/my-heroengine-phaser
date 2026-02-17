# Card Renderer Usage Guide

The card renderer creates dynamic card UI with labels that automatically update based on card data. Use this when implementing the overlay UI for the minigame.

## Quick Start

### Import
```typescript
import { renderCard, renderCardGrid, updateCardLabels } from "../../student/Hanna/minigame";
import type { Card } from "../../student/Hanna/types";
```

### Render a Single Card
```typescript
const card: Card = {
    id: "card:d4:normal:3",
    name: "Bee Sting",
    type: "skill",
    baseDanger: 4,
    variant: "normal",
    multiplier: 1,
    stat: 3,
    rarity: "common",
};

const cardElement = renderCard(card, {
    width: 256,
    height: 360,
    onCardClick: (card) => console.log("Clicked:", card.id),
});

document.body.appendChild(cardElement);
```

### Render Multiple Cards in a Grid
```typescript
const cards: Card[] = [
    { id: "card:d2:normal:1", stat: 1, rarity: "common", /* ... */ },
    { id: "card:d4:normal:3", stat: 3, rarity: "common", /* ... */ },
    { id: "card:d8:normal:7", stat: 7, rarity: "uncommon", /* ... */ },
];

const gridElement = renderCardGrid(cards, {
    columns: 3,
    onCardClick: (card) => console.log("Card clicked:", card.id),
});

document.body.appendChild(gridElement);
```

### Update Card Labels Dynamically
When a card's stat or variant changes during gameplay, update the rendered labels:

```typescript
const cardElement = document.querySelector('[data-card-id="card:d8:split_medium:14"]');

if (cardElement) {
    const updatedCard: Card = {
        id: "card:d8:split_medium:14",
        stat: 14,
        variant: "split_medium",
        rarity: "rare",
        /* ... other fields ... */
    };
    
    updateCardLabels(cardElement as HTMLElement, updatedCard);
}
```

## API Reference

### `renderCard(card, options?): HTMLElement`
Render a single card with dynamic labels.

**Parameters:**
- `card: Card` — Card data to render
- `options?: CardRendererOptions`
  - `width?: number` — Card width in px (default: 256)
  - `height?: number` — Card height in px (default: 360)
  - `onCardClick?: (card: Card) => void` — Click handler

**Returns:** HTMLElement (div) representing the card

**Dynamic labels generated:**
- **Stat** (center, large): The numeric stat value (1–40)
- **Rarity** (top-right): COMMON / UNCOMMON / RARE / LEGENDARY (from stat)
- **Variant** (top-right, conditional): Hidden if normal; else SPLIT_MEDIUM or BOSS_GIANT
- **GMGBH** (bottom-left): Always "GMGBH"

### `renderCardGrid(cards, options?): HTMLElement`
Render multiple cards in a responsive grid layout.

**Parameters:**
- `cards: Card[]` — Array of cards to render
- `options?: CardRendererOptions & { columns?: number }`
  - `columns?: number` — Grid columns (default: 3)
  - All CardRendererOptions

**Returns:** HTMLElement (div) container with CSS Grid layout

### `updateCardLabels(container, card): void`
Update an existing card element's labels when the card data changes.

**Parameters:**
- `container: HTMLElement` — The card DOM element to update
- `card: Card` — Updated card data

**Side effects:** Updates stat, rarity, variant labels; removes variant label if normal

## Styling

CSS classes applied by the renderer:

| Class | Purpose |
|-------|---------|
| `.card` | Root card container |
| `.card-rarity-common` | Common rarity styling |
| `.card-rarity-uncommon` | Uncommon rarity styling |
| `.card-rarity-rare` | Rare rarity styling |
| `.card-rarity-legendary` | Legendary rarity styling |
| `.card-stat-number` | Large stat display |
| `.card-rarity-text` | Rarity label |
| `.card-variant-text` | Variant label (conditional) |
| `.card-gmgbh` | GMGBH label |
| `.card-grid` | Grid container |

Styles defined in `src/student/Hanna/cards.css`. Import or copy into your overlay CSS.

## Example: Combo Session UI

```typescript
import { renderCardGrid, updateCardLabels } from "../../student/Hanna/minigame";
import type { CardMinigameSession } from "../../student/Hanna/minigame";

function renderComboSession(session: CardMinigameSession) {
    const container = document.getElementById("overlay");
    
    // Render hand of available cards
    const handGrid = renderCardGrid(session.hand, { columns: 4 });
    container?.appendChild(handGrid);
    
    // On player action, update card display
    session.onTick = () => {
        // Update stat displays if cards change
        for (const card of session.hand) {
            const elem = document.querySelector(`[data-card-id="${card.id}"]`);
            if (elem) updateCardLabels(elem as HTMLElement, card);
        }
    };
}
```

## Notes

- Labels are computed deterministically from card stat and variant via `getRarityDisplay()` and `getVariantDisplay()` in `cardFactory.ts`.
- The renderer produces *semantic HTML* with no external dependencies; works in any DOM context.
- Variant label is hidden if `variant === "normal"` to keep normal cards clean.
- All text uses `textShadow` for readability over various background colors.
