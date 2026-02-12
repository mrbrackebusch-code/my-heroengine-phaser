// tileMapGlue.ts
import Phaser from "phaser";


import type { TileAtlas, TileFamily, AutoShape } from "./tileAtlas";
import {
  DECAL_VISUALS_BY_NAME,
  PROP_VISUALS_BY_NAME,
} from "./tileAtlas";
import { DEFAULT_AURA_RADIUS, auraKey, pickAuraRadius } from "./auraConfig";
import * as heroAnimGlue from "./heroAnimGlue";
import {
  DEBUG_PROP_FOCUS_AURA,
  DEBUG_PROP_FOCUS_AURA_BLINK,
  DEBUG_PROP_FOCUS_AURA_DEPTH,
  DEBUG_PROP_FOCUS_AURA_FRAME_LOGS,
  DEBUG_PROP_FOCUS_AURA_FORCE_FRONT,
  DEBUG_PROP_FOCUS_AURA_FORCE_FRONT_BUMP,
  DEBUG_PROP_FOCUS_AURA_FORCE_VISIBLE_NAMES,
  DEBUG_PROP_FOCUS_AURA_HUD_PREVIEW,
  DEBUG_PROP_FOCUS_AURA_LOGS,
  DEBUG_PROP_FOCUS_AURA_NEON,
  DEBUG_PROP_FOCUS_AURA_OVERRIDE,
  DEBUG_PROP_FOCUS_AURA_PIN_SCREEN,
  DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE,
  DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_ENTER_LOG,
  DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT,
  DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_TIMEOUT_MS,
  DEBUG_PROP_FOCUS_AURA_POSTRENDER_PROBE,
  DEBUG_PROP_FOCUS_AURA_PROP_TINT,
  DEBUG_PROP_FOCUS_AURA_SCENE_DIAG,
  DEBUG_PROP_FOCUS_AURA_SCREEN_SAMPLE,
  DEBUG_PROP_FOCUS_AURA_TRACE,
  DEBUG_PROP_FOCUS_AURA_VERBOSE,
  DEBUG_PROP_FOCUS_AURA_WORLD_MARKER,
  DEBUG_PAD_SINK_PROP_LOGS,
  DEBUG_TILEMAP_AUDIT,
  DEBUG_TILEMAP_AUDIT_CONSOLE,
  DEBUG_TILEMAP_GLUE,
  LOG_PROP_FOCUS_AURA_PIXEL_PROBE_ONCE,
  LOG_PROP_FOCUS_AURA_RENDER_ONCE,
  LOG_PROP_FOCUS_AURA_SCENE_DIAG_ONCE,
} from "./debugFlags";


// ----------------------------------------------------------
// Debug
// ----------------------------------------------------------
// Debug flags live in src/debugFlags.ts
// ----------------------------------------------------------
// Depth model
// ----------------------------------------------------------
// World sprites (heroes/monsters/props) y-sort using:
//   depth = (yPx * WORLD_DEPTH_Y_SCALE) + zBias
const WORLD_DEPTH_Y_SCALE = 100;

// Tile layers always behind world sprites
const TILE_LAYER_DEPTH_GROUND = -1000000;
const TILE_LAYER_DEPTH_CHASM = -999000;
const TILE_LAYER_DEPTH_CHASM_OVERLAY = -998000;
const TILE_LAYER_DEPTH_DECALS = -997000;
const DECAL_AUTO_ENABLED = false;
const DECAL_AUTO_DENSITY_PER_1000 = 1;
const DECAL_AUTO_EDGE_MARGIN = 1;

// ----------------------------------------------------------
// Prop focus aura (tile-based outline sheets)
// ----------------------------------------------------------
// Goal: for interactable props, show a pre-baked outline from a dedicated
// "aura" tilesheet underneath the prop when it is in focus.
//
// Naming convention (auto-resolved):
//   <propTextureKey> + "_aura_r{radius}"
const PROP_FOCUS_AURA_USE_TILED = true; // use pre-baked outline tiles for focus auras
const PROP_FOCUS_AURA_RADIUS = DEFAULT_AURA_RADIUS;
const PROP_FOCUS_AURA_LAYER_RADII = [1, 2, 3] as const;
const PROP_FOCUS_AURA_LAYER_ALPHA = [1, 1, 1];
// Optional per-layer tint to make outlines obvious (r1,r2,r3).
const PROP_FOCUS_AURA_LAYER_TINT = [0xffffff, 0x000000, 0xffffff];

// Scale tuning:
// - We always scale the outline up slightly so it is visible even if the
//   pre-baked outline hugs the prop.
// - Engine can further widen/narrow via focusOutlineRadius.
const PROP_FOCUS_AURA_BASE_SCALE = 1;
const PROP_FOCUS_AURA_RADIUS_SCALE = 0;

// Gentle alpha pulse for interactable outlines.
const PROP_FOCUS_AURA_PULSE_PERIOD_MS = 5000;
const PROP_FOCUS_AURA_PULSE_ALPHA_MIN = 0.02;
const PROP_FOCUS_AURA_PULSE_ALPHA_MAX = 0.1;
const PROP_FOCUS_AURA_ALPHA_CAP = 0.1;
const PROP_FOCUS_AURA_PULSE_ENABLED = false;

// If an aura tile is fully opaque (no transparency), inflate it so a border shows.
// This helps props like chests that fill the entire 32x32 tile.
const PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX = 4;
const PROP_FOCUS_AURA_FORCE_BOX_BORDER = false;
// Trim interior edges on multi-tile props to prevent overlapping aura brightening.
const PROP_FOCUS_AURA_INNER_TRIM_PX = 2;
// Extra trim applied on one side only (right/bottom) to allow 2+1px tuning.
const PROP_FOCUS_AURA_INNER_TRIM_EXTRA_PX = 2;
const PROP_FOCUS_AURA_INNER_TRIM_ONE_SIDE = true;

// Depth tuning: keep aura behind the prop but above tile layers.
const PROP_FOCUS_AURA_DEPTH_BEHIND_PROP = 2;
const PROP_FOCUS_AURA_HIDE_DELAY_MS = 250;

// Debug: log missing aura sheets only once per base texture.
const __warnedMissingPropAuraSheet: Record<string, 1> = Object.create(null);

// Cache last focus state per prop anchor so aura can be re-applied after decor resyncs.
const PROP_FOCUS_AURA_CACHE_STATE = true;

// Debug-only: if true, shove aura in front of *everything* (including prop) to prove depth is the issue.
// If you still can't see it when forced front, it's NOT a depth problem.

// If forcing front, how far in front of the prop to push it.

const CHEST_AURA_FORCE_PAD = false;
const CHEST_AURA_PAD_PX = 2;
const CHEST_AURA_PAD_KEY = "__chestAuraPadBox__";


type ParsedPropKey = {
  baseName: string;
  state: string | null;
  explicitFrameIndex: number | null;
};

type PropFocusAuraOpts = {
  tint?: number;
  alphaMin?: number;
  alphaMax?: number;
  pulseMs?: number;
  blendMode?: number | "add" | "lighten" | "normal";
};

type PropOverlayOpts = {
  tint?: number;
  alpha?: number;
  blendMode?: number | "add" | "lighten" | "normal";
};

function _hashString(s: string): number {
  let h = 0;
  const str = s || "";
  for (let i = 0; i < str.length; i++) {
    h = ((h * 31) + str.charCodeAt(i)) | 0;
  }
  return h | 0;
}

function _mixSeed(seed: number, r: number, c: number, familyHash: number, shapeHash: number): number {
  let h = seed | 0;
  h ^= ((r + 1) * 374761393) | 0;
  h ^= ((c + 1) * 668265263) | 0;
  h ^= familyHash | 0;
  h ^= shapeHash | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h >>> 0);
}

function _parsePropKey(raw: string): ParsedPropKey {
  const s = (raw ?? "").trim();
  if (!s) return { baseName: "", state: null, explicitFrameIndex: null };

  // Supported syntaxes:
  //   "chest#open"   (state)
  //   "chest@closed" (state)
  //   "chest@123"    (explicit absolute frame index)
  const seps = ["#", "@", "|", ":"];
  for (let i = 0; i < seps.length; i++) {
    const sep = seps[i];
    const at = s.indexOf(sep);
    if (at <= 0) continue;

    const baseName = s.slice(0, at).trim();
    const mod = s.slice(at + 1).trim();
    if (!baseName) return { baseName: "", state: null, explicitFrameIndex: null };

    if (mod) {
      const n = (mod.length && /^[0-9]+$/.test(mod)) ? (parseInt(mod, 10) | 0) : NaN;
      if (!Number.isNaN(n)) return { baseName, state: null, explicitFrameIndex: n };
      return { baseName, state: mod, explicitFrameIndex: null };
    }
    return { baseName, state: null, explicitFrameIndex: null };
  }

  return { baseName: s, state: null, explicitFrameIndex: null };
}

function _parseBridgeSpan(state: string | null): number {
  if (!state) return 0;
  const m = /^len(\d+)$/i.exec(state.trim());
  if (!m) return 0;
  const n = (parseInt(m[1], 10) | 0);
  return (n > 0) ? n : 0;
}

function _frameIndexFromTileRef(cols: number, ref: { row: number; col: number }): number {
  return ((ref.row | 0) * (cols | 0) + (ref.col | 0)) | 0;
}

function _propFocusAuraPulseAlpha(scene: Phaser.Scene, nowMs?: number, opts?: PropFocusAuraOpts): number {
  if (!PROP_FOCUS_AURA_PULSE_ENABLED) {
    const maxA = Math.max(0, Math.min(1,
      (opts && typeof opts.alphaMax === "number") ? opts.alphaMax : PROP_FOCUS_AURA_PULSE_ALPHA_MAX
    ));
    const cap = Math.max(0, Math.min(1, PROP_FOCUS_AURA_ALPHA_CAP));
    return (maxA > cap) ? cap : maxA;
  }
  const t = (typeof nowMs === "number")
    ? nowMs
    : (((scene as any)?.time?.now ?? Date.now()) | 0);

  let minA = Math.max(0, Math.min(1,
    (opts && typeof opts.alphaMin === "number") ? opts.alphaMin : PROP_FOCUS_AURA_PULSE_ALPHA_MIN
  ));
  let maxA = Math.max(minA, Math.min(1,
    (opts && typeof opts.alphaMax === "number") ? opts.alphaMax : PROP_FOCUS_AURA_PULSE_ALPHA_MAX
  ));
  const cap = Math.max(0, Math.min(1, PROP_FOCUS_AURA_ALPHA_CAP));
  if (maxA > cap) maxA = cap;
  if (minA > maxA) minA = maxA;
  const span = Math.max(0, maxA - minA);
  const period = Math.max(200, ((opts && typeof opts.pulseMs === "number") ? opts.pulseMs : PROP_FOCUS_AURA_PULSE_PERIOD_MS) | 0);

  const phase = ((t % period) / period) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) * 0.5; // 0..1

  return minA + span * wave;
}

function _propFocusAuraPulseLayers(
  scene: Phaser.Scene,
  nowMs?: number,
  opts?: PropFocusAuraOpts
): { r2: number; r3: number } {
  if (!PROP_FOCUS_AURA_PULSE_ENABLED) {
    return { r2: 1, r3: 1 };
  }
  const t = (typeof nowMs === "number")
    ? nowMs
    : (((scene as any)?.time?.now ?? Date.now()) | 0);
  const period = Math.max(200, ((opts && typeof opts.pulseMs === "number") ? opts.pulseMs : PROP_FOCUS_AURA_PULSE_PERIOD_MS) | 0);
  const phase = ((t % period) / period);

  // Sequence:
  // r2 in -> r3 in -> pause -> r3 out -> r2 out
  const t1 = 0.25;
  const t2 = 0.50;
  const t3 = 0.60;
  const t4 = 0.85;

  const lerp = (a: number, b: number, v: number) => a + (b - a) * v;

  let r2 = 0;
  let r3 = 0;

  if (phase < t1) {
    r2 = lerp(0, 1, phase / t1);
  } else if (phase < t4) {
    r2 = 1;
  } else {
    r2 = lerp(1, 0, (phase - t4) / (1 - t4));
  }

  if (phase < t1) {
    r3 = 0;
  } else if (phase < t2) {
    r3 = lerp(0, 1, (phase - t1) / (t2 - t1));
  } else if (phase < t3) {
    r3 = 1;
  } else if (phase < t4) {
    r3 = lerp(1, 0, (phase - t3) / (t4 - t3));
  } else {
    r3 = 0;
  }

  return { r2, r3 };
}

function _propFocusAuraLayerAlpha(radius: number): number {
  const r = Math.max(0, radius | 0);
  for (let i = 0; i < PROP_FOCUS_AURA_LAYER_RADII.length; i++) {
    const rr = PROP_FOCUS_AURA_LAYER_RADII[i] | 0;
    if (rr === r) return PROP_FOCUS_AURA_LAYER_ALPHA[i] ?? 1;
  }
  return 1;
}

function _resolveAuraBlendMode(blendMode: any, fallback: number): number {
  if (typeof blendMode === "number") return blendMode | 0;
  const modes: any = (Phaser as any)?.BlendModes ?? {};
  if (blendMode === "add") return ((modes.ADD ?? fallback) | 0);
  if (blendMode === "lighten") return ((modes.LIGHTEN ?? modes.SCREEN ?? fallback) | 0);
  if (blendMode === "normal") return ((modes.NORMAL ?? fallback) | 0);
  return fallback | 0;
}

function _dbgCameraRenderStatus(scene: Phaser.Scene, obj: any): string {
  try {
    const cams: any[] = (scene as any)?.cameras?.cameras ?? [];
    const ox = (obj && typeof obj.x === "number") ? obj.x : NaN;
    const oy = (obj && typeof obj.y === "number") ? obj.y : NaN;

    const parts: string[] = [];
    for (let i = 0; i < cams.length; i++) {
      const cam: any = cams[i];
      const name = (cam?.name ?? cam?.id ?? i);
      const wv: any = cam?.worldView ?? null;
      const on = (wv && typeof wv.contains === "function" && isFinite(ox) && isFinite(oy)) ? !!wv.contains(ox, oy) : null;

      // camera ignore list is not public API; this is best-effort
      let ignored: any = null;
      try {
        const ig = (cam?._ignore ?? cam?._ignored ?? null);
        if (Array.isArray(ig)) ignored = ig.indexOf(obj) >= 0;
        else if (ig && typeof ig.has === "function") ignored = ig.has(obj);
      } catch { ignored = null; }

      parts.push(`${name}:on=${on},ign=${ignored}`);
    }
    return parts.join(" | ");
  } catch {
    return "camDbg=ERR";
  }
}

function _dbgTextureAlphaStats(scene: Phaser.Scene, textureKey: string): {
  ok: boolean;
  reason: string;
  w: number;
  h: number;
  alphaCount: number;
  maxAlpha: number;
} {
  try {
    const texObj: any = (scene as any)?.textures?.get?.(textureKey);
    if (!texObj) return { ok: false, reason: "no-texture", w: 0, h: 0, alphaCount: 0, maxAlpha: 0 };

    const img: any =
      texObj.getSourceImage?.() ??
      texObj.source?.[0]?.image ??
      null;
    const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
    if (!img || w <= 0 || h <= 0) {
      return { ok: false, reason: "no-img", w, h, alphaCount: 0, maxAlpha: 0 };
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) return { ok: false, reason: "no-ctx", w, h, alphaCount: 0, maxAlpha: 0 };

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let alphaCount = 0;
    let maxAlpha = 0;
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i] | 0;
      if (a > 0) alphaCount++;
      if (a > maxAlpha) maxAlpha = a;
    }
    return { ok: true, reason: "ok", w, h, alphaCount, maxAlpha };
  } catch {
    return { ok: false, reason: "exception", w: 0, h: 0, alphaCount: 0, maxAlpha: 0 };
  }
}

function _dbgSceneKey(scene: any): string {
  try { return String(scene?.sys?.settings?.key ?? ""); } catch { return ""; }
}

function _dbgObjSceneState(scene: Phaser.Scene, obj: any): any {
  if (!obj) return null;

  const sys: any = (scene as any)?.sys ?? null;
  const dl: any = sys?.displayList ?? null;
  const ul: any = sys?.updateList ?? null;
  const children: any = (scene as any)?.children ?? null;
  const cam: any = (scene as any)?.cameras?.main ?? null;

  let dlExists: any = null;
  let ulExists: any = null;
  let childIndex: any = null;

  try { dlExists = dl?.exists?.(obj) ?? null; } catch { /* ignore */ }
  try { ulExists = ul?.exists?.(obj) ?? null; } catch { /* ignore */ }
  try { childIndex = (typeof children?.getIndex === "function") ? children.getIndex(obj) : null; } catch { /* ignore */ }

  let willRender: any = null;
  try {
    if (cam && typeof obj?.willRender === "function") {
      willRender = !!obj.willRender(cam);
    }
  } catch { willRender = null; }

  return {
    type: obj?.constructor?.name ?? "obj",
    sceneKey: obj?.scene?.sys?.settings?.key ?? null,
    sameScene: obj?.scene === scene,
    active: (obj?.active ?? null),
    visible: (obj?.visible ?? null),
    alpha: (typeof obj?.alpha === "number") ? obj.alpha : null,
    depth: (typeof obj?.depth === "number") ? obj.depth : null,
    x: (typeof obj?.x === "number") ? Math.round(obj.x) : null,
    y: (typeof obj?.y === "number") ? Math.round(obj.y) : null,
    displayW: (typeof obj?.displayWidth === "number") ? Math.round(obj.displayWidth) : null,
    displayH: (typeof obj?.displayHeight === "number") ? Math.round(obj.displayHeight) : null,
    cameraFilter: (obj as any)?.cameraFilter ?? null,
    renderFlags: (typeof obj?.renderFlags === "number") ? obj.renderFlags : null,
    willRender,
    pipeline: (obj as any)?.pipeline?.name ?? null,
    inDisplayList: dlExists,
    inUpdateList: ulExists,
    childIndex,
    hasDisplayListRef: !!(obj as any)?.displayList,
    parentContainer: !!(obj as any)?.parentContainer,
    parentContainerType: (obj as any)?.parentContainer?.constructor?.name ?? null,
  };
}

function _dbgCameraList(scene: Phaser.Scene, obj: any): any[] {
  try {
    const cams: any[] = (scene as any)?.cameras?.cameras ?? [];
    const ox = (obj && typeof obj.x === "number") ? obj.x : NaN;
    const oy = (obj && typeof obj.y === "number") ? obj.y : NaN;
    const objFilter = (obj as any)?.cameraFilter ?? 0;

    const out: any[] = [];
    for (let i = 0; i < cams.length; i++) {
      const cam: any = cams[i];
      const id = cam?.id ?? 0;
      const wv: any = cam?.worldView ?? null;
      const on = (wv && typeof wv.contains === "function" && isFinite(ox) && isFinite(oy)) ? !!wv.contains(ox, oy) : null;
      const filterBlocks = (obj && id) ? (((objFilter | 0) & (id | 0)) !== 0) : null;

      let ignored: any = null;
      try {
        const ig = (cam?._ignore ?? cam?._ignored ?? null);
        if (Array.isArray(ig)) ignored = ig.indexOf(obj) >= 0;
        else if (ig && typeof ig.has === "function") ignored = ig.has(obj);
      } catch { ignored = null; }

      out.push({
        idx: i,
        id,
        name: cam?.name ?? null,
        visible: cam?.visible ?? null,
        zoom: cam?.zoom ?? null,
        scrollX: cam?.scrollX ?? null,
        scrollY: cam?.scrollY ?? null,
        worldView: wv ? { x: wv.x, y: wv.y, w: wv.width, h: wv.height } : null,
        on,
        filterBlocks,
        ignored,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function _dbgPropAuraSceneDiag(scene: Phaser.Scene, cont: any, propObj: any, marker: any): any {
  const sys: any = (scene as any)?.sys ?? null;
  const children: any = (scene as any)?.children ?? null;
  const key = _dbgSceneKey(scene);
  const sp: any = (scene as any)?.scene ?? null;
  const active = (typeof sp?.isActive === "function") ? sp.isActive(key) : null;
  const visible = (typeof sp?.isVisible === "function") ? sp.isVisible(key) : null;
  const gScene: any = (globalThis as any)?.__phaserScene ?? null;
  const gKey = gScene?.sys?.settings?.key ?? null;
  let canvasInfo: any = null;
  try {
    const canvas: any = (scene as any)?.sys?.game?.canvas ?? null;
    const domCanvas: any = (typeof document !== "undefined")
      ? document.querySelector("#app canvas")
      : null;
    const rect = canvas?.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    const domRect = domCanvas?.getBoundingClientRect ? domCanvas.getBoundingClientRect() : null;
    const domCount = (typeof document !== "undefined") ? document.querySelectorAll("canvas").length : null;
    const appCount = (typeof document !== "undefined") ? document.querySelectorAll("#app canvas").length : null;
    canvasInfo = {
      sameDom: (canvas && domCanvas) ? (canvas === domCanvas) : null,
      parentId: canvas?.parentElement?.id ?? null,
      domCount,
      appCount,
      canvas: canvas ? { w: canvas.width ?? null, h: canvas.height ?? null, rect } : null,
      dom: domCanvas ? { w: domCanvas.width ?? null, h: domCanvas.height ?? null, rect: domRect } : null,
    };
  } catch {
    canvasInfo = { error: "canvasDiagFail" };
  }
  return {
    scene: {
      key,
      globalKey: gKey,
      sameAsGlobal: gScene ? (gScene === scene) : null,
      active,
      visible,
      sysActive: !!sys?.isActive?.(),
      sysSleeping: !!sys?.isSleeping?.(),
      childCount: (children && Array.isArray(children.list)) ? children.list.length : null,
      cameraCount: (scene as any)?.cameras?.cameras?.length ?? null,
    },
    canvas: canvasInfo,
    cont: _dbgObjSceneState(scene, cont),
    prop: _dbgObjSceneState(scene, propObj),
    marker: _dbgObjSceneState(scene, marker),
    cameras: {
      cont: _dbgCameraList(scene, cont),
      prop: _dbgCameraList(scene, propObj),
      marker: _dbgCameraList(scene, marker),
    }
  };
}

function _dbgToColor(c: any): any {
  if (!c || typeof c !== "object") return null;
  const r = (c.r ?? c.red ?? 0) | 0;
  const g = (c.g ?? c.green ?? 0) | 0;
  const b = (c.b ?? c.blue ?? 0) | 0;
  const a = (c.a ?? c.alpha ?? 255) | 0;
  const hex = "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return { r, g, b, a, hex };
}

function _dbgWorldToScreen(cam: any, worldX: number, worldY: number): any {
  try {
    const wv: any = cam?.worldView ?? null;
    const zoom = (cam && typeof cam.zoom === "number") ? cam.zoom : 1;
    const cx = (cam && typeof cam.x === "number") ? cam.x : 0;
    const cy = (cam && typeof cam.y === "number") ? cam.y : 0;
    const wx = (wv && typeof wv.x === "number") ? wv.x : (cam?.scrollX ?? 0);
    const wy = (wv && typeof wv.y === "number") ? wv.y : (cam?.scrollY ?? 0);
    const sx = Math.round((worldX - wx) * zoom + cx);
    const sy = Math.round((worldY - wy) * zoom + cy);
    const on = (wv && typeof wv.contains === "function") ? !!wv.contains(worldX, worldY) : null;
    return {
      screen: { x: sx, y: sy },
      on,
      zoom,
      scroll: { x: cam?.scrollX ?? null, y: cam?.scrollY ?? null },
      worldView: wv ? { x: wv.x, y: wv.y, w: wv.width, h: wv.height } : null,
      cam: { x: cx, y: cy, w: cam?.width ?? null, h: cam?.height ?? null },
    };
  } catch {
    return { screen: { x: 0, y: 0 }, on: null };
  }
}

function _dbgProbePixels(scene: Phaser.Scene, points: Array<{ name: string; x: number; y: number }>, tag: string): void {
  try {
    const renderer: any = (scene as any)?.sys?.game?.renderer ?? null;
    if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_ENTER_LOG) {
      console.log(`[PROPAURA][PIXEL] enter ${tag} ${JSON.stringify({
        points: points.map(p => ({ name: p.name, x: p.x | 0, y: p.y | 0 })),
        hasRenderer: !!renderer,
        hasSnapshotPixel: !!renderer?.snapshotPixel
      })}`);
    }
    if (!renderer || typeof renderer.snapshotPixel !== "function") {
      if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
        console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
          error: "noSnapshotPixel",
          hasRenderer: !!renderer,
          hasSnapshotPixel: !!renderer?.snapshotPixel
        })}`);
      }
      return;
    }

    const cam: any = (scene as any)?.cameras?.main ?? null;
    const rw = renderer?.width ?? null;
    const rh = renderer?.height ?? null;

    const mapped = points.map(p => {
      const m = _dbgWorldToScreen(cam, p.x, p.y);
      const sx = m?.screen?.x ?? 0;
      const sy = m?.screen?.y ?? 0;
      const inBounds = (rw != null && rh != null) ? (sx >= 0 && sy >= 0 && sx < rw && sy < rh) : null;
      return { name: p.name, world: { x: p.x | 0, y: p.y | 0 }, map: m, inBounds };
    });

    const results: any[] = [];
    const sampleNext = (idx = 0) => {
      if (idx >= mapped.length) {
        console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
          renderer: { w: rw, h: rh },
          samples: results
        })}`);
        return;
      }

      const cur = mapped[idx];
      const sx = cur.map?.screen?.x ?? 0;
      const sy = cur.map?.screen?.y ?? 0;

      try {
        let fired = false;
        const timer = setTimeout(() => {
          if (fired) return;
          fired = true;
          results.push({
            name: cur.name,
            world: cur.world,
            screen: cur.map?.screen ?? { x: sx, y: sy },
            on: cur.map?.on ?? null,
            inBounds: cur.inBounds,
            cam: cur.map?.cam ?? null,
            worldView: cur.map?.worldView ?? null,
            zoom: cur.map?.zoom ?? null,
            scroll: cur.map?.scroll ?? null,
            color: null,
            error: "snapshotPixelTimeout",
          });
          sampleNext(idx + 1);
        }, DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_TIMEOUT_MS);

        renderer.snapshotPixel(sx, sy, (color: any) => {
          if (fired) return;
          fired = true;
          clearTimeout(timer);
          results.push({
            name: cur.name,
            world: cur.world,
            screen: cur.map?.screen ?? { x: sx, y: sy },
            on: cur.map?.on ?? null,
            inBounds: cur.inBounds,
            cam: cur.map?.cam ?? null,
            worldView: cur.map?.worldView ?? null,
            zoom: cur.map?.zoom ?? null,
            scroll: cur.map?.scroll ?? null,
            color: _dbgToColor(color),
          });
          sampleNext(idx + 1);
        });
      } catch {
        results.push({
          name: cur.name,
          world: cur.world,
          screen: cur.map?.screen ?? { x: sx, y: sy },
          on: cur.map?.on ?? null,
          inBounds: cur.inBounds,
          cam: cur.map?.cam ?? null,
          worldView: cur.map?.worldView ?? null,
          zoom: cur.map?.zoom ?? null,
          scroll: cur.map?.scroll ?? null,
          color: null,
          error: "snapshotPixelFailed",
        });
        sampleNext(idx + 1);
      }
    };

    sampleNext();
  } catch { /* ignore */ }
}

function _dbgProbePixelsArea(
  scene: Phaser.Scene,
  points: Array<{ name: string; x: number; y: number }>,
  tag: string,
  onDone?: (reason: string) => void
): void {
  try {
    const done = (reason: string) => {
      try {
        if (onDone) onDone(reason);
      } catch { /* ignore */ }
    };
    const renderer: any = (scene as any)?.sys?.game?.renderer ?? null;
    if (!renderer || typeof renderer.snapshotArea !== "function") {
      if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
        console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
          error: "noSnapshotArea",
          hasRenderer: !!renderer,
          hasSnapshotArea: !!renderer?.snapshotArea
        })}`);
      }
      done("noSnapshotArea");
      return;
    }

    const cam: any = (scene as any)?.cameras?.main ?? null;
    const rw = renderer?.width ?? null;
    const rh = renderer?.height ?? null;

    const mapped = points.map(p => {
      const m = _dbgWorldToScreen(cam, p.x, p.y);
      const sx = m?.screen?.x ?? 0;
      const sy = m?.screen?.y ?? 0;
      return { name: p.name, world: { x: p.x | 0, y: p.y | 0 }, map: m, screen: { x: sx, y: sy } };
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of mapped) {
      minX = Math.min(minX, p.screen.x);
      minY = Math.min(minY, p.screen.y);
      maxX = Math.max(maxX, p.screen.x);
      maxY = Math.max(maxY, p.screen.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

    minX = Math.floor(minX) - 2;
    minY = Math.floor(minY) - 2;
    maxX = Math.ceil(maxX) + 2;
    maxY = Math.ceil(maxY) + 2;

    if (rw != null && rh != null) {
      minX = Math.max(0, Math.min(rw - 1, minX));
      minY = Math.max(0, Math.min(rh - 1, minY));
      maxX = Math.max(0, Math.min(rw - 1, maxX));
      maxY = Math.max(0, Math.min(rh - 1, maxY));
    }

    const w = Math.max(1, (maxX - minX + 1) | 0);
    const h = Math.max(1, (maxY - minY + 1) | 0);

    if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
      console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
        rect: { x: minX, y: minY, w, h },
        points: mapped.map(p => ({ name: p.name, x: p.screen.x | 0, y: p.screen.y | 0 }))
      })}`);
    }

    let did = false;
    const timeoutMs = Math.max(1, (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_TIMEOUT_MS | 0) || 250);
    const t = setTimeout(() => {
      if (did) return;
      did = true;
      console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
        error: "snapshotAreaTimeout",
        rect: { x: minX, y: minY, w, h }
      })}`);
      done("timeout");
    }, timeoutMs);

    renderer.snapshotArea(minX, minY, w, h, (image: any) => {
      try {
        if (did) return;
        did = true;
        clearTimeout(t);
        const iw = (image?.width ?? image?.naturalWidth ?? w) | 0;
        const ih = (image?.height ?? image?.naturalHeight ?? h) | 0;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, iw);
        canvas.height = Math.max(1, ih);
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
        if (!ctx) {
          console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({ error: "snapshotAreaNoContext" })}`);
          done("noContext");
          return;
        }
        ctx.clearRect(0, 0, iw, ih);
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, iw, ih).data;

        const samples = mapped.map(p => {
          const sx = p.screen.x - minX;
          const sy = p.screen.y - minY;
          if (sx < 0 || sy < 0 || sx >= iw || sy >= ih) {
            return {
              name: p.name,
              world: p.world,
              screen: p.screen,
              color: null,
              error: "outOfSnapshot",
              map: p.map
            };
          }
          const idx = ((sy | 0) * iw + (sx | 0)) * 4;
          const color = { r: data[idx] | 0, g: data[idx + 1] | 0, b: data[idx + 2] | 0, a: data[idx + 3] | 0 };
          return {
            name: p.name,
            world: p.world,
            screen: p.screen,
            color: _dbgToColor(color),
            map: p.map
          };
        });

        console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({
          renderer: { w: rw, h: rh },
          rect: { x: minX, y: minY, w, h },
          samples
        })}`);
        done("ok");
      } catch {
        console.log(`[PROPAURA][PIXEL] ${tag} ${JSON.stringify({ error: "snapshotAreaParseFail" })}`);
        done("parseFail");
      }
    });
  } catch { /* ignore */ }
}


function _tileRefFromFrameIndex(cols: number, frameIndex: number): { row: number; col: number } {
  const c = (cols | 0);
  const fi = (frameIndex | 0);
  const row = c > 0 ? Math.floor(fi / c) : 0;
  const col = c > 0 ? (fi % c) : 0;
  return { row: row | 0, col: col | 0 };
}

function _dbgOffscreenAuraPixel(
  scene: Phaser.Scene,
  texKey: string,
  frameName: any
): { ok: boolean; color?: { r: number; g: number; b: number; a: number; hex: string }; error?: string } {
  try {
    const rt: any = (scene as any)?.make?.renderTexture?.({ x: 0, y: 0, width: 4, height: 4, add: false });
    if (!rt) return { ok: false, error: "no-render-texture" };
    rt.clear?.();
    if (frameName != null && frameName !== "") {
      rt.drawFrame?.(texKey, frameName, 2, 2);
    } else {
      rt.drawFrame?.(texKey, "__BASE", 2, 2);
    }
    const px: any = rt.getPixel?.(2, 2) ?? null;
    rt.destroy?.();
    if (!px) return { ok: false, error: "no-pixel" };
    const r = px.r ?? 0;
    const g = px.g ?? 0;
    const b = px.b ?? 0;
    const a = px.a ?? 0;
    const hex = (px.color != null)
      ? ("#" + (px.color as number).toString(16).padStart(6, "0"))
      : ("#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0"));
    return { ok: true, color: { r, g, b, a, hex } };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

function _dbgExtractPixelFromImage(image: any, x: number, y: number): { r: number; g: number; b: number; a: number; hex: string } | null {
  try {
    const canvas = document.createElement("canvas");
    const w = (image?.width ?? image?.naturalWidth ?? 0) | 0;
    const h = (image?.height ?? image?.naturalHeight ?? 0) | 0;
    if (w <= 0 || h <= 0) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const img = ctx.getImageData(x | 0, y | 0, 1, 1);
    const d = img.data;
    const r = d[0] | 0;
    const g = d[1] | 0;
    const b = d[2] | 0;
    const a = d[3] | 0;
    const hex = "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
    return { r, g, b, a, hex };
  } catch {
    return null;
  }
}

function _dbgOffscreenAuraPixelSnapshot(
  scene: Phaser.Scene,
  texKey: string,
  frameName: any
): void {
  try {
    console.log(`[PROPAURA][CHEST-OFFSCREEN-SNAPSHOT] ${JSON.stringify({ stage: "start", texKey, frameName })}`);
    const rt: any = (scene as any)?.add?.renderTexture?.(0, 0, 4, 4);
    if (!rt) {
      console.log(`[PROPAURA][CHEST-OFFSCREEN-SNAPSHOT] ${JSON.stringify({ ok: false, error: "no-rt" })}`);
      return;
    }
    rt.setScrollFactor?.(0, 0);
    rt.setDepth?.(-999999);
    rt.setAlpha?.(0.01);
    rt.setVisible?.(true);
    rt.clear?.();
    if (frameName != null && frameName !== "") {
      rt.drawFrame?.(texKey, frameName, 2, 2);
    } else {
      rt.drawFrame?.(texKey, "__BASE", 2, 2);
    }
    if (typeof rt.snapshotArea !== "function") {
      rt.destroy?.();
      console.log(`[PROPAURA][CHEST-OFFSCREEN-SNAPSHOT] ${JSON.stringify({ ok: false, error: "no-snapshotArea" })}`);
      return;
    }
    let done = false;
    const finish = (payload: any) => {
      if (done) return;
      done = true;
      console.log(`[PROPAURA][CHEST-OFFSCREEN-SNAPSHOT] ${JSON.stringify(payload)}`);
      rt.destroy?.();
    };
    const run = () => {
      rt.snapshotArea(0, 0, 4, 4, (image: any) => {
        const color = _dbgExtractPixelFromImage(image, 2, 2);
        finish({
          stage: "callback",
          texKey,
          frameName,
          ok: !!color,
          color: color ?? null
        });
      });
    };
    scene.events?.once?.("postrender", run);
    scene.time?.delayedCall?.(200, () => {
      if (!done) finish({ stage: "timeout", texKey, frameName });
    });
  } catch (err: any) {
    console.log(`[PROPAURA][CHEST-OFFSCREEN-SNAPSHOT] ${JSON.stringify({ ok: false, error: String(err?.message ?? err) })}`);
  }
}

function _ensureChestAuraPadTexture(scene: Phaser.Scene, tileSize: number, padPx: number): string {
  const key = `${CHEST_AURA_PAD_KEY}${padPx}::${tileSize}`;
  if (scene.textures.exists(key)) return key;
  const w = Math.max(2, (tileSize | 0) + ((padPx | 0) * 2));
  const h = w;
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

function _ensurePropAnim(
  scene: Phaser.Scene,
  textureKey: string,
  sheetCols: number,
  anim: any
): string | null {
  if (!anim || typeof anim.key !== "string" || !anim.key.trim()) return null;

  const cols = (sheetCols | 0);
  const fps = (anim.frameRate ?? 6) | 0;
  const repeat = (anim.repeat ?? -1) | 0;

  let frames: number[] = [];

  if (Array.isArray(anim.frames) && anim.frames.length) {
    frames = anim.frames.map((n: any) => (n | 0)).filter((n: number) => Number.isFinite(n));
  } else if (Array.isArray(anim.frameRefs) && anim.frameRefs.length) {
    frames = anim.frameRefs.map((r: any) => _frameIndexFromTileRef(cols, { row: r?.row ?? 0, col: r?.col ?? 0 }));
  } else if (typeof anim.startFrame === "number" && typeof anim.endFrame === "number") {
    const a = (anim.startFrame | 0);
    const b = (anim.endFrame | 0);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) frames.push(i | 0);
  } else if (anim.startRef && anim.endRef) {
    const a = _frameIndexFromTileRef(cols, anim.startRef);
    const b = _frameIndexFromTileRef(cols, anim.endRef);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) frames.push(i | 0);
  }

  if (frames.length < 2) return null;

  const animKey = `prop:${textureKey}:${anim.key}`;
  const anyScene: any = scene as any;

  if (anyScene?.anims?.exists?.(animKey)) return animKey;

  try {
    anyScene?.anims?.create?.({
      key: animKey,
      frames: frames.map((fi: number) => ({ key: textureKey, frame: fi })),
      frameRate: Math.max(1, fps | 0),
      repeat
    });
    return animKey;
  } catch {
    return null;
  }
}


function logTiles(localDebug: boolean, ...args: any[]) {
    if (!DEBUG_TILEMAP_GLUE || !localDebug) return;
    console.log(...args);
}

function _auditBoxDims(minR: number, maxR: number, minC: number, maxC: number): { w: number; h: number } {
  if (maxR < minR || maxC < minC) return { w: 0, h: 0 };
  return { w: ((maxC - minC + 1) | 0), h: ((maxR - minR + 1) | 0) };
}


function _dbgMakeAuraHudPreviewOnce(scene: Phaser.Scene, auraTk: string, reqFrame: any): void {
  const anyScene: any = scene as any;
  if (anyScene.__dbgAuraHudPreviewMade) return;
  anyScene.__dbgAuraHudPreviewMade = 1;

  const bg = scene.add.rectangle(12, 12, 220, 190, 0x000000, 0.65);
  bg.setOrigin(0, 0).setScrollFactor(0).setDepth(99999999);

  const imgReq = scene.add.image(20, 20, auraTk, reqFrame);
  imgReq.setOrigin(0, 0).setScrollFactor(0).setDepth(100000000);
  imgReq.setScale(4);

  const img0 = scene.add.image(120, 20, auraTk, 0);
  img0.setOrigin(0, 0).setScrollFactor(0).setDepth(100000000);
  img0.setScale(4);

  const txt = scene.add.text(
    12,
    176,
    `auraTk=${auraTk}\nreq=${String(reqFrame)} | frame0=0`,
    { fontFamily: "monospace", fontSize: "12px" }
  );
  txt.setOrigin(0, 0).setScrollFactor(0).setDepth(100000001);
}



function _dbgFrameOpaqueStats(
  scene: Phaser.Scene,
  textureKey: string,
  frame: any
): {
  ok: boolean;
  reason: string;

  texExists: boolean;
  imgW: number;
  imgH: number;
  frameTotal: number;

  req: any;
  resolved: any;
  hasFrame: boolean;

  w: number;
  h: number;
  opaque: number;
  total: number;
  aMax: number;
  aMin: number;

  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  bboxW: number;
  bboxH: number;
  rowMin: number;
  colMin: number;
  rowsWithPixels: number;
  colsWithPixels: number;
  boxOk: boolean;
  edgeMin: number;
  edgeTop: number;
  edgeBottom: number;
  edgeLeft: number;
  edgeRight: number;
  edgeOk: boolean;
} {
  try {
    const texMgr: any = (scene as any)?.textures;
    const texExists = !!texMgr?.exists?.(textureKey);
    const texObj: any = texMgr?.get?.(textureKey);

    if (!texObj) {
      return {
        ok: false, reason: "no-texture",
        texExists, imgW: 0, imgH: 0, frameTotal: 0,
        req: frame, resolved: null, hasFrame: false,
        w: 0, h: 0, opaque: 0, total: 0, aMax: 0, aMin: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    const img: any =
      texObj.getSourceImage?.() ??
      texObj.source?.[0]?.image ??
      null;

    const imgW = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const imgH = (img?.height ?? img?.naturalHeight ?? 0) | 0;

    // Phaser usually exposes frameTotal for sheets; fallback to frames map count.
    const frameTotal =
      (typeof texObj.frameTotal === "number" ? (texObj.frameTotal | 0) :
        (texObj.frames && typeof texObj.frames === "object" ? (Object.keys(texObj.frames).length | 0) : 0)
      );

    // Try resolving frame in a few ways (number vs string vs 0)
    let fr: any = null;
    let resolved: any = null;

    if (typeof texObj.getFrame === "function") {
      fr = texObj.getFrame(frame);
      resolved = frame;

      if (!fr && frame != null) {
        const s = String(frame);
        fr = texObj.getFrame(s);
        if (fr) resolved = s;
      }

      if (!fr) {
        fr = texObj.getFrame(0);
        if (fr) resolved = 0;
      }
    }

    const hasFrame = !!fr;

    if (!hasFrame) {
      return {
        ok: false, reason: "no-frame",
        texExists, imgW, imgH, frameTotal,
        req: frame, resolved: null, hasFrame: false,
        w: 0, h: 0, opaque: 0, total: 0, aMax: 0, aMin: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    const sx = (fr.cutX ?? fr.x ?? 0) | 0;
    const sy = (fr.cutY ?? fr.y ?? 0) | 0;
    const sw = (fr.cutWidth ?? fr.width ?? 0) | 0;
    const sh = (fr.cutHeight ?? fr.height ?? 0) | 0;

    if (!img || sw <= 0 || sh <= 0) {
      return {
        ok: false, reason: "no-img-or-bad-dims",
        texExists, imgW, imgH, frameTotal,
        req: frame, resolved, hasFrame: true,
        w: sw, h: sh, opaque: 0, total: 0, aMax: 0, aMin: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    // Draw region to a tiny canvas and count alpha
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) {
      return {
        ok: false, reason: "no-canvas-ctx",
        texExists, imgW, imgH, frameTotal,
        req: frame, resolved, hasFrame: true,
        w: sw, h: sh, opaque: 0, total: 0, aMax: 0, aMin: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const data = ctx.getImageData(0, 0, sw, sh).data;
    const total = (sw * sh) | 0;

    const rowCounts = new Array(sh).fill(0);
    const colCounts = new Array(sw).fill(0);

    let opaque = 0;
    let aMax = 0;
    let aMin = 255;
    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;

    let idx = 3;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++, idx += 4) {
        const a = data[idx] | 0;
        if (a > 0) {
          opaque++;
          rowCounts[y] = (rowCounts[y] | 0) + 1;
          colCounts[x] = (colCounts[x] | 0) + 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        if (a > aMax) aMax = a;
        if (a < aMin) aMin = a;
      }
    }

    let bboxW = 0;
    let bboxH = 0;
    let rowMin = 0;
    let colMin = 0;
    let rowsWithPixels = 0;
    let colsWithPixels = 0;
    let boxOk = false;
    let edgeTop = 0;
    let edgeBottom = 0;
    let edgeLeft = 0;
    let edgeRight = 0;
    let edgeMin = 0;
    let edgeOk = false;

    if (opaque > 0 && maxX >= minX && maxY >= minY) {
      bboxW = ((maxX - minX + 1) | 0);
      bboxH = ((maxY - minY + 1) | 0);
      let rMin = 999999;
      let cMin = 999999;
      for (let y = minY; y <= maxY; y++) {
        const cnt = rowCounts[y] | 0;
        if (cnt > 0) rowsWithPixels++;
        if (cnt < rMin) rMin = cnt;
      }
      for (let x = minX; x <= maxX; x++) {
        const cnt = colCounts[x] | 0;
        if (cnt > 0) colsWithPixels++;
        if (cnt < cMin) cMin = cnt;
      }
      rowMin = (rMin === 999999) ? 0 : (rMin | 0);
      colMin = (cMin === 999999) ? 0 : (cMin | 0);
      boxOk = (bboxW >= 2 && bboxH >= 2 && rowMin >= 2 && colMin >= 2);
      edgeTop = (minY >= 0 && minY < sh) ? (rowCounts[minY] | 0) : 0;
      edgeBottom = (maxY >= 0 && maxY < sh) ? (rowCounts[maxY] | 0) : 0;
      edgeLeft = (minX >= 0 && minX < sw) ? (colCounts[minX] | 0) : 0;
      edgeRight = (maxX >= 0 && maxX < sw) ? (colCounts[maxX] | 0) : 0;
      edgeMin = Math.max(2, ((Math.min(sw, sh) * 0.25) | 0));
      edgeOk = (edgeTop >= edgeMin && edgeBottom >= edgeMin && edgeLeft >= edgeMin && edgeRight >= edgeMin);
    } else {
      minX = -1;
      minY = -1;
      maxX = -1;
      maxY = -1;
    }

    return {
      ok: true, reason: "ok",
      texExists, imgW, imgH, frameTotal,
      req: frame, resolved, hasFrame: true,
      w: sw, h: sh, opaque, total, aMax, aMin,
      minX, minY, maxX, maxY, bboxW, bboxH,
      rowMin, colMin, rowsWithPixels, colsWithPixels, boxOk,
      edgeMin, edgeTop, edgeBottom, edgeLeft, edgeRight, edgeOk
    };
  } catch {
    return {
      ok: false, reason: "exception",
      texExists: false, imgW: 0, imgH: 0, frameTotal: 0,
      req: frame, resolved: null, hasFrame: false,
      w: 0, h: 0, opaque: 0, total: 0, aMax: 0, aMin: 0,
      minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
      rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
      edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
    };
  }
}


function _dbgCropOpaqueStats(
  scene: Phaser.Scene,
  textureKey: string,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): {
  ok: boolean;
  reason: string;
  imgW: number;
  imgH: number;
  opaque: number;
  total: number;
  aMax: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  bboxW: number;
  bboxH: number;
  rowMin: number;
  colMin: number;
  rowsWithPixels: number;
  colsWithPixels: number;
  boxOk: boolean;
  edgeMin: number;
  edgeTop: number;
  edgeBottom: number;
  edgeLeft: number;
  edgeRight: number;
  edgeOk: boolean;
} {
  try {
    const texObj: any = (scene as any)?.textures?.get?.(textureKey);
    if (!texObj) {
      return {
        ok: false, reason: "no-texture", imgW: 0, imgH: 0, opaque: 0, total: 0, aMax: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    const img: any =
      texObj.getSourceImage?.() ??
      texObj.source?.[0]?.image ??
      null;

    const imgW = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const imgH = (img?.height ?? img?.naturalHeight ?? 0) | 0;

    const x = cropX | 0, y = cropY | 0, w = cropW | 0, h = cropH | 0;
    if (!img || imgW <= 0 || imgH <= 0) {
      return {
        ok: false, reason: "no-img", imgW, imgH, opaque: 0, total: 0, aMax: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }
    if (w <= 0 || h <= 0) {
      return {
        ok: false, reason: "bad-dims", imgW, imgH, opaque: 0, total: 0, aMax: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }
    if (x < 0 || y < 0 || x + w > imgW || y + h > imgH) {
      return {
        ok: false, reason: "oob", imgW, imgH, opaque: 0, total: 0, aMax: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) {
      return {
        ok: false, reason: "no-ctx", imgW, imgH, opaque: 0, total: 0, aMax: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
        edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
      };
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    const total = (w * h) | 0;

    const rowCounts = new Array(h).fill(0);
    const colCounts = new Array(w).fill(0);

    let opaque = 0;
    let aMax = 0;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    let idx = 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++, idx += 4) {
        const a = data[idx] | 0;
        if (a > 0) {
          opaque++;
          rowCounts[y] = (rowCounts[y] | 0) + 1;
          colCounts[x] = (colCounts[x] | 0) + 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        if (a > aMax) aMax = a;
      }
    }

    let bboxW = 0;
    let bboxH = 0;
    let rowMin = 0;
    let colMin = 0;
    let rowsWithPixels = 0;
    let colsWithPixels = 0;
    let boxOk = false;
    let edgeTop = 0;
    let edgeBottom = 0;
    let edgeLeft = 0;
    let edgeRight = 0;
    let edgeMin = 0;
    let edgeOk = false;

    if (opaque > 0 && maxX >= minX && maxY >= minY) {
      bboxW = ((maxX - minX + 1) | 0);
      bboxH = ((maxY - minY + 1) | 0);
      let rMin = 999999;
      let cMin = 999999;
      for (let y = minY; y <= maxY; y++) {
        const cnt = rowCounts[y] | 0;
        if (cnt > 0) rowsWithPixels++;
        if (cnt < rMin) rMin = cnt;
      }
      for (let x = minX; x <= maxX; x++) {
        const cnt = colCounts[x] | 0;
        if (cnt > 0) colsWithPixels++;
        if (cnt < cMin) cMin = cnt;
      }
      rowMin = (rMin === 999999) ? 0 : (rMin | 0);
      colMin = (cMin === 999999) ? 0 : (cMin | 0);
      boxOk = (bboxW >= 2 && bboxH >= 2 && rowMin >= 2 && colMin >= 2);
      edgeTop = (minY >= 0 && minY < h) ? (rowCounts[minY] | 0) : 0;
      edgeBottom = (maxY >= 0 && maxY < h) ? (rowCounts[maxY] | 0) : 0;
      edgeLeft = (minX >= 0 && minX < w) ? (colCounts[minX] | 0) : 0;
      edgeRight = (maxX >= 0 && maxX < w) ? (colCounts[maxX] | 0) : 0;
      edgeMin = Math.max(2, ((Math.min(w, h) * 0.25) | 0));
      edgeOk = (edgeTop >= edgeMin && edgeBottom >= edgeMin && edgeLeft >= edgeMin && edgeRight >= edgeMin);
    } else {
      minX = -1;
      minY = -1;
      maxX = -1;
      maxY = -1;
    }

    return {
      ok: true, reason: "ok", imgW, imgH, opaque, total, aMax,
      minX, minY, maxX, maxY, bboxW, bboxH,
      rowMin, colMin, rowsWithPixels, colsWithPixels, boxOk,
      edgeMin, edgeTop, edgeBottom, edgeLeft, edgeRight, edgeOk
    };
  } catch {
    return {
      ok: false, reason: "exception", imgW: 0, imgH: 0, opaque: 0, total: 0, aMax: 0,
      minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
      rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false,
      edgeMin: 0, edgeTop: 0, edgeBottom: 0, edgeLeft: 0, edgeRight: 0, edgeOk: false
    };
  }
}

function _buildPaddedAuraTexture(
  scene: Phaser.Scene,
  auraTk: string,
  frameName: string,
  cropX: number,
  cropY: number,
  tile: number,
  padPx: number,
  useFrame: boolean,
  makeRing: boolean,
  ringMode: "aura" | "box" | "solid"
): { ok: boolean; reason: string; key: string; w: number; h: number } {
  const pad = Math.max(0, padPx | 0);
  const key = `__auraPad__${auraTk}::${String(frameName)}::p${pad}::${useFrame ? "f" : "c"}::${makeRing ? (ringMode === "box" ? "rb" : ringMode === "solid" ? "rs" : "r2") : "s"}`;
  try {
    const texMgr: any = (scene as any)?.textures;
    if (!texMgr) return { ok: false, reason: "no-texmgr", key, w: 0, h: 0 };
    if (texMgr.exists?.(key)) {
      const texObj: any = texMgr.get?.(key);
      const img: any = texObj?.getSourceImage?.() ?? texObj?.source?.[0]?.image ?? null;
      const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
      const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
      return { ok: true, reason: "cached", key, w, h };
    }

    const texObj: any = texMgr.get?.(auraTk);
    if (!texObj) return { ok: false, reason: "no-texture", key, w: 0, h: 0 };

    const srcImg: any =
      texObj.getSourceImage?.() ??
      texObj.source?.[0]?.image ??
      null;
    if (!srcImg) return { ok: false, reason: "no-src-img", key, w: 0, h: 0 };

    let sx = cropX | 0;
    let sy = cropY | 0;
    let sw = tile | 0;
    let sh = tile | 0;

    if (useFrame && typeof texObj.getFrame === "function") {
      const fr: any = texObj.getFrame(frameName);
      if (fr) {
        sx = (fr.cutX ?? fr.x ?? 0) | 0;
        sy = (fr.cutY ?? fr.y ?? 0) | 0;
        sw = (fr.cutWidth ?? fr.width ?? tile) | 0;
        sh = (fr.cutHeight ?? fr.height ?? tile) | 0;
      }
    }

    const outW = (sw + pad * 2) | 0;
    const outH = (sh + pad * 2) | 0;
    if (outW <= 0 || outH <= 0) return { ok: false, reason: "bad-out-dims", key, w: 0, h: 0 };

    const canvasTex: any = texMgr.createCanvas?.(key, outW, outH);
    if (!canvasTex) return { ok: false, reason: "no-canvas-tex", key, w: 0, h: 0 };

    const ctx = canvasTex.getContext?.();
    if (!ctx) return { ok: false, reason: "no-canvas-ctx", key, w: 0, h: 0 };

    ctx.clearRect(0, 0, outW, outH);
    if (makeRing && ringMode === "box") {
      // Solid rectangular ring (force full enclosure).
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(pad, pad, sw, sh);
      ctx.globalCompositeOperation = "source-over";
    } else if (makeRing && ringMode === "solid") {
      // Solid filled box (no punch-out)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
    } else if (makeRing) {
      // Draw a scaled-up silhouette, then punch out the original tile to leave a border ring.
      ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, outW, outH);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(srcImg, sx, sy, sw, sh, pad, pad, sw, sh);
      // Force the ring to solid white so it is visible behind fully-opaque props.
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.drawImage(srcImg, sx, sy, sw, sh, pad, pad, sw, sh);
    }
    if (PROP_FOCUS_AURA_FORCE_BOX_BORDER) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, outW - 1, outH - 1);
    }
    canvasTex.refresh?.();

    return { ok: true, reason: "ok", key, w: outW, h: outH };
  } catch {
    return { ok: false, reason: "exception", key, w: 0, h: 0 };
  }
}

function _buildPaddedAuraTextureRT(
  scene: Phaser.Scene,
  auraTk: string,
  frameName: string,
  cropX: number,
  cropY: number,
  tile: number,
  padPx: number,
  useFrame: boolean,
  makeRing: boolean,
  ringMode: "aura" | "box" | "solid"
): { ok: boolean; reason: string; key: string; w: number; h: number } {
  const pad = Math.max(0, padPx | 0);
  const key = `__auraPad__${auraTk}::${String(frameName)}::p${pad}::${useFrame ? "f" : "c"}::${makeRing ? (ringMode === "box" ? "rb" : ringMode === "solid" ? "rs" : "r2") : "s"}::rt`;
  try {
    const texMgr: any = (scene as any)?.textures;
    if (!texMgr) return { ok: false, reason: "no-texmgr", key, w: 0, h: 0 };
    if (texMgr.exists?.(key)) {
      const texObj: any = texMgr.get?.(key);
      const img: any = texObj?.getSourceImage?.() ?? texObj?.source?.[0]?.image ?? null;
      const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
      const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
      return { ok: true, reason: "cached", key, w, h };
    }

    const texObj: any = texMgr.get?.(auraTk);
    if (!texObj) return { ok: false, reason: "no-texture", key, w: 0, h: 0 };

    let sx = cropX | 0;
    let sy = cropY | 0;
    let sw = tile | 0;
    let sh = tile | 0;

    if (useFrame && typeof texObj.getFrame === "function") {
      const fr: any = texObj.getFrame(frameName);
      if (fr) {
        sx = (fr.cutX ?? fr.x ?? 0) | 0;
        sy = (fr.cutY ?? fr.y ?? 0) | 0;
        sw = (fr.cutWidth ?? fr.width ?? tile) | 0;
        sh = (fr.cutHeight ?? fr.height ?? tile) | 0;
      }
    }

    const outW = (sw + pad * 2) | 0;
    const outH = (sh + pad * 2) | 0;
    if (outW <= 0 || outH <= 0) return { ok: false, reason: "bad-out-dims", key, w: 0, h: 0 };

    const rt: any = (scene as any)?.make?.renderTexture?.({ x: 0, y: 0, width: outW, height: outH, add: false });
    if (!rt) return { ok: false, reason: "no-rt", key, w: 0, h: 0 };
    rt.clear?.();

    if (makeRing && ringMode === "box") {
      const gOuter: any = (scene as any)?.add?.graphics?.();
      if (!gOuter) {
        rt.destroy?.();
        return { ok: false, reason: "no-graphics", key, w: 0, h: 0 };
      }
      gOuter.fillStyle(0xffffff, 1);
      gOuter.fillRect(0, 0, outW, outH);
      rt.draw?.(gOuter, 0, 0);
      const gInner: any = (scene as any)?.add?.graphics?.();
      if (gInner) {
        gInner.fillStyle(0xffffff, 1);
        gInner.fillRect(pad, pad, sw, sh);
        rt.erase?.(gInner);
        gInner.destroy?.();
      }
      gOuter.destroy?.();
    } else if (makeRing && ringMode === "solid") {
      const gOuter: any = (scene as any)?.add?.graphics?.();
      if (!gOuter) {
        rt.destroy?.();
        return { ok: false, reason: "no-graphics", key, w: 0, h: 0 };
      }
      gOuter.fillStyle(0xffffff, 1);
      gOuter.fillRect(0, 0, outW, outH);
      rt.draw?.(gOuter, 0, 0);
      gOuter.destroy?.();
    } else {
      const imgFull: any = (scene as any)?.make?.image?.({
        x: (outW / 2),
        y: (outH / 2),
        key: auraTk,
        frame: useFrame ? frameName : "__BASE",
        add: false
      });
      if (!imgFull) {
        rt.destroy?.();
        return { ok: false, reason: "no-img", key, w: 0, h: 0 };
      }

      imgFull.setDisplaySize(outW, outH);
      if (!useFrame) {
        imgFull.setCrop?.(sx, sy, sw, sh);
      }
      rt.draw?.(imgFull);

      if (makeRing) {
        const imgInner: any = (scene as any)?.make?.image?.({
          x: (outW / 2),
          y: (outH / 2),
          key: auraTk,
          frame: useFrame ? frameName : "__BASE",
          add: false
        });
        if (imgInner) {
          imgInner.setDisplaySize(sw, sh);
          if (!useFrame) {
            imgInner.setCrop?.(sx, sy, sw, sh);
          }
          rt.erase?.(imgInner);
          imgInner.destroy?.();
        }
      }
      imgFull.destroy?.();
    }
    if (PROP_FOCUS_AURA_FORCE_BOX_BORDER) {
      try {
        const g: any = (scene as any)?.add?.graphics?.();
        if (g) {
          g.lineStyle(1, 0xffffff, 1);
          g.strokeRect(0.5, 0.5, outW - 1, outH - 1);
          rt.draw?.(g, 0, 0);
          g.destroy?.();
        }
      } catch { /* ignore */ }
    }

    rt.saveTexture?.(key);
    rt.destroy?.();

    const texObjOut: any = texMgr.get?.(key);
    const img: any = texObjOut?.getSourceImage?.() ?? texObjOut?.source?.[0]?.image ?? null;
    const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
    if (!w || !h) return { ok: false, reason: "no-out-img", key, w: 0, h: 0 };
    return { ok: true, reason: "ok", key, w, h };
  } catch {
    return { ok: false, reason: "exception", key, w: 0, h: 0 };
  }
}

function _buildSolidBoxPadTexture(
  scene: Phaser.Scene,
  baseKey: string,
  tile: number,
  padPx: number
): { ok: boolean; reason: string; key: string; w: number; h: number } {
  const pad = Math.max(1, padPx | 0);
  const out = (tile | 0) + pad * 2;
  const key = `__auraPadSolid__${baseKey}::${pad}`;
  try {
    const texMgr: any = (scene as any)?.textures;
    if (texMgr?.exists?.(key)) {
      const texObj: any = texMgr.get?.(key);
      const img: any = texObj?.getSourceImage?.() ?? texObj?.source?.[0]?.image ?? null;
      const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
      const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
      return { ok: true, reason: "cached", key, w, h };
    }
    const rt: any = (scene as any)?.add?.renderTexture?.(0, 0, out, out);
    if (!rt) return { ok: false, reason: "no-rt", key, w: 0, h: 0 };
    rt.setVisible(false);
    rt.fill(0xffffff, 1);
    rt.saveTexture?.(key);
    rt.destroy?.();
    const texObj: any = texMgr?.get?.(key);
    const img: any = texObj?.getSourceImage?.() ?? texObj?.source?.[0]?.image ?? null;
    const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
    return { ok: !!w && !!h, reason: (!!w && !!h) ? "ok" : "no-out-img", key, w, h };
  } catch {
    return { ok: false, reason: "exception", key, w: 0, h: 0 };
  }
}


function _fmtPropAuraRenderLog(d: {
  comp: string;
  auraUrl: string;
  auraTk: string;

  anchorR: number; anchorC: number;
  focusR: number; focusC: number;

  wTiles: number; hTiles: number;
  baseRefRow: number; baseRefCol: number;

  auraX: number; auraY: number;
  auraOnCam: boolean | null;

  depth: number;
  propDepth: number | null;
  scale: number;
  forcedFront: boolean;

  idxAura: number | null;
  idxProp: number | null;

  child0Frame: any;
  child0Alpha: number | null;
  child0Visible: boolean | null;
}): string {
  const lines: string[] = [];

  lines.push(
    `[PROPAURA][RENDER] comp="${d.comp}"` +
    ` auraTk="${d.auraTk}"` +
    ` png="${d.auraUrl}"` +
    ` anchor(r=${d.anchorR},c=${d.anchorC})` +
    ` focus(r=${d.focusR},c=${d.focusC})`
  );

  lines.push(
    `  tiles=${d.wTiles}x${d.hTiles}` +
    ` baseRef(row=${d.baseRefRow},col=${d.baseRefCol})` +
    ` frame0=${String(d.child0Frame)}` +
    ` child0(vis=${d.child0Visible},a=${d.child0Alpha})`
  );

  lines.push(
    `  auraXY(${d.auraX},${d.auraY}) onCam=${String(d.auraOnCam)}` +
    ` depth=${d.depth} propDepth=${d.propDepth}` +
    ` scale=${d.scale}` +
    ` forcedFront=${d.forcedFront}`
  );

  lines.push(
    `  displayIndex(aura=${d.idxAura}, prop=${d.idxProp})`
  );

  return lines.join("\n");
}


// ----------------------------------------------------------
// Family mapping from engine grid values
// ----------------------------------------------------------

function defaultTileValueToFamily(v: number): TileFamily | "" {
    // In HeroEngineInPhaser.ts:
    // const TILE_EMPTY = 0
    // const TILE_WALL  = 1
    // const TILE_BRIDGE = 2

    if (defaultTileValueIsWall(v)) {
        // walls → chasm rim family
        return "chasm_light";
    }

    // everything else → light-brown dirt
    return "ground_light";
}

function defaultTileValueIsWall(v: number): boolean {
    return v === 1 || v === 2;
}

function isChasmLikeFamily(family: TileFamily | ""): boolean {
    const s = String(family ?? "");
    return !!s && (s.includes("chasm") || s.includes("lava"));
}


// ----------------------------------------------------------
// Neighbor mask + AutoShape (Wang 9+4)
// ----------------------------------------------------------

/**
 * Compute an 8-way neighbor bitmask for a tile.
 *
 * Bits:
 *   bit 0 = N
 *   bit 1 = E
 *   bit 2 = S
 *   bit 3 = W
 *   bit 4 = NE
 *   bit 5 = SE
 *   bit 6 = SW
 *   bit 7 = NW
 */
function computeNeighborMask(
    grid: number[][],
    r: number,
    c: number,
    family: TileFamily,
    valueToFamily: (v: number) => TileFamily | ""
): number {
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;

    const same = (rr: number, cc: number): boolean => {
        // Clamp to the nearest valid cell (duplicate border values)
        if (rr < 0) rr = 0;
        else if (rr >= rows) rr = rows - 1;

        if (cc < 0) cc = 0;
        else if (cc >= cols) cc = cols - 1;

        return valueToFamily(grid[rr][cc]) === family;
    };


    let mask = 0;

    if (same(r - 1, c))     mask |= 1 << 0; // N
    if (same(r,     c + 1)) mask |= 1 << 1; // E
    if (same(r + 1, c))     mask |= 1 << 2; // S
    if (same(r,     c - 1)) mask |= 1 << 3; // W

    if (same(r - 1, c + 1)) mask |= 1 << 4; // NE
    if (same(r + 1, c + 1)) mask |= 1 << 5; // SE
    if (same(r + 1, c - 1)) mask |= 1 << 6; // SW
    if (same(r - 1, c - 1)) mask |= 1 << 7; // NW

    return mask;
}




export type InnerCornerShape =
    | "none"
    | "innerNE"
    | "innerNW"
    | "innerSE"
    | "innerSW";

/**
 * Decide if this tile should get an inner-corner overlay.
 * This assumes the base tile is already "center" (all N/E/S/W are true).
 *
 * We look at diagonals like:
 *   N && W && !NW => innerNW
 *   N && E && !NE => innerNE
 *   S && W && !SW => innerSW
 *   S && E && !SE => innerSE
 */
export function innerCornerFromMask(mask: number): InnerCornerShape {
    const n  = (mask & (1 << 0)) !== 0;
    const e  = (mask & (1 << 1)) !== 0;
    const s  = (mask & (1 << 2)) !== 0;
    const w  = (mask & (1 << 3)) !== 0;

    const ne = (mask & (1 << 4)) !== 0;
    const se = (mask & (1 << 5)) !== 0;
    const sw = (mask & (1 << 6)) !== 0;
    const nw = (mask & (1 << 7)) !== 0;

    // Only meaningful for "full" cardinals – interior-ish
    if (!(n && e && s && w)) {
        return "none";
    }

    // Check each concave corner: cardinal neighbors present, diagonal missing
    if (n && w && !nw) return "innerNW";
    if (n && e && !ne) return "innerNE";
    if (s && w && !sw) return "innerSW";
    if (s && e && !se) return "innerSE";

    return "none";
}



export function autoShapeFromMask(mask: number): AutoShape {
    const n  = (mask & (1 << 0)) !== 0;
    const e  = (mask & (1 << 1)) !== 0;
    const s  = (mask & (1 << 2)) !== 0;
    const w  = (mask & (1 << 3)) !== 0;

    const m4 =
        (n ? 1 : 0) |
        (e ? 2 : 0) |
        (s ? 4 : 0) |
        (w ? 8 : 0);

    switch (m4) {
        case 0: return "single";

        // Single neighbor – treat as a simple edge facing that neighbor
        case 1: return "edgeS"; // N only
        case 2: return "edgeW"; // E only
        case 4: return "edgeN"; // S only
        case 8: return "edgeE"; // W only

        // HACK: flipped 180° mapping (keep ONLY ONE mapping)
        // NE↔SW, NW↔SE
        case (1 | 2): return "cornerSW"; // N + E
        case (1 | 8): return "cornerSE"; // N + W
        case (2 | 4): return "cornerNW"; // E + S
        case (4 | 8): return "cornerNE"; // S + W

        // Two opposite neighbors – straight strips
        case (1 | 4): return "edgeW"; // N + S (vertical)
        case (2 | 8): return "edgeN"; // E + W (horizontal)

        // Three neighbors – classic edges (one side open)
        case (2 | 4 | 8): return "edgeN"; // no N
        case (1 | 2 | 8): return "edgeS"; // no S
        case (1 | 4 | 8): return "edgeE"; // no E
        case (1 | 2 | 4): return "edgeW"; // no W

        case (1 | 2 | 4 | 8): return "center";

        default: return "center";
    }
}


// ----------------------------------------------------------
// WorldTileRenderer
// ----------------------------------------------------------

export interface WorldTileRendererOptions {
    /** If true, enable detailed tile logging for this renderer instance. */
    debugLocal?: boolean;
    /**
     * Optional mapper from engine tile values → TileFamily.
     * If omitted, a simple default implementation is used.
     */
    tileValueToFamily?: (v: number) => TileFamily | "";
    /**
     * Optional predicate that marks which tile values are walls.
     * If omitted, a simple default implementation is used (v === 1 || v === 2).
     */
    tileValueIsWall?: (v: number) => boolean;
}

export class WorldTileRenderer {
  scene: Phaser.Scene;
  atlas: TileAtlas;
  opts: WorldTileRendererOptions;

  map: Phaser.Tilemaps.Tilemap | null = null;

  groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  chasmLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  chasmOverlayLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  decalLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  propLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // Tileset plumbing (multi-sheet)
  private _tilesetsAll: Phaser.Tilemaps.Tileset[] = [];
  private _firstGidByTextureKey: Record<string, number> = Object.create(null);
  private _gidRanges: Array<{ textureKey: string; firstGid: number; lastExclusive: number }> = [];
  private _lastGrid: number[][] | null = null;
  private _lastValueToFamily: ((v: number) => TileFamily | "") | null = null;
  private _lastValueIsWall: ((v: number) => boolean) | null = null;
  private _lastGridSig = 0;

  constructor(scene: Phaser.Scene, atlas: TileAtlas, opts: WorldTileRendererOptions) {
    this.scene = scene;
    this.atlas = atlas;
    this.opts = opts;

    // Make it easy for arcadeCompat.ts to find us
    try {
      (this.scene as any).registry?.set?.("__worldTileRenderer", this);
    } catch { /* ignore */ }
  }

  // ---- public helpers used by arcadeCompat ----

  /** Decode a tile index (gid) into {textureKey, frameIndex}. Returns null if unknown/empty. */
  decodeTileIndex(idx: number): { textureKey: string; frameIndex: number } | null {
    const gid = idx | 0;
    if (gid < 0) return null;

    for (let i = 0; i < this._gidRanges.length; i++) {
      const r = this._gidRanges[i];
      if (gid >= r.firstGid && gid < r.lastExclusive) {
        return { textureKey: r.textureKey, frameIndex: (gid - r.firstGid) | 0 };
      }
    }
    return null;
  }

  /** Build a compact, machine-readable snapshot of what's visually rendered. */
  getVisualAudit(): any {
    const map = this.map;
    const rows = map ? (map.height | 0) : 0;
    const cols = map ? (map.width | 0) : 0;

    const layerAudit = (layer: Phaser.Tilemaps.TilemapLayer | null, name: string): any => {
      if (!layer || rows <= 0 || cols <= 0) return null;
      const rles: string[] = [];
      let nonEmpty = 0;
      for (let r = 0; r < rows; r++) {
        let segs: string[] = [];
        let cur = -999999;
        let start = -1;
        for (let c = 0; c <= cols; c++) {
          const t = (c < cols) ? (layer.getTileAt(c, r) as any) : null;
          const gid = (t && typeof t.index === "number") ? (t.index | 0) : -1;
          if (gid !== cur) {
            if (cur >= 0 && start >= 0) {
              const end = (c - 1) | 0;
              segs.push(start === end ? `${start}=${cur}` : `${start}-${end}=${cur}`);
              nonEmpty += (end - start + 1) | 0;
            }
            cur = gid;
            start = (gid >= 0) ? (c | 0) : -1;
          }
        }
        if (segs.length) rles.push(`r${r}:${segs.join(",")}`);
      }
      return {
        name,
        depth: (layer as any).depth ?? null,
        visible: !!(layer as any).visible,
        alpha: (layer as any).alpha ?? null,
        nonEmpty,
        rows: rles.join("|"),
      };
    };

    const layerList: any[] = [];
    const g = layerAudit(this.groundLayer, "ground");
    const ch = layerAudit(this.chasmLayer, "chasm");
    const chO = layerAudit(this.chasmOverlayLayer, "chasmOverlay");
    const dec = layerAudit(this.decalLayer, "decals");
    const pr = layerAudit(this.propLayer, "props");
    if (g) layerList.push(g);
    if (ch) layerList.push(ch);
    if (chO) layerList.push(chO);
    if (dec) layerList.push(dec);
    if (pr) layerList.push(pr);

    const anyThis: any = this as any;
    const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || Object.create(null);
    const propKeys = Object.keys(instByAnchor);
    propKeys.sort();
    const props: any[] = [];
    const boundsOf = (o: any): any => {
      if (!o) return null;
      try {
        if (typeof o.getBounds === "function") {
          const b = o.getBounds();
          if (b) {
            return {
              x: (b.x ?? 0) | 0,
              y: (b.y ?? 0) | 0,
              w: (b.width ?? 0) | 0,
              h: (b.height ?? 0) | 0,
            };
          }
        }
      } catch { /* ignore */ }
      const w = (o.displayWidth ?? o.width ?? 0) | 0;
      const h = (o.displayHeight ?? o.height ?? 0) | 0;
      const x = ((o.x ?? 0) - (w >> 1)) | 0;
      const y = ((o.y ?? 0) - (h >> 1)) | 0;
      if ((w | 0) <= 0 && (h | 0) <= 0) return null;
      return { x, y, w, h };
    };
    const screenBoundsOf = (o: any): any => {
      const b = boundsOf(o);
      const cam: any = (this.scene as any)?.cameras?.main ?? null;
      if (!b || !cam) return null;
      const zoom = (typeof cam.zoom === "number" && cam.zoom > 0) ? cam.zoom : 1;
      const sx = ((b.x - (cam.scrollX ?? 0)) * zoom) | 0;
      const sy = ((b.y - (cam.scrollY ?? 0)) * zoom) | 0;
      const sw = (b.w * zoom) | 0;
      const sh = (b.h * zoom) | 0;
      return { x: sx, y: sy, w: sw, h: sh };
    };
    for (let i = 0; i < propKeys.length; i++) {
      const k = propKeys[i];
      const inst = instByAnchor[k];
      if (!inst) continue;
      const objs: any[] = Array.isArray(inst.objs) ? inst.objs : [];
      const overlays: any[] = Array.isArray(inst.overlayObjs) ? inst.overlayObjs : [];
      const auraCont: any = inst.focusAura ?? null;
      const auraKids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
      props.push({
        anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
        rawKey: String(inst.rawKey ?? ""),
        baseName: String(inst.baseName ?? ""),
        textureKey: String(inst.textureKey ?? ""),
        baseRef: { row: inst.baseRefRow | 0, col: inst.baseRefCol | 0 },
        wTiles: (inst.wTiles | 0) || 1,
        hTiles: (inst.hTiles | 0) || 1,
        offset: { x: (inst.offsetX | 0), y: (inst.offsetY | 0) },
        baseDepth: (inst.baseDepth | 0) || 0,
        state: String(inst.state ?? ""),
        objs: objs.map((o: any) => ({
          x: (o?.x ?? 0) | 0,
          y: (o?.y ?? 0) | 0,
          depth: (o?.depth ?? 0) | 0,
          tex: o?.texture?.key ?? null,
          frame: (o?.frame?.name ?? o?.frame?.index ?? null),
          vis: !!o?.visible,
          bounds: boundsOf(o),
          screenBounds: screenBoundsOf(o),
        })),
        overlays: overlays.map((o: any) => ({
          x: (o?.x ?? 0) | 0,
          y: (o?.y ?? 0) | 0,
          depth: (o?.depth ?? 0) | 0,
          tex: o?.texture?.key ?? null,
          frame: (o?.frame?.name ?? o?.frame?.index ?? null),
          vis: !!o?.visible,
          bounds: boundsOf(o),
          screenBounds: screenBoundsOf(o),
        })),
        aura: auraCont ? {
          depth: (auraCont?.depth ?? 0) | 0,
          vis: !!auraCont?.visible,
          alpha: (auraCont?.alpha ?? null),
          x: (auraCont?.x ?? 0) | 0,
          y: (auraCont?.y ?? 0) | 0,
          bounds: boundsOf(auraCont),
          screenBounds: screenBoundsOf(auraCont),
          kids: auraKids.map((k: any) => ({
            x: (k?.x ?? 0) | 0,
            y: (k?.y ?? 0) | 0,
            depth: (k?.depth ?? 0) | 0,
            tex: k?.texture?.key ?? null,
            frame: (k?.frame?.name ?? k?.frame?.index ?? null),
            vis: !!k?.visible,
            alpha: (k?.alpha ?? null),
            bounds: boundsOf(k),
            screenBounds: screenBoundsOf(k),
          })),
        } : null,
      });
    }

    return {
      rows,
      cols,
      tileSize: (this.atlas?.tileSize ?? 32) | 0,
      gidRanges: this._gidRanges.slice(0),
      layers: layerList,
      props,
    };
  }

setPropStateAt(anchorR: number, anchorC: number, state: string): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return false;

  const vis: any = inst.vis || null;
  const animDef: any = vis?.anim || null;
  const st = animDef?.states?.[state] || null;
  if (!st) return false;

  const textureKey = String(inst.textureKey || "");
  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? inst.sheetCols ?? 0) | 0;
  if (cols <= 0) return false;

  const baseRef = { row: (st.row | 0), col: (st.col | 0) };
  const wTiles = (inst.wTiles | 0) || 1;
  const hTiles = (inst.hTiles | 0) || 1;

  const byRc: any = inst.byRc || anyThis.__propTileInfoByRC || null;

  // Update all tiles in this prop instance (same placement order as sync)
  let objIdx = 0;
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((inst.anchorR | 0) - (hTiles - 1) + dy) | 0;
      const worldC = ((inst.anchorC | 0) + dx) | 0;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
      const frameIndex = (atlasRow * cols + atlasCol) | 0;

      const obj: any = inst.objs?.[objIdx++] ?? null;
      if (obj) {
        try { obj.anims?.stop?.(); } catch { /* ignore */ }
        try { obj.setFrame?.(frameIndex); } catch { /* ignore */ }
      }

      if (byRc) {
        byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex };
      }
    }
  }

  inst.baseRefRow = baseRef.row | 0;
  inst.baseRefCol = baseRef.col | 0;
  inst.state = state;

  return true;
}


setPropFrameAt(anchorR: number, anchorC: number, frameIndex: number): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return false;

  const textureKey = String(inst.textureKey || "");
  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? inst.sheetCols ?? 0) | 0;
  const rows = (info?.rows ?? 0) | 0;
  if (cols <= 0) return false;

  const tr = _tileRefFromFrameIndex(cols, frameIndex | 0);
  const baseRef = { row: tr.row | 0, col: tr.col | 0 };

  const wTiles = (inst.wTiles | 0) || 1;
  const hTiles = (inst.hTiles | 0) || 1;

  const byRc: any = inst.byRc || anyThis.__propTileInfoByRC || null;
  const texObj: any = this.scene?.textures?.get?.(textureKey) || null;
  const textureExists = !!this.scene?.textures?.exists?.(textureKey);
  const baseFrame: any = (texObj && typeof texObj.get === "function") ? texObj.get("__BASE") : null;
  const baseW = (baseFrame?.width ?? 0) | 0;
  const baseH = (baseFrame?.height ?? 0) | 0;
  const cropW = (cols > 0 && baseW > 0) ? (Math.floor(baseW / cols) | 0) : ((info?.tileSize ?? 0) | 0);
  const cropH = (rows > 0 && baseH > 0) ? (Math.floor(baseH / rows) | 0) : ((info?.tileSize ?? 0) | 0);
  const frameNameSet = new Set<string>();
  let maxNumericFrame = -1;
  let minNumericFrame = -1;
  let hasBaseFrame = false;
  try {
    const names: any[] = (texObj && typeof texObj.getFrameNames === "function") ? texObj.getFrameNames() : [];
    for (let i = 0; i < names.length; i++) {
      const nm = String(names[i] ?? "");
      if (!nm) continue;
      frameNameSet.add(nm);
      if (nm === "__BASE") hasBaseFrame = true;
      const n = parseInt(nm, 10);
      if (Number.isFinite(n) && String(n) === nm) {
        const ni = n | 0;
        maxNumericFrame = Math.max(maxNumericFrame, ni);
        minNumericFrame = (minNumericFrame < 0) ? ni : Math.min(minNumericFrame, ni);
      }
    }
  } catch { /* ignore */ }
  const hasFrame = (frame: any): boolean => {
    if (!textureExists) return false;
    if (frameNameSet.size <= 0) return false;
    const key = String(frame ?? "");
    return frameNameSet.has(key);
  };

  let objIdx = 0;
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((inst.anchorR | 0) - (hTiles - 1) + dy) | 0;
      const worldC = ((inst.anchorC | 0) + dx) | 0;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
      const fi = (atlasRow * cols + atlasCol) | 0;
      let safeFrame: any = fi;
      let safeFrameIndex = fi | 0;
      let canSetFrame = true;
      let canCrop = false;

      if (!hasFrame(safeFrame)) {
        if (maxNumericFrame >= 0) {
          const lo = (minNumericFrame >= 0) ? (minNumericFrame | 0) : 0;
          const hi = maxNumericFrame | 0;
          safeFrameIndex = Math.max(lo, Math.min(safeFrameIndex | 0, hi));
          safeFrame = safeFrameIndex;
        } else if (hasBaseFrame) {
          safeFrame = "__BASE";
          safeFrameIndex = 0;
        } else {
          safeFrame = 0;
          safeFrameIndex = 0;
        }

      }

      if (!hasFrame(safeFrame)) {
        canSetFrame = false;
        canCrop = (cropW > 0 && cropH > 0 && cols > 0 && rows > 0);
      }

      if (DEBUG_TILEMAP_GLUE) {
        const used = canSetFrame ? String(safeFrame) : "NONE";
        if (!canSetFrame && !canCrop) {
          console.warn(`[tileMapGlue][frameMissing] tex=${textureKey} want=${fi} use=${used}`);
        }
      }

      const obj: any = inst.objs?.[objIdx++] ?? null;
      if (obj) {
        try { obj.anims?.stop?.(); } catch { /* ignore */ }
        if (canSetFrame) {
          try { obj.setFrame?.(safeFrame); } catch { /* ignore */ }
        } else if (canCrop) {
          const cropX = (atlasCol * cropW) | 0;
          const cropY = (atlasRow * cropH) | 0;
          try { obj.setFrame?.("__BASE"); } catch { /* ignore */ }
          try { obj.setCrop?.(cropX, cropY, cropW, cropH); } catch { /* ignore */ }
          try { obj.setDisplaySize?.(cropW, cropH); } catch { /* ignore */ }
        }
      }

      if (byRc && (canSetFrame || canCrop)) {
        byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex: safeFrameIndex };
      }
    }
  }

  inst.baseRefRow = baseRef.row | 0;
  inst.baseRefCol = baseRef.col | 0;

  return true;
}



  /** Used by decor_applyTightOpaqueAabbToSolids to sample correct sheet+frame. */
/** Used by decor_applyTightOpaqueAabbToSolids to sample correct sheet+frame. */
tryGetPropTileInfoAt(r: number, c: number): { textureKey: string; frameIndex: number } | null {
  const anyThis: any = this as any;

  // Preferred: props rendered as images → consult stamped lookup
  const byRc: any = anyThis.__propTileInfoByRC || null;
  if (byRc) {
    const k = String((r | 0)) + "," + String((c | 0));
    const hit = byRc[k];
    if (hit && typeof hit.textureKey === "string" && typeof hit.frameIndex === "number") {
      return { textureKey: hit.textureKey, frameIndex: hit.frameIndex | 0 };
    }
  }

  // Fallback (legacy): if props were ever rendered into a tile layer.
  if (!this.propLayer) return null;
  const tile: any = (this.propLayer as any).getTileAt?.((c | 0), (r | 0), false) ?? null;
  const idx = tile && typeof tile.index === "number" ? (tile.index | 0) : -1;
  if (idx < 0) return null;
  return this.decodeTileIndex(idx);
}



/** Return the Phaser display object for the prop occupying tile r,c (best-effort). */
tryGetPropDisplayAt(r: number, c: number): any | null {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return null;

  const k0 = String((r | 0)) + "," + String((c | 0));

  let inst: any = instByAnchor[k0] || null;
  if (!inst) {
    const anchorByRc: any = anyThis.__propAnchorKeyByRC || null;
    const ak = anchorByRc ? anchorByRc[k0] : null;
    if (ak) inst = instByAnchor[ak] || null;
  }

  if (!inst) return null;

  // Prefer the animated anchor cell sprite if present; else first tile image.
  const objs: any[] = inst.objs || [];
  return (objs && objs.length) ? (objs[0] || null) : null;
}

/** Return all Phaser display objects for the prop at anchor tile r,c (best-effort). */
tryGetPropDisplaysAtAnchor(anchorR: number, anchorC: number): any[] | null {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return null;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return null;

  const objs: any[] | null = Array.isArray(inst.objs) ? inst.objs : null;
  return (objs && objs.length) ? objs : null;
}

/**
 * Show/hide a prop's optional overlay at tile r,c.
 *
 * Returns true if an overlay existed and was updated.
 */
setPropOverlayAt(r: number, c: number, active: boolean, opts?: PropOverlayOpts): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k0 = String((r | 0)) + "," + String((c | 0));

  let inst: any = instByAnchor[k0] || null;
  if (!inst) {
    const anchorByRc: any = anyThis.__propAnchorKeyByRC || null;
    const ak = anchorByRc ? anchorByRc[k0] : null;
    if (ak) inst = instByAnchor[ak] || null;
  }

  if (!inst) return false;
  const objs: any[] = Array.isArray(inst.overlayObjs) ? inst.overlayObjs : [];
  if (!objs.length) return false;

  const alphaBase = (typeof inst.overlayAlphaDefault === "number") ? inst.overlayAlphaDefault : 1;
  const tintBase = (typeof inst.overlayTintDefault === "number") ? inst.overlayTintDefault : null;
  const blendBase = (inst.overlayBlendModeDefault != null) ? inst.overlayBlendModeDefault : null;

  const alpha = (opts && typeof opts.alpha === "number") ? opts.alpha : alphaBase;
  const tint = (opts && typeof opts.tint === "number") ? opts.tint : tintBase;
  const blendModeRaw = (opts && opts.blendMode != null) ? opts.blendMode : blendBase;
  const blendFallback = (((Phaser as any)?.BlendModes?.NORMAL ?? 0) | 0);
  const blendResolved =
    (blendModeRaw != null)
      ? _resolveAuraBlendMode(blendModeRaw, blendFallback)
      : blendFallback;

  for (let i = 0; i < objs.length; i++) {
    const obj: any = objs[i];
    try { obj.setVisible?.(active); } catch { /* ignore */ }
    if (active) {
      try { obj.setAlpha?.(alpha); } catch { /* ignore */ }
      if (tint != null) {
        try { obj.setTint?.(tint); } catch { /* ignore */ }
      } else {
        try { obj.clearTint?.(); } catch { /* ignore */ }
      }
      try { obj.setBlendMode?.(blendResolved); } catch { /* ignore */ }
    }
  }

  inst.overlayActive = !!active;
  return true;
}


/**
 * Show/hide the prop's pre-baked focus aura (outline) at tile r,c.
 *
 * Returns true if an aura existed and was updated.
 */


setPropFocusAuraAt(r: number, c: number, active: boolean, radius: number, depthBias: number, opts?: PropFocusAuraOpts): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k0 = String((r | 0)) + "," + String((c | 0));

  let inst: any = instByAnchor[k0] || null;
  if (!inst) {
    const anchorByRc: any = anyThis.__propAnchorKeyByRC || null;
    const ak = anchorByRc ? anchorByRc[k0] : null;
    if (ak) inst = instByAnchor[ak] || null;
  }

    if (!inst) return false;
  const now = Date.now();
  const overrideEnabled =
    DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
    String(inst.baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "");
  if (DEBUG_PROP_FOCUS_AURA_TRACE) {
    try {
      if (String(inst.baseName || "") === "chest") {
        if (active) {
          (inst as any).__loggedChestTraceInactive = 0;
          if (!(inst as any).__loggedChestTraceActive) {
            (inst as any).__loggedChestTraceActive = 1;
            console.log(`[PROPAURA][CHEST-TRACE] ${JSON.stringify({
              anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
              active,
              override: overrideEnabled,
              radius: radius | 0,
              depthBias: depthBias | 0
            })}`);
          }
        } else {
          (inst as any).__loggedChestTraceActive = 0;
          if (!(inst as any).__loggedChestTraceInactive) {
            (inst as any).__loggedChestTraceInactive = 1;
            console.log(`[PROPAURA][CHEST-TRACE] ${JSON.stringify({
              anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
              active,
              override: overrideEnabled,
              radius: radius | 0,
              depthBias: depthBias | 0
            })}`);
          }
        }
      }
    } catch { /* ignore */ }
  }

    try {
      const baseName = String(inst.baseName ?? "");
      if (active && baseName === "chest" && !(inst as any).__loggedChestAuraState) {
        (inst as any).__loggedChestAuraState = 1;
        if (DEBUG_PROP_FOCUS_AURA_LOGS) {
          const kids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
          const k0: any = kids.length ? kids[0] : null;
          console.log(`[PROPAURA][CHEST-STATE] ${JSON.stringify({
            baseName,
            rawKey: inst.rawKey ?? "",
            visPadAlways: !!(inst.vis as any)?.focusAuraPadAlways || !!(inst.vis as any)?.auraPadAlways,
            visPadPx: (inst.vis as any)?.focusAuraPadPx ?? (inst.vis as any)?.auraPadPx ?? null,
            kids: kids.length,
            padBaked: !!(k0 as any)?.__auraPadBaked,
            padScale: (typeof (k0 as any)?.__auraPadScale === "number") ? (k0 as any).__auraPadScale : null
          })}`);
        }
      }
      if (active && baseName === "chest" && !(inst as any).__forceChestAuraRebuild) {
        (inst as any).__forceChestAuraRebuild = 1;
        const rebuilt = this._propRebuildFocusAuraForInstance(inst);
        if (DEBUG_PROP_FOCUS_AURA_LOGS) {
          console.log(`[PROPAURA][CHEST-REBUILD] ${JSON.stringify({
            baseName,
            rawKey: inst.rawKey ?? "",
            rebuilt
          })}`);
        }
      }
      if (DEBUG_PROP_FOCUS_AURA_FORCE_VISIBLE_NAMES.has(baseName) && !active) {
        active = true;
        if (!(inst as any).__loggedFocusAuraForceVisible) {
          (inst as any).__loggedFocusAuraForceVisible = 1;
          if (DEBUG_PROP_FOCUS_AURA_LOGS) {
            console.log(`[PROPAURA][FORCE-VISIBLE] ${JSON.stringify({
              baseName,
              rawKey: inst.rawKey ?? "",
              anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
            })}`);
          }
        }
      }
    } catch { /* ignore */ }
  
    if (PROP_FOCUS_AURA_CACHE_STATE) {
      try {
        const cache = anyThis.__propFocusAuraState || (anyThis.__propFocusAuraState = Object.create(null));
      const anchorKey = String((inst.anchorR | 0)) + "," + String((inst.anchorC | 0));
      if (active) {
        cache[anchorKey] = {
          active: true,
          r: (inst.anchorR | 0),
          c: (inst.anchorC | 0),
          radius: (radius | 0),
          depthBias: (depthBias | 0),
        };
      } else {
        delete cache[anchorKey];
      }
    } catch { /* ignore */ }
  }

  if (!PROP_FOCUS_AURA_USE_TILED) {
    const objs: any[] = Array.isArray(inst.objs) ? inst.objs : [];
    if (!objs.length) return false;

    const isActive = !!active;
    const tint = (opts && typeof opts.tint === "number") ? (opts.tint | 0) : null;
    const auraAlpha = isActive ? _propFocusAuraPulseAlpha(this.scene, now, opts) : 0;
    const blendFallback = (((Phaser as any)?.BlendModes?.NORMAL ?? 0) | 0);
    const blendResolved = _resolveAuraBlendMode(opts?.blendMode, blendFallback);

    let updated = false;
    for (let i = 0; i < objs.length; i++) {
      const propObj: any = objs[i];
      if (!propObj) continue;
      updated = true;
      if (!isActive) {
        try { (propObj as any).__propOutlineOverrideActive = 0; } catch { /* ignore */ }
        heroAnimGlue.syncOutlineForNative(propObj, false, 1, radius, depthBias);
        continue;
      }

      try { (propObj as any).__propOutlineOverrideActive = 1; } catch { /* ignore */ }
      heroAnimGlue.syncOutlineForNative(propObj, true, 1, radius, depthBias);

      const outlineImg: any = (propObj as any).__focusOutlineImage;
      if (outlineImg && outlineImg.scene) {
        try { outlineImg.setAlpha?.(auraAlpha); } catch { /* ignore */ }
        if (tint != null) {
          try { outlineImg.setTint?.(tint); } catch { /* ignore */ }
        }
        try { outlineImg.setBlendMode?.(blendResolved); } catch { /* ignore */ }
      }
    }

    return updated;
  }

  // Snap aura children to the prop's actual rendered position (fixes misaligned focus auras).
  if (active) {
    const objs: any[] = Array.isArray(inst.objs) ? inst.objs : [];
    const baseObj: any = objs.length ? objs[0] : null;
    const kids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
    let baseX = (baseObj?.x ?? inst.focusAura?.x ?? 0) | 0;
    let baseY = (baseObj?.y ?? inst.focusAura?.y ?? 0) | 0;
    if (baseObj && typeof baseObj.getBounds === "function") {
      try {
        const bb = baseObj.getBounds();
        if (bb && Number.isFinite(bb.x) && Number.isFinite(bb.y)) {
          baseX = ((bb.x + (bb.width ?? 0) / 2) | 0);
          baseY = ((bb.y + (bb.height ?? 0) / 2) | 0);
        }
      } catch { /* ignore */ }
    }
    const layers: any[] = Array.isArray(inst.focusAuraLayers) ? inst.focusAuraLayers : [];
    const allKids: any[] = [];
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      if (layer?.cont) {
        try { layer.cont.x = baseX | 0; layer.cont.y = baseY | 0; } catch { /* ignore */ }
      }
      const lk: any[] = Array.isArray(layer?.children) ? layer.children : [];
      for (let ki = 0; ki < lk.length; ki++) allKids.push(lk[ki]);
    }
    if (!allKids.length) allKids.push(...kids);
    for (let i = 0; i < allKids.length; i++) {
      const k: any = allKids[i];
      if (!k) continue;
      const dx = (k as any).__auraLocalDx;
      const dy = (k as any).__auraLocalDy;
      if (typeof dx === "number" && typeof dy === "number") {
        k.x = (baseX + (dx | 0)) | 0;
        k.y = (baseY + (dy | 0)) | 0;
      }
    }
    if (inst.focusAura) {
      try { inst.focusAura.x = baseX | 0; inst.focusAura.y = baseY | 0; } catch { /* ignore */ }
    }
  }

  let layers: any[] = Array.isArray(inst.focusAuraLayers) ? inst.focusAuraLayers : [];
  if (!layers.length) {
    const fallbackKids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
    if (inst.focusAura || fallbackKids.length) {
      layers = [{
        cont: inst.focusAura || null,
        children: fallbackKids,
        baseScale: inst.focusAuraBaseScale ?? PROP_FOCUS_AURA_BASE_SCALE,
        radius: PROP_FOCUS_AURA_RADIUS
      }];
    }
  }
  if (!layers.length) return false;

  const primary = layers[0] || null;
  const cont: any = primary?.cont ?? null;
  const children: any[] = Array.isArray(primary?.children) ? primary.children : [];
  const allChildren: any[] = [];
  for (let i = 0; i < layers.length; i++) {
    const kids: any[] = Array.isArray(layers[i]?.children) ? layers[i].children : [];
    for (let k = 0; k < kids.length; k++) allChildren.push(kids[k]);
  }

  try {
    if (active && inst?.vis && ((inst.vis as any).focusAuraPadAlways || (inst.vis as any).auraPadAlways)) {
      const k0: any = (children && children.length) ? children[0] : null;
      const padBaked = !!(k0 as any)?.__auraPadBaked;
      const padScale = (typeof (k0 as any)?.__auraPadScale === "number") ? (k0 as any).__auraPadScale : 1;
      const needsRebuild = !children.length || (!padBaked && padScale <= 1.01);
      if (needsRebuild) {
        const rebuilt = this._propRebuildFocusAuraForInstance(inst);
        if (rebuilt && !(inst as any).__loggedFocusAuraRebuild) {
          (inst as any).__loggedFocusAuraRebuild = 1;
          if (DEBUG_PROP_FOCUS_AURA_LOGS) {
            console.log(`[PROPAURA][REBUILD] ${JSON.stringify({
              baseName: inst.baseName ?? "",
              rawKey: inst.rawKey ?? "",
              padBaked,
              padScale
            })}`);
          }
        }
      }
    }
    if (DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled && String(inst.baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "")) {
      const key = `${DEBUG_PROP_FOCUS_AURA_OVERRIDE.auraTextureKey}::${DEBUG_PROP_FOCUS_AURA_OVERRIDE.frameIndex}`;
      if ((inst as any).__dbgAuraOverrideKey !== key) {
        (inst as any).__dbgAuraOverrideKey = key;
        const rebuilt = this._propRebuildFocusAuraForInstance(inst);
        if (DEBUG_PROP_FOCUS_AURA_LOGS) {
          console.log(`[PROPAURA][OVERRIDE-REBUILD] ${JSON.stringify({
            baseName: inst.baseName ?? "",
            rawKey: inst.rawKey ?? "",
            key,
            rebuilt
          })}`);
        }
      }
    }
  } catch { /* ignore */ }

  if (!cont && children.length === 0) return false;

  // Hide
  if (!active) {
    const lastActive = (inst as any).__focusAuraLastActiveTime ?? 0;
    const hideTimer = (inst as any).__focusAuraHideTimer ?? null;
    if (lastActive && now - lastActive < PROP_FOCUS_AURA_HIDE_DELAY_MS) {
      if (!hideTimer) {
        (inst as any).__focusAuraHideTimer = (setTimeout(() => {
          try {
            this.setPropFocusAuraAt(inst.anchorR, inst.anchorC, false, 0, 0);
          } catch { /* ignore */ }
          (inst as any).__focusAuraHideTimer = null;
        }, PROP_FOCUS_AURA_HIDE_DELAY_MS) as any);
      }
      return true;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      (inst as any).__focusAuraHideTimer = null;
    }
    try {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        layer?.cont?.setVisible?.(false);
        const kids: any[] = Array.isArray(layer?.children) ? layer.children : [];
        for (let k = 0; k < kids.length; k++) kids[k]?.setVisible?.(false);
      }
    } catch { /* ignore */ }

    // Also hide the debug marker (if we created one)
    try {
      const mk: any = inst.__dbgAuraWorldMarker || null;
      if (mk) mk.setVisible(false);
    } catch { /* ignore */ }
    try { (inst as any).__loggedFocusAuraName = 0; } catch { /* ignore */ }
    try { (inst as any).__loggedFocusAuraMulti = 0; } catch { /* ignore */ }

    return true;
  }

  const pulseLayers = _propFocusAuraPulseLayers(this.scene, now, opts);
  const maxRad = Math.max(1, (radius | 0));
  const tileSize = (this.atlas?.tileSize ?? 32) | 0;

  const baseDepth = (inst.baseDepth | 0);
  let depth = ((baseDepth - (PROP_FOCUS_AURA_DEPTH_BEHIND_PROP | 0) + (depthBias | 0)) | 0);

  const propObj: any = (Array.isArray(inst.objs) && inst.objs.length) ? inst.objs[0] : null;
  const propDepth = (propObj && typeof propObj.depth === "number") ? (propObj.depth | 0) : null;

  if (DEBUG_PROP_FOCUS_AURA_FORCE_FRONT) {
    depth = (propDepth != null)
      ? ((propDepth + (DEBUG_PROP_FOCUS_AURA_FORCE_FRONT_BUMP | 0)) | 0)
      : (DEBUG_PROP_FOCUS_AURA_FORCE_FRONT_BUMP | 0);
  }

  // mark last active time for hide delay
  (inst as any).__focusAuraLastActiveTime = now;
  const hideTimer = (inst as any).__focusAuraHideTimer ?? null;
  if (hideTimer) {
    clearTimeout(hideTimer);
    (inst as any).__focusAuraHideTimer = null;
  }

  if (DEBUG_PROP_FOCUS_AURA_BLINK && allChildren.length) {
    // Blink for 1 second so visibility stays obvious even if depth is wrong
    try {
      const blinkEvt = (inst as any).__focusAuraBlinkEvt;
      if (blinkEvt) {
        blinkEvt.remove?.(false);
      }
      let toggles = 0;
      const evt = this.scene.time?.addEvent?.({
        delay: 150,
        repeat: 6,
        callback: () => {
          toggles++;
          const on = (toggles % 2) === 1;
          for (let i = 0; i < allChildren.length; i++) {
            const ch: any = allChildren[i];
            ch?.setAlpha?.(on ? 1 : 0.4);
          }
        }
      });
      (inst as any).__focusAuraBlinkEvt = evt;
    } catch { /* ignore */ }
  }

  const wasVisible = !!cont?.visible;

  const isChest = (String(inst.baseName || "") === "chest");
  const tint = (opts && typeof opts.tint === "number") ? (opts.tint | 0) : null;

  try {
    if (DEBUG_PROP_FOCUS_AURA_LOGS && !(inst as any).__loggedFocusAuraName) {
      (inst as any).__loggedFocusAuraName = 1;
      console.log(`[PROPAURA][FOCUS-NAME] ${JSON.stringify({
        baseName: inst.baseName ?? "",
        rawKey: inst.rawKey ?? "",
        anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
        tiles: { w: inst.wTiles | 0, h: inst.hTiles | 0 },
        textureKey: inst.textureKey ?? "",
        auraTextureKey: inst.focusAuraTextureKey ?? "",
        frameIndices: inst.focusAuraFrameIndices ?? null
      })}`);
    }
  } catch { /* ignore */ }

  const defaultBlend =
    ((Phaser as any)?.BlendModes?.LIGHTEN ??
      (Phaser as any)?.BlendModes?.SCREEN ??
      (Phaser as any)?.BlendModes?.NORMAL ??
      0);
  const blendMode = _resolveAuraBlendMode(opts?.blendMode, defaultBlend | 0);
  const blendNormal = ((Phaser as any)?.BlendModes?.NORMAL ?? blendMode) | 0;

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    if (!layer) continue;
    const layerRadius = (layer.radius ?? PROP_FOCUS_AURA_RADIUS) | 0;
    const showLayer = layerRadius <= (maxRad | 0);
    const layerChildren: any[] = Array.isArray(layer.children) ? layer.children : [];
    const layerCont: any = layer.cont ?? null;

    if (!showLayer) {
      try { layerCont?.setVisible?.(false); } catch { /* ignore */ }
      for (let k = 0; k < layerChildren.length; k++) {
        layerChildren[k]?.setVisible?.(false);
      }
      continue;
    }

    const baseLayerAlpha = _propFocusAuraLayerAlpha(layerRadius);
    let pulseMul = 1;
    if ((layerRadius | 0) === 2) pulseMul = pulseLayers.r2;
    else if ((layerRadius | 0) === 3) pulseMul = pulseLayers.r3;
    const layerAlpha = Math.min(1, baseLayerAlpha * pulseMul);
    const layerScale = Math.max(
      0.01,
      (layer.baseScale ?? PROP_FOCUS_AURA_BASE_SCALE) + (layerRadius * PROP_FOCUS_AURA_RADIUS_SCALE)
    );
    const layerDepth = ((depth - (li | 0)) | 0);

    try {
      layerCont?.setVisible?.(true);
      layerCont?.setDepth?.(layerDepth);
      layerCont?.setAlpha?.(layerAlpha);
    } catch { /* ignore */ }

    if (CHEST_AURA_FORCE_PAD && isChest && li === 0 && layerChildren.length) {
      try {
        const padKey = _ensureChestAuraPadTexture(this.scene, tileSize, CHEST_AURA_PAD_PX);
        const ch: any = layerChildren[0];
        ch?.setTexture?.(padKey);
        ch?.setFrame?.("__BASE");
        ch?.setDisplaySize?.(tileSize + CHEST_AURA_PAD_PX * 2, tileSize + CHEST_AURA_PAD_PX * 2);
        (ch as any).__auraPadBaked = true;
        (ch as any).__auraPadMode = "box";
        (ch as any).__auraPadTexKey = padKey;
        (ch as any).__auraPadScale = 1;
      } catch { /* ignore */ }
    }

    const layerTint = (typeof tint === "number")
      ? tint
      : (PROP_FOCUS_AURA_LAYER_TINT[(layerRadius | 0) - 1] ?? 0xffffff);
    const layerBlend = ((layerRadius | 0) >= 2) ? blendNormal : blendMode;

    if (layerChildren.length) {
      try {
        for (let i = 0; i < layerChildren.length; i++) {
          const ch: any = layerChildren[i];
          if (!ch) continue;
          const isMulti = ((inst.wTiles | 0) > 1 || (inst.hTiles | 0) > 1);
          const isEdge = !!(ch as any).__auraIsEdge;
          const padScale = (typeof (ch as any).__auraPadScale === "number") ? (ch as any).__auraPadScale : 1;
          const padBaked = !!(ch as any).__auraPadBaked;
          let finalScale = padBaked ? layerScale : ((padScale > layerScale) ? padScale : layerScale);
          if (isMulti && finalScale > 1 && !isEdge) {
            // Avoid overlaps between adjacent aura tiles on multi-tile props; keep padding on perimeter.
            finalScale = 1;
          }
          if (isChest) {
            try { ch.setOrigin?.(0.5, 0.5); } catch { /* ignore */ }
          }
          ch.setVisible?.(true);
          ch.setScale?.(finalScale);
          const trimMask: any = (ch as any).__auraTrimMask;
          if (trimMask) {
            const trim = (ch as any).__auraTrim || { left: 0, right: 0, top: 0, bottom: 0 };
            const baseTile = (ch as any).__auraTrimTile ?? tileSize;
            const maskW = Math.max(1, (baseTile - (trim.left | 0) - (trim.right | 0)) * finalScale);
            const maskH = Math.max(1, (baseTile - (trim.top | 0) - (trim.bottom | 0)) * finalScale);
            const maskX = (ch.x ?? 0) - (baseTile * finalScale) / 2 + ((trim.left | 0) * finalScale);
            const maskY = (ch.y ?? 0) - (baseTile * finalScale) / 2 + ((trim.top | 0) * finalScale);
            try { trimMask.clear(); } catch { /* ignore */ }
            try { trimMask.fillStyle(0xffffff, 1); } catch { /* ignore */ }
            try { trimMask.fillRect(maskX, maskY, maskW, maskH); } catch { /* ignore */ }
            try { trimMask.setVisible(false); } catch { /* ignore */ }
          }
          ch.setDepth?.(layerDepth);
          ch.setAlpha?.(layerAlpha);
          try { ch.setBlendMode?.(layerBlend); } catch { /* ignore */ }
          if (!isChest && layerTint != null) {
            try { ch.setTint?.(layerTint); } catch { /* ignore */ }
            try { ch.setStrokeStyle?.(2, layerTint, 1); } catch { /* ignore */ }
          } else if (!isChest) {
            try { ch.clearTint?.(); } catch { /* ignore */ }
            try { ch.setStrokeStyle?.(2, 0xffffff, 1); } catch { /* ignore */ }
          }
          if (isChest) {
            try { ch.setTint?.(0xffffff); } catch { /* ignore */ }
            try { ch.setBlendMode?.((Phaser as any).BlendModes?.ADD ?? 1); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    }
  }

    if (DEBUG_PROP_FOCUS_AURA_VERBOSE) {
      try {
        if (String(inst.baseName || "") === "chest") {
          const child0: any = children.length ? children[0] : null;
          const overrideEnabled =
            DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
            String(inst.baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "");
          console.log(`[PROPAURA][CHEST-COMPARE] ${JSON.stringify({
            mode: overrideEnabled ? "override" : "normal",
            padMode: child0?.__auraPadMode ?? null,
            padTexKey: child0?.__auraPadTexKey ?? null,
            childFrame: child0?.frame?.name ?? null,
            displayW: child0?.displayWidth ?? null,
            displayH: child0?.displayHeight ?? null,
            scaleX: child0?.scaleX ?? null,
            scaleY: child0?.scaleY ?? null,
            hasChildren: !!children.length,
            depth
          })}`);
        }
      } catch { /* ignore */ }
    }

    try {
      const overrideEnabled =
        DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
        String(inst.baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "");
      const overrideTarget = overrideEnabled ? (anyThis as any).__dbgAuraOverrideTarget : null;
      const hasTarget = overrideTarget && typeof overrideTarget.r === "number" && typeof overrideTarget.c === "number";
      const tileSize = (this.atlas?.tileSize ?? 32) | 0;
      if (overrideEnabled && allChildren.length) {
        const dx = hasTarget ? ((overrideTarget.c | 0) - (inst.anchorC | 0)) * tileSize : 0;
        const dy = hasTarget ? ((overrideTarget.r | 0) - (inst.anchorR | 0)) * tileSize : 0;
        for (let i = 0; i < allChildren.length; i++) {
          const ch: any = allChildren[i];
          if (!ch) continue;
          if (!ch.__dbgAuraBasePos) {
            ch.__dbgAuraBasePos = { x: ch.x, y: ch.y };
          }
          const base = ch.__dbgAuraBasePos;
          if (hasTarget) {
            ch.x = (base.x + dx);
            ch.y = (base.y + dy);
          } else {
            ch.x = base.x;
            ch.y = base.y;
          }
        }
        if (hasTarget && !(inst as any).__loggedOverridePos) {
          (inst as any).__loggedOverridePos = 1;
          console.log(`[PROPAURA][OVERRIDE-POS] ${JSON.stringify({
            baseName: inst.baseName ?? "",
            anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
            target: { r: overrideTarget.r | 0, c: overrideTarget.c | 0 },
            delta: { x: dx | 0, y: dy | 0 }
          })}`);
        }
      }
    } catch { /* ignore */ }

    try {
      if (DEBUG_PROP_FOCUS_AURA_TRACE && active && String(inst.baseName || "") === "chest" && !(inst as any).__loggedChestFinal) {
        (inst as any).__loggedChestFinal = 1;
        const child0: any = (children && children.length) ? children[0] : null;
        const propObj: any = (Array.isArray(inst.objs) && inst.objs.length) ? inst.objs[0] : null;
        console.log(`[PROPAURA][CHEST-FINAL] ${JSON.stringify({
          baseName: inst.baseName ?? "",
          rawKey: inst.rawKey ?? "",
          auraTexKey: inst.focusAuraTextureKey ?? "",
          childTexKey: child0?.texture?.key ?? null,
          childFrame: child0?.frame?.name ?? null,
          childW: child0?.displayWidth ?? null,
          childH: child0?.displayHeight ?? null,
          scale: { x: child0?.scaleX ?? null, y: child0?.scaleY ?? null },
          depth,
          padMode: child0?.__auraPadMode ?? null,
          padTexKey: child0?.__auraPadTexKey ?? null,
          propW: propObj?.displayWidth ?? null,
          propH: propObj?.displayHeight ?? null,
          propDepth: (propObj as any)?.depth ?? null
        })}`);
        try {
          const padKey = child0?.__auraPadTexKey ?? null;
          if (padKey) {
            const stats = _dbgTextureAlphaStats(this.scene, padKey);
            console.log(`[PROPAURA][CHEST-ALPHA] ${JSON.stringify({
              padTexKey: padKey,
              stats
            })}`);
          } else {
            console.log(`[PROPAURA][CHEST-ALPHA] ${JSON.stringify({
              padTexKey: null,
              stats: { ok: false, reason: "no-pad-tex" }
            })}`);
          }
        } catch { /* ignore */ }
        try {
          if (!(inst as any).__loggedChestOffscreen) {
            (inst as any).__loggedChestOffscreen = 1;
            const texKey = child0?.texture?.key ?? null;
            const frameName = child0?.frame?.name ?? null;
            const off = (texKey ? _dbgOffscreenAuraPixel(this.scene, texKey, frameName) : { ok: false, error: "no-tex-key" });
            console.log(`[PROPAURA][CHEST-OFFSCREEN] ${JSON.stringify({
              texKey,
              frameName,
              off
            })}`);
            if (!off.ok && !(inst as any).__loggedChestOffscreenSnapshot) {
              (inst as any).__loggedChestOffscreenSnapshot = 1;
              if (texKey) _dbgOffscreenAuraPixelSnapshot(this.scene, texKey, frameName);
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

  if (DEBUG_PROP_FOCUS_AURA_PIN_SCREEN) {
    try {
      if (allChildren.length) {
        for (let i = 0; i < allChildren.length; i++) {
          allChildren[i]?.setScrollFactor?.(0, 0);
          allChildren[i]?.setPosition?.(80, 80);
          allChildren[i]?.setScale?.(2);
          allChildren[i]?.setDepth?.(9999999);
        }
      }
    } catch { /* ignore */ }
    try {
      cont?.setScrollFactor?.(0, 0);
      cont?.setPosition?.(80, 80);
      cont?.setAlpha?.(1);
      cont?.setDepth?.(9999999);
    } catch { /* ignore */ }
  }


// --- DEBUG: make world aura impossible to miss ---
  if (DEBUG_PROP_FOCUS_AURA_NEON) {
    try {
      const kids: any[] = allChildren.length ? allChildren : ((cont?.list ?? []) as any[]);
      for (let i = 0; i < kids.length; i++) {
      const ch: any = kids[i];
      if (!ch) continue;
      ch.setAlpha?.(0.9);
      ch.setTint?.(0x00ff00); // neon green
      ch.setBlendMode?.((Phaser as any).BlendModes?.ADD ?? 1);
      if (DEBUG_PROP_FOCUS_AURA_PIN_SCREEN) {
        ch.setScrollFactor?.(0, 0);
      }
      }
    } catch { /* ignore */ }
  }

  if (DEBUG_PROP_FOCUS_AURA_PROP_TINT && propObj) {
    try {
      propObj.setTint?.(0xff00ff);
    } catch { /* ignore */ }
  }

// --- DEBUG: world-space marker at exact aura position ---
if (DEBUG_PROP_FOCUS_AURA_WORLD_MARKER) {
  try {
    let mk: any = inst.__dbgAuraWorldMarker || null;
    if (!mk) {
      mk = this.scene.add.rectangle(0, 0, 40, 40, 0xff00ff, 1);
      mk.setOrigin(0.5, 0.5);
      mk.setBlendMode?.((Phaser as any).BlendModes?.ADD ?? 1);
      inst.__dbgAuraWorldMarker = mk;
    }
    if (DEBUG_PROP_FOCUS_AURA_PIN_SCREEN) {
      mk.setScrollFactor?.(0, 0);
      mk.x = 80;
      mk.y = 80;
      mk.setDepth?.(99999999);
    } else {
      const child0: any = (children && children.length) ? children[0] : null;
      mk.x = (propObj?.x ?? child0?.x ?? cont?.x ?? 0);
      mk.y = (propObj?.y ?? child0?.y ?? cont?.y ?? 0);
    }
    mk.setDepth((depth + 5) | 0);
    mk.setVisible(true);
  } catch { /* ignore */ }
}

// --- DEBUG: camera status line (very telling) ---
  if (DEBUG_PROP_FOCUS_AURA_VERBOSE) {
    try {
      console.log(`[PROPAURA][CAM] ${_dbgCameraRenderStatus(this.scene, cont)}`);
    } catch { /* ignore */ }
  }


  if (DEBUG_PROP_FOCUS_AURA_VERBOSE) {
    try {
      const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
      const child0: any = (kids && kids.length) ? kids[0] : null;

      const cam: any = (this.scene as any)?.cameras?.main ?? null;

      console.log(
        `[PROPAURA][STATE] cont vis=${cont.visible} a=${cont.alpha} depth=${cont.depth} camFilter=${(cont as any).cameraFilter ?? "?"} ` +
        `child0 vis=${child0?.visible ?? "?"} a=${child0?.alpha ?? "?"} depth=${child0?.depth ?? "?"} ` +
        `camFilter=${(child0 as any)?.cameraFilter ?? "?"} scroll=${child0?.scrollFactorX ?? "?"},${child0?.scrollFactorY ?? "?"} ` +
        `mask=${(child0 as any)?.mask ? "YES" : "no"} pipeline=${(child0 as any)?.pipeline?.name ?? "?"} ` +
        `camIgnore=${cam && typeof cam.ignore === "function" ? "exists" : "no"}`
      );
    } catch { /* ignore */ }
  }

  if (DEBUG_PROP_FOCUS_AURA_SCENE_DIAG) {
    try {
      const once = !!LOG_PROP_FOCUS_AURA_SCENE_DIAG_ONCE;
      if (!once || !inst.__loggedFocusAuraSceneDiag) {
        if (once) inst.__loggedFocusAuraSceneDiag = 1;

        const mk: any = inst.__dbgAuraWorldMarker || null;
        const diag = _dbgPropAuraSceneDiag(this.scene, cont, propObj, mk);
        console.log(`[PROPAURA][SCENE] ${JSON.stringify(diag)}`);
      }
    } catch { /* ignore */ }
  }

  // Always log multi-tile stats once per focus activation (gated by verbose flag).
  if (DEBUG_PROP_FOCUS_AURA_VERBOSE) {
    try {
      const isMulti = ((inst.wTiles | 0) > 1 || (inst.hTiles | 0) > 1);
      if ((isMulti || String(inst.baseName || "") === "stairs_statue") && !(inst as any).__loggedFocusAuraMulti) {
        (inst as any).__loggedFocusAuraMulti = 1;
        const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
        const childInfo = kids.map((k, i) => ({
          i,
          x: (k?.x ?? null),
          y: (k?.y ?? null),
          frame: (k?.frame?.name ?? null),
          w: (k?.displayWidth ?? null),
          h: (k?.displayHeight ?? null),
          padBaked: !!(k as any)?.__auraPadBaked,
          crop: (k as any)?.__dbgAuraCrop ?? null
        }));
        console.log(`[PROPAURA][MULTI] ${JSON.stringify({
          baseName: inst.baseName ?? "",
          tiles: { w: inst.wTiles | 0, h: inst.hTiles | 0 },
          baseRef: { row: inst.baseRefRow | 0, col: inst.baseRefCol | 0 },
          frameIndices: inst.focusAuraFrameIndices ?? null,
          children: childInfo
        })}`);
      }
    } catch { /* ignore */ }
  }

  if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE) {
    try {
      const once = !!LOG_PROP_FOCUS_AURA_PIXEL_PROBE_ONCE;
      if (!once || !inst.__loggedFocusAuraPixelProbe) {
        if (once) inst.__loggedFocusAuraPixelProbe = 1;
        const child0: any = (children && children.length) ? children[0] : null;
        const px = (typeof child0?.x === "number" ? child0.x : (typeof cont?.x === "number" ? cont.x : 0));
        const py = (typeof child0?.y === "number" ? child0.y : (typeof cont?.y === "number" ? cont.y : 0));
        const mk: any = inst.__dbgAuraWorldMarker || null;
        const propHalf = (propObj?.displayWidth != null) ? (propObj.displayWidth / 2) : (this.atlas?.tileSize ?? 32) / 2;
        const markerHalf = (mk?.displayWidth != null) ? (mk.displayWidth / 2) : 20;
        const propEdge = Math.max(1, Math.floor(propHalf - 1));
        const markerEdge = Math.max(propEdge + 2, Math.min(Math.floor(markerHalf - 1), propEdge + 6));
        const outsideEdge = Math.max(markerEdge + 2, Math.floor(markerHalf + 2));

        const points: Array<{ name: string; x: number; y: number }> = [
          { name: "center", x: px, y: py },
          { name: "propEdgeR", x: px + propEdge, y: py },
          { name: "markerEdgeR", x: px + markerEdge, y: py },
          { name: "outsideR", x: px + outsideEdge, y: py },
        ];

        if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
          console.log(`[PROPAURA][PIXEL] schedule delay ${JSON.stringify({
            points: points.map(p => ({ name: p.name, x: p.x | 0, y: p.y | 0 }))
          })}`);
        }
        this.scene.time?.delayedCall?.(75, () => _dbgProbePixels(this.scene, points, "delay"));
      }
    } catch { /* ignore */ }
  }

  if (DEBUG_PROP_FOCUS_AURA_POSTRENDER_PROBE) {
    try {
      if (!inst.__loggedFocusAuraPostRenderProbeScheduled) {
        inst.__loggedFocusAuraPostRenderProbeScheduled = 1;
        const child0: any = (children && children.length) ? children[0] : null;
        const px = (typeof child0?.x === "number" ? child0.x : (typeof cont?.x === "number" ? cont.x : 0));
        const py = (typeof child0?.y === "number" ? child0.y : (typeof cont?.y === "number" ? cont.y : 0));
        const evtScene = (Phaser as any)?.Scenes?.Events?.POST_RENDER ?? "postrender";
        const evtGame = (Phaser as any)?.Core?.Events?.POST_RENDER ?? "postrender";
        const evtRenderer = (Phaser as any)?.Renderer?.Events?.POST_RENDER ?? "postrender";
        const evtCamera = (Phaser as any)?.Cameras?.Scene2D?.Events?.POST_RENDER ?? "postrender";

        const runOnce = (source: string) => {
          if (inst.__loggedFocusAuraPostRenderProbeDone || inst.__loggedFocusAuraPostRenderProbeInFlight) return;
          inst.__loggedFocusAuraPostRenderProbeInFlight = 1;
          if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
            console.log(`[PROPAURA][PIXEL] postrender fired ${JSON.stringify({ source })}`);
          }
          const child0: any = (children && children.length) ? children[0] : null;
          const px = (typeof child0?.x === "number" ? child0.x : (typeof cont?.x === "number" ? cont.x : 0));
          const py = (typeof child0?.y === "number" ? child0.y : (typeof cont?.y === "number" ? cont.y : 0));
          const mk: any = inst.__dbgAuraWorldMarker || null;
          const propHalf = (propObj?.displayWidth != null) ? (propObj.displayWidth / 2) : (this.atlas?.tileSize ?? 32) / 2;
          const markerHalf = (mk?.displayWidth != null) ? (mk.displayWidth / 2) : 20;
          const propEdge = Math.max(1, Math.floor(propHalf - 1));
          const markerEdge = Math.max(propEdge + 2, Math.min(Math.floor(markerHalf - 1), propEdge + 6));
          const outsideEdge = Math.max(markerEdge + 2, Math.floor(markerHalf + 2));

          const points: Array<{ name: string; x: number; y: number }> = [
            { name: "center", x: px, y: py },
            { name: "propEdgeR", x: px + propEdge, y: py },
            { name: "markerEdgeR", x: px + markerEdge, y: py },
            { name: "outsideR", x: px + outsideEdge, y: py },
          ];

          _dbgProbePixelsArea(this.scene, points, "postrender", (reason) => {
            inst.__loggedFocusAuraPostRenderProbeDone = 1;
            inst.__loggedFocusAuraPostRenderProbeInFlight = 0;
            if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
              console.log(`[PROPAURA][PIXEL] postrender done ${JSON.stringify({ reason })}`);
            }
          });
        };

        const emitters: string[] = [];
        const gameEvents: any = (this.scene as any)?.sys?.game?.events ?? null;
        const renderer: any = (this.scene as any)?.sys?.game?.renderer ?? null;
        const cam: any = (this.scene as any)?.cameras?.main ?? null;

        if (cam?.once) {
          emitters.push(`camera:${evtCamera}`);
          cam.once(evtCamera, () => runOnce("camera"));
        } else if (renderer?.once) {
          emitters.push(`renderer:${evtRenderer}`);
          renderer.once(evtRenderer, () => runOnce("renderer"));
        } else if (gameEvents?.once) {
          emitters.push(`game:${evtGame}`);
          gameEvents.once(evtGame, () => runOnce("game"));
        } else if (this.scene.events?.once) {
          emitters.push(`scene:${evtScene}`);
          this.scene.events.once(evtScene, () => runOnce("scene"));
        } else {
          emitters.push("timeout");
          this.scene.time?.delayedCall?.(100, () => runOnce("timeout"));
        }

        if (DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT) {
          console.log(`[PROPAURA][PIXEL] schedule postrender ${JSON.stringify({
            emitters,
            cont: { x: px | 0, y: py | 0 }
          })}`);
        }
      }
    } catch { /* ignore */ }
  }


  // One-time debug + proof (gated)
  if (DEBUG_PROP_FOCUS_AURA_VERBOSE && LOG_PROP_FOCUS_AURA_RENDER_ONCE && !inst.__loggedFocusAuraRender && !wasVisible) {
    inst.__loggedFocusAuraRender = 1;

    const comp = String(inst.focusAuraComposition ?? inst.rawKey ?? inst.baseName ?? "");
    const auraTk = String(inst.focusAuraTextureKey ?? "");
    const auraUrl = String(inst.focusAuraPngUrl ?? "");
    const scale = (typeof cont?.scaleX === "number")
      ? cont.scaleX
      : (inst.focusAuraBaseScale ?? PROP_FOCUS_AURA_BASE_SCALE);

    // Try to grab one child frame id (what we *think* we're drawing)
    let child0Frame: any = null;
    let child0Obj: any = null;
    try {
      const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
      const child0: any = (kids && kids.length) ? kids[0] : null;
      child0Obj = child0;
      child0Frame = (child0 && child0.frame) ? (child0.frame.name ?? null) : null;
    } catch { child0Frame = null; }

    console.log(_fmtPropAuraRenderLog({
      comp,
      auraUrl,
      auraTk,
      anchorR: inst.anchorR | 0,
      anchorC: inst.anchorC | 0,
      focusR: r | 0,
      focusC: c | 0,
      wTiles: inst.wTiles | 0,
      hTiles: inst.hTiles | 0,
      baseRefRow: inst.baseRefRow | 0,
      baseRefCol: inst.baseRefCol | 0,
      auraX: (typeof child0Obj?.x === "number" ? child0Obj.x : (typeof cont?.x === "number" ? cont.x : 0)) | 0,
      auraY: (typeof child0Obj?.y === "number" ? child0Obj.y : (typeof cont?.y === "number" ? cont.y : 0)) | 0,
      auraOnCam: null, // keep simple; we already proved onCam earlier
      depth,
      propDepth,
      scale,
      forcedFront: !!DEBUG_PROP_FOCUS_AURA_FORCE_FRONT,
      idxAura: null,
      idxProp: null,
      child0Frame,
      child0Alpha: null,
      child0Visible: null,
    }));
    if (DEBUG_PROP_FOCUS_AURA_VERBOSE) {
      try {
        const isMulti = ((inst.wTiles | 0) > 1 || (inst.hTiles | 0) > 1);
        if (isMulti || String(inst.baseName || "").includes("stairs_statue")) {
          const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
          const childInfo = kids.map((k, i) => ({
            i,
            x: (k?.x ?? null),
            y: (k?.y ?? null),
            frame: (k?.frame?.name ?? null),
            w: (k?.displayWidth ?? null),
            h: (k?.displayHeight ?? null),
            padBaked: !!(k as any)?.__auraPadBaked
          }));
          console.log(`[PROPAURA][MULTI] ${JSON.stringify({
            baseName: inst.baseName ?? "",
            tiles: { w: inst.wTiles | 0, h: inst.hTiles | 0 },
            baseRef: { row: inst.baseRefRow | 0, col: inst.baseRefCol | 0 },
            frameIndices: inst.focusAuraFrameIndices ?? null,
            children: childInfo
          })}`);
        }
      } catch { /* ignore */ }
      try {
        const ch: any = child0Obj;
        if (ch) {
          const padScale = (typeof (ch as any).__auraPadScale === "number") ? (ch as any).__auraPadScale : 1;
          const padBaked = !!(ch as any).__auraPadBaked;
          const finalScale = padBaked ? scale : ((padScale > scale) ? padScale : scale);
          const tileSize = (this.atlas?.tileSize ?? 32) | 0;
          console.log(`[PROPAURA][SCALE] ${JSON.stringify({
            tile: tileSize,
            scale: { base: scale, padScale, finalScale },
            base: { w: (ch.width ?? null), h: (ch.height ?? null) },
            display: { w: (ch.displayWidth ?? null), h: (ch.displayHeight ?? null) },
            appliedScale: { x: (ch.scaleX ?? null), y: (ch.scaleY ?? null) },
            expected: { w: ((tileSize * finalScale) | 0), h: ((tileSize * finalScale) | 0) }
          })}`);
        }
      } catch { /* ignore */ }
    }

    if (DEBUG_PROP_FOCUS_AURA) {
      let cropMsg = "crop=none";
      let pxMsg = "px=none";

      try {
        const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
        const child0: any = (kids && kids.length) ? kids[0] : null;

        const meta: any = child0 ? (child0 as any).__dbgAuraCrop : null;
        if (meta) {
          cropMsg =
            `crop(x=${meta.cropX},y=${meta.cropY},w=${meta.tile},h=${meta.tile})` +
            ` atlas(row=${meta.atlasRow},col=${meta.atlasCol}) fi=${meta.auraFi}`;

          const px = _dbgCropOpaqueStats(this.scene, auraTk, meta.cropX, meta.cropY, meta.tile, meta.tile);
          pxMsg = `px ok=${px.ok} reason=${px.reason} img=${px.imgW}x${px.imgH} opaque=${px.opaque}/${px.total} aMax=${px.aMax}`;
        }
      } catch { /* ignore */ }

      console.log(`  auraCropCheck ${cropMsg} | ${pxMsg}`);

      if (DEBUG_PROP_FOCUS_AURA_HUD_PREVIEW) {
        _dbgMakeAuraHudPreviewOnce(this.scene, auraTk, child0Frame);
      }
    }

    try {
      const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
      const child0: any = (kids && kids.length) ? kids[0] : null;
      const propPos = { x: (propObj?.x ?? null), y: (propObj?.y ?? null) };
      const auraPos = { x: (child0?.x ?? null), y: (child0?.y ?? null) };
      const dx = (propPos.x != null && auraPos.x != null) ? (propPos.x - auraPos.x) : null;
      const dy = (propPos.y != null && auraPos.y != null) ? (propPos.y - auraPos.y) : null;
      console.log(`[PROPAURA][ALIGN] ${JSON.stringify({
        prop: propPos,
        auraChild0: auraPos,
        dx,
        dy,
        contType: cont?.constructor?.name ?? null,
        contPos: { x: cont?.x ?? null, y: cont?.y ?? null }
      })}`);
    } catch { /* ignore */ }
  }

  return true;
}






/** Return the primary Phaser display object for a prop at its anchor tile. */
tryGetPropDisplayAtAnchor(anchorR: number, anchorC: number): any | null {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return null;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return null;

  const objs: any[] | null = Array.isArray(inst.objs) ? inst.objs : null;
  if (!objs || objs.length === 0) return null;

  return objs[0] ?? null;
}

/** Force a full tilemap rebuild even if dimensions are unchanged. */
forceRebuild(rows: number, cols: number): void {
    const r = rows | 0;
    const c = cols | 0;
    const tileSize = (this.atlas.tileSize | 0);
    if (r <= 0 || c <= 0) return;
    this._rebuildTilemap(r, c, tileSize);
}


  // ---- core sync ----

private _analyzeGridForRender(
  grid: number[][],
  rows: number,
  cols: number,
  valueToFamily: (v: number) => TileFamily | "",
  valueIsWall: (v: number) => boolean
): {
  rawWalls: number;
  rawFloors: number;
  rawSig: number;
  wallCells: number;
  floorCells: number;
  fallbackFloorFamily: TileFamily;
} {
  let rawWalls = 0;
  let rawFloors = 0;
  let rawSig = 0;

  let wallCells = 0;
  let floorCells = 0;

  let fallbackFloorFamily: TileFamily = "ground_light";
  let fallbackFound = false;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const isWall = valueIsWall(v);
      if (isWall) rawWalls++;
      else rawFloors++;

      rawSig = (((rawSig << 5) - rawSig) + v + ((r + 1) * 131) + ((c + 1) * 17)) | 0;

      const fam = valueToFamily(v);
      if (isWall) wallCells++;
      else floorCells++;

      if (!fallbackFound && !isWall && fam) {
        fallbackFloorFamily = fam as TileFamily;
        fallbackFound = true;
      }
    }
  }

  return { rawWalls, rawFloors, rawSig, wallCells, floorCells, fallbackFloorFamily };
}

private _paintFloorUnderlayEverywhere(
  grid: number[][],
  rows: number,
  cols: number,
  valueToFamily: (v: number) => TileFamily | "",
  valueIsWall: (v: number) => boolean,
  fallbackFloorFamily: TileFamily,
  seedSalt: number
): void {
  if (!this.groundLayer) return;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const isWall = valueIsWall(v);
      const fam0 = valueToFamily(v);

      const floorFamily =
        (!isWall && fam0) ? (fam0 as TileFamily) : fallbackFloorFamily;

      const seed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(floorFamily), _hashString("center"));
      const def =
        this.atlas.getVariantByIndex(floorFamily, "center", seed) ||
        this.atlas.getAutoTile(floorFamily, "center");

      if (!def) continue;

      const gid = this._gidFor(def.textureKey, def.frameIndex);
      if (gid >= 0) this.groundLayer.putTileAt(gid, c, r);
    }
  }
}

private _paintChasmLike(
  grid: number[][],
  rows: number,
  cols: number,
  valueToFamily: (v: number) => TileFamily | "",
  valueIsWall: (v: number) => boolean,
  seedSalt: number
): void {
  if (!this.chasmLayer || !this.chasmOverlayLayer) return;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      if (!valueIsWall(v)) continue;
      const family = valueToFamily(v);
      if (!family) continue;

      const mask = computeNeighborMask(grid, r, c, family as TileFamily, valueToFamily);
      const shape: AutoShape = autoShapeFromMask(mask);
      const inner = innerCornerFromMask(mask);

      // ---- choose BASE tile ----
      let baseDef: { textureKey: string; frameIndex: number } | null = null;
      let usedInnerAsBase = false;

      // Prefer inner-corner as a BASE replacement tile if it exists
      if (inner !== "none") {
        const innerSeed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString(inner));
        const innerDef =
          this.atlas.getVariantByIndex(family as TileFamily, inner as any, innerSeed) ||
          this.atlas.getAutoTile(family as TileFamily, inner as any);

        if (innerDef) {
          baseDef = innerDef;
          usedInnerAsBase = true;
        }
      }

      // Singleton: use decor slots
      if (!baseDef && shape === "single") {
        const decoSeed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString("decor"));
        const deco = this.atlas.getDecorByIndex(family as TileFamily, decoSeed);
        if (deco) baseDef = deco;
      }

      // Normal shape lookup
      if (!baseDef) {
        const shapeSeed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString(shape));
        const centerSeed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString("center"));
        baseDef =
          this.atlas.getVariantByIndex(family as TileFamily, shape, shapeSeed) ||
          this.atlas.getAutoTile(family as TileFamily, shape) ||
          this.atlas.getVariantByIndex(family as TileFamily, "center", centerSeed) ||
          this.atlas.getAutoTile(family as TileFamily, "center") ||
          null;
      }

      if (!baseDef) continue;

      const gid = this._gidFor(baseDef.textureKey, baseDef.frameIndex);
      if (gid >= 0) this.chasmLayer.putTileAt(gid, c, r);

      // ---- overlay ONLY if we did NOT use inner as base ----
      if (inner !== "none" && !usedInnerAsBase) {
        const innerSeed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString(inner));
        const innerDef =
          this.atlas.getVariantByIndex(family as TileFamily, inner as any, innerSeed) ||
          this.atlas.getAutoTile(family as TileFamily, inner as any);

        if (innerDef) {
          const innerGid = this._gidFor(innerDef.textureKey, innerDef.frameIndex);
          if (innerGid >= 0) this.chasmOverlayLayer.putTileAt(innerGid, c, r);
        }
      }
    }
  }
}


syncFromEngineGrid(grid: number[][], opts?: { variantSeed?: number }): void {
  const localDebug = this.opts.debugLocal ?? true;
  const valueToFamily = this.opts.tileValueToFamily ?? defaultTileValueToFamily;
  const valueIsWall = this.opts.tileValueIsWall ?? defaultTileValueIsWall;

  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
    logTiles(localDebug, "[tileMapGlue] syncFromEngineGrid: empty/malformed grid");
    return;
  }

  const rows = (grid.length | 0);
  const cols = ((grid[0]?.length ?? 0) | 0);
  const tileSize = (this.atlas.tileSize | 0);

  if (rows <= 0 || cols <= 0) return;

  if (!this.map || (this.map.width | 0) !== cols || (this.map.height | 0) !== rows) {
    this._rebuildTilemap(rows, cols, tileSize);
  }

  if (!this.map || !this.groundLayer || !this.chasmLayer || !this.chasmOverlayLayer) return;

  // Clear base layers (decals/props are synced separately — DO NOT clear them here)
  this.groundLayer.fill(-1);
  this.chasmLayer.fill(-1);
  this.chasmOverlayLayer.fill(-1);

  const stats = this._analyzeGridForRender(grid, rows, cols, valueToFamily, valueIsWall);
  const seedOverride =
    (opts && typeof opts.variantSeed === "number" && Number.isFinite(opts.variantSeed))
      ? (opts.variantSeed | 0)
      : 0;
  const seedSalt = (seedOverride !== 0) ? (seedOverride | 0) : (stats.rawSig | 0);

  this._paintFloorUnderlayEverywhere(grid, rows, cols, valueToFamily, valueIsWall, stats.fallbackFloorFamily, seedSalt);
  this._paintChasmLike(grid, rows, cols, valueToFamily, valueIsWall, seedSalt);

  this._lastGrid = grid;
  this._lastValueToFamily = valueToFamily;
  this._lastValueIsWall = valueIsWall;
  this._lastGridSig = seedSalt | 0;

  // stash last snapshot for other debug consumers if needed
  try {
    const anyThis: any = this as any;
    anyThis.__lastGridRows = rows | 0;
    anyThis.__lastGridCols = cols | 0;
    anyThis.__lastGridWalls = stats.rawWalls | 0;
    anyThis.__lastGridSig = seedSalt | 0;
    anyThis.__lastGridRawSig = stats.rawSig | 0;
  } catch { /* ignore */ }

  if (localDebug) {
    logTiles(localDebug, "[tileMapGlue] base render done", {
      rows,
      cols,
      hasDecalLayer: !!this.decalLayer,
      hasPropLayer: !!this.propLayer,
      fallbackFloorFamily: stats.fallbackFloorFamily,
      rawWalls: stats.rawWalls,
      rawFloors: stats.rawFloors,
      rawSig: stats.rawSig,
      wallCells: stats.wallCells,
      floorCells: stats.floorCells,
      tilesets: this._gidRanges.map(r => `${r.textureKey}@${r.firstGid}-${r.lastExclusive - 1}`).join(", "),
    });
  }
}





//End of sync from engine grid


  syncDecalGridByName(decalNameGrid: string[][]): void {
    if (!this.map || !this.decalLayer) return;

    const rows = decalNameGrid.length | 0;
    const cols = rows > 0 ? (decalNameGrid[0].length | 0) : 0;

    this.decalLayer.fill(-1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = decalNameGrid[r]?.[c] ?? "";
        if (!name) continue;

        const vis = DECAL_VISUALS_BY_NAME[name];
        if (!vis) continue;

        this._placeVisualTiles(this.decalLayer, r, c, vis);
      }
    }

    this._applyAutoDecorDecals(decalNameGrid, rows, cols);
    this._debugTilemapAuditDecals("sync", decalNameGrid, rows | 0, cols | 0);
  }

  private _applyAutoDecorDecals(decalNameGrid: string[][], rows: number, cols: number): void {
    if (!DECAL_AUTO_ENABLED) return;
    if (!this.decalLayer) return;
    if (!this._lastGrid || !this._lastValueToFamily || !this._lastValueIsWall) return;

    const grid = this._lastGrid;
    const valueToFamily = this._lastValueToFamily;
    const valueIsWall = this._lastValueIsWall;
    const seedSalt = this._lastGridSig | 0;
    // If decor sync sends an empty grid, still scatter based on the base grid size.
    const autoRows = ((rows | 0) > 0) ? (rows | 0) : (grid.length | 0);
    const autoCols = ((cols | 0) > 0) ? (cols | 0) : ((grid[0]?.length ?? 0) | 0);
    const rowMax = Math.min(autoRows | 0, grid.length | 0);
    const colMax = rowMax > 0 ? Math.min(autoCols | 0, (grid[0]?.length ?? 0) | 0) : 0;
    const margin = Math.max(0, DECAL_AUTO_EDGE_MARGIN | 0) | 0;

    for (let r = 0; r < rowMax; r++) {
      if (r < margin || r >= (rowMax - margin)) continue;
      const row = grid[r];
      if (!row) continue;
      const decalRow = decalNameGrid[r];
      for (let c = 0; c < colMax; c++) {
        if (c < margin || c >= (colMax - margin)) continue;
        if (decalRow && decalRow[c]) continue;
        const v = row[c] | 0;
        if (valueIsWall(v)) continue;
        const family = valueToFamily(v);
        if (!family) continue;
        const seed = _mixSeed(seedSalt | 0, r | 0, c | 0, _hashString(family), _hashString("decor_scatter"));
        if (((seed | 0) % 1000) >= (DECAL_AUTO_DENSITY_PER_1000 | 0)) continue;
        const deco = this.atlas.getDecorByIndex(family as TileFamily, seed | 0);
        if (!deco) continue;
        const gid = this._gidFor(deco.textureKey, deco.frameIndex);
        if (gid >= 0) this.decalLayer.putTileAt(gid, c, r);
      }
    }
  }


private _propBeginSync(): {
  anyThis: any;
  byRc: Record<string, { textureKey: string; frameIndex: number }>;
  instByAnchor: Record<string, any>;
  anchorKeyByRc: Record<string, string>;
  tileSize: number;
} {
  const anyThis: any = this as any;

  // Destroy previous prop objects (images/sprites + focus aura containers)
  const prev: any[] = (anyThis.__propImgs as any[]) || [];
  for (let i = 0; i < prev.length; i++) {
    const obj: any = prev[i];
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }
  anyThis.__propImgs = [];

  // Reset lookup map used by decor_applyTightOpaqueAabbToSolids
  const byRc: Record<string, { textureKey: string; frameIndex: number }> = Object.create(null);
  anyThis.__propTileInfoByRC = byRc;

  // Map tile r,c -> anchor r,c so focus can target any tile in a multi-tile prop.
  const anchorKeyByRc: Record<string, string> = Object.create(null);
  anyThis.__propAnchorKeyByRC = anchorKeyByRc;

  // Track prop instances so we can switch states/frames without a full resync.
  const instByAnchor: Record<string, any> = Object.create(null);
  anyThis.__propInstancesByAnchor = instByAnchor;

  // Keep the tile layer empty / hidden (props rendered as y-sorted images/sprites).
  try { this.propLayer?.fill(-1); } catch { /* ignore */ }

  return {
    anyThis,
    byRc,
    instByAnchor,
    anchorKeyByRc,
    tileSize: (this.atlas.tileSize | 0),
  };
}

private _propResolveTextureKeyAndInfo(vis: any): { textureKey: string; cols: number } | null {
  // Resolve textureKey from atlas/alias
  const atlasOrTk = (vis?.textureKey ?? vis?.atlas ?? "") as string;
  const textureKey = vis?.textureKey
    ? String(vis.textureKey)
    : this.atlas.resolveAtlasTextureKey(atlasOrTk);

  if (!textureKey) return null;

  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? 0) | 0;
  if (!info || cols <= 0) return null;

  return { textureKey, cols };
}

private _propResolveBaseRef(vis: any, parsed: { state: string | null; explicitFrameIndex: number | null }, sheetCols: number): {
  baseRef: { row: number; col: number };
  usedState: string | null;
} {
  let baseRef = {
    row: ((vis?.ref?.row ?? 0) | 0),
    col: ((vis?.ref?.col ?? 0) | 0),
  };

  const animDef: any = vis?.anim || null;

  // State override: "chest#open"
  let usedState: string | null = null;
  if (parsed.state && animDef?.states && animDef.states[parsed.state]) {
    const st = animDef.states[parsed.state];
    baseRef = { row: (st?.row ?? baseRef.row) | 0, col: (st?.col ?? baseRef.col) | 0 };
    usedState = parsed.state;
  }

  // Explicit absolute frame override: "thing@123"
  if (parsed.explicitFrameIndex != null) {
    const tr = _tileRefFromFrameIndex(sheetCols | 0, parsed.explicitFrameIndex | 0);
    baseRef = { row: tr.row | 0, col: tr.col | 0 };
    usedState = null;
  }

  return { baseRef, usedState };
}

private _propResolveAnimKey(vis: any, parsed: { explicitFrameIndex: number | null }, usedState: string | null, wTiles: number, hTiles: number, textureKey: string, sheetCols: number): string | null {
  const animDef: any = vis?.anim || null;

  const canAnimate = ((wTiles | 0) === 1 && (hTiles | 0) === 1);
  if (!canAnimate) return null;
  if (usedState != null) return null;
  if (parsed.explicitFrameIndex != null) return null;

  return _ensurePropAnim(this.scene, textureKey, sheetCols | 0, animDef);
}

private _propResolveOverlayInfo(
  vis: any,
  baseTextureKey: string
): {
  textureKey: string;
  cols: number;
  ref: { row: number; col: number };
  offsetX: number;
  offsetY: number;
  depthBias: number;
  alpha: number | null;
  tint: number | null;
  blendMode: number | "add" | "lighten" | "normal" | null;
  visibleByDefault: boolean;
  followState: boolean;
} | null {
  const spec: any = vis?.overlay || null;
  if (!spec) return null;

  let textureKey = String(baseTextureKey || "");
  if (spec.textureKey) {
    textureKey = String(spec.textureKey || "");
  } else if (spec.atlas) {
    textureKey = this.atlas.resolveAtlasTextureKey(String(spec.atlas || ""));
  }
  if (!textureKey) return null;

  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? 0) | 0;
  if (!info || cols <= 0) return null;

  let ref: { row: number; col: number } | null = null;
  if (spec.ref) {
    ref = { row: (spec.ref.row | 0), col: (spec.ref.col | 0) };
  } else if (spec.frameIndex != null && !Number.isNaN(spec.frameIndex)) {
    const tr = _tileRefFromFrameIndex(cols, spec.frameIndex | 0);
    ref = { row: tr.row | 0, col: tr.col | 0 };
  }

  if (!ref) return null;

  const offsetX = ((spec.offsetXPx ?? 0) | 0);
  const offsetY = ((spec.offsetYPx ?? 0) | 0);
  const depthBias = ((spec.depthBias ?? 1) | 0);
  const alpha = (typeof spec.alpha === "number") ? spec.alpha : null;
  const tint = (typeof spec.tint === "number") ? spec.tint : null;
  const blendMode = (spec.blendMode != null) ? spec.blendMode : null;
  const visibleByDefault = !!spec.visibleByDefault;
  const followState = !!spec.followState;

  return {
    textureKey,
    cols,
    ref,
    offsetX,
    offsetY,
    depthBias,
    alpha,
    tint,
    blendMode,
    visibleByDefault,
    followState,
  };
}

private _propCreateDisplayObj(args: {
  x: number;
  y: number;
  textureKey: string;
  frameIndex: number;
  depth: number;
  animKey: string | null;
  isAnimAnchorCell: boolean;
}): any {
  const { x, y, textureKey, frameIndex, depth, animKey, isAnimAnchorCell } = args;
  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? 0) | 0;
  const rows = (info?.rows ?? 0) | 0;
  const tileSize = (info?.tileSize ?? 32) | 0;
  const frameName = String(frameIndex | 0);

  let canUseFrames = false;
  try {
    const texObj: any = (this.scene as any)?.textures?.get?.(textureKey);
    if (texObj?.has && (texObj?.frameTotal ?? 0) > 1) {
      canUseFrames = !!texObj.has(frameName);
    }
  } catch { /* ignore */ }

  if (animKey && isAnimAnchorCell && canUseFrames) {
    const spr = this.scene.add.sprite(x, y, textureKey, frameName);
    spr.setOrigin(0.5, 0.5);
    spr.setDepth(depth);
    try { spr.anims?.play?.(animKey); } catch { /* ignore */ }
    return spr;
  }

  const img = this.scene.add.image(x, y, textureKey);
  img.setOrigin(0.5, 0.5);
  img.setDepth(depth);

  if (canUseFrames) {
    try { img.setFrame(frameName); } catch { /* ignore */ }
    return img;
  }

  // Fallback for non-framed textures: crop from the base sheet.
  try { img.setFrame("__BASE"); } catch { /* ignore */ }
  if (cols > 0 && rows > 0) {
    const maxFrames = ((cols * rows) | 0);
    const fi = (frameIndex | 0);
    if (fi >= 0 && (maxFrames === 0 || fi < maxFrames)) {
      const atlasCol = ((fi % cols) | 0);
      const atlasRow = ((Math.floor(fi / cols)) | 0);
      const cropX = ((atlasCol * tileSize) | 0);
      const cropY = ((atlasRow * tileSize) | 0);
      img.setCrop(cropX, cropY, tileSize, tileSize);
      img.setDisplaySize(tileSize, tileSize);
    }
  }
  return img;
}


private _propResolveFocusAuraTextureKey(propTextureKey: string, vis: any, radius: number): string | null {
  const rad = pickAuraRadius(radius | 0);
  const resolveKey = (raw: string): string | null => {
    const tk = this.atlas.resolveAtlasTextureKey(raw.trim());
    if (this.atlas.getSheetInfo(tk)) return tk;
    const auraTk = auraKey(tk, rad);
    if (this.atlas.getSheetInfo(auraTk)) return auraTk;
    return null;
  };

  // 1) Explicit override (either a full textureKey or an alias supported by tileAtlas)
  const explicit = (vis?.auraTextureKey ?? vis?.focusAuraTextureKey ?? "") as any;
  if (explicit && typeof explicit === "string" && explicit.trim()) {
    const tk = resolveKey(explicit);
    if (tk) return tk;
  }

  const alias = (vis?.auraAtlas ?? vis?.focusAuraAtlas ?? "") as any;
  if (alias && typeof alias === "string" && alias.trim()) {
    const tk = resolveKey(alias);
    if (tk) return tk;
  }

  // 2) Convention: <propTextureKey> + "_aura_r{radius}"
  const base = String(propTextureKey || "");
  if (base) {
    const baseTk = this.atlas.resolveAtlasTextureKey(base);
    const auraTk = auraKey(baseTk, rad);
    if (this.atlas.getSheetInfo(auraTk)) return auraTk;
  }

  if (!__warnedMissingPropAuraSheet[propTextureKey]) {
    __warnedMissingPropAuraSheet[propTextureKey] = 1;
    if (DEBUG_PROP_FOCUS_AURA) {
      console.log("[PROPAURA] missing aura sheet for prop textureKey:", propTextureKey);
    }
  }
  return null;
}

private _propCreateFocusAuraContainer(args: {
  st: {
    anyThis: any;
    byRc: Record<string, { textureKey: string; frameIndex: number }>;
    instByAnchor: Record<string, any>;
    anchorKeyByRc: Record<string, string>;
    tileSize: number;
  };
  anchorR: number;
  anchorC: number;
  baseName: string;
  vis: any;
  textureKey: string;
  sheetCols: number;
  baseRef: { row: number; col: number };
  wTiles: number;
  hTiles: number;
  ox: number;
  oy: number;
  baseDepth: number;
  radius: number;
}): { cont: any; baseScale: number; auraTextureKey: string; auraPngUrl: string; frameIndices: number[]; children: any[]; radius: number } | null {
  const { st, anchorR, anchorC, baseName, vis, textureKey, baseRef, wTiles, hTiles, ox, oy, baseDepth } = args;

  if (!PROP_FOCUS_AURA_USE_TILED) return null;

  const rad = pickAuraRadius(args.radius | 0);
  let auraTk = this._propResolveFocusAuraTextureKey(textureKey, vis, rad);

  const tile = (st.tileSize | 0);
  const half = (tile >> 1);

  const aox = ((vis?.auraOffsetXPx ?? vis?.focusAuraOffsetXPx ?? 0) | 0);
  const aoy = ((vis?.auraOffsetYPx ?? vis?.focusAuraOffsetYPx ?? 0) | 0);

  const centerC = (anchorC + (Math.max(1, wTiles | 0) - 1) / 2);
  const centerR = (anchorR - (Math.max(1, hTiles | 0) - 1) / 2);
  const centerX = ((centerC * tile + half + ox + aox) | 0);
  const centerY = ((centerR * tile + half + oy + aoy) | 0);

  const baseScale = Math.max(
    0.01,
    (typeof vis?.auraScale === "number"
      ? vis.auraScale
      : (typeof vis?.focusAuraScale === "number"
        ? vis.focusAuraScale
        : PROP_FOCUS_AURA_BASE_SCALE))
  );

  if (!auraTk) {
    const missing = auraKey(textureKey, rad);
    throw new Error(
      `[AURA-MISSING] Missing prop focus aura for ${baseName || textureKey}. ` +
      `Expected ${missing}. Run: npm run gen-prop-auras`
    );
  }

  const override =
    DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
    String(baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "");
  if (override && DEBUG_PROP_FOCUS_AURA_OVERRIDE.auraTextureKey) {
    const tk = this.atlas.resolveAtlasTextureKey(String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.auraTextureKey));
    if (this.atlas.getSheetInfo(tk)) {
      auraTk = tk;
    }
  }

  if (DEBUG_PROP_FOCUS_AURA_TRACE && String(baseName || "") === "chest") {
    try {
      console.log(`[PROPAURA][TRACE] aura-frame start ${JSON.stringify({
        baseName,
        anchor: { r: anchorR | 0, c: anchorC | 0 },
        tiles: { w: wTiles | 0, h: hTiles | 0 },
        auraTk
      })}`);
    } catch { /* ignore */ }
  }

  const auraInfo = this.atlas.getSheetInfo(auraTk);
  const auraCols = (auraInfo?.cols ?? 0) | 0;
  const auraRows = (auraInfo?.rows ?? 0) | 0;
  const auraFrameW = ((auraInfo as any)?.frameW ?? tile) | 0;
  const auraFrameH = ((auraInfo as any)?.frameH ?? tile) | 0;
  if (!auraInfo || auraCols <= 0) return null;

  if (override && DEBUG_PROP_FOCUS_AURA_LOGS) {
    try {
      console.log(`[PROPAURA][OVERRIDE] ${JSON.stringify({
        baseName,
        auraTk,
        frameIndex: DEBUG_PROP_FOCUS_AURA_OVERRIDE.frameIndex ?? null
      })}`);
    } catch { /* ignore */ }
  }

  const auraUrl =
    (typeof (this.atlas as any).getSheetUrl === "function")
      ? ((this.atlas as any).getSheetUrl(auraTk) ?? "")
      : "";

  // Use a controller container (not used for rendering) so we have a stable handle.
  const cont = this.scene.add.container(centerX, centerY);
  cont.setVisible(false);

  try { (cont as any).setScale?.(baseScale); } catch { /* ignore */ }

  // Clear camera filters (debug: eliminates “not on this camera” issues)
  try { (cont as any).cameraFilter = 0; } catch { /* ignore */ }

  const frameIndices: number[] = [];
  const children: any[] = [];
  const opaqueCache: any = st.anyThis.__dbgAuraOpaqueCache || (st.anyThis.__dbgAuraOpaqueCache = Object.create(null));

  for (let dy = 0; dy < (hTiles | 0); dy++) {
    for (let dx = 0; dx < (wTiles | 0); dx++) {
      const worldR = ((anchorR | 0) - ((hTiles | 0) - 1) + (dy | 0)) | 0;
      const worldC = ((anchorC | 0) + (dx | 0)) | 0;
      if (!this.map) continue;
      if (worldR < 0 || worldC < 0 || worldR >= (this.map.height | 0) || worldC >= (this.map.width | 0)) continue;

      const isEdge =
        (dx === 0) ||
        (dy === 0) ||
        (dx === ((wTiles | 0) - 1)) ||
        (dy === ((hTiles | 0) - 1));
      const multi = ((wTiles | 0) > 1 || (hTiles | 0) > 1);
      const trimPx = multi ? Math.max(0, PROP_FOCUS_AURA_INNER_TRIM_PX) : 0;
      const extraPx = (trimPx > 0) ? Math.max(0, PROP_FOCUS_AURA_INNER_TRIM_EXTRA_PX) : 0;
      const oneSide = !!PROP_FOCUS_AURA_INNER_TRIM_ONE_SIDE;
      const baseLeft = (trimPx > 0 && dx > 0) ? trimPx : 0;
      const baseRight = (trimPx > 0 && dx < ((wTiles | 0) - 1)) ? trimPx : 0;
      const baseTop = (trimPx > 0 && dy > 0) ? trimPx : 0;
      const baseBottom = (trimPx > 0 && dy < ((hTiles | 0) - 1)) ? trimPx : 0;
      const trimLeft = baseLeft;
      const trimRight = (oneSide && baseRight > 0) ? (baseRight + extraPx) : baseRight;
      const trimTop = baseTop;
      const trimBottom = (oneSide && baseBottom > 0) ? (baseBottom + extraPx) : baseBottom;

      let atlasCol = (baseRef.col + dx) | 0;
      let atlasRow = (baseRef.row - ((hTiles | 0) - 1) + dy) | 0;
      let auraFi = ((atlasRow * auraCols + atlasCol) | 0);

      if (override && typeof DEBUG_PROP_FOCUS_AURA_OVERRIDE.frameIndex === "number") {
        const fi = (DEBUG_PROP_FOCUS_AURA_OVERRIDE.frameIndex | 0);
        if (fi >= 0) {
          auraFi = fi;
          atlasRow = Math.floor(fi / auraCols) | 0;
          atlasCol = (fi % auraCols) | 0;
        }
      }
      frameIndices.push(auraFi);

      const worldX = ((worldC * tile + half + ox + aox) | 0);
      const worldY = ((worldR * tile + half + oy + aoy) | 0);

      const cropX = (atlasCol * auraFrameW) | 0;
      const cropY = (atlasRow * auraFrameH) | 0;

      const img = this.scene.add.image(worldX, worldY, auraTk);
      img.setOrigin(0.5, 0.5);
      img.setVisible(false);
      // Track local offset so focus aura can be snapped to prop base position later.
      (img as any).__auraLocalDx = (worldX - centerX) | 0;
      (img as any).__auraLocalDy = (worldY - centerY) | 0;
      // Prefer spritesheet frames when available; crop is a fallback for non-framed textures.
      let usedFrame = false;
      let forcedCrop = false;
      let statsFrom: "frame" | "crop" = "frame";
      let frameName: string | number = String(auraFi);
      try {
        const texObj: any = (this.scene as any)?.textures?.get?.(auraTk);
        const frameMax = (auraCols > 0 && auraRows > 0) ? (auraCols * auraRows) : 0;
        const inBounds = (frameMax > 0) ? (auraFi >= 0 && auraFi < frameMax) : (auraFi >= 0);
        const canUseFrames = inBounds && !!texObj?.has && ((texObj?.frameTotal ?? 0) > 1);
        if (canUseFrames) {
          if (texObj.has(auraFi)) {
            frameName = auraFi;
            img.setFrame(auraFi as any);
          } else if (texObj.has(String(auraFi))) {
            frameName = String(auraFi);
            img.setFrame(String(auraFi));
          }
          usedFrame = (img?.frame?.name === frameName);
        }
      } catch { /* ignore */ }
      if (!usedFrame) {
        // Crop against the full texture frame, but keep size at the frame dimensions.
        try { img.setFrame("__BASE"); } catch { /* ignore */ }
        img.setCrop(cropX, cropY, auraFrameW, auraFrameH);
      }
      let frameW = auraFrameW;
      let frameH = auraFrameH;
      if (usedFrame) {
        try {
          const fr: any = (img as any).frame;
          const fw = (fr?.cutWidth ?? fr?.width ?? 0) | 0;
          const fh = (fr?.cutHeight ?? fr?.height ?? 0) | 0;
          if (fw > 0) frameW = fw;
          if (fh > 0) frameH = fh;
        } catch { /* ignore */ }
      }
      const halfW = frameW >> 1;
      const halfH = frameH >> 1;
      const padScaleBase = Math.max(1, Math.min(frameW | 0, frameH | 0)) | 0;
      img.setDisplaySize(frameW, frameH);
      if (trimLeft || trimRight || trimTop || trimBottom) {
        const maskG = this.scene.add.graphics();
        const maskW = Math.max(1, frameW - trimLeft - trimRight);
        const maskH = Math.max(1, frameH - trimTop - trimBottom);
        maskG.fillStyle(0xffffff, 1);
        maskG.fillRect(worldX - halfW + trimLeft, worldY - halfH + trimTop, maskW, maskH);
        maskG.setVisible(false);
        const geomMask = maskG.createGeometryMask();
        img.setMask(geomMask);
        (img as any).__auraTrimMask = maskG;
        (img as any).__auraTrim = { left: trimLeft, right: trimRight, top: trimTop, bottom: trimBottom };
        (img as any).__auraTrimTile = frameW | 0;
        (st.anyThis.__propImgs as any[]).push(maskG);
      }

      // Clear camera filters on the child too
      try { (img as any).cameraFilter = 0; } catch { /* ignore */ }

      // If this aura tile is fully opaque, inflate it so a border can show.
      let fullOpaque = false;
      let boxOk = false;
      let rowMin = 0;
      let colMin = 0;
      let edgeMin = 0;
      let edgeTop = 0;
      let edgeBottom = 0;
      let edgeLeft = 0;
      let edgeRight = 0;
      let edgeOk = false;
      let bboxW = 0;
      let bboxH = 0;
      let padScale = 1;
      let padBaked = false;
      let padMode: string | null = null;
      const forceBoxRing =
        (String(baseName || "") === "chest")
          ? false // chest uses solid pad below; leave as is
          : false;
      let padTexKey: string | null = null;
      let padPxApplied = 0;
        if ((PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX | 0) > 0) {
          try {
            const forcePad =
              !!(vis as any)?.focusAuraPadAlways ||
              !!(vis as any)?.auraPadAlways;
            const allowInset =
              !!(vis as any)?.focusAuraAllowInset ||
              !!(vis as any)?.auraAllowInset;
            let padPx =
              (typeof (vis as any)?.focusAuraPadPx === "number")
                ? ((vis as any).focusAuraPadPx | 0)
                : (typeof (vis as any)?.auraPadPx === "number")
                  ? ((vis as any).auraPadPx | 0)
                  : (PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX | 0);
            if (forcePad && padPx <= 0) {
              padPx = (PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX | 0);
            }

            const ringKey = forceBoxRing ? "::box" : "";
            const cacheKey = forcePad
              ? `${auraTk}::${frameName}::pad${padPx}${ringKey}`
              : `${auraTk}::${frameName}${ringKey}`;
            const cached = opaqueCache[cacheKey];
            if (cached) {
              fullOpaque = !!cached.fullOpaque;
              boxOk = !!cached.boxOk;
            rowMin = (cached.rowMin | 0) || 0;
            colMin = (cached.colMin | 0) || 0;
            bboxW = (cached.bboxW | 0) || 0;
            bboxH = (cached.bboxH | 0) || 0;
            edgeMin = (cached.edgeMin | 0) || 0;
            edgeTop = (cached.edgeTop | 0) || 0;
            edgeBottom = (cached.edgeBottom | 0) || 0;
            edgeLeft = (cached.edgeLeft | 0) || 0;
            edgeRight = (cached.edgeRight | 0) || 0;
            edgeOk = !!cached.edgeOk;
            forcedCrop = !!cached.forceCrop;
            statsFrom = (cached.statsFrom === "crop") ? "crop" : "frame";
            padScale = (typeof cached.padScale === "number") ? cached.padScale : 1;
            padBaked = !!cached.padBaked;
            padMode = (typeof cached.padMode === "string") ? cached.padMode : null;
            padTexKey = (typeof cached.padTexKey === "string") ? cached.padTexKey : null;
            padPxApplied = (cached.padPxApplied | 0) || 0;
            if (allowInset) {
              padScale = 1;
              padBaked = false;
              padMode = null;
              padTexKey = null;
              padPxApplied = 0;
            }
            if (forcedCrop && usedFrame) {
              try { img.setFrame("__BASE"); } catch { /* ignore */ }
              img.setCrop(cropX, cropY, frameW, frameH);
              usedFrame = false;
            }
            if (!allowInset && padBaked && padTexKey) {
              try {
                img.setTexture(padTexKey, "__BASE" as any);
                img.clearCrop?.();
                img.setDisplaySize((frameW + padPxApplied * 2) | 0, (frameH + padPxApplied * 2) | 0);
                usedFrame = false;
              } catch { /* ignore */ }
            }
          } else {
            const frameStats = usedFrame ? _dbgFrameOpaqueStats(this.scene, auraTk, frameName) : null;
            const cropStats = _dbgCropOpaqueStats(this.scene, auraTk, cropX, cropY, frameW | 0, frameH | 0);
            let stats = cropStats;
            statsFrom = "crop";
            if (usedFrame && frameStats && frameStats.ok && frameStats.opaque > 0) {
              stats = frameStats;
              statsFrom = "frame";
            }
            if (usedFrame && frameStats && frameStats.ok && frameStats.opaque === 0 && cropStats.ok && cropStats.opaque > 0) {
              forcedCrop = true;
              try { img.setFrame("__BASE"); } catch { /* ignore */ }
              img.setCrop(cropX, cropY, frameW | 0, frameH | 0);
              usedFrame = false;
              stats = cropStats;
              statsFrom = "crop";
            }
            fullOpaque = !!(stats.ok && stats.opaque >= stats.total && stats.aMax > 0);
            boxOk = !!(stats.ok && stats.boxOk);
            rowMin = (stats.rowMin | 0) || 0;
            colMin = (stats.colMin | 0) || 0;
            bboxW = (stats.bboxW | 0) || 0;
            bboxH = (stats.bboxH | 0) || 0;
            edgeMin = (stats.edgeMin | 0) || 0;
            edgeTop = (stats.edgeTop | 0) || 0;
            edgeBottom = (stats.edgeBottom | 0) || 0;
            edgeLeft = (stats.edgeLeft | 0) || 0;
            edgeRight = (stats.edgeRight | 0) || 0;
            edgeOk = !!(stats.edgeOk);
            const forceSolidPad = CHEST_AURA_FORCE_PAD && String(baseName || "") === "chest";
            const skipPad = String(baseName || "") === "stairs_statue";
            const needsPad =
              forcePad ||
              forceBoxRing ||
              forceSolidPad ||
              (!allowInset && (fullOpaque || !boxOk || !edgeOk));
            if (skipPad) {
              padScale = 1;
              padBaked = false;
              padMode = null;
              padTexKey = null;
              padPxApplied = 0;
              opaqueCache[cacheKey] = {
                fullOpaque,
                boxOk,
                rowMin,
                colMin,
                bboxW,
                bboxH,
                edgeMin,
                edgeTop,
                edgeBottom,
                edgeLeft,
                edgeRight,
                edgeOk,
                padScale,
                padMode: null,
                forceCrop: forcedCrop,
                statsFrom,
                padBaked,
                padTexKey,
                padPxApplied
              };
            } else if (needsPad && padPx > 0) {
              let solidPadPx = padPx;
              if (forceSolidPad) {
                const fallback = ((PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX | 0) || 4) * 2;
                solidPadPx = Math.max(fallback, padPx | 0);
              }
              padScale = 1 + ((solidPadPx * 2) / padScaleBase);
              const makeRing = forceBoxRing ? true : !!(fullOpaque || !boxOk || !edgeOk || forceSolidPad);
              const ringMode: "aura" | "box" | "solid" =
                forceSolidPad ? "solid" : (forceBoxRing ? "box" : ((edgeOk || allowInset) ? "aura" : "box"));
              let baked = _buildPaddedAuraTextureRT(
                this.scene,
                auraTk,
                frameName,
                cropX,
                cropY,
                frameW | 0,
                solidPadPx,
                usedFrame,
                makeRing,
                ringMode
              );
              if (!baked.ok) {
                baked = _buildPaddedAuraTexture(
                  this.scene,
                  auraTk,
                  frameName,
                  cropX,
                  cropY,
                  frameW | 0,
                  solidPadPx,
                  usedFrame,
                  makeRing,
                  ringMode
                );
              }
              if (!baked.ok && forceSolidPad) {
                baked = _buildSolidBoxPadTexture(this.scene, `${auraTk}::${frameName}::solid`, frameW | 0, solidPadPx);
                padMode = "solid";
              }
              if (baked.ok && baked.key) {
                try {
                  img.setTexture(baked.key, "__BASE" as any);
                  img.clearCrop?.();
                  img.setDisplaySize((frameW + solidPadPx * 2) | 0, (frameH + solidPadPx * 2) | 0);
                  usedFrame = false;
                  padBaked = true;
                  padTexKey = baked.key;
                  padPxApplied = solidPadPx;
                  padScale = 1;
                  padMode = makeRing ? (ringMode === "box" ? "box" : (ringMode === "solid" ? "solid" : "ring")) : "pad";
                } catch { /* ignore */ }
              }
            } else if (forceSolidPad) {
              // Fallback: force-build a solid pad even if cache was hit and padPx was 0 or skipped.
              const solidPadPx = Math.max((PROP_FOCUS_AURA_FULL_OPAQUE_PAD_PX | 0) * 2, 4);
              let baked = _buildPaddedAuraTextureRT(
                this.scene,
                auraTk,
                frameName,
                cropX,
                cropY,
                frameW | 0,
                solidPadPx,
                usedFrame,
                true,
                "solid"
              );
              if (!baked.ok && forceSolidPad) {
                baked = _buildSolidBoxPadTexture(this.scene, `${auraTk}::${frameName}::solid`, frameW | 0, solidPadPx);
                padMode = "solid";
              }
              if (baked.ok && baked.key) {
                try {
                  img.setTexture(baked.key, "__BASE" as any);
                  img.clearCrop?.();
                  img.setDisplaySize((frameW + solidPadPx * 2) | 0, (frameH + solidPadPx * 2) | 0);
                  usedFrame = false;
                  padBaked = true;
                  padTexKey = baked.key;
                  padPxApplied = solidPadPx;
                  padScale = 1;
                  padMode = "solid";
                  opaqueCache[cacheKey] = {
                    fullOpaque,
                    boxOk,
                    rowMin,
                    colMin,
                    bboxW,
                    bboxH,
                    edgeMin,
                    edgeTop,
                    edgeBottom,
                    edgeLeft,
                    edgeRight,
                    edgeOk,
                    padScale,
                    padMode,
                    forceCrop: forcedCrop,
                    statsFrom,
                    padBaked,
                    padTexKey,
                    padPxApplied
                  };
                } catch { /* ignore */ }
              }
            }
            opaqueCache[cacheKey] = {
              fullOpaque,
              boxOk,
              rowMin,
              colMin,
              bboxW,
              bboxH,
              edgeMin,
              edgeTop,
              edgeBottom,
              edgeLeft,
              edgeRight,
              edgeOk,
              padScale,
              padMode: padMode ?? null,
              forceCrop: forcedCrop,
              statsFrom,
              padBaked,
              padTexKey,
              padPxApplied
            };
          }
        } catch { /* ignore */ }
      }

      // Debug metadata so setPropFocusAuraAt can prove crop math
      (img as any).__dbgAuraCrop = { cropX, cropY, tile, atlasRow, atlasCol, auraFi };
      (img as any).__auraFullOpaque = fullOpaque;
      (img as any).__auraBoxOk = boxOk;
      (img as any).__auraRowMin = rowMin;
      (img as any).__auraColMin = colMin;
      (img as any).__auraBboxW = bboxW;
      (img as any).__auraBboxH = bboxH;
      (img as any).__auraPadScale = padScale;
      (img as any).__auraPadBaked = padBaked;
      (img as any).__auraPadPx = padPxApplied;
      (img as any).__auraPadTexKey = padTexKey;
      (img as any).__auraPadMode = padMode;
      (img as any).__auraIsEdge = isEdge;
      if (DEBUG_PROP_FOCUS_AURA_TRACE && String(baseName || "") === "chest" && padTexKey) {
        try {
          const g: any = (globalThis as any);
          const logKey = `__dbgAuraPadAlpha__${padTexKey}`;
          if (!g[logKey]) {
            g[logKey] = 1;
            const stats = _dbgTextureAlphaStats(this.scene, padTexKey);
            console.log(`[PROPAURA][TRACE] aura-ring-alpha ${JSON.stringify({
              baseName,
              padTexKey,
              padMode,
              stats
            })}`);
          }
        } catch { /* ignore */ }
      }
      if (DEBUG_PROP_FOCUS_AURA_TRACE && String(baseName || "") === "chest") {
        try {
          console.log(`[PROPAURA][TRACE] aura-frame child ${JSON.stringify({
            baseName,
            anchor: { r: anchorR | 0, c: anchorC | 0 },
            auraFi,
            usedFrame,
            forcedCrop,
            padBaked,
            padScale,
            padPx: padPxApplied,
            padTexKey,
            crop: usedFrame ? null : { x: cropX, y: cropY, w: tile, h: tile }
          })}`);
        } catch { /* ignore */ }
      }

      if (DEBUG_PROP_FOCUS_AURA_SCREEN_SAMPLE) {
        try {
          const anyThis: any = st.anyThis as any;
          if (!anyThis.__dbgAuraScreenSample) {
            const sample = this.scene.add.image(40, 40, auraTk);
            const sampleFrame = (img?.frame?.name ?? frameName);
            if (sampleFrame != null) {
              try { sample.setFrame(sampleFrame as any); } catch { /* ignore */ }
            }
            sample.setOrigin(0.5, 0.5);
            sample.setScrollFactor(0, 0);
            sample.setDepth(9999999);
            sample.setAlpha(1);
            sample.setScale(2);
            sample.setTint(0x00ff00);
            anyThis.__dbgAuraScreenSample = sample;
            console.log(`[PROPAURA][SCREEN-SAMPLE] ${JSON.stringify({
              auraTk,
              frame: sampleFrame,
              usedFrame,
              pos: { x: 40, y: 40 }
            })}`);
          }
        } catch { /* ignore */ }
      }
      try {
        const anyThis: any = st.anyThis as any;
        const onceMap: any = anyThis.__dbgPropAuraFrameLog || (anyThis.__dbgPropAuraFrameLog = Object.create(null));
          const logKey = padTexKey
            ? `${auraTk}::${auraFi}::${padTexKey}`
            : `${auraTk}::${auraFi}`;
        if (DEBUG_PROP_FOCUS_AURA_FRAME_LOGS && !onceMap[logKey]) {
          onceMap[logKey] = 1;
          console.log(`[PROPAURA][AURA-FRAME] ${JSON.stringify({
            auraTk,
            auraFi,
            frameName,
            usedFrame,
            frameTotal,
            forcedCrop,
            statsFrom,
            fullOpaque,
            boxOk,
            rowMin,
            colMin,
            edgeMin,
            edgeTop,
            edgeBottom,
            edgeLeft,
            edgeRight,
            edgeOk,
            bbox: { w: bboxW | 0, h: bboxH | 0 },
            padScale,
            padMode,
            padBaked,
            padPx: padPxApplied,
            padTexKey,
            actualFrame: (img?.frame?.name ?? null),
            crop: usedFrame ? null : { x: cropX, y: cropY, w: tile, h: tile },
            img: { x: img.x | 0, y: img.y | 0, w: img.displayWidth | 0, h: img.displayHeight | 0 }
          })}`);
        }
      } catch { /* ignore */ }

      children.push(img);
      (st.anyThis.__propImgs as any[]).push(img);
    }
  }

  (st.anyThis.__propImgs as any[]).push(cont);

  return { cont, baseScale, auraTextureKey: auraTk, auraPngUrl: auraUrl, frameIndices, children, radius: rad };
}

private _propCreateFocusAuraLayers(args: {
  st: {
    anyThis: any;
    byRc: Record<string, { textureKey: string; frameIndex: number }>;
    instByAnchor: Record<string, any>;
    anchorKeyByRc: Record<string, string>;
    tileSize: number;
  };
  anchorR: number;
  anchorC: number;
  baseName: string;
  vis: any;
  textureKey: string;
  sheetCols: number;
  baseRef: { row: number; col: number };
  wTiles: number;
  hTiles: number;
  ox: number;
  oy: number;
  baseDepth: number;
}): any[] {
  if (!PROP_FOCUS_AURA_USE_TILED) return [];
  const layers: any[] = [];
  for (let i = 0; i < PROP_FOCUS_AURA_LAYER_RADII.length; i++) {
    const radius = PROP_FOCUS_AURA_LAYER_RADII[i] | 0;
    const aura = this._propCreateFocusAuraContainer({
      ...args,
      radius,
    });
    if (aura) layers.push(aura);
  }
  return layers;
}

private _propRebuildFocusAuraForInstance(inst: any): boolean {
  if (!inst) return false;

  const vis: any = inst.vis;
  const textureKey = String(inst.textureKey ?? "");
  if (!vis || !textureKey) return false;

  const anyThis: any = this as any;
  const st = {
    anyThis,
    byRc: (anyThis.__propTileInfoByRC || Object.create(null)) as Record<string, { textureKey: string; frameIndex: number }>,
    instByAnchor: (anyThis.__propInstancesByAnchor || Object.create(null)) as Record<string, any>,
    anchorKeyByRc: (anyThis.__propAnchorKeyByRC || Object.create(null)) as Record<string, string>,
    tileSize: (this.atlas?.tileSize ?? 32) | 0,
  };

  const oldLayers: any[] = Array.isArray(inst.focusAuraLayers) ? inst.focusAuraLayers : [];
  const oldCont: any = inst.focusAura || null;
  const oldKids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
  const toRemove = new Set<any>();
  if (oldLayers.length) {
    for (let i = 0; i < oldLayers.length; i++) {
      const layer = oldLayers[i];
      if (layer?.cont) toRemove.add(layer.cont);
      const kids: any[] = Array.isArray(layer?.children) ? layer.children : [];
      for (let k = 0; k < kids.length; k++) toRemove.add(kids[k]);
    }
  } else {
    if (oldCont) toRemove.add(oldCont);
    for (let i = 0; i < oldKids.length; i++) toRemove.add(oldKids[i]);
  }

  try {
    const arr: any[] = (anyThis.__propImgs as any[]) || [];
    if (arr.length && toRemove.size) {
      anyThis.__propImgs = arr.filter(o => !toRemove.has(o));
    }
  } catch { /* ignore */ }

  if (oldLayers.length) {
    for (let i = 0; i < oldLayers.length; i++) {
      const layer = oldLayers[i];
      try { layer?.cont?.destroy?.(); } catch { /* ignore */ }
      const kids: any[] = Array.isArray(layer?.children) ? layer.children : [];
      for (let k = 0; k < kids.length; k++) {
        try { kids[k]?.destroy?.(); } catch { /* ignore */ }
        try { (kids[k] as any)?.__auraTrimMask?.destroy?.(); } catch { /* ignore */ }
      }
    }
  } else {
    try { oldCont?.destroy?.(); } catch { /* ignore */ }
    for (let i = 0; i < oldKids.length; i++) {
      try { oldKids[i]?.destroy?.(); } catch { /* ignore */ }
      try { (oldKids[i] as any)?.__auraTrimMask?.destroy?.(); } catch { /* ignore */ }
    }
  }

  const instOffX = (inst.offsetX ?? 0) | 0;
  const instOffY = (inst.offsetY ?? 0) | 0;

  const auraLayers = this._propCreateFocusAuraLayers({
    st,
    anchorR: (inst.anchorR | 0),
    anchorC: (inst.anchorC | 0),
    baseName: String(inst.baseName ?? ""),
    vis,
    textureKey,
    sheetCols: (inst.sheetCols | 0),
    baseRef: { row: (inst.baseRefRow | 0), col: (inst.baseRefCol | 0) },
    wTiles: (inst.wTiles | 0),
    hTiles: (inst.hTiles | 0),
    ox: (((vis?.offsetXPx ?? 0) | 0) + instOffX),
    oy: (((vis?.offsetYPx ?? 0) | 0) + instOffY),
    baseDepth: (inst.baseDepth | 0),
  });

  if (!auraLayers.length) return false;

  const primary = auraLayers[0];
  inst.focusAuraLayers = auraLayers;
  inst.focusAura = primary?.cont ?? null;
  inst.focusAuraChildren = primary?.children ?? null;
  inst.focusAuraBaseScale = primary?.baseScale ?? PROP_FOCUS_AURA_BASE_SCALE;
  inst.focusAuraTextureKey = primary?.auraTextureKey ?? "";
  inst.focusAuraPngUrl = primary?.auraPngUrl ?? "";
  inst.focusAuraFrameIndices = primary?.frameIndices ?? null;
  inst.__loggedFocusAuraRender = 0;
  inst.__loggedFocusAuraMulti = 0;
  inst.__loggedFocusAuraSceneDiag = 0;
  inst.__loggedFocusAuraPixelProbe = 0;

  const baseName = String(inst.baseName ?? "");
  if (baseName === "chest") {
    const kids: any[] = Array.isArray(primary?.children) ? primary.children : [];
    const child0: any = kids.length ? kids[0] : null;
    const mode = (DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
      String(baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || ""))
      ? "override"
      : "normal";
    console.log(`[PROPAURA][CHEST-COMPARE] ${JSON.stringify({
      mode,
      anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
      hasChildren: !!kids.length,
      padMode: child0?.__auraPadMode ?? null,
      padTexKey: child0?.__auraPadTexKey ?? null,
      childFrame: child0?.frame?.name ?? null,
      displayW: child0?.displayWidth ?? null,
      displayH: child0?.displayHeight ?? null,
      scaleX: child0?.scaleX ?? null,
      scaleY: child0?.scaleY ?? null
    })}`);
  }

  return true;
}


private _propPlaceOneAnchor(
  st: {
    anyThis: any;
    byRc: Record<string, { textureKey: string; frameIndex: number }>;
    instByAnchor: Record<string, any>;
    anchorKeyByRc: Record<string, string>;
    tileSize: number;
  },
  anchorR: number,
  anchorC: number,
  rawKey: string
): void {
  const parsed = _parsePropKey(rawKey);
  const baseName = parsed.baseName;
  if (!baseName) return;

  const vis: any = PROP_VISUALS_BY_NAME[baseName];
  if (!vis) return;
  const collisionOnly = !!(vis as any).collisionOnly;

  const resolved = this._propResolveTextureKeyAndInfo(vis);
  if (!resolved) return;

  const textureKey = resolved.textureKey;
  const cols = resolved.cols;

  const origWTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
  const origHTiles = Math.max(1, (vis.hTiles ?? 1) | 0);
  const isBridgeH = baseName === "bridge_h";
  const isBridgeV = baseName === "bridge_v";
  const bridgeSpan = _parseBridgeSpan(parsed.state);
  let span = 0;
  let wTiles = origWTiles;
  let hTiles = origHTiles;
  if (isBridgeH) {
    span = Math.max(3, (bridgeSpan > 0 ? bridgeSpan : origWTiles));
    wTiles = span | 0;
    hTiles = origHTiles | 0;
  } else if (isBridgeV) {
    span = Math.max(3, (bridgeSpan > 0 ? bridgeSpan : origHTiles));
    wTiles = origWTiles | 0;
    hTiles = ((span + 1) | 0);
  }

  const anchorKey = String(anchorR | 0) + "," + String(anchorC | 0);
  const instOffsets = (st.anyThis as any)?.__propOffsetsByAnchor || null;
  const instOff = instOffsets ? instOffsets[anchorKey] : null;
  const instOffX = (instOff?.offX ?? instOff?.x ?? 0) | 0;
  const instOffY = (instOff?.offY ?? instOff?.y ?? 0) | 0;

  // Optional per-prop offsets (safe even if undefined)
  const ox = (((vis.offsetXPx ?? 0) | 0) + instOffX);
  const oy = (((vis.offsetYPx ?? 0) | 0) + instOffY);
  const depthBiasTiles = (vis.depthBiasTiles ?? 0);
  const depthBias = ((vis.depthBias ?? 0) | 0) + ((depthBiasTiles * st.tileSize * WORLD_DEPTH_Y_SCALE) | 0);

  // Optional vertical crop cutoff (world Y) for sink effects (base bottom + N px).
  const cropCutoffOffsetY = (typeof (vis as any).cropCutoffOffsetYPx === "number")
    ? ((vis as any).cropCutoffOffsetYPx | 0)
    : null;
  let cropBaseBottomY: number | null = null;
  let cropCutoffY: number | null = null;
  if (cropCutoffOffsetY != null) {
    const baseOffY = ((vis.offsetYPx ?? 0) | 0);
    cropBaseBottomY = (((anchorR | 0) * (st.tileSize | 0) + (st.tileSize | 0) + baseOffY) | 0);
    cropCutoffY = ((cropBaseBottomY + (cropCutoffOffsetY | 0)) | 0);
  }

  const { baseRef, usedState } = this._propResolveBaseRef(vis, parsed, cols);

  const animKey = this._propResolveAnimKey(vis, parsed, usedState, wTiles, hTiles, textureKey, cols);
  const overlayInfo = this._propResolveOverlayInfo(vis, textureKey);

  // Depth based on anchor (bottom tile) so whole prop sorts as ONE object.
  // Include oy so y-sort matches visual when offsets are used.
  const anchorYpx = (((anchorR | 0) * st.tileSize + (st.tileSize >> 1) + oy) | 0);
  const baseDepth = ((anchorYpx * WORLD_DEPTH_Y_SCALE) + depthBias) | 0;

  const objs: any[] = [];
  const overlayObjs: any[] = [];
  let overlayActive = false;
  let overlayAlphaDefault: number | null = null;
  let overlayTintDefault: number | null = null;
  let overlayBlendModeDefault: number | "add" | "lighten" | "normal" | null = null;
  let rainbowTween: any = null;

  if (isBridgeH || isBridgeV) {
    if (!this.map) return;

    if (isBridgeH) {
      const topRow = (baseRef.row - ((origHTiles | 0) - 1)) | 0;
      const leftCol = (baseRef.col | 0);
      const rightCol = ((baseRef.col | 0) + ((origWTiles | 0) - 1)) | 0;
      const midCol = ((origWTiles | 0) >= 3) ? ((baseRef.col | 0) + 1) : leftCol;

      for (let dy = 0; dy < (origHTiles | 0); dy++) {
        const worldR = ((anchorR | 0) - ((origHTiles | 0) - 1) + (dy | 0)) | 0;
        if (worldR < 0 || worldR >= (this.map.height | 0)) continue;

        const atlasRow = (topRow + dy) | 0;

        for (let dx = 0; dx < (wTiles | 0); dx++) {
          const worldC = ((anchorC | 0) + (dx | 0)) | 0;
          if (worldC < 0 || worldC >= (this.map.width | 0)) continue;

          const atlasCol =
            (dx === 0) ? leftCol :
            (dx === ((wTiles | 0) - 1)) ? rightCol :
            midCol;

          const frameIndex = ((atlasRow * (cols | 0) + (atlasCol | 0)) | 0);
          const rcKey = String(worldR) + "," + String(worldC);

          st.byRc[rcKey] = { textureKey, frameIndex };
          st.anchorKeyByRc[rcKey] = anchorKey;

          const x = ((worldC * st.tileSize + (st.tileSize >> 1) + ox) | 0);
          const y = ((worldR * st.tileSize + (st.tileSize >> 1) + oy) | 0);

          if (!collisionOnly) {
            const obj = this._propCreateDisplayObj({
              x,
              y,
              textureKey,
              frameIndex,
              depth: baseDepth,
              animKey,
              isAnimAnchorCell: (dx === 0 && dy === 0),
            });

            objs.push(obj);
            (st.anyThis.__propImgs as any[]).push(obj);
          }
        }
      }
    } else {
      const topRow = (baseRef.row - ((origHTiles | 0) - 1)) | 0;
      const midRow = ((baseRef.row | 0) - 1) | 0;
      const botRow = (baseRef.row | 0);

      const tileSize = (st.tileSize | 0);
      const topWalkR = ((anchorR | 0) - ((span | 0) - 1)) | 0;
      const topCenterY = ((topWalkR * tileSize) + (tileSize >> 1)) | 0;
      const botCenterY = (((anchorR | 0) * tileSize) + (tileSize >> 1)) | 0;
      const centerY = Math.idiv(((topCenterY + botCenterY) | 0), 2);
      const halfSpanPx = Math.idiv((((hTiles | 0) - 1) * tileSize) | 0, 2);
      const startCenterY = ((centerY - halfSpanPx) | 0);
      const baseX = (((anchorC | 0) * tileSize + (tileSize >> 1) + ox) | 0);

      for (let i = 0; i < (hTiles | 0); i++) {
        const tileCenterY = ((startCenterY + ((i | 0) * tileSize)) | 0);
        const worldR = Math.idiv(tileCenterY | 0, tileSize);
        const worldC = (anchorC | 0);
        if (worldR < 0 || worldC < 0 || worldR >= (this.map.height | 0) || worldC >= (this.map.width | 0)) continue;

        const atlasRow =
          (i === 0) ? topRow :
          (i === ((hTiles | 0) - 1)) ? botRow :
          midRow;

        const frameIndex = ((atlasRow * (cols | 0) + (baseRef.col | 0)) | 0);
        const rcKey = String(worldR) + "," + String(worldC);

        st.byRc[rcKey] = { textureKey, frameIndex };
        st.anchorKeyByRc[rcKey] = anchorKey;

        if (!collisionOnly) {
          const obj = this._propCreateDisplayObj({
            x: baseX,
            y: ((tileCenterY + oy) | 0),
            textureKey,
            frameIndex,
            depth: baseDepth,
            animKey,
            isAnimAnchorCell: (i === 0),
          });

          objs.push(obj);
          (st.anyThis.__propImgs as any[]).push(obj);
        }
      }
    }

    st.instByAnchor[anchorKey] = {
      anchorR: anchorR | 0,
      anchorC: anchorC | 0,
      rawKey: String(rawKey || ""),
      focusAuraComposition: String(rawKey || ""),

      baseName,
      textureKey,
      sheetCols: cols | 0,
      wTiles,
      hTiles,
      baseRefRow: baseRef.row | 0,
      baseRefCol: baseRef.col | 0,
      offsetX: instOffX | 0,
      offsetY: instOffY | 0,
      cropCutoffOffsetY: (cropCutoffOffsetY != null) ? (cropCutoffOffsetY | 0) : null,
      cropBaseBottomY: (cropBaseBottomY != null) ? (cropBaseBottomY | 0) : null,
      cropCutoffY: (cropCutoffY != null) ? (cropCutoffY | 0) : null,

      objs,
      vis,
      byRc: st.byRc,
      state: usedState,
      baseDepth: baseDepth | 0,

      overlayObjs,
      overlayActive,
      overlayAlphaDefault,
      overlayTintDefault,
      overlayBlendModeDefault,
      rainbowTween,

      focusAuraLayers: null,
      focusAura: null,
      focusAuraChildren: null,
      focusAuraBaseScale: PROP_FOCUS_AURA_BASE_SCALE,

      focusAuraTextureKey: "",
      focusAuraPngUrl: "",
      focusAuraFrameIndices: null,
    };
    this._propApplyCropForInstance(st.instByAnchor[anchorKey]);
    return;
  }

  // Expand upward and rightward from anchor.
  for (let dy = 0; dy < (hTiles | 0); dy++) {
    for (let dx = 0; dx < (wTiles | 0); dx++) {
      const worldR = ((anchorR | 0) - ((hTiles | 0) - 1) + (dy | 0)) | 0;
      const worldC = ((anchorC | 0) + (dx | 0)) | 0;

      if (!this.map) return;
      if (worldR < 0 || worldC < 0 || worldR >= (this.map.height | 0) || worldC >= (this.map.width | 0)) continue;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - ((hTiles | 0) - 1) + dy) | 0;
      const frameIndex = ((atlasRow * (cols | 0) + atlasCol) | 0);

      const rcKey = String(worldR) + "," + String(worldC);

      // Record for collision sampler (initial frame)
      st.byRc[rcKey] = { textureKey, frameIndex };

      // Map this occupied tile -> the anchor tile for focus targeting
      st.anchorKeyByRc[rcKey] = anchorKey;

      const x = ((worldC * st.tileSize + (st.tileSize >> 1) + ox) | 0);
      const y = ((worldR * st.tileSize + (st.tileSize >> 1) + oy) | 0);

      if (!collisionOnly) {
        const obj = this._propCreateDisplayObj({
          x,
          y,
          textureKey,
          frameIndex,
          depth: baseDepth,
          animKey,
          isAnimAnchorCell: (dx === 0 && dy === 0),
        });

        objs.push(obj);
        (st.anyThis.__propImgs as any[]).push(obj);
      }
    }
  }

  if (overlayInfo && !collisionOnly) {
    overlayActive = !!overlayInfo.visibleByDefault;
    overlayAlphaDefault = (typeof overlayInfo.alpha === "number") ? overlayInfo.alpha : 1;
    overlayTintDefault = (typeof overlayInfo.tint === "number") ? overlayInfo.tint : null;
    overlayBlendModeDefault = (overlayInfo.blendMode != null) ? overlayInfo.blendMode : null;

    const overlayDepth = ((baseDepth | 0) + (overlayInfo.depthBias | 0)) | 0;
    const oox = (overlayInfo.offsetX | 0);
    const ooy = (overlayInfo.offsetY | 0);
    const overlayRef = overlayInfo.followState ? baseRef : overlayInfo.ref;
    const blendFallback = (((Phaser as any)?.BlendModes?.NORMAL ?? 0) | 0);
    const blendResolved =
      (overlayBlendModeDefault != null)
        ? _resolveAuraBlendMode(overlayBlendModeDefault, blendFallback)
        : blendFallback;

    for (let dy = 0; dy < (hTiles | 0); dy++) {
      for (let dx = 0; dx < (wTiles | 0); dx++) {
        const worldR = ((anchorR | 0) - ((hTiles | 0) - 1) + (dy | 0)) | 0;
        const worldC = ((anchorC | 0) + (dx | 0)) | 0;

        if (!this.map) return;
        if (worldR < 0 || worldC < 0 || worldR >= (this.map.height | 0) || worldC >= (this.map.width | 0)) continue;

        const atlasCol = (overlayRef.col + dx) | 0;
        const atlasRow = (overlayRef.row - ((hTiles | 0) - 1) + dy) | 0;
        const frameIndex = ((atlasRow * (overlayInfo.cols | 0) + atlasCol) | 0);

        const x = ((worldC * st.tileSize + (st.tileSize >> 1) + ox + oox) | 0);
        const y = ((worldR * st.tileSize + (st.tileSize >> 1) + oy + ooy) | 0);

        const obj = this._propCreateDisplayObj({
          x,
          y,
          textureKey: overlayInfo.textureKey,
          frameIndex,
          depth: overlayDepth,
          animKey: null,
          isAnimAnchorCell: false,
        });

        try { obj.setVisible(overlayActive); } catch { /* ignore */ }
        if (overlayAlphaDefault != null) {
          try { obj.setAlpha(overlayAlphaDefault); } catch { /* ignore */ }
        }
        if (overlayTintDefault != null) {
          try { obj.setTint(overlayTintDefault); } catch { /* ignore */ }
        }
        if (blendResolved != null) {
          try { obj.setBlendMode(blendResolved); } catch { /* ignore */ }
        }

        overlayObjs.push(obj);
        (st.anyThis.__propImgs as any[]).push(obj);
      }
    }
  }

  if (baseName === "chest_rainbow") {
    const tintTargets = overlayObjs.length ? overlayObjs : objs;
    const colorUtil = (Phaser as any)?.Display?.Color ?? null;
    if (tintTargets.length && colorUtil && this.scene?.tweens) {
      const tweenState = { t: 0 };
      const applyTint = (): void => {
        const rgb = colorUtil.HSVToRGB(tweenState.t, 1, 1);
        const tint = (rgb && typeof rgb.color === "number") ? rgb.color : 0xffffff;
        for (let i = 0; i < tintTargets.length; i++) {
          try { tintTargets[i].setTint(tint); } catch { /* ignore */ }
        }
      };
      applyTint();
      rainbowTween = this.scene.tweens.add({
        targets: tweenState,
        t: 1,
        duration: 1800,
        repeat: -1,
        ease: "Linear",
        onUpdate: applyTint,
      });
    }
  }

  // Focus aura (pre-baked outline tiles), created per anchor.
  const auraLayers = collisionOnly ? [] : this._propCreateFocusAuraLayers({
    st,
    anchorR: anchorR | 0,
    anchorC: anchorC | 0,
    baseName,
    vis,
    textureKey,
    sheetCols: cols | 0,
    baseRef,
    wTiles: wTiles | 0,
    hTiles: hTiles | 0,
    ox,
    oy,
    baseDepth: baseDepth | 0,
  });
  const primaryAura = auraLayers.length ? auraLayers[0] : null;

  // "composition X" — use the engine composition key verbatim (includes #state or @frame)
  const composition = String(rawKey || "");

  // Store instance for runtime state/frame swapping (by anchor r,c)
  st.instByAnchor[anchorKey] = {
    anchorR: anchorR | 0,
    anchorC: anchorC | 0,
    rawKey: composition,
    focusAuraComposition: composition,

    baseName,
    textureKey,
    sheetCols: cols | 0,
    wTiles,
    hTiles,
    baseRefRow: baseRef.row | 0,
    baseRefCol: baseRef.col | 0,
    offsetX: instOffX | 0,
    offsetY: instOffY | 0,
    cropCutoffOffsetY: (cropCutoffOffsetY != null) ? (cropCutoffOffsetY | 0) : null,
    cropBaseBottomY: (cropBaseBottomY != null) ? (cropBaseBottomY | 0) : null,
    cropCutoffY: (cropCutoffY != null) ? (cropCutoffY | 0) : null,

    objs,
    vis,
    byRc: st.byRc,
    state: usedState,
    baseDepth: baseDepth | 0,

    overlayObjs,
    overlayActive,
    overlayAlphaDefault,
    overlayTintDefault,
    overlayBlendModeDefault,
    rainbowTween,

    focusAuraLayers: auraLayers.length ? auraLayers : null,
    focusAura: primaryAura ? primaryAura.cont : null,
    focusAuraChildren: primaryAura ? primaryAura.children : null,
    focusAuraBaseScale: primaryAura ? primaryAura.baseScale : PROP_FOCUS_AURA_BASE_SCALE,

    // For logging proof
    focusAuraTextureKey: primaryAura ? primaryAura.auraTextureKey : "",
    focusAuraPngUrl: primaryAura ? primaryAura.auraPngUrl : "",
    focusAuraFrameIndices: primaryAura ? primaryAura.frameIndices : null,
  };
  this._propApplyCropForInstance(st.instByAnchor[anchorKey]);
}

private _propReapplyFocusAuraCache(): void {
  const anyThis: any = this as any;
  const cache: any = anyThis.__propFocusAuraState || null;
  if (!cache) return;

  const keys = Object.keys(cache);
  const activeSet = new Set<string>(keys);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const st = cache[k];
    if (!st || !st.active) continue;
    const parts = k.split(",");
    const r = (st.r != null ? (st.r | 0) : ((parseInt(parts[0] || "0", 10) | 0)));
    const c = (st.c != null ? (st.c | 0) : ((parseInt(parts[1] || "0", 10) | 0)));
    const radius = (st.radius | 0) || 0;
    const depthBias = (st.depthBias | 0) || 0;

    const ok = this.setPropFocusAuraAt(r, c, true, radius, depthBias);
    if (!ok) {
      delete cache[k];
    }
  }

  // Ensure any prop not in the active cache gets hidden.
  try {
    const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
    if (instByAnchor) {
      const allKeys = Object.keys(instByAnchor);
      for (let i = 0; i < allKeys.length; i++) {
        const k = allKeys[i];
        if (activeSet.has(k)) continue;
        const parts = k.split(",");
        const r = (parseInt(parts[0] || "0", 10) | 0);
        const c = (parseInt(parts[1] || "0", 10) | 0);
        this.setPropFocusAuraAt(r, c, false, 0, 0);
      }
    }
  } catch { /* ignore */ }
}

private _propGridMatchesInstances(
  nextByAnchor: Record<string, string>,
  instByAnchor: Record<string, any>
): boolean {
  const nextKeys = Object.keys(nextByAnchor);
  const instKeys = Object.keys(instByAnchor || Object.create(null));
  if (nextKeys.length !== instKeys.length) return false;
  for (let i = 0; i < nextKeys.length; i++) {
    const k = nextKeys[i];
    const inst = instByAnchor[k];
    if (!inst) return false;
    const raw = String(inst.rawKey ?? "");
    if (raw !== String(nextByAnchor[k] || "")) return false;
  }
  return true;
}

private _propShiftDisplayObj(obj: any, dx: number, dy: number, dd: number): void {
  if (!obj) return;
  const nextX = ((obj.x ?? 0) + (dx | 0));
  const nextY = ((obj.y ?? 0) + (dy | 0));
  try {
    if (typeof obj.setPosition === "function") obj.setPosition(nextX, nextY);
    else { obj.x = nextX; obj.y = nextY; }
  } catch {
    obj.x = nextX;
    obj.y = nextY;
  }
  try {
    if (typeof (obj as any).__cropBaseY === "number") {
      (obj as any).__cropBaseY = (((obj as any).__cropBaseY | 0) + (dy | 0)) | 0;
    }
  } catch { /* ignore */ }
  const curDepth = (obj.depth ?? 0) | 0;
  const nextDepth = (curDepth + (dd | 0)) | 0;
  try {
    if (typeof obj.setDepth === "function") obj.setDepth(nextDepth);
    else obj.depth = nextDepth;
  } catch {
    obj.depth = nextDepth;
  }
}

private _debugPadPillarInstances(reason: string): void {
  if (!DEBUG_PAD_SINK_PROP_LOGS) return;
  const anyThis: any = this as any;
  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || Object.create(null);
  let count = 0;
  let minOffX = 999999;
  let maxOffX = -999999;
  let minOffY = 999999;
  let maxOffY = -999999;
  const anchors: string[] = [];
  const keys = Object.keys(instByAnchor);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const inst = instByAnchor[k];
    if (!inst) continue;
    const base = String(inst.baseName || "");
    if (base !== "stairs_statue") continue;
    count++;
    const ox = (inst.offsetX ?? 0) | 0;
    const oy = (inst.offsetY ?? 0) | 0;
    if (ox < minOffX) minOffX = ox;
    if (ox > maxOffX) maxOffX = ox;
    if (oy < minOffY) minOffY = oy;
    if (oy > maxOffY) maxOffY = oy;
    if (anchors.length < 4) anchors.push(k);
  }
  const offXRange = (count > 0) ? `${minOffX}..${maxOffX}` : "n/a";
  const offYRange = (count > 0) ? `${minOffY}..${maxOffY}` : "n/a";
  const anchorStr = anchors.length ? anchors.join("|") : "n/a";
  const sig = `${reason}|${count}|${offXRange}|${offYRange}|${anchorStr}`;
  if (anyThis.__padPillarRenderSig === sig) return;
  anyThis.__padPillarRenderSig = sig;
  console.log(
    `[PAD][PILLAR][RENDER] reason=${String(reason || "")}` +
    ` count=${count | 0} offX=${offXRange} offY=${offYRange} anchors=${anchorStr}`
  );
}

private _debugTilemapAuditTilesets(reason: string): void {
  if (!DEBUG_TILEMAP_AUDIT) return;
  if (!DEBUG_TILEMAP_AUDIT_CONSOLE) return;
  if (!DEBUG_TILEMAP_AUDIT_CONSOLE) return;
  const anyThis: any = this as any;
  const keys = this._gidRanges.map(r => r.textureKey);
  const mageGid = this._firstGidByTextureKey["tiles.magecity"];
  const buildGid = this._firstGidByTextureKey["tiles.build_atlas"];
  const mageGidVal = (typeof mageGid === "number") ? (mageGid | 0) : -1;
  const buildGidVal = (typeof buildGid === "number") ? (buildGid | 0) : -1;
  const keyStr = keys.join("|");
  const sig = `${reason}|${keyStr}|${mageGidVal}|${buildGidVal}`;
  if (anyThis.__tileAuditTilesetSig === sig) return;
  anyThis.__tileAuditTilesetSig = sig;
  console.log(
    `[TILEMAP][AUDIT][TILESETS] reason=${String(reason || "")}` +
    ` count=${keys.length | 0}` +
    ` magecityGid=${mageGidVal | 0}` +
    ` buildGid=${buildGidVal | 0}` +
    ` keys=${keyStr || "n/a"}`
  );
}

private _debugTilemapAuditDecals(reason: string, decalNameGrid: string[][], rows: number, cols: number): void {
  if (!DEBUG_TILEMAP_AUDIT) return;
  if (!DEBUG_TILEMAP_AUDIT_CONSOLE) return;
  const anyThis: any = this as any;
  const texKeys: Record<string, 1> = Object.create(null);
  let trialCells = 0;
  let entranceCells = 0;
  let minR = 999999;
  let maxR = -1;
  let minC = 999999;
  let maxC = -1;
  for (let r = 0; r < rows; r++) {
    const row = decalNameGrid[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < cols; c++) {
      const name = row[c] ?? "";
      if (!name) continue;
      const key = String(name);
      const isTrial = key.indexOf("trial_") === 0;
      const isEntrance = key.indexOf("entrance_") === 0;
      if (!isTrial && !isEntrance) continue;
      if (isTrial) trialCells++;
      if (isEntrance) entranceCells++;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      const vis = DECAL_VISUALS_BY_NAME[key] as any;
      let tk = "";
      if (vis?.textureKey) tk = String(vis.textureKey || "");
      else if (vis?.atlas) tk = String(this.atlas.resolveAtlasTextureKey(String(vis.atlas || "")));
      if (tk) texKeys[tk] = 1;
    }
  }
  const dims = _auditBoxDims(minR, maxR, minC, maxC);
  const tileSize = (this.atlas.tileSize | 0);
  const mageGid = this._firstGidByTextureKey["tiles.magecity"];
  const buildGid = this._firstGidByTextureKey["tiles.build_atlas"];
  const mageGidVal = (typeof mageGid === "number") ? (mageGid | 0) : -1;
  const buildGidVal = (typeof buildGid === "number") ? (buildGid | 0) : -1;
  const texList = Object.keys(texKeys).sort().join("|") || "n/a";
  const sig = `${reason}|${rows}|${cols}|${trialCells}|${entranceCells}|${minR}|${maxR}|${minC}|${maxC}|${texList}|${mageGidVal}|${buildGidVal}`;
  if (anyThis.__tileAuditDecalSig === sig) return;
  anyThis.__tileAuditDecalSig = sig;
  console.log(
    `[TILEMAP][AUDIT][DECALS] reason=${String(reason || "")}` +
    ` rows=${rows | 0} cols=${cols | 0}` +
    ` trialCells=${trialCells | 0}` +
    ` entranceCells=${entranceCells | 0}` +
    ` box=${dims.w | 0}x${dims.h | 0}` +
    ` boxPx=${(dims.w * tileSize) | 0}x${(dims.h * tileSize) | 0}` +
    ` tex=${texList}` +
    ` magecityGid=${mageGidVal | 0}` +
    ` buildGid=${buildGidVal | 0}` +
    ` tilesets=${(this._tilesetsAll?.length ?? 0) | 0}`
  );
}

private _debugTilemapAuditProps(reason: string): void {
  if (!DEBUG_TILEMAP_AUDIT) return;
  if (!DEBUG_TILEMAP_AUDIT_CONSOLE) return;
  const anyThis: any = this as any;
  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || Object.create(null);
  let total = 0;
  let gate = 0;
  let mid = 0;
  let cornerL = 0;
  let cornerR = 0;
  let minR = 999999;
  let maxR = -1;
  let minC = 999999;
  let maxC = -1;
  const keys = Object.keys(instByAnchor);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const inst = instByAnchor[k];
    if (!inst) continue;
    const name = String(inst.baseName || "");
    if (name.indexOf("trial_") !== 0) continue;
    total++;
    if (name === "trial_gate_6x6") gate++;
    else if (name === "trial_fence_mid_2x4") mid++;
    else if (name === "trial_fence_corner_l_2x6") cornerL++;
    else if (name === "trial_fence_corner_r_4x4") cornerR++;
    const r = (inst.anchorR | 0);
    const c = (inst.anchorC | 0);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const dims = _auditBoxDims(minR, maxR, minC, maxC);
  const tileSize = (this.atlas.tileSize | 0);
  const sig = `${reason}|${total}|${gate}|${mid}|${cornerL}|${cornerR}|${minR}|${maxR}|${minC}|${maxC}`;
  if (anyThis.__tileAuditPropSig === sig) return;
  anyThis.__tileAuditPropSig = sig;
  console.log(
    `[TILEMAP][AUDIT][PROPS] reason=${String(reason || "")}` +
    ` total=${total | 0} gate=${gate | 0} mid=${mid | 0}` +
    ` cornerL=${cornerL | 0} cornerR=${cornerR | 0}` +
    ` box=${dims.w | 0}x${dims.h | 0}` +
    ` boxPx=${(dims.w * tileSize) | 0}x${(dims.h * tileSize) | 0}`
  );
}

private _propUpdateOffsetForInstance(inst: any, nextOffX: number, nextOffY: number): void {
  if (!inst) return;
  const curOffX = (inst.offsetX ?? 0) | 0;
  const curOffY = (inst.offsetY ?? 0) | 0;
  const nx = nextOffX | 0;
  const ny = nextOffY | 0;
  const dx = (nx - curOffX) | 0;
  const dy = (ny - curOffY) | 0;
  if ((dx | 0) === 0 && (dy | 0) === 0) return;

  inst.offsetX = nx | 0;
  inst.offsetY = ny | 0;

  const depthDelta = ((dy | 0) * (WORLD_DEPTH_Y_SCALE | 0)) | 0;
  inst.baseDepth = ((inst.baseDepth ?? 0) + depthDelta) | 0;

  const objs: any[] = Array.isArray(inst.objs) ? inst.objs : [];
  for (let i = 0; i < objs.length; i++) {
    this._propShiftDisplayObj(objs[i], dx | 0, dy | 0, depthDelta | 0);
  }

  const overlayObjs: any[] = Array.isArray(inst.overlayObjs) ? inst.overlayObjs : [];
  for (let i = 0; i < overlayObjs.length; i++) {
    this._propShiftDisplayObj(overlayObjs[i], dx | 0, dy | 0, depthDelta | 0);
  }

  const layers: any[] = Array.isArray(inst.focusAuraLayers) ? inst.focusAuraLayers : [];
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    if (!layer) continue;
    this._propShiftDisplayObj(layer.cont, dx | 0, dy | 0, depthDelta | 0);
    const kids: any[] = Array.isArray(layer.children) ? layer.children : [];
    for (let ki = 0; ki < kids.length; ki++) {
      const ch: any = kids[ki];
      this._propShiftDisplayObj(ch, dx | 0, dy | 0, depthDelta | 0);
      try {
        const mask = (ch as any).__auraTrimMask;
        if (mask) this._propShiftDisplayObj(mask, dx | 0, dy | 0, 0);
      } catch { /* ignore */ }
    }
  }

  // Re-apply vertical crop if this prop uses a cutoff (pad/pillar sink).
  this._propApplyCropForInstance(inst);
}

private _propApplyCropForInstance(inst: any): void {
  if (!inst) return;
  const cutoffY = (typeof inst.cropCutoffY === "number") ? (inst.cropCutoffY | 0) : null;
  if (cutoffY == null) return;
  const objs: any[] = Array.isArray(inst.objs) ? inst.objs : [];
  for (let i = 0; i < objs.length; i++) {
    this._propApplyVerticalCropToObj(objs[i], cutoffY | 0);
  }
}

private _propApplyVerticalCropToObj(obj: any, cutoffY: number): void {
  if (!obj) return;
  const baseH = (typeof (obj as any).__cropBaseDisplayH === "number")
    ? (obj as any).__cropBaseDisplayH
    : (obj.displayHeight ?? 0);
  const baseW = (typeof (obj as any).__cropBaseDisplayW === "number")
    ? (obj as any).__cropBaseDisplayW
    : (obj.displayWidth ?? 0);
  if (!(baseH > 0) || !(baseW > 0)) return;

  if (typeof (obj as any).__cropBaseDisplayH !== "number") {
    (obj as any).__cropBaseDisplayH = baseH;
    (obj as any).__cropBaseDisplayW = baseW;
  }
  if (typeof (obj as any).__cropBaseY !== "number") {
    (obj as any).__cropBaseY = (obj.y ?? 0);
  }
  if (typeof (obj as any).__cropBaseVisible !== "boolean") {
    (obj as any).__cropBaseVisible = (obj.visible !== false);
  }

  const baseY = (obj as any).__cropBaseY ?? (obj.y ?? 0);
  const topY = (baseY - (baseH / 2));
  let visH = (cutoffY - topY);

  const baseVisible = ((obj as any).__cropBaseVisible !== false);
  if (!baseVisible) return;

  if (visH <= 0.5) {
    try { obj.setVisible?.(false); } catch { obj.visible = false; }
    return;
  }

  if (visH >= (baseH - 0.5)) {
    try { obj.setVisible?.(true); } catch { obj.visible = true; }
    try { obj.setCrop?.(); } catch { /* ignore */ }
    obj.displayHeight = baseH;
    obj.displayWidth = baseW;
    obj.y = baseY;
    return;
  }

  visH = Math.min(baseH, Math.max(1, visH));
  const frameW = (obj.frame?.cutWidth ?? obj.frame?.width ?? baseW) | 0;
  const frameH = (obj.frame?.cutHeight ?? obj.frame?.height ?? baseH) | 0;
  const ratio = (baseH > 0) ? (visH / baseH) : 0;
  const cropH = Math.max(1, Math.round(frameH * ratio));

  try { obj.setVisible?.(true); } catch { obj.visible = true; }
  try { obj.setCrop?.(0, 0, frameW, cropH); } catch { /* ignore */ }
  obj.displayHeight = visH;
  obj.displayWidth = baseW;
  obj.y = (topY + (visH / 2));
}

syncPropGridByName(propNameGrid: string[][]): void {
  if (!this.map) return;

  const rows = (propNameGrid.length | 0);
  // Some callers may provide sparse rows; find the first populated row to size cols defensively.
  let cols = 0;
  for (let i = 0; i < rows; i++) {
    const row = propNameGrid[i];
    if (Array.isArray(row)) {
      cols = (row.length | 0);
      break;
    }
  }

  const anyThis: any = this as any;
  const nextByAnchor: Record<string, string> = Object.create(null);

  for (let r = 0; r < rows; r++) {
    const row = propNameGrid[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < cols; c++) {
      const rawKey = row[c] ?? "";
      if (!rawKey) continue;
      nextByAnchor[String(r | 0) + "," + String(c | 0)] = String(rawKey || "");
    }
  }

  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || null;
  const offsetsByAnchor: Record<string, { offX?: number; offY?: number; x?: number; y?: number }> =
    anyThis.__propOffsetsByAnchor || Object.create(null);

  if (instByAnchor && this._propGridMatchesInstances(nextByAnchor, instByAnchor)) {
    const keys = Object.keys(instByAnchor);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const inst = instByAnchor[k];
      if (!inst) continue;
      const off = offsetsByAnchor[k] || null;
      const offX = (off?.offX ?? off?.x ?? 0) | 0;
      const offY = (off?.offY ?? off?.y ?? 0) | 0;
      this._propUpdateOffsetForInstance(inst, offX | 0, offY | 0);
    }
    this._debugPadPillarInstances("no-rebuild");
    this._debugTilemapAuditProps("no-rebuild");
    return;
  }

  const st = this._propBeginSync();

  for (let r = 0; r < rows; r++) {
    const row = propNameGrid[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < cols; c++) {
      const rawKey = row[c] ?? "";
      if (!rawKey) continue;

      this._propPlaceOneAnchor(st, r | 0, c | 0, rawKey);
    }
  }

  if (PROP_FOCUS_AURA_CACHE_STATE) {
    try { this._propReapplyFocusAuraCache(); } catch { /* ignore */ }
  }
  this._debugPadPillarInstances("rebuild");
  this._debugTilemapAuditProps("rebuild");
}

replacePropAt(anchorR: number, anchorC: number, rawKey: string): boolean {
  if (!this.map) return false;

  const anyThis: any = this as any;
  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || (anyThis.__propInstancesByAnchor = Object.create(null));
  const byRc: Record<string, any> = anyThis.__propTileInfoByRC || (anyThis.__propTileInfoByRC = Object.create(null));
  const anchorKeyByRc: Record<string, string> = anyThis.__propAnchorKeyByRC || (anyThis.__propAnchorKeyByRC = Object.create(null));

  const anchorKey = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst = instByAnchor[anchorKey];
  if (inst) {
    this._propDestroyInstance(anchorKey, inst, anyThis, byRc, anchorKeyByRc);
  }

  if (!rawKey) return true;

  const st = {
    anyThis,
    byRc,
    instByAnchor,
    anchorKeyByRc,
    tileSize: (this.atlas.tileSize | 0),
  };

  this._propPlaceOneAnchor(st, anchorR | 0, anchorC | 0, rawKey);

  if (PROP_FOCUS_AURA_CACHE_STATE) {
    try {
      const cache = anyThis.__propFocusAuraState || null;
      const cached = cache ? cache[anchorKey] : null;
      if (cached && cached.active) {
        this.setPropFocusAuraAt(anchorR | 0, anchorC | 0, true, cached.radius | 0, cached.depthBias | 0);
      }
    } catch { /* ignore */ }
  }

  return true;
}

removePropAt(anchorR: number, anchorC: number): boolean {
  const anyThis: any = this as any;
  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const anchorKey = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst = instByAnchor[anchorKey];
  if (!inst) return false;

  const byRc: Record<string, any> = anyThis.__propTileInfoByRC || (anyThis.__propTileInfoByRC = Object.create(null));
  const anchorKeyByRc: Record<string, string> = anyThis.__propAnchorKeyByRC || (anyThis.__propAnchorKeyByRC = Object.create(null));
  this._propDestroyInstance(anchorKey, inst, anyThis, byRc, anchorKeyByRc);
  return true;
}


  // ---- internal helpers ----

private _propDestroyInstance(
  anchorKey: string,
  inst: any,
  anyThis: any,
  byRc: Record<string, { textureKey: string; frameIndex: number }>,
  anchorKeyByRc: Record<string, string>
): void {
  const objs: any[] = Array.isArray(inst?.objs) ? inst.objs : [];
  const overlayObjs: any[] = Array.isArray(inst?.overlayObjs) ? inst.overlayObjs : [];
  const objSet = new Set<any>(objs);
  for (let i = 0; i < overlayObjs.length; i++) objSet.add(overlayObjs[i]);
  const auraLayers: any[] = Array.isArray(inst?.focusAuraLayers) ? inst.focusAuraLayers : [];
  if (auraLayers.length) {
    for (let i = 0; i < auraLayers.length; i++) {
      const layer = auraLayers[i];
      if (layer?.cont) objSet.add(layer.cont);
      const kids: any[] = Array.isArray(layer?.children) ? layer.children : [];
      for (let k = 0; k < kids.length; k++) {
        const ch: any = kids[k];
        if (ch) objSet.add(ch);
        const mask: any = (ch as any)?.__auraTrimMask ?? null;
        if (mask) objSet.add(mask);
      }
    }
  } else {
    if (inst?.focusAura) objSet.add(inst.focusAura);
    const kids: any[] = Array.isArray(inst?.focusAuraChildren) ? inst.focusAuraChildren : [];
    for (let i = 0; i < kids.length; i++) {
      const ch: any = kids[i];
      if (ch) objSet.add(ch);
      const mask: any = (ch as any)?.__auraTrimMask ?? null;
      if (mask) objSet.add(mask);
    }
  }
  const destroyOutline = (obj: any): void => {
    if (!obj) return;
    try {
      const outline = (obj as any).__focusOutlineImage;
      if (outline) outline.destroy?.();
    } catch { /* ignore */ }
    try { (obj as any).__focusOutlineImage = null; } catch { /* ignore */ }
  };

  if (Array.isArray(anyThis.__propImgs)) {
    anyThis.__propImgs = (anyThis.__propImgs as any[]).filter(o => !objSet.has(o));
  }

  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    destroyOutline(obj);
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }
  for (let i = 0; i < overlayObjs.length; i++) {
    const obj = overlayObjs[i];
    destroyOutline(obj);
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }

  if (auraLayers.length) {
    for (let i = 0; i < auraLayers.length; i++) {
      const layer = auraLayers[i];
      try { layer?.cont?.destroy?.(); } catch { /* ignore */ }
      const kids: any[] = Array.isArray(layer?.children) ? layer.children : [];
      for (let k = 0; k < kids.length; k++) {
        try { kids[k]?.destroy?.(); } catch { /* ignore */ }
        try { (kids[k] as any)?.__auraTrimMask?.destroy?.(); } catch { /* ignore */ }
      }
    }
  } else {
    if (inst?.focusAura) {
      try { inst.focusAura.destroy?.(); } catch { /* ignore */ }
    }
    if (Array.isArray(inst?.focusAuraChildren)) {
      for (let i = 0; i < inst.focusAuraChildren.length; i++) {
        try { inst.focusAuraChildren[i]?.destroy?.(); } catch { /* ignore */ }
        try { (inst.focusAuraChildren[i] as any)?.__auraTrimMask?.destroy?.(); } catch { /* ignore */ }
      }
    }
  }
  try {
    const hideTimer = (inst as any).__focusAuraHideTimer ?? null;
    if (hideTimer) clearTimeout(hideTimer);
    (inst as any).__focusAuraHideTimer = null;
  } catch { /* ignore */ }
  try {
    const tween = (inst as any).rainbowTween ?? null;
    if (tween) {
      try { tween.stop?.(); } catch { /* ignore */ }
      try { tween.remove?.(); } catch { /* ignore */ }
      try { tween.destroy?.(); } catch { /* ignore */ }
    }
    (inst as any).rainbowTween = null;
  } catch { /* ignore */ }

  const anchorR = (inst.anchorR | 0);
  const anchorC = (inst.anchorC | 0);
  const wTiles = Math.max(1, (inst.wTiles | 0));
  const hTiles = Math.max(1, (inst.hTiles | 0));
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((anchorR | 0) - ((hTiles | 0) - 1) + (dy | 0)) | 0;
      const worldC = ((anchorC | 0) + (dx | 0)) | 0;
      const rcKey = String(worldR) + "," + String(worldC);
      delete byRc[rcKey];
      delete anchorKeyByRc[rcKey];
    }
  }

  if (PROP_FOCUS_AURA_CACHE_STATE) {
    try {
      const cache = anyThis.__propFocusAuraState || null;
      if (cache) delete cache[anchorKey];
    } catch { /* ignore */ }
  }

  const instByAnchor: Record<string, any> = anyThis.__propInstancesByAnchor || Object.create(null);
  delete instByAnchor[anchorKey];
}

private _rebuildTilemap(rows: number, cols: number, tileSize: number): void {
  const anyThis: any = this as any;

  // Destroy old prop images
  const prev: any[] = (anyThis.__propImgs as any[]) || [];
  for (let i = 0; i < prev.length; i++) {
    const obj: any = prev[i];
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }

  anyThis.__propImgs = [];
  anyThis.__propTileInfoByRC = Object.create(null);
  anyThis.__propAnchorKeyByRC = Object.create(null);
  anyThis.__propInstancesByAnchor = Object.create(null);


  // Destroy old layers/map
  try { this.groundLayer?.destroy(); } catch {}
  try { this.chasmLayer?.destroy(); } catch {}
  try { this.chasmOverlayLayer?.destroy(); } catch {}
  try { this.decalLayer?.destroy(); } catch {}
  try { this.propLayer?.destroy(); } catch {}
  try { this.map?.destroy(); } catch {}

  this.map = this.scene.make.tilemap({
    tileWidth: tileSize,
    tileHeight: tileSize,
    width: cols,
    height: rows,
  });

  // Tileset plumbing (unchanged)
  const keysRaw = this.atlas.allTextureKeys.slice();
  const seenEffective: Record<string, 1> = Object.create(null);
  const effectiveByRaw: Record<string, string> = Object.create(null);

  const ordered: string[] = [];
  const primary = this.atlas.primaryTextureKey;

  if (primary) {
    const primaryInfo = this.atlas.getSheetInfo(primary);
    const primaryEff = (primaryInfo?.textureKey || primary).trim();
    if (primaryEff && !seenEffective[primaryEff]) {
      ordered.push(primaryEff);
      seenEffective[primaryEff] = 1;
    }
    effectiveByRaw[primary] = primaryEff || primary;
  }

  keysRaw.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const tk of keysRaw) {
    const raw = (tk || "").trim();
    if (!raw) continue;
    const info = this.atlas.getSheetInfo(raw);
    const eff = (info?.textureKey || raw).trim();
    effectiveByRaw[raw] = eff || raw;
    if (!eff || seenEffective[eff]) continue;
    ordered.push(eff);
    seenEffective[eff] = 1;
  }

  this._tilesetsAll = [];
  this._firstGidByTextureKey = Object.create(null);
  this._gidRanges = [];

  let gidCursor = 0;

  for (const tk of ordered) {
    const info = this.atlas.getSheetInfo(tk);
    if (!info || info.cols <= 0 || info.rows <= 0) continue;

    // Only real tile sheets should be added to the tilemap tileset list.
    // Props/effects live under anims.* and are rendered as sprites, not tiles.
    if (!tk.startsWith("tiles.")) continue;

    // ✅ Only tile-sized sheets should become tilemap tilesets.
    // anims.* (16x16, 64x64, 64x96, etc.) must NOT be added via addTilesetImage(tileSize=32).
    if ((info.tileSize | 0) !== (tileSize | 0)) continue;

    const total = (info.cols | 0) * (info.rows | 0);
    if (total <= 0) continue;

    const ts = this.map.addTilesetImage(tk, tk, tileSize, tileSize, 0, 0, gidCursor);
    if (!ts) continue;

    this._tilesetsAll.push(ts);
    this._firstGidByTextureKey[tk] = gidCursor;

    this._gidRanges.push({
      textureKey: tk,
      firstGid: gidCursor,
      lastExclusive: (gidCursor + total) | 0,
    });

    gidCursor = (gidCursor + total) | 0;
  }

  // Map raw keys (e.g., tiles.magecity) to the effective trimmed tileset gid.
  for (const raw of Object.keys(effectiveByRaw)) {
    const eff = (effectiveByRaw[raw] || raw).trim();
    if (!eff || eff === raw) continue;
    const gid = this._firstGidByTextureKey[eff];
    if (gid != null) this._firstGidByTextureKey[raw] = gid;
  }

  this._debugTilemapAuditTilesets("rebuild");

  // Layers
  this.groundLayer = this.map.createBlankLayer("ground", this._tilesetsAll, 0, 0);
  this.chasmLayer = this.map.createBlankLayer("chasm", this._tilesetsAll, 0, 0);
  this.chasmOverlayLayer = this.map.createBlankLayer("chasmOverlay", this._tilesetsAll, 0, 0);
  this.decalLayer = this.map.createBlankLayer("decals", this._tilesetsAll, 0, 0);

  // Keep props layer only for compatibility/debug, but hide it.
  this.propLayer = this.map.createBlankLayer("props", this._tilesetsAll, 0, 0);
  try {
    this.propLayer.setVisible(false);
    this.propLayer.setAlpha(0);
    this.propLayer.fill(-1);
  } catch {}

  // ✅ Depth rule:
  // tile layers always behind hero; decals walkable behind hero
  this.groundLayer?.setDepth(TILE_LAYER_DEPTH_GROUND);
  this.chasmLayer?.setDepth(TILE_LAYER_DEPTH_CHASM);
  this.chasmOverlayLayer?.setDepth(TILE_LAYER_DEPTH_CHASM_OVERLAY);
  this.decalLayer?.setDepth(TILE_LAYER_DEPTH_DECALS);
}

  private _gidFor(textureKey: string, frameIndex: number): number {
    const tk = textureKey ?? this.atlas.primaryTextureKey;
    const first = this._firstGidByTextureKey[tk];
    if (typeof first !== "number") return -1;
    return (first + (frameIndex | 0)) | 0;
  }

  private _placeVisualTiles(layer: Phaser.Tilemaps.TilemapLayer, anchorR: number, anchorC: number, vis: any): void {
    const atlasOrTk = (vis.textureKey ?? vis.atlas ?? "") as string;
    const textureKey = vis.textureKey
      ? (vis.textureKey as string)
      : this.atlas.resolveAtlasTextureKey(atlasOrTk);

    const info = this.atlas.getSheetInfo(textureKey);
    if (!info) return;

    const wTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
    const hTiles = Math.max(1, (vis.hTiles ?? 1) | 0);

    // vis.ref is BOTTOM-LEFT in atlas
    const baseCol = (vis.ref?.col ?? 0) | 0;
    const baseRow = (vis.ref?.row ?? 0) | 0;

    // World anchor is BOTTOM-LEFT at (anchorR, anchorC)
    // Expand upward (negative r) and rightward (+c)
    for (let dy = 0; dy < hTiles; dy++) {
      for (let dx = 0; dx < wTiles; dx++) {
        const worldR = (anchorR - (hTiles - 1) + dy) | 0;
        const worldC = (anchorC + dx) | 0;

        if (!this.map) continue;
        if (worldR < 0 || worldC < 0 || worldR >= this.map.height || worldC >= this.map.width) continue;

        const atlasCol = (baseCol + dx) | 0;
        const atlasRow = (baseRow - (hTiles - 1) + dy) | 0;

        const frameIndex = (atlasRow * (info.cols | 0) + atlasCol) | 0;
        const gid = this._gidFor(textureKey, frameIndex);
        if (gid < 0) continue;
        if (this.map && typeof (this.map as any).getTilesetAt === "function") {
          const ts = (this.map as any).getTilesetAt(gid);
          if (!ts) continue;
        }

        layer.putTileAt(gid, worldC, worldR);
      }
    }
  }
}



export function dbg_dumpTileLayers(scene: any, tag: string): void {
  try {
    const kids: any[] = scene?.children?.list ?? [];
    const layers = kids.filter(o => o && o.tilemap && o.layer && typeof o.getTileAt === "function");

    console.log(`[DBG][TILES] ${tag} layers=${layers.length}`);
    for (const l of layers) {
      const map = l.tilemap;
      const name = l.name ?? l.layer?.name ?? "(unnamed)";
      const depth = (l as any).depth ?? "(na)";
      const vis = !!l.visible;
      const alpha = l.alpha;
      const tilesets = (map?.tilesets ?? []).map((ts: any) => `${ts?.name ?? "?"}:${ts?.image?.key ?? ts?.imageKey ?? "?"}`).join(", ");

      let nonEmpty = 0;
      let sample: string[] = [];
      const W = map?.width ?? 0;
      const H = map?.height ?? 0;

      // map is small (13x25), so a full scan is cheap and definitive
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = l.getTileAt(x, y, true);
          if (t && typeof t.index === "number" && t.index >= 0) {
            nonEmpty++;
            if (sample.length < 8) sample.push(`${x},${y}:idx=${t.index}`);
          }
        }
      }

      console.log(`[DBG][TILES] layer=${name} depth=${depth} vis=${vis} alpha=${alpha} tilesets=[${tilesets}] size=${W}x${H} nonEmpty=${nonEmpty} sample=[${sample.join(" | ")}]`);
    }
  } catch (e) {
    console.log(`[DBG][TILES] ${tag} ERROR`, e);
  }
}
