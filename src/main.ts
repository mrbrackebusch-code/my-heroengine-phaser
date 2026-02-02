
import Phaser from "phaser";

import { installBlocklyHeroLogicEditor, syncBlocklyXmlFromStorage } from "./blocklyHeroLogicEditor";
import { installBlocklyTrapEditor } from "./blocklyTrapEditor";
import "./blocklyHeroLogicRuntime";


import { preloadMonsterSheets, buildMonsterAtlas, type MonsterAtlas } from "./monsterAtlas";
import { applyMonsterAnimationForSprite } from "./monsterAnimGlue";

import { preloadHeroSheets, buildHeroAtlas } from "./heroAtlas";
import { debugSpawnHeroWithAnim } from "./heroAnimGlue";

import { installHeroAnimTester } from "./heroAnimGlue";

// NEW:
import { preloadTileSheets, buildTileAtlas, type TileAtlas } from "./tileAtlas";
import { WorldTileRenderer } from "./tileMapGlue";

import { preloadEffectSheets, buildEffectAtlas } from "./effectAtlas";
import { preloadHookshotThrustSheet } from "./hookshotWeaponAtlas";
import { AURA_RADII } from "./auraConfig";
import { preloadStudentAssets } from "./studentAssets";
import { initStudentSystems } from "./studentSystems";
import "./studentAutoLoad";


//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
import { loadWeaponAtlases, runWeaponAudit, preloadWeaponChainImages } from "./weaponAtlas";
import {
  DEBUG_COINFX,
  DEBUG_MAIN_LIFECYCLE,
  DEBUG_MONSTER_SPRITES,
  DEBUG_PHASER_BANNER,
  DEBUG_PROP_SYNC,
  DEBUG_PAD_SINK_PROP_LOGS,
  DEBUG_RELIC_LOGS,
  DEBUG_RELICTIP_LOGS,
  DEBUG_SAVE_LOGS,
  DEBUG_FORCE_RENDERER_RESOLUTION_1,
  DEBUG_TILEMAP_APPLY_NET,
  DEBUG_TILEMAP_MAIN,
  WORLD_SYNC_HASH_WARN_THRESHOLD_MS,
  ENABLE_HERO_ANIM_DEBUG,
  ENABLE_WEAPON_AUDIT_ON_START,
  ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS,
  WEAPON_DEBUG,
  WEAPON_DEBUG_VERBOSE,
} from "./debugFlags";

const logMain = (...args: any[]) => {
  if (DEBUG_MAIN_LIFECYCLE) console.log(...args);
};
const logSave = (...args: any[]) => {
  if (DEBUG_SAVE_LOGS) console.log(...args);
};
const _debugTrace = (tag: string, data?: any) => {
  const g: any = globalThis as any;
  const fn = g && (g as any).__heDebugTrace;
  if (typeof fn !== "function") return;
  try { fn(tag, data); } catch { }
};

const _hashMix = (h: number, v: number) => (((h << 5) - h + (v | 0)) | 0);
const _hashString = (s: string) => {
  let h = 0;
  const str = s || "";
  for (let i = 0; i < str.length; i++) {
    h = ((h * 31) + str.charCodeAt(i)) | 0;
  }
  return h | 0;
};

const _hashTileLayer = (layer: any, rows: number, cols: number) => {
  if (!layer || rows <= 0 || cols <= 0) return 0;
  let h = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = layer.getTileAt(c, r);
      const idx = t ? (t.index | 0) : -1;
      h = _hashMix(h, idx);
    }
  }
  return h | 0;
};

logMain(">>> [main.ts] dynamic-import version loaded");


// Somewhere near the top of main.ts:
declare const globalThis: any;


// Debug flags live in src/debugFlags.ts

// ------------------------------------------------------------
// UI loading overlay (DOM-defined in index.html)
// ------------------------------------------------------------
type UiLoadingState = {
  pct?: number;
  msg?: string;
  shown: boolean;
  done: boolean;
};

const _uiLoadingState: UiLoadingState = {
  pct: undefined,
  msg: "",
  shown: true,
  done: false,
};

try {
  (globalThis as any).__heLoadingState = _uiLoadingState;
} catch { }

function _uiLoadingUi(): any {
  try {
    return (globalThis as any).__heLoadingUI || null;
  } catch { return null; }
}
function _uiLoadingSet(pct?: number, msg?: string): void {
  try {
    if (typeof pct === "number" && Number.isFinite(pct)) _uiLoadingState.pct = pct;
    if (typeof msg === "string" && msg.trim()) _uiLoadingState.msg = msg;
    const ui = _uiLoadingUi();
    if (ui && typeof ui.set === "function") ui.set(pct, msg);
  } catch {}
}
try {
  (globalThis as any).__heLoadingNote = (msg: string) => {
    if (typeof msg !== "string" || !msg.trim()) return;
    _uiLoadingSet(undefined, msg);
  };
} catch { }
function _uiLoadingDone(): void {
  try {
    _uiLoadingState.done = true;
    _uiLoadingState.shown = false;
    const ui = _uiLoadingUi();
    if (ui && typeof ui.done === "function") ui.done();
  } catch {}
}
function _uiLoadingShow(msg?: string): void {
  try {
    _uiLoadingState.shown = true;
    _uiLoadingState.done = false;
    if (typeof msg === "string" && msg.trim()) _uiLoadingState.msg = msg;
    const ui = _uiLoadingUi();
    if (ui && typeof ui.show === "function") ui.show(msg);
  } catch {}
}
let _uiLoadingTilemapReady = false;
let _uiLoadingHeroReady = false;
function _uiLoadingMarkTilemap(): void {
  _uiLoadingTilemapReady = true;
  _uiLoadingMaybeDone();
}
function _uiLoadingMarkHero(): void {
  if (_uiLoadingHeroReady) return;
  _uiLoadingHeroReady = true;
  _uiLoadingMaybeDone();
}
function _uiLoadingMaybeDone(): void {
  if (_uiLoadingTilemapReady && _uiLoadingHeroReady) {
    _uiLoadingSet(100, "Ready");
    _uiLoadingDone();
  }
}

function _tryPruneUnconnectedHeroes(reason: string): void {
  try {
    const g: any = globalThis as any;
    const internals: any = g.__HeroEnginePhaserInternals;
    if (internals && typeof internals.pruneUnconnectedHeroes === "function") {
      internals.pruneUnconnectedHeroes(reason || "scene");
    }
  } catch { }
}


// ------------------------------------------------------------
// Weapon debug flags (no URL params / no console commands needed)
// ------------------------------------------------------------
// Debug flags live in src/debugFlags.ts

// ------------------------------------------------------------
// Host visibility pause (prevents jumps/teleports on tab blur)
// ------------------------------------------------------------
function _isHostClient(): boolean {
  try {
    const g: any = globalThis as any;
    const net: any = g.__net;
    if (net && typeof net.isHostNow === "function") return !!net.isHostNow();
    if (typeof g.__isHost === "boolean") return !!g.__isHost;
  } catch { }
  return false;
}

function _connectedProfileCount(): number {
  try {
    const g: any = globalThis as any;
    const map = g.__netProfileConnected;
    if (map && typeof map === "object") {
      let n = 0;
      for (const k of Object.keys(map)) {
        if (map[k]) n++;
      }
      if (n > 0) return n;
    }
    const byPid = g.__netProfileByPid;
    if (byPid && typeof byPid === "object") {
      const n = Object.keys(byPid).length | 0;
      if (n > 0) return n;
    }
  } catch { }
  return 0;
}

function _shouldHonorVisibilityPause(flag: boolean): boolean {
  if (!flag) return true;
  if (!_isHostClient()) return true;
  return _connectedProfileCount() <= 1;
}

function _setEnginePaused(flag: boolean, reason: string): void {
  try {
    const he: any = (globalThis as any).HeroEngine;
    if (he && typeof he.setPaused === "function") {
      if (flag && !_shouldHonorVisibilityPause(flag)) {
        he.setPaused(false, `mp-override:${reason || "blur"}`);
        return;
      }
      he.setPaused(flag, reason);
    }
  } catch { }
}

function _tryRecenterCamera(reason: string): void {
  try {
    const g: any = globalThis as any;
    const scene: any = g.__phaserScene;
    if (!scene) return;

    const fn =
      (scene as any)._forceCameraFollowNow ||
      (scene as any).forceCameraFollowNow ||
      (scene as any).__forceCameraFollowNow;
    if (typeof fn === "function") {
      fn.call(scene, reason || "focus");
      return;
    }

    const cam = scene.cameras?.main;
    if (!cam) return;
    const hero = _hud_tryFindAnyPlayableHeroSprite();
    const native = hero ? (hero as any).native : null;
    try { cam.stopFollow?.(); } catch { }
    if (native && cam.startFollow) cam.startFollow(native, true, 0.35, 0.35);
    if (native && cam.centerOn) cam.centerOn(native.x, native.y);
  } catch { }
}

function _installVisibilityPause(): void {
  const g: any = globalThis as any;
  if (g.__heVisPauseInstalled) return;
  g.__heVisPauseInstalled = true;

  const onVis = () => {
    const hidden = document.hidden;
    _setEnginePaused(hidden, hidden ? "hidden" : "visible");
    if (!hidden) _tryRecenterCamera("visible");
  };
  const onBlur = () => _setEnginePaused(true, "blur");
  const onFocus = () => {
    _setEnginePaused(document.hidden, "focus");
    if (!document.hidden) _tryRecenterCamera("focus");
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);

  // Seed initial state
  onVis();
}

_installVisibilityPause();



// ------------------------------------------------------------
// HTML HUD (side panel) — per-client view of *local* hero state
// Reads sprite data keys from the Arcade runtime, not Phaser.
// ------------------------------------------------------------
const HUD_ENABLED = true;
const HUD_REFRESH_MS = 100;

// Optional “future contract” keys (engine can publish these later)
const HUD_KEYS = {
  PREVIEW: "__ui_actionPreview",
  A: "__ui_A",
  B: "__ui_B",
  AB: "__ui_AB",
  R: "__ui_R",
};


let _hudLastText = "";
let _hudLastSub = "";


type HudRefs = {
  who: HTMLElement;
  a: HTMLElement;
  b: HTMLElement;
  ab: HTMLElement;
  r: HTMLElement;
};

let _hudRefs: HudRefs | null = null;
let _hudLastWho = "";
let _hudLastA = "";
let _hudLastB = "";
let _hudLastAB = "";
let _hudLastR = "";
let _hudTimer: any = null;


function _hud_installOnce(): void {
  if (!HUD_ENABLED) return;

  const g: any = globalThis as any;
  if (g.__htmlHudInstalled) return;

  const who = document.getElementById("hud-cell-who");
  const a = document.getElementById("hud-cell-a");
  const b = document.getElementById("hud-cell-b");
  const ab = document.getElementById("hud-cell-ab");
  const r = document.getElementById("hud-cell-r");

  if (!who || !a || !b || !ab || !r) {
    if (!g.__htmlHudInstallQueued) {
      g.__htmlHudInstallQueued = true;

      const retry = () => {
        g.__htmlHudInstallQueued = false;
        _hud_installOnce();
      };

      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", retry, { once: true });
      } else {
        setTimeout(retry, 0);
      }
    }
    console.warn("[hud] missing DOM elements (#hud-cell-who/#hud-cell-a/#hud-cell-b/#hud-cell-ab/#hud-cell-r)");
    return;
  }

  g.__htmlHudInstalled = true;

  _hudRefs = { who, a, b, ab, r };

  _hudTimer = setInterval(() => {
    try {
      _hud_tick();
    } catch (e) {
      console.warn("[hud] tick error", e);
    }
  }, HUD_REFRESH_MS);

  _hud_tick();
}

function _hud_tryGetLocalPlayerId(): number {
  const g: any = globalThis as any;
  const net: any = g.__net;

  const pid =
    net && typeof net.playerId === "number" ? (net.playerId | 0) : 0;

  return pid > 0 ? pid : 0;
}


function _hud_getHeroIndexForPid(pid: number): number {
  const g: any = globalThis as any;
  const internals: any = g.__HeroEnginePhaserInternals;

  // Best: ask the engine-side mapping (returns existing heroIndex; only spawns if missing)
  try {
    if (internals && typeof internals.ensureHeroForPlayer === "function") {
      const hi = internals.ensureHeroForPlayer(pid) | 0;
      return hi >= 0 ? hi : -1;
    }
  } catch (_e) {
    // ignore
  }

  // Fallback: common case
  return ((pid | 0) - 1) | 0;
}

function _hud_fmtLogicOut(out: any[] | null): string {
  if (!out) return "null";
  const max = 12; // keep line readable; tooltip shows full anyway
  const parts = out.slice(0, max).map(v => {
    if (typeof v === "number") return String(v | 0);
    if (typeof v === "string") return v;
    return String(v);
  });
  return `[${parts.join(",")}${out.length > max ? ",…" : ""}]`;
}


function _hud_tryGetLocalHeroSprite(pid: number): any | null {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;
  if (!spritesNS || typeof spritesNS.allSprites !== "function") return null;

  const all: any[] = spritesNS.allSprites();
  if (!Array.isArray(all) || all.length === 0) return null;

  const sk: any = g.SpriteKind;
  const playerKind =
    sk && typeof sk.Player === "number" ? (sk.Player | 0) : 0;

  for (const s of all) {
    if (!s) continue;

    // Prefer to only consider SpriteKind.Player (heroes)
    try {
      if (playerKind && typeof s.kind === "function") {
        const k = s.kind() | 0;
        if (k !== playerKind) continue;
      }
    } catch (_e) {
      // ignore
    }

    // OWNER is "owner" in HERO_DATA
    let owner = 0;
    try {
      owner = (spritesNS.readDataNumber(s, "owner") | 0);
    } catch (_e) {
      owner = 0;
    }

    if (owner === (pid | 0)) return s;
  }

  return null;
}

function _hud_isNpcHero(spritesNS: any, hero: any): boolean {
  try {
    return !!spritesNS.readDataBoolean(hero, "isNpc");
  } catch (_e) {
    return false;
  }
}

function _hud_tryFindAnyPlayableHeroSprite(): any | null {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;
  if (!spritesNS || typeof spritesNS.allSprites !== "function") return null;

  const all: any[] = spritesNS.allSprites();
  if (!Array.isArray(all) || all.length === 0) return null;

  const sk: any = g.SpriteKind;
  const hasPlayerKind = !!(sk && typeof sk.Player === "number");
  const playerKind = hasPlayerKind ? (sk.Player | 0) : 0;

  for (const s of all) {
    if (!s) continue;
    try {
      if (hasPlayerKind && typeof s.kind === "function") {
        const k = s.kind() | 0;
        if (k !== playerKind) continue;
      }
    } catch (_e) {
      // ignore
    }

    if (_hud_isNpcHero(spritesNS, s)) continue;
    if (hasPlayerKind) return s;

    let owner = 0;
    try {
      owner = (spritesNS.readDataNumber(s, "owner") | 0);
    } catch (_e) {
      owner = 0;
    }

    const profile =
      _hud_readStr(spritesNS, s, "__profileKey") ||
      _hud_readStr(spritesNS, s, "name") ||
      _hud_readStr(spritesNS, s, "heroName");

    if (owner > 0 || profile) return s;
  }

  return null;
}

function _hud_readNum(spritesNS: any, spr: any, key: string): number {
  try {
    return spritesNS.readDataNumber(spr, key) | 0;
  } catch (_e) {
    return 0;
  }
}

function _hud_readStr(spritesNS: any, spr: any, key: string): string {
  try {
    const v = spritesNS.readDataString(spr, key);
    return typeof v === "string" ? v : "";
  } catch (_e) {
    return "";
  }
}

function _hud_getProfileForHero(pid: number, hero: any): string {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;
  const direct =
    _hud_readStr(spritesNS, hero, "__profileKey") ||
    _hud_readStr(spritesNS, hero, "name") ||
    _hud_readStr(spritesNS, hero, "heroName");
  if (direct) return direct;
  if (g.__netProfileByPid && typeof g.__netProfileByPid[pid] === "string") {
    return String(g.__netProfileByPid[pid]);
  }
  return "";
}

function _hud_buildTextForHero(pid: number, hero: any): { sub: string; text: string } {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;

  const profile = _hud_getProfileForHero(pid, hero);

  const hp = _hud_readNum(spritesNS, hero, "hp");
  const maxHp = _hud_readNum(spritesNS, hero, "maxHp");
  const mana = _hud_readNum(spritesNS, hero, "mana");
  const maxMana = _hud_readNum(spritesNS, hero, "maxMana");

  const phaseName = _hud_readStr(spritesNS, hero, "PhaseName") || _hud_readStr(spritesNS, hero, "phase");
  const phasePart = _hud_readStr(spritesNS, hero, "PhasePartName");

  const actionKind = _hud_readStr(spritesNS, hero, "ActionKind");
  const actionSeq = _hud_readNum(spritesNS, hero, "ActionSequence");
  const actionVar = _hud_readNum(spritesNS, hero, "ActionVariant");

  const dir = _hud_readNum(spritesNS, hero, "dir");
  const frameCol = _hud_readNum(spritesNS, hero, "frameColOverride");

  // If the engine publishes a full preview string, prefer it
  const preview = _hud_readStr(spritesNS, hero, HUD_KEYS.PREVIEW);

  const a = _hud_readStr(spritesNS, hero, HUD_KEYS.A);
  const b = _hud_readStr(spritesNS, hero, HUD_KEYS.B);
  const ab = _hud_readStr(spritesNS, hero, HUD_KEYS.AB);
  const r = _hud_readStr(spritesNS, hero, HUD_KEYS.R);

  const lines: string[] = [];

  lines.push(`Player: ${pid}${profile ? "  (" + profile + ")" : ""}`);
  lines.push(`HP: ${hp}/${maxHp}    MANA: ${mana}/${maxMana}`);
  lines.push("");

  lines.push(`Phase: ${phaseName || "(none)"}${phasePart ? "  | part=" + phasePart : ""}`);
  lines.push(`Action: ${actionKind || "(none)"}  seq=${actionSeq}  var=${actionVar}`);
  lines.push(`Dir: ${dir}   frameColOverride: ${frameCol}`);
  lines.push("");

  if (preview) {
    lines.push("Buttons (engine preview):");
    lines.push(preview);
  } else {
    lines.push("Buttons (preview keys not published yet):");
    lines.push(`Q  : ${a || "(missing " + HUD_KEYS.A + ")"}`);
    lines.push(`W  : ${b || "(missing " + HUD_KEYS.B + ")"}`);
    lines.push(`E  : ${ab || "(missing " + HUD_KEYS.AB + ")"}`);
    lines.push(`R  : ${r || "(missing " + HUD_KEYS.R + ")"}`);
  }

  const sub = `connected=${_hud_slotConnected(pid, profile)}  host=${!!g.__isHost}`;

  return { sub, text: lines.join("\n") };
}

function _hud_slotConnected(pid: number, profile?: string): boolean {
  const g: any = globalThis as any;
  const key =
    (typeof profile === "string" && profile.trim())
      ? profile.trim()
      : (g.__netProfileByPid && typeof g.__netProfileByPid[pid] === "string")
        ? String(g.__netProfileByPid[pid])
        : "";
  if (key && g.__netProfileConnected) return !!g.__netProfileConnected[key];
  return false;
}

function _hud_tick(): void {
  if (!_hudRefs) return;

  const pid = _hud_tryGetLocalPlayerId();
  const anyHero = _hud_tryFindAnyPlayableHeroSprite();
  if (!pid) {
    if (anyHero) _uiLoadingMarkHero();
    const w = "Waiting for server assign…";
    if (_hudLastWho !== w) {
      _hudRefs.who.textContent = w;
      _hudRefs.who.title = w;
      _hudLastWho = w;
    }
    return;
  }

  const hero = _hud_tryGetLocalHeroSprite(pid);
  if (!hero) {
    if (anyHero) _uiLoadingMarkHero();
    const w = `pid=${pid} — waiting for hero sprite…`;
    if (_hudLastWho !== w) {
      _hudRefs.who.textContent = w;
      _hudRefs.who.title = w;
      _hudLastWho = w;
    }
    return;
  }
  _uiLoadingMarkHero();

  const cells = _hud_buildCellsForHero(pid, hero);

  if (_hudLastWho !== cells.who) {
    _hudRefs.who.textContent = cells.who;
    _hudRefs.who.title = cells.whoTitle || cells.who;
    _hudLastWho = cells.who;
  }
  if (_hudLastA !== cells.a) {
    _hudRefs.a.textContent = cells.a;
    _hudRefs.a.title = cells.aTitle || cells.a;
    _hudLastA = cells.a;
  }
  if (_hudLastB !== cells.b) {
    _hudRefs.b.textContent = cells.b;
    _hudRefs.b.title = cells.bTitle || cells.b;
    _hudLastB = cells.b;
  }
  if (_hudLastAB !== cells.ab) {
    _hudRefs.ab.textContent = cells.ab;
    _hudRefs.ab.title = cells.abTitle || cells.ab;
    _hudLastAB = cells.ab;
    _hudLastAB = cells.ab;
  }
  if (_hudLastR !== cells.r) {
    _hudRefs.r.textContent = cells.r;
    _hudRefs.r.title = cells.rTitle || cells.r;
    _hudLastR = cells.r;
  }
}

function _hud_buildCellsForHero(pid: number, hero: any): {
  who: string; whoTitle?: string;
  a: string;   aTitle?: string;
  b: string;   bTitle?: string;
  ab: string;  abTitle?: string;
  r: string;   rTitle?: string;
} {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;

  const profile = _hud_getProfileForHero(pid, hero);

  const whoPrefix = `P${pid}${profile ? ":" + profile : ""}`;

  // Optional stats in the YOU cell (you can remove if you want it pure)
  const hp = spritesNS ? _hud_readNum(spritesNS, hero, "hp") : 0;
  const maxHp = spritesNS ? _hud_readNum(spritesNS, hero, "maxHp") : 0;
  const mana = spritesNS ? _hud_readNum(spritesNS, hero, "mana") : 0;
  const maxMana = spritesNS ? _hud_readNum(spritesNS, hero, "maxMana") : 0;

  const who = (maxHp || maxMana)
    ? `${whoPrefix}  HP ${hp}/${maxHp}  M ${mana}/${maxMana}`
    : whoPrefix;

  const heroIndex = _hud_resolveHeroIndexForSprite(hero);
  if (heroIndex < 0) {
    return {
      who,
      whoTitle: `${whoPrefix}\n(waiting for heroIndex…)`,
      a: "…",
      b: "…",
      ab: "…",
      r: "…",
    };
  }

  const outA = _hud_callStudentLogic(profile, heroIndex, "A");
  const outB = _hud_callStudentLogic(profile, heroIndex, "B");
  const outAB = _hud_callStudentLogic(profile, heroIndex, "A+B");
  const outR = _hud_callStudentLogic(profile, heroIndex, "R");

  const aFull = _hud_fmtArrayFull(outA);
  const bFull = _hud_fmtArrayFull(outB);
  const abFull = _hud_fmtArrayFull(outAB);
  const rFull = _hud_fmtArrayFull(outR);

  return {
    who,
    whoTitle: `${whoPrefix}\nheroIndex=${heroIndex}` + ((maxHp || maxMana) ? `\nHP ${hp}/${maxHp}  M ${mana}/${maxMana}` : ""),

    a: aFull,
    aTitle: `Q\n${aFull}`,

    b: bFull,
    bTitle: `W\n${bFull}`,

    ab: abFull,
    abTitle: `E\n${abFull}`,

    r: rFull,
    rTitle: `R\n${rFull}`,
  };
}


function _hud_kindOf(s: any): number {
  try {
    if (s && typeof s.kind === "function") return (s.kind() | 0);
    if (s && typeof s.kind === "number") return (s.kind | 0);
  } catch (_e) {}
  return 0;
}

function _hud_buildHeroesArr(): any[] {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;
  if (!spritesNS) return [];

  // Match heroEnginePhaserGlue ordering as closely as possible
  let all: any[] = [];
  try {
    if (typeof spritesNS._getAllSprites === "function") all = spritesNS._getAllSprites();
    else if (typeof spritesNS.allSprites === "function") all = spritesNS.allSprites();
  } catch (_e) {
    all = [];
  }
  if (!Array.isArray(all)) return [];

  const sk: any = g.SpriteKind;
  const playerKind = (sk && typeof sk.Player === "number") ? (sk.Player | 0) : 0;

  const heroesArr: any[] = [];
  for (const s of all) {
    if (!s) continue;
    if (playerKind && _hud_kindOf(s) === playerKind) heroesArr.push(s);
  }
  return heroesArr;
}

function _hud_resolveHeroIndexForSprite(heroSprite: any): number {
  const g: any = globalThis as any;
  const finder = g.__heFindHeroIndexForSprite;
  if (typeof finder === "function") {
    try {
      const hi = finder(heroSprite);
      if (typeof hi === "number") return hi | 0;
    } catch {}
  }
  const heroesArr = _hud_buildHeroesArr();
  for (let i = 0; i < heroesArr.length; i++) {
    if (heroesArr[i] === heroSprite) return i | 0;
  }
  return -1;
}

function _hud_callStudentLogic(profile: string, _heroIndex: number, button: "A" | "B" | "A+B" | "R"): any[] | null {
  const g: any = globalThis as any;
  const fn = g.__heBlocklyHeroLogicRun;
  if (typeof fn !== "function") return null;

  const prev = !!g.__heroLogicPreview;
  try {
    g.__heroLogicPreview = true;
    const setRo = g.__heSetBlocklyROForHeroIndex;
    if (typeof setRo === "function" && (_heroIndex | 0) >= 0) {
      try { setRo(_heroIndex | 0); } catch {}
    }
    const prof = (typeof profile === "string" && profile.trim()) ? profile.trim() : "";
    if (!prof) return null;
    const out = fn(prof, button);
    return Array.isArray(out) ? out : null;
  } catch (_e) {
    return null;
  } finally {
    g.__heroLogicPreview = prev;
  }
}

function _hud_fmtArrayFull(out: any[] | null): string {
  if (!out) return "null";
  return "[" + out.map(v => (typeof v === "number" ? String(v | 0) : String(v))).join(",") + "]";
}


function _hud_buildLineForHero(pid: number, hero: any): { line: string; title: string } {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;

  const profile = _hud_getProfileForHero(pid, hero);

  const who = `P${pid}${profile ? ":" + profile : ""}`;

  // Resolve heroIndex the SAME WAY the hook does (index in heroesArr)
  const heroIndex = _hud_resolveHeroIndexForSprite(hero);
  if (heroIndex < 0) {
    const line = `${who} | logic: (waiting for heroIndex…)`;
    return { line, title: line };
  }

  // Call student logic exactly like a real press would
  const outA = _hud_callStudentLogic(profile, heroIndex, "A");
  const outB = _hud_callStudentLogic(profile, heroIndex, "B");
  const outAB = _hud_callStudentLogic(profile, heroIndex, "A+B");
  const outR = _hud_callStudentLogic(profile, heroIndex, "R");

  const aS = _hud_fmtArrayFull(outA);
  const bS = _hud_fmtArrayFull(outB);
  const abS = _hud_fmtArrayFull(outAB);
  const rS = _hud_fmtArrayFull(outR);

  // (Optional) keep a tiny bit of state context; remove if you want PURE logic only
  const hp = spritesNS ? _hud_readNum(spritesNS, hero, "hp") : 0;
  const maxHp = spritesNS ? _hud_readNum(spritesNS, hero, "maxHp") : 0;
  const mana = spritesNS ? _hud_readNum(spritesNS, hero, "mana") : 0;
  const maxMana = spritesNS ? _hud_readNum(spritesNS, hero, "maxMana") : 0;

  const stats = (maxHp || maxMana) ? `HP ${hp}/${maxHp} M ${mana}/${maxMana}` : "";

  const line = `${who}${stats ? " | " + stats : ""} | Q=${aS} | W=${bS} | E=${abS} | R=${rS}`;

  const title =
    `${who}\n` +
    `heroIndex=${heroIndex}\n` +
    (stats ? `${stats}\n` : "") +
    `Q   = ${aS}\n` +
    `W   = ${bS}\n` +
    `E   = ${abS}\n` +
    `R   = ${rS}`;

  return { line, title };
}



function getProfileFromUrl(): string | null {
    try {
        const params = new URLSearchParams(window.location.search);
        const p = params.get("profile");
        return p ? decodeURIComponent(p) : null;
    } catch {
        return null;
    }
}

function applyUrlProfileToGlobals() {
    const profile = getProfileFromUrl();
    const g: any = (globalThis as any);

    if (profile && typeof profile === "string") {
        // Store the raw name if anyone wants it
        g.__localHeroProfileName = profile;
        logMain("[main] URL profile override:", profile);
        return;
    }

    const existing =
        (typeof g.__localHeroProfileName === "string" && g.__localHeroProfileName.trim())
            ? g.__localHeroProfileName.trim()
            : "";

    if (existing) {
        logMain("[main] no ?profile= URL param; keeping existing profile:", existing);
        return;
    }

    g.__localHeroProfileName = profile;
    logMain("[main] no ?profile= URL param; using defaults");
}

// ------------------------------------------------------------
// Save building + send (host-only)
// ------------------------------------------------------------

type HeroSavePayload = {
  type: "heroesSaveV1";
  savedAt: number;
  saveKind?: "auto" | "manual";
  label?: string;
  profiles: string[];
  floor: { index: number; kind: string; baseFamily: string; wallFamily: string; palette?: string; textureSeed?: number };
  floorState?: any;
  worldSnapshot: any;
  heroSprites: any[];
  npcSprites?: any[];
  blocklyXmlByProfile: any;
  tilemap?: any;
  decor?: any;
  next: { index: number; kind: string };
};

type SaveRestorePolicy = "teleport" | "full";
const SAVE_RESTORE_POLICY_AUTO: SaveRestorePolicy = "teleport";
const SAVE_RESTORE_POLICY_MANUAL: SaveRestorePolicy = "teleport";

function _captureWorldSnapshot(): any {
  const g: any = globalThis as any;
  const nw = (g as any).netWorld;
  if (!nw || typeof nw.capture !== "function") return null;

  return nw.capture();
}

function _applyWorldSnapshotFiltered(snap: any): boolean {
  if (!snap || !snap.sprites) return false;
  const g: any = globalThis as any;
  try {
    const nw: any = g.netWorld;
    if (!nw || typeof nw.apply !== "function") return false;
    const filtered = {
      ...snap,
      sprites: (snap.sprites || []).filter((s: any) => !_isHeroSnapshotSprite(s) && !_isNpcSnapshotSprite(s) && !_isEnemySnapshotSprite(s))
    };
    g.__netWorldAllowHostPrune = true;
    try {
      nw.apply(filtered);
    } finally {
      g.__netWorldAllowHostPrune = false;
    }
    logSave("[save] applied world snapshot (non-hero sprites)", filtered.sprites ? filtered.sprites.length : 0);
    return true;
  } catch (e) {
    console.warn("[save] apply world snapshot failed", e);
    return false;
  }
}

function _tryApplyPendingWorldSnapshotForSave(): void {
  const g: any = globalThis as any;
  const snap = g.__pendingWorldSnapshotForSave;
  if (!snap) return;
  const ok = _applyWorldSnapshotFiltered(snap);
  if (ok) g.__pendingWorldSnapshotForSave = null;
}

function _isHeroSnapshotSprite(s: any): boolean {
  if (!s || !s.data) return false;
  if (_isEnemySnapshotSprite(s)) return false;
  if (_isNpcSnapshotSprite(s)) return false;
  const owner = (typeof s.data.owner === "number") ? (s.data.owner | 0) : 0;
  if (owner > 0) return true;
  const name = (typeof s.data.name === "string") ? s.data.name.toLowerCase() : "";
  const heroName = (typeof s.data.heroName === "string") ? s.data.heroName.toLowerCase() : "";
  if (name.includes("hero") || heroName) return true;
  return false;
}

function _isNpcSnapshotSprite(s: any): boolean {
  if (!s || !s.data) return false;
  if (_isEnemySnapshotSprite(s)) return false;
  const d: any = s.data;
  if (!!d.isNpc || !!d.npcLpc) return true;
  if (typeof d._npcRole === "string" && d._npcRole.trim()) return true;
  const heroName = (typeof d.heroName === "string") ? d.heroName.trim() : "";
  const owner = (typeof d.owner === "number") ? (d.owner | 0) : 0;
  if (owner <= 0 && heroName) return true;
  return false;
}

function _isEnemySnapshotSprite(s: any): boolean {
  if (!s || !s.data) return false;
  const d: any = s.data;
  if (!!d.enemyLpc) return true;
  const monsterId = (typeof d.monsterId === "string") ? d.monsterId.trim() : "";
  return !!monsterId;
}

function _npcSnapshotKey(s: any): string {
  if (!s || !s.data) return "";
  const d: any = s.data;
  const role = (typeof d._npcRole === "string") ? d._npcRole.trim() : "";
  const heroName = (typeof d.heroName === "string") ? d.heroName.trim() : "";
  const family = (typeof d.heroFamily === "string") ? d.heroFamily.trim().toLowerCase() : "";
  if (!heroName && !role) return "";
  return `${role}|${heroName}|${family}`;
}

function _buildHeroSavePayload(
  nextIndex: number,
  nextKind: string,
  meta?: { saveKind?: "auto" | "manual"; label?: string }
): HeroSavePayload | null {
  const g: any = globalThis as any;
  const profiles: string[] = [];
  const connectedMap = (g.__netProfileConnected && typeof g.__netProfileConnected === "object")
    ? g.__netProfileConnected
    : null;
  if (connectedMap) {
    for (const k of Object.keys(connectedMap)) {
      if (connectedMap[k]) profiles.push(String(k));
    }
  }
  if (profiles.length === 0) {
    const local = (typeof g.__localHeroProfileName === "string" && g.__localHeroProfileName.trim())
      ? g.__localHeroProfileName.trim()
      : null;
    if (local) profiles.push(local);
  }

  const internals = g.__HeroEnginePhaserInternals || {};
  const floorIndex = (typeof internals.getFloorIndex === "function") ? (internals.getFloorIndex() | 0) : 0;
  const floorKind = (typeof internals.getFloorKind === "function") ? String(internals.getFloorKind()) : "";
  const baseFamily = (typeof internals.getFloorBaseFamily === "function")
    ? String(internals.getFloorBaseFamily())
    : (g.__floorBaseFamily || "ground_light");
  const wallFamily = (typeof internals.getFloorWallFamily === "function")
    ? String(internals.getFloorWallFamily())
    : (g.__floorWallFamily || "chasm_light");
  const palette = (typeof internals.getFloorThemePalette === "function")
    ? String(internals.getFloorThemePalette())
    : (typeof g.__floorThemePalette === "string" ? g.__floorThemePalette : "");
  const textureSeed = (typeof internals.getFloorTextureSeed === "function")
    ? (internals.getFloorTextureSeed() | 0)
    : (typeof g.__floorTextureSeed === "number" ? (g.__floorTextureSeed | 0) : 0);

  const worldSnapshot = _captureWorldSnapshot();
  const heroSprites: any[] = [];
  const npcSprites: any[] = [];
  if (worldSnapshot && Array.isArray(worldSnapshot.sprites)) {
    for (const s of worldSnapshot.sprites) {
      if (_isEnemySnapshotSprite(s)) continue;
      if (_isHeroSnapshotSprite(s)) heroSprites.push(s);
      else if (_isNpcSnapshotSprite(s)) npcSprites.push(s);
    }
    // Strip heroes from worldSnapshot to avoid double-apply on load
    worldSnapshot.sprites = worldSnapshot.sprites.filter((s: any) => !_isHeroSnapshotSprite(s) && !_isNpcSnapshotSprite(s) && !_isEnemySnapshotSprite(s));
  }
  const blocklyXmlByProfile = g.__heBlocklyXmlByProfile || {};
  const tilemap = g.__lastTilemapMsg || null;
  const decor = g.__lastDecorPayload || null;
  const floorState = (internals && typeof internals.getFloorSaveFlags === "function")
    ? internals.getFloorSaveFlags()
    : null;
  const saveKind = (meta && meta.saveKind === "manual") ? "manual" : "auto";
  const labelRaw = (meta && typeof meta.label === "string") ? meta.label.trim() : "";

  const payload: HeroSavePayload = {
    type: "heroesSaveV1",
    savedAt: Date.now(),
    saveKind,
    label: labelRaw || undefined,
    profiles,
    floor: {
      index: floorIndex,
      kind: floorKind,
      baseFamily,
      wallFamily,
      palette: palette || undefined,
      textureSeed: textureSeed ? (textureSeed | 0) : undefined,
    },
    floorState: floorState || undefined,
    worldSnapshot,
    heroSprites,
    npcSprites: npcSprites.length ? npcSprites : undefined,
    blocklyXmlByProfile,
    tilemap,
    decor,
    next: { index: nextIndex, kind: nextKind }
  };

  _debugTrace("SAVE_BUILD", {
    saveKind: payload.saveKind || "auto",
    floorIndex,
    floorKind,
    nextIndex,
    nextKind,
    profiles: payload.profiles,
  });

  return payload;
}

function _sendHeroSavePayload(nextIndex: number, nextKind: string): void {
  const g: any = globalThis as any;
  const net: any = g.__net;
  if (!net || typeof net.sendSaveGame !== "function") return;

  const payload = _buildHeroSavePayload(nextIndex, nextKind, { saveKind: "auto" });
  if (!payload) return;

  try {
    net.sendSaveGame(payload);
    logSave("[save] sent autosave", payload);
    _debugTrace("SAVE_SEND", {
      saveKind: "auto",
      floorIndex: payload.floor?.index ?? null,
      floorKind: payload.floor?.kind ?? null,
      nextIndex: payload.next?.index ?? null,
      nextKind: payload.next?.kind ?? null,
      profiles: payload.profiles || [],
    });
  } catch (e) {
    console.warn("[save] failed to send autosave", e);
  }
}

// Expose hook for engine teleport commit
(globalThis as any).__hero_saveBeforeTeleport = _sendHeroSavePayload;

function _sendHeroManualSave(label?: string): boolean {
  const g: any = globalThis as any;
  const net: any = g.__net;
  if (!net || typeof net.sendSaveGame !== "function") return false;
  if (typeof g.__isHost === "boolean" && !g.__isHost) return false;

  const internals = g.__HeroEnginePhaserInternals || {};
  const floorIndex = (typeof internals.getFloorIndex === "function") ? (internals.getFloorIndex() | 0) : 0;
  const floorKind = (typeof internals.getFloorKind === "function") ? String(internals.getFloorKind()) : "";
  const payload = _buildHeroSavePayload(floorIndex, floorKind, { saveKind: "manual", label });
  if (!payload) return false;
  if (!(payload.floorState && (payload.floorState as any).safe)) {
    logSave("[save] manual save blocked (unsafe floor)", {
      floorIndex: payload.floor?.index ?? null,
      floorKind: payload.floor?.kind ?? null,
      safe: payload.floorState ? ((payload.floorState as any).safe ? 1 : 0) : 0,
    });
    _debugTrace("SAVE_BLOCKED", {
      saveKind: "manual",
      floorIndex: payload.floor?.index ?? null,
      floorKind: payload.floor?.kind ?? null,
      safe: payload.floorState ? ((payload.floorState as any).safe ? 1 : 0) : 0,
    });
    return false;
  }

  try {
    net.sendSaveGame(payload);
    logSave("[save] sent manual save", {
      label: payload.label || null,
      floorIndex: payload.floor?.index ?? null,
      floorKind: payload.floor?.kind ?? null,
      profiles: payload.profiles || []
    });
    _debugTrace("SAVE_SEND", {
      saveKind: "manual",
      floorIndex: payload.floor?.index ?? null,
      floorKind: payload.floor?.kind ?? null,
      nextIndex: payload.next?.index ?? null,
      nextKind: payload.next?.kind ?? null,
      profiles: payload.profiles || [],
      label: payload.label || null,
    });
    return true;
  } catch (e) {
    console.warn("[save] failed to send manual save", e);
    return false;
  }
}

(globalThis as any).__hero_saveManual = _sendHeroManualSave;

// ------------------------------------------------------------
// Load save (host) when available from landing page
// ------------------------------------------------------------
let _pendingSaveApplied = false;

function _applyHeroSavePayload(save: any, sourceLabel?: string): boolean {
  const g: any = globalThis as any;
  if (!g.__isHost) return false;
  if (!save || save.type !== "heroesSaveV1") {
    console.warn("[save] pending save has unknown type");
    return false;
  }

  logSave("[save] applying save", sourceLabel || "");

  const saveKind = (save && typeof save.saveKind === "string") ? String(save.saveKind || "") : "";
  const floorIndex =
    (save.floor && typeof save.floor.index === "number") ? (save.floor.index | 0) : null;
  const floorKind =
    (save.floor && typeof save.floor.kind === "string") ? String(save.floor.kind || "") : "";
  const nextIndex =
    (save.next && typeof save.next.index === "number") ? (save.next.index | 0) : null;
  const nextKind =
    (save.next && typeof save.next.kind === "string") ? String(save.next.kind || "") : "";
  const inferredAuto = (!saveKind && nextIndex != null && floorIndex != null && nextIndex !== floorIndex);
  const useNext = (saveKind === "auto") || inferredAuto;
  const restorePolicy = useNext ? SAVE_RESTORE_POLICY_AUTO : SAVE_RESTORE_POLICY_MANUAL;
  const targetIndex =
    (useNext && nextIndex != null) ? (nextIndex | 0)
      : (floorIndex != null) ? (floorIndex | 0)
        : (nextIndex != null) ? (nextIndex | 0)
          : 0;
  const targetKind =
    (useNext && nextKind) ? String(nextKind || "")
      : (floorKind || (nextKind || ""));
  let applyFloorArtifacts = !useNext && (restorePolicy === "full") && (floorIndex != null);
  const applyFloorFlags = !useNext && !!save.floorState;
  const targetKindLower = String(targetKind || "").toLowerCase();
  const floorStateSafe = !!(save && save.floorState && (save.floorState as any).safe);
  if (applyFloorArtifacts && targetKindLower === "combat" && !floorStateSafe) {
    applyFloorArtifacts = false;
    logSave("[save] skipping floor artifacts (unsafe combat save)", {
      saveKind,
      floorStateSafe: floorStateSafe ? 1 : 0,
      targetIndex,
      targetKind,
    });
  }

  logSave("[save] load target", {
    saveKind,
    useNext: !!useNext,
    restorePolicy,
    floorIndex: floorIndex != null ? (floorIndex | 0) : null,
    nextIndex: nextIndex != null ? (nextIndex | 0) : null,
    targetIndex,
    targetKind,
  });
  _debugTrace("SAVE_APPLY_BEGIN", {
    sourceLabel: sourceLabel || "",
    saveKind,
    useNext: !!useNext,
    restorePolicy,
    floorIndex: floorIndex != null ? (floorIndex | 0) : null,
    floorKind,
    nextIndex: nextIndex != null ? (nextIndex | 0) : null,
    nextKind,
    targetIndex,
    targetKind,
    applyFloorArtifacts: !!applyFloorArtifacts,
    applyFloorFlags: !!applyFloorFlags,
  });

  // Clear any previous pending save state
  g.__pendingWorldSnapshotForSave = null;
  g.__pendingDecorPayload = null;
  g.__npcSavedSnapshotByKey = null;
  g.__heroSavedSnapshotByProfile = null;
  g.__loadedSaveProfiles = null;

  // Cache profiles from save (for UI/debug; spawning is still by connect)
  const profs: string[] = Array.isArray(save.profiles) ? save.profiles : [];
  g.__loadedSaveProfiles = profs.filter((p: any) => typeof p === "string" && p.trim());

  // Install blockly XML map
  if (!g.__heBlocklyXmlByProfile) g.__heBlocklyXmlByProfile = {};
  if (save.blocklyXmlByProfile && typeof save.blocklyXmlByProfile === "object") {
    for (const k of Object.keys(save.blocklyXmlByProfile)) {
      g.__heBlocklyXmlByProfile[k] = save.blocklyXmlByProfile[k];
    }
  }

  // Reset dungeon floor to saved state (host-only)
  try {
    const internals = g.__HeroEnginePhaserInternals || {};
    if (internals && typeof internals.resetFloorFromSave === "function") {
      const baseFamily =
        (applyFloorArtifacts && save.floor && typeof save.floor.baseFamily === "string")
          ? save.floor.baseFamily
          : "";
      const wallFamily =
        (applyFloorArtifacts && save.floor && typeof save.floor.wallFamily === "string")
          ? save.floor.wallFamily
          : "";
      const palette =
        (applyFloorArtifacts && save.floor && typeof save.floor.palette === "string")
          ? save.floor.palette
          : "";
      const textureSeed =
        (applyFloorArtifacts && save.floor && typeof save.floor.textureSeed === "number")
          ? (save.floor.textureSeed | 0)
          : 0;
      const ok = internals.resetFloorFromSave(targetIndex, targetKind, { baseFamily, wallFamily, palette, textureSeed });
      if (ok) logSave("[save] floor reset requested", { targetIndex, targetKind, baseFamily, wallFamily });
    }
  } catch (e) {
    console.warn("[save] floor reset failed", e);
  }

  const worldSnapRaw = save.worldSnapshot || save.heroSnapshot || null;
  const decorFromSave = applyFloorArtifacts ? (save.decor || null) : null;

  // Apply saved tilemap/decor if available
  const tilemapFromSave = applyFloorArtifacts ? (save.tilemap || null) : null;
  if (tilemapFromSave && typeof tilemapFromSave === "object") {
    const msg: any = { ...tilemapFromSave };
    if (!msg.decor && decorFromSave) msg.decor = decorFromSave;
    g.__lastTilemapMsg = msg;
    if (typeof g.__onNetTilemap === "function") {
      try { g.__onNetTilemap(msg); } catch (e) { console.warn("[save] apply tilemap failed", e); }
    } else {
      g.__pendingTilemapMsg = msg;
    }
  }

  // Apply saved floor flags (safe/cleared state)
  try {
    const internals = g.__HeroEnginePhaserInternals || {};
  if (applyFloorFlags && internals && typeof internals.applyFloorSaveFlags === "function" && save.floorState) {
    internals.applyFloorSaveFlags(save.floorState);
    logSave("[save] applied floor flags", save.floorState);
  }
  } catch (e) {
    console.warn("[save] apply floor flags failed", e);
  }

  // Teleport-load: do NOT apply world snapshot positions.
  if (applyFloorArtifacts) {
    const npcSpritesRaw: any[] = [];
    const npcSeen: any = {};
    const pushNpc = (s: any) => {
      if (!s) return;
      const id = (typeof s.id === "number") ? (s.id | 0) : 0;
      if (id && npcSeen[id]) return;
      if (id) npcSeen[id] = 1;
      npcSpritesRaw.push(s);
    };
    if (Array.isArray(save.npcSprites)) {
      for (const s of save.npcSprites) pushNpc(s);
    }
    if (worldSnapRaw && Array.isArray(worldSnapRaw.sprites)) {
      for (const s of worldSnapRaw.sprites) {
        if (_isNpcSnapshotSprite(s)) pushNpc(s);
      }
    }

    if (npcSpritesRaw.length) {
      const npcMap: any = {};
      for (const s of npcSpritesRaw) {
        const key = _npcSnapshotKey(s);
        if (!key) continue;
        if (s && typeof s === "object") (s as any).__loadDataOnly = true;
        npcMap[key] = s;
      }
      g.__npcSavedSnapshotByKey = npcMap;
      logSave("[save] queued npc snapshots for spawn", Object.keys(npcMap).length);
    }
  }

  if (decorFromSave) {
    g.__pendingDecorPayload = decorFromSave;
  }

  // Prepare hero snapshots by profile
  const heroArr = Array.isArray(save.heroSprites)
    ? save.heroSprites
    : (worldSnapRaw && Array.isArray(worldSnapRaw.sprites) ? worldSnapRaw.sprites : []);
  const map: any = {};
  for (const s of heroArr) {
    if (!s || !s.data) continue;
    const d: any = s.data || {};
    let prof =
      (typeof d.__profileKey === "string" && d.__profileKey.trim())
        ? d.__profileKey.trim()
        : (typeof d.profile === "string" && d.profile.trim())
          ? d.profile.trim()
          : (typeof d.name === "string" && d.name.trim())
            ? d.name.trim()
            : (typeof d.heroName === "string" && d.heroName.trim())
              ? d.heroName.trim()
              : "";
    if (!prof) {
      const owner = (typeof d.owner === "number") ? (d.owner | 0) : 0;
      if (owner > 0 && profs && profs[owner - 1]) prof = String(profs[owner - 1] || "");
    }
    if (prof) {
      if (s && typeof s === "object") (s as any).__loadDataOnly = true;
      map[prof] = s;
    }
  }
  g.__heroSavedSnapshotByProfile = map;

  try {
    const internals = g.__HeroEnginePhaserInternals || {};
    if (internals && typeof internals.applySavedSnapshots === "function") {
      const res = internals.applySavedSnapshots();
      logSave("[save] applied saved snapshots", res || {});
    }
  } catch (e) {
    console.warn("[save] apply saved snapshots failed", e);
  }

  // Floor theme hints
  if (!useNext && save.floor) {
    if (typeof save.floor.baseFamily === "string") g.__floorBaseFamily = save.floor.baseFamily;
    if (typeof save.floor.wallFamily === "string") g.__floorWallFamily = save.floor.wallFamily;
    if (typeof save.floor.palette === "string") g.__floorThemePalette = save.floor.palette;
    if (typeof save.floor.textureSeed === "number") g.__floorTextureSeed = (save.floor.textureSeed | 0);
  }

  // Tilemap cache (optional; host will resend on change)
  if (applyFloorArtifacts && save.tilemap) {
    g.__lastTilemapMsg = save.tilemap;
  }

  _debugTrace("SAVE_APPLY_DONE", {
    targetIndex,
    targetKind,
    applyFloorArtifacts: !!applyFloorArtifacts,
    applyFloorFlags: !!applyFloorFlags,
    profiles: g.__loadedSaveProfiles || [],
  });
  logSave("[save] pending save installed; will apply on next hero spawn for matching profiles");
  return true;
}

function _applyPendingSaveIfAny(): void {
  if (_pendingSaveApplied) return;
  const g: any = globalThis as any;
  if (!g.__isHost) return;

  const pending = g.__pendingSaveFromFile;
  if (!pending || !pending.parsed) return;

  const save = pending.parsed;
  if (!_applyHeroSavePayload(save, pending.name || "")) return;
  _pendingSaveApplied = true;
}

(globalThis as any).__onHostBecameHost = _applyPendingSaveIfAny;
(globalThis as any).__hero_applySavePayload = _applyHeroSavePayload;

type LoadLatestSaveOpts = {
  reason?: string;
  profile?: string;
  pid?: number;
  mode?: "latest" | "floor0";
};

function _requestLoadLatestSave(opts?: LoadLatestSaveOpts): Promise<any> {
  const g: any = globalThis as any;
  if (!g.__isHost) return Promise.resolve({ ok: false, reason: "not-host" });
  if (g.__heroLoadLatestInFlight) return Promise.resolve({ ok: false, reason: "busy" });

  const net: any = g.__net;
  if (!net || typeof net.sendSaveListRequest !== "function" || typeof net.sendSaveLoadRequest !== "function") {
    return Promise.resolve({ ok: false, reason: "no-net" });
  }

  const reason = opts && typeof opts.reason === "string" ? opts.reason : "";
  const profile = opts && typeof opts.profile === "string" ? opts.profile : "";
  const mode = (opts && opts.mode === "floor0") ? "floor0" : "latest";

  _debugTrace("LOAD_REQUEST", { reason: reason || null, profile: profile || null, mode });

  g.__heroLoadLatestInFlight = true;

  return net
    .sendSaveListRequest()
    .then((res: any) => {
      const entries = res && Array.isArray(res.entries) ? res.entries : [];
      if (!entries.length) return { ok: false, reason: "no-saves" };
      const autoEntries = entries.filter((e: any) => {
        const kind = (e && typeof e.saveKind === "string") ? String(e.saveKind || "") : "";
        return kind !== "manual";
      });
      const pool = autoEntries.length ? autoEntries : entries;
      let best = pool[0];
      if (mode === "floor0") {
        const floor0 = pool.find((e: any) => {
          const idx = (typeof e?.floorIndex === "number") ? (e.floorIndex | 0) : -1;
          return idx <= 0;
        });
        if (floor0) best = floor0;
        else best = pool[pool.length - 1] || pool[0];
      }
      const file = best && typeof best.file === "string" ? best.file : "";
      if (!file) return { ok: false, reason: "no-file" };
      logSave("[save] loading latest autosave", {
        file,
        savedAt: best.savedAt ?? null,
        mode,
        reason: reason || null,
        profile: profile || null,
      });
      _debugTrace("LOAD_SELECT", {
        file,
        savedAt: best.savedAt ?? null,
        floorIndex: best.floorIndex ?? null,
        floorKind: best.floorKind ?? null,
        saveKind: best.saveKind ?? null,
        mode,
        reason: reason || null,
      });
      return net.sendSaveLoadRequest({ file }).then((load: any) => {
        if (!load || load.error || !load.payload) {
          const failReason = load?.error || "load-failed";
          _debugTrace("LOAD_RESULT", { ok: false, reason: failReason, file });
          return { ok: false, reason: failReason };
        }
        const ok = _applyHeroSavePayload(load.payload, "latest-autosave");
        _debugTrace("LOAD_RESULT", { ok: !!ok, reason: ok ? "loaded" : "apply-failed", file });
        return { ok: !!ok, reason: ok ? "loaded" : "apply-failed" };
      });
    })
    .finally(() => {
      g.__heroLoadLatestInFlight = false;
    });
}

(globalThis as any).__hero_requestLoadLatestSave = _requestLoadLatestSave;










class HeroScene extends Phaser.Scene {

    private monsterAtlas?: MonsterAtlas;

    // NEW:
    private tileAtlas?: TileAtlas;
    private tileRenderer?: WorldTileRenderer;

    // Latest tilemap rev actually applied to the Phaser scene
    private _tilemapAppliedRev: number = 0;

    private _tilemapAppliedWorldRev: number = 0; // engine-world rev last applied locally (host-side)

    // DOM-sized viewport tracking (canvas should match the available game area, NOT the world)
    private _domResizeObs?: ResizeObserver;
    private _domViewW: number = 0;
    private _domViewH: number = 0;

    // Camera follow tracking
    private _camFollowPid: number = 0;
    private _camFollowNative?: Phaser.GameObjects.GameObject;

    // Camera zoom tracking
    private _camZoomUser: number = 1;
    private _camZoomBase: number = 1;
    private _camControlsInstalled: boolean = false;
    private _camZoomBaselineLocked: boolean = false;
    private _worldPixelW: number = 0;
    private _worldPixelH: number = 0;
    private _worldTileSize: number = 0;
    private _textureFiltersInstalled: boolean = false;
    private _cameraRoundOverrideInstalled: boolean = false;
    private _camFollowSanityAtMs: number = 0;
    private _bossIntroActive: boolean = false;
    private _bossIntroFloorIndex: number = -1;
    private _bossIntroHoldActive: boolean = false;
    private _bossIntroHoldUntilMs: number = 0;
    private _bossIntroHoldShadowX: number = 0;
    private _bossIntroHoldShadowY: number = 0;


    // NEW: track dims too (lets us force-reapply if needed)
    private _tilemapAppliedRows: number = 0;
    private _tilemapAppliedCols: number = 0;
    private _tilemapAppliedTileSize: number = 0;

    private _tilemapAppliedFloorIndex: number = -1;
    private _tilemapAppliedDecorRev: number = -1;
    private _tilemapAppliedPropByAnchor: Record<string, string> | null = null;
    private _worldSyncHashMismatchSinceMs: number = 0;
    private _worldSyncHashMismatchExpected: number = 0;
    private _worldSyncHashMismatchWarned: boolean = false;

    // Debug throttles for decor logging
    private _debugPropLastCaptureRev: number = -1;
    private _debugPropLastCaptureAt: number = 0;
    private _debugPropLastApplyRev: number = -1;
    private _debugPropLastApplyAt: number = 0;


    constructor() {
        super("hero");
    }

    preload() {
        _uiLoadingShow("Loading assets…");
        _uiLoadingSet(5, "Queueing assets…");

        const loader = this.load;
        const fileLabelThrottleMs = 140;
        let lastFileLabel = "";
        let lastFileAt = 0;
        const nowMs = () => (
            (typeof performance !== "undefined" && typeof performance.now === "function")
                ? performance.now()
                : Date.now()
        );
        const groupFrom = (url: string, key: string) => {
            const u = String(url || "").toLowerCase();
            const k = String(key || "").toLowerCase();
            if (u.includes("/assets/effects/") || k.startsWith("effects.")) return "effects";
            if (u.includes("/assets/weapons/") || k.startsWith("weapons.")) return "weapons";
            if (u.includes("/assets/tiles/") || k.startsWith("tiles.")) return "tiles";
            if (u.includes("/assets/monsters/") || k.startsWith("monsters.")) return "monsters";
            if (u.includes("/assets/heroes/") || k.startsWith("heroes.") || k.startsWith("hero.")) return "heroes";
            if (u.includes("/assets/props/") || k.startsWith("props.")) return "props";
            return "";
        };
        const weaponNameFromKey = (rawKey: string): string => {
            if (!rawKey || rawKey.indexOf("__") < 0) return "";
            const parts = rawKey.split("__").filter(Boolean);
            if (parts.length < 6) return "";
            if (!/^t(064|128|192)$/i.test(parts[0] || "")) return "";
            let vIndex = -1;
            for (let i = parts.length - 1; i >= 0; i--) {
                if (/^v.+/i.test(parts[i])) {
                    vIndex = i;
                    break;
                }
            }
            if (vIndex < 5) return "";
            const modelTokens = parts.slice(2, vIndex - 2);
            if (!modelTokens.length) return "";
            return modelTokens.join("_");
        };
        const fileLabel = (file: any) => {
            const key = String(file?.key || "").trim();
            const rawUrl = String(file?.url || file?.src || "").trim();
            const url = rawUrl.split("?")[0] || "";
            const baseFromUrl = (url.split(/[\\/]/).pop() || "").trim();
            const rawBase = key || baseFromUrl || "asset";
            const rawWeapon = weaponNameFromKey(rawBase);

            let name = rawWeapon || rawBase;
            name = name.replace(/\.[a-z0-9]+$/i, "");
            name = name.replace(/^effects\./i, "");
            name = name.replace(/^tiles\./i, "");
            name = name.replace(/^anims\./i, "");
            name = name.replace(/^monsters\./i, "");
            name = name.replace(/^heroes\./i, "");
            name = name.replace(/^hero\./i, "");
            name = name.replace(/^props\./i, "");
            name = name.replace(/^weapons\./i, "");
            name = name.replace(/_aura_r\d+$/i, "");
            name = name.replace(/_192$/i, "");
            name = name.replace(/\s*\d+x\d+$/i, "");
            name = name.replace(/__+/g, " ");
            name = name.replace(/_+/g, " ");
            name = name.trim();
            if (!name) name = "asset";
            return name;
        };
        const onFileProgress = (file: any, progress: number) => {
            const label = fileLabel(file);
            const now = nowMs();
            if (label === lastFileLabel && (now - lastFileAt) < fileLabelThrottleMs) return;
            lastFileLabel = label;
            lastFileAt = now;
            const pct = (typeof progress === "number" && isFinite(progress))
                ? `${Math.round(progress * 100)}%`
                : "";
            const total = (loader.totalToLoad | 0) || 0;
            const done = (loader.totalComplete | 0) || 0;
            const count = total > 0 ? `${done}/${total}` : "";
            const extra = [pct, count].filter(Boolean).join(" • ");
            _uiLoadingSet(undefined, `Loading ${label}${extra ? " (" + extra + ")" : ""}`);
        };
        const onProgress = (v: number) => {
            _uiLoadingSet(Math.round(v * 40));
        };
        const onComplete = () => {
            loader.off("fileprogress", onFileProgress as any);
            loader.off("progress", onProgress as any);
            _uiLoadingSet(50, "Assets loaded");
        };

        loader.on("fileprogress", onFileProgress as any);
        loader.on("progress", onProgress as any);
        loader.once("complete", onComplete);

        logMain(">>> [HeroScene.preload] loading LPC monster sheets");
        preloadMonsterSheets(this);

        _uiLoadingSet(10, "Queueing assets: heroes");
        logMain(">>> [HeroScene.preload] loading hero spritesheets");
        preloadHeroSheets(this);

        _uiLoadingSet(15, "Queueing assets: tiles");
        logMain(">>> [HeroScene.preload] loading tile sheets");
        preloadTileSheets(this);

        _uiLoadingSet(20, "Queueing assets: weapons");
        logMain(">>> [HeroScene.preload] loading weapon sheets");
        loadWeaponAtlases(this);
        preloadWeaponChainImages(this);
        preloadHookshotThrustSheet(this);

        _uiLoadingSet(25, "Queueing assets: effects");
        logMain(">>> [HeroScene.preload] loading effect sheets");
        preloadEffectSheets(this);

        preloadStudentAssets(this);

    }



async create() {
    logMain(">>> [HeroScene.create] running (refactored)");

    // 1) Globals + debug flags (weapon flags come from constants, not URL)
    this.setupGlobalsAndDebug();

    this._installNearestTextureFiltering();

    
    // ✅ DOM-sized viewport management (canvas tracks #app size)
    this._installDomResizeObserver();

    this._installCameraZoomControls();
    this._installCameraRenderRoundOverride();
    this._updateCameraZoom();

    // 2) Loading indicator
    const loadingText = this.createLoadingText();
    _uiLoadingSet(52, "Initializing scene…");

    // 3) Hero atlas + aura validation
    _uiLoadingSet(56, "Building hero atlas…");
    buildHeroAtlas(this);
    this.validateHeroAuras(loadingText);
    _uiLoadingSet(62, "Building effect atlas…");
    loadingText.destroy();

    // 3b) Effect atlas
    await buildEffectAtlas(this);

    // 4) Tile atlas + net tilemap hook (+ apply pending cached tilemap)
    _uiLoadingSet(68, "Building tile atlas…");
    this.initTileAtlasAndInstallTilemapHook();
    _uiLoadingSet(75, "Waiting for tilemap…");

    // 5) Host flag / role
    this.ensureHostFlagInitialized();

    // 6) Import MakeCode-ish modules (compat + extensions)
    _uiLoadingSet(78, "Loading MakeCode modules…");
    const compatMod = await this.importMakeCodeModules();

    // 7) Hook: network will call this when we become host
    this.installStartHeroEngineHostHook();

    // 8) Network init (all clients)
    _uiLoadingSet(82, "Initializing network…");
    this.initNetwork(compatMod);
    initStudentSystems({
      scene: this,
      isHost: _isHostClient,
      getGlobals: () => (globalThis as any),
    });
    _tryPruneUnconnectedHeroes("scene-create");

    // 9) Keyboard -> controller wiring (all clients)
    _uiLoadingSet(86, "Wiring input…");
    this.wireKeyboardToController();

    // 9b) Gamepad -> controller wiring (all clients)
    this.wireGamepadToController();

    // 10) Monster atlas + registry exposure
    _uiLoadingSet(90, "Building monster atlas…");
    this.buildMonsterAtlasAndRegistry();

    // 11) Optional hero anim tester
    this.maybeInstallHeroAnimTester();

    // 12) DOM dialog test (timed splash)
    _uiLoadingSet(95, "Finalizing startup…");
    this.runStartupDialogTest();

    logMain(">>> [HeroScene.create] complete (refactored)");
    

}


    


private ensureWorldTileRenderer(atlas: TileAtlas) {
    if (this.tileRenderer) return this.tileRenderer;

    const tileValueToFamily = (v: number) => {
        const g: any = globalThis as any;
        const base = (g.__floorBaseFamily as any) || "ground_light";
        const wall = (g.__floorWallFamily as any) || "chasm_light";
        if (v === 1 || v === 2) return wall;
        return base;
    };

    this.tileRenderer = new WorldTileRenderer(this, atlas, {
        debugLocal: true,
        tileValueToFamily,
    });
    try { (globalThis as any).__heTileRenderer = this.tileRenderer; } catch { }

    return this.tileRenderer;
}

private _computeWorldSyncHashFromRenderer(renderer?: WorldTileRenderer | null): { baseSig: number; decorSig: number; worldSig: number } | null {
    if (!renderer) return null;

    const anyRenderer: any = renderer as any;
    const baseSig = (anyRenderer.__lastGridSig | 0) || 0;

    const instByAnchor: Record<string, any> = anyRenderer.__propInstancesByAnchor || {};
    const propKeys = Object.keys(instByAnchor);
    propKeys.sort();
    let propSig = 0;
    for (const k of propKeys) {
        const inst = instByAnchor[k];
        const rawKey = String(inst?.rawKey ?? inst?.baseName ?? "");
        propSig = _hashMix(propSig, _hashString(k));
        propSig = _hashMix(propSig, _hashString(rawKey));
    }

    const map = anyRenderer.map as any;
    const rows = map ? (map.height | 0) : 0;
    const cols = map ? (map.width | 0) : 0;
    const decalSig = _hashTileLayer(anyRenderer.decalLayer, rows, cols);

    const decorSig = _hashMix(_hashMix(0, propSig), decalSig);
    const worldSig = _hashMix(_hashMix(0, baseSig), decorSig);

    return { baseSig, decorSig, worldSig };
}

private _checkWorldSyncHashFromMsg(msg: any): void {
    const thresholdMs = (WORLD_SYNC_HASH_WARN_THRESHOLD_MS | 0) || 0;
    if (thresholdMs <= 0) return;
    if (!msg || typeof msg.worldSig !== "number") return;

    const expected = (msg.worldSig | 0);
    const sync = this._computeWorldSyncHashFromRenderer(this.tileRenderer);
    if (!sync) return;

    const local = (sync.worldSig | 0);
    if (local === expected) {
        this._worldSyncHashMismatchSinceMs = 0;
        this._worldSyncHashMismatchExpected = expected;
        this._worldSyncHashMismatchWarned = false;
        return;
    }

    const nowMs = Date.now();
    if (this._worldSyncHashMismatchExpected !== expected || this._worldSyncHashMismatchSinceMs === 0) {
        this._worldSyncHashMismatchExpected = expected;
        this._worldSyncHashMismatchSinceMs = nowMs;
        this._worldSyncHashMismatchWarned = false;
    }

    if (!this._worldSyncHashMismatchWarned && (nowMs - this._worldSyncHashMismatchSinceMs) >= thresholdMs) {
        console.warn("[tilemap.hash] mismatch > threshold", {
            expectedWorldSig: expected,
            localWorldSig: local,
            expectedBaseSig: (typeof msg.baseSig === "number") ? (msg.baseSig | 0) : null,
            expectedDecorSig: (typeof msg.decorSig === "number") ? (msg.decorSig | 0) : null,
            localBaseSig: sync.baseSig | 0,
            localDecorSig: sync.decorSig | 0,
            rev: msg.rev ?? null,
            worldRev: msg.worldRev ?? null,
            floorIndex: msg.floorIndex ?? null,
            decorRev: msg.decor?.rev ?? null,
            decorOnly: !!msg.decorOnly,
        });
        this._worldSyncHashMismatchWarned = true;
    }
}


private _installDomResizeObserver(): void {
    if (this._domResizeObs) return;

    const el = document.getElementById("app") || document.getElementById("viewport");
    if (!el || typeof (globalThis as any).ResizeObserver === "undefined") {
        // Fallback: still try once
        this._resizeGameToDomViewport("install(no-RO)");
        return;
    }

    this._domResizeObs = new ResizeObserver(() => {
        this._resizeGameToDomViewport("ResizeObserver");
    });
    this._domResizeObs.observe(el);

    // One immediate sizing pass
    this._resizeGameToDomViewport("install");
}

private _resizeGameToDomViewport(reason: string): void {
    const el = document.getElementById("app") || document.getElementById("viewport");
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (!Number.isFinite(r.width) || !Number.isFinite(r.height)) return;

    const w = (r.width | 0);
    const h = (r.height | 0);
    if (w < 16 || h < 16) return;

    if (w === this._domViewW && h === this._domViewH) return;
    this._domViewW = w;
    this._domViewH = h;

    // With Phaser.Scale.RESIZE this is legal; it makes the canvas match DOM
    if (!this.scale || typeof this.scale.resize !== "function") return;
    this.scale.resize(w, h);

    // Ensure the main camera viewport matches
    const cam = this.cameras ? this.cameras.main : null;
    if (!cam || typeof cam.setViewport !== "function") return;
    cam.setViewport(0, 0, w, h);

    this._updateCameraZoom();
}

private _installCameraZoomControls(): void {
    if (this._camControlsInstalled) return;
    this._camControlsInstalled = true;

    const kb = this.input?.keyboard;
    if (kb) {
        kb.on("keydown", (ev: KeyboardEvent) => {
            if (this._shouldIgnoreKeyEvent(ev)) return;
            if (ev.ctrlKey || ev.metaKey) return;

            try {
                const g: any = globalThis as any;
                if (g && typeof g.__heNotifyFirstInput === "function") {
                    g.__heNotifyFirstInput();
                }
            } catch { }

            const key = ev.key;
            if (key === "=" || key === "+" || key === "]") {
                ev.preventDefault();
                ev.stopPropagation();
                this._nudgeUserZoom(1);
                return;
            }
            if (key === "-" || key === "_" || key === "[") {
                ev.preventDefault();
                ev.stopPropagation();
                this._nudgeUserZoom(-1);
                return;
            }
            if (key === "0") {
                ev.preventDefault();
                ev.stopPropagation();
                this._setUserZoom(1);
            }
        });
    }

    this.input.on("wheel", (_pointer: any, _go: any, _dx: number, dy: number, _dz: number, ev: WheelEvent) => {
        if (!ev) return;
        if (ev.ctrlKey || ev.metaKey) return;

        const dir = (dy > 0) ? -1 : 1;
        this._nudgeUserZoom(dir);

        ev.preventDefault();
    });
}

private _shouldIgnoreKeyEvent(ev: KeyboardEvent): boolean {
    const t = ev.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if ((t as any).isContentEditable) return true;
    return false;
}

private _nudgeUserZoom(dir: number): void {
    if (!Number.isFinite(dir) || dir === 0) return;
    const sign = (dir > 0) ? 1 : -1;
    const step = this._getUserZoomStep(sign);
    this._setUserZoom(this._camZoomUser + (sign * step));
}

private _setUserZoom(next: number): void {
    if (!Number.isFinite(next)) return;

    const snapped = this._snapUserZoomValue(next);
    if (Math.abs(snapped - this._camZoomUser) < 0.0001) return;

    this._camZoomUser = snapped;
    this._updateCameraZoom();
}

private _getZoomComp(): number {
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    return (Number.isFinite(dpr) && dpr > 0) ? Math.max(1, 1 / dpr) : 1;
}

private _getBaseZoomStep(): number {
    const tileSize = this._worldTileSize | 0;
    if (tileSize > 0) {
        const step = CAMERA_ZOOM_BASE_TILE_PIXEL_MULTIPLE / tileSize;
        if (Number.isFinite(step) && step > 0) return step;
    }
    return CAMERA_ZOOM_BASE_STEP_FALLBACK;
}

private _getTargetZoomStep(): number {
    const tileSize = this._worldTileSize | 0;
    if (tileSize > 0) {
        const step = CAMERA_ZOOM_TARGET_TILE_PIXEL_MULTIPLE / tileSize;
        if (Number.isFinite(step) && step > 0) return step;
    }
    return CAMERA_ZOOM_TARGET_STEP_FALLBACK;
}

private _getUserZoomStep(dir: number): number {
    if (dir < 0) {
        if (this._camZoomUser <= 1.0001) return CAMERA_USER_ZOOM_STEP_LOW;
        return CAMERA_USER_ZOOM_STEP_HIGH;
    }
    if (dir > 0) {
        if (this._camZoomUser < 0.9999) return CAMERA_USER_ZOOM_STEP_LOW;
        return CAMERA_USER_ZOOM_STEP_HIGH;
    }
    return CAMERA_USER_ZOOM_STEP_LOW;
}

private _snapUserZoomValue(value: number): number {
    if (!Number.isFinite(value)) return this._camZoomUser;
    const clamped = Phaser.Math.Clamp(value, CAMERA_USER_ZOOM_MIN, CAMERA_USER_ZOOM_MAX);
    const step = (clamped <= 1)
        ? CAMERA_USER_ZOOM_STEP_LOW
        : CAMERA_USER_ZOOM_STEP_HIGH;
    const snapped = Math.round(clamped / step) * step;
    const fixed = Math.round(snapped * 1000) / 1000;
    return Phaser.Math.Clamp(fixed, CAMERA_USER_ZOOM_MIN, CAMERA_USER_ZOOM_MAX);
}

private _updateCameraZoom(): void {
    const cam = this.cameras?.main;
    if (!cam) return;

    const viewW = this._domViewW || cam.width || 0;
    const viewH = this._domViewH || cam.height || 0;
    if (viewW <= 0 || viewH <= 0) return;

    let fit = Math.min(viewW / CAMERA_BASE_VIEW_W, viewH / CAMERA_BASE_VIEW_H);
    if (this._worldPixelH > 0 && this._worldPixelW > 0) {
        fit = 1;
    }
    const baseStep = this._getBaseZoomStep();
    if (Number.isFinite(baseStep) && baseStep > 0) {
        fit = Math.round(fit / baseStep) * baseStep;
    }
    this._camZoomBase = (Number.isFinite(fit) && fit > 0) ? fit : 1;

    const zoomComp = this._getZoomComp();

    const snappedUser = this._snapUserZoomValue(this._camZoomUser);
    if (Math.abs(snappedUser - this._camZoomUser) > 0.0001) {
        this._camZoomUser = snappedUser;
    }

    const targetStep = this._getTargetZoomStep();

    let target = this._camZoomBase * zoomComp * this._camZoomUser;
    if (Number.isFinite(targetStep) && targetStep > 0) {
        target = Math.round(target / targetStep) * targetStep;
    }

    target = Phaser.Math.Clamp(
        target,
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
    );

    const denom = this._camZoomBase * zoomComp;
    if (Number.isFinite(denom) && denom > 0) {
        const resnappedUser = this._snapUserZoomValue(target / denom);
        if (Math.abs(resnappedUser - this._camZoomUser) > 0.0001) {
            this._camZoomUser = resnappedUser;
            target = denom * resnappedUser;
            if (Number.isFinite(targetStep) && targetStep > 0) {
                target = Math.round(target / targetStep) * targetStep;
            }
            target = Phaser.Math.Clamp(target, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
        }
    }

    if (!Number.isFinite(target) || target <= 0) return;
    if (Math.abs((cam.zoom || 1) - target) < 0.0001) return;

    cam.setRoundPixels(true);
    cam.setZoom(target);
}

private _snapCameraScrollToPixelGrid(): void {
    const cam = this.cameras?.main;
    if (!cam) return;

    const z = (cam.zoom || 1);
    if (!Number.isFinite(z) || z <= 0) return;

    const snap = (v: number) => Math.round(v * z) / z;
    const nextX = snap(cam.scrollX);
    const nextY = snap(cam.scrollY);

    if (nextX !== cam.scrollX || nextY !== cam.scrollY) {
        cam.setScroll(nextX, nextY);
    }
}

private _installNearestTextureFiltering(): void {
    if (this._textureFiltersInstalled) return;
    this._textureFiltersInstalled = true;

    const texMgr: any = this.textures;
    if (!texMgr) return;

    const apply = (tex: any) => {
        if (!tex || typeof tex.setFilter !== "function") return;
        try { tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch { }
    };

    const list = (texMgr.list as Record<string, any>) || {};
    for (const k of Object.keys(list)) {
        apply(list[k]);
    }

    try {
        texMgr.on(Phaser.Textures.Events.ADD, (_key: string, tex: any) => apply(tex));
    } catch {
        texMgr.on("addtexture", (_key: string, tex: any) => apply(tex));
    }
}

private _installCameraRenderRoundOverride(): void {
    if (this._cameraRoundOverrideInstalled) return;
    this._cameraRoundOverrideInstalled = true;

    const cam = this.cameras?.main as any;
    if (!cam || typeof cam.preRender !== "function") return;

    const scene = this;
    const orig = cam.preRender;
    cam.preRender = function () {
        orig.call(this);
        if (!this.roundPixels) return;
        const tileSize = scene._worldTileSize | 0;
        if (tileSize <= 0) return;
        const zx = this.zoomX;
        const zy = this.zoomY;
        if (!Number.isFinite(zx) || !Number.isFinite(zy)) return;
        const pxX = zx * tileSize;
        const pxY = zy * tileSize;
        if (Math.abs(pxX - Math.round(pxX)) > 0.0001) return;
        if (Math.abs(pxY - Math.round(pxY)) > 0.0001) return;
        this.renderRoundPixels = true;
    };
}

private _updateCameraFollowLocalHero(): void {
    const g: any = globalThis as any;
    const net = g.__net || g.net;
    const pid = ((net?.playerId ?? 0) | 0);
    if (pid <= 0) {
        const anyHero = _hud_tryFindAnyPlayableHeroSprite();
        if (anyHero) _uiLoadingMarkHero();
        return;
    }

    const spritesNS: any = g?.sprites;
    if (!spritesNS || typeof spritesNS.allSprites !== "function") return;

    let bestNative: any = undefined;

    const all = spritesNS.allSprites() as any[];
    for (const s of all) {
        if (!s) continue;
        const native = (s as any).native as Phaser.GameObjects.GameObject | undefined;
        if (!native) continue;

        let owner = 0;
        try {
            owner = (spritesNS.readDataNumber(s, "owner") | 0);
        } catch {
            owner = 0;
        }
        if (owner === pid) {
            bestNative = native;
            break;
        }
    }

    if (!bestNative) return;
    _uiLoadingMarkHero();

    const cam: any = this.cameras?.main;
    const follow = cam ? cam._follow : null;
    const needsFollow = (this._camFollowPid !== pid || this._camFollowNative !== bestNative || follow !== bestNative);
    if (needsFollow && cam && typeof cam.startFollow === "function") {
        this._camFollowPid = pid;
        this._camFollowNative = bestNative;

        // Smooth follow; keep the hero centered more aggressively
        cam.startFollow(bestNative, true, 0.35, 0.35);
    }
}

private _forceCameraFollowNow(_reason: string): void {
    const cam = this.cameras?.main;
    if (!cam) return;

    this._camFollowPid = 0;
    this._camFollowNative = undefined;
    try { cam.stopFollow(); } catch { }

    this._updateCameraFollowLocalHero();
    const native: any = this._camFollowNative as any;
    if (native && Number.isFinite(native.x) && Number.isFinite(native.y)) {
        try { cam.centerOn(native.x, native.y); } catch { }
    }
    this._snapCameraScrollToPixelGrid();
}

private _checkCameraFollowSanity(nowMs: number): void {
    const nextAt = this._camFollowSanityAtMs | 0;
    if (nextAt > 0 && nowMs < nextAt) return;
    this._camFollowSanityAtMs = (nowMs + CAMERA_FOLLOW_SANITY_MS) | 0;

    const g: any = globalThis as any;
    const net = g.__net || g.net;
    const pid = ((net?.playerId ?? 0) | 0);

    let hero: any = null;
    if (pid > 0) hero = _hud_tryGetLocalHeroSprite(pid);
    if (!hero) hero = _hud_tryFindAnyPlayableHeroSprite();
    if (!hero) return;

    const native: any = (hero as any).native;
    if (!native) return;

    const cam = this.cameras?.main as any;
    if (!cam) return;

    const follow = cam._follow as any;
    const isFollowing = follow === native;
    const view = cam.worldView;
    const hasView = !!(view && Number.isFinite(view.centerX) && Number.isFinite(view.centerY));
    const midX = hasView ? view.centerX : (cam.midPoint?.x ?? (cam.scrollX + (cam.width * 0.5)));
    const midY = hasView ? view.centerY : (cam.midPoint?.y ?? (cam.scrollY + (cam.height * 0.5)));
    const inView = hasView ? !!view.contains(native.x, native.y) : true;

    const dx = (native.x - midX);
    const dy = (native.y - midY);
    const dist = Math.sqrt((dx * dx) + (dy * dy));
    const tileSize = this._worldTileSize | 0;
    const threshold = Math.max(tileSize > 0 ? tileSize * CAMERA_FOLLOW_SANITY_TILES : 0, 160);

    if (!isFollowing || !inView || dist > threshold) {
        this._forceCameraFollowNow("sanity");
    }
}

private _findLocalHeroNative(): Phaser.GameObjects.GameObject | null {
    const g: any = globalThis as any;
    const net = g.__net || g.net;
    const pid = ((net?.playerId ?? 0) | 0);
    const spritesNS: any = g?.sprites;
    if (!spritesNS || typeof spritesNS.allSprites !== "function") return null;

    const all = spritesNS.allSprites() as any[];
    for (const s of all) {
        if (!s) continue;
        const native = (s as any).native as Phaser.GameObjects.GameObject | undefined;
        if (!native) continue;
        let owner = 0;
        try {
            owner = (spritesNS.readDataNumber(s, "owner") | 0);
        } catch {
            owner = 0;
        }
        if (pid > 0 && owner === pid) return native;
    }

    for (const s of all) {
        if (!s) continue;
        const native = (s as any).native as Phaser.GameObjects.GameObject | undefined;
        if (native) return native;
    }

    return null;
}

private _findEnemyNativeById(monsterId: string, x: number, y: number): Phaser.GameObjects.GameObject | null {
    const g: any = globalThis as any;
    const spritesNS: any = g?.sprites;
    if (!spritesNS || typeof spritesNS.allSprites !== "function") return null;
    const want = String(monsterId || "").trim().toLowerCase();
    if (!want) return null;

    const all = spritesNS.allSprites() as any[];
    let best: Phaser.GameObjects.GameObject | null = null;
    let bestD2 = 1e18;
    for (const s of all) {
        if (!s) continue;
        const native = (s as any).native as Phaser.GameObjects.GameObject | undefined;
        if (!native) continue;
        let mid = "";
        try {
            mid = String(spritesNS.readDataString(s, "monsterId") || "").trim().toLowerCase();
        } catch {
            mid = "";
        }
        if (!mid || mid !== want) continue;
        const dx = (native.x as number) - x;
        const dy = (native.y as number) - y;
        const d2 = (dx * dx) + (dy * dy);
        if (d2 < bestD2) {
            bestD2 = d2;
            best = native;
        }
    }
    return best;
}

private _startBossIntro(evt: any): void {
    const cam = this.cameras?.main as any;
    if (!cam) return;

    const g: any = globalThis as any;
    const internals = g.__HeroEnginePhaserInternals || {};

    this._bossIntroActive = true;
    this._bossIntroFloorIndex = (evt?.floorIndex | 0) || -1;

    const OPENING_PHASE_MS = 3000;
    const OPENING_SHAKE_MS = 2600;
    const OPENING_SHAKE_INTENSITY = 0.004;
    const INTRO_PAN_MS = 600;
    const INTRO_ROAR_HOLD_MS = 3000;
    const INTRO_ZOOM_OUT_PCT = 72;
    const INTRO_SHAKE_MS = 320;
    const JUMP_START_DELAY_MS = INTRO_PAN_MS + INTRO_ROAR_HOLD_MS + 80;
    const RETURN_DELAY_MS = 1200;
    const SHADOW_MARGIN_PX = 170;
    const SHADOW_START_SCALE = 0.25;
    const SHADOW_END_SCALE = 3.2;
    const CONTROL_RELEASE_EARLY_MS = 0;
    const MIN_UNLOCK_DELAY_MS = 0;
    const SPARK_TEX = "__bossShadowSpark";
    const SPARK_TINT = 0xbbe6ff;
    const DEFAULT_CONTROL_LEAD_MS = 4000;

    const targetX = (evt?.x != null ? (evt.x | 0) : cam.midPoint?.x || 0);
    const targetY = (evt?.y != null ? (evt.y | 0) : cam.midPoint?.y || 0);
    const monsterId = String(evt?.monsterId || "").trim();

    const startBossSequence = () => {
        try { internals.setBossIntroHeroLock?.(true); } catch { }
        try { internals.setEnginePaused?.(true, "bossIntro"); } catch { }

        let bossNative: any = null;
        if (monsterId) {
            bossNative = this._findEnemyNativeById(monsterId, targetX, targetY);
        }

        const prevZoom = (cam.zoom || 1);
        try { cam.stopFollow(); } catch { }

        if (bossNative) {
            try { bossNative.setAlpha?.(0); } catch { bossNative.alpha = 0; }
        }

        const zoomOut = Math.max(0.55, prevZoom * (INTRO_ZOOM_OUT_PCT / 100));

        cam.pan(targetX, targetY, INTRO_PAN_MS, "Sine.easeInOut");
        cam.zoomTo(zoomOut, INTRO_PAN_MS, "Sine.easeInOut");

        this.time.delayedCall(INTRO_PAN_MS + 40, () => {
            if (bossNative) {
                this.tweens.add({
                    targets: bossNative,
                    alpha: { from: 0.2, to: 1 },
                    duration: 220,
                    yoyo: true,
                    repeat: 2,
                    onComplete: () => {
                        try { bossNative.setAlpha?.(1); } catch { bossNative.alpha = 1; }
                    }
                });
            }
            try { cam.shake(INTRO_SHAKE_MS, 0.012); } catch { }
        });

        let finished = false;
        const finishIntro = (restoreFollow: boolean): void => {
            if (finished) return;
            finished = true;
            this._bossIntroActive = false;
            this._camFollowPid = 0;
            this._camFollowNative = undefined;
            try { cam.stopFollow(); } catch { }
            if (restoreFollow) this._updateCameraFollowLocalHero();
            try { internals.setBossIntroHeroLock?.(false); } catch { }
        };

        const getRuntimeNow = (): number => {
            try {
                const gg: any = (globalThis as any).game;
                if (gg && typeof gg.runtime === "function") return gg.runtime() | 0;
            } catch { }
            return (this.time?.now | 0) || 0;
        };

        this.time.delayedCall(JUMP_START_DELAY_MS, () => {
            try { internals.setEnginePaused?.(false, "bossIntro"); } catch { }
            let jumpInfo: any = null;
            try { jumpInfo = internals.startBossIntroJump?.(evt); } catch { jumpInfo = null; }

            const landAtMs = (jumpInfo && jumpInfo.ok) ? (jumpInfo.landAtMs | 0) : 0;
            const controlLeadMs = (jumpInfo && jumpInfo.controlLeadMs != null) ? (jumpInfo.controlLeadMs | 0) : DEFAULT_CONTROL_LEAD_MS;
            const shadowX = (jumpInfo && jumpInfo.targetX != null) ? (jumpInfo.targetX | 0) : targetX;
            const shadowY = (jumpInfo && jumpInfo.targetY != null) ? (jumpInfo.targetY | 0) : targetY;

            const runtimeNow = getRuntimeNow();
            const landDelay = landAtMs > 0 ? Math.max(0, landAtMs - runtimeNow) : 0;

        if (jumpInfo && jumpInfo.ok) {
            this._bossIntroHoldActive = true;
            this._bossIntroHoldUntilMs = (jumpInfo.endMs | 0) || (landAtMs | 0);
            this._bossIntroHoldShadowX = shadowX | 0;
            this._bossIntroHoldShadowY = shadowY | 0;
        }

            let shadow: any = null;
            let sparkFx: any = null;
            let unlockDelay = RETURN_DELAY_MS + 1600;
            let returnPanMs = 2000;

            if (landDelay > 0) {
                const effectiveLeadMs = Math.max(0, (controlLeadMs | 0) + (CONTROL_RELEASE_EARLY_MS | 0));
                const unlockAtLead = Math.max(0, landDelay - effectiveLeadMs);
                unlockDelay = Math.min(landDelay, Math.max(MIN_UNLOCK_DELAY_MS, unlockAtLead));
                const panBudget = Math.max(800, unlockDelay - RETURN_DELAY_MS - 200);
                returnPanMs = Math.min(3600, Math.max(1600, panBudget));
            }

        if (landDelay > 0) {
            shadow = this.add.ellipse(shadowX, shadowY, 34, 20, 0x000000, 0.55);
            try { shadow.setDepth(10000); } catch { }
            try { shadow.setScale(SHADOW_START_SCALE); } catch { }
            const growthDur = Math.max(600, landDelay);
            this.tweens.add({
                targets: shadow,
                scaleX: SHADOW_END_SCALE,
                scaleY: SHADOW_END_SCALE,
                duration: growthDur,
                ease: "Sine.easeIn"
            });

            try {
                if (!this.textures.exists(SPARK_TEX)) {
                    const gg = this.make.graphics({ x: 0, y: 0, add: false });
                    gg.fillStyle(0xffffff, 1);
                    gg.fillCircle(3, 3, 3);
                    gg.generateTexture(SPARK_TEX, 6, 6);
                    gg.destroy();
                }
                sparkFx = this.add.particles(shadowX, shadowY, SPARK_TEX, {
                    lifespan: { min: 600, max: 1100 },
                    speed: { min: 6, max: 42 },
                    angle: { min: 0, max: 360 },
                    quantity: 1,
                    frequency: 70,
                    scale: { start: 1.1, end: 0 },
                    alpha: { start: 0.85, end: 0 },
                    tint: SPARK_TINT,
                    blendMode: "ADD"
                });
                try { sparkFx.setDepth?.(10020); } catch { }
            } catch { sparkFx = null; }

            this.time.delayedCall(landDelay, () => {
                try { cam.shake(420, 0.018); } catch { }
                try { shadow?.destroy?.(); } catch { }
                try { sparkFx?.destroy?.(); } catch { }
            });
        }

        this.time.delayedCall(RETURN_DELAY_MS, () => {
            const heroNative = this._findLocalHeroNative();
            let focusX = shadowX;
            let focusY = shadowY;
            let zoomTarget = zoomOut;

            if (heroNative && Number.isFinite((heroNative as any).x) && Number.isFinite((heroNative as any).y)) {
                const hx = (heroNative as any).x as number;
                const hy = (heroNative as any).y as number;
                focusX = (hx + shadowX) * 0.5;
                focusY = (hy + shadowY) * 0.5;

                const dx = Math.abs(hx - shadowX);
                const dy = Math.abs(hy - shadowY);
                const wNeed = Math.max(1, dx + SHADOW_MARGIN_PX * 2);
                const hNeed = Math.max(1, dy + SHADOW_MARGIN_PX * 2);
                const zoomFitX = cam.width / wNeed;
                const zoomFitY = cam.height / hNeed;
                const zoomFit = Math.max(0.55, Math.min(zoomFitX, zoomFitY));
                zoomTarget = Math.min(prevZoom, zoomFit);
                zoomTarget = Math.max(zoomOut * 0.98, zoomTarget);
            }

            cam.pan(focusX, focusY, returnPanMs, "Sine.easeInOut");
            cam.zoomTo(zoomTarget, returnPanMs, "Sine.easeInOut");
        });

            if (landDelay > 0) {
                this.time.delayedCall(unlockDelay, () => finishIntro(true));
            } else {
                const fallbackDelay = RETURN_DELAY_MS + returnPanMs;
                this.time.delayedCall(fallbackDelay, () => finishIntro(true));
            }
        });
    };

    try { internals.setBossIntroHeroLock?.(false); } catch { }
    try { internals.setEnginePaused?.(false, "bossIntro"); } catch { }
    this._updateCameraFollowLocalHero();
    if (OPENING_PHASE_MS > 0) {
        if (OPENING_SHAKE_MS > 0) {
            try { cam.shake(OPENING_SHAKE_MS, OPENING_SHAKE_INTENSITY); } catch { }
        }
        this.time.delayedCall(OPENING_PHASE_MS, () => startBossSequence());
    } else {
        startBossSequence();
    }
}

private _updateBossIntro(nowMs: number): boolean {
    if (this._bossIntroActive) return true;
    const g: any = globalThis as any;
    const internals = g.__HeroEnginePhaserInternals || {};
    const evt = internals.consumeBossIntroEvent?.();
    if (!evt) return false;
    if ((evt.floorIndex | 0) === (this._bossIntroFloorIndex | 0)) return false;
    this._startBossIntro(evt);
    return true;
}

private _updateBossIntroHoldCamera(nowMs: number, deltaMs: number): boolean {
    const cam = this.cameras?.main as any;
    if (!cam) return false;

    const g: any = globalThis as any;
    const internals = g.__HeroEnginePhaserInternals || {};
    let holdInfo: any = null;
    try { holdInfo = internals.getBossIntroCameraHoldInfo?.(); } catch { holdInfo = null; }

    if (holdInfo && holdInfo.active && (holdInfo.holdUntilMs | 0) > (nowMs | 0)) {
        this._bossIntroHoldActive = true;
        this._bossIntroHoldUntilMs = holdInfo.holdUntilMs | 0;
        if (Number.isFinite(holdInfo.shadowX) && Number.isFinite(holdInfo.shadowY)) {
            this._bossIntroHoldShadowX = holdInfo.shadowX | 0;
            this._bossIntroHoldShadowY = holdInfo.shadowY | 0;
        }
    } else if ((this._bossIntroHoldUntilMs | 0) <= (nowMs | 0)) {
        if (this._bossIntroHoldActive) {
            this._bossIntroHoldActive = false;
            this._bossIntroHoldUntilMs = 0;
            try { cam.stopFollow(); } catch { }
            this._camFollowPid = 0;
            this._camFollowNative = undefined;
        }
        return false;
    }

    const shadowX = this._bossIntroHoldShadowX | 0;
    const shadowY = this._bossIntroHoldShadowY | 0;
    if (!shadowX && !shadowY) return false;

    try { cam.stopFollow(); } catch { }

    const heroNative = this._findLocalHeroNative();
    const marginPx = 190;
    const minZoom = 0.55;
    const maxZoom = 1.0;

    let focusX = shadowX;
    let focusY = shadowY;
    let targetZoom = Math.max(minZoom, Math.min(maxZoom, cam.zoom || 1));

    if (heroNative && Number.isFinite((heroNative as any).x) && Number.isFinite((heroNative as any).y)) {
        const hx = (heroNative as any).x as number;
        const hy = (heroNative as any).y as number;
        focusX = (hx + shadowX) * 0.5;
        focusY = (hy + shadowY) * 0.5;

        const dx = Math.abs(hx - shadowX);
        const dy = Math.abs(hy - shadowY);
        const wNeed = Math.max(1, dx + marginPx * 2);
        const hNeed = Math.max(1, dy + marginPx * 2);
        const zoomFitX = cam.width / wNeed;
        const zoomFitY = cam.height / hNeed;
        const zoomFit = Math.min(zoomFitX, zoomFitY);
        targetZoom = Math.max(minZoom, Math.min(maxZoom, zoomFit));
    }

    const lerp = Math.min(0.16, Math.max(0.06, (deltaMs | 0) / 900));
    const curZoom = cam.zoom || 1;
    const nextZoom = curZoom + (targetZoom - curZoom) * lerp;
    cam.setZoom(nextZoom);

    const curX = cam.midPoint?.x ?? focusX;
    const curY = cam.midPoint?.y ?? focusY;
    const nextX = curX + (focusX - curX) * lerp;
    const nextY = curY + (focusY - curY) * lerp;
    cam.centerOn(nextX, nextY);

    return true;
}

private _updateTrialCameraHold(nowMs: number, deltaMs: number): boolean {
    const cam = this.cameras?.main as any;
    if (!cam) return false;

    const g: any = globalThis as any;
    const internals = g.__HeroEnginePhaserInternals || {};
    let holdInfo: any = null;
    try { holdInfo = internals.getTrialCameraHoldInfo?.(); } catch { holdInfo = null; }

    if (!holdInfo || !holdInfo.active || (holdInfo.holdUntilMs | 0) <= (nowMs | 0)) return false;

    const centerX = (holdInfo.centerX ?? holdInfo.x);
    const centerY = (holdInfo.centerY ?? holdInfo.y);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return false;

    try { cam.stopFollow(); } catch { }
    this._camFollowPid = 0;
    this._camFollowNative = undefined;

    const lerp = Math.min(0.2, Math.max(0.08, (deltaMs | 0) / 600));
    const curX = cam.midPoint?.x ?? centerX;
    const curY = cam.midPoint?.y ?? centerY;
    const nextX = curX + (centerX - curX) * lerp;
    const nextY = curY + (centerY - curY) * lerp;
    cam.centerOn(nextX, nextY);
    return true;
}


public applyTilemapToScene(grid: number[][], tileSize: number) {
    const atlas = this.tileAtlas;
    if (!atlas) {
        if (DEBUG_TILEMAP_MAIN) console.warn(">>> [HeroScene.tilemap] applyTilemapToScene: missing tileAtlas");
        return;
    }

    const renderer = this.ensureWorldTileRenderer(atlas);

    // quick grid snapshot
    let rawWalls = 0;
    let rawFloors = 0;
    let rawSig = 0;

    const rows0 = (grid?.length ?? 0) | 0;
    const cols0 = (rows0 > 0 ? ((grid[0]?.length ?? 0) | 0) : 0);

    for (let r = 0; r < rows0; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < cols0; c++) {
            const v = (row[c] | 0);
            if (v === 1) rawWalls++;
            else rawFloors++;
            rawSig = (((rawSig << 5) - rawSig) + v + ((r + 1) * 131) + ((c + 1) * 17)) | 0;
        }
    }

    if (DEBUG_TILEMAP_MAIN) {
        console.log(">>> [HeroScene.tilemap] syncing from grid", {
            rows: rows0,
            cols: cols0,
            tileSize,
            rawWalls,
            rawFloors,
            rawSig
        });
    }

    // Base layer sync (NOTE: WorldTileRenderer clears decal+prop layers here)
    const g: any = globalThis as any;
    const variantSeed = (typeof g.__floorTextureSeed === "number") ? (g.__floorTextureSeed | 0) : 0;
    renderer.syncFromEngineGrid(grid, { variantSeed });

    // ✅ Critical: re-apply decor overlays AFTER base sync clears them
    try {
        const g: any = globalThis as any;
        if (g?.__HeroEnginePhaserDecor?.forceResync) {
            g.__HeroEnginePhaserDecor.forceResync("applyTilemapToScene");
        }
    } catch (e) {
        if (DEBUG_TILEMAP_MAIN) console.warn(">>> [HeroScene.tilemap] decor forceResync failed", e);
    }

    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    const worldWidth = cols * tileSize;
    const worldHeight = rows * tileSize;
    const hadWorld = (this._worldPixelW > 0 && this._worldPixelH > 0);
    this._worldPixelW = worldWidth;
    this._worldPixelH = worldHeight;
    this._worldTileSize = tileSize | 0;

    // World bounds define where the camera can scroll
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // ✅ The canvas should match the DOM viewport (NOT the world).
    // This is what enables camera-follow / scrolling.
    this._resizeGameToDomViewport("applyTilemapToScene");

    if (!hadWorld && !this._camZoomBaselineLocked) {
        this._camZoomUser = this._snapUserZoomValue(1);
        this._camZoomBaselineLocked = true;
        this._updateCameraZoom();
    }

    if (DEBUG_TILEMAP_MAIN) {
        console.log(">>> [HeroScene.tilemap] bounds set (world), viewport sized (DOM)", {
            worldWidth,
            worldHeight,
            rows,
            cols,
            tileSize
        });
    }
}


private setupGlobalsAndDebug() {
    const g = globalThis as any;

    logMain(">>> [HeroScene.create] running");

    // Make this scene globally accessible to arcadeCompat
    (globalThis as any).__phaserScene = this;
    logMain(
        ">>> [HeroScene.create] __phaserScene set =",
        !!(globalThis as any).__phaserScene
    );
    try {
        (globalThis as any).__heZoomBy = (delta: number) => {
            if (!Number.isFinite(delta) || delta === 0) return;
            this._nudgeUserZoom(delta);
        };
        (globalThis as any).__heSetZoom = (z: number) => {
            if (!Number.isFinite(z)) return;
            this._setUserZoom(z);
        };
        (globalThis as any).__heGetZoom = () => this._camZoomUser;
        (globalThis as any).__heGetEffectiveZoom = () => {
            const cam = this.cameras?.main;
            return (cam && Number.isFinite(cam.zoom)) ? cam.zoom : this._camZoomUser;
        };
        (globalThis as any).__heGetZoomBounds = () => {
            const denom = this._camZoomBase * this._getZoomComp();
            let min = CAMERA_USER_ZOOM_MIN;
            let max = CAMERA_USER_ZOOM_MAX;
            if (Number.isFinite(denom) && denom > 0) {
                min = Math.max(min, CAMERA_ZOOM_MIN / denom);
                max = Math.min(max, CAMERA_ZOOM_MAX / denom);
                if (min > max) min = max;
            }
            const step = (this._camZoomUser < 1)
                ? CAMERA_USER_ZOOM_STEP_LOW
                : CAMERA_USER_ZOOM_STEP_HIGH;
            return { min, max, step };
        };
    } catch { }

    // Apply URL-driven hero profile (e.g., ?profile=Demo%20Hero)
    // (kept as-is; profile selection is not "debug")
    applyUrlProfileToGlobals();
    syncBlocklyXmlFromStorage();

    // ✅ Install Blockly editor button + overlay (editor only; no execution yet)
    installBlocklyHeroLogicEditor();
    installBlocklyTrapEditor();

    // Existing hero anim debug registry flag
    this.registry.set("heroAnimDebug", ENABLE_HERO_ANIM_DEBUG);

    // ------------------------------------------------------------
    // WEAPON DEBUG (flag-driven; no URL params / no console toggles)
    // These globals are consumed by weaponAnimGlue.ts
    // ------------------------------------------------------------
    (g as any).__weaponDebug = WEAPON_DEBUG;
    (g as any).__weaponDebugVerbose = WEAPON_DEBUG_VERBOSE;
    (g as any).__DEBUG_RELIC_LOGS = DEBUG_RELIC_LOGS;
    (g as any).__DEBUG_RELICTIP_LOGS = DEBUG_RELICTIP_LOGS;

    // Optional: expose audit runner (you never have to call it)
    (g as any).runWeaponAudit = (opts?: any) => runWeaponAudit(opts);

    // Optional: run audit at startup (prints counts + examples)
    if (ENABLE_WEAPON_AUDIT_ON_START) {
        runWeaponAudit({
            logAllModels: ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS,
            //phases: ["slash", "thrust", "cast"],
            variant: "base",
        });
    }

    // runtime toggle from console or other code (kept as-is)
    (g as any).toggleHeroAnimDebug = (on?: boolean) => {
        const cur = !!this.registry.get("heroAnimDebug");
        const next = (on === undefined) ? !cur : !!on;
        this.registry.set("heroAnimDebug", next);
        console.log("[heroAnimDebug] set to", next);
    };
}


private createLoadingText(): Phaser.GameObjects.Text {
    return this.add.text(12, 12, "Loading…", {
        fontFamily: "monospace",
        fontSize: "18px",
    }).setScrollFactor(0).setDepth(9999);
}

private validateHeroAuras(loadingText: Phaser.GameObjects.Text) {
    // AURA PIPELINE (spritesheet-only)
    // No runtime generation. We only validate required aura textures exist.
    const REQUIRED_AURA_RADII = AURA_RADII;
    const parsedSheets = (this.registry.get("__heroParsedSheets") || []) as any[];

    const isValid192Sheet = (texKey192: string): boolean => {
        if (!this.textures.exists(texKey192)) return false;

        try {
            const tex = this.textures.get(texKey192);
            const src: any = (tex as any)?.getSourceImage?.();
            const w = (src && (src.width | 0)) || 0;
            const h = (src && (src.height | 0)) || 0;
            if (w <= 0 || h <= 0) return false;

            // must be a clean 192 grid
            return (w % 192) === 0 && (h % 192) === 0;
        } catch (_e) {
            return false;
        }
    };

    const texKeysToUseSet = new Set<string>();

    loadingText.setText("Loading… validating auras");

    for (const sheet of parsedSheets) {
        const baseKey = sheet.textureKey;
        for (const radius of REQUIRED_AURA_RADII) {
            const auraBaseKey = `${baseKey}_aura_r${radius}`;

            if (this.textures.exists(baseKey)) {
                if (!this.textures.exists(auraBaseKey)) {
                    throw new Error(
                        `[AURA-MISSING] Texture not loaded: ${auraBaseKey}. Run: npm run gen-auras`
                    );
                }
                texKeysToUseSet.add(baseKey);
            }
        }

        const key192 = baseKey + "_192";

        const hasReal192 = isValid192Sheet(key192);
        if (hasReal192) {
            for (const radius of REQUIRED_AURA_RADII) {
                const auraKey192 = `${key192}_aura_r${radius}`;
                if (!this.textures.exists(auraKey192)) {
                    throw new Error(
                        `[AURA-MISSING] Texture not loaded: ${auraKey192}. Run: npm run gen-auras`
                    );
                }
            }
            texKeysToUseSet.add(key192);
        }
    }

    const texKeysToUse = Array.from(texKeysToUseSet);
    if (texKeysToUse.length === 0) {
        console.warn(">>> [HeroScene.create] no hero textures found to validate for auras");
    }

    loadingText.setText("Loading… 100%");
}

private _tilemap_installNetTilemapHandler(): void {
    (globalThis as any).__onNetTilemap = (msg: any) => {
        try {
            this._tilemap_applyNetTilemapMsg(msg);
        } catch (e) {
            console.error(">>> [HeroScene.tilemap] ERROR applying tilemap msg:", e);
        }
    };
}

private _tilemap_applyNetTilemapMsg(msg: any): void {
    if (!msg || msg.type !== "tilemap") return;

    const rev = (msg.rev | 0) || 0;
    const tileSize = (msg.tileSize | 0) || 0;
    const encoding = (typeof msg.encoding === "string") ? msg.encoding : "";
    const forceFlash = !!msg.forceFlash;

    const grid: number[][] = (Array.isArray(msg.data) ? msg.data : msg.grid) as any;
    const rows = (msg.rows | 0) || ((grid && grid.length) ? (grid.length | 0) : 0);
    const cols = (msg.cols | 0) || ((grid && grid[0]) ? (grid[0].length | 0) : 0);

    if (rev <= 0 || tileSize <= 0 || rows <= 0 || cols <= 0) {
        if (DEBUG_TILEMAP_MAIN) {
            console.warn(">>> [HeroScene.tilemap] ignoring malformed tilemap msg", {
                rev,
                tileSize,
                rows,
                cols,
                encoding,
            });
        }
        return;
    }

    if (!Array.isArray(grid) || !Array.isArray(grid[0])) {
        if (DEBUG_TILEMAP_MAIN) {
            console.warn(">>> [HeroScene.tilemap] ignoring tilemap msg with non-2D data", {
                rev,
                tileSize,
                rows,
                cols,
                encoding,
            });
        }
        return;
    }

    // Cache latest (helps local “pending apply” patterns)
    (globalThis as any).__lastTilemapMsg = msg;

    // Track latest net rev ever observed (used by host monotonic send)
    const g: any = globalThis as any;
    g.__netTilemapLatestRev = Math.max(((g.__netTilemapLatestRev | 0) || 0), rev);

    // Theme info (optional)
    const baseFamily = (msg.baseFamily || g.__floorBaseFamily || "ground_light");
    const wallFamily = (msg.wallFamily || g.__floorWallFamily || "chasm_light");
    const palette = (typeof msg.palette === "string")
      ? msg.palette
      : (typeof g.__floorThemePalette === "string" ? g.__floorThemePalette : "");
    const textureSeed = (typeof msg.textureSeed === "number")
      ? (msg.textureSeed | 0)
      : (typeof g.__floorTextureSeed === "number" ? (g.__floorTextureSeed | 0) : 0);
    g.__floorBaseFamily = baseFamily;
    g.__floorWallFamily = wallFamily;
    if (palette) g.__floorThemePalette = palette;
    if (textureSeed) g.__floorTextureSeed = textureSeed | 0;

    const worldRev = (msg.worldRev | 0) || 0;
    const floorIndex = (typeof msg.floorIndex === "number") ? (msg.floorIndex | 0) : -1;
    const prevFloor = this._tilemapAppliedFloorIndex | 0;
    const decor: DecorPayload | undefined = msg.decor;
    const decorRev = (decor && typeof (decor as any).rev === "number") ? ((decor as any).rev | 0) : -1;
    const decorOnly = !!msg.decorOnly;
    const themeKey = `${baseFamily}|${wallFamily}|${palette || ""}|${textureSeed | 0}`;
    const lastThemeKey = (g.__tilemapAppliedThemeKey as string) || "";

    // If we are the host, ignore echoed tilemaps we originally sent; we already applied locally.
    const gAny: any = globalThis as any;
    if (gAny.__isHost) {
        // Compare against the last host-applied worldRev/floorIndex signature.
        const lastHostWorldRev = (gAny.__hostWorldRevApplied | 0);
        const lastHostFloorIdx = (gAny.__hostFloorIndexApplied | 0);
        if ((worldRev | 0) === lastHostWorldRev && (floorIndex | 0) === lastHostFloorIdx) {
            return;
        }
    }

    const baseSigMatches =
        rows === (this._tilemapAppliedRows | 0) &&
        cols === (this._tilemapAppliedCols | 0) &&
        tileSize === (this._tilemapAppliedTileSize | 0) &&
        themeKey === lastThemeKey;
    const worldSigMatches =
        (worldRev | 0) === (this._tilemapAppliedWorldRev | 0) &&
        (floorIndex | 0) === (this._tilemapAppliedFloorIndex | 0);
    const decorSigMatches =
        (decorRev | 0) >= 0 && (decorRev | 0) === (this._tilemapAppliedDecorRev | 0);

    // Only skip if we've applied this signature already (for followers)
    let shouldSkip = false;
    if (!gAny.__isHost) {
        if (decorOnly) {
            shouldSkip = baseSigMatches && worldSigMatches && decorSigMatches;
        } else {
            shouldSkip = baseSigMatches && worldSigMatches && (!decor || decorSigMatches);
        }
    }
    if (shouldSkip) {
        this._checkWorldSyncHashFromMsg(msg);
        return;
    }

    this._tilemapAppliedRev = rev;
    this._tilemapAppliedRows = rows;
    this._tilemapAppliedCols = cols;
    this._tilemapAppliedTileSize = tileSize;

    const shouldApplyBase = !decorOnly || !baseSigMatches || !worldSigMatches;
    if (shouldApplyBase) {
        this.applyTilemapToScene(grid, tileSize);
        this._tilemapAppliedWorldRev = worldRev;
        this._tilemapAppliedFloorIndex = floorIndex;
        g.__tilemapAppliedThemeKey = themeKey;
        _uiLoadingSet(85, "Tilemap ready");
        _uiLoadingMarkTilemap();
    } else {
        this._tilemapAppliedWorldRev = worldRev;
        this._tilemapAppliedFloorIndex = floorIndex;
    }
    g.__tilemapAppliedWorldRev = (this._tilemapAppliedWorldRev | 0);
    g.__tilemapAppliedFloorIndex = (this._tilemapAppliedFloorIndex | 0);

    const shouldFlash = shouldApplyBase && (forceFlash || (floorIndex | 0) !== (prevFloor | 0));
    if (shouldFlash) {
        this.cameras?.main?.flash(140);
    }

    if (shouldApplyBase) {
        this._tilemapAppliedPropByAnchor = null;
    }

    if (shouldApplyBase && !decor && this.tileAtlas) {
        try {
            const renderer = this.ensureWorldTileRenderer(this.tileAtlas);
            if (renderer && typeof (renderer as any).syncDecalGridByName === "function") {
                (renderer as any).syncDecalGridByName([]);
            }
            if (renderer && typeof (renderer as any).syncPropGridByName === "function") {
                (renderer as any).syncPropGridByName([]);
            }
            this._tilemapAppliedDecorRev = -1;
        } catch (e) {
            if (DEBUG_TILEMAP_MAIN) {
                console.warn(">>> [HeroScene.tilemap] failed to clear decor on base-only update", e);
            }
        }
    }

    if (DEBUG_TILEMAP_APPLY_NET) {
        // Cheap counts to prove we applied a non-empty grid
        let rawWalls = 0;
        let rawFloors = 0;
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                const v = row[c] | 0;
                if (v === 1) rawWalls++;
                else rawFloors++;
            }
        }
        console.log("[net.tilemap.apply]", {
            rev,
            rows,
            cols,
            tileSize,
            baseFamily,
            wallFamily,
            rawWalls,
            rawFloors
        });
    }

    // Apply decor payload (follower-safe)
    if (decor && this.tileAtlas) {
        try {
            const renderer = this.ensureWorldTileRenderer(this.tileAtlas);
            if (decor.decals && Array.isArray(decor.decals)) {
                const rCount = Math.min(decor.decals.length, rows);
                const cCount = rCount > 0 ? Math.min(decor.decals[0].length, cols) : 0;
                const keyGrid: string[][] = new Array(rCount);
                for (let r = 0; r < rCount; r++) {
                    const srcRow = decor.decals[r] || [];
                    const outRow: string[] = new Array(cCount);
                    for (let c = 0; c < cCount; c++) {
                        const id = (srcRow[c] | 0);
                        outRow[c] = _mapDecalIdToKey(id);
                    }
                    keyGrid[r] = outRow;
                }
                if (renderer && typeof renderer.syncDecalGridByName === "function") {
                    renderer.syncDecalGridByName(keyGrid);
                }
            }

            const mapPropName = (p: DecorPropEntry): string => {
                if (!p) return "";
                if (p.name) return p.name;
                switch ((p.id as number) | 0) {
                    case 1: return "rock_mountain";
                    case 2: return "stairs_statue";
                    case 3: return "chest#closed";
                    case 4: return "pedestal";
                    default: return "";
                }
            };

            const propsArr = Array.isArray(decor.props) ? decor.props : [];
            const nextPropByAnchor: Record<string, string> = Object.create(null);
            const nextPropOffsetsByAnchor: Record<string, { offX: number; offY: number }> = Object.create(null);
            for (const p of propsArr) {
                if (!p) continue;
                const r = (p.r | 0);
                const c = (p.c | 0);
                if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
                const propName = mapPropName(p);
                if (!propName) continue;
                const key = String(r) + "," + String(c);
                nextPropByAnchor[key] = propName;
                const offX = (p.offX ?? 0) | 0;
                const offY = (p.offY ?? 0) | 0;
                nextPropOffsetsByAnchor[key] = { offX, offY };
            }

            if (DEBUG_PAD_SINK_PROP_LOGS) {
                let count = 0;
                let minOffX = 999999;
                let maxOffX = -999999;
                let minOffY = 999999;
                let maxOffY = -999999;
                const anchors: string[] = [];
                for (const key of Object.keys(nextPropByAnchor)) {
                    if (nextPropByAnchor[key] !== "stairs_statue") continue;
                    count++;
                    const off = nextPropOffsetsByAnchor[key] || { offX: 0, offY: 0 };
                    const ox = (off.offX | 0);
                    const oy = (off.offY | 0);
                    if (ox < minOffX) minOffX = ox;
                    if (ox > maxOffX) maxOffX = ox;
                    if (oy < minOffY) minOffY = oy;
                    if (oy > maxOffY) maxOffY = oy;
                    if (anchors.length < 4) anchors.push(key);
                }
                const offXRange = (count > 0) ? `${minOffX}..${maxOffX}` : "n/a";
                const offYRange = (count > 0) ? `${minOffY}..${maxOffY}` : "n/a";
                const anchorStr = anchors.length ? anchors.join("|") : "n/a";
                const sig = `${decorRev}|${worldRev}|${floorIndex}|${count}|${offXRange}|${offYRange}|${anchorStr}`;
                const gDbg: any = (globalThis as any);
                if (gDbg.__padPillarDecorSig !== sig) {
                    gDbg.__padPillarDecorSig = sig;
                    console.log(
                        `[PAD][PILLAR][DECOR] rev=${decorRev | 0} worldRev=${worldRev | 0} floor=${floorIndex | 0}` +
                        ` count=${count | 0} offX=${offXRange} offY=${offYRange} anchors=${anchorStr}`
                    );
                }
            }

            if (renderer) {
                (renderer as any).__propOffsetsByAnchor = nextPropOffsetsByAnchor;
                const canIncremental =
                    !shouldApplyBase &&
                    this._tilemapAppliedPropByAnchor &&
                    (worldRev | 0) === (this._tilemapAppliedWorldRev | 0) &&
                    (floorIndex | 0) === (this._tilemapAppliedFloorIndex | 0) &&
                    typeof (renderer as any).replacePropAt === "function" &&
                    typeof (renderer as any).removePropAt === "function";

                if (canIncremental) {
                    const prev = this._tilemapAppliedPropByAnchor as Record<string, string>;
                    const prevOffsets = (this._tilemapAppliedPropOffsetsByAnchor as Record<string, { offX: number; offY: number }>) || Object.create(null);
                    for (const k of Object.keys(nextPropByAnchor)) {
                        const nextKey = nextPropByAnchor[k];
                        const prevKey = prev[k];
                        const nextOff = nextPropOffsetsByAnchor[k] || { offX: 0, offY: 0 };
                        const prevOff = prevOffsets[k] || { offX: 0, offY: 0 };
                        const offChanged = (prevOff.offX | 0) !== (nextOff.offX | 0) || (prevOff.offY | 0) !== (nextOff.offY | 0);
                        if (prevKey === nextKey && !offChanged) continue;
                        const parts = k.split(",");
                        const r = (parseInt(parts[0] || "0", 10) | 0);
                        const c = (parseInt(parts[1] || "0", 10) | 0);
                        (renderer as any).replacePropAt(r, c, nextKey);
                    }

                    for (const k of Object.keys(prev)) {
                        if (nextPropByAnchor[k] != null) continue;
                        const parts = k.split(",");
                        const r = (parseInt(parts[0] || "0", 10) | 0);
                        const c = (parseInt(parts[1] || "0", 10) | 0);
                        (renderer as any).removePropAt(r, c);
                    }
                } else if (typeof (renderer as any).syncPropGridByName === "function") {
                    const propGrid: string[][] = [];
                    for (const k of Object.keys(nextPropByAnchor)) {
                        const parts = k.split(",");
                        const r = (parseInt(parts[0] || "0", 10) | 0);
                        const c = (parseInt(parts[1] || "0", 10) | 0);
                        if (!propGrid[r]) propGrid[r] = [];
                        propGrid[r][c] = nextPropByAnchor[k];
                    }
                    (renderer as any).syncPropGridByName(propGrid);
                }

                this._tilemapAppliedPropByAnchor = nextPropByAnchor;
                this._tilemapAppliedPropOffsetsByAnchor = nextPropOffsetsByAnchor;
            }

            const debugProps = DEBUG_PROP_SYNC || !!((globalThis as any).__DEBUG_PROP_SYNC);
            if (debugProps) {
                const revNow = decor.rev ?? null;
                const nowMs = Date.now();
                const gDbg: any = (globalThis as any);
                if (!gDbg.__propLogThrottles) gDbg.__propLogThrottles = {};
                const prev = gDbg.__propLogThrottles.apply || { rev: -1, at: 0 };
                const shouldLog = (revNow !== (prev.rev | 0)) || (nowMs - (prev.at | 0) > 3000);
                if (shouldLog) {
                    gDbg.__propLogThrottles.apply = { rev: (revNow as any) | 0, at: nowMs };
                    const propCount = Array.isArray(decor.props) ? decor.props.length : 0;
                    const decalCount = Array.isArray(decor.decals) ? decor.decals.length : 0;
                    const byName: Record<string, number> = {};
                    if (Array.isArray(decor.props)) {
                        for (const p of decor.props) {
                            if (!p || !p.name) continue;
                            byName[p.name] = (byName[p.name] || 0) + 1;
                        }
                    }
                    console.log("[net.decor.apply]", { rev: revNow, propCount, decalRows: decalCount, byName });
                }
            }
            this._tilemapAppliedDecorRev = decorRev;
        } catch (e) {
            console.warn("[net.decor.apply] failed", e);
        }
    }

    if (DEBUG_TILEMAP_MAIN && shouldApplyBase) {
        console.log(">>> [HeroScene.tilemap] applied tilemap from net", {
            rev,
            rows,
            cols,
            tileSize,
            baseFamily,
            wallFamily,
        });
    }

    this._checkWorldSyncHashFromMsg(msg);

    if (!gAny.__isHost) {
        const pendingSnap = g.__pendingWorldSnapshotForFloor;
        if (pendingSnap && typeof pendingSnap.worldRev === "number") {
            const wantRev = pendingSnap.worldRev | 0;
            const wantFloor = (typeof pendingSnap.floorIndex === "number") ? (pendingSnap.floorIndex | 0) : -1;
            const floorKnown = (floorIndex | 0) >= 0;
            const wantFloorKnown = (wantFloor | 0) >= 0;
            const floorMatches = (!floorKnown || !wantFloorKnown || (wantFloor | 0) === (floorIndex | 0));
            if ((wantRev | 0) === (worldRev | 0) && floorMatches) {
                g.__pendingWorldSnapshotForFloor = null;
                g.__pendingWorldSnapshotSig = null;
                try {
                    const nw: any = (globalThis as any).netWorld;
                    if (nw && typeof nw.apply === "function") {
                        nw.apply(pendingSnap);
                    }
                } catch (e) {
                    console.warn("[netWorld.apply] pending snapshot failed", e);
                }
            }
        }
    }
}

private _tilemap_applyPendingCachedNetTilemapIfAny(): void {
    const g: any = globalThis as any;
    const pending = g.__pendingTilemapMsg || g.__lastTilemapMsg;

    if (pending && typeof g.__onNetTilemap === "function") {
        try {
            g.__pendingTilemapMsg = null;
            g.__onNetTilemap(pending);
        } catch (e) {
            console.error(">>> [HeroScene.tilemap] ERROR applying pending tilemap msg:", e);
        }
    }
}

private _updateLegacyHostTick(g: any): void {
    // Legacy path: if some build still wires __game, keep it (but never require it).
    if (g.__isHost && g.__game && typeof g.__game._tick === "function") {
        try {
            g.__game._tick();
        } catch (e: any) {
            console.error("HeroScene.update _tick ERROR:", e);
        }
    }
}

private _updateCoinFx(g: any): void {
    // COIN FX (Phaser-only): drain __coinBurstQueue and spawn sprites
    // Must not break floor syncing even if something goes wrong.
    try {
        const q: any[] | null = Array.isArray(g.__coinBurstQueue) ? g.__coinBurstQueue : null;
        if (q && q.length) {
            const bursts = q.splice(0, q.length);

            if (DEBUG_COINFX) {
                console.log("[COINFX drain]", { n: bursts.length, isHost: !!g.__isHost });
            }

            // Ensure animation exists (once). This is intentionally self-contained.
            const animKey = "__coinSpin";
            const coinTexKey =
                (this.textures.exists("anims.coins 16x16") ? "anims.coins 16x16" : "") ||
                (this.textures.exists("anims.coins") ? "anims.coins" : "");

            if (!this.anims.exists(animKey)) {
                if (!coinTexKey) {
                    console.warn("[COINFX] missing texture anims.coins 16x16 (or legacy anims.coins)");
                } else {
                    // Best-effort inference of frames:
                    // - If spritesheet frames are numeric strings ("0","1",...) we compute max.
                    // - Otherwise default to 4 frames.
                    let end = 0;

                    try {
                        const tex: any = this.textures.get(coinTexKey);
                        const names: string[] =
                            (tex && typeof tex.getFrameNames === "function") ? tex.getFrameNames() : [];

                        let best = -1;
                        for (const nm of names) {
                            if (!nm || nm === "__BASE") continue;
                            const n = parseInt(nm, 10);
                            if (Number.isFinite(n) && n > best) best = n;
                        }

                        if (best >= 1) end = best;
                    } catch {
                        end = 0;
                    }

                    if (end <= 0) end = 3; // fallback: assume 4 frames

                    this.anims.create({
                        key: animKey,
                        frames: this.anims.generateFrameNumbers(coinTexKey, { start: 0, end }),
                        frameRate: 14,
                        repeat: -1,
                    });

                    if (DEBUG_COINFX) {
                        console.log("[COINFX] created anim", { key: animKey, end });
                    }
                }
            }

            // Spawn bursts
            for (const b of bursts) {
                const sx = (typeof b?.x === "number") ? b.x : NaN;
                const sy = (typeof b?.y === "number") ? b.y : NaN;
                const countRaw = (typeof b?.count === "number") ? (b.count | 0) : 0;

                if (!Number.isFinite(sx) || !Number.isFinite(sy) || countRaw <= 0) continue;

                const hasTex = !!coinTexKey;
                if (DEBUG_COINFX) {
                    console.log("[COINFX spawnBurst]", { sx, sy, countRaw, hasTex, coinTexKey });
                }
                if (!hasTex) continue;

                // Target point = canvas border aligned to DOM #hud-you-coins.
                let tx = sx;
                let ty = sy;

                try {
                    const cam = this.cameras?.main;
                    const canvas = (this.game?.canvas as HTMLCanvasElement) || null;
                    const hudEl = document.getElementById("hud-you-coins");

                    if (cam && canvas && hudEl) {
                        const cr = canvas.getBoundingClientRect();
                        const hr = hudEl.getBoundingClientRect();

                        const sxPx = cr.width > 0 ? (canvas.width / cr.width) : 1;
                        const syPx = cr.height > 0 ? (canvas.height / cr.height) : 1;

                        const hudCx = hr.left + (hr.width / 2);
                        const hudCy = hr.top + (hr.height / 2);

                        let targetCssX = cr.width / 2;
                        if (hudCx > cr.right) targetCssX = cr.width - 6;
                        else if (hudCx < cr.left) targetCssX = 6;
                        else targetCssX = Math.max(6, Math.min(cr.width - 6, hudCx - cr.left));

                        let targetCssY = Math.max(6, Math.min(cr.height - 6, hudCy - cr.top));

                        const targetCamX = targetCssX * sxPx;
                        const targetCamY = targetCssY * syPx;

                        const zoom = (cam.zoom || 1);

                        tx = cam.scrollX + (targetCamX / zoom);
                        ty = cam.scrollY + (targetCamY / zoom);
                    }
                } catch (_e) {
                    // fallback: leave tx/ty = sx/sy
                }

                const nVis = Math.max(1, Math.min(8, countRaw));

                const baseVal = Math.floor(countRaw / nVis) | 0;
                let rem = (countRaw - (baseVal * nVis)) | 0;

                for (let i = 0; i < nVis; i++) {
                    const thisVal = (baseVal + (rem > 0 ? 1 : 0)) | 0;
                    if (rem > 0) rem--;

                    const coin = this.add.sprite(sx, sy, coinTexKey, 0);
                    coin.setOrigin(0.5, 0.5);
                    coin.setDepth(9999);
                    coin.setScale(1); // 16x16 (no upscaling)

                    try { coin.anims.play(animKey, true); } catch {}

                    coin.x += Phaser.Math.Between(-10, 10);
                    coin.y += Phaser.Math.Between(-6, 6);

                    const txi = tx + Phaser.Math.Between(-10, 10);
                    const tyi = ty + Phaser.Math.Between(-6, 6);

                    const midX = (coin.x + txi) / 2 + Phaser.Math.Between(-18, 18);

                    const camTop = (() => {
                        const cam = this.cameras?.main;
                        if (!cam) return -Infinity;
                        const z = (cam.zoom || 1);
                        return cam.scrollY + (10 / z);
                    })();

                    let midY = Math.min(coin.y, tyi) - 50 - Phaser.Math.Between(0, 25);
                    if (midY < camTop) midY = camTop;

                    const curve = new Phaser.Curves.QuadraticBezier(
                        new Phaser.Math.Vector2(coin.x, coin.y),
                        new Phaser.Math.Vector2(midX, midY),
                        new Phaser.Math.Vector2(txi, tyi)
                    );

                    const driver: any = { t: 0 };
                    const ARRIVE_T = 0.65;

                    let sentArrival = false;

                    this.tweens.add({
                      targets: driver,
                      t: 1,
                      delay: i * 55,
                      duration: 650 + Phaser.Math.Between(0, 260),
                      ease: "Cubic.easeOut",
                      onUpdate: () => {
                        const p = curve.getPoint(driver.t);
                        const y = (p.y < camTop) ? camTop : p.y;
                        coin.setPosition(p.x, y);

                        if (!sentArrival && driver.t >= ARRIVE_T) {
                          sentArrival = true;
                          try {
                            if (!Array.isArray(g.__hudCoinArrivals)) g.__hudCoinArrivals = [];
                            g.__hudCoinArrivals.push(thisVal);
                          } catch (_e) {}
                        }
                      },
                      onComplete: () => {
                        if (!sentArrival) {
                          sentArrival = true;
                          try {
                            if (!Array.isArray(g.__hudCoinArrivals)) g.__hudCoinArrivals = [];
                            g.__hudCoinArrivals.push(thisVal);
                          } catch (_e) {}
                        }
                        coin.destroy();
                      },
                    });
                }
            }
        }
    } catch (e: any) {
        console.warn("[COINFX] error (ignored, should not affect tile sync)", e);
    }
}

private _tilemap_hostResendPendingIfNeeded(g: any): void {
    try {
        const pending = g.__pendingTilemapToSend;
        const triesLeft = (g.__pendingTilemapToSendTriesLeft | 0) || 0;
        if (pending && triesLeft > 0) {
            const wsP: WebSocket | null = g.__net?.ws ?? null;
            const nowMs =
                (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

            const nextAt = (g.__pendingTilemapToSendNextAtMs as number) || 0;

            if (wsP && wsP.readyState === WebSocket.OPEN && nowMs >= nextAt) {
                try {
                    wsP.send(JSON.stringify(pending));
                    g.__pendingTilemapToSendTriesLeft = triesLeft - 1;
                    g.__pendingTilemapToSendNextAtMs = nowMs + 250;

                    if (DEBUG_TILEMAP_MAIN) {
                        console.log(">>> [HeroScene.tilemap] resent pending tilemap", {
                            rev: pending.rev,
                            triesLeft: g.__pendingTilemapToSendTriesLeft
                        });
                    }
                } catch (e: any) {
                    if (DEBUG_TILEMAP_MAIN) console.warn(">>> [HeroScene.tilemap] resend failed", e);
                }

                if ((g.__pendingTilemapToSendTriesLeft | 0) <= 0) {
                    g.__pendingTilemapToSend = null;
                }
            }
        }
    } catch { /* ignore */ }
}

  private _tilemap_hostSyncFromEngineAndBroadcastIfNeeded(g: any): void {
    const internals = g.__HeroEnginePhaserInternals;
    if (!internals?.getWorldTileMap || !internals?.getWorldTileSize) return;

    const worldRev = (internals.getWorldRev?.() | 0) || 0;
    const floorIndex = (internals.getFloorIndex?.() | 0) || -1;

    const grid: number[][] = internals.getWorldTileMap();
    const tileSize = (internals.getWorldTileSize() | 0) || 16;

    const rows = (grid?.length | 0) || 0;
    const cols = ((rows > 0 && grid[0]) ? (grid[0].length | 0) : 0) | 0;

    const baseFamily =
        (internals.getFloorBaseFamily?.() || g.__floorBaseFamily || "ground_light");
    const wallFamily =
        (internals.getFloorWallFamily?.() || g.__floorWallFamily || "chasm_light");
    const palette =
        (typeof internals.getFloorThemePalette === "function" ? internals.getFloorThemePalette() : (g.__floorThemePalette || ""));
    const textureSeed =
        (typeof internals.getFloorTextureSeed === "function" ? (internals.getFloorTextureSeed() | 0) : (g.__floorTextureSeed | 0));

    // Best-effort detect new floor and trigger a one-time decor resync after engine init.
    const lastFloorSig = g.__lastDecorResyncFloorSig as string | undefined;
    const floorSig = `${worldRev}|${floorIndex}`;
    if (g.__isHost && floorSig !== lastFloorSig) {
        try {
            const decorNS = (globalThis as any).__HeroEnginePhaserDecor;
            if (decorNS && typeof decorNS.forceResync === "function") {
                decorNS.forceResync("floor-change");
            }
        } catch (_e) { /* ignore */ }
        g.__lastDecorResyncFloorSig = floorSig;
    }

    // Decor payload (decals + prop entries) from engine internals
    let decorPayload: DecorPayload | null = null;
    let decorRev = -1;
    try {
        const spritesNS: any = g.sprites;
        decorRev = (internals.getWorldDecorRev?.() | 0) || (internals.getDecorRev?.() | 0) || 0;
        const decals = (typeof internals.getDecalGrid === "function") ? internals.getDecalGrid() : null;

        const triggers: any[] = (typeof internals.getDecorTriggerSprites === "function") ? (internals.getDecorTriggerSprites() || []) : [];
        const solids: any[] = (typeof internals.getDecorSolidSprites === "function") ? (internals.getDecorSolidSprites() || []) : [];

        const props: DecorPropEntry[] = [];
        const readDataNum = (s: any, key: string, fallback = 0) => {
            try {
                if (spritesNS && typeof spritesNS.readDataNumber === "function") {
                    const v = spritesNS.readDataNumber(s, key);
                    if (typeof v === "number") return v | 0;
                }
            } catch {}
            const d: any = s && s.data ? s.data : {};
            const v2 = d ? d[key] : undefined;
            return (typeof v2 === "number") ? (v2 | 0) : fallback;
        };

        const readDataStr = (s: any, key: string) => {
            try {
                if (spritesNS && typeof spritesNS.readDataString === "function") {
                    const v = spritesNS.readDataString(s, key);
                    if (typeof v === "string") return v;
                }
            } catch {}
            const d: any = s && s.data ? s.data : {};
            const v2 = d ? d[key] : undefined;
            return (typeof v2 === "string") ? v2 : "";
        };

        const collectProps = (arr: any[]) => {
            for (const s of arr) {
                if (!s) continue;
                const destroyedFlag = spritesNS?.Flag?.Destroyed ?? 0;
                if (destroyedFlag && (s.flags & destroyedFlag)) continue;
                const id =
                    readDataNum(s, "decorId", readDataNum(s, "id", -1));
                const r = readDataNum(s, "decorTileR", readDataNum(s, "tileR", -1));
                const c = readDataNum(s, "decorTileC", readDataNum(s, "tileC", -1));
                const offX = readDataNum(s, "decorOffX", 0);
                const offY = readDataNum(s, "decorOffY", 0);
                let name =
                    readDataStr(s, "decorName") ||
                    readDataStr(s, "name");
                // Fallback: derive a render key from known decor ids when the name is missing/empty
                if (!name) {
                    switch (id | 0) {
                        case 1: name = "rock_mountain"; break;
                        case 2: name = "stairs_statue"; break;
                        case 3: name = "chest#closed"; break;
                        case 4: name = "pedestal"; break;
                        default: break;
                    }
                }
                const role =
                    readDataNum(s, "decorRole", readDataNum(s, "role", 0));
                if (r >= 0 && c >= 0 && name) {
                    props.push({ r, c, name, role, id, offX, offY });
                }
            }
        };
        collectProps(triggers);
        collectProps(solids);

        decorPayload = { rev: decorRev, decals: decals || undefined, props: props.length ? props : undefined };
        g.__lastDecorPayload = decorPayload;

        const debugProps = DEBUG_PROP_SYNC || !!(g.__DEBUG_PROP_SYNC);
        if (debugProps) {
            const gDbg: any = (globalThis as any);
            if (!gDbg.__propLogThrottles) gDbg.__propLogThrottles = {};
            const floorSig = `${worldRev}|${floorIndex}`;
            const prevSig = gDbg.__propLogThrottles.captureFloorSig;
            const shouldLog = prevSig !== floorSig;
            if (shouldLog) {
                gDbg.__propLogThrottles.captureFloorSig = floorSig;
                const byName: Record<string, number> = {};
                for (const p of props) {
                    if (!p || !p.name) continue;
                    byName[p.name] = (byName[p.name] || 0) + 1;
                }
                console.log("[net.decor.capture]", {
                    decorRev,
                    worldRev,
                    floorIndex,
                    triggerCount: triggers.length,
                    solidCount: solids.length,
                    props: props.length,
                    byName,
                    decalRows: decals ? decals.length : 0
                });
            }
        }
    } catch (e) {
        console.warn("[tilemap] failed to capture decor payload", e);
    }

    g.__floorBaseFamily = baseFamily;
    g.__floorWallFamily = wallFamily;
    if (palette) g.__floorThemePalette = palette;
    if (textureSeed) g.__floorTextureSeed = textureSeed | 0;

    const themeKey = `${baseFamily}|${wallFamily}|${palette || ""}|${textureSeed | 0}`;
    const lastThemeKey = (g.__tilemapAppliedThemeKey as string) || "";

    const decorNeedsApply =
        decorPayload &&
        ((decorPayload.rev | 0) !== (this._tilemapAppliedDecorRev | 0));

    const prevFloor = this._tilemapAppliedFloorIndex | 0;
    const forceFlash = !!g.__forceScreenFlashOnNextTilemap;
    const baseChanged =
        (worldRev | 0) !== (this._tilemapAppliedWorldRev | 0) ||
        (floorIndex | 0) !== (this._tilemapAppliedFloorIndex | 0) ||
        rows !== (this._tilemapAppliedRows | 0) ||
        cols !== (this._tilemapAppliedCols | 0) ||
        tileSize !== (this._tilemapAppliedTileSize | 0) ||
        themeKey !== lastThemeKey;

    if ((!baseChanged && !decorNeedsApply) || rows <= 0 || cols <= 0) return;

    // Cheap high-level counts (helps confirm “grid changed” at a glance)
    let rawWalls = 0;
    let rawFloors = 0;
    if (baseChanged) {
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                const v = row[c] | 0;
                if (v === 1) rawWalls++;
                else rawFloors++;
            }
        }

        this.applyTilemapToScene(grid, tileSize);

        this._tilemapAppliedWorldRev = worldRev;
        this._tilemapAppliedFloorIndex = floorIndex;
        this._tilemapAppliedRows = rows;
        this._tilemapAppliedCols = cols;
        this._tilemapAppliedTileSize = tileSize;

        g.__tilemapAppliedThemeKey = themeKey;
        g.__tilemapAppliedWorldRev = (worldRev | 0);
        g.__tilemapAppliedFloorIndex = (floorIndex | 0);
    } else if (decorNeedsApply) {
        try {
            const decorNS = (globalThis as any).__HeroEnginePhaserDecor;
            if (decorNS && typeof decorNS.forceResync === "function") {
                decorNS.forceResync("decor-only");
            }
        } catch { /* ignore */ }
    }

        if (decorPayload) {
            this._tilemapAppliedDecorRev = (decorPayload.rev | 0);
            // Record floor signature for host-side "ignore echoed tilemap" guard
            const gAny: any = globalThis as any;
            gAny.__hostWorldRevApplied = worldRev | 0;
            gAny.__hostFloorIndexApplied = floorIndex | 0;
    }

    if (DEBUG_TILEMAP_MAIN && baseChanged) {
        console.log(">>> [HeroScene.tilemap] host applied tilemap from engine", {
            worldRev,
            floorIndex,
            rows,
            cols,
            tileSize,
            rawWalls,
            rawFloors,
            baseFamily,
            wallFamily,
        });
    }

    // Only flash the screen on true floor changes unless a forced flash was requested.
    const shouldFlash = baseChanged && (forceFlash || (floorIndex | 0) !== (prevFloor | 0));
    if (shouldFlash) {
      this.cameras?.main?.flash(140);
    }
    if (forceFlash && baseChanged) {
      g.__forceScreenFlashOnNextTilemap = false;
    }

    // Broadcast to clients (monotonic net rev)
    const wsAny: WebSocket | null = g.__net?.ws ?? null;

    const seenNetRev = (g.__netTilemapLatestRev | 0) || 0;
    let base = (g.__tilemapNetRevBase | 0) || 0;

    let netRev = (worldRev | 0) + base;
    if (netRev <= seenNetRev) {
        base += (seenNetRev - netRev + 1);
        netRev = (worldRev | 0) + base;
    }

    const lastSent = (g.__tilemapLastSentNetRev | 0) || 0;
    if (netRev <= lastSent) {
        base += (lastSent - netRev + 1);
        netRev = (worldRev | 0) + base;
    }

    g.__tilemapNetRevBase = base;
    g.__tilemapLastSentNetRev = netRev;

    const syncHash = this._computeWorldSyncHashFromRenderer(this.tileRenderer);

    const msg = {
        type: "tilemap",
        rev: netRev,
        rows,
        cols,
        tileSize,
        encoding: "raw",
        data: grid,
        baseFamily,
        wallFamily,
        textureSeed: textureSeed || undefined,
        palette: palette || undefined,
        worldRev,
        floorIndex,
        floorKind: (internals.getFloorKind?.() || g.__floorKind || ""),
        decorOnly: (!baseChanged && !!decorNeedsApply),
        forceFlash: forceFlash ? 1 : undefined,
        decor: decorPayload || undefined,
        baseSig: syncHash ? (syncHash.baseSig | 0) : undefined,
        decorSig: syncHash ? (syncHash.decorSig | 0) : undefined,
        worldSig: syncHash ? (syncHash.worldSig | 0) : undefined,
    };

    // queue for retry (even if ws is open, we still retry a couple times to de-flake)
    g.__pendingTilemapToSend = msg;
    g.__pendingTilemapToSendTriesLeft = 3;
    g.__pendingTilemapToSendNextAtMs =
        (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    if (wsAny && wsAny.readyState === WebSocket.OPEN) {
        try {
            wsAny.send(JSON.stringify(msg));
            if (DEBUG_TILEMAP_MAIN) {
                console.log(">>> [HeroScene.tilemap] host sent tilemap to server", {
                    rev: netRev,
                    rows,
                    cols,
                    tileSize,
                    encoding: "raw",
                });
            }
        } catch (e: any) {
            if (DEBUG_TILEMAP_MAIN) console.warn(">>> [HeroScene.tilemap] send failed (will retry)", e);
        }
    }
}

private initTileAtlasAndInstallTilemapHook() {
    logMain(">>> [HeroScene.create] building tile atlas");

    // Build atlas once
    this.tileAtlas = buildTileAtlas(this);

    // Install net hook for tilemap messages
    this._tilemap_installNetTilemapHandler();

    // Apply any pending cached tilemap (if the net layer received one before we installed the handler)
    this._tilemap_applyPendingCachedNetTilemapIfAny();
}




private ensureHostFlagInitialized() {
    const g: any = globalThis as any;

    if (typeof g.__isHost === "boolean") {
        logMain(">>> [HeroScene.create] host flag from network =", g.__isHost);
    } else {
        logMain(">>> [HeroScene.create] no host flag yet; defaulting to follower");
        g.__isHost = false;
    }
}

private async importMakeCodeModules(): Promise<any> {
    logMain(">>> [HeroScene.create] importing compat + extensions (+ HeroEngine via host hook)");

    // IMPORTANT: load modules in MakeCode-like order
    const compatMod = await import("./arcadeCompat");
    await import("./arcadeCompat.net");
    await import("./text");
    await import("./status-bars");
    await import("./sprite-data");
    await import("./heroEnginePhaserGlue");

    return compatMod;
}


private async _host_importEngineAndGlue(): Promise<any> {
    logMain(">>> [HeroScene.create] __startHeroEngineHost: importing HeroEngineInPhaser");

    // 1) Load the wrapped HeroEngine module (with Phaser shims)
    const engineMod: any = await import("./HeroEngineInPhaser");

    // 2) Load the Phaser glue and install the host overrides
    const glue: any = await import("./heroEnginePhaserGlue");
    if (glue && typeof glue.initHeroEngineHostOverrides === "function") {
        glue.initHeroEngineHostOverrides();
    }

    return engineMod;
}

private _host_patchSpriteKindCreate(engineMod: any): void {
    // Patch SpriteKind.create on ANY SpriteKind we can see
    const skGlobal: any = (globalThis as any).SpriteKind;
    const skMod: any = engineMod.SpriteKind;

    let sk: any = skMod || skGlobal;

    if (!sk) {
        sk = {};
        (globalThis as any).SpriteKind = sk;
    }

    if (typeof sk.create !== "function") {
        // keep counter stable across reloads if possible
        const g: any = globalThis as any;
        if (typeof g.__spriteKindNextKind !== "number") g.__spriteKindNextKind = 10;

        sk.create = function (): number {
            const id = (g.__spriteKindNextKind | 0) || 10;
            g.__spriteKindNextKind = (id + 1) | 0;
            return id;
        };
    }

    if (skMod && skMod !== sk) {
        engineMod.SpriteKind = sk;
    }
    if (skGlobal && skGlobal !== sk) {
        (globalThis as any).SpriteKind = sk;
    }
}

private _host_getHeroEngine(engineMod: any): any {
    return engineMod.HeroEngine || (globalThis as any).HeroEngine;
}

private _host_trySyncTilesAndPublishOnceFromInternals(): void {
    // TILES: sync from HeroEngine and publish to server once
    try {
        const g: any = globalThis as any;
        const internals = g.__HeroEnginePhaserInternals;

        const hasInternals =
            internals &&
            typeof internals.getWorldTileMap === "function" &&
            typeof internals.getWorldTileSize === "function";

        if (!hasInternals) {
            console.warn(
                ">>> [HeroScene.create] __HeroEnginePhaserInternals missing or incomplete – cannot sync tiles yet"
            );
            return;
        }

        const grid: number[][] = internals.getWorldTileMap();
        const tileSize: number = internals.getWorldTileSize();

        // ✅ FIX: rows/cols must be defined (your old code used rows/cols without declaring)
        const rows = (grid && grid.length) ? (grid.length | 0) : 0;
        const cols = (rows > 0 && grid[0]) ? (grid[0].length | 0) : 0;

        // (optional) raw counts for debugging payload
        let rawWalls = 0;
        let rawFloors = 0;
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                const v = row[c] | 0;
                if (v === 1) rawWalls++;
                else rawFloors++;
            }
        }

        const scene: any = g.__phaserScene || (this as any);

        if (!scene || typeof scene.applyTilemapToScene !== "function") {
            console.warn(
                ">>> [HeroScene.create] no scene/applyTilemapToScene when trying to sync tiles"
            );
            return;
        }

        // Sync locally first
        scene.applyTilemapToScene(grid, tileSize);
        const syncHash = this._computeWorldSyncHashFromRenderer(scene.tileRenderer);

        // NETWORK: publish tilemap once (host authoritative)
        const gAny: any = globalThis as any;

        if (gAny.__tilemapSentOnce) return;

        const worldRev = (typeof internals.getWorldRev === "function") ? (internals.getWorldRev() | 0) : 0;
        const floorIndex = (typeof internals.getFloorIndex === "function") ? (internals.getFloorIndex() | 0) : -1;
        const floorKind = (typeof internals.getFloorKind === "function") ? String(internals.getFloorKind()) : "";

        const baseFamily = (typeof internals.getFloorBaseFamily === "function")
            ? String(internals.getFloorBaseFamily())
            : (gAny.__floorBaseFamily || "ground_light");

        const wallFamily = (typeof internals.getFloorWallFamily === "function")
            ? String(internals.getFloorWallFamily())
            : (gAny.__floorWallFamily || "chasm_light");

        // Ensure theme globals are set before rendering
        gAny.__floorBaseFamily = baseFamily;
        gAny.__floorWallFamily = wallFamily;

        // Prevent “server replay rev is ahead of engine worldRev”
        const seenA = (gAny.__netTilemapRev | 0) || 0;
        const seenB = (gAny.__netTilemapLatestRev | 0) || 0;
        const seenNetRev = Math.max(seenA, seenB);

        let netBase = (gAny.__tilemapNetRevBase | 0) || 0;

        const lastA = (gAny.__tilemapNetRevLastSent | 0) || 0;
        const lastB = (gAny.__tilemapLastSentNetRev | 0) || 0;
        const lastNetRev = Math.max(lastA, lastB);

        let netRev = (worldRev + netBase) | 0;
        if (netRev <= seenNetRev) {
            netRev = (seenNetRev + 1) | 0;
            netBase = (netRev - worldRev) | 0;
        }
        if (netRev <= lastNetRev) {
            netRev = (lastNetRev + 1) | 0;
            netBase = (netRev - worldRev) | 0;
        }

        gAny.__tilemapNetRevBase = netBase;
        gAny.__tilemapNetRevLastSent = netRev;
        gAny.__tilemapLastSentNetRev = netRev;

        // Record “host applied” state so update() can be robust (not rev-only).
        gAny.__hostWorldRevApplied = worldRev;
        gAny.__hostFloorIndexApplied = floorIndex;
        gAny.__hostTileRowsApplied = rows;
        gAny.__hostTileColsApplied = cols;
        gAny.__hostTileSizeApplied = tileSize;
        gAny.__hostBaseFamilyApplied = baseFamily;
        gAny.__hostWallFamilyApplied = wallFamily;

        // Compute signature
        let sig = 0x811c9dc5 | 0; // FNV-ish
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                sig ^= (row[c] | 0);
                sig = Math.imul(sig, 16777619);
            }
        }
        gAny.__hostTileSigApplied = sig | 0;

        // Keep the scene-level “applied rev” aligned to netRev (not worldRev)
        (scene as any)._tilemapAppliedRev = netRev;
        (scene as any)._tilemapAppliedRows = rows;
        (scene as any)._tilemapAppliedCols = cols;
        (scene as any)._tilemapAppliedTileSize = tileSize;
        (scene as any)._tilemapAppliedFloorIndex = floorIndex;

        // Also keep the net-apply theme gate aligned
        gAny.__tilemapAppliedBaseFamily = baseFamily;
        gAny.__tilemapAppliedWallFamily = wallFamily;

        const tilemapMsg = {
            type: "tilemap",
            rev: netRev,      // monotonic network rev
            worldRev,         // engine rev (debug/metadata)
            floorIndex,
            floorKind,
            tileSize,
            rows,
            cols,
            grid,
            rawWalls,
            rawFloors,
            baseFamily,
            wallFamily,
            baseSig: syncHash ? (syncHash.baseSig | 0) : undefined,
            decorSig: syncHash ? (syncHash.decorSig | 0) : undefined,
            worldSig: syncHash ? (syncHash.worldSig | 0) : undefined,
        };

        // Cache the latest tilemap msg so update() can re-send if ws isn’t open yet
        gAny.__tilemapLatestMsg = tilemapMsg;

        // ✅ also align with your newer retry machinery (so update() resend can pick it up)
        gAny.__pendingTilemapToSend = tilemapMsg;
        gAny.__pendingTilemapToSendTriesLeft = 3;
        gAny.__pendingTilemapToSendNextAtMs =
            (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

        try {
            const ws: WebSocket | null = gAny.__net?.ws ?? null;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(tilemapMsg));
                gAny.__tilemapLastActuallySentRev = netRev;
                gAny.__netTilemapLatestRev = Math.max(((gAny.__netTilemapLatestRev | 0) || 0), netRev);
                if (DEBUG_TILEMAP_MAIN) {
                    console.log(">>> [HeroScene.tilemap] host sent tilemap to server", {
                        rev: netRev, worldRev, floorIndex, floorKind, rows, cols, tileSize
                    });
                }
            } else {
                console.warn(">>> [HeroScene.tilemap] ws not open; cached initial tilemapMsg", {
                    rev: netRev, worldRev, floorIndex, floorKind
                });
            }
        } catch (e) {
            console.warn(">>> [HeroScene.tilemap] failed to send tilemap", e);
        }

        gAny.__tilemapSentOnce = true;

    } catch (e) {
        console.error(
            ">>> [HeroScene.create] ERROR while syncing tiles from HeroEngine:",
            e
        );
    }
}

private _host_scheduleSpriteDump(): void {
    logMain(">>> [HeroScene.create] scheduling sprite dump (host only)");
    setTimeout(() => {
        logMain(">>> [HeroScene.create] RUNNING SPRITE DUMP");
        import("./arcadeCompat")
            .then((compat: any) => {
                if (compat && typeof compat.dumpAllSprites === "function") {
                    compat.dumpAllSprites();
                } else {
                    logMain("[HeroScene.create] dumpAllSprites not found on arcadeCompat");
                }
            })
            .catch((e: any) => {
                logMain("[HeroScene.create] sprite dump import error: " + e);
            });
    }, 1000);
}


private installStartHeroEngineHostHook() {
    (globalThis as any).__startHeroEngineHost = async () => {
        const g: any = globalThis as any;
        if (g.__heroEngineHostStarted) return;
        g.__heroEngineHostStarted = true;

        const engineMod: any = await this._host_importEngineAndGlue();

        this._host_patchSpriteKindCreate(engineMod);

        // 5) Start the HeroEngine world
        const HE: any = this._host_getHeroEngine(engineMod);
        if (HE && typeof HE.start === "function") {
            logMain(">>> [HeroScene.create] starting HeroEngine from host");
            HE.start();

            // TILES: sync from HeroEngine and publish to server once
            this._host_trySyncTilesAndPublishOnceFromInternals();
        } else {
            console.warn(
                ">>> [HeroScene.create] HeroEngine.start not found on engine module or globalThis"
            );
        }

        // 6) Schedule a sprite dump to verify everything
        this._host_scheduleSpriteDump();
    };
}





private initNetwork(compatMod: any) {
    if (typeof (compatMod as any).initNetwork === "function") {
        logMain(">>> [HeroScene.create] initNetwork()");
        (compatMod as any).initNetwork();
    } else {
        console.warn(">>> [HeroScene.create] compat.initNetwork missing");
    }
}

private wireKeyboardToController() {
    const controllerNS: any = (globalThis as any).controller;
    if (controllerNS && typeof controllerNS._wireKeyboard === "function") {
        logMain(">>> [HeroScene.create] wiring keyboard to controller (network-aware)");
        controllerNS._wireKeyboard(this);
    } else {
        console.warn(">>> [HeroScene.create] controller._wireKeyboard missing", controllerNS);
    }
}

private wireGamepadToController() {
    const controllerNS: any = (globalThis as any).controller;
    if (controllerNS && typeof controllerNS._wireGamepad === "function") {
        logMain(">>> [HeroScene.create] wiring gamepad to controller (network-aware)");
        controllerNS._wireGamepad(this);
    } else {
        console.warn(">>> [HeroScene.create] controller._wireGamepad missing", controllerNS);
    }
}

private buildMonsterAtlasAndRegistry() {
    try {
        this.monsterAtlas = buildMonsterAtlas(this);

        (this as any).__monsterAtlas = this.monsterAtlas;
        (globalThis as any).__monsterAtlas = this.monsterAtlas;

        this.registry.set("monsterAtlas", this.monsterAtlas);

        if (DEBUG_MONSTER_SPRITES) {
        console.log(
            ">>> [HeroScene.create] monster atlas built; ids =",
            Object.keys(this.monsterAtlas)
        );
    }
    } catch (e) {
        console.error(">>> [HeroScene.create] FAILED to build monster atlas", e);
    }
}


private maybeInstallHeroAnimTester() {
    const paramsHero = new URLSearchParams(window.location.search);
    const heroAnimTest = paramsHero.get("heroAnimTest") === "1";
    if (heroAnimTest) {
        installHeroAnimTester(this);
    }
}


update(time: number, delta: number) {
    const g: any = globalThis as any;

    // Keep canvas size locked to DOM game-area
    this._resizeGameToDomViewport("update");

    const bossIntroActive = this._updateBossIntro(time | 0);
    const bossHoldActive = bossIntroActive ? false : this._updateBossIntroHoldCamera(time | 0, delta | 0);
    const trialHoldActive = (!bossIntroActive && !bossHoldActive) ? this._updateTrialCameraHold(time | 0, delta | 0) : false;

    // Keep camera following local player hero (works on host + clients)
    if (!bossIntroActive && !bossHoldActive && !trialHoldActive) {
        this._updateCameraFollowLocalHero();
        this._checkCameraFollowSanity(time | 0);
    }
    this._snapCameraScrollToPixelGrid();

    this._updateLegacyHostTick(g);

    this._updateCoinFx(g);
    _tryApplyPendingWorldSnapshotForSave();

    // IMPORTANT: Tilemap sync must NOT depend on __game.
    if (!g.__isHost) return;

    this._tilemap_hostResendPendingIfNeeded(g);

    this._tilemap_hostSyncFromEngineAndBroadcastIfNeeded(g);
}











private runStartupDialogTest(): void {
    const g: any = globalThis as any;

    // Only run once per page load
    if (g.__startupDialogTestShown) return;

    const dlg = g.__heDialog;

    // If index.html loaded the module before installing __heDialog, retry briefly.
    if (!dlg || typeof dlg.show !== "function" || typeof dlg.hide !== "function") {
        const tries = ((g.__startupDialogTestTries | 0) + 1) | 0;
        g.__startupDialogTestTries = tries;

        if (tries <= 40) {
            // ~2 seconds max retry window (40 * 50ms)
            this.time.delayedCall(50, () => this.runStartupDialogTest());
            return;
        }

        console.warn("[dialog] __heDialog missing after retries; is the DOM dialog script loaded in index.html?");
        return;
    }

    g.__startupDialogTestShown = true;
    g.__startupDialogTestTries = 0;

    dlg.show({
        speaker: "Narrator",
        text:
            "Welcome Hero! You must climb the tower to reach your destiny.\n" +
            "Watch out for monsters along the way.",
        hint: "", // optional: hide hint for this timed splash
    });

    // Hide after a timed window
    this.time.delayedCall(5000, () => {
        try {
            dlg.hide();
        } catch (_e) {
            // ignore
        }
    });
}



//This is the end of Phaser scene extends

}


const HERO_SCENE_KEY = "hero";

let __phaserGame: Phaser.Game | null = (globalThis as any).__phaserGame || null;

function _startPhaserGameSingleton(gameConfig: Phaser.Types.Core.GameConfig): Phaser.Game {
  const parentId = (typeof gameConfig.parent === "string" ? gameConfig.parent : "app") || "app";
  const parentEl = document.getElementById(parentId);

  if (__phaserGame) return __phaserGame;

  // Also hard-clear the parent to remove any leftover canvas
  if (parentEl) parentEl.innerHTML = "";

  __phaserGame = new Phaser.Game(gameConfig);
  (globalThis as any).__phaserGame = __phaserGame;
  return __phaserGame;
}

function _swapHeroScene(game: Phaser.Game): void {
  const mgr = game.scene;
  try {
    if (mgr.getScene(HERO_SCENE_KEY)) {
      mgr.stop(HERO_SCENE_KEY);
      mgr.remove(HERO_SCENE_KEY);
    }
  } catch (_e) {
    // ignore
  }
  mgr.add(HERO_SCENE_KEY, HeroScene, true);
}








// -------------------------------------
// PHASER GAME CONFIG
// -------------------------------------

// -------------------------------------
// PHASER GAME CONFIG
// -------------------------------------

function shouldStartGameFromUrl(): boolean {
    try {
        const params = new URLSearchParams(window.location.search);
        return !!params.get("profile");
    } catch {
        return false;
    }
}

// Start with a small placeholder. We will RESIZE to the tilemap world size
// the moment the engine publishes a tilemap.
const INITIAL_VIEW_W = 480;
const INITIAL_VIEW_H = 270;

const CAMERA_BASE_VIEW_W = INITIAL_VIEW_W;
const CAMERA_BASE_VIEW_H = INITIAL_VIEW_H;
const CAMERA_ZOOM_MIN = 0.5;
const CAMERA_ZOOM_MAX = 6;
const CAMERA_USER_ZOOM_MIN = 0.5;
const CAMERA_USER_ZOOM_MAX = 3;
// Zoom steps: 50/75/100/125...% (perfect ratios), tile-aligned.
const CAMERA_ZOOM_BASE_TILE_PIXEL_MULTIPLE = 8;
const CAMERA_ZOOM_TARGET_TILE_PIXEL_MULTIPLE = 8;
const CAMERA_ZOOM_BASE_STEP_FALLBACK = 0.25;
const CAMERA_ZOOM_TARGET_STEP_FALLBACK = 0.25;
const CAMERA_USER_ZOOM_STEP_LOW = 0.25;
const CAMERA_USER_ZOOM_STEP_HIGH = 0.25;
const CAMERA_FOLLOW_SANITY_MS = 1500;
const CAMERA_FOLLOW_SANITY_TILES = 6;

const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    ...(DEBUG_FORCE_RENDERER_RESOLUTION_1 ? { resolution: 1 } : {}),

    width: INITIAL_VIEW_W,
    height: INITIAL_VIEW_H,

    parent: "app",
    backgroundColor: "#000000",

    pixelArt: true,
    roundPixels: true,

    scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
        parent: "app",
    },

    physics: {
        default: "arcade",
        arcade: { debug: false }
    },

    banner: DEBUG_PHASER_BANNER,

    input: {
        gamepad: true,
    },

    fps: {
        target: 60,
        min: 30,
        forceSetTimeOut: false
    },

    scene: [HeroScene]
};

if (shouldStartGameFromUrl()) {
    logMain("[main] profile found in URL; starting Phaser game.");

    const hadGame = !!(globalThis as any).__phaserGame;
    const game = _startPhaserGameSingleton(gameConfig);
    if (hadGame) _swapHeroScene(game);

} else {
    logMain("[main] no ?profile= URL param; waiting for landing page redirect.");
}



_hud_installOnce();

if (import.meta.hot) {
  import.meta.hot.accept();
}


// Verbose network tilemap/decor logging; set to true when debugging sync issues.
// Debug flags live in src/debugFlags.ts

type DecorPropEntry = { r: number; c: number; name?: string; role?: number; id?: number; offX?: number; offY?: number };
type DecorPayload = { rev: number; decals?: number[][]; props?: DecorPropEntry[] };

function _mapDecalIdToKey(id: number): string {
  const v = id | 0;
  if (v === 1) return "sand_patch";
  if (v >= 100 && v <= 104) return `telepad${v - 100}_top`;
  if (v >= 110 && v <= 114) return `telepad${v - 110}_bot`;
  if (v === 120) return "stairs_statue_top";
  if (v === 121) return "stairs_statue_mid";
  if (v === 122) return "stairs_statue_bot";
  if (v === 3160) return "shop_platform_center_a";
  if (v === 3161) return "shop_platform_center_b";
  if (v === 3162) return "shop_platform_center_c";
  if (v === 3163) return "shop_platform_center_d";

  // Trial arena decals (magecity.png)
  if (v === 3000) return "trial_floor_corner_nw";
  if (v === 3001) return "trial_floor_edge_n";
  if (v === 3002) return "trial_floor_corner_ne";
  if (v === 3003) return "trial_floor_edge_w";
  if (v === 3004) return "trial_floor_center";
  if (v === 3005) return "trial_floor_edge_e";
  if (v === 3006) return "trial_floor_corner_sw";
  if (v === 3007) return "trial_floor_edge_s";
  if (v === 3008) return "trial_floor_corner_se";

  if (v === 3010) return "trial_floor_interior_a";
  if (v === 3011) return "trial_floor_interior_b";
  if (v === 3012) return "trial_floor_interior_c";
  if (v === 3013) return "trial_floor_interior_d";

  if (v === 3020) return "trial_patch_a";
  if (v === 3021) return "trial_patch_b";
  if (v === 3022) return "trial_patch_c";
  if (v === 3023) return "trial_patch_d";

  if (v === 3030) return "trial_patch_edge_n";
  if (v === 3031) return "trial_patch_edge_s";
  if (v === 3032) return "trial_patch_edge_e";
  if (v === 3033) return "trial_patch_edge_w";
  if (v === 3034) return "trial_patch_corner_sw";
  if (v === 3035) return "trial_patch_corner_se";
  if (v === 3036) return "trial_patch_corner_nw";
  if (v === 3037) return "trial_patch_corner_ne";

  // Mountain rim cliffs (mountains.png)
  if (v === 3040) return "cliff_rim_nw_tl";
  if (v === 3041) return "cliff_rim_nw_tr";
  if (v === 3042) return "cliff_rim_nw_bl";
  if (v === 3043) return "cliff_rim_nw_br";
  if (v === 3044) return "cliff_rim_ne_tl";
  if (v === 3045) return "cliff_rim_ne_tr";
  if (v === 3046) return "cliff_rim_ne_bl";
  if (v === 3047) return "cliff_rim_ne_br";
  if (v === 3048) return "cliff_rim_sw_tl";
  if (v === 3049) return "cliff_rim_sw_tr";
  if (v === 3050) return "cliff_rim_sw_bl";
  if (v === 3051) return "cliff_rim_sw_br";
  if (v === 3052) return "cliff_rim_se_tl";
  if (v === 3053) return "cliff_rim_se_tr";
  if (v === 3054) return "cliff_rim_se_bl";
  if (v === 3055) return "cliff_rim_se_br";
  if (v === 3056) return "cliff_rim_edge_n_a";
  if (v === 3057) return "cliff_rim_edge_n_b";
  if (v === 3058) return "cliff_rim_edge_s_a";
  if (v === 3059) return "cliff_rim_edge_s_b";
  if (v === 3060) return "cliff_rim_edge_w";
  if (v === 3061) return "cliff_rim_edge_e";

  // Entrance tower (build_atlas.png)
  if (v === 3100) return "entrance_tower_left_r0";
  if (v === 3101) return "entrance_tower_center_r0";
  if (v === 3102) return "entrance_tower_right_r0";
  if (v === 3103) return "entrance_tower_left_r1";
  if (v === 3104) return "entrance_tower_center_r1";
  if (v === 3105) return "entrance_tower_right_r1";
  if (v === 3106) return "entrance_tower_left_r2";
  if (v === 3107) return "entrance_tower_center_r2";
  if (v === 3108) return "entrance_tower_right_r2";
  if (v === 3109) return "entrance_tower_left_r3";
  if (v === 3110) return "entrance_tower_center_r3";
  if (v === 3111) return "entrance_tower_right_r3";
  if (v === 3112) return "entrance_tower_left_r4";
  if (v === 3113) return "entrance_tower_center_r4";
  if (v === 3114) return "entrance_tower_right_r4";

  if (v === 3120) return "entrance_door_r0_c0";
  if (v === 3121) return "entrance_door_r0_c1";
  if (v === 3122) return "entrance_door_r0_c2";
  if (v === 3123) return "entrance_door_r0_c3";
  if (v === 3124) return "entrance_door_r1_c0";
  if (v === 3125) return "entrance_door_r1_c1";
  if (v === 3126) return "entrance_door_r1_c2";
  if (v === 3127) return "entrance_door_r1_c3";
  if (v === 3128) return "entrance_door_r2_c0";
  if (v === 3129) return "entrance_door_r2_c1";
  if (v === 3130) return "entrance_door_r2_c2";
  if (v === 3131) return "entrance_door_r2_c3";
  if (v === 3132) return "entrance_door_r3_c0";
  if (v === 3133) return "entrance_door_r3_c1";
  if (v === 3134) return "entrance_door_r3_c2";
  if (v === 3135) return "entrance_door_r3_c3";
  if (v === 3136) return "entrance_path_c0";
  if (v === 3137) return "entrance_path_c1";
  if (v === 3138) return "entrance_path_c2";
  if (v === 3139) return "entrance_path_c3";
  if (v === 3140) return "entrance_cav_left_r0";
  if (v === 3141) return "entrance_cav_center_r0";
  if (v === 3142) return "entrance_cav_right_r0";
  if (v === 3143) return "entrance_cav_left_r1";
  if (v === 3144) return "entrance_cav_center_r1";
  if (v === 3145) return "entrance_cav_right_r1";
  if (v === 3146) return "entrance_cav_left_r2";
  if (v === 3147) return "entrance_cav_center_r2";
  if (v === 3148) return "entrance_cav_right_r2";
  if (v === 3149) return "entrance_cav_left_r3";
  if (v === 3150) return "entrance_cav_center_r3";
  if (v === 3151) return "entrance_cav_right_r3";
  return "";
}
