

import Phaser from "phaser";

console.log(">>> [main.ts] dynamic-import version loaded");

import { preloadMonsterSheets, buildMonsterAtlas, type MonsterAtlas } from "./monsterAtlas";
import { applyMonsterAnimationForSprite } from "./monsterAnimGlue";

import { preloadHeroSheets, buildHeroAtlas } from "./heroAtlas";
import { debugSpawnHeroWithAnim } from "./heroAnimGlue";

import { installHeroAnimTester } from "./heroAnimGlue";

// NEW:
import { preloadTileSheets, buildTileAtlas, type TileAtlas } from "./tileAtlas";
import { WorldTileRenderer } from "./tileMapGlue";


//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
import { loadWeaponAtlases, runWeaponAudit } from "./weaponAtlas";



// Somewhere near the top of main.ts:
declare const globalThis: any;


const ENABLE_HERO_ANIM_DEBUG = true;

const DEBUG_TILEMAP = true;



// ------------------------------------------------------------
// Weapon debug flags (no URL params / no console commands needed)
// ------------------------------------------------------------
const ENABLE_WEAPON_DEBUG = true;          // logs missing weapon resolves (once per key) Debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
const ENABLE_WEAPON_DEBUG_VERBOSE = true; // also logs first successful resolve (once per key) Debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
const ENABLE_WEAPON_AUDIT_ON_START = true; // prints model support summary at startup Debug flag 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
const ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS = true; // huge log; leave false Debug flag



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
};


let _hudLastText = "";
let _hudLastSub = "";


type HudRefs = {
  who: HTMLElement;
  a: HTMLElement;
  b: HTMLElement;
  ab: HTMLElement;
};

let _hudRefs: HudRefs | null = null;
let _hudLastWho = "";
let _hudLastA = "";
let _hudLastB = "";
let _hudLastAB = "";
let _hudTimer: any = null;


function _hud_installOnce(): void {
  if (!HUD_ENABLED) return;

  const g: any = globalThis as any;
  if (g.__htmlHudInstalled) return;

  const who = document.getElementById("hud-cell-who");
  const a = document.getElementById("hud-cell-a");
  const b = document.getElementById("hud-cell-b");
  const ab = document.getElementById("hud-cell-ab");

  if (!who || !a || !b || !ab) {
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
    console.warn("[hud] missing DOM elements (#hud-cell-who/#hud-cell-a/#hud-cell-b/#hud-cell-ab)");
    return;
  }

  g.__htmlHudInstalled = true;

  _hudRefs = { who, a, b, ab };

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

function _hud_tryRunStudentLogic(heroIndex: number, button: "A" | "B" | "A+B"): any[] | null {
  const g: any = globalThis as any;
  const HE: any = g.HeroEngine;
  if (!HE || typeof HE.runHeroLogicForHeroHook !== "function") return null;

  const prevPreview = !!g.__heroLogicPreview;
  try {
    // If heroLogicHost is updated to respect this flag, it suppresses spam logs.
    g.__heroLogicPreview = true;

    const out = HE.runHeroLogicForHeroHook(heroIndex | 0, button);
    return Array.isArray(out) ? out : null;
  } catch (_e) {
    return null;
  } finally {
    g.__heroLogicPreview = prevPreview;
  }
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

function _hud_buildTextForHero(pid: number, hero: any): { sub: string; text: string } {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;

  const profile =
    Array.isArray(g.__heroProfiles) && g.__heroProfiles[pid - 1]
      ? String(g.__heroProfiles[pid - 1])
      : "";

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
    lines.push(`A  : ${a || "(missing " + HUD_KEYS.A + ")"}`);
    lines.push(`B  : ${b || "(missing " + HUD_KEYS.B + ")"}`);
    lines.push(`A+B: ${ab || "(missing " + HUD_KEYS.AB + ")"}`);
  }

  const sub = `connected=${_hud_slotConnected(pid)}  host=${!!g.__isHost}`;

  return { sub, text: lines.join("\n") };
}

function _hud_slotConnected(pid: number): boolean {
  const g: any = globalThis as any;
  const arr: any = g.__netSlotConnected;
  const idx = (pid | 0) - 1;
  if (!Array.isArray(arr)) return false;
  if (idx < 0 || idx >= arr.length) return false;
  return !!arr[idx];
}

function _hud_tick(): void {
  if (!_hudRefs) return;

  const pid = _hud_tryGetLocalPlayerId();
  if (!pid) {
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
    const w = `pid=${pid} — waiting for hero sprite…`;
    if (_hudLastWho !== w) {
      _hudRefs.who.textContent = w;
      _hudRefs.who.title = w;
      _hudLastWho = w;
    }
    return;
  }

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
}

function _hud_buildCellsForHero(pid: number, hero: any): {
  who: string; whoTitle?: string;
  a: string;   aTitle?: string;
  b: string;   bTitle?: string;
  ab: string;  abTitle?: string;
} {
  const g: any = globalThis as any;
  const spritesNS: any = g.sprites;

  const profile =
    Array.isArray(g.__heroProfiles) && g.__heroProfiles[pid - 1]
      ? String(g.__heroProfiles[pid - 1])
      : "";

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
    };
  }

  const outA = _hud_callStudentLogic(heroIndex, "A");
  const outB = _hud_callStudentLogic(heroIndex, "B");
  const outAB = _hud_callStudentLogic(heroIndex, "A+B");

  const aFull = _hud_fmtArrayFull(outA);
  const bFull = _hud_fmtArrayFull(outB);
  const abFull = _hud_fmtArrayFull(outAB);

  return {
    who,
    whoTitle: `${whoPrefix}\nheroIndex=${heroIndex}` + ((maxHp || maxMana) ? `\nHP ${hp}/${maxHp}  M ${mana}/${maxMana}` : ""),

    a: aFull,
    aTitle: `A\n${aFull}`,

    b: bFull,
    bTitle: `B\n${bFull}`,

    ab: abFull,
    abTitle: `A+B\n${abFull}`,
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
  const heroesArr = _hud_buildHeroesArr();
  for (let i = 0; i < heroesArr.length; i++) {
    if (heroesArr[i] === heroSprite) return i | 0;
  }
  return -1;
}

function _hud_callStudentLogic(heroIndex: number, button: "A" | "B" | "A+B"): any[] | null {
  const g: any = globalThis as any;
  const HE: any = g.HeroEngine;
  if (!HE || typeof HE.runHeroLogicForHeroHook !== "function") return null;

  const prev = !!g.__heroLogicPreview;
  try {
    // (Optional) lets host/student code suppress side effects/log spam if you choose to honor it.
    g.__heroLogicPreview = true;

    const out = HE.runHeroLogicForHeroHook(heroIndex | 0, button);
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

  const profile =
    Array.isArray(g.__heroProfiles) && g.__heroProfiles[pid - 1]
      ? String(g.__heroProfiles[pid - 1])
      : "";

  const who = `P${pid}${profile ? ":" + profile : ""}`;

  // Resolve heroIndex the SAME WAY the hook does (index in heroesArr)
  const heroIndex = _hud_resolveHeroIndexForSprite(hero);
  if (heroIndex < 0) {
    const line = `${who} | logic: (waiting for heroIndex…)`;
    return { line, title: line };
  }

  // Call student logic exactly like a real press would
  const outA = _hud_callStudentLogic(heroIndex, "A");
  const outB = _hud_callStudentLogic(heroIndex, "B");
  const outAB = _hud_callStudentLogic(heroIndex, "A+B");

  const aS = _hud_fmtArrayFull(outA);
  const bS = _hud_fmtArrayFull(outB);
  const abS = _hud_fmtArrayFull(outAB);

  // (Optional) keep a tiny bit of state context; remove if you want PURE logic only
  const hp = spritesNS ? _hud_readNum(spritesNS, hero, "hp") : 0;
  const maxHp = spritesNS ? _hud_readNum(spritesNS, hero, "maxHp") : 0;
  const mana = spritesNS ? _hud_readNum(spritesNS, hero, "mana") : 0;
  const maxMana = spritesNS ? _hud_readNum(spritesNS, hero, "maxMana") : 0;

  const stats = (maxHp || maxMana) ? `HP ${hp}/${maxHp} M ${mana}/${maxMana}` : "";

  const line = `${who}${stats ? " | " + stats : ""} | A=${aS} | B=${bS} | A+B=${abS}`;

  const title =
    `${who}\n` +
    `heroIndex=${heroIndex}\n` +
    (stats ? `${stats}\n` : "") +
    `A   = ${aS}\n` +
    `B   = ${bS}\n` +
    `A+B = ${abS}`;

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

    // Store the raw name if anyone wants it
    g.__localHeroProfileName = profile;

    if (!g.__heroProfiles) {
        g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    }

    if (profile && typeof profile === "string") {
        // Apply to slot 0 (player 1)
        g.__heroProfiles[0] = profile;
        console.log("[main] URL profile override for P1:", profile);
    } else {
        console.log("[main] no ?profile= URL param; using defaults");
    }
}










class HeroScene extends Phaser.Scene {

    private monsterAtlas?: MonsterAtlas;

    // NEW:
    private tileAtlas?: TileAtlas;
    private tileRenderer?: WorldTileRenderer;

    // Latest tilemap rev actually applied to the Phaser scene
    private _tilemapAppliedRev: number = 0;


    constructor() {
        super("hero");
    }

    preload() {
        console.log(">>> [HeroScene.preload] loading LPC monster sheets");
        preloadMonsterSheets(this);

        console.log(">>> [HeroScene.preload] loading hero spritesheets");
        preloadHeroSheets(this);

        console.log(">>> [HeroScene.preload] loading tile sheets");
        preloadTileSheets(this);

        console.log(">>> [HeroScene.preload] loading weapon sheets");
        loadWeaponAtlases(this);

    }



async create() {
    console.log(">>> [HeroScene.create] running (refactored)");

    // 1) Globals + debug flags (weapon flags come from constants, not URL)
    this.setupGlobalsAndDebug();

    // 2) Loading indicator
    const loadingText = this.createLoadingText();

    // 3) Hero atlas + aura validation
    buildHeroAtlas(this);
    this.validateHeroAuras(loadingText);
    loadingText.destroy();

    // 4) Tile atlas + net tilemap hook (+ apply pending cached tilemap)
    this.initTileAtlasAndInstallTilemapHook();

    // 5) Host flag / role
    this.ensureHostFlagInitialized();

    // 6) Import MakeCode-ish modules (compat + extensions)
    const compatMod = await this.importMakeCodeModules();

    // 7) Hook: network will call this when we become host
    this.installStartHeroEngineHostHook();

    // 8) Network init (all clients)
    this.initNetwork(compatMod);

    // 9) Keyboard -> controller wiring (all clients)
    this.wireKeyboardToController();

    // 10) Monster atlas + registry exposure
    this.buildMonsterAtlasAndRegistry();

    // 11) Optional hero anim tester
    this.maybeInstallHeroAnimTester();

    console.log(">>> [HeroScene.create] complete (refactored)");
}


    




private ensureWorldTileRenderer(atlas: TileAtlas): WorldTileRenderer {
    if (!this.tileRenderer) {
        if (DEBUG_TILEMAP) {
            console.log(">>> [HeroScene.tilemap] creating WorldTileRenderer");
        }
        this.tileRenderer = new WorldTileRenderer(this, atlas, {
            debugLocal: true
        });
    }

    // Expose the active WorldTileRenderer to the scene registry so arcadeCompat
    // can apply decor overlays without reaching into private fields.
    this.registry.set("__worldTileRenderer", this.tileRenderer);

    return this.tileRenderer;
}



public applyTilemapToScene(grid: number[][], tileSize: number) {
    const atlas = this.tileAtlas;
    if (!atlas) {
        if (DEBUG_TILEMAP) console.warn(">>> [HeroScene.tilemap] applyTilemapToScene: missing tileAtlas");
        return;
    }

    const renderer = this.ensureWorldTileRenderer(atlas);

    if (DEBUG_TILEMAP) {
        console.log(">>> [HeroScene.tilemap] syncing from grid", {
            rows: grid.length,
            cols: grid[0]?.length,
            tileSize
        });
    }
    renderer.syncFromEngineGrid(grid);

    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    const worldWidth = cols * tileSize;
    const worldHeight = rows * tileSize;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // ✅ Make the CANVAS match the actual game world (no extra black space).
    // This is the “spawn big then crop down” fix: once tilemap is known,
    // the viewport becomes exactly world-sized.
    this.scale.resize(worldWidth, worldHeight);
    this.cameras.main.setSize(worldWidth, worldHeight);

    if (DEBUG_TILEMAP) {
        console.log(">>> [HeroScene.tilemap] bounds + viewport set", {
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

    console.log(">>> [HeroScene.create] running");

    // Make this scene globally accessible to arcadeCompat
    (globalThis as any).__phaserScene = this;
    console.log(
        ">>> [HeroScene.create] __phaserScene set =",
        !!(globalThis as any).__phaserScene
    );

    // Apply URL-driven hero profile (e.g., ?profile=Demo%20Hero)
    // (kept as-is; profile selection is not "debug")
    applyUrlProfileToGlobals();

    // Existing hero anim debug registry flag
    this.registry.set("heroAnimDebug", ENABLE_HERO_ANIM_DEBUG);

    // ------------------------------------------------------------
    // WEAPON DEBUG (flag-driven; no URL params / no console toggles)
    // These globals are consumed by weaponAnimGlue.ts
    // ------------------------------------------------------------
    (g as any).__weaponDebug = ENABLE_WEAPON_DEBUG;
    (g as any).__weaponDebugVerbose = ENABLE_WEAPON_DEBUG_VERBOSE;

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
    const AURA_R = 2;
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
        const auraBaseKey = `${baseKey}_aura_r${AURA_R}`;

        const key192 = baseKey + "_192";
        const auraKey192 = `${key192}_aura_r${AURA_R}`;

        if (this.textures.exists(baseKey)) {
            if (!this.textures.exists(auraBaseKey)) {
                throw new Error(
                    `[AURA-MISSING] Texture not loaded: ${auraBaseKey}. Run: npm run gen-auras`
                );
            }
            texKeysToUseSet.add(baseKey);
        }

        const hasReal192 = isValid192Sheet(key192);
        if (hasReal192) {
            if (!this.textures.exists(auraKey192)) {
                throw new Error(
                    `[AURA-MISSING] Texture not loaded: ${auraKey192}. Run: npm run gen-auras`
                );
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

private initTileAtlasAndInstallTilemapHook() {
    console.log(">>> [HeroScene.create] building tile atlas");
    this.tileAtlas = buildTileAtlas(this);

    // TILEMAP NETWORK HOOK (followers + host)
    (globalThis as any).__onNetTilemap = (msg: any) => {
        try {
            if (!msg || msg.type !== "tilemap") return;

            const rev = typeof msg.rev === "number" ? msg.rev : 0;
            if (rev <= this._tilemapAppliedRev) return;
            this._tilemapAppliedRev = rev;

            const tileSize = msg.tileSize | 0;

            if (msg.encoding !== "raw") {
                console.warn(
                    ">>> [HeroScene] __onNetTilemap: unsupported encoding (for now):",
                    msg.encoding,
                    "rev=",
                    rev
                );
                return;
            }

            const grid: number[][] = msg.data;
            if (!Array.isArray(grid) || !Array.isArray(grid[0])) {
                console.warn(">>> [HeroScene] __onNetTilemap: malformed raw grid", {
                    rev,
                    tileSize,
                });
                return;
            }

            if (DEBUG_TILEMAP) {
                console.log(">>> [HeroScene.tilemap] applying network tilemap", {
                    rev,
                    rows: msg.rows,
                    cols: msg.cols,
                    tileSize,
                });
            }

            this.applyTilemapToScene(grid, tileSize);
        } catch (e) {
            console.error(">>> [HeroScene] __onNetTilemap ERROR:", e);
        }
    };

    // If a tilemap arrived before the hook was installed, apply it now.
    const pending = (globalThis as any).__lastTilemapMsg;
    if (pending && pending.type === "tilemap") {
        if (DEBUG_TILEMAP) {
            console.log(">>> [HeroScene.tilemap] applying pending cached tilemap on create()");
        }
        (globalThis as any).__onNetTilemap(pending);
    }
}

private ensureHostFlagInitialized() {
    const g: any = globalThis as any;

    if (typeof g.__isHost === "boolean") {
        console.log(">>> [HeroScene.create] host flag from network =", g.__isHost);
    } else {
        console.log(">>> [HeroScene.create] no host flag yet; defaulting to follower");
        g.__isHost = false;
    }
}

private async importMakeCodeModules(): Promise<any> {
    console.log(">>> [HeroScene.create] importing compat + extensions (+ HeroEngine via host hook)");

    // IMPORTANT: load modules in MakeCode-like order
    const compatMod = await import("./arcadeCompat");
    await import("./arcadeCompat.net");
    await import("./text");
    await import("./status-bars");
    await import("./sprite-data");
    await import("./heroEnginePhaserGlue");

    return compatMod;
}

private installStartHeroEngineHostHook() {
    (globalThis as any).__startHeroEngineHost = async () => {
        const g: any = globalThis as any;
        if (g.__heroEngineHostStarted) return;
        g.__heroEngineHostStarted = true;

        console.log(">>> [HeroScene.create] __startHeroEngineHost: importing HeroEngineInPhaser");

        // 1) Load the wrapped HeroEngine module (with Phaser shims)
        const engineMod: any = await import("./HeroEngineInPhaser");

        // 2) Load the Phaser glue and install the host overrides
        const glue: any = await import("./heroEnginePhaserGlue");
        if (glue && typeof glue.initHeroEngineHostOverrides === "function") {
            glue.initHeroEngineHostOverrides();
        }

        // 3) Load heroLogicHost (auto-registers <Name>HeroLogic from studentLogicAll)
        await import("./heroLogicHost");

        // 4) Patch SpriteKind.create on ANY SpriteKind we can see
        const skGlobal: any = (globalThis as any).SpriteKind;
        const skMod: any = engineMod.SpriteKind;

        let sk: any = skMod || skGlobal;

        if (!sk) {
            sk = {};
            (globalThis as any).SpriteKind = sk;
        }

        if (typeof sk.create !== "function") {
            let _nextKind = 10;
            sk.create = function (): number {
                const id = _nextKind;
                _nextKind++;
                return id;
            };
        }

        if (skMod && skMod !== sk) {
            engineMod.SpriteKind = sk;
        }
        if (skGlobal && skGlobal !== sk) {
            (globalThis as any).SpriteKind = sk;
        }

        // 5) Start the HeroEngine world
        const HE: any = engineMod.HeroEngine || (globalThis as any).HeroEngine;
        if (HE && typeof HE.start === "function") {
            console.log(">>> [HeroScene.create] starting HeroEngine from host");
            HE.start();

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
                } else {
                    const grid: number[][] = internals.getWorldTileMap();
                    const tileSize: number = internals.getWorldTileSize();

                    const scene: any = g.__phaserScene;

                    if (!scene || typeof scene.applyTilemapToScene !== "function") {
                        console.warn(
                            ">>> [HeroScene.create] no scene/applyTilemapToScene when trying to sync tiles"
                        );
                    } else {
                        scene.applyTilemapToScene(grid, tileSize);

                        // NETWORK: publish tilemap once (host authoritative)
                        const gAny: any = globalThis as any;

                        if (!gAny.__tilemapSentOnce) {
                            gAny.__tilemapSentOnce = true;

                            const netAny: any = gAny.__net;
                            const wsAny: any = netAny && netAny.ws;

                            const rows = grid.length;
                            const cols = grid[0]?.length || 0;

                            const tilemapMsg = {
                                type: "tilemap",
                                rev: 1,
                                tileSize,
                                rows,
                                cols,
                                encoding: "raw",
                                data: grid
                            };

                            try {
                                if (wsAny && wsAny.readyState === WebSocket.OPEN) {
                                    wsAny.send(JSON.stringify(tilemapMsg));
                                    if (DEBUG_TILEMAP) {
                                        console.log(">>> [HeroScene.tilemap] host sent tilemap to server", {
                                            rev: tilemapMsg.rev,
                                            rows,
                                            cols,
                                            tileSize
                                        });
                                    }
                                } else {
                                    console.warn(">>> [HeroScene.create] could not send tilemap (no ws / not open)");
                                }
                            } catch (e) {
                                console.error(">>> [HeroScene.create] ERROR sending tilemap:", e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(
                    ">>> [HeroScene.create] ERROR while syncing tiles from HeroEngine:",
                    e
                );
            }

        } else {
            console.warn(
                ">>> [HeroScene.create] HeroEngine.start not found on engine module or globalThis"
            );
        }

        // 6) Schedule a sprite dump to verify everything
        console.log(">>> [HeroScene.create] scheduling sprite dump (host only)");
        setTimeout(() => {
            console.log(">>> [HeroScene.create] RUNNING SPRITE DUMP");
            import("./arcadeCompat")
                .then((compat: any) => {
                    if (compat && typeof compat.dumpAllSprites === "function") {
                        compat.dumpAllSprites();
                    } else {
                        console.log("[HeroScene.create] dumpAllSprites not found on arcadeCompat");
                    }
                })
                .catch((e: any) => {
                    console.log("[HeroScene.create] sprite dump import error: " + e);
                });
        }, 1000);
    };
}

private initNetwork(compatMod: any) {
    if (typeof (compatMod as any).initNetwork === "function") {
        console.log(">>> [HeroScene.create] initNetwork()");
        (compatMod as any).initNetwork();
    } else {
        console.warn(">>> [HeroScene.create] compat.initNetwork missing");
    }
}

private wireKeyboardToController() {
    const controllerNS: any = (globalThis as any).controller;
    if (controllerNS && typeof controllerNS._wireKeyboard === "function") {
        console.log(">>> [HeroScene.create] wiring keyboard to controller (network-aware)");
        controllerNS._wireKeyboard(this);
    } else {
        console.warn(">>> [HeroScene.create] controller._wireKeyboard missing", controllerNS);
    }
}

private buildMonsterAtlasAndRegistry() {
    try {
        this.monsterAtlas = buildMonsterAtlas(this);

        (this as any).__monsterAtlas = this.monsterAtlas;
        (globalThis as any).__monsterAtlas = this.monsterAtlas;

        this.registry.set("monsterAtlas", this.monsterAtlas);

        const DEBUG_MONSTER_SPRITES = false;
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
        const gAny: any = (globalThis as any);
        const isHost = !!gAny.__isHost;

        // Only the host should actually tick the HeroEngine game loop.
        if (!isHost) return;

        const game = gAny.game;
        if (game && typeof game._tick === "function") {
            try {
                game._tick();
            } catch (e) {
                console.error(">>> [HeroScene.update] _tick ERROR:", e);
            }
        }


    }




}


let __phaserGame: Phaser.Game | null = null;

function _startPhaserGameSingleton(gameConfig: Phaser.Types.Core.GameConfig): Phaser.Game {
  const parentId = (typeof gameConfig.parent === "string" ? gameConfig.parent : "app") || "app";
  const parentEl = document.getElementById(parentId);

  // Kill any prior instance (prevents duplicate canvases)
  try {
    if (__phaserGame) {
      __phaserGame.destroy(true);
      __phaserGame = null;
    }
  } catch (_e) {
    // ignore
  }

  // Also hard-clear the parent to remove any leftover canvas
  if (parentEl) parentEl.innerHTML = "";

  __phaserGame = new Phaser.Game(gameConfig);
  return __phaserGame;
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

const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,

    width: INITIAL_VIEW_W,
    height: INITIAL_VIEW_H,

    parent: "app",
    backgroundColor: "#000000",

    pixelArt: true,
    roundPixels: true,

    scale: {
        mode: Phaser.Scale.NONE,
        // ✅ IMPORTANT: do NOT let Phaser write CSS offsets/margins to “center”
        autoCenter: Phaser.Scale.NO_CENTER
    },

    physics: {
        default: "arcade",
        arcade: { debug: false }
    },

    fps: {
        target: 60,
        min: 30,
        forceSetTimeOut: false
    },

    scene: [HeroScene]
};

if (shouldStartGameFromUrl()) {
    console.log("[main] profile found in URL; starting Phaser game.");

    _startPhaserGameSingleton(gameConfig);

} else {
    console.log("[main] no ?profile= URL param; waiting for landing page redirect.");
}



_hud_installOnce();


