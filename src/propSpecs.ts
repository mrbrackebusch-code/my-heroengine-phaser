// propSpecs.ts
// Central prop metadata for collisions, interaction, and placement rules.

export type PropDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "upLeft"
  | "upRight"
  | "downLeft"
  | "downRight";

export type PropCollisionMode = "none" | "opaque" | "aura" | "base" | "polygon";

export type PropCollisionSpec = {
  mode?: PropCollisionMode;
  baseHeightPx?: number;
  useAura?: boolean;
  polygon?: { points: Array<{ x: number; y: number }> };
};

export type PropInteractSpec = {
  interactable?: boolean;
  focusable?: boolean;
  action?: string;
};

export type PropPlacementSpec = {
  floorKinds?: string[];
  minFloorIndex?: number;
  maxFloorIndex?: number;
};

export type PropDirectionSpec = {
  defaultState?: string;
  statesByDir?: Partial<Record<PropDirection, string>>;
};

export type PropSpec = {
  name: string;
  collision?: PropCollisionSpec;
  interact?: PropInteractSpec;
  placement?: PropPlacementSpec;
  directions?: PropDirectionSpec;
};

const FIRE_TOTEM_DIR: Record<PropDirection, string> = {
  up: "idle",
  down: "idle",
  left: "idle",
  right: "idle",
  upLeft: "diag",
  upRight: "diag",
  downLeft: "diag",
  downRight: "diag",
};

export const PROP_SPECS_BY_NAME: Record<string, PropSpec> = {
  fire_totem: {
    name: "fire_totem",
    collision: {
      mode: "base",
      baseHeightPx: 32,
      useAura: true,
    },
    interact: {
      interactable: true,
      focusable: true,
      action: "prop",
    },
    placement: {
      floorKinds: ["combat"],
    },
    directions: {
      defaultState: "idle",
      statesByDir: FIRE_TOTEM_DIR,
    },
  },
  shrine: {
    name: "shrine",
    collision: {
      mode: "base",
      baseHeightPx: 32,
      useAura: true,
    },
    interact: {
      interactable: true,
      focusable: true,
      action: "prop",
    },
    placement: {
      floorKinds: ["entrance"],
    },
  },
};

export function propBaseNameFromKey(name: string): string {
  const s = (name || "").trim();
  if (!s) return "";
  let cut = s.length;
  const hash = s.indexOf("#");
  const at = s.indexOf("@");
  const bar = s.indexOf("|");
  const colon = s.indexOf(":");
  if (hash >= 0) cut = Math.min(cut, hash);
  if (at >= 0) cut = Math.min(cut, at);
  if (bar >= 0) cut = Math.min(cut, bar);
  if (colon >= 0) cut = Math.min(cut, colon);
  return s.slice(0, cut);
}

export function getPropSpec(name: string): PropSpec | null {
  const base = propBaseNameFromKey(name);
  if (!base) return null;
  return PROP_SPECS_BY_NAME[base] || null;
}

export function propSpecAllowsFloor(spec: PropSpec | null, floorKind: string, floorIndex: number): boolean {
  if (!spec) return true;
  const kinds = spec.placement?.floorKinds;
  if (Array.isArray(kinds) && kinds.length > 0) {
    const hit = kinds.indexOf(String(floorKind || "")) >= 0;
    if (!hit) return false;
  }
  const min = spec.placement?.minFloorIndex;
  const max = spec.placement?.maxFloorIndex;
  if (min != null && (floorIndex | 0) < (min | 0)) return false;
  if (max != null && (floorIndex | 0) > (max | 0)) return false;
  return true;
}

export function propSpecDefaultState(spec: PropSpec | null): string {
  if (!spec || !spec.directions) return "";
  return String(spec.directions.defaultState || "");
}

export function propSpecStateForDir(spec: PropSpec | null, dir?: PropDirection | null): string {
  if (!spec || !spec.directions || !dir) return "";
  const map = spec.directions.statesByDir;
  if (!map) return "";
  const state = map[dir];
  return state ? String(state) : "";
}
