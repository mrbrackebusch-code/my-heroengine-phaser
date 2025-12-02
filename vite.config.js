import { defineConfig } from "vite";
import { spawn } from "child_process";

export default defineConfig({
    server: {
        host: true // listen on 0.0.0.0 so LAN devices can reach it
        // If you ever want to force a different port, add: port: 5173
    },
    plugins: [
        {
            name: "multiplayer-server",
            configureServer(server) {
                // Use Vite's configured dev port if present, else default 5173
                const devPort = server.config.server.port ?? 5173;

                console.log(
                    `[vite] starting multiplayer server via ./server.js (GAME_PORT=${devPort}) ...`
                );

                const child = spawn("node", ["./server.js"], {
                    stdio: "inherit", // pipe [server] logs into the same terminal
                    shell: process.platform === "win32",
                    env: {
                        ...process.env,
                        GAME_PORT: String(devPort)
                    }
                });

                process.on("exit", () => {
                    if (!child.killed) child.kill();
                });
            }
        }
    ]
});
