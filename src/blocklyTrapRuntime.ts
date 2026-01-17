import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import type { TrapSpec } from "./trapSchema";
import { validateRequiredInputs, validateTrapOutput } from "./trapValidation";

export interface TrapRunResult {
  ok: boolean;
  value?: unknown;
  errors: string[];
  code?: string;
  codeLines?: string[];
}

const TRAP_ENTRY_FN = "trapMain";

function _getTrapXmlMap(): Record<string, string> {
  const g: any = (globalThis as any);
  if (!g.__heTrapBlocklyXmlById) g.__heTrapBlocklyXmlById = {};
  return g.__heTrapBlocklyXmlById as Record<string, string>;
}

export function getTrapXmlForId(id: string): string {
  const map = _getTrapXmlMap();
  return map[id] || "";
}

export function setTrapXmlForId(id: string, xmlText: string): void {
  const map = _getTrapXmlMap();
  map[id] = String(xmlText || "");
}

function _parseXml(xmlText: string): Element | null {
  const uxml = (Blockly as any)?.utils?.xml;
  const xml = uxml?.textToDom?.(xmlText) || (Blockly as any).Xml?.textToDom?.(xmlText);
  return (xml as Element) || null;
}

function _buildWorkspaceFromXml(xmlText: string): Blockly.Workspace {
  const ws = new (Blockly as any).Workspace();
  const dom = _parseXml(xmlText);
  if (!dom) return ws;
  (Blockly as any).Xml?.domToWorkspace?.(dom, ws);
  return ws;
}

function _collectUsedVariableNames(ws: Blockly.Workspace): Set<string> {
  const used = new Set<string>();
  const vm: any = (ws as any).getVariableMap?.();
  const blocks = ws.getAllBlocks(false);
  for (let i = 0; i < blocks.length; i++) {
    const b: any = blocks[i];
    if (b && typeof b.getVarModels === "function") {
      const models = b.getVarModels() || [];
      for (let j = 0; j < models.length; j++) {
        const name = models[j]?.name;
        if (typeof name === "string" && name) used.add(name);
      }
    }

    const vars = (b && typeof b.getVars === "function") ? (b.getVars() || []) : [];
    for (let j = 0; j < vars.length; j++) {
      const v = vars[j];
      if (typeof v !== "string") continue;
      const model = vm?.getVariableById?.(v);
      if (model?.name) used.add(model.name);
      else used.add(v);
    }

    const field = b?.getField?.("VAR");
    if (field) {
      const text = typeof field.getText === "function" ? field.getText() : "";
      if (text) used.add(text);
      const value = typeof field.getValue === "function" ? field.getValue() : "";
      const model = value ? vm?.getVariableById?.(value) : null;
      if (model?.name) used.add(model.name);
    }
  }
  return used;
}

function _collectBlockTypes(ws: Blockly.Workspace): Set<string> {
  const types = new Set<string>();
  const blocks = ws.getAllBlocks(false);
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i]?.type;
    if (t) types.add(String(t));
  }
  return types;
}

function _validateAllowedBlocks(spec: TrapSpec, ws: Blockly.Workspace, errors: string[]): void {
  const allowed = new Set(spec.palette.blocksAllowed || []);
  const banned = new Set(spec.palette.blocksBanned || []);
  const seen = _collectBlockTypes(ws);
  seen.forEach(t => {
    if (banned.has(t)) errors.push(`Block is not allowed: ${t}`);
    if (allowed.size > 0 && !allowed.has(t)) errors.push(`Block is not allowed: ${t}`);
  });
}

function _validateAssemblyForDisassembled(spec: TrapSpec, ws: Blockly.Workspace, errors: string[]): void {
  if (spec.kind !== "Disassembled") return;
  const blocks = ws.getAllBlocks(false);
  for (let i = 0; i < blocks.length; i++) {
    const b: any = blocks[i];
    if (b.type === "procedures_defreturn") continue;
    if (!b.getParent || !b.getParent()) {
      errors.push("Blocks must be connected inside the procedure");
      return;
    }
  }
}

function _makeInputDecls(spec: TrapSpec): string {
  const names = spec.givenInputs || [];
  let out = "";
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    out += `var ${n} = inputs[${JSON.stringify(n)}];\n`;
  }
  return out;
}

export function runTrapBlockly(spec: TrapSpec, inputs: Record<string, unknown>): TrapRunResult {
  const errors: string[] = [];
  const xmlText = getTrapXmlForId(spec.id) || spec.starterBlocks.xml;

  const ws = _buildWorkspaceFromXml(xmlText);
  _validateAllowedBlocks(spec, ws, errors);
  _validateAssemblyForDisassembled(spec, ws, errors);

  const usedVars = _collectUsedVariableNames(ws);
  if (spec.validator.requireAllGivenInputsUsed) {
    const req = spec.validator.requiredInputs || spec.requiredInputs || [];
    const usedRes = validateRequiredInputs(usedVars, req);
    if (!usedRes.ok) errors.push(...usedRes.errors);
  }

  let code = "";
  try {
    code = javascriptGenerator.workspaceToCode(ws);
  } catch (e) {
    errors.push("Blockly compile failed");
  }
  const codeLines = code ? code.split("\n") : [];

  if (errors.length > 0) return { ok: false, errors, code, codeLines };

  let value: unknown = undefined;
  try {
    const decls = _makeInputDecls(spec);
    const wrapped = `"use strict";\n${decls}\n${code}\n` +
      `return (typeof ${TRAP_ENTRY_FN} === "function") ? ${TRAP_ENTRY_FN}() : undefined;`;
    const fn = new Function("inputs", wrapped);
    value = fn(inputs);
  } catch (e) {
    errors.push("Trap runtime failed");
  }

  const outRes = validateTrapOutput(spec.output, value);
  if (!outRes.ok) errors.push(...outRes.errors);

  return { ok: errors.length === 0, value, errors, code, codeLines };
}
