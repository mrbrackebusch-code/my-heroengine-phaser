// Quick test harness for card rendering
// Renders one card of each rarity and variant to the DOM for visual check

import { renderCard, renderCardGrid } from "./cardRenderer";
import type { Card } from "./types";

const testCards: Card[] = [
  {
    id: "c1",
    name: "Common Card",
    type: "skill",
    baseDanger: 1,
    variant: "normal",
    multiplier: 1,
    stat: 2,
    rarity: "common"
  },
  {
    id: "c2",
    name: "Uncommon Card",
    type: "skill",
    baseDanger: 4,
    variant: "split_medium",
    multiplier: 2,
    stat: 6,
    rarity: "uncommon"
  },
  {
    id: "c3",
    name: "Rare Card",
    type: "skill",
    baseDanger: 10,
    variant: "boss_giant",
    multiplier: 4,
    stat: 32,
    rarity: "rare"
  },
  {
    id: "c4",
    name: "Legendary Card",
    type: "skill",
    baseDanger: 20,
    variant: "normal",
    multiplier: 1,
    stat: 40,
    rarity: "legendary"
  }
];

const grid = renderCardGrid(testCards, { columns: 4 });
document.body.appendChild(grid);
