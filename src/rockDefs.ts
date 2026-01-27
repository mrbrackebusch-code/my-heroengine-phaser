// rockDefs.ts
// Rock sheet reference data and derived prop visuals (tiles.rocks).

export type RockRect = {
  id: string;
  c0: number;
  r0: number;
  c1: number;
  r1: number;
  tags?: string[];
};

export type RockColorVariant = {
  key: string;
  rowOffset: number;
};

export const ROCK_COLOR_VARIANTS: RockColorVariant[] = [
  { key: "white", rowOffset: 0 },
  { key: "light", rowOffset: 8 },
  { key: "dark", rowOffset: 16 },
  { key: "brown", rowOffset: 24 },
];

function rect(id: string, c0: number, r0: number, c1: number, r1: number, tags?: string[]): RockRect {
  return { id, c0, r0, c1, r1, tags };
}

const ROCK_RECTS_WHITE: RockRect[] = [
  // 2x2 rocks
  rect("2x2_a", 0, 0, 1, 1),
  rect("2x2_b", 2, 0, 3, 1),
  rect("2x2_c", 0, 2, 1, 3),
  rect("2x2_d", 2, 2, 3, 3),
  rect("2x2_e", 4, 2, 5, 3),
  rect("2x2_f", 6, 2, 6, 3),
  rect("2x2_g", 24, 4, 25, 5),
  rect("2x2_h", 26, 4, 27, 5),
  rect("2x2_i", 24, 6, 25, 7),
  rect("2x2_j", 26, 6, 27, 7),

  // 1 column, 2 rows (verticals)
  rect("1x2_a", 4, 0, 4, 1),
  rect("1x2_b", 5, 0, 5, 1),
  rect("1x2_c", 0, 6, 0, 7),
  rect("1x2_d", 1, 6, 1, 7),
  rect("1x2_e", 2, 6, 2, 7),
  rect("1x2_f", 3, 6, 3, 7),
  rect("1x2_g", 5, 6, 5, 7),
  rect("1x2_h", 6, 6, 6, 7),
  rect("1x2_i", 8, 6, 8, 7),
  rect("1x2_j", 12, 4, 13, 5),
  rect("1x2_k", 14, 4, 15, 5),

  // Spikes (thin spires)
  rect("spike_a", 16, 3, 16, 4, ["spike"]),
  rect("spike_b", 17, 3, 17, 4, ["spike"]),
  rect("spike_c", 18, 3, 18, 4, ["spike"]),

  // 1 row, 2 columns (horizontals)
  rect("2x1_a", 16, 5, 17, 5),
  rect("2x1_b", 18, 7, 19, 7),
  rect("2x1_c", 6, 1, 7, 1),

  // 3x3
  rect("3x3_a", 9, 0, 11, 2),

  // 4x3 arch (walk beneath)
  rect("arch_4x3", 12, 0, 15, 2, ["arch"]),

  // 2x3
  rect("2x3_a", 16, 0, 17, 2),

  // 4x3
  rect("4x3_a", 20, 5, 23, 7),

  // 4x5
  rect("4x5_a", 20, 0, 23, 4),

  // 5x4
  rect("5x4_a", 24, 0, 28, 3),
];

const ROCK_SINGLE_RECTS_WHITE: RockRect[] = [];

function addSingleSpan(prefix: string, c0: number, r0: number, c1: number, r1: number): void {
  const minC = Math.min(c0, c1) | 0;
  const maxC = Math.max(c0, c1) | 0;
  const minR = Math.min(r0, r1) | 0;
  const maxR = Math.max(r0, r1) | 0;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      ROCK_SINGLE_RECTS_WHITE.push(rect(`${prefix}_${c}_${r}`, c, r, c, r, ["single"]));
    }
  }
}

// Single collision-blocking rocks (each tile is a singleton)
addSingleSpan("s_a", 6, 0, 8, 0);
addSingleSpan("s_b", 8, 1, 8, 2);
addSingleSpan("s_c", 4, 6, 4, 7);
addSingleSpan("s_d", 7, 6, 7, 6);
addSingleSpan("s_e", 10, 3, 11, 5);
addSingleSpan("s_f", 12, 3, 15, 3);
addSingleSpan("s_g", 14, 6, 17, 7);
addSingleSpan("s_h", 18, 2, 19, 2);
addSingleSpan("s_i", 19, 3, 19, 4);

const ROCK_RECTS_ALL: RockRect[] = [...ROCK_RECTS_WHITE, ...ROCK_SINGLE_RECTS_WHITE];

export type RockVisualDef = {
  name: string;
  atlas: string;
  ref: { row: number; col: number };
  wTiles: number;
  hTiles: number;
  tags?: string[];
  color: string;
  baseId: string;
};

export const ROCK_PROP_VISUALS: Record<string, { atlas: string; ref: { row: number; col: number }; wTiles: number; hTiles: number }> = Object.create(null);
export const ROCK_PROP_DEFS: RockVisualDef[] = [];

function buildRockVariant(rectDef: RockRect, color: RockColorVariant): RockVisualDef {
  const wTiles = ((rectDef.c1 - rectDef.c0 + 1) | 0);
  const hTiles = ((rectDef.r1 - rectDef.r0 + 1) | 0);
  const refRow = ((rectDef.r1 + color.rowOffset) | 0);
  const refCol = (rectDef.c0 | 0);
  const name = `boss_rock_${color.key}_${rectDef.id}`;
  return {
    name,
    atlas: "rocks",
    ref: { row: refRow, col: refCol },
    wTiles,
    hTiles,
    tags: rectDef.tags,
    color: color.key,
    baseId: rectDef.id,
  };
}

for (let i = 0; i < ROCK_COLOR_VARIANTS.length; i++) {
  const color = ROCK_COLOR_VARIANTS[i];
  for (let j = 0; j < ROCK_RECTS_ALL.length; j++) {
    const rectDef = ROCK_RECTS_ALL[j];
    const vis = buildRockVariant(rectDef, color);
    ROCK_PROP_VISUALS[vis.name] = {
      atlas: vis.atlas,
      ref: { row: vis.ref.row, col: vis.ref.col },
      wTiles: vis.wTiles,
      hTiles: vis.hTiles,
    };
    ROCK_PROP_DEFS.push(vis);
  }
}

// Boss obstacle pool: favor multi-tile rocks (exclude singletons and thin 1xN pieces).
export const BOSS_ROCK_POOL: RockVisualDef[] = ROCK_PROP_DEFS.filter((d) => {
  if (d.tags && d.tags.indexOf("single") >= 0) return false;
  return (d.wTiles | 0) >= 2 && (d.hTiles | 0) >= 2;
});
