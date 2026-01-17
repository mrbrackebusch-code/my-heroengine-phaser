import * as Blockly from "blockly";
import "blockly/blocks";
import type { TrapSpec } from "./trapSchema";
import { getTrapSpecById } from "./trapSpecs";
import { getTrapXmlForId, runTrapBlockly, setTrapXmlForId } from "./blocklyTrapRuntime";

const OVERLAY_ID = "he-trap-blockly-overlay";
const HOST_ID = "he-trap-blockly-host";
const TITLE_ID = "he-trap-blockly-title";
const STATUS_ID = "he-trap-blockly-status";
const ANCHOR_BTN_ID = "he-trap-blockly-anchor";
const RESIZE_ID = "he-trap-blockly-resize";
const TOOLBOX_BTN_ID = "he-trap-blockly-toggle-toolbox";

type TrapAnchor = "bottom-right" | "bottom-left" | "top-right" | "top-left";
const TRAP_ANCHORS: TrapAnchor[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
const DEFAULT_ANCHOR: TrapAnchor = "bottom-right";
const DEFAULT_SIZE = { width: 520, height: 360 };
const MIN_SIZE = { width: 320, height: 220 };

const TRAP_TOOLBOX_BASE: any = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Operators",
      colour: "#59C059",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "math_modulo" },
        { kind: "block", type: "math_round" },
        { kind: "block", type: "math_random_int" },
      ],
    },
    {
      kind: "category",
      name: "Logic",
      colour: "#FFAB19",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "controls_ifelse" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      colour: "#FFAB19",
      contents: [
        { kind: "block", type: "controls_repeat_ext" },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for" },
        { kind: "block", type: "controls_forEach" },
        { kind: "block", type: "controls_flow_statements" },
      ],
    },
    {
      kind: "category",
      name: "Lists",
      colour: "#FF8C1A",
      contents: [
        { kind: "block", type: "lists_create_with" },
        { kind: "block", type: "lists_repeat" },
        { kind: "block", type: "lists_length" },
        { kind: "block", type: "lists_getIndex" },
        { kind: "block", type: "lists_setIndex" },
      ],
    },
    {
      kind: "category",
      name: "Text",
      colour: "#9966FF",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "text_join" },
        { kind: "block", type: "text_length" },
        { kind: "block", type: "text_print" },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      colour: "#FF8C1A",
      contents: [
        { kind: "block", type: "variables_set" },
        { kind: "block", type: "variables_get" },
        { kind: "block", type: "math_change" },
      ],
    },
    {
      kind: "category",
      name: "Functions",
      colour: "#FF6680",
      contents: [
        { kind: "block", type: "procedures_defreturn" },
        { kind: "block", type: "procedures_defnoreturn" },
        { kind: "block", type: "procedures_callreturn" },
        { kind: "block", type: "procedures_callnoreturn" },
      ],
    },
  ],
};

let _workspace: Blockly.WorkspaceSvg | null = null;
let _activeSpec: TrapSpec | null = null;
let _activeInputs: Record<string, unknown> | null = null;
let _trapTheme: Blockly.Theme | null = null;

function _getUiState(): { anchor: TrapAnchor; width: number; height: number; toolboxHidden: boolean } {
  const g: any = (globalThis as any);
  const anchor = (g.__heTrapBlocklyAnchor as TrapAnchor) || DEFAULT_ANCHOR;
  const size = g.__heTrapBlocklySize || {};
  const width = typeof size.width === "number" ? size.width : DEFAULT_SIZE.width;
  const height = typeof size.height === "number" ? size.height : DEFAULT_SIZE.height;
  const toolboxHidden = !!g.__heTrapBlocklyToolboxHidden;
  return { anchor, width, height, toolboxHidden };
}

function _setUiState(next: { anchor?: TrapAnchor; width?: number; height?: number; toolboxHidden?: boolean }): void {
  const g: any = (globalThis as any);
  if (next.anchor) g.__heTrapBlocklyAnchor = next.anchor;
  if (typeof next.width === "number" || typeof next.height === "number") {
    g.__heTrapBlocklySize = {
      width: typeof next.width === "number" ? next.width : g.__heTrapBlocklySize?.width,
      height: typeof next.height === "number" ? next.height : g.__heTrapBlocklySize?.height,
    };
  }
  if (typeof next.toolboxHidden === "boolean") g.__heTrapBlocklyToolboxHidden = next.toolboxHidden;
}

function _anchorLabel(anchor: TrapAnchor): string {
  switch (anchor) {
    case "top-left": return "Corner: TL";
    case "top-right": return "Corner: TR";
    case "bottom-left": return "Corner: BL";
    case "bottom-right": return "Corner: BR";
    default: return "Corner";
  }
}

function _toolboxLabel(hidden: boolean): string {
  return hidden ? "Show Sidebar" : "Hide Sidebar";
}

function _applyAnchor(overlay: HTMLElement, anchor: TrapAnchor): void {
  overlay.style.left = "";
  overlay.style.right = "";
  overlay.style.top = "";
  overlay.style.bottom = "";
  if (anchor.includes("left")) overlay.style.left = "10px";
  if (anchor.includes("right")) overlay.style.right = "10px";
  if (anchor.includes("top")) overlay.style.top = "10px";
  if (anchor.includes("bottom")) overlay.style.bottom = "10px";
}

function _applySize(panel: HTMLElement, width: number, height: number): void {
  const w = Math.max(MIN_SIZE.width, Math.floor(width));
  const h = Math.max(MIN_SIZE.height, Math.floor(height));
  panel.style.width = `${w}px`;
  panel.style.height = `${h}px`;
  _setUiState({ width: w, height: h });
  if (_workspace) {
    try { (_workspace as any).resizeContents?.(); } catch {}
    try { Blockly.svgResize(_workspace); } catch {}
  }
}

function _updateResizeHandle(handle: HTMLElement, anchor: TrapAnchor): void {
  handle.className = "he-trap-blockly-resize";
  if (anchor === "bottom-right") handle.classList.add("corner-tl");
  if (anchor === "bottom-left") handle.classList.add("corner-tr");
  if (anchor === "top-right") handle.classList.add("corner-bl");
  if (anchor === "top-left") handle.classList.add("corner-br");
}

function _applyToolboxVisibility(overlay: HTMLElement, hidden: boolean): void {
  const toolboxDiv = overlay.querySelector(".blocklyToolboxDiv") as HTMLElement | null;
  const flyoutDiv = overlay.querySelector(".blocklyFlyout") as HTMLElement | null;
  if (toolboxDiv) toolboxDiv.style.display = hidden ? "none" : "";
  if (flyoutDiv) flyoutDiv.style.display = hidden ? "none" : "";
  try {
    const tb = (_workspace as any)?.getToolbox?.();
    if (tb && typeof tb.setVisible === "function") tb.setVisible(!hidden);
  } catch {}
  if (_workspace) {
    try { (_workspace as any).resizeContents?.(); } catch {}
    try { Blockly.svgResize(_workspace); } catch {}
  }
}
function _getTrapTheme(): Blockly.Theme {
  if (_trapTheme) return _trapTheme;
  _trapTheme = Blockly.Theme.defineTheme("he_trap_scratch_like", {
    base: Blockly.Themes.Classic,
    blockStyles: {
      math_blocks: {
        colourPrimary: "#59C059",
        colourSecondary: "#46A046",
        colourTertiary: "#3B8F3B",
      },
      logic_blocks: {
        colourPrimary: "#3B8F3B",
        colourSecondary: "#2F7A2F",
        colourTertiary: "#276927",
      },
      loop_blocks: {
        colourPrimary: "#FFAB19",
        colourSecondary: "#E69900",
        colourTertiary: "#CC8800",
      },
      text_blocks: {
        colourPrimary: "#9966FF",
        colourSecondary: "#8557E6",
        colourTertiary: "#774DCC",
      },
      list_blocks: {
        colourPrimary: "#FF661A",
        colourSecondary: "#E65C17",
        colourTertiary: "#CC5214",
      },
      variable_blocks: {
        colourPrimary: "#FF8C1A",
        colourSecondary: "#E67D17",
        colourTertiary: "#CC6F14",
      },
      procedure_blocks: {
        colourPrimary: "#FF6680",
        colourSecondary: "#E65B72",
        colourTertiary: "#CC5165",
      },
    } as any,
    componentStyles: {
      workspaceBackgroundColour: "#F9F9F9",
      toolboxBackgroundColour: "#FFFFFF",
      toolboxForegroundColour: "#111111",
      flyoutBackgroundColour: "#E9EEF2",
      flyoutForegroundColour: "#111111",
      flyoutOpacity: 1,
      scrollbarColour: "#C7CED6",
      insertionMarkerColour: "#000000",
      insertionMarkerOpacity: 0.25,
    },
    fontStyle: {
      family: "system-ui, Segoe UI, Roboto, Arial",
      size: 13,
      weight: "600",
    } as any,
  });
  return _trapTheme;
}

function _ensureOverlay(): HTMLElement {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="he-trap-blockly-panel">
      <div class="he-trap-blockly-topbar">
        <div style="flex:1;">
          <span id="${TITLE_ID}">Trap Blockly</span>
          <span id="${STATUS_ID}" style="margin-left:10px; opacity:0.75; font-size:12px;"></span>
        </div>
        <button id="${TOOLBOX_BTN_ID}">Hide Sidebar</button>
        <button id="${ANCHOR_BTN_ID}">Corner: BR</button>
        <button id="he-trap-blockly-apply">Apply</button>
        <button id="he-trap-blockly-reset">Reset</button>
        <button id="he-trap-blockly-close">Close</button>
      </div>
      <div id="${HOST_ID}" class="he-trap-blockly-host"></div>
      <div id="${RESIZE_ID}" class="he-trap-blockly-resize corner-tl"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      right: 10px;
      bottom: 10px;
      z-index: 30000;
      display: none;
    }
    #${OVERLAY_ID} .he-trap-blockly-panel {
      width: 520px;
      height: 360px;
      background: rgba(18,18,22,0.98);
      border: 2px solid #000;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      font: 14px/1.1 monospace;
      color: rgba(255,255,255,0.92);
      user-select: none;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar button {
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      border-radius: 6px;
      cursor: pointer;
      font: 14px/1.1 monospace;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar button:hover {
      background: rgba(255,255,255,0.14);
    }
    #${OVERLAY_ID} .he-trap-blockly-host {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #${OVERLAY_ID} .he-trap-blockly-resize {
      width: 12px;
      height: 12px;
      position: absolute;
      background: rgba(255,255,255,0.65);
      border: 1px solid rgba(0,0,0,0.6);
      border-radius: 2px;
      z-index: 2;
      touch-action: none;
    }
    #${OVERLAY_ID} .he-trap-blockly-resize.corner-tl { left: 2px; top: 2px; cursor: nwse-resize; }
    #${OVERLAY_ID} .he-trap-blockly-resize.corner-tr { right: 2px; top: 2px; cursor: nesw-resize; }
    #${OVERLAY_ID} .he-trap-blockly-resize.corner-bl { left: 2px; bottom: 2px; cursor: nesw-resize; }
    #${OVERLAY_ID} .he-trap-blockly-resize.corner-br { right: 2px; bottom: 2px; cursor: nwse-resize; }
    .blocklyWidgetDiv,
    .blocklyDropDownDiv,
    .blocklyMenuDiv,
    .blocklyTooltipDiv {
      z-index: 40050 !important;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  const panel = overlay.querySelector(".he-trap-blockly-panel") as HTMLElement | null;
  const anchorBtn = overlay.querySelector(`#${ANCHOR_BTN_ID}`) as HTMLButtonElement | null;
  const toolboxBtn = overlay.querySelector(`#${TOOLBOX_BTN_ID}`) as HTMLButtonElement | null;
  const resizeHandle = overlay.querySelector(`#${RESIZE_ID}`) as HTMLElement | null;

  if (panel) {
    const ui = _getUiState();
    _applyAnchor(overlay, ui.anchor);
    _applySize(panel, ui.width, ui.height);
    if (anchorBtn) anchorBtn.textContent = _anchorLabel(ui.anchor);
    if (toolboxBtn) toolboxBtn.textContent = _toolboxLabel(ui.toolboxHidden);
    if (resizeHandle) _updateResizeHandle(resizeHandle, ui.anchor);
  }

  if (toolboxBtn) {
    toolboxBtn.onclick = () => {
      const ui = _getUiState();
      const nextHidden = !ui.toolboxHidden;
      _setUiState({ toolboxHidden: nextHidden });
      toolboxBtn.textContent = _toolboxLabel(nextHidden);
      _applyToolboxVisibility(overlay, nextHidden);
    };
  }

  if (anchorBtn && panel && resizeHandle) {
    anchorBtn.onclick = () => {
      const cur = _getUiState().anchor;
      const idx = TRAP_ANCHORS.indexOf(cur);
      const next = TRAP_ANCHORS[(idx + 1) % TRAP_ANCHORS.length] || DEFAULT_ANCHOR;
      _setUiState({ anchor: next });
      _applyAnchor(overlay, next);
      anchorBtn.textContent = _anchorLabel(next);
      _updateResizeHandle(resizeHandle, next);
    };

    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let active = false;

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const anchor = _getUiState().anchor;

      let width = startW;
      let height = startH;

      if (anchor.includes("left")) width = startW + dx;
      if (anchor.includes("right")) width = startW - dx;
      if (anchor.includes("top")) height = startH + dy;
      if (anchor.includes("bottom")) height = startH - dy;

      _applySize(panel, width, height);
    };

    const onUp = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    resizeHandle.onpointerdown = (e: PointerEvent) => {
      e.preventDefault();
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = panel.offsetWidth;
      startH = panel.offsetHeight;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  return overlay;
}

function _filterToolboxBySpec(base: any, spec: TrapSpec): any {
  const allowedBlocks = new Set(spec.palette.blocksAllowed || []);
  const bannedBlocks = new Set(spec.palette.blocksBanned || []);
  const allowedCategories = new Set(spec.palette.categories || []);
  const hasAllowedBlocks = allowedBlocks.size > 0;
  const hasAllowedCategories = allowedCategories.size > 0;

  const Blocks: any = (Blockly as any).Blocks || {};
  const isKnownType = (t: string) => !!Blocks[t];

  const clone = (o: any): any => {
    if (!o || typeof o !== "object") return o;
    if (Array.isArray(o)) return o.map(clone).filter(v => v !== null);

    const out: any = { ...o };

    if (out.kind === "category" && hasAllowedCategories) {
      const name = String(out.name || "");
      if (!allowedCategories.has(name)) return null;
    }

    if (out.kind === "block" && typeof out.type === "string") {
      const type = out.type;
      if (bannedBlocks.has(type)) return null;
      if (hasAllowedBlocks && !allowedBlocks.has(type)) return null;
      if (!isKnownType(type) && !type.startsWith("variables_") && !type.startsWith("procedures_")) {
        return null;
      }
    }

    if (Array.isArray(out.contents)) {
      out.contents = out.contents.map(clone).filter(v => v !== null);
      if (out.kind === "category" && out.custom == null && out.contents.length === 0) return null;
    }

    return out;
  };

  return clone(base);
}

function _ensureWorkspace(spec: TrapSpec): Blockly.WorkspaceSvg {
  const host = document.getElementById(HOST_ID);
  if (!host) throw new Error("[trap-blockly] missing host");

  if (_workspace) {
    _workspace.dispose();
    _workspace = null;
  }

  const toolbox = _filterToolboxBySpec(TRAP_TOOLBOX_BASE, spec);
  _workspace = Blockly.inject(host, {
    toolbox,
    trashcan: false,
    renderer: "zelos",
    theme: _getTrapTheme(),
    zoom: { controls: false, wheel: true, startScale: 0.95, maxScale: 2.0, minScale: 0.4 },
    grid: { spacing: 20, length: 3, snap: true },
    move: { scrollbars: true, drag: true, wheel: true },
  });

  try {
    const fly: any = (_workspace as any).getFlyout?.();
    if (fly) {
      if (typeof fly.setAutoClose === "function") fly.setAutoClose(false);
      if (typeof fly.autoClose === "boolean") fly.autoClose = false;
    }
  } catch {}
  return _workspace;
}

function _loadXmlIntoWorkspace(ws: Blockly.WorkspaceSvg, xmlText: string): void {
  const dom = (Blockly as any)?.utils?.xml?.textToDom?.(xmlText) || (Blockly as any).Xml?.textToDom?.(xmlText);
  if (!dom) return;
  Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, ws);
}

function _ensureTrapVariables(ws: Blockly.WorkspaceSvg, spec: TrapSpec): void {
  const vm: any = (ws as any).getVariableMap?.();
  if (!vm || typeof vm.getVariable !== "function" || typeof vm.createVariable !== "function") return;

  const names = new Set<string>();
  for (let i = 0; i < spec.givenInputs.length; i++) names.add(spec.givenInputs[i]);
  names.add("target");

  names.forEach(name => {
    const v = vm.getVariable(name);
    if (!v) vm.createVariable(name);
  });
}

function _lockProcedureName(ws: Blockly.WorkspaceSvg): void {
  const blocks = ws.getAllBlocks(false);
  for (let i = 0; i < blocks.length; i++) {
    const b: any = blocks[i];
    if (b.type !== "procedures_defreturn") continue;
    const f = b.getField?.("NAME");
    if (f && typeof f.setValue === "function") f.setValue("trapMain");
    if (f && typeof f.setEditable === "function") f.setEditable(false);
    if (typeof b.setDeletable === "function") b.setDeletable(false);
  }
}

function _setStatus(msg: string): void {
  const el = document.getElementById(STATUS_ID);
  if (el) el.textContent = msg;
}

export function openBlocklyTrapEditor(spec: TrapSpec, inputs?: Record<string, unknown>): void {
  const overlay = _ensureOverlay();
  _activeSpec = spec;
  _activeInputs = inputs || spec.preview.inputs || {};

  const panel = overlay.querySelector(".he-trap-blockly-panel") as HTMLElement | null;
  const anchorBtn = overlay.querySelector(`#${ANCHOR_BTN_ID}`) as HTMLButtonElement | null;
  const toolboxBtn = overlay.querySelector(`#${TOOLBOX_BTN_ID}`) as HTMLButtonElement | null;
  const resizeHandle = overlay.querySelector(`#${RESIZE_ID}`) as HTMLElement | null;
  if (panel) {
    const ui = _getUiState();
    _applyAnchor(overlay, ui.anchor);
    _applySize(panel, ui.width, ui.height);
    if (anchorBtn) anchorBtn.textContent = _anchorLabel(ui.anchor);
    if (toolboxBtn) toolboxBtn.textContent = _toolboxLabel(ui.toolboxHidden);
    if (resizeHandle) _updateResizeHandle(resizeHandle, ui.anchor);
  }

  const ws = _ensureWorkspace(spec);
  const xml = getTrapXmlForId(spec.id) || spec.starterBlocks.xml;
  try {
    _loadXmlIntoWorkspace(ws, xml);
  } catch {
    _loadXmlIntoWorkspace(ws, spec.starterBlocks.xml);
    setTrapXmlForId(spec.id, spec.starterBlocks.xml);
    _setStatus("Reset invalid XML");
  }
  _ensureTrapVariables(ws, spec);
  _lockProcedureName(ws);
  _applyToolboxVisibility(overlay, _getUiState().toolboxHidden);

  const titleEl = document.getElementById(TITLE_ID);
  if (titleEl) titleEl.textContent = spec.ui.title || "Trap Blockly";
  _setStatus("");

  const applyBtn = overlay.querySelector("#he-trap-blockly-apply") as HTMLButtonElement | null;
  const resetBtn = overlay.querySelector("#he-trap-blockly-reset") as HTMLButtonElement | null;
  const closeBtn = overlay.querySelector("#he-trap-blockly-close") as HTMLButtonElement | null;

  if (applyBtn) {
    applyBtn.onclick = () => {
      const xmlOut = Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(ws));
      setTrapXmlForId(spec.id, xmlOut);
      const res = runTrapBlockly(spec, _activeInputs || {});
      _setStatus(res.ok ? "Valid" : `Invalid: ${res.errors[0] || "error"}`);
      const g: any = (globalThis as any);
      g.__heTrapLastResult = res;
    };
  }
  if (resetBtn) {
    resetBtn.onclick = () => {
      _loadXmlIntoWorkspace(ws, spec.starterBlocks.xml);
      _ensureTrapVariables(ws, spec);
      _lockProcedureName(ws);
      _setStatus("Reset");
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => closeBlocklyTrapEditor();
  }

  overlay.style.display = "block";
  Blockly.svgResize(ws);
}

export function closeBlocklyTrapEditor(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.style.display = "none";
}

export function installBlocklyTrapEditor(): void {
  const g: any = (globalThis as any);
  if (g.__heTrapBlocklyInstalled) return;
  g.__heTrapBlocklyInstalled = true;

  g.__heOpenTrapBlocklyEditor = (trapId: string, inputs?: Record<string, unknown>) => {
    const spec = getTrapSpecById(trapId);
    if (!spec) return;
    openBlocklyTrapEditor(spec, inputs || spec.preview.inputs || {});
  };
  g.__heCloseTrapBlocklyEditor = closeBlocklyTrapEditor;
}
