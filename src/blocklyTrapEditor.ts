import * as Blockly from "blockly";
import "blockly/blocks";
import type { TrapSpec } from "./trapSchema";
import { getTrapSpecById } from "./trapSpecs";
import { getTrapXmlForId, runTrapBlockly, setTrapXmlForId } from "./blocklyTrapRuntime";

const OVERLAY_ID = "he-trap-blockly-overlay";
const HOST_ID = "he-trap-blockly-host";
const TITLE_ID = "he-trap-blockly-title";
const STATUS_ID = "he-trap-blockly-status";

let _workspace: Blockly.WorkspaceSvg | null = null;
let _activeSpec: TrapSpec | null = null;
let _activeInputs: Record<string, unknown> | null = null;

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
        <button id="he-trap-blockly-apply">Apply</button>
        <button id="he-trap-blockly-reset">Reset</button>
        <button id="he-trap-blockly-close">Close</button>
      </div>
      <div id="${HOST_ID}" class="he-trap-blockly-host"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
    }
    #${OVERLAY_ID} .he-trap-blockly-panel {
      width: 520px;
      height: 360px;
      background: rgba(12, 12, 16, 0.98);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #1b1b25;
      color: #f4f4f6;
      font-size: 13px;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar button {
      background: #2b2b38;
      border: 1px solid rgba(255,255,255,0.12);
      color: #f4f4f6;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    }
    #${OVERLAY_ID} .he-trap-blockly-topbar button:hover {
      background: #353545;
    }
    #${OVERLAY_ID} .he-trap-blockly-host {
      flex: 1;
      background: #111118;
    }
    .blocklyWidgetDiv,
    .blocklyDropDownDiv,
    .blocklyMenuDiv,
    .blocklyTooltipDiv {
      z-index: 1000000;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

function _inferCategory(blockType: string): string {
  if (blockType.startsWith("procedures_")) return "Procedures";
  if (blockType.startsWith("variables_")) return "Variables";
  if (blockType.startsWith("lists_")) return "Lists";
  if (blockType.startsWith("logic_")) return "Logic";
  if (blockType.startsWith("math_")) return "Math";
  return "Blocks";
}

function _buildToolboxXml(spec: TrapSpec): string {
  const cats = new Set(spec.palette.categories || []);
  const blocks = spec.palette.blocksAllowed || [];
  const byCat: Record<string, string[]> = {};

  for (let i = 0; i < blocks.length; i++) {
    const type = blocks[i];
    const inferred = _inferCategory(type);
    const cat = cats.has(inferred) ? inferred : "Blocks";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(type);
  }

  const catKeys = Object.keys(byCat);
  let xml = `<xml xmlns="https://developers.google.com/blockly/xml">`;
  for (let i = 0; i < catKeys.length; i++) {
    const name = catKeys[i];
    xml += `<category name="${name}">`;
    const list = byCat[name];
    for (let j = 0; j < list.length; j++) {
      xml += `<block type="${list[j]}"></block>`;
    }
    xml += `</category>`;
  }
  xml += `</xml>`;
  return xml;
}

function _ensureWorkspace(spec: TrapSpec): Blockly.WorkspaceSvg {
  const host = document.getElementById(HOST_ID);
  if (!host) throw new Error("[trap-blockly] missing host");

  if (_workspace) {
    _workspace.dispose();
    _workspace = null;
  }

  const toolbox = _buildToolboxXml(spec);
  _workspace = Blockly.inject(host, {
    toolbox,
    trashcan: false,
    scrollbars: true,
    zoom: { controls: false, wheel: true },
  });
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

  const ws = _ensureWorkspace(spec);
  const xml = getTrapXmlForId(spec.id) || spec.starterBlocks.xml;
  _loadXmlIntoWorkspace(ws, xml);
  _ensureTrapVariables(ws, spec);
  _lockProcedureName(ws);

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
