import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let nextPlayerId = 1;
const MAX_PLAYERS = 4;

console.log("[multiplayer] WebSocket server running on ws://localhost:8080");

wss.on("connection", (ws) => {
    if (nextPlayerId > MAX_PLAYERS) {
        ws.close();
        return;
    }

    const playerId = nextPlayerId++;
    ws.send(JSON.stringify({
        type: "assign",
        playerId,
        name: `Player${playerId}`,
    }));

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === "input") {
            const payload = JSON.stringify(msg);
            for (const client of wss.clients) {
                if (client.readyState === 1) {
                    client.send(payload);
                }
            }
        }
    });
});
