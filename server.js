// server.js (ESM version, compatible with "type": "module")
import WebSocket, { WebSocketServer } from "ws";

// ------------------------------------------------------------
// Debug / logging
// ------------------------------------------------------------
const SERVER_LAG_WARN_MS = 30;
const SERVER_LAG_HARD_MS = 100;

const DEBUG_NET = false;
const DEBUG_TILEMAP = true;

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
const PORT = 8080;
const HOST = "0.0.0.0";

const wss = new WebSocketServer({ port: PORT, host: HOST });

console.log("==================================================");
console.log("[server] *** MULTIPLAYER SERVER STARTED ***");
console.log("[server] PID:", process.pid);
console.log(`[server] Listening on ws://${HOST}:${PORT}`);
console.log("==================================================");

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

// For allocating new identity playerIds
let nextPlayerId = 1;

// Host lease
let hostToken = null;       // string|null
let hostLeaseUntilMs = 0;   // number
let hostLeaseTimer = null;  // NodeJS.Timeout|null

// Cached last tilemap for late joiners
let lastTilemapMsg = null;

// ============================================================
// Utilities
// ============================================================

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

  // Store desired profile if provided
  if (typeof msg.desiredProfile === "string") {
    const p = msg.desiredProfile.trim();
    if (p) tokenToProfile.set(token, p);
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

  const profile = tokenToProfile.get(token) || null;
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
    profile
  );

  // Send assign (includes optional fields; clients can ignore what they don't use)
  sendJson(ws, { type: "assign", playerId, name, token, profile, controlSlot });

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

  if (
    typeof msg.rev !== "number" ||
    typeof msg.tileSize !== "number" ||
    typeof msg.rows !== "number" ||
    typeof msg.cols !== "number" ||
    typeof msg.encoding !== "string"
  ) {
    console.warn("[server] malformed tilemap from host:", msg);
    return;
  }

  // Cache and broadcast
  lastTilemapMsg = msg;

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

// ============================================================
// Socket lifecycle
// ============================================================

function onSocketMessage(ws, data) {
  const msg = parseJsonOrNull(data);
  if (!msg || typeof msg.type !== "string") {
    console.warn("[server] invalid/malformed JSON:", data.toString());
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

  if (msg.type === "input") return handleInputMessage(ws, info, msg);
  if (msg.type === "state") return handleStateMessage(ws, info, msg);
  if (msg.type === "tilemap") return handleTilemapMessage(ws, info, msg);

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
  console.log("[server] new client connecting...");
  pending.add(ws);

  ws.on("message", (data) => onSocketMessage(ws, data));
  ws.on("close", (code, reason) => onSocketClose(ws, code, reason));
  ws.on("error", (err) => {
    const info = clients.get(ws) || null;
    console.warn("[server] ws error", info ? `(playerId ${info.playerId})` : "(unbound)", err);
  });
}

// ============================================================
// Entry
// ============================================================

wss.on("connection", (ws) => {
  acceptConnection(ws);
});
