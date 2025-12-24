// server.js (ESM version, compatible with "type": "module")
import WebSocket, { WebSocketServer } from "ws";


//// NEW LOGGING ----
const SERVER_LAG_WARN_MS = 30;   // warn when client→server delay > 30ms
const SERVER_LAG_HARD_MS = 100;  // big warning > 100ms

const DEBUG_NET = false;
const DEBUG_TILEMAP = true;


const PORT = 8080;
const HOST = "0.0.0.0";

const wss = new WebSocketServer({ port: PORT, host: HOST });

console.log("==================================================");
console.log("[server] *** MULTIPLAYER SERVER STARTED ***");
console.log("[server] PID:", process.pid);
console.log(`[server] Listening on ws://${HOST}:${PORT}`);
console.log("==================================================");

const MAX_PLAYERS = 4;

// Map WebSocket -> playerId
/** @type {Map<WebSocket, number>} */
const clients = new Map();

// Cached most-recent full tilemap message (set by host)
let lastTilemapMsg = null;


function dumpClients(tag) {
    const entries = Array.from(clients.entries()).map(([ws, pid], idx) => ({
        idx,
        playerId: pid,
        readyState: ws.readyState
    }));
    console.log(`[server] dumpClients(${tag}) ->`, entries);
}

// Return the lowest available playerId in [1..MAX_PLAYERS], or null if full
function allocatePlayerId() {
    const used = new Set(clients.values());
    for (let pid = 1; pid <= MAX_PLAYERS; pid++) {
        if (!used.has(pid)) return pid;
    }
    return null;
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

function getHostEntry() {
    const entries = Array.from(clients.entries()); // [ [ws, playerId], ... ]
    if (entries.length === 0) return null;
    const [hostWs, hostPlayerId] = entries[0];
    return { entries, hostWs, hostPlayerId };
}



function recomputeHost() {
    const host = getHostEntry();
    if (!host) return;

    const { entries, hostWs, hostPlayerId } = host;

    for (const [ws, pid] of entries) {
        const isHost = ws === hostWs;
        const msg = {
            type: "hostStatus",
            isHost
        };
        sendJson(ws, msg, pid, "hostStatus");
    }

    console.log("[server] host is now playerId =", hostPlayerId);
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


wss.on("connection", (ws) => {
    console.log("[server] new client connecting...");

    const playerId = allocatePlayerId();
    if (playerId == null) {
        console.warn("[server] lobby full; rejecting new client");
        ws.close(1013, "Server full");
        return;
    }

    clients.set(ws, playerId);
    dumpClients("after connect");
    recomputeHost();

    const name = `Player${playerId}`;
    console.log("[server] client assigned playerId =", playerId, "name =", name);

    // Notify just this client of its playerId + default name
    const assignMsg = {
        type: "assign",
        playerId,
        name
    };
    sendJson(ws, assignMsg, playerId, "assign");

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

    // IMPORTANT: message handler is per-client -> ws.on("message"), not wss.on("message")
    ws.on("message", (data) => {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch (e) {
            console.warn("[server] invalid JSON from playerId", playerId, ":", data.toString());
            return;
        }

        if (!msg || typeof msg.type !== "string") {
            console.warn("[server] malformed message from playerId", playerId, ":", msg);
            return;
        }

        // Enforce the sender's playerId
        msg.playerId = playerId;

        if (msg.type === "input") {
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

        } else if (msg.type === "state") {
            msg.serverSentAt = Date.now();

            // Only the current host (first in clients) is allowed to send snapshots.
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

        } else if (msg.type === "tilemap") {
            // Only the current host may publish the authoritative tilemap.
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
            if (typeof msg.rev !== "number" ||
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

        } else {
            console.warn("[server] unknown message type from playerId", playerId, ":", msg.type);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        dumpClients("after close");
        recomputeHost();
    });

    ws.on("error", (err) => {
        console.warn("[server] ws error from playerId", playerId, ":", err);
    });
});
