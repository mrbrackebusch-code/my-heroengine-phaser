// server.js (ESM version, compatible with "type": "module")
import WebSocket, { WebSocketServer } from "ws";

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

// Broadcast a message object (already in JSON-able form) to every client
function broadcast(msg, exceptWs = null) {
    const json = JSON.stringify(msg);
    for (const [ws] of clients.entries()) {
        if (ws === exceptWs) continue;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(json);
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

    const name = `Player${playerId}`;

    console.log("[server] client assigned playerId =", playerId, "name =", name);

    // Notify just this client of its playerId + default name
    const assignMsg = {
        type: "assign",
        playerId,
        name
    };
    ws.send(JSON.stringify(assignMsg));

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
            // Relay inputs to everyone.
            // Host will apply them; followers will ignore them.
            // Shape: { type: "input", playerId, button, pressed }
            if (typeof msg.button !== "string" || typeof msg.pressed !== "boolean") {
                console.warn("[server] malformed input from playerId", playerId, ":", msg);
                return;
            }

            // console.log("[server] relaying input:", msg);
            broadcast(msg);
        } else if (msg.type === "state") {
            // Only the host (playerId 1) is allowed to send state snapshots.
            if (playerId !== 1) {
                console.warn("[server] non-host tried to send state; ignoring. playerId =", playerId);
                return;
            }

            if (!msg.snapshot) {
                console.warn("[server] state message missing snapshot from host");
                return;
            }

            // console.log("[server] relaying state from host");
            broadcast(msg);
        } else {
            console.warn("[server] unknown message type from playerId", playerId, ":", msg.type);
        }
    });

    ws.on("close", () => {
        console.log("[server] client disconnected, playerId =", playerId);
        clients.delete(ws);
        dumpClients("after disconnect");
    });

    ws.on("error", (err) => {
        console.warn("[server] socket error for playerId", playerId, ":", err);
    });
});

wss.on("error", (err) => {
    console.error("[server] WSS ERROR:", err);
});
