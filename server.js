// server.js (ESM version, compatible with "type": "module")
import WebSocket, { WebSocketServer } from "ws";

// ------------------------------------------------------------
// Debug / logging
// ------------------------------------------------------------
const SERVER_LAG_WARN_MS = 30;   // warn when client→server delay > 30ms
const SERVER_LAG_HARD_MS = 100;  // big warning > 100ms

const DEBUG_NET = false;
const DEBUG_TILEMAP = true;

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

// =====================================================================================
// TODO_NPLAYER_BRIDGE
// TEMPORARY CAP + HOST SELECTION MODEL
// - MAX_PLAYERS is an artificial cap that will be removed when we implement token->playerId.
// - Host is currently defined as "first connected ws in the Map insertion order".
// =====================================================================================
const MAX_PLAYERS = 4;

// Map WebSocket -> playerId
/** @type {Map<WebSocket, number>} */
const clients = new Map();

// Cached most-recent full tilemap message (set by host)
let lastTilemapMsg = null;

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------
function dumpClients(tag) {
    const entries = Array.from(clients.entries()).map(([ws, pid], idx) => ({
        idx,
        playerId: pid,
        readyState: ws.readyState
    }));
    console.log(`[server] dumpClients(${tag}) ->`, entries);
}

function sendJson(ws, msg, pidForLog = null, tag = "") {
    if (ws.readyState !== WebSocket.OPEN) return false;
    try {
        ws.send(JSON.stringify(msg));
        return true;
    } catch (e) {
        const pidPart = pidForLog != null ? ` playerId ${pidForLog}` : "";
        const tagPart = tag ? ` (${tag})` : "";
        console.warn(`[server] failed to send${tagPart} to${pidPart}:`, e);
        return false;
    }
}

function broadcast(msg, exceptWs = null) {
    const json = JSON.stringify(msg);
    for (const [ws, pid] of clients.entries()) {
        if (ws === exceptWs) continue;
        if (ws.readyState !== WebSocket.OPEN) continue;

        try {
            ws.send(json);
        } catch (e) {
            console.warn("[server] failed to broadcast to playerId", pid, ":", e);
        }
    }
}

// ------------------------------------------------------------
// PlayerId allocation (temporary capped)
// ------------------------------------------------------------
function allocatePlayerIdCapped() {
    // TODO_NPLAYER_BRIDGE: remove cap; switch to token->playerId mapping.
    const used = new Set(clients.values());
    for (let pid = 1; pid <= MAX_PLAYERS; pid++) {
        if (!used.has(pid)) return pid;
    }
    return null;
}

// ------------------------------------------------------------
// Host selection + host status broadcast
// ------------------------------------------------------------
function getHostEntry() {
    // TODO_NPLAYER_BRIDGE: host is "first connected client" (Map insertion order).
    const entries = Array.from(clients.entries()); // [ [ws, playerId], ... ]
    if (entries.length === 0) return null;
    const [hostWs, hostPlayerId] = entries[0];
    return { entries, hostWs, hostPlayerId };
}

function recomputeHostAndBroadcast() {
    const host = getHostEntry();
    if (!host) return;

    const { entries, hostWs, hostPlayerId } = host;

    for (const [ws, pid] of entries) {
        const isHost = ws === hostWs;
        sendJson(ws, { type: "hostStatus", isHost }, pid, "hostStatus");
    }

    console.log("[server] host is now playerId =", hostPlayerId);
}

// ------------------------------------------------------------
// Per-message handlers (no behavior change)
// ------------------------------------------------------------
function handleInputMessage(ws, playerId, msg) {
    // Shape: { type: "input", playerId, button, pressed, sentAtMs?, sentWallMs?, inputSeq? }
    if (typeof msg.button !== "string" || typeof msg.pressed !== "boolean") {
        console.warn("[server] malformed input from playerId", playerId, ":", msg);
        return;
    }

    if (DEBUG_NET) {
        const nowServer = Date.now();
        if (typeof msg.sentWallMs === "number") {
            const delayCS = nowServer - msg.sentWallMs;
            const seq = typeof msg.inputSeq === "number" ? msg.inputSeq : -1;

            if (delayCS > SERVER_LAG_HARD_MS) {
                console.warn(
                    "[serverLag] HARD",
                    "| seq=", seq,
                    "| player=", playerId,
                    "| button=", msg.button,
                    "| pressed=", msg.pressed,
                    "| client→server≈", delayCS.toFixed(1), "ms",
                    "| serverWallMs=", nowServer
                );
            } else if (delayCS > SERVER_LAG_WARN_MS) {
                console.warn(
                    "[serverLag] WARN",
                    "| seq=", seq,
                    "| player=", playerId,
                    "| button=", msg.button,
                    "| pressed=", msg.pressed,
                    "| client→server≈", delayCS.toFixed(1), "ms",
                    "| serverWallMs=", nowServer
                );
            }

            msg.serverRecvAt = nowServer;
            msg.serverSentAt = Date.now();
        }
    }

    broadcast(msg);
}

function handleStateMessage(ws, playerId, msg) {
    msg.serverSentAt = Date.now();

    // Only current host can send snapshots.
    const host = getHostEntry();
    if (!host) {
        console.warn("[server] got state but no clients?");
        return;
    }
    const { hostWs } = host;
    if (ws !== hostWs) {
        console.warn("[server] non-host tried to send state; ignoring. playerId =", playerId);
        return;
    }

    if (!msg.snapshot) {
        console.warn("[server] state message missing snapshot from host");
        return;
    }

    broadcast(msg);
}

function handleTilemapMessage(ws, playerId, msg) {
    // Only current host can publish authoritative tilemap.
    const host = getHostEntry();
    if (!host) {
        if (DEBUG_TILEMAP) console.warn("[server] got tilemap but no host/clients?");
        return;
    }
    const { hostWs, hostPlayerId } = host;

    if (ws !== hostWs) {
        if (DEBUG_TILEMAP) {
            console.warn(
                "[server] non-host tried to send tilemap; ignoring. playerId =",
                playerId,
                "hostPlayerId =",
                hostPlayerId
            );
        }
        return;
    }

    // Minimal validation
    if (
        typeof msg.rev !== "number" ||
        typeof msg.tileSize !== "number" ||
        typeof msg.rows !== "number" ||
        typeof msg.cols !== "number" ||
        typeof msg.encoding !== "string"
    ) {
        console.warn("[server] malformed tilemap from host; missing fields:", msg);
        return;
    }

    if (msg.encoding === "raw") {
        if (!Array.isArray(msg.data)) {
            console.warn("[server] malformed tilemap(raw) from host; data not array:", msg);
            return;
        }
    }

    // Cache latest full tilemap for late joiners
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

    // Broadcast to everyone (including host; harmless)
    broadcast(msg);

    if (DEBUG_TILEMAP) {
        console.log("[server] broadcast tilemap rev", msg.rev);
    }
}

function parseJsonMessageOrNull(playerId, data) {
    let msg;
    try {
        msg = JSON.parse(data.toString());
    } catch (e) {
        console.warn("[server] invalid JSON from playerId", playerId, ":", data.toString());
        return null;
    }

    if (!msg || typeof msg.type !== "string") {
        console.warn("[server] malformed message from playerId", playerId, ":", msg);
        return null;
    }
    return msg;
}

// ------------------------------------------------------------
// Connection lifecycle
// ------------------------------------------------------------
function sendAssignAndReplayTilemap(ws, playerId) {
    const name = `Player${playerId}`;
    console.log("[server] client assigned playerId =", playerId, "name =", name);

    // Notify just this client of its playerId + default name
    sendJson(ws, { type: "assign", playerId, name }, playerId, "assign");

    // Replay last known tilemap to late joiners (if host already published one)
    if (lastTilemapMsg) {
        sendJson(ws, lastTilemapMsg, playerId, "tilemapReplay");
        if (DEBUG_TILEMAP) {
            console.log(
                "[server] replayed cached tilemap to playerId =",
                playerId,
                "rev =",
                lastTilemapMsg.rev,
                "rows=",
                lastTilemapMsg.rows,
                "cols=",
                lastTilemapMsg.cols,
                "tileSize=",
                lastTilemapMsg.tileSize,
                "encoding=",
                lastTilemapMsg.encoding
            );
        }
    }
}

function installSocketHandlers(ws, playerId) {
    ws.on("message", (data) => {
        const msg = parseJsonMessageOrNull(playerId, data);
        if (!msg) return;

        // Enforce the sender's playerId (authoritative on server)
        msg.playerId = playerId;

        if (msg.type === "input") {
            handleInputMessage(ws, playerId, msg);
        } else if (msg.type === "state") {
            handleStateMessage(ws, playerId, msg);
        } else if (msg.type === "tilemap") {
            handleTilemapMessage(ws, playerId, msg);
        } else {
            console.warn("[server] unknown message type from playerId", playerId, ":", msg.type);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        dumpClients("after close");
        recomputeHostAndBroadcast();
    });

    ws.on("error", (err) => {
        console.warn("[server] ws error from playerId", playerId, ":", err);
    });
}

function acceptConnection(ws) {
    console.log("[server] new client connecting...");

    const playerId = allocatePlayerIdCapped();
    if (playerId == null) {
        console.warn("[server] lobby full; rejecting new client");
        ws.close(1013, "Server full");
        return;
    }

    clients.set(ws, playerId);
    dumpClients("after connect");
    recomputeHostAndBroadcast();

    sendAssignAndReplayTilemap(ws, playerId);
    installSocketHandlers(ws, playerId);
}

// ------------------------------------------------------------
// Wire up server
// ------------------------------------------------------------
wss.on("connection", (ws) => {
    acceptConnection(ws);
});
