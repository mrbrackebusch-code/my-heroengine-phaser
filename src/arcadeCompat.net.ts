/**
 * arcadeCompat.net.ts — extracted networking + identity + roster logic
 * NOTE: This module is loaded via re-export from arcadeCompat.ts.
 * It intentionally uses globalThis.{sprites,game,...} to avoid importing the full compat surface.
 */

// Type-only shim: WorldSnapshot type is defined in arcadeCompat.ts; we keep this file decoupled.

import { DEBUG_NET, DEBUG_NET_SNAPSHOT, DEBUG_TILEMAP_COMPAT } from "./debugFlags";


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
// Net module local debug + thresholds (from src/debugFlags.ts)
// ------------------------------------------------------------

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

    // Allow any non-empty profile name; server will validate against assets.
    return s;
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
    | { type: "helloError"; reason: string; profile?: string | null }
    | { type: "saveGame"; payload: any }
    | { type: "coinBurst"; playerId?: number; bursts: Array<{ x: number; y: number; count: number; pid?: number }>; serverSentAt?: number }
    | {
          type: "dialog";
          action: "show" | "hide";
          dialog?: { speaker?: string; text?: string; hint?: string; autoHideMs?: number } | null;
          targetPlayerId?: number | null;
      }
    | { type: "uiCommand"; requestId: string; playerId: number; cmd: any }
    | { type: "uiCommandForward"; requestId: string; fromToken: string; playerId: number; cmd: any }
    | { type: "uiCommandResult"; requestId: string; toToken?: string | null; playerId?: number | null; ok?: boolean; reason?: string | null; snapshot?: any }
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
          worldRev?: number;
          floorIndex?: number;
          floorKind?: string;
          baseFamily?: string;
          wallFamily?: string;
          decorOnly?: boolean;
          decor?: { rev: number; decals?: number[][]; props?: Array<{ r: number; c: number; name?: string; role?: number; id?: number }> };
          baseSig?: number;
          decorSig?: number;
          worldSig?: number;
      }
    | {
          type: "tilemap";
          rev: number;
          tileSize: number;
          rows: number;
          cols: number;
          encoding: "rle" | "u8b64";
          data: string;
          worldRev?: number;
          floorIndex?: number;
          floorKind?: string;
          baseFamily?: string;
          wallFamily?: string;
          decorOnly?: boolean;
          decor?: { rev: number; decals?: number[][]; props?: Array<{ r: number; c: number; name?: string; role?: number; id?: number }> };
          baseSig?: number;
          decorSig?: number;
          worldSig?: number;
      };
    






class NetworkClient {
    private ws: WebSocket | null = null;
    playerId: number | null = null;
    url: string;

    // NEW: per-client monotonically increasing input sequence
    private inputSeq: number = 0;

    // Host flag as reported by the server (authoritative)
    private _isHostFromServer: boolean = false;

    // Pending UI command resolvers (follower -> host RPC)
    private uiCmdResolvers: Map<string, (res: any) => void> = new Map();

    // Latest tilemap revision we've accepted (monotonic)
    private _tilemapRev: number = 0;


    constructor(url: string) {
        this.url = url;
    }

    private _wsStateName(s: number | null): string {
        if (s === WebSocket.CONNECTING) return "CONNECTING";
        if (s === WebSocket.OPEN) return "OPEN";
        if (s === WebSocket.CLOSING) return "CLOSING";
        if (s === WebSocket.CLOSED) return "CLOSED";
        return "UNKNOWN";
    }

    private _logNetDiagnostic(tag: string, detail: string, ev?: any) {
        const g: any = (globalThis as any);
        const token: string = (typeof g.__netHelloToken === "string") ? g.__netHelloToken : "";
        const profile: string | null = (typeof g.__netHelloProfile === "string") ? g.__netHelloProfile : null;
        const pid = (this.playerId == null) ? "n/a" : String(this.playerId);
        const ws = this.ws;
        const state = ws ? ws.readyState : -1;
        const stateName = this._wsStateName(state);
        const url = ws ? ws.url : this.url;
        const ts = new Date().toISOString();
        const pageOrigin = (typeof location !== "undefined" && (location as any).origin) ? (location as any).origin : "";
        const pageHost = (typeof location !== "undefined" && (location as any).hostname) ? (location as any).hostname : "";

        let evMsg = "";
        try {
            if (ev && (ev as any).message) evMsg = String((ev as any).message);
            else if (ev && (ev as any).reason) evMsg = String((ev as any).reason);
            else if (ev && typeof (ev as any).type === "string") evMsg = String((ev as any).type);
        } catch (_e) { evMsg = ""; }

        const summary =
            `[net.${tag}] ts=${ts} url=${url} state=${state}(${stateName})` +
            ` pid=${pid} token=${token ? token.slice(0, 8) + "…" : "none"}` +
            ` profile=${profile || "none"} detail=${detail}` +
            (pageOrigin ? ` origin=${pageOrigin}` : "") +
            (pageHost ? ` pageHost=${pageHost}` : "") +
            (evMsg ? ` evMsg=${evMsg}` : "");

        console.warn(summary);
    }

    private onHelloError(msg: Extract<NetMessage, { type: "helloError" }>) {
        const g: any = (globalThis as any);
        g.__netHelloError = msg;

        const profile = (typeof msg.profile === "string" && msg.profile.trim()) ? msg.profile.trim() : null;
        const reason = msg.reason || "unknown";
        const txt = profile
            ? `Profile "${profile}" is already in use. (${reason})`
            : `HELLO rejected: ${reason}`;

        console.error("[net] helloError", msg);
        try { alert(txt); } catch (_e) {}

        if (this.ws) {
            try { this.ws.close(1008, "helloError"); } catch (_e) {}
        }
    }



    connect() {
        if (this.ws) return;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            if (DEBUG_NET) {
                console.log("[net] connected to", this.url);
            }

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

                if (DEBUG_NET) {
                    console.log("[net] hello sent", {
                        token: token.slice(0, 8) + "…",
                        desiredProfile: desiredProfile || null
                    });
                }
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

        ws.onclose = (evt: any) => {
            const code = (evt && typeof evt.code === "number") ? evt.code : null;
            const reason = (evt && typeof evt.reason === "string") ? evt.reason : "";
            const clean = (evt && typeof evt.wasClean === "boolean") ? evt.wasClean : null;
            this._logNetDiagnostic(
                "close",
                `code=${code} clean=${clean} reason=${reason || "(none)"}`,
                evt
            );
            this.ws = null;
        };

        ws.onerror = (ev: any) => {
            const ready = this.ws ? this.ws.readyState : -1;
            const url = this.ws ? this.ws.url : this.url;
            const type = ev && typeof ev.type === "string" ? ev.type : "";
            const msg = ev && (ev as any).message ? String((ev as any).message) : "";
            const pageHost = (typeof location !== "undefined" && (location as any).hostname) ? (location as any).hostname : "";
            const pagePort = (typeof location !== "undefined" && (location as any).port) ? (location as any).port : "";
            // Compose a verbose, single-string diagnostic for refusals / network errors.
            const detail = [
                `wsState=${ready}(${this._wsStateName(ready)})`,
                `url=${url}`,
                pageHost ? `pageHost=${pageHost}` : "",
                pagePort ? `pagePort=${pagePort}` : "",
                type ? `type=${type}` : "",
                msg ? `msg=${msg}` : "",
                "hint=If ERR_CONNECTION_REFUSED: no listener on host:port, or firewall/WSL port-forwarding blocking 8080.",
            ].filter(Boolean).join(" ");
            this._logNetDiagnostic("error", detail, ev);
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

    // Host uses this to persist saves on the server
    sendSaveGame(payload: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.isHostNow()) return;
        const msg: NetMessage = { type: "saveGame", payload };
        this.ws.send(JSON.stringify(msg));
    }

    // Host uses this to broadcast dialog to followers
    sendDialog(action: "show" | "hide", dialog?: any, targetPlayerId?: number | null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.isHostNow()) return;
        const msg: NetMessage = {
            type: "dialog",
            action,
            dialog: dialog ?? null,
            targetPlayerId: targetPlayerId ?? null
        };
        this.ws.send(JSON.stringify(msg));
    }

    // Followers (and host if desired) can issue UI commands via host
    sendUiCommand(cmd: any): Promise<any> {
        const requestId = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const playerId = (this.playerId == null) ? 0 : (this.playerId | 0);

        const msg: NetMessage = {
            type: "uiCommand",
            requestId,
            playerId,
            cmd: cmd || {},
        };

        return new Promise((resolve) => {
            // Resolve on timeout to avoid dangling promises
            const timeout = setTimeout(() => {
                if (this.uiCmdResolvers.has(requestId)) {
                    this.uiCmdResolvers.delete(requestId);
                    resolve({ ok: false, reason: "timeout" });
                }
            }, 2000);

            this.uiCmdResolvers.set(requestId, (res: any) => {
                clearTimeout(timeout);
                resolve(res);
            });

            try {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(msg));
                } else {
                    this.uiCmdResolvers.delete(requestId);
                    clearTimeout(timeout);
                    resolve({ ok: false, reason: "ws-closed" });
                }
            } catch (e: any) {
                this.uiCmdResolvers.delete(requestId);
                clearTimeout(timeout);
                resolve({ ok: false, reason: String(e?.message || "send-failed") });
            }
        });
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

        case "helloError":
            this.onHelloError(msg);
            return;

        case "coinBurst":
            this.onCoinBurst(msg as any);
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

        case "uiCommandForward":
            this.onUiCommandForward(msg as any);
            return;

        case "uiCommandResult":
            this.onUiCommandResult(msg as any);
            return;

        case "dialog":
            this.onDialog(msg as any);
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

        if (DEBUG_NET) {
            console.log("[net] assigned playerId =", this.playerId, "name=", msg.name, "profile=", msg.profile);
            try {
                const token = typeof g.__netHelloToken === "string" ? g.__netHelloToken : "";
                const desiredProfile = typeof g.__netHelloProfile === "string" ? g.__netHelloProfile : null;
                console.log("[net.assign.debug]", {
                    playerId: this.playerId,
                    token: token ? token.slice(0, 8) + "…" : null,
                    desiredProfile,
                    serverProfile: msg.profile || null,
                    controlSlot: msg.controlSlot ?? null
                });
            } catch (_e) { /* ignore */ }
        }

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

    if (DEBUG_NET) {
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

        if (DEBUG_NET && (changed || isReconnect || isHost)) {
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

        // Host-only: despawn hero when disconnected; respawn handled by ensureHeroForPlayer on connect
        if (isHost && !connected) {
            try {
                const internals = g.__HeroEnginePhaserInternals;
                const despawnFn = internals && typeof internals.despawnHeroForPlayer === "function" ? internals.despawnHeroForPlayer : null;
                if (despawnFn) {
                    const ok = despawnFn(playerId);
                    if (ok && DEBUG_NET) console.log("[net.playerState] despawned hero for pid", playerId);
                }
            } catch (e) {
                console.warn("[net.playerState] despawnHeroForPlayer error pid=", playerId, e);
            }
        }

    // Host-only: despawn hero when disconnected; respawn handled by ensureHeroForPlayer on connect
    if (isHost && !connected) {
        try {
            const internals = g.__HeroEnginePhaserInternals;
            const despawnFn = internals && typeof internals.despawnHeroForPlayer === "function" ? internals.despawnHeroForPlayer : null;
            if (despawnFn) {
                const ok = despawnFn(playerId);
                if (ok && DEBUG_NET) console.log("[net.playerState] despawned hero for pid", playerId);
            }
        } catch (e) {
            console.warn("[net.playerState] despawnHeroForPlayer error pid=", playerId, e);
        }
    }

    if (DEBUG_NET) {
        console.log("[net.playerState.debug]", {
            pid: playerId,
            slotIndex,
            connected,
            prevConnected,
            profile: profile || prevProfile || null,
            controlSlot: msg.controlSlot ?? null,
            host: isHost
        });
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
                if (DEBUG_NET && heroIndex >= 0) {
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

        if (DEBUG_NET) {
            console.log("[net] hostStatus =", isHost, "hostPlayerId=", (msg && msg.hostPlayerId != null) ? msg.hostPlayerId : null);
        }

        // Host-only hook (e.g., apply pending save)
        if (isHost) {
            const hook = (g as any).__onHostBecameHost;
            if (typeof hook === "function") {
                try { hook(); } catch (e) { console.warn("[net] __onHostBecameHost error", e); }
            }
        }

        // If this client is host, kick off the HeroEngine host loop
        if (isHost && typeof g.__startHeroEngineHost === "function") {
            g.__startHeroEngineHost();

            // playerState may have arrived before HeroEngineInPhaser internals exist
            _flushEnsureHeroesIfPossible();
            setTimeout(() => _flushEnsureHeroesIfPossible(), 0);
        }

        if (DEBUG_NET) {
            console.log("[net] hostStatus change", {
                isHost,
                hostPlayerId: (msg && msg.hostPlayerId != null) ? msg.hostPlayerId : null,
                myPlayerId: this.playerId,
                token: (() => {
                    const gAny: any = (globalThis as any);
                    const t = typeof gAny.__netHelloToken === "string" ? gAny.__netHelloToken : "";
                    return t ? t.slice(0, 8) + "…" : null;
                })(),
                profile: (() => {
                    const gAny: any = (globalThis as any);
                    const p = typeof gAny.__netHelloProfile === "string" ? gAny.__netHelloProfile : null;
                    return p;
                })()
            });
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
                if (DEBUG_TILEMAP_COMPAT) {
                    console.log(">>> [net.tilemap] received; forwarding to Phaser hook", info);
                }
                hook(msg);
            } catch (e) {
                console.error(">>> [net.tilemap] __onNetTilemap ERROR:", e);
            }
        } else {
            if (DEBUG_TILEMAP_COMPAT) {
                console.warn(
                    ">>> [net.tilemap] received but __onNetTilemap not installed yet; cached in globalThis.__lastTilemapMsg",
                    info
                );
            }
        }
    }


    private onCoinBurst(msg: Extract<NetMessage, { type: "coinBurst" }>) {
        const g: any = (globalThis as any);
        const isHost = this.isHostNow();

        // Host already spawned the local effect; ignore echoed bursts.
        if (isHost) {
            const sender = (typeof (msg as any).playerId === "number") ? ((msg as any).playerId | 0) : 0;
            if (sender > 0 && (this.playerId | 0) === sender) return;
        }

        const bursts: any[] = Array.isArray((msg as any).bursts) ? (msg as any).bursts : [];
        if (!bursts.length) return;

        if (!Array.isArray(g.__coinBurstQueue)) g.__coinBurstQueue = [];

        for (const b of bursts) {
            if (!b) continue;
            const x = (typeof b.x === "number") ? b.x : NaN;
            const y = (typeof b.y === "number") ? b.y : NaN;
            const count = (typeof b.count === "number") ? (b.count | 0) : 0;
            const pid = (typeof b.pid === "number") ? (b.pid | 0) : 0;

            if (!isFinite(x) || !isFinite(y)) continue;
            if (count <= 0) continue;

            g.__coinBurstQueue.push({ x, y, count, pid });
        }
    }

    private onUiCommandForward(msg: any) {
        // Only host should handle forwarded UI commands
        if (!this.isHostNow()) return;

        const g: any = (globalThis as any);
        const fn = (g && typeof g.__heUiCommand === "function") ? g.__heUiCommand : null;

        let out: any = { ok: false, reason: "no-handler", snapshot: null };
        try {
            if (fn) {
                const res = fn(Object.assign({ playerId: msg.playerId | 0 }, msg.cmd || {}));
                if (res) out = res;
            }
        } catch (e: any) {
            out = { ok: false, reason: String(e?.message || "ui-error"), snapshot: null };
        }

        const reply: NetMessage = {
            type: "uiCommandResult",
            requestId: msg.requestId,
            toToken: msg.fromToken || null,
            playerId: msg.playerId || null,
            ok: !!out.ok,
            reason: (typeof out.reason === "string") ? out.reason : null,
            snapshot: out.snapshot ?? null,
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try { this.ws.send(JSON.stringify(reply)); } catch (_e) { /* ignore */ }
        }
    }

    private onUiCommandResult(msg: any) {
        const resolver = this.uiCmdResolvers.get(msg.requestId);
        if (resolver) {
            this.uiCmdResolvers.delete(msg.requestId);
            resolver(msg);
        }
    }

    private onDialog(msg: any) {
        const g: any = (globalThis as any);
        const fn = (g && typeof g.__heDialogFromNet === "function") ? g.__heDialogFromNet : null;
        if (fn) {
            try { fn(msg); } catch { /* ignore */ }
            return;
        }

        const dlg = g ? g.__heDialog : null;
        const action = (msg && typeof msg.action === "string") ? msg.action : "";
        if (!dlg) return;
        try {
            if (action === "show" && typeof dlg.show === "function") {
                const d = msg.dialog || {};
                dlg.show({
                    speaker: d.speaker || "",
                    text: d.text || "",
                    hint: d.hint || ""
                });
            } else if (action === "hide" && typeof dlg.hide === "function") {
                dlg.hide();
            }
        } catch { /* ignore */ }
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
const wsPort = (window as any).__GAME_WS_PORT || 8080;
const _netClient = new NetworkClient(`ws://${host}:${wsPort}`);

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

        if (DEBUG_NET_SNAPSHOT) {
            console.log(
                "[net.host] PERF",
                "Hz≈",
                snapsPerSec.toFixed(1),
                "KB/s≈",
                kbPerSec.toFixed(2),
                "latestSprites=",
                sprites
            );
        }

        _snapshotPerfAccumSnaps = 0;
        _snapshotPerfAccumBytes = 0;
        _snapshotPerfLastReportMs = now;
    }


    // Light cadence log so you can correlate with follower if needed
    if (DEBUG_NET_SNAPSHOT && (_snapshotSentCount <= 3 || _snapshotSentCount % 300 === 0)) {
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

    const desiredProfile = _getDesiredProfileForHello();
    if (!desiredProfile) {
        console.warn("[net] profile missing; network not started (set ?profile= first)");
        return;
    }

    // HELLO identity once per tab session
    const token = _getOrCreateSessionToken();

    g.__netHelloToken = token;
    g.__netHelloProfile = desiredProfile;

    // Step 8: host uses this to gate inputs for disconnected slots
    if (!g.__netSlotConnected) g.__netSlotConnected = [false, false, false, false];

    if (DEBUG_NET) {
        console.log("[net] initNetwork: connecting...", {
            token: token.slice(0, 8) + "…",
            desiredProfile: desiredProfile || null
        });
    }

    _netClient.connect();
    (globalThis as any).__net = _netClient;
}



;(globalThis as any).__net_initNetwork = initNetwork;
(globalThis as any).__net_sendSaveGame = function (payload: any) {
    try { _netClient.sendSaveGame(payload); } catch (_e) {}
};
