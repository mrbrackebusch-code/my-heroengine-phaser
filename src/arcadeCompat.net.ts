/**
 * arcadeCompat.net.ts — extracted networking + identity + roster logic
 * NOTE: This module is loaded via re-export from arcadeCompat.ts.
 * It intentionally uses globalThis.{sprites,game,...} to avoid importing the full compat surface.
 */

// Type-only shim: WorldSnapshot type is defined in arcadeCompat.ts; we keep this file decoupled.


type NetWorldSnapshot = any

type NetWorldRuntime = {
    capture: () => any
    apply: (snap: any) => void
}

function _net_getNetWorld(): NetWorldRuntime {
    const nw: any = (globalThis as any).netWorld
    if (!nw) throw new Error("[NET] globalThis.netWorld not installed yet")
    return nw as NetWorldRuntime
}



function _net_tryGetSpriteCount(): number {
    try {
        const s: any = (globalThis as any).sprites;
        if (s && typeof s.allSprites === "function") return s.allSprites().length | 0;
    } catch (_e) { /* ignore */ }
    return 0;
}

function _net_gameRuntimeMs(): number {
    try {
        const g: any = (globalThis as any).game;
        if (g && typeof g.runtime === "function") return g.runtime() | 0;
    } catch (_e) { /* ignore */ }
    return Date.now() | 0;
}






const SESSION_TOKEN_KEY = "heroToken_v1";

// Must match heroLogicHost.ts registered keys
const KNOWN_PROFILE_KEYS = new Set<string>(["Chris", "Demo", "Jason", "Kyle"]);


// ------------------------------------------------------------
// Net module local debug + thresholds (moved from arcadeCompat.ts)
// ------------------------------------------------------------
const DEBUG_NET = false;
const DEBUG_TILEMAP = true;

const INPUT_LAG_WARN_MS = 120;
const INPUT_LAG_WARN_EXCESS_MS = 80;

let _inputLagBaselineMs = 0;
let _inputLagBaselineSamples = 0;
let _lastInputLagWarnMs = 0;

const INPUT_PROC_WARN_MS = 1.5;
const INPUT_PROC_SPAM_GAP_MS = 0.5;

let _lastInputProcWarnMs = 0;





function _randToken(): string {
    try {
        const c: any = (typeof crypto !== "undefined") ? (crypto as any) : null;
        if (c && typeof c.randomUUID === "function") return c.randomUUID();
    } catch (_e) { /* ignore */ }

    return "t_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function _getOrCreateSessionToken(): string {
    try {
        const ss: any = (typeof sessionStorage !== "undefined") ? sessionStorage : null;
        if (!ss) return _randToken();

        const existing = ss.getItem(SESSION_TOKEN_KEY);
        if (existing && typeof existing === "string" && existing.length >= 8) return existing;

        const tok = _randToken();
        ss.setItem(SESSION_TOKEN_KEY, tok);
        return tok;
    } catch (_e) {
        const g: any = (globalThis as any);
        if (!g.__fallbackHelloToken) g.__fallbackHelloToken = _randToken();
        return g.__fallbackHelloToken;
    }
}

function _normalizeProfileKey(raw: any): string | null {
    if (typeof raw !== "string") return null;
    let s = raw.trim();
    if (!s) return null;

    // tolerate: "Demo Hero" / "DemoHero" / "DemoHeroLogic"
    s = s.replace(/\s+/g, " ");

    // Case-insensitive suffix stripping (this is what you asked to restore)
    s = s.replace(/HeroLogic$/i, "").trim();
    s = s.replace(/Hero$/i, "").trim();

    if (KNOWN_PROFILE_KEYS.has(s)) return s;

    const first = s.split(" ")[0].trim();
    if (KNOWN_PROFILE_KEYS.has(first)) return first;

    return null;
}

function _getDesiredProfileForHello(): string | null {
    const g: any = (globalThis as any);
    // main.ts sets this from URL
    const raw = g.__localHeroProfileName;
    return _normalizeProfileKey(raw);
}

function _queueEnsureHero(playerId: number) {
    const g: any = (globalThis as any);
    if (!g.__pendingEnsureHeroes) g.__pendingEnsureHeroes = [];
    g.__pendingEnsureHeroes.push(playerId | 0);
}

function _flushEnsureHeroesIfPossible() {
    const g: any = (globalThis as any);
    const arr: any[] = g.__pendingEnsureHeroes;
    if (!Array.isArray(arr) || arr.length === 0) return;

    const internals = g.__HeroEnginePhaserInternals;
    const fn = internals && typeof internals.ensureHeroForPlayer === "function" ? internals.ensureHeroForPlayer : null;
    if (!fn) return;

    g.__pendingEnsureHeroes = [];

    for (const pidAny of arr) {
        const pid = (pidAny | 0);
        try { fn(pid); } catch (e) { console.warn("[net] ensureHeroForPlayer failed for pid", pid, e); }
    }
}






/* -------------------------------------------------------
   Network client – WebSocket → controller bridge
------------------------------------------------------- */
type NetMessage =
    | { type: "assign"; playerId: number; name?: string; token?: string | null; profile?: string | null }
    | {
          type: "playerState";
          playerId: number;
          token?: string | null;
          connected: boolean;
          controlSlot?: number | null;
          profile?: string | null;
      }
    | {
          type: "rosterSnapshot";
          hostToken?: string | null;
          hostLeaseUntilMs?: number;
          players: Array<{
              playerId: number;
              token?: string | null;
              profile?: string | null;
              connected: boolean;
              controlSlot?: number | null;
          }>;
      }
    | {
          type: "input";
          playerId: number;
          button: string;
          pressed: boolean;

          sentAtMs?: number;
          sentWallMs?: number;
          inputSeq?: number;

          serverRecvAt?: number;
          serverSentAt?: number;
      }
    | { type: "state"; playerId: number; snapshot: NetWorldSnapshot; serverSentAt?: number }
    | { type: "hostStatus"; isHost: boolean; hostPlayerId?: number | null }
    | {
          type: "tilemap";
          rev: number;
          tileSize: number;
          rows: number;
          cols: number;
          encoding: "raw";
          data: number[][];
      }
    | {
          type: "tilemap";
          rev: number;
          tileSize: number;
          rows: number;
          cols: number;
          encoding: "rle" | "u8b64";
          data: string;
      };
    






class NetworkClient {
    private ws: WebSocket | null = null;
    playerId: number | null = null;
    url: string;

    // NEW: per-client monotonically increasing input sequence
    private inputSeq: number = 0;

    // Host flag as reported by the server (authoritative)
    private _isHostFromServer: boolean = false;

    // Latest tilemap revision we've accepted (monotonic)
    private _tilemapRev: number = 0;


    constructor(url: string) {
        this.url = url;
    }



    connect() {
        if (this.ws) return;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            console.log("[net] connected to", this.url);

            // Required by server Step 3+: HELLO binds token -> playerId
            try {
                const g: any = (globalThis as any);
                const token: string | null = (typeof g.__netHelloToken === "string") ? g.__netHelloToken : null;
                const desiredProfile: string | null = (typeof g.__netHelloProfile === "string") ? g.__netHelloProfile : null;

                if (!token) {
                    console.warn("[net] HELLO not sent (missing token)");
                    return;
                }

                const hello = {
                    type: "hello",
                    token,
                    desiredProfile,
                    clientWallMs: Date.now()
                };

                ws.send(JSON.stringify(hello));

                console.log("[net] hello sent", {
                    token: token.slice(0, 8) + "…",
                    desiredProfile: desiredProfile || null
                });
            } catch (e) {
                console.warn("[net] failed to send hello:", e);
            }
        };

        ws.onmessage = (ev) => {
            let msg: NetMessage;
            try {
                msg = JSON.parse(ev.data) as NetMessage;
            } catch (e) {
                console.warn("[net] invalid message:", ev.data, e);
                return;
            }
            this.handleMessage(msg);
        };

        ws.onclose = () => {
            console.log("[net] disconnected");
            this.ws = null;
        };

        ws.onerror = (ev) => {
            console.warn("[net] error", ev);
        };
    }



    // Send a button event up to the server
    sendInput(button: string, pressed: boolean) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // console.log("[net] not connected; ignoring input");
            return;
        }
        if (this.playerId == null) {
            console.warn("[net] no playerId yet; ignoring input");
            return;
        }

        // Bump sequence number
        const seq = ++this.inputSeq;

        // High-res time for *this page only* (host RTT measurement)
        const perfNow =
            typeof performance !== "undefined" ? performance.now() : null;

        // Wall-clock time for cross-process comparisons (client↔server)
        const wallNow = Date.now();

        const payload: NetMessage = {
            type: "input",
            playerId: this.playerId,
            button,
            pressed,
            // For host-side [inputLag.net]
            sentAtMs: perfNow != null ? perfNow : wallNow,
            // For server lag + cross-process correlation
            sentWallMs: wallNow,
            // NEW: shared ID so all logs can line up
            inputSeq: seq
        };

        this.ws.send(JSON.stringify(payload));
    }


    // Host uses this to send snapshots of the world state
    sendWorldSnapshot(snap: NetWorldSnapshot) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // Authority is based on server-reported hostStatus, NOT playerId === 1
        if (!this.isHostNow()) {
            return;
        }

        if (this.playerId == null) {
            // Shouldn't happen if we're host, but keep it safe
            return;
        }

        const payload: NetMessage = {
            type: "state",
            playerId: this.playerId,
            snapshot: snap
        };

        this.ws.send(JSON.stringify(payload));
    }


        private isHostNow(): boolean {
        // Central source of truth for "hostness" inside NetworkClient.
        // Keep globalThis.__isHost in sync because other non-network code already reads it.
        const g: any = (globalThis as any);
        if (g.__isHost !== this._isHostFromServer) {
            g.__isHost = this._isHostFromServer;
        }
        return this._isHostFromServer;
        }

    
private handleMessage(msg: NetMessage) {
    switch (msg.type) {
        case "assign":
            this.onAssign(msg);
            return;

        case "playerState":
            this.onPlayerState(msg);
            return;

        case "rosterSnapshot":
            this.onRosterSnapshot(msg);
            return;

        case "hostStatus":
            this.onHostStatus(msg);
            return;

        case "state":
            this.onState(msg);
            return;

        case "input":
            this.onInput(msg as any);
            return;

        case "tilemap":
            this.onTilemap(msg as any);
            return;

        default:
            return;
    }
}



    private onAssign(msg: Extract<NetMessage, { type: "assign" }>) {
        this.playerId = msg.playerId;

        const g: any = (globalThis as any);

        console.log("[net] assigned playerId =", this.playerId, "name=", msg.name, "profile=", msg.profile);

        // Tie this client to that global player slot
        const ctrlNS: any = g.controller;
        if (ctrlNS && typeof ctrlNS.setLocalPlayerSlot === "function") {
            ctrlNS.setLocalPlayerSlot(this.playerId);
        }

        const slotIndex = this.playerId - 1;

        if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
        if (!g.__playerNames) g.__playerNames = [null, null, null, null];
        if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

        // Keep name for debugging/UI
        const name = msg.name || null;
        g.__playerNames[slotIndex] = name;

        // Prefer explicit server profile if present; otherwise keep existing.
        const profile = (typeof msg.profile === "string" && msg.profile.trim()) ? msg.profile.trim() : null;
        if (profile) {
            g.__heroProfiles[slotIndex] = profile;
        }
    }


private onRosterSnapshot(msg: Extract<NetMessage, { type: "rosterSnapshot" }>) {
    const g: any = (globalThis as any);
    const isHost = this.isHostNow();

    if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

    // Apply the snapshot to our slot-based bridge state
    for (const p of (msg.players || [])) {
        const pid = (p.playerId | 0);
        const slotIndex = pid - 1;
        if (slotIndex < 0 || slotIndex >= 4) continue;

        const connected = !!p.connected;
        const prevConnected = !!g.__netSlotConnected[slotIndex];

        g.__netSlotConnected[slotIndex] = connected;

        const profile =
            (typeof p.profile === "string" && p.profile.trim())
                ? p.profile.trim()
                : null;

        if (profile) {
            g.__heroProfiles[slotIndex] = profile;
        }

        // Host-side hygiene: if snapshot flips connected state, release keys
        if (isHost && prevConnected !== connected) {
            this._releaseAllButtonsForPlayer(pid);
        }

        // Host: ensure hero exists for connected slots (idempotent)
        if (isHost && connected) {
            const internals = g.__HeroEnginePhaserInternals;
            const ensureFn = internals && typeof internals.ensureHeroForPlayer === "function" ? internals.ensureHeroForPlayer : null;
            if (ensureFn) {
                try { ensureFn(pid); } catch (_e) { /* ignore */ }
            } else {
                _queueEnsureHero(pid);
            }
        }
    }

    if (DEBUG_NET || isHost) {
        console.log("[net.rosterSnapshot] applied", {
            hostToken: (msg.hostToken ? (msg.hostToken.slice(0, 8) + "…") : null),
            hostLeaseUntilMs: msg.hostLeaseUntilMs ?? null,
            players: (msg.players || []).map(p => ({ pid: p.playerId, connected: !!p.connected, profile: p.profile || null }))
        });
    }
}




private onPlayerState(msg: Extract<NetMessage, { type: "playerState" }>) {
    const g: any = (globalThis as any);
    const isHost = this.isHostNow();

    const playerId = msg.playerId | 0;
    const slotIndex = playerId - 1;

    // Engine bridge only cares about slots 0..3 for now.
    // TODO_NPLAYER_BRIDGE: later, limbo players >4 live here without dropping.
    if (slotIndex < 0 || slotIndex >= 4) return;

    if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

    const connected = !!msg.connected;

    const prevConnected = !!g.__netSlotConnected[slotIndex];
    const prevProfile = g.__heroProfiles[slotIndex];

    const profile =
        (typeof msg.profile === "string" && msg.profile.trim())
            ? msg.profile.trim()
            : null;

    // ------------------------------------------------------------
    // STEP 9: ALWAYS re-apply profile on reconnect (even if hero exists)
    // The engine resolves profile dynamically via globalThis.__heroProfiles,
    // so this is the authoritative switch that fixes "stays Default".
    //
    // TODO_NPLAYER_BRIDGE: later: drive this by controlSlot grants.
    // ------------------------------------------------------------
    if (profile) {
        g.__heroProfiles[slotIndex] = profile;

        const changed = (prevProfile !== profile);
        const isReconnect = (!prevConnected && connected);

        if (changed || isReconnect || isHost) {
            console.log(
                "[net.playerState]",
                "slot", slotIndex + 1,
                "connected", connected,
                "profile", profile,
                "prevProfile", prevProfile,
                "prevConnected", prevConnected
            );
        }
    } else {
        // No profile included: keep whatever we already had.
        // (Server SHOULD include it; this log helps catch missing propagation bugs.)
        if (connected && isHost) {
            console.warn(
                "[net.playerState] connected but no profile provided by server; keeping existing profile",
                "slot", slotIndex + 1,
                "existing=", prevProfile
            );
        }
    }

    // ------------------------------------------------------------
    // STEP 8/9: LIMBO STATE
    // - connected=false => limbo (no control)
    // - connected=true  => control enabled again
    // ------------------------------------------------------------
    g.__netSlotConnected[slotIndex] = connected;

    // Host-side hygiene: release held keys on BOTH disconnect and reconnect.
    // (Reconnect can otherwise inherit stale host-side pressed state.)
    if (isHost && (prevConnected !== connected)) {
        this._releaseAllButtonsForPlayer(playerId);
    }

    // ------------------------------------------------------------
    // STEP 7/9: ensure hero exists on connect (even if already exists)
    // Calling ensureHeroForPlayer is idempotent: it returns existing index
    // if the hero already exists, so it doubles as a "rebind" moment.
    //
    // TODO_NPLAYER_BRIDGE: later replace playerId<=4 assumption with roster.
    // ------------------------------------------------------------
    if (isHost && connected) {
        const internals = g.__HeroEnginePhaserInternals;
        const ensureFn =
            internals && typeof internals.ensureHeroForPlayer === "function"
                ? internals.ensureHeroForPlayer
                : null;

        if (ensureFn) {
            try {
                const heroIndex = ensureFn(playerId);
                if (heroIndex >= 0) {
                    console.log(
                        "[net.playerState] ensureHeroForPlayer ok",
                        "playerId", playerId,
                        "heroIndex", heroIndex,
                        "profileNow", g.__heroProfiles[slotIndex]
                    );
                }
            } catch (e) {
                console.warn("[net.playerState] ensureHeroForPlayer ERROR pid=", playerId, e);
            }
        } else {
            // Engine may not be imported yet; queue and flush on hostStatus/start.
            _queueEnsureHero(playerId);
        }
    }
}



    private onHostStatus(msg: any) {
        const g: any = (globalThis as any);
        const isHost = !!msg.isHost;

        // Centralized host flag
        this._isHostFromServer = isHost;

        // Keep legacy global in sync (other files read it)
        g.__isHost = isHost;

        console.log("[net] hostStatus =", isHost, "hostPlayerId=", (msg && msg.hostPlayerId != null) ? msg.hostPlayerId : null);

        // If this client is host, kick off the HeroEngine host loop
        if (isHost && typeof g.__startHeroEngineHost === "function") {
            g.__startHeroEngineHost();

            // playerState may have arrived before HeroEngineInPhaser internals exist
            _flushEnsureHeroesIfPossible();
            setTimeout(() => _flushEnsureHeroesIfPossible(), 0);
        }
    }



    private _getControllerForPlayerId(playerId: number): any {
        const g: any = (globalThis as any);
        const ctrlNS: any = g.controller;
        if (!ctrlNS) return null;

        if (playerId === 1) return ctrlNS.player1;
        if (playerId === 2) return ctrlNS.player2;
        if (playerId === 3) return ctrlNS.player3;
        if (playerId === 4) return ctrlNS.player4;

        return null;
    }

    private _releaseAllButtonsForPlayer(playerId: number) {
        const ctrl = this._getControllerForPlayerId(playerId);
        if (!ctrl) return;

        // These are the only ones we currently route over the network.
        const keys = ["left", "right", "up", "down", "A", "B"];

        for (const k of keys) {
            const btn: any = ctrl[k];
            if (btn && typeof btn._setPressed === "function") {
                btn._setPressed(false);
            }
        }
    }



    
    private onPlayerStateOLDCODETODELETE(msg: Extract<NetMessage, { type: "playerState" }>) {
        const g: any = (globalThis as any);
        const isHost = this.isHostNow();

        const playerId = msg.playerId | 0;
        const slotIndex = playerId - 1;

        // Engine bridge only cares about slots 0..3 for now.
        // TODO_NPLAYER_BRIDGE: later, limbo players >4 live here without dropping.
        if (slotIndex < 0 || slotIndex >= 4) return;

        if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
        if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

        const profile = (typeof msg.profile === "string" && msg.profile.trim()) ? msg.profile.trim() : null;

        // Host must be authoritative for slot->profile mapping (logic selection).
        if (profile) {
            const prev = g.__heroProfiles[slotIndex];
            g.__heroProfiles[slotIndex] = profile;

            if (DEBUG_NET || isHost) {
                console.log("[net.playerState] slot", slotIndex + 1, "profile =", profile, "connected =", !!msg.connected, "prev =", prev);
            }
        }

        // ------------------------------------------------------------
        // STEP 8: disconnect -> put hero in LIMBO (no control)
        // - Do NOT destroy hero.
        // - Host ignores inputs for disconnected slots.
        // - Host releases held keys to prevent “stuck movement”.
        //
        // TODO_NPLAYER_BRIDGE:
        //   This is slot-based because HeroEngineInPhaser is still 4-player.
        //   Later: replace with roster-based controlSlot grants/revokes.
        // ------------------------------------------------------------
        const connected = !!msg.connected;
        g.__netSlotConnected[slotIndex] = connected;

        if (isHost && !connected) {
            this._releaseAllButtonsForPlayer(playerId);
        }

        // ------------------------------------------------------------
        // STEP 7: host spawns hero immediately when player connects
        // ------------------------------------------------------------
        if (isHost && connected) {
            const internals = g.__HeroEnginePhaserInternals;
            const ensureFn = internals && typeof internals.ensureHeroForPlayer === "function" ? internals.ensureHeroForPlayer : null;

            if (ensureFn) {
                try {
                    ensureFn(playerId);
                } catch (e) {
                    console.warn("[net.playerState] ensureHeroForPlayer ERROR pid=", playerId, e);
                }
            } else {
                _queueEnsureHero(playerId);
            }
        }
    }





    private onState(msg: Extract<NetMessage, { type: "state" }>) {
        const isHost = this.isHostNow();

        // Host already has authoritative world state.
        // Ignore echoed snapshots to avoid duplicating sprites / state.
        if (isHost) {
            // console.log("[net] host ignoring echoed state snapshot");
            return;
        }

        // Followers mirror the host via snapshots.
        _net_getNetWorld().apply(msg.snapshot);
    }

    private onTilemap(msg: Extract<NetMessage, { type: "tilemap" }>) {
        const rev = msg.rev;

        // Monotonic revision guard
        if (typeof rev !== "number") return;
        if (rev <= this._tilemapRev) return;

        this._tilemapRev = rev;

        const g: any = (globalThis as any);
        g.__netTilemapRev = rev;
        g.__lastTilemapMsg = msg; // helpful for debugging / late hook install

        const info = {
            rev: msg.rev,
            rows: msg.rows,
            cols: msg.cols,
            tileSize: msg.tileSize,
            encoding: msg.encoding,
        };

        const hook = g.__onNetTilemap;
        if (typeof hook === "function") {
            try {
                if (DEBUG_TILEMAP) {
                    console.log(">>> [net.tilemap] received; forwarding to Phaser hook", info);
                }
                hook(msg);
            } catch (e) {
                console.error(">>> [net.tilemap] __onNetTilemap ERROR:", e);
            }
        } else {
            if (DEBUG_TILEMAP) {
                console.warn(
                    ">>> [net.tilemap] received but __onNetTilemap not installed yet; cached in globalThis.__lastTilemapMsg",
                    info
                );
            }
        }
    }



    private onInput(msg: any) {
        const g: any = (globalThis as any);
        const isHost = this.isHostNow();

        // Only the host should apply inputs to controllers.
        if (!isHost) return;

        const playerId = (msg.playerId | 0);

        // ------------------------------------------------------------
        // STEP 8: LIMBO GATE
        // If a player is disconnected, ignore their inputs entirely.
        // (Heroes persist, but have no control.)
        //
        // TODO_NPLAYER_BRIDGE:
        //   This is slot-based (1..4) because engine is still 4-player.
        //   Later: gate by controlSlot grants, not playerId.
        // ------------------------------------------------------------
        const slotIndex = playerId - 1;
        if (Array.isArray(g.__netSlotConnected)) {
            const connected = !!g.__netSlotConnected[slotIndex];
            if (!connected) return;
        }

        const ctrl = this._getControllerForPlayerId(playerId);
        if (!ctrl) return;

        const btnName = msg.button;       // "left" | "right" | "up" | "down" | "A" | "B"
        const pressed = !!msg.pressed;

        // ---------------------------------------------------------
        // 1) Measure input *arrival* lag (client -> host)
        // ---------------------------------------------------------
        let lagMs = -1;
        if (typeof msg.sentAtMs === "number") {
            const nowMs =
                typeof performance !== "undefined" ? performance.now() : Date.now();
            lagMs = nowMs - msg.sentAtMs;

            // Establish a baseline to account for clock offset + normal latency
            if (_inputLagBaselineSamples < 20) {
                if (_inputLagBaselineSamples === 0 || lagMs < _inputLagBaselineMs) {
                    _inputLagBaselineMs = lagMs;
                }
                _inputLagBaselineSamples++;
            }

            // If we have a baseline, look at *extra* lag beyond that
            let excessMs = lagMs;
            if (_inputLagBaselineSamples > 0) {
                excessMs = lagMs - _inputLagBaselineMs;
            }

            let spriteCount = 0;
            try {
                spriteCount = _net_tryGetSpriteCount();
            } catch (e) {
                // ignore; non-fatal
            }

            const shouldWarn =
                excessMs > INPUT_LAG_WARN_EXCESS_MS &&
                lagMs > INPUT_LAG_WARN_MS &&
                Math.abs(lagMs - _lastInputLagWarnMs) > 50;

            if (DEBUG_NET && shouldWarn) {
                _lastInputLagWarnMs = lagMs;

                const hostWallNow = Date.now();
                const seq = (msg as any).inputSeq ?? -1;
                const sentWall = (msg as any).sentWallMs ?? null;

                console.warn(
                    "[inputLag.net]",
                    "seq=", seq,
                    "playerId=", playerId,
                    "button=", btnName,
                    "pressed=", pressed,
                    "lagMs≈", lagMs.toFixed(1),
                    "baseline≈", _inputLagBaselineMs.toFixed(1),
                    "excessMs≈", excessMs.toFixed(1),
                    "sprites=", spriteCount,
                    "sentWallMs=", sentWall,
                    "hostWallMs=", hostWallNow
                );
            }
        }

        // ---------------------------------------------------------
        // 2) Measure *host processing* time for this input
        // ---------------------------------------------------------
        const btn: any = ctrl[btnName];
        if (!btn || typeof btn._setPressed !== "function") return;

        const procStartMs =
            typeof performance !== "undefined" ? performance.now() : Date.now();

        btn._setPressed(pressed);    // <-- actual host-side work for this input

        const procEndMs =
            typeof performance !== "undefined" ? performance.now() : Date.now();
        const procMs = procEndMs - procStartMs;

        // Only log if host processing is unusually slow
        if (
            procMs > INPUT_PROC_WARN_MS &&
            Math.abs(procMs - _lastInputProcWarnMs) > INPUT_PROC_SPAM_GAP_MS
        ) {
            _lastInputProcWarnMs = procMs;

            let spriteCountForProc = 0;
            try {
                spriteCountForProc = _net_tryGetSpriteCount();
            } catch (e) {
                // ignore
            }

            console.warn(
                "[inputProc.net]",
                "playerId=", playerId,
                "button=", btnName,
                "pressed=", pressed,
                "procMs≈", procMs.toFixed(3),
                lagMs >= 0 ? "lagMs≈ " + lagMs.toFixed(1) : "lagMs≈ n/a",
                "sprites=", spriteCountForProc
            );
        }
    }




}

























// CHANGE THIS to your actual server IP/port as needed
//const _netClient = new NetworkClient("ws://localhost:8080");



const host = window.location.hostname || "localhost";



const _netClient = new NetworkClient(`ws://${host}:8080`);

let _lastSnapshotSentMs = 0;
let _snapshotSentCount = 0;


// Host perf tracking: approximate bandwidth + cadence
let _snapshotPerfAccumSnaps = 0;
let _snapshotPerfAccumBytes = 0;
let _snapshotPerfLastReportMs = 0;

let _hostPerfAccumSnapMs = 0;
let _hostPerfLastSnapshotSprites = 0;


function _hostPerfNowMs(): number {
    if (typeof performance !== "undefined" && (performance as any).now) {
        return (performance as any).now()
    }
    return Date.now()
}



// Called from game._tick() on the host to periodically send world snapshots
function _maybeSendWorldSnapshotTick() {
    const snapT0 = _hostPerfNowMs();

    const g: any = (globalThis as any);
    if (!g || !g.__isHost) return;

    const now = _net_gameRuntimeMs();

    const intervalMs = 16; // ~60 snapshots per second

    const dt = now - _lastSnapshotSentMs;
    if (_lastSnapshotSentMs !== 0 && dt < intervalMs) return;
    _lastSnapshotSentMs = now;

    const snap = _net_getNetWorld().capture();
    _snapshotSentCount++;

    const sprites = snap.sprites ? snap.sprites.length : 0;

    // Rough size estimate: base overhead + 1 "byte" per pixel index.
    let approxBytes = 0;
    if (snap.sprites) {
        for (const s of snap.sprites) {
            if (!s) continue;
            approxBytes += 32; // ids / coords / kind / etc.
            if (s.pixels && s.pixels.length) {
                approxBytes += s.pixels.length;
            }
        }
    }

    _snapshotPerfAccumSnaps++;
    _snapshotPerfAccumBytes += approxBytes;

    // Periodic perf report (~every 2 seconds)
    const sinceReport = now - _snapshotPerfLastReportMs;
    if (_snapshotPerfLastReportMs === 0) {
        _snapshotPerfLastReportMs = now;
    } else if (sinceReport >= 2000) {
        const snapsPerSec =
            (_snapshotPerfAccumSnaps * 1000) / Math.max(1, sinceReport);
        const kbPerSec =
            (_snapshotPerfAccumBytes * 1000) / Math.max(1, sinceReport) / 1024;

        console.log(
            "[net.host] PERF",
            "Hz≈",
            snapsPerSec.toFixed(1),
            "KB/s≈",
            kbPerSec.toFixed(2),
            "latestSprites=",
            sprites
        );

        _snapshotPerfAccumSnaps = 0;
        _snapshotPerfAccumBytes = 0;
        _snapshotPerfLastReportMs = now;
    }


    // Light cadence log so you can correlate with follower if needed
    if (_snapshotSentCount <= 3 || _snapshotSentCount % 300 === 0) {
        console.log(
            "[net.host] snapshot #",
            _snapshotSentCount,
            "sprites=",
            sprites,
            "dtMs=",
            dt
        );
    }

    const snapT1 = _hostPerfNowMs()

    _hostPerfAccumSnapMs += (snapT1 - snapT0)

    // Keep track of how many sprites are in the snapshot
    try {
        if (snap && snap.sprites && snap.sprites.length != null) {
            _hostPerfLastSnapshotSprites = snap.sprites.length
        }
    } catch (e) {
        // ignore
    }

    _netClient.sendWorldSnapshot(snap);

    



}





// Expose to the game loop
(globalThis as any).__net_maybeSendWorldSnapshot = _maybeSendWorldSnapshotTick;




export function initNetwork() {
    const g: any = (globalThis as any);

    // HELLO identity once per tab session
    const token = _getOrCreateSessionToken();
    const desiredProfile = _getDesiredProfileForHello();

    g.__netHelloToken = token;
    g.__netHelloProfile = desiredProfile;

    // Step 8: host uses this to gate inputs for disconnected slots
    if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

    console.log("[net] initNetwork: connecting...", {
        token: token.slice(0, 8) + "…",
        desiredProfile: desiredProfile || null
    });

    _netClient.connect();
    (globalThis as any).__net = _netClient;
}



;(globalThis as any).__net_initNetwork = initNetwork;
