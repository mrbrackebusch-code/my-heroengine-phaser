import { DEBUG_STUDENT_OVERLAY_LOGS } from "../debugFlags";

export type OverlayId = string;

export type OverlayConfig = {
    id: OverlayId;
    html?: string;
    mountId?: string;
    className?: string;
    blocksInput?: boolean;
    visible?: boolean;
    style?: Partial<CSSStyleDeclaration>;
};

export type OverlayApi = {
    create: (cfg: OverlayConfig) => HTMLElement | null;
    show: (id: OverlayId) => void;
    hide: (id: OverlayId) => void;
    remove: (id: OverlayId) => void;
    setHtml: (id: OverlayId, html: string) => void;
    setVisible: (id: OverlayId, visible: boolean) => void;
    isVisible: (id: OverlayId) => boolean;
};

type OverlayEntry = {
    id: OverlayId;
    el: HTMLElement;
    blocksInput: boolean;
    visible: boolean;
    mountId?: string;
};

const _overlays = new Map<OverlayId, OverlayEntry>();
const _inputBlockers = new Set<OverlayId>();
let _pausedByOverlay = false;
let _visListenerInstalled = false;
const _bool = (v: boolean): number => (v ? 1 : 0);
const _logOverlay = (msg: string): void => {
    if (!DEBUG_STUDENT_OVERLAY_LOGS) return;
    console.log(msg);
};

function _ensureVisibilityListener(): void {
    if (_visListenerInstalled) return;
    if (typeof document === "undefined") return;
    _visListenerInstalled = true;
    document.addEventListener("visibilitychange", () => {
        _applyInputGate();
    });
}

function _resolveMount(mountId?: string): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const mount = mountId ? document.getElementById(mountId) : null;
    return mount || document.body;
}

function _ensureMountPositioned(mount: HTMLElement | null): void {
    if (!mount || typeof window === "undefined") return;
    if (mount === document.body) return;
    if (mount.dataset.heOverlayPositioned === "1") return;
    const style = window.getComputedStyle ? window.getComputedStyle(mount) : null;
    if (!style) return;
    if (!style.position || style.position === "static") {
        mount.style.position = "relative";
        mount.dataset.heOverlayPositioned = "1";
    }
}

function _rememberDisplay(el: HTMLElement): void {
    const cur = el.style.display;
    if (cur && cur !== "none") {
        el.dataset.heOverlayDisplay = cur;
        return;
    }
    if (typeof window === "undefined") return;
    const computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
    const next = computed ? computed.display : "";
    if (next && next !== "none") el.dataset.heOverlayDisplay = next;
}

function _applyVisible(el: HTMLElement, visible: boolean): void {
    if (visible) {
        const restore = el.dataset.heOverlayDisplay;
        if (restore) {
            el.style.display = restore;
        } else if (!el.style.display || el.style.display === "none") {
            el.style.display = "block";
        }
        return;
    }
    _rememberDisplay(el);
    el.style.display = "none";
}

function _syncInputGate(entry: OverlayEntry): void {
    const shouldBlock = entry.visible && entry.blocksInput;
    if (shouldBlock) _inputBlockers.add(entry.id);
    else _inputBlockers.delete(entry.id);
    _applyInputGate();
}

function _applyInputGate(): void {
    const shouldBlock = _inputBlockers.size > 0;
    const g: any = globalThis as any;
    const he: any = g ? g.HeroEngine : null;
    if (!he || typeof he.setPaused !== "function") return;

    if (shouldBlock) {
        if (_pausedByOverlay) return;
        _logOverlay(`[OVERLAY][GATE] pause=1 blockers=${_inputBlockers.size}`);
        he.setPaused(true, "overlay");
        _pausedByOverlay = true;
        return;
    }

    if (!_pausedByOverlay) return;
    if (typeof document !== "undefined" && document.hidden) return;
    _logOverlay(`[OVERLAY][GATE] pause=0 blockers=${_inputBlockers.size}`);
    he.setPaused(false, "overlay");
    _pausedByOverlay = false;
}

function _resolveEntry(id: OverlayId): OverlayEntry | null {
    const key = String(id || "").trim();
    if (!key) return null;
    const cached = _overlays.get(key);
    if (cached && cached.el && cached.el.id === key) return cached;
    if (typeof document === "undefined") return cached || null;
    const el = document.getElementById(key) as HTMLElement | null;
    if (!el) {
        if (cached) _overlays.delete(key);
        return null;
    }
    const blocks = el.dataset.heBlocksInput === "1";
    const visible = el.style.display !== "none";
    const entry: OverlayEntry = { id: key, el, blocksInput: blocks, visible, mountId: el.parentElement?.id };
    _overlays.set(key, entry);
    return entry;
}

export function createOverlay(cfg: OverlayConfig): HTMLElement | null {
    if (typeof document === "undefined") return null;
    const id = String(cfg?.id || "").trim();
    if (!id) return null;

    _ensureVisibilityListener();

    let entry = _resolveEntry(id);
    const isNew = !entry;
    let el = entry ? entry.el : null;
    const mountId = cfg.mountId;

    if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.right = "0";
        el.style.bottom = "0";
        el.dataset.heOverlay = "1";
    }

    if (cfg.className != null) el.className = cfg.className;
    if (typeof cfg.html === "string") el.innerHTML = cfg.html;
    if (cfg.style) Object.assign(el.style, cfg.style);

    const mount = _resolveMount(mountId);
    if (mount) {
        _ensureMountPositioned(mount);
        if (el.parentElement !== mount) mount.appendChild(el);
    }

    const nextBlocks = cfg.blocksInput != null ? !!cfg.blocksInput : (entry ? entry.blocksInput : false);
    const nextVisible = cfg.visible != null ? !!cfg.visible : (entry ? entry.visible : true);

    el.dataset.heBlocksInput = nextBlocks ? "1" : "0";
    if (cfg.visible != null || !entry) _applyVisible(el, nextVisible);

    if (!entry) {
        entry = { id, el, blocksInput: nextBlocks, visible: nextVisible, mountId };
        _overlays.set(id, entry);
    } else {
        entry.el = el;
        entry.blocksInput = nextBlocks;
        entry.visible = nextVisible;
        entry.mountId = mountId || entry.mountId;
    }

    _syncInputGate(entry);
    if (isNew) {
        const mountLabel = mountId || ((mount && mount === document.body) ? "body" : (mount?.id || ""));
        _logOverlay(`[OVERLAY] create id=${id} visible=${_bool(nextVisible)} blocksInput=${_bool(nextBlocks)} mount=${mountLabel}`);
    }
    return el;
}

export function getOverlay(id: OverlayId): HTMLElement | null {
    const entry = _resolveEntry(id);
    return entry ? entry.el : null;
}

export function showOverlay(id: OverlayId): void {
    setOverlayVisible(id, true);
}

export function hideOverlay(id: OverlayId): void {
    setOverlayVisible(id, false);
}

export function removeOverlay(id: OverlayId): void {
    const entry = _resolveEntry(id);
    if (!entry) return;
    if (entry.el.parentElement) entry.el.parentElement.removeChild(entry.el);
    _overlays.delete(entry.id);
    _inputBlockers.delete(entry.id);
    _applyInputGate();
    _logOverlay(`[OVERLAY] remove id=${entry.id}`);
}

export function setOverlayHtml(id: OverlayId, html: string): void {
    const entry = _resolveEntry(id);
    if (!entry) return;
    entry.el.innerHTML = String(html ?? "");
}

export function setOverlayVisible(id: OverlayId, visible: boolean): void {
    const entry = _resolveEntry(id);
    if (!entry) return;
    const next = !!visible;
    if (entry.visible === next) return;
    entry.visible = next;
    _applyVisible(entry.el, next);
    _syncInputGate(entry);
    _logOverlay(`[OVERLAY] ${next ? "show" : "hide"} id=${entry.id} blocksInput=${_bool(entry.blocksInput)}`);
}

export function isOverlayVisible(id: OverlayId): boolean {
    const entry = _resolveEntry(id);
    return entry ? entry.visible : false;
}

export const overlayManager: OverlayApi = {
    create: createOverlay,
    show: showOverlay,
    hide: hideOverlay,
    remove: removeOverlay,
    setHtml: setOverlayHtml,
    setVisible: setOverlayVisible,
    isVisible: isOverlayVisible,
};
