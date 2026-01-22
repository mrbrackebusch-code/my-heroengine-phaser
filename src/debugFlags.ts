// Central debug/logging toggles (code-only).
// Edit this file instead of adding new local debug flags.
// When you add or change a flag, update DEBUG_FLAGS.md too.

// ------------------------------------------------------------
// Cross-module / shared
// ------------------------------------------------------------
export const DEBUG_NPC_PIPELINE = false; // NPC pipeline logs across engine/glue layers.

// ------------------------------------------------------------
// HeroEngineInPhaser.ts (core hero logic, input, anim)
// ------------------------------------------------------------
export const DEBUG_HERO_LOGIC = false;
export const DEBUG_HERO_LOGIC_OUT = false;   // log OUT once per call
export const DEBUG_HERO_LOGIC_ENTER = false; // log ENTER once per call
export const DEBUG_FILTER_LOGS = true;      // gate input/move filter logs
export const DEBUG_FILTER_PHRASE = "[P1 intent]"; // must include "P1 intent" per filtering workflow
export const DEBUG_WARN_PUBLISH_HERO_ACTION_PHASE = false;
export const DEBUG_PHASE_CHANGES = false;
export const DEBUG_SETUP_HEROES_LOGS = false;
export const DEBUG_HERO_SPAWN_LOGS = true;

// Anim keys logging (HeroEngineInPhaser.ts)
export const DEBUG_ANIM_KEYS = true;
export const DEBUG_ANIM_KEYS_HERO_INDEX = -1; // -1 = all heroes
export const DEBUG_ANIM_KEYS_PLAYER_ID = 0;   // 0 = all players
export const DEBUG_ANIM_KEYS_PHASE_EDGE = true;
export const DEBUG_ANIM_KEYS_PHASE_STAMP = false;
export const DEBUG_ANIM_KEYS_PHASE_PART = true;
export const DEBUG_ANIM_KEYS_INT_FINISH = false;
export const DEBUG_HERO_ANIM_FRAMES = true;
export const DEBUG_HERO_ANIM_FRAMES_STRENGTH_ONLY = true;
export const DEBUG_HERO_ANIM_FRAMES_ONLY_CHANGES = true;
export const DEBUG_HERO_ANIM_FRAMES_THROTTLE_MS = 0;
export const DEBUG_HERO_ANIM_STRENGTH_TRACE = true;
export const DEBUG_STR_PROJECTILE_METRICS = true;
export const DEBUG_STR_PROJECTILE_FRAMES = true;
export const DEBUG_STR_PROJECTILE_FRAMES_THROTTLE_MS = 0;

// Agility/integrator debug
export const DEBUG_AGILITY = false;
export const DBG_INTERVAL_MS = 50;
export const DEBUG_INTEGRATOR = false; // [WPN-FCO-CLEAR] and other integrator trace logs.
export const DBG_INT_INTERVAL_MS = 50;
export const DEBUG_AGI_COMBO = false;
export const DEBUG_AGI_COMBO_LANDING = false;
export const DEBUG_AGI_COMBO_EXIT = false;
export const DEBUG_AGI_COMBO_BUILD = false;
export const DEBUG_AGI_AIM = false;
export const DEBUG_AGI_AIM_HERO_INDEX = 0;   // 0 = hero 0, 1 = hero 1, etc.
export const DEBUG_AGI_AIM_THROTTLE_MS = 250;

// Move pipeline debug
export const DEBUG_MOVE_PIPE = false;
export const DEBUG_MOVE_PIPE_PLAYER = 0;      // 0 = all players, else player index (1-based)
export const DEBUG_MOVE_PIPE_THROTTLE_MS = 500;

// Worldgen / wave debug
export const DEBUG_WAVE_ENABLED = false;
export const DEBUG_MONSTER_ID = "imp blue";
export const DEBUG_WORLDGEN_LOGS = false;
export const DEBUG_WORLDGEN_FORCE_ISLAND = false;
export const DEBUG_WORLDGEN_BRIDGE_LOGS = false;
export const DEBUG_WORLDGEN_FORCE_BRIDGE_VERTICAL = false;
export const DEBUG_WORLD_SNAPSHOT = false; // [WORLD][MAP] snapshots on world rebuilds.
export const DEBUG_FORCE_TEST_WORLD_KIND = false;
export const DEBUG_FORCE_TEST_WORLD_LOG = false;

// Contract snapshot debug
export const DEBUG_CONTRACT_SNAPSHOT = false;
export let DEBUG_CONTRACT_PLAYER_ID = 0;       // 0 = all players
export let DEBUG_CONTRACT_HERO_INDEX = -1;     // -1 = all heroes
export let DEBUG_CONTRACT_THROTTLE_MS = 0;     // extra throttle beyond change-gate
export const DEBUG_SPECIAL_PHASE_LOG_ONCE = true;
export const DEBUG_MANA_FAIL_LOG_ONCE = true;
export const DEBUG_CONTRACT_VOLATILE_PART_WINDOWS: string[] = ["drive", "beat"];
export let DEBUG_CONTRACT_MAX_PRINTS_PER_SEC = 60;
export let DEBUG_CONTRACT_RUN_THROTTLE_MS = 1000;
export const DEBUG_CONTRACT_ENT_MOVE_EVERY_MS = 100;
export const DEBUG_CONTRACT_ENT_MOVE_QUANTUM_PX_SHIFT = 1;

// Decor/focus/chest debug (HeroEngineInPhaser.ts)
export const DEBUG_CHEST_ROUTE_TO_PILLAR = false;
export const DEBUG_FOCUS_DIRECT_LOGS = false;
export const DEBUG_CHEST_SCAN_LOGS = false;
export const DEBUG_DECOR_ENGINE_LOGS = false;
export const DEBUG_STATUE_STAMP = false;
export const DEBUG_STATUE_PEDESTAL = false;

// Dungeon/shop/relic/UI logs (HeroEngineInPhaser.ts)
export const DEBUG_DUNGEON_LOGS = false;
export const DEBUG_FORCE_HALL_OF_ENEMIES = false; // Force hall floor kind for enemy showcase/debug.
export const DEBUG_FOCUS_LOGS = false;
export const DEBUG_INTERACT_LOGS = true; // General interact pipeline (props/NPC).
export const DEBUG_INTERACT_TICK_LOGS = false; // Tick-level spam; keep off unless needed.
export const DEBUG_PROP_INTERACT_LOGS = false; // Prop-specific interact/dispatch logs.
export const DEBUG_TRAP_LOGS = false; // Trap prompt + trap effect logs.
export const DEBUG_TRAP_FORCE_ID = ""; // Force a specific trap spec id (overrides registry).
export const DEBUG_TRAP_FORCE_KIND = ""; // Force a trap kind (maps to default trap id).
export const DEBUG_TRAP_FORCE_SEED = 0; // Force a specific trap seed (0 disables).
export const DEBUG_TRAP_DUMP_INSTANCE = false; // Log generated trap inputs/expected output.
export const DEBUG_TRAP_SHOW_SOLUTION = true; // Show expected output in trap editor (debug only).
export const DEBUG_SHRINE_FORCE_OPEN_EDITOR = false; // Shrine: force open read-only Blockly on interact.
export const DEBUG_SHRINE_FORCE_ACTIVATE = true; // Shrine: force activation on interact (skip ritual).
export const DEBUG_SHRINE_OVERLAY_LOGS = false; // Shrine: log overlay state changes/failures.
export const DEBUG_SHRINE_OBSERVER = false; // Shrine: checklist observer (end-to-end report).
export const DEBUG_CHEST_INTERACT_LOGS = false; // Legacy: use DEBUG_INTERACT_LOGS.
export const DEBUG_RELIC_LOGS = true;
export const DEBUG_UI_LOGS = false;
export const DEBUG_UIAPI_LOGS = false;
export const DEBUG_SHOP_LOGS = false;
export const DEBUG_COINS_LOGS = false;

// Intellect debug (HeroEngineInPhaser.ts)
export const DEBUG_INT_DET = false;
export const DEBUG_INT_DET_FORCE_VISIBLE_IMAGE = false;

// Enemy navigation debug (HeroEngineInPhaser.ts)
export const DEBUG_ENEMY_NAV_LOG = false;
export const DEBUG_ENEMY_STUCK_LOG = false;
export const DEBUG_ENEMY_NAV_COLLISION = false;
export const DEBUG_DISABLE_ENEMY_WALL_COLLISIONS = true; // Allow enemies to ignore wall collision resolution.
export const DEBUG_ENEMY_AI_DECISIONS = false;
export const DEBUG_ENEMY_AI_DECISIONS_ONLY_CHANGES = true;
export const DEBUG_ENEMY_AI_DECISIONS_THROTTLE_MS = 400;

// ------------------------------------------------------------
// Arcade compat / Phaser wrapper (arcadeCompat.ts + arcadeCompat.net.ts)
// ------------------------------------------------------------
export const DEBUG_INT_HERO_VIS = false;
export const DEBUG_INT_HERO_NAME_FILTER = "Jason"; // empty string logs all
export const DEBUG_SETFLAG = false;
export const DEBUG_WRAP_TEX = false;
export const DEBUG_INPUT_EDGE_LOGS = true; // Log all local press/release edges (keyboard/gamepad)
export const DEBUG_NET = false;
export const DEBUG_NET_IDENTITY = true; // Profile/identity lifecycle logs.
export const DEBUG_TILEMAP_COMPAT = false; // [net.tilemap] receive/forward logs.
export const DEBUG_COMPAT_BOOT = false;
export const DEBUG_COMPAT_CONTROLLER = false;
export const DEBUG_COMPAT_BACKGROUND = false;
export const DEBUG_COMPAT_TILEMAP_STUB = false;
export const DEBUG_SPRITE_SYNC = false;
export const DEBUG_DRAW_WALL_COLLIDERS = false; //Show tile collisions for all
export const DEBUG_DRAW_ENEMY_WALL_COLLIDERS = false; //Enemy collider
export const DEBUG_ENEMY_POS_GUARD = true; // Track enemy x/y setters and report call sites.
export const DEBUG_ENEMY_POS_GUARD_THROW = true; // Throw on unregistered enemy position writes.
export const DEBUG_DRAW_ENEMY_SPRITE_BOUNDS = false; // Engine sprite bounds (Arcade image)
export const DEBUG_DRAW_ENEMY_COLLIDER_BOUNDS = false; // Enemy collider base-size bounds (colW/colH)
export const DEBUG_DRAW_ENEMY_HITBOX = false; // Engine overlap bounds (AABB used for overlaps)
export const DEBUG_DRAW_ENEMY_NATIVE_BOUNDS = false; // Phaser native sprite bounds (rendered art)
export const DEBUG_DRAW_ENEMY_NAV_FOOTPRINT = false; // Enemy nav footprint (clamped by DEBUG_ENEMY_FOOTPRINT_MAX_PX)
export const DEBUG_DRAW_ENEMY_AURA_BOUNDS = false; // Aura outline polygon (from non-transparent pixels)
export const DEBUG_DRAW_EFFECT_BOUNDS = false; // Effect sprite bounds (frame + nontransparent)
export const DEBUG_DRAW_HERO_SPRITE_BOUNDS = false; // Hero sprite bounds (Arcade image)
export const DEBUG_DRAW_HERO_COLLIDER_BOUNDS = false; // Hero collider bounds (colW/colH)
export const DEBUG_DRAW_HERO_HITBOX = false; // Hero overlap bounds (AABB used for overlaps)
export const DEBUG_DRAW_HERO_NATIVE_BOUNDS = false; // Hero native sprite bounds (rendered art)
export const DEBUG_DRAW_HERO_WALL_COLLIDERS = false; // Hero wall footprint
export const DEBUG_DRAW_HERO_NAV_FOOTPRINT = false; // Hero nav footprint (same as wall for now)
export const DEBUG_DRAW_DECOR_COLLIDERS = false; // Decor prop collider bounds (triggers + solids)
export const DEBUG_EFFECT_ANIMS = false; // Effect anim application logs (effects.*)
export const DEBUG_EFFECT_MASKS = false; // Effect mask debug logs (silhouette / mask attach)
export const DEBUG_EFFECT_ATLAS = false; // Effect atlas load summary (frames/cols/rows)
export const DEBUG_COLLIDER_WALL_COLOR = 0xff8800;
export const DEBUG_COLLIDER_ENEMY_COLOR = 0x00ff55;
export const DEBUG_COLLIDER_SPRITE_COLOR = 0x00b7ff;
export const DEBUG_COLLIDER_BODY_COLOR = 0xffd200;
export const DEBUG_COLLIDER_HIT_COLOR = 0xff00ff;
export const DEBUG_COLLIDER_NATIVE_COLOR = 0xffffff;
export const DEBUG_COLLIDER_NAV_COLOR = 0x00ffff;
export const DEBUG_COLLIDER_AURA_COLOR = 0x66ff00;
export const DEBUG_COLLIDER_DECOR_COLOR = 0xff66ff;
export const DEBUG_COLLIDER_EFFECT_FRAME_COLOR = 0x00ffff;
export const DEBUG_COLLIDER_EFFECT_PIXEL_COLOR = 0xff00ff;
export const DEBUG_COLLIDER_ALPHA = 0.35;
export const DEBUG_ENEMY_FOOTPRINT_MAX_PX = 30;
export const DEBUG_ENEMY_WALL_FOOTPRINT_PX = 32;
export const DEBUG_WEAPON_SYNC = false;
export const DEBUG_SPRITE_ATTACH = false;
export const DEBUG_PROJECTILE_NATIVE = false;
export const DEBUG_NET_SNAPSHOT = false;
export const DEBUG_SPRITE_PIXELS = false;
export const DEBUG_SPRITE_PIXELS_ALL = false;
export const DEBUG_ROLE_HERO = false;
export const DEBUG_ROLE_ENEMY = false;
export const DEBUG_ROLE_PROJECTILE = false;
export const DEBUG_ROLE_AURA = false;
export const DEBUG_ROLE_ACTOR = false;
export const DEBUG_ROLE_EFFECT = false;
export const DEBUG_ROLE_OTHER = false;
export const DEBUG_HERO_NATIVE_FEET_ANCHOR = false;
export const DEBUG_HERO_AURA_RENDER_LOGS = false; // [AURA][HERO][RENDER] one-time per frame/texture
export const DEBUG_KIND56_CREATE_TRACE = true;
export const DEBUG_OVERLAPS = false;
export const MAX_OVERLAP_DEBUG_LOGS = 40;
export const DEBUG_NET_APPLY_FOLLOWER = false;
export const DEBUG_CATEGORY_X = false;
export const DEBUG_CATEGORY_X_SAMPLES = false;

// Decor pipeline (arcadeCompat.ts)
export const DECOR_ENABLED = true;
export const DECOR_DEBUG = false;
export const DECOR_ENABLE_TIER2 = false;
export const DECOR_ENABLE_SOLID_BLOCKING = false;

// ------------------------------------------------------------
// Prop outline (heroAnimGlue.ts + arcadeCompat.ts)
// ------------------------------------------------------------
export const DEBUG_PROP_OUTLINE_VERBOSE = false;
export const DEBUG_PROP_OUTLINE_ONELOG = false;
export const DEBUG_PROP_OUTLINE_PREFER_CAMERA_SNAPSHOT = false;
export const DEBUG_PROP_OUTLINE_PREFER_PIXEL_PROBE = false;
export const DEBUG_PROP_OUTLINE_EXAGGERATE = false;
export const DEBUG_PROP_OUTLINE_EXAGGERATE_TINT = 0xff00ff;
export const FORCE_PROP_PREBAKED_OUTLINE = false;
export const FORCE_PROP_SCALE_OUTLINE = false;

// Hero animation glue (heroAnimGlue.ts)
export const DEBUG_HERO_ANIM_GLUE = false;
export const DEBUG_HERO_ANIM_GLUE_ONLY_PROBLEMS = true;
export const DEBUG_HERO_ANIM_GLUE_FOCUS_ON_INTELLECT = false;
export const DEBUG_INT_HERO_ANIM = false;
export const DEBUG_PROVE_HERO_CAST_ANIM = false;
export const DEBUG_PROVE_HERO_NAME_FILTER = "Jason";
export const DEBUG_TURN_SHOULD_PROVE_ON = false;

// ------------------------------------------------------------
// Tilemap / tiles (main.ts, tileAtlas.ts, tileMapGlue.ts)
// ------------------------------------------------------------
export const DEBUG_TILEMAP_MAIN = false;
export const DEBUG_TILEMAP_APPLY_NET = false;
export const DEBUG_PROP_SYNC = false; // [net.decor.apply]/[net.decor.capture] logs.
export const DEBUG_TILE_ATLAS_GLOBAL = false; // was DEBUG_TILES_GLOBAL in tileAtlas.ts
export const DEBUG_TILES = false;
export const DEBUG_TILEMAP_GLUE = false; // [tileMapGlue] base render done, etc.
export const WORLD_SYNC_HASH_WARN_THRESHOLD_MS = 8000; // warn if host/follower hashes mismatch longer than this (0 disables)

// Prop focus aura (tileMapGlue.ts)
export const DEBUG_PROP_FOCUS_AURA = false;
export const DEBUG_PROP_FOCUS_AURA_LOGS = false;
export const DEBUG_PROP_FOCUS_AURA_FRAME_LOGS = false; // [PROPAURA][AURA-FRAME] verbose per-frame stats
export const LOG_PROP_FOCUS_AURA_RENDER_ONCE = false;
export const DEBUG_PROP_FOCUS_AURA_DEPTH = false;
export const DEBUG_PROP_FOCUS_AURA_FORCE_FRONT = false;
export const DEBUG_PROP_FOCUS_AURA_FORCE_FRONT_BUMP = 2000000;
export const DEBUG_PROP_FOCUS_AURA_WORLD_MARKER = false;
export const DEBUG_PROP_FOCUS_AURA_NEON = false;
export const DEBUG_PROP_FOCUS_AURA_SCENE_DIAG = false;
export const LOG_PROP_FOCUS_AURA_SCENE_DIAG_ONCE = false;
export const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE = false;
export const LOG_PROP_FOCUS_AURA_PIXEL_PROBE_ONCE = false;
export const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_LOG_NO_SNAPSHOT = false;
export const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_ENTER_LOG = false;
export const DEBUG_PROP_FOCUS_AURA_PIXEL_PROBE_TIMEOUT_MS = 250;
export const DEBUG_PROP_FOCUS_AURA_PROP_TINT = false;
export const DEBUG_PROP_FOCUS_AURA_POSTRENDER_PROBE = false;
export const DEBUG_PROP_FOCUS_AURA_SCREEN_SAMPLE = false;
export const DEBUG_PROP_FOCUS_AURA_PIN_SCREEN = false;
export const DEBUG_PROP_FOCUS_AURA_HUD_PREVIEW = false;
export const DEBUG_PROP_FOCUS_AURA_FORCE_VISIBLE_NAMES = new Set<string>();
export const DEBUG_PROP_FOCUS_AURA_TRACE = false;
export const DEBUG_PROP_FOCUS_AURA_OVERRIDE = {
  enabled: false,
  fromBaseName: "chest",
  auraTextureKey: "tiles.terrain_atlas_aura_r2",
  frameIndex: 499,
};
export const DEBUG_PROP_FOCUS_AURA_VERBOSE = false;
export const DEBUG_PROP_FOCUS_AURA_BLINK = false;

// ------------------------------------------------------------
// Weapon debug (weaponAnimGlue.ts + main.ts)
// ------------------------------------------------------------
export const WEAPON_DEBUG = false;
export const WEAPON_DEBUG_VERBOSE = false;
export const DEBUG_WPN_AURA_ALWAYS_SHOW = false; // Always render weapon aura masks on the hero (visual overlay).
export const DEBUG_WPN_AURA_TRACE = false; // [WPNTRACE] weapon aura/debug traces
export const DEBUG_WPN_AURA_TRACE_VERBOSE = true;
export const DEBUG_WPN_AURA_TRACE_INTERVAL_MS = 120;
export const ENABLE_WEAPON_AUDIT_ON_START = false;
export const ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS = false;

// ------------------------------------------------------------
// Main/host/editor helpers
// ------------------------------------------------------------
export const ENABLE_HERO_ANIM_DEBUG = false;
export const DEBUG_MAIN_LIFECYCLE = false;
export const DEBUG_PHASER_BANNER = false; // Phaser startup banner/version log.
export const DEBUG_SAVE_LOGS = false;
export const DEBUG_RELICTIP_LOGS = false;
export const DEBUG_COINFX = false;
export const DEBUG_HOST_LOGIC = false;
export const DEBUG_HOST_LOGIC_BLOCKLY = false;
export const DEBUG_BLOCKLY_CODE_DUMP = false;
export const DEBUG_BLOCKLY_INVALID_MOVES = false;
export const DEBUG_HERO_LOGIC_STUDENT = false;
export const DEBUG_MONSTER_SPRITES = false;
export const DEBUG_MONSTER_SHEET_PARSE = false;
