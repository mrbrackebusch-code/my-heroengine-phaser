// server.js (ESM version, compatible with "type": "module")
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// ------------------------------------------------------------
// Debug / logging
// ------------------------------------------------------------
const SERVER_LAG_WARN_MS = 30;
const SERVER_LAG_HARD_MS = 100;

const DEBUG_NET = false;
const DEBUG_TILEMAP = false;

// ------------------------------------------------------------
// Host lease (grace window to allow host refresh without migration)
// ------------------------------------------------------------
const HOST_LEASE_MS = 5000;

// ------------------------------------------------------------
// Phase 1 bridge:
// - playerId: stable identity (unbounded, token-stable)
// - controlSlot: engine control lane (1..4), 0 = limbo/spectator
// ------------------------------------------------------------
const CONTROL_SLOTS = 4;

// ------------------------------------------------------------
// Server config
// ------------------------------------------------------------
const PORT = Number(process.env.GAME_WS_PORT || 8080);
const HOST = process.env.GAME_HOST || "0.0.0.0";
const SAVE_DIR = path.resolve("saves");
const HERO_ASSETS_DIR = path.resolve("assets", "heroes");
const PROFILE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const wss = new WebSocketServer({ port: PORT, host: HOST });

console.log("==================================================");
console.log("[server] *** MULTIPLAYER SERVER STARTED ***");
console.log("[server] PID:", process.pid);
console.log(`[server] Listening on ws://${HOST}:${PORT}`);
console.log("==================================================");

// Global crash reporting (so the process doesn't die silently)
process.on("uncaughtException", (err) => {
  console.error("[server] UNCAUGHT EXCEPTION", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (err) => {
  console.error("[server] UNHANDLED REJECTION", err && err.stack ? err.stack : err);
});

// ============================================================
// State
// ============================================================

// Sockets that connected but have not HELLO-bound yet
const pending = new Set(); // Set<WebSocket>

// Active bound clients (HELLO complete)
const clients = new Map(); // Map<WebSocket, { playerId:number, token:string }>

// Token ↔ socket
const tokenToWs = new Map(); // Map<string, WebSocket>
const wsToToken = new Map(); // Map<WebSocket, string>

// Identity + slot
const tokenToPlayerId = new Map();     // Map<string, number>
const tokenToControlSlot = new Map();  // Map<string, number> (0|1..CONTROL_SLOTS)
const tokenToProfile = new Map();      // Map<string, string>
const profileToToken = new Map();      // Map<string, string> (authoritative owner of a profile)

// For allocating new identity playerIds
let nextPlayerId = 1;

// Host lease
let hostToken = null;       // string|null
let hostLeaseUntilMs = 0;   // number
let hostLeaseTimer = null;  // NodeJS.Timeout|null

// ============================================================
// UI command routing (follower -> host)
// ============================================================

// Cached last tilemap for late joiners
let lastTilemapMsg = null;

// Allowed profiles derived from hero sprite assets
const allowedProfiles = new Set();

// ============================================================
// Utilities
// ============================================================

function wsStateName(ws) {
  if (!ws) return "null";
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return "CONNECTING";
    case WebSocket.OPEN: return "OPEN";
    case WebSocket.CLOSING: return "CLOSING";
    case WebSocket.CLOSED: return "CLOSED";
    default: return String(ws.readyState);
  }
}

function parseJsonOrNull(data) {
  try {
    return JSON.parse(data.toString());
  } catch (_e) {
    return null;
  }
}

function sendJson(ws, obj) {
  try {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  } catch (_e) {
    // ignore
  }
}

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const ws of clients.keys()) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(s);
    } catch (_e) {
      // ignore
    }
  }
}

function broadcastExcept(exceptWs, obj) {
  const s = JSON.stringify(obj);
  for (const ws of clients.keys()) {
    if (ws === exceptWs) continue;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(s);
    } catch (_e) {
      // ignore
    }
  }
}

function sendToPlayerId(playerId, obj) {
  const pid = playerId | 0;
  if (pid <= 0) return;
  for (const [ws, info] of clients.entries()) {
    if ((info.playerId | 0) === pid) {
      sendJson(ws, obj);
      return;
    }
  }
}

function dumpClients(tag) {
  const rows = Array.from(clients.entries()).map(([ws, info]) => ({
    playerId: info.playerId,
    controlSlot: tokenToControlSlot.get(info.token) ?? 0,
    token: (info.token || "").slice(0, 8) + "…",
    state: ws.readyState
  }));
  console.log(`[server] clients(${tag})`, rows, {
    hostToken: hostToken ? hostToken.slice(0, 8) + "…" : null,
    hostLeaseUntilMs,
    now: Date.now()
  });
}

// ============================================================
// Allocation (Phase 1 bridge)
// ============================================================

function allocateIdentityPlayerId() {
  return nextPlayerId++;
}

function allocateControlSlotIfAvailable() {
  const used = new Set();
  for (const s of tokenToControlSlot.values()) {
    const slot = s | 0;
    if (slot >= 1 && slot <= CONTROL_SLOTS) used.add(slot);
  }
  for (let slot = 1; slot <= CONTROL_SLOTS; slot++) {
    if (!used.has(slot)) return slot;
  }
  return 0; // limbo
}

// ============================================================
// Roster + deltas
// ============================================================

function broadcastPlayerState(playerId, token, connected) {
  const controlSlot = token ? (tokenToControlSlot.get(token) || 0) : 0;
  const profile = token ? (tokenToProfile.get(token) || null) : null;

  broadcast({
    type: "playerState",
    playerId: playerId | 0,
    token: token || null,
    connected: !!connected,
    controlSlot,
    profile
  });
}

function buildRosterSnapshot() {
  // Include ALL known tokens (not just connected), sorted by playerId for stability
  const players = Array.from(tokenToPlayerId.entries())
    .map(([token, playerId]) => ({
      playerId: playerId | 0,
      token,
      profile: tokenToProfile.get(token) || null,
      connected: !!(tokenToWs.get(token) && clients.has(tokenToWs.get(token))),
      controlSlot: tokenToControlSlot.get(token) || 0
    }))
    .sort((a, b) => a.playerId - b.playerId);

  return {
    type: "rosterSnapshot",
    hostToken: hostToken || null,
    hostLeaseUntilMs: hostLeaseUntilMs | 0,
    players
  };
}

function broadcastRosterSnapshot() {
  broadcast(buildRosterSnapshot());
}

// ============================================================
// Host lease / selection
// ============================================================

function _clearHostLeaseTimer() {
  if (hostLeaseTimer) {
    clearTimeout(hostLeaseTimer);
    hostLeaseTimer = null;
  }
}

function _armHostLeaseTimer() {
  _clearHostLeaseTimer();
  const ms = Math.max(0, hostLeaseUntilMs - Date.now());
  if (ms <= 0) return;

  hostLeaseTimer = setTimeout(() => {
    hostLeaseTimer = null;
    recomputeHostAndBroadcast();
  }, ms);
}

function chooseFallbackHostWs() {
  const entries = Array.from(clients.entries()); // [ [ws, {playerId, token}], ... ]
  if (entries.length === 0) return null;

  let bestWs = null;
  let bestPid = Infinity;

  for (const [ws, info] of entries) {
    const pid = info.playerId | 0;
    if (pid < bestPid) {
      bestPid = pid;
      bestWs = ws;
    }
  }

  return bestWs;
}

function getHostWsLeased() {
  const now = Date.now();

  // If we have a sticky hostToken and it is connected, it is host.
  if (hostToken) {
    const hostWs = tokenToWs.get(hostToken) || null;
    if (hostWs && clients.has(hostWs)) {
      hostLeaseUntilMs = 0;
      _clearHostLeaseTimer();
      return hostWs;
    }

    // Host absent: if lease active, no host.
    if (hostLeaseUntilMs > now) return null;

    // Lease expired: allow fallback selection.
    hostToken = null;
    hostLeaseUntilMs = 0;
    _clearHostLeaseTimer();
  }

  // No hostToken: pick fallback by lowest playerId among connected
  const fallbackWs = chooseFallbackHostWs();
  if (!fallbackWs) return null;

  const info = clients.get(fallbackWs) || null;
  hostToken = info ? info.token : null;
  return fallbackWs;
}

function broadcastHostStatus(hostWs) {
  // hostPlayerId is informational (client may log it)
  const hostInfo = hostWs ? (clients.get(hostWs) || null) : null;
  const hostPlayerId = hostInfo ? (hostInfo.playerId | 0) : null;

  for (const [ws] of clients.entries()) {
    sendJson(ws, {
      type: "hostStatus",
      isHost: (hostWs != null) ? (ws === hostWs) : false,
      hostPlayerId
    });
  }
}

function recomputeHostAndBroadcast() {
  const hostWs = getHostWsLeased();
  broadcastHostStatus(hostWs);

  if (DEBUG_NET) {
    console.log("[server] host recompute", {
      hostToken: hostToken ? hostToken.slice(0, 8) + "…" : null,
      hostLeaseUntilMs,
      hostExists: !!hostWs
    });
  }

  // After host changes or lease state changes, converge everyone
  broadcastRosterSnapshot();
}

// ============================================================
// HELLO binding (token identity)
// ============================================================

function bindHello(ws, msg) {
  const token = (msg && typeof msg.token === "string") ? msg.token.trim() : "";
  if (!token || token.length < 8) {
    console.warn("[server] HELLO missing/invalid token; closing");
    ws.close(1008, "Invalid token");
    return;
  }

  // Normalize + validate desired profile (trim only; keep case as provided)
  const desiredProfileRaw = (msg && typeof msg.desiredProfile === "string") ? msg.desiredProfile.trim() : "";
  const desiredProfile = desiredProfileRaw || null;

  if (!desiredProfile) {
    console.warn("[server] HELLO missing profile; closing");
    sendJson(ws, { type: "helloError", reason: "missingProfile" });
    ws.close(1008, "Profile required");
    return;
  }

  // If this token already has a live socket, replace it (refresh-safe).
  const oldWs = tokenToWs.get(token);
  if (oldWs && oldWs !== ws) {
    try {
      console.log("[server] HELLO token rebind; closing old ws for token", token.slice(0, 8) + "…");
      oldWs.close(4000, "Replaced by reconnect");
    } catch (_e) {
      // ignore
    }
    // Cleanup old socket mapping immediately (close event will also run)
    clients.delete(oldWs);
    wsToToken.delete(oldWs);
    pending.delete(oldWs);
    if (tokenToWs.get(token) === oldWs) tokenToWs.delete(token);
  }

  // Allocate identity if first time token seen
  let playerId = tokenToPlayerId.get(token) || null;
  if (playerId == null) {
    playerId = allocateIdentityPlayerId();
    tokenToPlayerId.set(token, playerId);

    // Allocate control slot (Phase 1: max 4)
    const slot = allocateControlSlotIfAvailable();
    tokenToControlSlot.set(token, slot);
  } else {
    // Ensure controlSlot exists even if older saved state is missing it
    if (!tokenToControlSlot.has(token)) {
      tokenToControlSlot.set(token, allocateControlSlotIfAvailable());
    }
  }

  // Determine profile for this token (client is authoritative)
  const existingProfile = tokenToProfile.get(token) || null;
  const profile = desiredProfile || null;

  // Validate profile against assets
  if (profile && !allowedProfiles.has(profile)) {
    console.warn("[server] HELLO rejected: profile not found in assets", profile, "allowed:", Array.from(allowedProfiles).sort());
    sendJson(ws, { type: "helloError", reason: "profileUnknown", profile, allowed: Array.from(allowedProfiles) });
    return;
  }

  // Enforce "only one of each profile"
  if (profile) {
    const ownerTok = profileToToken.get(profile);
    if (ownerTok && ownerTok !== token) {
      console.warn("[server] HELLO rejected: profile already in use", {
        profile,
        existingOwnerToken: ownerTok.slice(0, 8) + "…",
        incomingToken: token.slice(0, 8) + "…"
      });
      sendJson(ws, { type: "helloError", reason: "profileInUse", profile });
      ws.close(1008, "Profile already in use");
      return;
    }
  }

  // Release old profile ownership if this token is switching profiles
  if (existingProfile && existingProfile !== profile) {
    if (profileToToken.get(existingProfile) === token) {
      profileToToken.delete(existingProfile);
    }
    console.warn("[server.identity] token profile override", {
      token: token.slice(0, 8) + "…",
      from: existingProfile,
      to: profile
    });
  }

  // Claim ownership (idempotent for same token)
  if (profile) {
    profileToToken.set(profile, token);
    tokenToProfile.set(token, profile);
  }

  pending.delete(ws);

  tokenToWs.set(token, ws);
  wsToToken.set(ws, token);
  clients.set(ws, { playerId: playerId | 0, token });

  // If no hostToken yet, first HELLO becomes sticky host
  if (!hostToken) {
    hostToken = token;
    hostLeaseUntilMs = 0;
    _clearHostLeaseTimer();
    console.log("[server] hostToken initialized to", hostToken.slice(0, 8) + "…");
  }

  // If the host reconnects during lease, resume immediately
  if (hostToken === token) {
    hostLeaseUntilMs = 0;
    _clearHostLeaseTimer();
  }

  const profileNow = tokenToProfile.get(token) || null;
  const controlSlot = tokenToControlSlot.get(token) || 0;
  const name = `Player${playerId}`;

  console.log(
    "[server] HELLO bound token",
    token.slice(0, 8) + "…",
    "-> playerId",
    playerId,
    "controlSlot",
    controlSlot,
    "profile=",
    profileNow
  );

  console.log(
    "[server.identity]",
    (existingProfile ? "WELCOME_BACK" : "WELCOME"),
    "profile=",
    profileNow,
    "playerId=",
    playerId,
    "token=",
    token.slice(0, 8) + "…",
    "controlSlot=",
    controlSlot
  );

  // Send assign (includes optional fields; clients can ignore what they don't use)
  sendJson(ws, { type: "assign", playerId, name, token, profile: profileNow, controlSlot });

  // Send authoritative roster snapshot immediately (Step 10)
  sendJson(ws, buildRosterSnapshot());

  // Replay tilemap to late joiners
  if (lastTilemapMsg) {
    sendJson(ws, lastTilemapMsg);
    if (DEBUG_TILEMAP) {
      console.log("[server] replayed cached tilemap to playerId =", playerId, "rev =", lastTilemapMsg.rev);
    }
  }

  // Broadcast delta connected=true (Step 4)
  broadcastPlayerState(playerId, token, true);

  dumpClients("after HELLO");
  recomputeHostAndBroadcast();
}

// ============================================================
// Message handlers
// ============================================================

function handleInputMessage(ws, info, msg) {
  if (typeof msg.button !== "string" || typeof msg.pressed !== "boolean") {
    console.warn("[server] malformed input from playerId", info.playerId, ":", msg);
    return;
  }

  // Enforce identity playerId
  msg.playerId = info.playerId;

  // Attach controlSlot for Phase 1 routing (host may use it)
  msg.controlSlot = tokenToControlSlot.get(info.token) || 0;
  // Attach authoritative profile for host-side input routing
  msg.profile = tokenToProfile.get(info.token) || null;

  if (DEBUG_NET) {
    const nowServer = Date.now();
    if (typeof msg.sentWallMs === "number") {
      const delay = nowServer - msg.sentWallMs;
      const seq = (typeof msg.inputSeq === "number") ? msg.inputSeq : -1;

      if (delay > SERVER_LAG_HARD_MS) {
        console.warn("[serverLag] HARD", "| seq=", seq, "| player=", info.playerId, "| client→server≈", delay.toFixed(1), "ms");
      } else if (delay > SERVER_LAG_WARN_MS) {
        console.warn("[serverLag] WARN", "| seq=", seq, "| player=", info.playerId, "| client→server≈", delay.toFixed(1), "ms");
      }
      msg.serverRecvAt = nowServer;
      msg.serverSentAt = Date.now();
    }
  }

  broadcast(msg);
}

function handleUiCommand(ws, info, msg) {
  const requestId = (msg && typeof msg.requestId === "string") ? msg.requestId : "";
  if (!requestId) {
    console.warn("[server] uiCommand missing requestId from playerId", info.playerId);
    return;
  }

  const hostWs = getHostWsLeased();
  if (!hostWs) {
    sendJson(ws, {
      type: "uiCommandResult",
      requestId,
      playerId: info.playerId,
      ok: false,
      reason: "no-host",
      snapshot: null,
    });
    return;
  }

  const payload = {
    type: "uiCommandForward",
    requestId,
    fromToken: info.token,
    playerId: (typeof msg.playerId === "number") ? (msg.playerId | 0) : (info.playerId | 0),
    cmd: msg.cmd || msg.payload || null,
  };

  sendJson(hostWs, payload);
}

function handleBlocklyXmlMessage(ws, info, msg) {
  const xml = (msg && typeof msg.xml === "string") ? msg.xml : "";
  if (!xml || !xml.trim()) return;

  // Enforce profile ownership from HELLO identity
  const profile = tokenToProfile.get(info.token) || null;
  if (!profile) return;

  const payload = {
    type: "blocklyXml",
    playerId: info.playerId | 0,
    profile,
    xml
  };

  // Broadcast to all so host + followers stay in sync
  broadcast(payload);
}

function handleUiCommandResult(ws, info, msg) {
  const requestId = (msg && typeof msg.requestId === "string") ? msg.requestId : "";
  const toToken = (msg && typeof msg.toToken === "string") ? msg.toToken : "";
  if (!requestId || !toToken) return;

  const targetWs = tokenToWs.get(toToken) || null;
  if (!targetWs) return;

  const payload = {
    type: "uiCommandResult",
    requestId,
    playerId: (typeof msg.playerId === "number") ? (msg.playerId | 0) : null,
    ok: !!msg.ok,
    reason: (typeof msg.reason === "string") ? msg.reason : null,
    snapshot: msg.snapshot ?? null,
  };

  sendJson(targetWs, payload);
}

function handleDialogMessage(ws, info, msg) {
  const hostWs = getHostWsLeased();
  if (!hostWs) return;
  if (ws !== hostWs) return;

  const action = (msg && typeof msg.action === "string") ? msg.action : "";
  if (action !== "show" && action !== "hide") return;

  const payload = {
    type: "dialog",
    action,
    dialog: msg.dialog ?? null,
    targetPlayerId: (typeof msg.targetPlayerId === "number") ? (msg.targetPlayerId | 0) : null
  };

  if ((payload.targetPlayerId | 0) > 0) {
    sendToPlayerId(payload.targetPlayerId, payload);
    return;
  }

  // Host already showed the dialog locally; send to everyone else.
  broadcastExcept(hostWs, payload);
}

function handleStateMessage(ws, info, msg) {
  // Only current host can broadcast world snapshots
  const hostWs = getHostWsLeased();
  if (!hostWs) return;

  if (ws !== hostWs) {
    if (DEBUG_NET) console.warn("[server] non-host tried to send state; ignoring. playerId =", info.playerId);
    return;
  }
  if (!msg.snapshot) {
    console.warn("[server] state message missing snapshot from host");
    return;
  }

  msg.playerId = info.playerId;
  msg.serverSentAt = Date.now();
  broadcast(msg);
}

function handleTilemapMessage(ws, info, msg) {
  // Only current host can broadcast tilemap
  const hostWs = getHostWsLeased();
  if (!hostWs) return;

  if (ws !== hostWs) {
    if (DEBUG_TILEMAP) {
      console.warn("[server] non-host tried to send tilemap; ignoring. playerId =", info.playerId);
    }
    return;
  }

  // Normalize possible field names (data vs grid)
  if (!msg.data && Array.isArray(msg.grid)) {
    msg.data = msg.grid;
  }

  if (typeof msg.encoding !== "string") {
    msg.encoding = "raw";
  }

  const malformed =
    typeof msg.rev !== "number" ||
    typeof msg.tileSize !== "number" ||
    typeof msg.rows !== "number" ||
    typeof msg.cols !== "number" ||
    !msg.data;

  if (malformed) {
    console.warn("[server] malformed tilemap from host:", {
      rev: msg.rev,
      rows: msg.rows,
      cols: msg.cols,
      tileSize: msg.tileSize,
      encoding: msg.encoding,
      hasData: !!msg.data,
      hasGrid: !!msg.grid
    });
    return;
  }

  // Cache and broadcast
  lastTilemapMsg = msg;
  if (msg.decor) {
    const props = Array.isArray(msg.decor.props) ? msg.decor.props.length : 0;
    const decals = Array.isArray(msg.decor.decals) ? msg.decor.decals.length : 0;
    if (DEBUG_TILEMAP) {
      console.log("[server] tilemap decor payload", { decorRev: msg.decor.rev ?? null, props, decalRows: decals });
    }
  }

  if (DEBUG_TILEMAP) {
    console.log("[server] cached tilemap", {
      rev: msg.rev,
      rows: msg.rows,
      cols: msg.cols,
      tileSize: msg.tileSize,
      encoding: msg.encoding
    });
  }

  broadcast(msg);
}

function sanitizeProfilesKey(profiles) {
  const key = Array.isArray(profiles)
    ? profiles.map((p) => String(p || "").trim()).filter(Boolean).join("_")
    : "";
  const sanitized = key.replace(/[^a-z0-9_-]/gi, "") || "unknown";
  return sanitized.slice(0, 64);
}

function normalizeProfilesForMatch(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .map((p) => p.toLowerCase())
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function profilesMatch(a, b) {
  const aa = normalizeProfilesForMatch(a);
  const bb = normalizeProfilesForMatch(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

function listAutosaveEntries(filterProfiles) {
  const entries = [];
  let files = [];
  try {
    files = fs.readdirSync(SAVE_DIR);
  } catch (_e) {
    return entries;
  }

  for (const f of files) {
    if (!f || typeof f !== "string") continue;
    if (!f.startsWith("autosave_") || !f.endsWith(".json")) continue;
    const full = path.join(SAVE_DIR, f);
    let raw = "";
    let stat = null;
    try {
      raw = fs.readFileSync(full, "utf8");
      stat = fs.statSync(full);
    } catch (_e) {
      continue;
    }
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch (_e) {
      payload = null;
    }
    if (!payload || payload.type !== "heroesSaveV1") continue;
    if (filterProfiles && filterProfiles.length > 0) {
      if (!profilesMatch(filterProfiles, payload.profiles || [])) continue;
    }
    const savedAt = (typeof payload.savedAt === "number") ? payload.savedAt : (stat ? stat.mtimeMs : 0);
    const floorIndex = (payload.floor && typeof payload.floor.index === "number") ? (payload.floor.index | 0) : -1;
    const floorKind = (payload.floor && typeof payload.floor.kind === "string") ? payload.floor.kind : "";
    const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
    entries.push({ file: f, savedAt, floorIndex, floorKind, profiles });
  }

  entries.sort((a, b) => {
    const ta = (typeof a.savedAt === "number") ? a.savedAt : 0;
    const tb = (typeof b.savedAt === "number") ? b.savedAt : 0;
    return tb - ta;
  });

  return entries;
}

function pruneOldSaves(prefix) {
  try {
    const files = fs.readdirSync(SAVE_DIR);
    const matched = files
      .filter((f) => f.startsWith(prefix))
      .map((f) => {
        const full = path.join(SAVE_DIR, f);
        let mtime = 0;
        try {
          mtime = fs.statSync(full).mtimeMs || 0;
        } catch (_e) {}
        return { f, full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (let i = 3; i < matched.length; i++) {
      try { fs.unlinkSync(matched[i].full); } catch (_e) {}
    }
  } catch (e) {
    console.warn("[server.save] prune failed", e);
  }
}

function loadAllowedProfilesFromAssets() {
  allowedProfiles.clear();
  try {
    const files = fs.readdirSync(HERO_ASSETS_DIR);
    for (const f of files) {
      if (!f || typeof f !== "string") continue;
      if (!f.toLowerCase().endsWith(".png")) continue;
      const m = f.match(/^(.+?)Hero\.png$/i);
      if (!m || !m[1]) continue;
      const prof = m[1].trim();
      if (prof) allowedProfiles.add(prof);
    }
    console.log("[server] allowed profiles from assets:", Array.from(allowedProfiles).sort());
  } catch (e) {
    console.warn("[server] failed to load allowed profiles from assets", HERO_ASSETS_DIR, e);
  }
}

// Ensure saves directory exists (repo-local, gitignored)
try {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  console.log("[server] saves dir:", SAVE_DIR);
} catch (e) {
  console.warn("[server] could not create saves dir", SAVE_DIR, e);
}
loadAllowedProfilesFromAssets();

// Live reload allowed profiles when hero assets change (no server restart needed)
let _profileWatchTimer = null;
function _scheduleAllowedProfilesReload(reason, filename) {
  if (_profileWatchTimer) clearTimeout(_profileWatchTimer);
  _profileWatchTimer = setTimeout(() => {
    _profileWatchTimer = null;
    loadAllowedProfilesFromAssets();
    if (filename) {
      console.log("[server] profiles reloaded (assets changed)", { reason, file: filename });
    } else {
      console.log("[server] profiles reloaded (assets changed)", { reason });
    }
  }, 200);
}
try {
  fs.watch(HERO_ASSETS_DIR, { persistent: false }, (eventType, filename) => {
    const name = filename ? String(filename) : "";
    if (!name || !name.toLowerCase().endsWith(".png")) return;
    if (!/Hero\.png$/i.test(name)) return;
    _scheduleAllowedProfilesReload(eventType || "change", name);
  });
  console.log("[server] watching hero assets for profile updates");
} catch (e) {
  console.warn("[server] failed to watch hero assets for updates", e);
}

// ============================================================
// Profile upload (new hero sheet)
// ============================================================
let profileUploadInFlight = false;

function isValidProfileName(name) {
  if (!name) return false;
  return /^[A-Za-z0-9_-]{1,32}$/.test(name);
}

function _decodeBase64Payload(msg) {
  const base64 = (msg && typeof msg.base64 === "string") ? msg.base64.trim() : "";
  if (base64) return base64;
  const dataUrl = (msg && typeof msg.dataUrl === "string") ? msg.dataUrl.trim() : "";
  if (!dataUrl) return "";
  const comma = dataUrl.indexOf(",");
  if (comma >= 0) return dataUrl.slice(comma + 1).trim();
  return "";
}

function _isPngSignature(buf) {
  if (!buf || buf.length < 24) return false;
  return (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function _readPngSize(buf) {
  if (!_isPngSignature(buf)) return { width: 0, height: 0 };
  // IHDR chunk starts at byte 8+4+4; width/height at offsets 16/20
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function _runAuraGenForFile(filePath) {
  return new Promise((resolve, reject) => {
    const script = path.resolve("scripts", "genheroauras.mjs");
    const child = spawn(process.execPath, [script, "--file", filePath], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error("gen-auras exit " + code));
    });
  });
}

async function handleProfileUpload(ws, msg) {
  const requestId = (msg && typeof msg.requestId === "string") ? msg.requestId : "";
  if (!requestId) return;

  const profile = (msg && typeof msg.profile === "string") ? msg.profile.trim() : "";
  if (!profile) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "no-profile" });
    return;
  }
  if (!isValidProfileName(profile)) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "invalid-profile", profile });
    return;
  }
  if (allowedProfiles.has(profile)) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "profile-exists", profile });
    return;
  }
  if (profileUploadInFlight) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "busy", profile });
    return;
  }

  const b64 = _decodeBase64Payload(msg);
  if (!b64) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "no-data", profile });
    return;
  }

  let buf = null;
  try {
    buf = Buffer.from(b64, "base64");
  } catch (_e) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "bad-base64", profile });
    return;
  }
  if (!buf || buf.length <= 0) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "empty-file", profile });
    return;
  }
  if (buf.length > PROFILE_UPLOAD_MAX_BYTES) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "too-large", profile });
    return;
  }
  if (!_isPngSignature(buf)) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "not-png", profile });
    return;
  }
  const { width, height } = _readPngSize(buf);
  if (!width || !height || (width % 64) !== 0 || (height % 64) !== 0) {
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "invalid-sheet-size", profile });
    return;
  }

  profileUploadInFlight = true;
  const fileName = `${profile}Hero.png`;
  const dest = path.join(HERO_ASSETS_DIR, fileName);
  try {
    fs.mkdirSync(HERO_ASSETS_DIR, { recursive: true });
    fs.writeFileSync(dest, buf);
  } catch (e) {
    profileUploadInFlight = false;
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "write-failed", profile });
    return;
  }

  console.log("[server] profile upload saved", { profile, file: dest, bytes: buf.length });
  try {
    await _runAuraGenForFile(dest);
  } catch (e) {
    try { fs.unlinkSync(dest); } catch (_e2) {}
    profileUploadInFlight = false;
    console.warn("[server] aura generation failed for profile", profile, e);
    sendJson(ws, { type: "profileUploadResult", requestId, ok: false, reason: "aura-failed", profile });
    return;
  }

  loadAllowedProfilesFromAssets();
  profileUploadInFlight = false;
  sendJson(ws, { type: "profileUploadResult", requestId, ok: true, reason: "ok", profile });
}

function writeSaveFile(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid payload");
  }

  const profilesKey = sanitizeProfilesKey(payload.profiles);
  const ts = new Date();
  const timestamp = ts.toISOString().replace(/[:.]/g, "").replace("T", "_").replace("Z", "");
  const fname = `autosave_${profilesKey}_${timestamp}.json`;
  const full = path.join(SAVE_DIR, fname);

  const toWrite = JSON.stringify(payload, null, 2);
  fs.writeFileSync(full, toWrite, "utf8");
  pruneOldSaves(`autosave_${profilesKey}_`);

  console.log("[server.save] wrote", full, "bytes=", toWrite.length);
}

function handleSaveGameMessage(ws, info, msg) {
  const hostWs = getHostWsLeased();
  if (!hostWs || ws !== hostWs) return;

  if (!msg.payload) {
    console.warn("[server.save] missing payload");
    return;
  }

  try {
    writeSaveFile(msg.payload);
  } catch (e) {
    console.warn("[server.save] write failed", e);
  }
}

function handleSaveListRequest(ws, info, msg) {
  const hostWs = getHostWsLeased();
  if (!hostWs || ws !== hostWs) return;

  const requestId = (msg && typeof msg.requestId === "string") ? msg.requestId : "";
  if (!requestId) return;

  const filterProfiles = Array.isArray(msg.profiles) ? msg.profiles : null;
  const entries = listAutosaveEntries(filterProfiles);

  sendJson(ws, { type: "saveList", requestId, entries });
}

function handleSaveLoadRequest(ws, info, msg) {
  const hostWs = getHostWsLeased();
  if (!hostWs || ws !== hostWs) return;

  const requestId = (msg && typeof msg.requestId === "string") ? msg.requestId : "";
  const file = (msg && typeof msg.file === "string") ? msg.file : "";
  if (!requestId) return;

  if (!file || !file.startsWith("autosave_") || !file.endsWith(".json") || file.includes("..") || file.includes("/") || file.includes("\\")) {
    sendJson(ws, { type: "saveLoad", requestId, error: "invalid-file" });
    return;
  }

  const full = path.join(SAVE_DIR, file);
  if (!full.startsWith(SAVE_DIR)) {
    sendJson(ws, { type: "saveLoad", requestId, error: "invalid-path" });
    return;
  }

  try {
    const raw = fs.readFileSync(full, "utf8");
    const payload = JSON.parse(raw);
    sendJson(ws, { type: "saveLoad", requestId, payload });
  } catch (e) {
    console.warn("[server.save] load failed", e);
    sendJson(ws, { type: "saveLoad", requestId, error: "load-failed" });
  }
}


function handleCoinBurstMessage(ws, info, msg) {
  const hostWs = getHostWsLeased();
  if (!hostWs) return;
  if (ws !== hostWs) return;

  const burstsIn = Array.isArray(msg.bursts) ? msg.bursts : null;
  if (!burstsIn || burstsIn.length === 0) return;

  const bursts = [];
  for (let i = 0; i < burstsIn.length && i < 64; i++) {
    const b = burstsIn[i];
    if (!b) continue;
    const x = (typeof b.x === "number") ? b.x : NaN;
    const y = (typeof b.y === "number") ? b.y : NaN;
    const count = (typeof b.count === "number") ? (b.count | 0) : 0;
    const pid = (typeof b.pid === "number") ? (b.pid | 0) : 0;

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (count <= 0) continue;

    bursts.push({ x, y, count, pid });
  }

  if (bursts.length === 0) return;

  msg.playerId = info.playerId;
  msg.bursts = bursts;
  msg.serverSentAt = Date.now();
  broadcast(msg);
}


// ============================================================
// Socket lifecycle
// ============================================================

function onSocketMessage(ws, data) {
  const msg = parseJsonOrNull(data);
  if (!msg || typeof msg.type !== "string") {
    console.warn("[server] invalid/malformed JSON:", data.toString());
    return;
  }

  // Profile upload is allowed before HELLO (for missing profiles)
  if (msg.type === "profileUpload") {
    handleProfileUpload(ws, msg).catch((e) => {
      console.warn("[server] profile upload failed", e);
    });
    return;
  }

  // HELLO binding must happen before any other messages
  if (msg.type === "hello") {
    bindHello(ws, msg);
    return;
  }

  const info = clients.get(ws) || null;
  if (!info) {
    // Ignore pre-HELLO chatter from pending sockets
    if (pending.has(ws)) return;

    console.warn("[server] got message from unbound socket; closing");
    try { ws.close(1008, "Must HELLO first"); } catch (_e) {}
    return;
  }

  if (msg.type === "coinBurst") return handleCoinBurstMessage(ws, info, msg);
  if (msg.type === "input") return handleInputMessage(ws, info, msg);
  if (msg.type === "uiCommand") return handleUiCommand(ws, info, msg);
  if (msg.type === "uiCommandResult") return handleUiCommandResult(ws, info, msg);
  if (msg.type === "blocklyXml") return handleBlocklyXmlMessage(ws, info, msg);
  if (msg.type === "dialog") return handleDialogMessage(ws, info, msg);
  if (msg.type === "state") return handleStateMessage(ws, info, msg);
  if (msg.type === "tilemap") return handleTilemapMessage(ws, info, msg);
  if (msg.type === "saveGame") return handleSaveGameMessage(ws, info, msg);
  if (msg.type === "saveListRequest") return handleSaveListRequest(ws, info, msg);
  if (msg.type === "saveLoadRequest") return handleSaveLoadRequest(ws, info, msg);

  // Unknown message types are ignored for forward-compat
}

function onSocketClose(ws, code, reason) {
  pending.delete(ws);

  const info = clients.get(ws) || null;
  clients.delete(ws);

  const token = wsToToken.get(ws) || null;
  wsToToken.delete(ws);

  // If this ws is being closed because it's replaced by reconnect,
  // do NOT trigger host lease pause.
  const isReplacedByReconnect = (code === 4000);

  if (token) {
    const cur = tokenToWs.get(token);
    if (cur === ws) tokenToWs.delete(token);

    // Release profile ownership if no live socket for this token
    const prof = tokenToProfile.get(token) || null;
    if (prof && profileToToken.get(prof) === token && !tokenToWs.has(token)) {
      // Keep token→profile so reconnects retain identity; only release ownership map
      profileToToken.delete(prof);
    }

    console.log(
      "[server] disconnected token",
      token.slice(0, 8) + "…",
      "playerId",
      info ? info.playerId : null,
      "code",
      code,
      reason ? reason.toString() : ""
    );

    // Broadcast disconnected state (do NOT delete token->playerId mapping)
    if (info && info.playerId != null) {
      broadcastPlayerState(info.playerId, token, false);
    }

    // Start host lease only on true disconnect (not replacement)
    if (!isReplacedByReconnect && hostToken && token === hostToken) {
      hostLeaseUntilMs = Date.now() + HOST_LEASE_MS;
      console.log("[server] host disconnected -> starting lease until", hostLeaseUntilMs);
      _armHostLeaseTimer();
    }
  } else {
    console.log("[server] disconnected unbound socket");
  }

  dumpClients("after close");

  // Host selection + converge (also broadcasts roster snapshot)
  recomputeHostAndBroadcast();

  // Step 10.5 convergence on disconnect is already handled by recomputeHostAndBroadcast()
}

function acceptConnection(ws) {
  const sock = ws && ws._socket;
  const remote = sock ? `${sock.remoteAddress || "?"}:${sock.remotePort || "?"}` : "?";
  console.log("[server] new client connecting...", remote);
  pending.add(ws);

  ws.on("message", (data) => onSocketMessage(ws, data));
  ws.on("close", (code, reason) => onSocketClose(ws, code, reason));
  ws.on("error", (err) => {
    const info = clients.get(ws) || null;
    const token = info ? info.token : (wsToToken.get(ws) || null);
    console.warn(
      "[server] ws error",
      info ? `(playerId ${info.playerId})` : "(unbound)",
      token ? `token=${token.slice(0, 8)}…` : "",
      "state=" + wsStateName(ws),
      err && err.stack ? err.stack : err
    );
  });
}

// ============================================================
// Entry
// ============================================================

wss.on("connection", (ws, req) => {
  const remote = req?.socket ? `${req.socket.remoteAddress || "?"}:${req.socket.remotePort || "?"}` : "?";
  console.log("[server] connection established", remote);
  acceptConnection(ws);
});

wss.on("error", (err) => {
  console.error("[server] wss error", err && err.stack ? err.stack : err);
});

wss.on("close", () => {
  console.warn("[server] WebSocketServer closed");
});
