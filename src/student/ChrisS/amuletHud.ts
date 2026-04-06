/**
 * amuletHud.ts — ChrisS
 *
 * Two HUD features:
 * 1. Rich hover tooltip for amulet relic icons in the relic bar (full stats list).
 * 2. Cooldown / move-counter panel in the top-right corner of the viewport.
 */

import { AMULETS, type AmuletDefinition } from "./amuletData";
import { getAmuletHudSnapshot } from "./amuletEffects";

// ─── lookup ──────────────────────────────────────────────────────────────────

const _amuletById = new Map<string, AmuletDefinition>();
for (const a of AMULETS) _amuletById.set(a.id, a);

function _colorForAmulet(a: AmuletDefinition): string {
    switch (a.color) {
        case "blue":   return "#4a9eff";
        case "white":  return "#e0e0e0";
        case "red":    return "#ff6644";
        case "purple": return "#bb66ff";
        case "brown":  return "#b8945a";
        default:       return "#cccccc";
    }
}

// ─── tiny DOM helper ─────────────────────────────────────────────────────────

function _el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    css: string,
    parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.style.cssText = css;
    parent?.appendChild(e);
    return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  RICH HOVER TOOLTIP
// Intercepts mouseover on .xp-relic elements that hold amulet relic IDs and
// shows a custom tooltip that mirrors the selection-UI stats list.
// ─────────────────────────────────────────────────────────────────────────────

let _tipEl: HTMLDivElement | null = null;
let _tipActive = false;

function _buildTip(): void {
    if (_tipEl) return;
    const vp = document.getElementById("viewport");
    if (!vp) return;

    _tipEl = _el("div", `
        position: absolute;
        z-index: 99999;
        display: none;
        pointer-events: none;
        max-width: 260px;
        min-width: 180px;
        padding: 10px 13px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(14,14,20,0.97);
        color: rgba(255,255,255,0.93);
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        box-shadow: 0 6px 22px rgba(0,0,0,0.55);
    `);
    vp.appendChild(_tipEl);
}

function _showTip(amulet: AmuletDefinition, x: number, y: number): void {
    if (!_tipEl) return;

    const color = _colorForAmulet(amulet);

    const statLines = amulet.stats
        .map(s => `<div style="margin:2px 0 2px 8px; color:#ddd;">• ${_esc(s)}</div>`)
        .join("");

    _tipEl.innerHTML = `
        <div style="font-weight:800; font-size:13px; color:${color}; margin-bottom:5px;">
            ${_esc(amulet.name)}
        </div>
        <div style="font-weight:700; font-size:11px; color:#ffff88; margin-bottom:3px;">Stats</div>
        ${statLines}
        ${amulet.flavorText
            ? `<div style="margin-top:7px; font-size:11px; opacity:0.6; font-style:italic;">
                   "${_esc(amulet.flavorText)}"
               </div>`
            : ""}
    `;

    _positionTip(x, y);
    _tipEl.style.display = "block";
    _tipActive = true;

    // Hide the engine's native relic-tooltip while ours is shown
    try {
        const native = document.getElementById("relic-tooltip");
        if (native) native.style.visibility = "hidden";
    } catch { /* ignore */ }
}

function _hideTip(): void {
    if (_tipEl) _tipEl.style.display = "none";
    _tipActive = false;
    try {
        const native = document.getElementById("relic-tooltip");
        if (native) native.style.visibility = "";
    } catch { /* ignore */ }
}

function _positionTip(clientX: number, clientY: number): void {
    if (!_tipEl) return;
    const vp = document.getElementById("viewport");
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const pad = 12;
    let x = clientX - rect.left + pad;
    let y = clientY - rect.top + pad;
    const w = _tipEl.offsetWidth || 0;
    const h = _tipEl.offsetHeight || 0;
    if (x + w > rect.width)  x = Math.max(0, rect.width - w - pad);
    if (y + h > rect.height) y = Math.max(0, rect.height - h - pad);
    _tipEl.style.left = `${x}px`;
    _tipEl.style.top  = `${y}px`;
}

function _esc(s: string): string {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function _installTooltipListeners(): void {
    const relicsBox = document.getElementById("xp-relics-box");
    if (!relicsBox) return;

    relicsBox.addEventListener("mousemove", (e) => {
        const target = (e.target as Element)?.closest?.(".xp-relic") as HTMLElement | null;
        if (!target) { _hideTip(); return; }
        const rid = target.getAttribute("data-relic-id") || "";
        const amulet = _amuletById.get(rid);
        if (!amulet) { _hideTip(); return; }
        _showTip(amulet, e.clientX, e.clientY);
    });

    relicsBox.addEventListener("mouseleave", () => _hideTip());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  COOLDOWN / COUNTER HUD  (top-right corner, above the canvas)
// ─────────────────────────────────────────────────────────────────────────────

let _hudEl: HTMLDivElement | null = null;
let _hudInterval = 0;

type AbilityEntry = {
    label: string;
    type: "cooldown" | "counter";
    cooldownMs: number;
    neededCount: number;
    /** returns { readyAt (ms epoch), current (count) } from the live snapshot */
    read: () => { readyAt: number; current: number };
};

type AmuletHudCfg = {
    amuletId: string;
    color: string;
    abilities: AbilityEntry[];
};

const _hudConfigs: AmuletHudCfg[] = (() => {
    const snap = getAmuletHudSnapshot();
    return [
        {
            amuletId: "amulet_water",
            color: "#4a9eff",
            abilities: [
                {
                    label: "Tide Wave",
                    type: "counter",
                    cooldownMs: 5000,
                    neededCount: 5,
                    read: () => ({
                        readyAt: snap.tides.lastTideTime + 5000,
                        current: snap.tides.strengthMoveCount,
                    }),
                },
                {
                    label: "Bubble Trap",
                    type: "cooldown",
                    cooldownMs: 7000,
                    neededCount: 0,
                    read: () => ({ readyAt: snap.tides.lastBubbleTime + 7000, current: 0 }),
                },
            ],
        },
        {
            amuletId: "amulet_wind",
            color: "#cccccc",
            abilities: [
                {
                    label: "Tornado",
                    type: "cooldown",
                    cooldownMs: 6000,
                    neededCount: 0,
                    read: () => ({ readyAt: snap.zephyrs.lastTornadoTime + 6000, current: 0 }),
                },
            ],
        },
        {
            amuletId: "amulet_fire",
            color: "#ff6644",
            abilities: [
                {
                    label: "Combo Stun",
                    type: "counter",
                    cooldownMs: 7000,
                    neededCount: 3,
                    read: () => ({
                        readyAt: snap.embers.lastStunTime + 7000,
                        current: snap.embers.strengthMoveCount,
                    }),
                },
            ],
        },
        {
            amuletId: "amulet_poison",
            color: "#bb66ff",
            abilities: [
                {
                    label: "Poison Area",
                    type: "cooldown",
                    cooldownMs: 5000,
                    neededCount: 0,
                    read: () => ({ readyAt: snap.venom.lastPoisonAreaTime + 5000, current: 0 }),
                },
            ],
        },
        {
            amuletId: "amulet_earth",
            color: "#b8945a",
            abilities: [
                {
                    label: "360° Knockback",
                    type: "cooldown",
                    cooldownMs: 4000,
                    neededCount: 0,
                    read: () => ({ readyAt: snap.stones.lastKnockbackTime + 4000, current: 0 }),
                },
                {
                    label: "Rock Drop",
                    type: "cooldown",
                    cooldownMs: 12000,
                    neededCount: 0,
                    read: () => ({ readyAt: snap.stones.lastRockDropTime + 12000, current: 0 }),
                },
            ],
        },
    ];
})();

function _getLocalAmuletId(): string | null {
    try {
        const els = document.querySelectorAll<HTMLElement>("#xp-relics-box .xp-relic[data-relic-id]");
        for (const el of els) {
            const id = el.getAttribute("data-relic-id") || "";
            if (_amuletById.has(id)) return id;
        }
    } catch { /* ignore */ }
    return null;
}

function _buildCooldownHud(): void {
    if (_hudEl) return;
    const vp = document.getElementById("viewport");
    if (!vp) return;

    _hudEl = _el("div", `
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 9500;
        pointer-events: none;
        font-family: Arial, sans-serif;
        font-size: 11px;
        min-width: 130px;
        display: none;
    `);
    vp.appendChild(_hudEl);
}

function _renderHud(amuletId: string, cfg: AmuletHudCfg): void {
    if (!_hudEl) return;
    const now = Date.now();

    let html = `
        <div style="
            background: rgba(10,10,16,0.88);
            border: 1px solid ${cfg.color}55;
            border-radius: 8px;
            padding: 6px 9px 5px;
        ">
            <div style="color:${cfg.color}; font-weight:800; font-size:12px; margin-bottom:5px; letter-spacing:.3px;">
                ${_esc(_amuletById.get(amuletId)?.name ?? "Amulet")}
            </div>`;

    for (const ab of cfg.abilities) {
        const { readyAt, current } = ab.read();
        const remainMs = Math.max(0, readyAt - now);
        const isReady  = remainMs <= 0;

        if (ab.type === "counter") {
            const pct = Math.min(1, current / Math.max(1, ab.neededCount));
            const barW = Math.round(pct * 100);
            const counterReady = (ab.neededCount > 0) && (current >= ab.neededCount) && isReady;
            html += `
                <div style="margin-bottom:4px;">
                    <div style="color:#bbb; font-size:10px; margin-bottom:2px;">
                        ${_esc(ab.label)}
                        <span style="float:right; color:${counterReady ? "#88ff88" : "#ffdd66"}; font-weight:700;">
                            ${counterReady ? "READY!" : `${current}/${ab.neededCount} hits`}
                        </span>
                    </div>
                    <div style="
                        height:4px; background:#333; border-radius:2px; overflow:hidden;
                    ">
                        <div style="
                            height:100%; width:${barW}%;
                            background:${counterReady ? "#88ff88" : cfg.color};
                            border-radius:2px; transition:width .15s;
                        "></div>
                    </div>
                </div>`;
        } else {
            const secs = Math.ceil(remainMs / 1000);
            const cdPct = isReady ? 100 : Math.round((1 - remainMs / Math.max(1, ab.cooldownMs)) * 100);
            html += `
                <div style="margin-bottom:4px;">
                    <div style="color:#bbb; font-size:10px; margin-bottom:2px;">
                        ${_esc(ab.label)}
                        <span style="float:right; color:${isReady ? "#88ff88" : "#e8c060"}; font-weight:700;">
                            ${isReady ? "READY!" : `${secs}s`}
                        </span>
                    </div>
                    <div style="height:4px; background:#333; border-radius:2px; overflow:hidden;">
                        <div style="
                            height:100%; width:${cdPct}%;
                            background:${isReady ? "#88ff88" : cfg.color};
                            border-radius:2px; transition:width .1s;
                        "></div>
                    </div>
                </div>`;
        }
    }

    html += `</div>`;
    _hudEl.innerHTML = html;
    _hudEl.style.display = "block";
}

function _updateHud(): void {
    if (!_hudEl) return;
    const amuletId = _getLocalAmuletId();
    if (!amuletId) {
        _hudEl.style.display = "none";
        return;
    }
    const cfg = _hudConfigs.find(c => c.amuletId === amuletId);
    if (!cfg) { _hudEl.style.display = "none"; return; }
    _renderHud(amuletId, cfg);
}

function _startHudPolling(): void {
    if (_hudInterval) return;
    _hudInterval = window.setInterval(_updateHud, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC INIT
// ─────────────────────────────────────────────────────────────────────────────

let _inited = false;

export function initAmuletHud(): void {
    if (_inited) return;

    // DOM may not exist yet if called early — wait until it is ready
    const tryInit = () => {
        const vp = document.getElementById("viewport");
        const relicsBox = document.getElementById("xp-relics-box");
        if (!vp || !relicsBox) {
            // retry shortly
            setTimeout(tryInit, 300);
            return;
        }
        _inited = true;
        _buildTip();
        _installTooltipListeners();
        _buildCooldownHud();
        _startHudPolling();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryInit);
    } else {
        tryInit();
    }
}
