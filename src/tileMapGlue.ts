// tileMapGlue.ts
import type Phaser from "phaser";


import type { TileAtlas, TileFamily, AutoShape } from "./tileAtlas";
import {
  DECAL_VISUALS_BY_NAME,
  PROP_VISUALS_BY_NAME,
} from "./tileAtlas";


// ----------------------------------------------------------
// Debug
// ----------------------------------------------------------

const DEBUG_TILES_GLOBAL = true;



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

// ----------------------------------------------------------
// Prop focus aura (tile-based outline sheets)
// ----------------------------------------------------------
// Goal: for interactable props, show a pre-baked outline from a dedicated
// "aura" tilesheet underneath the prop when it is in focus.
//
// Naming convention (auto-resolved):
//   <propTextureKey> + one of these suffixes
// Example:
//   tiles.props -> tiles.props_aura
const PROP_FOCUS_AURA_TEXTURE_SUFFIXES = [
  "_aura_r2",
  "_aura",
  "_outline",
  "_hl",
] as const;

// Scale tuning:
// - We always scale the outline up slightly so it is visible even if the
//   pre-baked outline hugs the prop.
// - Engine can further widen/narrow via focusOutlineRadius.
const PROP_FOCUS_AURA_BASE_SCALE = 1.12;
const PROP_FOCUS_AURA_RADIUS_SCALE = 0.06; // each radius step adds this much scale

// Gentle alpha pulse for interactable outlines.
const PROP_FOCUS_AURA_PULSE_PERIOD_MS = 5000;
const PROP_FOCUS_AURA_PULSE_ALPHA_MIN = 0;
const PROP_FOCUS_AURA_PULSE_ALPHA_MAX = 0.9;

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
const DEBUG_PROP_FOCUS_AURA = true;

const __warnedMissingPropAuraSheet: Record<string, 1> = Object.create(null);

// Log once per prop instance the first time its focus aura is actually shown.
const LOG_PROP_FOCUS_AURA_RENDER_ONCE = true;

// Cache last focus state per prop anchor so aura can be re-applied after decor resyncs.
const PROP_FOCUS_AURA_CACHE_STATE = true;

const DEBUG_PROP_FOCUS_AURA_DEPTH = true;

// Debug-only: if true, shove aura in front of *everything* (including prop) to prove depth is the issue.
// If you still can't see it when forced front, it's NOT a depth problem.
const DEBUG_PROP_FOCUS_AURA_FORCE_FRONT = false;

// If forcing front, how far in front of the prop to push it.
const DEBUG_PROP_FOCUS_AURA_FORCE_FRONT_BUMP = 2000000;


const DEBUG_PROP_FOCUS_AURA_WORLD_MARKER = false;
const DEBUG_PROP_FOCUS_AURA_NEON = false;
const DEBUG_PROP_FOCUS_AURA_SCENE_DIAG = false;
const LOG_PROP_FOCUS_AURA_SCENE_DIAG_ONCE = false;
const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE = false;
const LOG_PROP_FOCUS_AURA_PIXEL_PROBE_ONCE = false;
const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT = false;
const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_ENTER_LOG = false;
const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_TIMEOUT_MS = 250;
const DEBUG_PROP_FOCUS_AURA_PROP_TINT = false;
const DEBUG_PROP_FOCUS_AURA_POSTRENDER_PROBE = false;
const DEBUG_PROP_FOCUS_AURA_SCREEN_SAMPLE = false;
const DEBUG_PROP_FOCUS_AURA_PIN_SCREEN = false;
const DEBUG_PROP_FOCUS_AURA_HUD_PREVIEW = false;
const DEBUG_PROP_FOCUS_AURA_FORCE_VISIBLE_NAMES = new Set<string>();
const DEBUG_PROP_FOCUS_AURA_TRACE = false;
const DEBUG_PROP_FOCUS_AURA_OVERRIDE = {
  enabled: true,
  fromBaseName: "chest",
  auraTextureKey: "tiles.terrain_atlas_aura_r2",
  frameIndex: 499,
};
const DEBUG_PROP_FOCUS_AURA_VERBOSE = false;
const CHEST_AURA_PAD_PX = 2;
const CHEST_AURA_PAD_KEY = "__chestAuraPadBox__";
const DEBUG_PROP_FOCUS_AURA_BLINK = false;


type ParsedPropKey = {
  baseName: string;
  state: string | null;
  explicitFrameIndex: number | null;
};

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

function _frameIndexFromTileRef(cols: number, ref: { row: number; col: number }): number {
  return ((ref.row | 0) * (cols | 0) + (ref.col | 0)) | 0;
}

function _propFocusAuraPulseAlpha(scene: Phaser.Scene, nowMs?: number): number {
  const t = (typeof nowMs === "number")
    ? nowMs
    : (((scene as any)?.time?.now ?? Date.now()) | 0);

  const minA = Math.max(0, Math.min(1, PROP_FOCUS_AURA_PULSE_ALPHA_MIN));
  const maxA = Math.max(minA, Math.min(1, PROP_FOCUS_AURA_PULSE_ALPHA_MAX));
  const span = Math.max(0, maxA - minA);
  const period = Math.max(500, PROP_FOCUS_AURA_PULSE_PERIOD_MS | 0);

  const phase = ((t % period) / period) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) * 0.5; // 0..1

  return minA + span * wave;
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
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
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
        const ctx = canvas.getContext("2d");
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
    const ctx = canvas.getContext("2d");
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
    if (!DEBUG_TILES_GLOBAL || !localDebug) return;
    console.log(...args);
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
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false
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
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false
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
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false
      };
    }

    // Draw region to a tiny canvas and count alpha
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
    if (!ctx) {
      return {
        ok: false, reason: "no-canvas-ctx",
        texExists, imgW, imgH, frameTotal,
        req: frame, resolved, hasFrame: true,
        w: sw, h: sh, opaque: 0, total: 0, aMax: 0, aMin: 0,
        minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
        rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false
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
      rowMin, colMin, rowsWithPixels, colsWithPixels, boxOk
    };
  } catch {
    return {
      ok: false, reason: "exception",
      texExists: false, imgW: 0, imgH: 0, frameTotal: 0,
      req: frame, resolved: null, hasFrame: false,
      w: 0, h: 0, opaque: 0, total: 0, aMax: 0, aMin: 0,
      minX: -1, minY: -1, maxX: -1, maxY: -1, bboxW: 0, bboxH: 0,
      rowMin: 0, colMin: 0, rowsWithPixels: 0, colsWithPixels: 0, boxOk: false
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
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
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
): { ok: boolean; key: string; w: number; h: number } {
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
      return { ok: true, key, w, h };
    }
    const rt: any = (scene as any)?.add?.renderTexture?.(0, 0, out, out);
    if (!rt) return { ok: false, key, w: 0, h: 0 };
    rt.setVisible(false);
    rt.fill(0xffffff, 1);
    rt.saveTexture?.(key);
    rt.destroy?.();
    const texObj: any = texMgr?.get?.(key);
    const img: any = texObj?.getSourceImage?.() ?? texObj?.source?.[0]?.image ?? null;
    const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
    const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;
    return { ok: !!w && !!h, key, w, h };
  } catch {
    return { ok: false, key, w: 0, h: 0 };
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

    if (v === 1) {
        // walls → chasm rim family
        return "chasm_light";
    }

    // everything else → light-brown dirt
    return "ground_light";
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
  if (cols <= 0) return false;

  const tr = _tileRefFromFrameIndex(cols, frameIndex | 0);
  const baseRef = { row: tr.row | 0, col: tr.col | 0 };

  const wTiles = (inst.wTiles | 0) || 1;
  const hTiles = (inst.hTiles | 0) || 1;

  const byRc: any = inst.byRc || anyThis.__propTileInfoByRC || null;

  let objIdx = 0;
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((inst.anchorR | 0) - (hTiles - 1) + dy) | 0;
      const worldC = ((inst.anchorC | 0) + dx) | 0;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
      const fi = (atlasRow * cols + atlasCol) | 0;

      const obj: any = inst.objs?.[objIdx++] ?? null;
      if (obj) {
        try { obj.anims?.stop?.(); } catch { /* ignore */ }
        try { obj.setFrame?.(fi); } catch { /* ignore */ }
      }

      if (byRc) {
        byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex: fi };
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


/**
 * Show/hide the prop's pre-baked focus aura (outline) at tile r,c.
 *
 * Returns true if an aura existed and was updated.
 */


setPropFocusAuraAt(r: number, c: number, active: boolean, radius: number, depthBias: number): boolean {
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
      if (active && baseName === "chest" && !(inst as any).__forceChestAuraRebuild) {
        (inst as any).__forceChestAuraRebuild = 1;
        const rebuilt = this._propRebuildFocusAuraForInstance(inst);
        console.log(`[PROPAURA][CHEST-REBUILD] ${JSON.stringify({
          baseName,
          rawKey: inst.rawKey ?? "",
          rebuilt
        })}`);
      }
      if (DEBUG_PROP_FOCUS_AURA_FORCE_VISIBLE_NAMES.has(baseName) && !active) {
        active = true;
        if (!(inst as any).__loggedFocusAuraForceVisible) {
          (inst as any).__loggedFocusAuraForceVisible = 1;
          console.log(`[PROPAURA][FORCE-VISIBLE] ${JSON.stringify({
            baseName,
            rawKey: inst.rawKey ?? "",
            anchor: { r: inst.anchorR | 0, c: inst.anchorC | 0 },
          })}`);
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

    try {
      if (active && inst?.vis && ((inst.vis as any).focusAuraPadAlways || (inst.vis as any).auraPadAlways)) {
        const kids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
        const k0: any = (kids && kids.length) ? kids[0] : null;
        const padBaked = !!(k0 as any)?.__auraPadBaked;
        const padScale = (typeof (k0 as any)?.__auraPadScale === "number") ? (k0 as any).__auraPadScale : 1;
        const needsRebuild = !kids.length || (!padBaked && padScale <= 1.01);
        if (needsRebuild) {
          const rebuilt = this._propRebuildFocusAuraForInstance(inst);
          if (rebuilt && !(inst as any).__loggedFocusAuraRebuild) {
            (inst as any).__loggedFocusAuraRebuild = 1;
            console.log(`[PROPAURA][REBUILD] ${JSON.stringify({
              baseName: inst.baseName ?? "",
              rawKey: inst.rawKey ?? "",
              padBaked,
              padScale
            })}`);
          }
        }
      }
      if (DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled && String(inst.baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || "")) {
        const key = `${DEBUG_PROP_FOCUS_AURA_OVERRIDE.auraTextureKey}::${DEBUG_PROP_FOCUS_AURA_OVERRIDE.frameIndex}`;
        if ((inst as any).__dbgAuraOverrideKey !== key) {
          (inst as any).__dbgAuraOverrideKey = key;
          const rebuilt = this._propRebuildFocusAuraForInstance(inst);
          console.log(`[PROPAURA][OVERRIDE-REBUILD] ${JSON.stringify({
            baseName: inst.baseName ?? "",
            rawKey: inst.rawKey ?? "",
            key,
            rebuilt
          })}`);
        }
      }
    } catch { /* ignore */ }

    const cont: any = inst.focusAura || null;
    const children: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
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
    try { cont?.setVisible?.(false); } catch { /* ignore */ }
    if (children.length) {
      try {
        for (let i = 0; i < children.length; i++) {
          children[i]?.setVisible?.(false);
        }
      } catch { /* ignore */ }
    }

    // Also hide the debug marker (if we created one)
    try {
      const mk: any = inst.__dbgAuraWorldMarker || null;
      if (mk) mk.setVisible(false);
    } catch { /* ignore */ }
    try { (inst as any).__loggedFocusAuraName = 0; } catch { /* ignore */ }
    try { (inst as any).__loggedFocusAuraMulti = 0; } catch { /* ignore */ }

    return true;
  }

  const auraAlpha = _propFocusAuraPulseAlpha(this.scene, now);

  // Compute scale/depth
  const rad = Math.max(0, (radius | 0));
  const scale = Math.max(
    0.01,
    (inst.focusAuraBaseScale ?? PROP_FOCUS_AURA_BASE_SCALE) + (rad * PROP_FOCUS_AURA_RADIUS_SCALE)
  );
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

  if (DEBUG_PROP_FOCUS_AURA_BLINK && children.length) {
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
          for (let i = 0; i < children.length; i++) {
            const ch: any = children[i];
            ch?.setAlpha?.(on ? 1 : 0.4);
          }
        }
      });
      (inst as any).__focusAuraBlinkEvt = evt;
    } catch { /* ignore */ }
  }

  const wasVisible = !!cont?.visible;

  try {
    if (!(inst as any).__loggedFocusAuraName) {
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

  // Apply
  try {
    cont?.setVisible?.(true);
    cont?.setDepth?.(depth);
    cont?.setAlpha?.(auraAlpha);
  } catch { /* ignore */ }
    // Chest: force a simple solid pad texture sized slightly larger than the tile
    if (active && String(inst.baseName || "") === "chest" && children.length) {
      try {
        const padKey = _ensureChestAuraPadTexture(this.scene, tileSize, CHEST_AURA_PAD_PX);
        const ch: any = children[0];
        ch?.setTexture?.(padKey);
        ch?.setFrame?.("__BASE");
        ch?.setDisplaySize?.(tileSize + CHEST_AURA_PAD_PX * 2, tileSize + CHEST_AURA_PAD_PX * 2);
        (ch as any).__auraPadBaked = true;
        (ch as any).__auraPadMode = "box";
        (ch as any).__auraPadTexKey = padKey;
        (ch as any).__auraPadScale = 1;
      } catch { /* ignore */ }
    }
    if (children.length) {
      try {
        for (let i = 0; i < children.length; i++) {
          const ch: any = children[i];
          if (!ch) continue;
          const isMulti = ((inst.wTiles | 0) > 1 || (inst.hTiles | 0) > 1);
          const isEdge = !!(ch as any).__auraIsEdge;
          const padScale = (typeof (ch as any).__auraPadScale === "number") ? (ch as any).__auraPadScale : 1;
          const padBaked = !!(ch as any).__auraPadBaked;
          const blendMode =
            ((Phaser as any)?.BlendModes?.LIGHTEN ??
              (Phaser as any)?.BlendModes?.SCREEN ??
              (Phaser as any)?.BlendModes?.NORMAL ??
              0);
          let finalScale = padBaked ? scale : ((padScale > scale) ? padScale : scale);
          if (isMulti && finalScale > 1 && !isEdge) {
            // Avoid overlaps between adjacent aura tiles on multi-tile props; keep padding on perimeter.
            finalScale = 1;
          }
          // For chests, we want the pad box to stay exactly its authored size (no extra scale).
          if (String(inst.baseName || "") === "chest") {
            finalScale = 1;
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
          ch.setDepth?.(depth);
          ch.setAlpha?.(auraAlpha);
          try { ch.setBlendMode?.(blendMode); } catch { /* ignore */ }
          if (String(inst.baseName || "") === "chest") {
            try { ch.setTint?.(0xffffff); } catch { /* ignore */ }
            try { ch.setBlendMode?.((Phaser as any).BlendModes?.ADD ?? 1); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
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
      if (overrideEnabled && children.length) {
        const dx = hasTarget ? ((overrideTarget.c | 0) - (inst.anchorC | 0)) * tileSize : 0;
        const dy = hasTarget ? ((overrideTarget.r | 0) - (inst.anchorR | 0)) * tileSize : 0;
        for (let i = 0; i < children.length; i++) {
          const ch: any = children[i];
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
      if (children.length) {
        for (let i = 0; i < children.length; i++) {
          children[i]?.setScrollFactor?.(0, 0);
          children[i]?.setPosition?.(80, 80);
          children[i]?.setScale?.(2);
          children[i]?.setDepth?.(9999999);
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
      const kids: any[] = children.length ? children : ((cont?.list ?? []) as any[]);
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
  valueToFamily: (v: number) => TileFamily | ""
): {
  rawWalls: number;
  rawFloors: number;
  rawSig: number;
  famChasmCells: number;
  famNonChasmCells: number;
  fallbackFloorFamily: TileFamily;
} {
  let rawWalls = 0;
  let rawFloors = 0;
  let rawSig = 0;

  let famChasmCells = 0;
  let famNonChasmCells = 0;

  let fallbackFloorFamily: TileFamily = "ground_light";
  let fallbackFound = false;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      if (v === 1) rawWalls++;
      else rawFloors++;

      rawSig = (((rawSig << 5) - rawSig) + v + ((r + 1) * 131) + ((c + 1) * 17)) | 0;

      const fam = valueToFamily(v);
      if (fam && isChasmLikeFamily(fam as TileFamily)) famChasmCells++;
      else famNonChasmCells++;

      if (!fallbackFound && fam && !isChasmLikeFamily(fam as TileFamily)) {
        fallbackFloorFamily = fam as TileFamily;
        fallbackFound = true;
      }
    }
  }

  return { rawWalls, rawFloors, rawSig, famChasmCells, famNonChasmCells, fallbackFloorFamily };
}

private _paintFloorUnderlayEverywhere(
  grid: number[][],
  rows: number,
  cols: number,
  valueToFamily: (v: number) => TileFamily | "",
  fallbackFloorFamily: TileFamily
): void {
  if (!this.groundLayer) return;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const fam0 = valueToFamily(v);

      const floorFamily =
        (fam0 && !isChasmLikeFamily(fam0 as TileFamily)) ? (fam0 as TileFamily) : fallbackFloorFamily;

      const def =
        this.atlas.getRandomVariant(floorFamily, "center") ||
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
  valueToFamily: (v: number) => TileFamily | ""
): void {
  if (!this.chasmLayer || !this.chasmOverlayLayer) return;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const family = valueToFamily(v);
      if (!family || !isChasmLikeFamily(family as TileFamily)) continue;

      const mask = computeNeighborMask(grid, r, c, family as TileFamily, valueToFamily);
      const shape: AutoShape = autoShapeFromMask(mask);
      const inner = innerCornerFromMask(mask);

      // ---- choose BASE tile ----
      let baseDef: { textureKey: string; frameIndex: number } | null = null;
      let usedInnerAsBase = false;

      // Prefer inner-corner as a BASE replacement tile if it exists
      if (inner !== "none") {
        const innerDef =
          this.atlas.getRandomVariant(family as TileFamily, inner as any) ||
          this.atlas.getAutoTile(family as TileFamily, inner as any);

        if (innerDef) {
          baseDef = innerDef;
          usedInnerAsBase = true;
        }
      }

      // Singleton: use decor slots
      if (!baseDef && shape === "single") {
        const deco = this.atlas.getRandomDecorForFamily(family as TileFamily);
        if (deco) baseDef = deco;
      }

      // Normal shape lookup
      if (!baseDef) {
        baseDef =
          this.atlas.getRandomVariant(family as TileFamily, shape) ||
          this.atlas.getAutoTile(family as TileFamily, shape) ||
          this.atlas.getRandomVariant(family as TileFamily, "center") ||
          this.atlas.getAutoTile(family as TileFamily, "center") ||
          null;
      }

      if (!baseDef) continue;

      const gid = this._gidFor(baseDef.textureKey, baseDef.frameIndex);
      if (gid >= 0) this.chasmLayer.putTileAt(gid, c, r);

      // ---- overlay ONLY if we did NOT use inner as base ----
      if (inner !== "none" && !usedInnerAsBase) {
        const innerDef =
          this.atlas.getRandomVariant(family as TileFamily, inner as any) ||
          this.atlas.getAutoTile(family as TileFamily, inner as any);

        if (innerDef) {
          const innerGid = this._gidFor(innerDef.textureKey, innerDef.frameIndex);
          if (innerGid >= 0) this.chasmOverlayLayer.putTileAt(innerGid, c, r);
        }
      }
    }
  }
}


syncFromEngineGrid(grid: number[][]): void {
  const localDebug = this.opts.debugLocal ?? true;
  const valueToFamily = this.opts.tileValueToFamily ?? defaultTileValueToFamily;

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

  const stats = this._analyzeGridForRender(grid, rows, cols, valueToFamily);

  this._paintFloorUnderlayEverywhere(grid, rows, cols, valueToFamily, stats.fallbackFloorFamily);
  this._paintChasmLike(grid, rows, cols, valueToFamily);

  // stash last snapshot for other debug consumers if needed
  try {
    const anyThis: any = this as any;
    anyThis.__lastGridRows = rows | 0;
    anyThis.__lastGridCols = cols | 0;
    anyThis.__lastGridWalls = stats.rawWalls | 0;
    anyThis.__lastGridSig = stats.rawSig | 0;
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
      famChasmCells: stats.famChasmCells,
      famNonChasmCells: stats.famNonChasmCells,
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

  if (animKey && isAnimAnchorCell) {
    const spr = this.scene.add.sprite(x, y, textureKey, frameIndex);
    spr.setOrigin(0.5, 0.5);
    spr.setDepth(depth);
    try { spr.anims?.play?.(animKey); } catch { /* ignore */ }
    return spr;
  }

  const img = this.scene.add.image(x, y, textureKey, frameIndex);
  img.setOrigin(0.5, 0.5);
  img.setDepth(depth);
  return img;
}


private _propResolveFocusAuraTextureKey(propTextureKey: string, vis: any): string | null {
  // 1) Explicit override (either a full textureKey or an alias supported by tileAtlas)
  const explicit = (vis?.auraTextureKey ?? vis?.focusAuraTextureKey ?? "") as any;
  if (explicit && typeof explicit === "string" && explicit.trim()) {
    const tk = this.atlas.resolveAtlasTextureKey(explicit.trim());
    if (this.atlas.getSheetInfo(tk)) return tk;
  }

  const alias = (vis?.auraAtlas ?? vis?.focusAuraAtlas ?? "") as any;
  if (alias && typeof alias === "string" && alias.trim()) {
    const tk = this.atlas.resolveAtlasTextureKey(alias.trim());
    if (this.atlas.getSheetInfo(tk)) return tk;
  }

  // 2) Convention: propTextureKey + suffix
  for (const suf of PROP_FOCUS_AURA_TEXTURE_SUFFIXES) {
    const tk = String(propTextureKey) + String(suf);
    if (this.atlas.getSheetInfo(tk)) return tk;
  }

  // 3) Convention: tiles.<name> -> tiles.<name>_aura (etc)
  // (already covered by suffix list, but keep a safe fallback for weird keys)
  const base = String(propTextureKey || "");
  if (base.startsWith("tiles.")) {
    const name = base.slice("tiles.".length);
    for (const suf of PROP_FOCUS_AURA_TEXTURE_SUFFIXES) {
      const tk = `tiles.${name}${suf}`;
      if (this.atlas.getSheetInfo(tk)) return tk;
    }
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
}): { cont: any; baseScale: number; auraTextureKey: string; auraPngUrl: string; frameIndices: number[]; children: any[] } | null {
  const { st, anchorR, anchorC, baseName, vis, textureKey, baseRef, wTiles, hTiles, ox, oy, baseDepth } = args;

  let auraTk = this._propResolveFocusAuraTextureKey(textureKey, vis);
  if (!auraTk) return null;

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
  if (!auraInfo || auraCols <= 0) return null;

  if (override) {
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

  const tile = (st.tileSize | 0);
  const half = (tile >> 1);

  const aox = ((vis?.auraOffsetXPx ?? vis?.focusAuraOffsetXPx ?? 0) | 0);
  const aoy = ((vis?.auraOffsetYPx ?? vis?.focusAuraOffsetYPx ?? 0) | 0);

  const centerC = (anchorC + (Math.max(1, wTiles | 0) - 1) / 2);
  const centerR = (anchorR - (Math.max(1, hTiles | 0) - 1) / 2);
  const centerX = ((centerC * tile + half + ox + aox) | 0);
  const centerY = ((centerR * tile + half + oy + aoy) | 0);

  // Use a controller container (not used for rendering) so we have a stable handle.
  const cont = this.scene.add.container(0, 0);
  cont.setVisible(false);

  const baseScale = Math.max(
    0.01,
    (typeof vis?.auraScale === "number"
      ? vis.auraScale
      : (typeof vis?.focusAuraScale === "number"
        ? vis.focusAuraScale
        : PROP_FOCUS_AURA_BASE_SCALE))
  );
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

      const cropX = (atlasCol * tile) | 0;
      const cropY = (atlasRow * tile) | 0;

      const img = this.scene.add.image(worldX, worldY, auraTk);
      img.setOrigin(0.5, 0.5);
      img.setVisible(false);
      // Prefer spritesheet frames when available; crop is a fallback for non-framed textures.
      let usedFrame = false;
      let forcedCrop = false;
      let statsFrom: "frame" | "crop" = "frame";
      let frameName = String(auraFi);
      let frameTotal: any = null;
      try {
        const texObj: any = (this.scene as any)?.textures?.get?.(auraTk);
        frameTotal = (texObj?.frameTotal ?? null);
        try {
          img.setFrame(frameName);
          usedFrame = (img?.frame?.name === frameName);
        } catch { /* ignore */ }
        if (!usedFrame) {
          try {
            img.setFrame(auraFi as any);
            usedFrame = (String(img?.frame?.name ?? "") === frameName);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      if (!usedFrame) {
        // Crop against the full texture frame.
        try { img.setFrame("__BASE"); } catch { /* ignore */ }
        img.setCrop(cropX, cropY, tile, tile);
      }
      img.setDisplaySize(tile, tile);
      if (trimLeft || trimRight || trimTop || trimBottom) {
        const maskG = this.scene.add.graphics();
        const maskW = Math.max(1, tile - trimLeft - trimRight);
        const maskH = Math.max(1, tile - trimTop - trimBottom);
        maskG.fillStyle(0xffffff, 1);
        maskG.fillRect(worldX - half + trimLeft, worldY - half + trimTop, maskW, maskH);
        maskG.setVisible(false);
        const geomMask = maskG.createGeometryMask();
        img.setMask(geomMask);
        (img as any).__auraTrimMask = maskG;
        (img as any).__auraTrim = { left: trimLeft, right: trimRight, top: trimTop, bottom: trimBottom };
        (img as any).__auraTrimTile = tile;
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
            if (forcedCrop && usedFrame) {
              try { img.setFrame("__BASE"); } catch { /* ignore */ }
              img.setCrop(cropX, cropY, tile, tile);
              usedFrame = false;
            }
            if (padBaked && padTexKey) {
              try {
                img.setTexture(padTexKey, "__BASE" as any);
                img.clearCrop?.();
                img.setDisplaySize((tile + padPxApplied * 2) | 0, (tile + padPxApplied * 2) | 0);
                usedFrame = false;
              } catch { /* ignore */ }
            }
          } else {
            const frameStats = usedFrame ? _dbgFrameOpaqueStats(this.scene, auraTk, frameName) : null;
            const cropStats = _dbgCropOpaqueStats(this.scene, auraTk, cropX, cropY, tile, tile);
            let stats = cropStats;
            statsFrom = "crop";
            if (usedFrame && frameStats && frameStats.ok && frameStats.opaque > 0) {
              stats = frameStats;
              statsFrom = "frame";
            }
            if (usedFrame && frameStats && frameStats.ok && frameStats.opaque === 0 && cropStats.ok && cropStats.opaque > 0) {
              forcedCrop = true;
              try { img.setFrame("__BASE"); } catch { /* ignore */ }
              img.setCrop(cropX, cropY, tile, tile);
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
            const forceSolidPad = String(baseName || "") === "chest";
            const skipPad = String(baseName || "") === "stairs_statue";
            const needsPad = forcePad || fullOpaque || !boxOk || !edgeOk || forceBoxRing || forceSolidPad;
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
              padScale = 1 + ((solidPadPx * 2) / tile);
              const makeRing = forceBoxRing ? true : !!(fullOpaque || !boxOk || !edgeOk || forceSolidPad);
              const ringMode: "aura" | "box" | "solid" = forceSolidPad ? "solid" : (forceBoxRing ? "box" : (edgeOk ? "aura" : "box"));
              let baked = _buildPaddedAuraTextureRT(
                this.scene,
                auraTk,
                frameName,
                cropX,
                cropY,
                tile,
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
                  tile,
                  solidPadPx,
                  usedFrame,
                  makeRing,
                  ringMode
                );
              }
              if (!baked.ok && forceSolidPad) {
                baked = _buildSolidBoxPadTexture(this.scene, `${auraTk}::${frameName}::solid`, tile, solidPadPx);
                padMode = "solid";
              }
              if (baked.ok && baked.key) {
                try {
                  img.setTexture(baked.key, "__BASE" as any);
                  img.clearCrop?.();
                  img.setDisplaySize((tile + solidPadPx * 2) | 0, (tile + solidPadPx * 2) | 0);
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
                tile,
                solidPadPx,
                usedFrame,
                true,
                "solid"
              );
              if (!baked.ok && forceSolidPad) {
                baked = _buildSolidBoxPadTexture(this.scene, `${auraTk}::${frameName}::solid`, tile, solidPadPx);
                padMode = "solid";
              }
              if (baked.ok && baked.key) {
                try {
                  img.setTexture(baked.key, "__BASE" as any);
                  img.clearCrop?.();
                  img.setDisplaySize((tile + solidPadPx * 2) | 0, (tile + solidPadPx * 2) | 0);
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
              padMode: makeRing ? (ringMode === "box" ? "box" : "ring") : "pad",
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
        if (!onceMap[logKey]) {
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
            padMode: (cached as any).padMode ?? null,
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

  return { cont, baseScale, auraTextureKey: auraTk, auraPngUrl: auraUrl, frameIndices, children };
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

  const oldCont: any = inst.focusAura || null;
  const oldKids: any[] = Array.isArray(inst.focusAuraChildren) ? inst.focusAuraChildren : [];
  const toRemove = new Set<any>();
  if (oldCont) toRemove.add(oldCont);
  for (let i = 0; i < oldKids.length; i++) toRemove.add(oldKids[i]);

  try {
    const arr: any[] = (anyThis.__propImgs as any[]) || [];
    if (arr.length && toRemove.size) {
      anyThis.__propImgs = arr.filter(o => !toRemove.has(o));
    }
  } catch { /* ignore */ }

  try { oldCont?.destroy?.(); } catch { /* ignore */ }
  for (let i = 0; i < oldKids.length; i++) {
    try { oldKids[i]?.destroy?.(); } catch { /* ignore */ }
    try { (oldKids[i] as any)?.__auraTrimMask?.destroy?.(); } catch { /* ignore */ }
  }

  const aura = this._propCreateFocusAuraContainer({
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
    ox: ((vis?.offsetXPx ?? 0) | 0),
    oy: ((vis?.offsetYPx ?? 0) | 0),
    baseDepth: (inst.baseDepth | 0),
  });

  if (!aura) return false;

  inst.focusAura = aura.cont;
  inst.focusAuraChildren = aura.children;
  inst.focusAuraBaseScale = aura.baseScale;
  inst.focusAuraTextureKey = aura.auraTextureKey;
  inst.focusAuraPngUrl = aura.auraPngUrl;
  inst.focusAuraFrameIndices = aura.frameIndices;
  inst.__loggedFocusAuraRender = 0;
  inst.__loggedFocusAuraMulti = 0;
  inst.__loggedFocusAuraSceneDiag = 0;
  inst.__loggedFocusAuraPixelProbe = 0;

    if (String(baseName || "") === "chest") {
      const child0: any = children.length ? children[0] : null;
      const mode = (DEBUG_PROP_FOCUS_AURA_OVERRIDE.enabled &&
        String(baseName || "") === String(DEBUG_PROP_FOCUS_AURA_OVERRIDE.fromBaseName || ""))
        ? "override"
        : "normal";
      console.log(`[PROPAURA][CHEST-COMPARE] ${JSON.stringify({
        mode,
        anchor: { r: anchorR | 0, c: anchorC | 0 },
        hasChildren: !!children.length,
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

  const resolved = this._propResolveTextureKeyAndInfo(vis);
  if (!resolved) return;

  const textureKey = resolved.textureKey;
  const cols = resolved.cols;

  const wTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
  const hTiles = Math.max(1, (vis.hTiles ?? 1) | 0);

  // Optional per-prop offsets (safe even if undefined)
  const ox = ((vis.offsetXPx ?? 0) | 0);
  const oy = ((vis.offsetYPx ?? 0) | 0);
  const depthBias = (vis.depthBias ?? 0) | 0;

  const { baseRef, usedState } = this._propResolveBaseRef(vis, parsed, cols);

  const animKey = this._propResolveAnimKey(vis, parsed, usedState, wTiles, hTiles, textureKey, cols);

  // Depth based on anchor (bottom tile) so whole prop sorts as ONE object.
  // Include oy so y-sort matches visual when offsets are used.
  const anchorYpx = (((anchorR | 0) * st.tileSize + (st.tileSize >> 1) + oy) | 0);
  const baseDepth = ((anchorYpx * WORLD_DEPTH_Y_SCALE) + depthBias) | 0;

  const anchorKey = String(anchorR | 0) + "," + String(anchorC | 0);
  const objs: any[] = [];

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

  // Focus aura (pre-baked outline tiles), created per anchor.
  const aura = this._propCreateFocusAuraContainer({
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

    objs,
    vis,
    byRc: st.byRc,
    state: usedState,
    baseDepth: baseDepth | 0,

    focusAura: aura ? aura.cont : null,
    focusAuraChildren: aura ? aura.children : null,
    focusAuraBaseScale: aura ? aura.baseScale : PROP_FOCUS_AURA_BASE_SCALE,

    // For logging proof
    focusAuraTextureKey: aura ? aura.auraTextureKey : "",
    focusAuraPngUrl: aura ? aura.auraPngUrl : "",
    focusAuraFrameIndices: aura ? aura.frameIndices : null,
  };
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

syncPropGridByName(propNameGrid: string[][]): void {
  if (!this.map) return;

  const st = this._propBeginSync();

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
}


  // ---- internal helpers ----

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
  const seen: Record<string, 1> = Object.create(null);

  const ordered: string[] = [];
  const primary = this.atlas.primaryTextureKey;

  if (primary && !seen[primary]) {
    ordered.push(primary);
    seen[primary] = 1;
  }

  keysRaw.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const tk of keysRaw) {
    if (!tk || seen[tk]) continue;
    ordered.push(tk);
    seen[tk] = 1;
  }

  this._tilesetsAll = [];
  this._firstGidByTextureKey = Object.create(null);
  this._gidRanges = [];

  let gidCursor = 0;

  for (const tk of ordered) {
    const info = this.atlas.getSheetInfo(tk);
    if (!info || info.cols <= 0 || info.rows <= 0) continue;

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
