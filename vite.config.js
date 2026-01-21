import { defineConfig } from "vite";
import { spawn } from "child_process";
import os from "os";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ASSET_EXT_RE = /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|json|atlas|bin|ttf|otf|woff2?)$/i;

function shouldCacheAssetUrl(url) {
    if (!url) return false;
    const path = url.split("?")[0] || "";
    if (path.startsWith("/assets/")) return true;
    if (path.startsWith("/src/assets/")) return true;
    if (path.includes("/assets/")) return true;
    return ASSET_EXT_RE.test(path);
}

function pickDefaultHost() {
    if (process.env.DEV_HOST) return process.env.DEV_HOST;

    // Prefer a real LAN IPv4; skip WSL Hyper-V NATs (172.22.x.x) and obvious bogus ranges.
    const nets = os.networkInterfaces();
    const candidates = [];
    for (const entries of Object.values(nets)) {
        if (!entries) continue;
        for (const e of entries) {
            if (!e || e.internal) continue;
            if (e.family !== "IPv4") continue;
            const addr = e.address || "";
            if (!addr) continue;
            if (addr.startsWith("127.")) continue;
            if (addr.startsWith("172.22.")) continue; // WSL NAT
            if (addr.startsWith("10.255.")) continue; // bogus
            candidates.push(addr);
        }
    }
    // Prefer 192.168.x.x, then 10.x.x.x, then anything else.
    const pref192 = candidates.find((a) => a.startsWith("192.168."));
    if (pref192) return pref192;
    const pref10 = candidates.find((a) => a.startsWith("10."));
    if (pref10) return pref10;
    return candidates[0] || "0.0.0.0";
}

export default defineConfig({
    server: {
        // Auto-pick a reachable LAN IP; override with DEV_HOST=192.168.x.x if needed.
        host: pickDefaultHost(),
        port: 5173 // explicit to avoid surprises
    },
    plugins: [
        {
            name: "multiplayer-server",
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req && shouldCacheAssetUrl(req.url || "")) {
                        const prev = res.setHeader;
                        res.setHeader = function (name, value) {
                            if (String(name || "").toLowerCase() === "cache-control") {
                                return prev.call(this, name, ASSET_CACHE_CONTROL);
                            }
                            return prev.call(this, name, value);
                        };
                        res.setHeader("Cache-Control", ASSET_CACHE_CONTROL);
                    }
                    next();
                });

                // Use Vite's configured dev port if present, else default 5173
                const devPort = server.config.server.port ?? 5173;
                const wsPort = process.env.GAME_WS_PORT || 8080;
                const devHost = server.config.server.host || pickDefaultHost();

                console.log(
                    `[vite] starting multiplayer server via ./server.js (GAME_PORT=${devPort} WS_PORT=${wsPort} HOST=${devHost}) ...`
                );

                const child = spawn(process.execPath, ["./server.js"], {
                    stdio: "inherit", // pipe [server] logs into the same terminal
                    env: {
                        ...process.env,
                        GAME_PORT: String(devPort),
                        GAME_WS_PORT: String(wsPort),
                        GAME_HOST: String(devHost)
                    }
                });

                process.on("exit", () => {
                    if (!child.killed) child.kill();
                });
            }
        }
    ]
});
