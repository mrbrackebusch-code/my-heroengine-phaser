// src/blocklyHeroLogicEditor.ts
import * as Blockly from "blockly";
import "blockly/blocks";

// ---- Blockly v12 deprecation shims (silence getVariable / getVariableById warnings) ----
(() => {
  const W: any = (Blockly as any).Workspace;
  if (!W || !W.prototype) return;

  W.prototype.getVariable = function (name: string, type?: string) {
    const vm = this.getVariableMap?.();
    if (vm && typeof vm.getVariable === "function") return vm.getVariable(name, type);
    return null;
  };

  W.prototype.getVariableById = function (id: string) {
    const vm = this.getVariableMap?.();
    if (vm && typeof vm.getVariableById === "function") return vm.getVariableById(id);
    return null;
  };
})();

/**
 * Minimal “just Blockly” editor:
 * - Shows an overlay workspace when user clicks "Edit Hero Logic"
 * - Saves/loads per-profile from localStorage (XML text)
 * - If no saved XML exists, loads DEFAULT_WORKSPACE_XML scaffold
 *
 * This does NOT execute the logic yet. It’s only the editor + persistence.
 */

const OVERLAY_ID = "he-blockly-overlay";
const HOST_ID = "he-blockly-host";
const BTN_ID = "he-blockly-open-btn";
const STORAGE_PREFIX = "he_blockly_ws_v1:";

// IMPORTANT: controls_if mutation MUST NOT be self-closing.
// (Use <mutation ...></mutation>, not <mutation .../>)

// IMPORTANT: controls_if mutation MUST NOT be self-closing.
// (Use <mutation ...></mutation>, not <mutation .../>)
// IMPORTANT: controls_if mutation MUST NOT be self-closing.
// (Use <mutation ...></mutation>, not <mutation .../>)
const DEFAULT_WORKSPACE_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="he_on_button_a" x="40" y="40">
    <comment pinned="false" h="110" w="260">
When A is pressed, return a 7-entry array:
[family, damage, reach, time, status, element, id]
    </comment>
    <statement name="DO">
      <block type="he_return_move"></block>
    </statement>
  </block>
  <block type="he_on_button_b" x="360" y="40">
    <comment pinned="false" h="110" w="260">
When B is pressed, return a 7-entry array:
[family, damage, reach, time, status, element, id]
    </comment>
    <statement name="DO">
      <block type="he_return_move"></block>
    </statement>
  </block>
  <block type="he_on_button_ab" x="680" y="40">
    <comment pinned="false" h="110" w="260">
When A+B is pressed, return a 7-entry array:
[family, damage, reach, time, status, element, id]
    </comment>
    <statement name="DO">
      <block type="he_return_move"></block>
    </statement>
  </block>
</xml>
`;

const TOOLBOX: any = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Output",
      colour: "#FF6680",
      contents: [
        { kind: "block", type: "he_set_family" },
        { kind: "block", type: "he_set_element" },
        { kind: "block", type: "he_set_id" },
        { kind: "block", type: "he_set_damage" },
        { kind: "block", type: "he_set_reach" },
        { kind: "block", type: "he_set_time" },
        { kind: "block", type: "he_set_status" },
      ],
    },

    {
      kind: "category",
      name: "Sensing",
      colour: "#5CB1D6",
      contents: [
        { kind: "block", type: "he_ro_my_hp" },
        { kind: "block", type: "he_ro_my_mp" },
        { kind: "block", type: "he_ro_my_x" },
        { kind: "block", type: "he_ro_my_y" },

        { kind: "block", type: "he_ro_enemy_count" },
        { kind: "block", type: "he_ro_closest_enemy_exists" },
        { kind: "block", type: "he_ro_closest_enemy_hp" },
        { kind: "block", type: "he_ro_closest_enemy_dist" },
        { kind: "block", type: "he_ro_enemy_hp_at" },
        { kind: "block", type: "he_ro_enemy_dist_at" },
        { kind: "block", type: "he_ro_weakest_enemy_index" },
        { kind: "block", type: "he_ro_enemies_within_radius" },
      ],
    },

    {
      kind: "category",
      name: "Operators",
      colour: "#59C059",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "he_math_min2" },
        { kind: "block", type: "he_math_max2" },
        { kind: "block", type: "he_math_clamp" },
        { kind: "block", type: "math_modulo" },
        { kind: "block", type: "math_round" },
        { kind: "block", type: "math_random_int" },

        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
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
        { kind: "block", type: "he_list_min" },
        { kind: "block", type: "he_list_max" },
        { kind: "block", type: "lists_getIndex" },
        { kind: "block", type: "lists_setIndex" },

        { kind: "block", type: "he_grid_make" },
        { kind: "block", type: "he_grid_get" },
        { kind: "block", type: "he_grid_set" },
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
      custom: "VARIABLE",
    },

    {
      kind: "category",
      name: "Functions",
      colour: "#FF6680",
      custom: "PROCEDURE",
    },
  ],
};


function _heFilterToolbox(obj: any): any {
  // Prevent flyout/toolbox crashes when a block type doesn't exist in this Blockly build.
  // Removes unknown block entries and prunes empty categories.
  const Blocks: any = (Blockly as any).Blocks || {};
  const isKnownType = (t: string) => !!Blocks[t];

  const clone = (o: any): any => {
    if (!o || typeof o !== "object") return o;
    if (Array.isArray(o)) return o.map(clone).filter(v => v !== null);
    const out: any = { ...o };

    if (out.kind === "block" && typeof out.type === "string") {
      if (!isKnownType(out.type) && !out.type.startsWith("variables_") && !out.type.startsWith("procedures_")) {
        return null;
      }
    }

    if (Array.isArray(out.contents)) {
      out.contents = out.contents.map(clone).filter(v => v !== null);
      if (out.kind === "category" && out.custom == null && out.contents.length === 0) return null;
    }
    return out;
  };

  return clone(obj);
}




// ---- Hero Engine Blockly: required template + custom blocks ----

const HE_OUTPUT_VARS = ["family", "damage", "reach", "time", "status", "element", "id"] as const;
type HeOutputVarName = typeof HE_OUTPUT_VARS[number];

const HE_FAMILY_OPTIONS: Array<[string, string]> = [
  ["strength", "strength"],
  ["agility", "agility"],
  ["intelligence", "intelligence"],
  ["wisdom", "wisdom"],
];

const HE_ELEMENT_OPTIONS: Array<[string, string]> = [
  ["none", "none"],
  ["fire", "fire"],
  ["earth", "earth"],
  ["wind", "wind"],
  ["water", "water"],
  ["lightning", "lightning"],
  ["ice", "ice"],
  ["poison", "poison"],
];

const HE_ID_OPTIONS: Array<[string, string]> = [
  ["A", "A"],
  ["B", "B"],
  ["A+B", "A+B"],
];

const HE_RETURN_INPUTS: Array<{ input: string; varName: HeOutputVarName; label: string }> = [
  { input: "FAMILY", varName: "family", label: "Family:" },
  { input: "DAMAGE", varName: "damage", label: "Damage:" },
  { input: "REACH", varName: "reach", label: "Reach:" },
  { input: "TIME", varName: "time", label: "Time:" },
  { input: "STATUS", varName: "status", label: "Status:" },
  { input: "ELEMENT", varName: "element", label: "Element:" },
  { input: "ID", varName: "id", label: "ID:" },
];

let _heReservedVarIds: Partial<Record<HeOutputVarName, string>> = {};
let _heRepairing = false;
let _heLoadingXml = false;
let _heSuppressNameExistsUi = false;

let _heStatusOverride: { msg: string; untilMs: number } | null = null;

function _heSetStatus(msg: string, ttlMs: number = 0): void {
  try {
    const el = document.getElementById("he-blockly-status");
    if (!el) return;
    el.textContent = msg;
    if (ttlMs > 0) {
      _heStatusOverride = { msg, untilMs: Date.now() + ttlMs };
    } else {
      _heStatusOverride = null;
    }
  } catch {}
}


function _heBlocklyAlert(msg: string): void {
  // Match Blockly’s own UX (used for variable name collisions in the built-in UI)
  try {
    const d: any = (Blockly as any).dialog ?? (Blockly as any).utils?.dialog;
    if (d && typeof d.alert === "function") {
      d.alert(msg);
      return;
    }
  } catch {}
  try {
    // Some builds expose this
    const a: any = (Blockly as any).alert;
    if (typeof a === "function") {
      a(msg);
      return;
    }
  } catch {}
  try {
    window.alert(msg);
  } catch {}
}

function _heWarnNameExists(ttlMs: number = 2200): void {
  // During XML loads / template repairs we may create reserved vars before IDs are known.
  // Never spam modal UI during those internal operations.
  if (_heLoadingXml || _heSuppressNameExistsUi || _heRepairing) return;
  _heSetStatus("A variable with that name already exists", ttlMs);
  _heBlocklyAlert("A variable with that name already exists");
}


function _heIsReservedOutputName(name: string | null | undefined): name is HeOutputVarName {
  if (!name) return false;
  return (HE_OUTPUT_VARS as readonly string[]).includes(name);
}

function _heReservedNameForVarId(varId: string | null | undefined): HeOutputVarName | null {
  if (!varId) return null;
  for (const n of HE_OUTPUT_VARS) {
    if (_heReservedVarIds[n] === varId) return n;
  }
  return null;
}

function _heDeleteVariableById(workspace: Blockly.WorkspaceSvg, varId: string): void {
  const vm: any = (workspace as any).getVariableMap?.();
  if (!vm) return;
  if (typeof vm.deleteVariableById === "function") {
    vm.deleteVariableById(varId);
    return;
  }
  const v = vm.getVariableById?.(varId);
  if (v && typeof vm.deleteVariable === "function") {
    vm.deleteVariable(v);
    return;
  }
  // Fallbacks (older APIs)
  try {
    (workspace as any).deleteVariableById?.(varId);
  } catch {}
}

function _heEnforceReservedVarsOnEvent(workspace: Blockly.WorkspaceSvg, e: any): void {
  if (!e) return;
  if (_heLoadingXml || _heRepairing || _heSuppressNameExistsUi) return;
  const t = String(e.type || "").toLowerCase();
  if (!t.startsWith("var_") && !t.includes("var_")) return;

  const vm: any = (workspace as any).getVariableMap?.();
  if (!vm) return;

  const varId: string | null =
    (e as any).varId ?? (e as any).variableId ?? (e as any).id ?? null;

  const varName: string | null =
    (e as any).varName ?? (e as any).variableName ?? (e as any).name ?? null;

  const oldName: string | null = (e as any).oldName ?? null;
  const newName: string | null = (e as any).newName ?? varName ?? null;

  const Events: any = (Blockly as any).Events;

  // 1) Block creating any variable with a reserved name (except our own canonical var ids).
  if (t === "var_create") {
    if (_heIsReservedOutputName(varName)) {
      const canonicalId = _heReservedVarIds[varName];
      if (varId && !canonicalId) {
        // Adopt this variable as the canonical reserved output (fresh workspace/load).
        _heReservedVarIds[varName] = varId;
        return;
      }
      if (varId && canonicalId && varId === canonicalId) return; // allowed: our canonical variable
      try { if (Events?.disable) Events.disable(); } catch {}
      try {
        if (varId) _heDeleteVariableById(workspace, varId);
        _heWarnNameExists(2200);
      } finally {
        try { if (Events?.enable) Events.enable(); } catch {}
      }
    }
    return;
  }

  // 2) Block renaming any variable TO a reserved name.
  if (t === "var_rename") {
    if (_heIsReservedOutputName(newName)) {
      const canonicalId = _heReservedVarIds[newName];
      if (varId && canonicalId && varId === canonicalId) {
        // Renaming the canonical variable "to itself" is fine; but ensure exact canonical name.
        if (typeof vm.renameVariableById === "function") vm.renameVariableById(varId, newName);
        return;
      }
      try { if (Events?.disable) Events.disable(); } catch {}
      try {
        if (varId && oldName && typeof vm.renameVariableById === "function") {
          vm.renameVariableById(varId, oldName);
        }
        _heWarnNameExists(2200);
      } finally {
        try { if (Events?.enable) Events.enable(); } catch {}
      }
      return;
    }

    // If someone tries to rename a canonical output var away from its reserved name, revert it.
    const reserved = _heReservedNameForVarId(varId);
    if (reserved && newName !== reserved) {
      try { if (Events?.disable) Events.disable(); } catch {}
      try {
        if (varId && typeof vm.renameVariableById === "function") vm.renameVariableById(varId, reserved);
        _heWarnNameExists(1200);
      } finally {
        try { if (Events?.enable) Events.enable(); } catch {}
      }
    }
    return;
  }

  // 3) If a canonical output var is deleted, it will be recreated by template enforcement.
  if (t === "var_delete") {
    const reserved = _heReservedNameForVarId(varId);
    if (reserved || _heIsReservedOutputName(varName)) {
      _heWarnNameExists(1200);
    }
    return;
  }
}


function _heInstallReservedVariableGuards(workspace: Blockly.WorkspaceSvg): void {
  const vm: any = (workspace as any).getVariableMap?.();
  if (!vm) return;
  if ((vm as any).__heReservedGuardsInstalled) return;
  (vm as any).__heReservedGuardsInstalled = true;

  // Wrap renameVariableById so illegal renames are blocked BEFORE they mutate the workspace.
  const origRename: any = vm.renameVariableById?.bind(vm);
  if (typeof origRename === "function") {
    vm.renameVariableById = (varId: string, newName: string) => {
      if (_heLoadingXml || _heRepairing) return origRename(varId, newName);
      try {
        const v = vm.getVariableById?.(varId);
        const curName: string | null = v?.name ?? null;

        // Block renaming a canonical output var away from its reserved name.
        if (_heIsReservedOutputName(curName) && newName !== curName) {
          _heWarnNameExists(2200);
          return;
        }

        // Block renaming any var TO a reserved output name.
        if (!_heIsReservedOutputName(curName) && _heIsReservedOutputName(newName)) {
          _heWarnNameExists(2200);
          return;
        }
      } catch (e) {
        // If anything about validation fails, fall through to original rename.
        console.warn("[blockly] reserved rename guard validation failed", e);
      }

      return origRename(varId, newName);
    };
  }
}

function _heEnsureBlocksRegistered(): void {
  const B: any = (Blockly as any).Blocks;
  if (B && B.he_return_move && B.he_choose_move && B.he_on_button_a && B.he_on_button_b && B.he_on_button_ab) {
    return;
  }

  const _mkEntry = (type: string, label: string) => {
    if ((Blockly as any).Blocks[type]) return;
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#59C059");
        this.appendDummyInput().appendField(label);
        this.appendStatementInput("DO").appendField("do");
        this.setTooltip("Your main decision logic goes here. Must end with Return Move (7).");
      },
    };
  };

  // --- Main entry blocks (button-specific) ---
  _mkEntry("he_on_button_a", "When A Button Pressed");
  _mkEntry("he_on_button_b", "When B Button Pressed");
  _mkEntry("he_on_button_ab", "When A+B Button Pressed");

  // Legacy block (kept for older XML)
  _mkEntry("he_choose_move", "Choose My Move");


  // --- Terminal Return block (7-tuple) ---
  (Blockly as any).Blocks["he_return_move"] = {
    init: function () {
      this.setColour("#FF6680");
      this.appendDummyInput().appendField("Return Move (7)");
      for (const row of HE_RETURN_INPUTS) {
        this.appendValueInput(row.input)
          .setAlign((Blockly as any).ALIGN_RIGHT ?? 2)
          .appendField(row.label);
      }
      this.setPreviousStatement(true);
      // IMPORTANT: no next connection -> nothing can connect beneath return
      this.setNextStatement(false);
      this.setTooltip("Must be the final block. Returns [family, damage, reach, time, status, element, id].");
    },
  };

  // --- Output setters (pre-wired to reserved output vars) ---
  (Blockly as any).Blocks["he_set_family"] = {
    init: function () {
      this.setColour("#FF6680");
      this.appendDummyInput()
        .appendField("set family to")
        .appendField(new (Blockly as any).FieldDropdown(HE_FAMILY_OPTIONS), "FAM");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  (Blockly as any).Blocks["he_set_element"] = {
    init: function () {
      this.setColour("#FF6680");
      this.appendDummyInput()
        .appendField("set element to")
        .appendField(new (Blockly as any).FieldDropdown(HE_ELEMENT_OPTIONS), "EL");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  (Blockly as any).Blocks["he_set_id"] = {
    init: function () {
      this.setColour("#FF6680");
      this.appendDummyInput()
        .appendField("set id to")
        .appendField(new (Blockly as any).FieldDropdown(HE_ID_OPTIONS), "ID");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  const _mkNumSetter = (type: string, label: string, varName: HeOutputVarName) => {
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#FF6680");
        this.appendValueInput("VALUE").setCheck("Number").appendField(label);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        (this as any).__heOutputVar = varName;
      },
    };
  };

  _mkNumSetter("he_set_damage", "set damage to", "damage");
  _mkNumSetter("he_set_reach", "set reach to", "reach");
  _mkNumSetter("he_set_time", "set time to", "time");
  _mkNumSetter("he_set_status", "set status to", "status");

  // --- Sensors (read-only getters) ---
  const _mkSensor = (type: string, label: string, output: string | null) => {
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField(label);
        this.setOutput(true, output);
      },
    };
  };

  _mkSensor("he_ro_my_hp", "my HP", "Number");
  _mkSensor("he_ro_my_mp", "my MP", "Number");
  _mkSensor("he_ro_my_x", "my X", "Number");
  _mkSensor("he_ro_my_y", "my Y", "Number");

  _mkSensor("he_ro_enemy_count", "enemy count", "Number");
  _mkSensor("he_ro_closest_enemy_exists", "closest enemy exists?", "Boolean");
  _mkSensor("he_ro_closest_enemy_hp", "closest enemy HP", "Number");
  _mkSensor("he_ro_closest_enemy_dist", "closest enemy distance", "Number");

  (Blockly as any).Blocks["he_ro_enemy_hp_at"] = {
    init: function () {
      this.setColour("#5CB1D6");
      this.appendValueInput("I").setCheck("Number").appendField("enemy HP at index");
      this.setOutput(true, "Number");
    },
  };

  (Blockly as any).Blocks["he_ro_enemy_dist_at"] = {
    init: function () {
      this.setColour("#5CB1D6");
      this.appendValueInput("I").setCheck("Number").appendField("enemy distance at index");
      this.setOutput(true, "Number");
    },
  };

  _mkSensor("he_ro_weakest_enemy_index", "index of weakest enemy", "Number");

  (Blockly as any).Blocks["he_ro_enemies_within_radius"] = {
    init: function () {
      this.setColour("#5CB1D6");
      this.appendValueInput("R").setCheck("Number").appendField("enemies within radius");
      this.setOutput(true, "Number");
    },
  };

  // --- 2D list helpers (lists-of-lists) ---
  (Blockly as any).Blocks["he_grid_make"] = {
    init: function () {
      this.setColour("#FF8C1A");
      this.appendValueInput("ROWS").setCheck("Number").appendField("make grid rows");
      this.appendValueInput("COLS").setCheck("Number").appendField("cols");
      this.appendValueInput("FILL").appendField("fill");
      this.setOutput(true);
    },
  };

  (Blockly as any).Blocks["he_grid_get"] = {
    init: function () {
      this.setColour("#FF8C1A");
      this.appendValueInput("GRID").appendField("grid");
      this.appendValueInput("ROW").setCheck("Number").appendField("row");
      this.appendValueInput("COL").setCheck("Number").appendField("col");
      this.setOutput(true);
    },
  };

  (Blockly as any).Blocks["he_grid_set"] = {
    init: function () {
      this.setColour("#FF8C1A");
      this.appendValueInput("GRID").appendField("set grid");
      this.appendValueInput("ROW").setCheck("Number").appendField("row");
      this.appendValueInput("COL").setCheck("Number").appendField("col");
      this.appendValueInput("VALUE").appendField("to");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  // --- Extra Math helpers (your build lacks core math_minmax) ---
  (Blockly as any).Blocks["he_math_min2"] = {
    init: function () {
      this.setColour("#59C059");
      this.appendValueInput("A").setCheck("Number").appendField("min");
      this.appendValueInput("B").setCheck("Number").appendField("and");
      this.setOutput(true, "Number");
    },
  };

  (Blockly as any).Blocks["he_math_max2"] = {
    init: function () {
      this.setColour("#59C059");
      this.appendValueInput("A").setCheck("Number").appendField("max");
      this.appendValueInput("B").setCheck("Number").appendField("and");
      this.setOutput(true, "Number");
    },
  };

  (Blockly as any).Blocks["he_math_clamp"] = {
    init: function () {
      this.setColour("#59C059");
      this.appendValueInput("V").setCheck("Number").appendField("clamp");
      this.appendValueInput("MIN").setCheck("Number").appendField("min");
      this.appendValueInput("MAX").setCheck("Number").appendField("max");
      this.setOutput(true, "Number");
    },
  };

  (Blockly as any).Blocks["he_list_min"] = {
    init: function () {
      this.setColour("#FF8C1A");
      this.appendValueInput("LIST").appendField("min of list");
      this.setOutput(true, "Number");
      this.setTooltip("Returns 0 for empty list.");
    },
  };

  (Blockly as any).Blocks["he_list_max"] = {
    init: function () {
      this.setColour("#FF8C1A");
      this.appendValueInput("LIST").appendField("max of list");
      this.setOutput(true, "Number");
      this.setTooltip("Returns 0 for empty list.");
    },
  };
}

function _heXmlTextToDom(xmlText: string): Element {
  const U: any = (Blockly as any).utils?.xml;
  if (U && typeof U.textToDom === "function") return U.textToDom(xmlText);
  const X: any = (Blockly as any).Xml;
  if (X && typeof X.textToDom === "function") return X.textToDom(xmlText);
  throw new Error("[blockly] no xml parser");
}

function _heCreateBlockFromXml(workspace: Blockly.WorkspaceSvg, xmlText: string): Blockly.Block {
  const dom = _heXmlTextToDom(xmlText);
  const blockDom = (dom as any).querySelector ? (dom as any).querySelector("block") : (dom as any).firstChild;
  if (!blockDom) throw new Error("[blockly] xml missing <block>");
  const X: any = (Blockly as any).Xml;
  if (X && typeof X.domToBlock === "function") return X.domToBlock(blockDom, workspace);
  if (X && typeof X.domToWorkspace === "function") {
    const before = new Set(workspace.getAllBlocks(false).map(b => b.id));
    X.domToWorkspace(dom, workspace);
    const after = workspace.getAllBlocks(false).filter(b => !before.has(b.id));
    if (after.length) return after[0];
  }
  throw new Error("[blockly] no xml domToBlock");
}

function _heEnsureOutputVars(workspace: Blockly.WorkspaceSvg): void {
  const vm: any = (workspace as any).getVariableMap?.();
  if (!vm || typeof vm.getVariable !== "function" || typeof vm.createVariable !== "function") return;

  for (const name of HE_OUTPUT_VARS) {
    let v = vm.getVariable(name);
    if (!v) v = vm.createVariable(name);
    if (v && v.getId) _heReservedVarIds[name] = v.getId();
  }

  if (typeof vm.renameVariableById === "function") {
    for (const name of HE_OUTPUT_VARS) {
      const id = _heReservedVarIds[name];
      if (id) {
        const v = vm.getVariableById?.(id);
        if (v && v.name !== name) vm.renameVariableById(id, name);
      }
    }
  }
}

function _heLockMainEntryBlock(main: Blockly.Block): void {
  try { main.setDeletable(false); } catch {}
  try { main.setMovable(true); } catch {}
}

function _heEnsureEntryBlock(workspace: Blockly.WorkspaceSvg, type: string, x: number, y: number): Blockly.Block {
  const all = workspace.getAllBlocks(false);

  // If we are upgrading from an older template that used procedures_def* named "heroLogic",
  // rename it so we never end up with duplicate function heroLogic() definitions.
  const legacy = all.filter(b =>
    (b.type === "procedures_defreturn" || b.type === "procedures_defnoreturn") &&
    (b as any).getFieldValue?.("NAME") === "heroLogic"
  );
  for (const b of legacy) {
    try {
      const f: any = (b as any).getField?.("NAME");
      if (f && typeof f.setValue === "function") f.setValue("oldHeroLogic");
      if (f && typeof f.setEditable === "function") f.setEditable(true);
      (b as any).setDeletable?.(true);
      (b as any).setMovable?.(true);
      (b as any).moveBy?.(520, 0);
    } catch {}
  }

  const mains = all.filter(b => b.type === type);
  let main = mains[0] || null;

  if (!main) {
    const xml = `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="${type}" x="${x}" y="${y}"></block>
      </xml>
    `;
    main = _heCreateBlockFromXml(workspace, xml);
  }

  try {
    const xy = (main as any).getRelativeToSurfaceXY?.() || { x: 0, y: 0 };
    const dx = (x - (xy.x | 0)) | 0;
    const dy = (y - (xy.y | 0)) | 0;
    if (dx !== 0 || dy !== 0) main.moveBy(dx, dy);
  } catch {}

  // If multiple mains exist, keep the first and park the extras.
  for (let i = 1; i < mains.length; i++) {
    try { mains[i].moveBy(420, 0); } catch {}
  }

  _heLockMainEntryBlock(main);
  return main;
}

function _heEnsureEntryBlocks(workspace: Blockly.WorkspaceSvg): Blockly.Block[] {
  const entries: Blockly.Block[] = [];
  entries.push(_heEnsureEntryBlock(workspace, "he_on_button_a", 40, 40));
  entries.push(_heEnsureEntryBlock(workspace, "he_on_button_b", 360, 40));
  entries.push(_heEnsureEntryBlock(workspace, "he_on_button_ab", 680, 40));
  return entries;
}

function _heBindFieldToReservedVar(
  workspace: Blockly.WorkspaceSvg,
  field: any,
  varName: HeOutputVarName
): void {
  if (!field) return;
  const vm: any = (workspace as any).getVariableMap?.();
  let model = null;
  const id = _heReservedVarIds[varName];
  if (id && vm?.getVariableById) model = vm.getVariableById(id);
  if (!model && vm?.getVariable) model = vm.getVariable(varName);
  if (!model && vm?.createVariable) model = vm.createVariable(varName);
  if (model && model.getId) _heReservedVarIds[varName] = model.getId();

  try {
    if (model && typeof field.setVariable === "function") {
      field.setVariable(model);
      return;
    }
  } catch {}
  try {
    if (model && typeof field.setValue === "function") {
      field.setValue(model.getId ? model.getId() : model.id);
      return;
    }
  } catch {}
  try {
    if (typeof field.setValue === "function") field.setValue(varName);
  } catch {}
}

function _heEnsureReturnShadows(workspace: Blockly.WorkspaceSvg, ret: Blockly.Block): void {
  for (const row of HE_RETURN_INPUTS) {
    const input = (ret as any).getInput?.(row.input);
    const conn = input?.connection;
    if (!conn) continue;

    let target = conn.targetBlock?.() || null;
    if (target && target.type === "variables_get") {
      const field: any = (target as any).getField?.("VAR");
      _heBindFieldToReservedVar(workspace, field, row.varName);
      continue;
    }

    if (target) {
      try { (target as any).unplug?.(true); } catch {}
      try { conn.disconnect?.(); } catch {}
      try { (target as any).moveBy?.(140, 40); } catch {}
    }

    const vget = workspace.newBlock("variables_get");
    (vget as any).setShadow?.(true);
    _heBindFieldToReservedVar(workspace, (vget as any).getField?.("VAR"), row.varName);
    try { (vget as any).initSvg?.(); } catch {}
    try { (vget as any).render?.(); } catch {}
    try { conn.connect((vget as any).outputConnection); } catch {}
  }
}

function _heFindReturnInChain(head: Blockly.Block | null): Blockly.Block | null {
  let cur = head;
  while (cur) {
    if (cur.type === "he_return_move") return cur;
    cur = (cur as any).getNextBlock?.() || null;
  }
  return null;
}

function _heGetTail(head: Blockly.Block | null): Blockly.Block | null {
  let cur = head;
  let tail = cur;
  while (cur) {
    tail = cur;
    cur = (cur as any).getNextBlock?.() || null;
  }
  return tail || null;
}

function _heEnsureReturnAtEnd(workspace: Blockly.WorkspaceSvg, main: Blockly.Block): void {
  const stackInput: any = (main as any).getInput?.("DO");
  const stackConn = stackInput?.connection;
  if (!stackConn) return;

  const head = (main as any).getInputTargetBlock?.("DO") || null;
  const retExisting = _heFindReturnInChain(head);

  let ret = retExisting;
  if (!ret) {
    ret = workspace.newBlock("he_return_move");
    try { (ret as any).initSvg?.(); } catch {}
    try { (ret as any).render?.(); } catch {}
  }

  // Return must be terminal: nothing allowed below it
  if (retExisting) {
    const next = (ret as any).getNextBlock?.();
    if (next) {
      try { (ret as any).nextConnection?.disconnect(); } catch {}
      try { next.moveBy(420, 120); } catch {}
    }
  }

  // Ensure ret is the last in the chain
  const headNow = (main as any).getInputTargetBlock?.("DO") || null;
  const tailNow = _heGetTail(headNow);
  if (!tailNow) {
    // Empty body: connect return as first statement
    try { stackConn.connect((ret as any).previousConnection); } catch {}
  } else if (tailNow.type !== "he_return_move" || tailNow.id !== ret.id) {
    // If return is somewhere else, detach it and append to tail
    try { (ret as any).previousConnection?.disconnect(); } catch {}
    try { (tailNow as any).nextConnection?.connect((ret as any).previousConnection); } catch {}
  }

  // Lock delete, but allow movement so blocks can insert above it.
  try { (ret as any).setDeletable?.(false); } catch {}
  try { (ret as any).setMovable?.(true); } catch {}

  _heEnsureReturnShadows(workspace, ret);
}

function _heEnsureTemplate(workspace: Blockly.WorkspaceSvg, reason: string): void {
  if (_heRepairing) return;
  _heRepairing = true;

  const Events: any = (Blockly as any).Events;
  try { if (Events && typeof Events.disable === "function") Events.disable(); } catch {}

  try {
    _heEnsureBlocksRegistered();
    _heEnsureOutputVars(workspace);
    const entries = _heEnsureEntryBlocks(workspace);
    for (const main of entries) {
      _heEnsureReturnAtEnd(workspace, main);
    }
  } finally {
    try { if (Events && typeof Events.enable === "function") Events.enable(); } catch {}
    _heRepairing = false;
  }

  try {
    if (_heStatusOverride && Date.now() < _heStatusOverride.untilMs) {
      // keep override
    } else {
      _heStatusOverride = null;
      _heSetStatus(reason ? `Template OK (${reason})` : "Template OK", 0);
    }
  } catch {}}

function _heIsUiEvent(e: any): boolean {
  if (!e) return true;
  return !!e.isUiEvent;
}

let _workspace: Blockly.WorkspaceSvg | null = null;
let _saveTimer: any = null;

function _getProfileName(): string {
  const g: any = globalThis as any;
  const p = g.__localHeroProfileName;
  return (typeof p === "string" && p.trim()) ? p.trim() : "Default";
}

function _storageKey(): string {
  const profile = _getProfileName();
  return STORAGE_PREFIX + encodeURIComponent(profile);
}

function _publishXmlToRuntime(xmlText: string): void {
  try {
    const g: any = globalThis as any;
    if (!g.__heBlocklyXmlByProfile) g.__heBlocklyXmlByProfile = {};
    g.__heBlocklyXmlByProfile[_getProfileName()] = String(xmlText || "");
  } catch {}
}

function _ensureDomInstalled(): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    #${BTN_ID}{
      position: fixed;
      right: 10px;
      top: 10px;
      z-index: 20000;
      padding: 8px 10px;
      font: 14px/1.1 monospace;
      border: 1px solid #000;
      background: rgba(18,18,22,0.92);
      color: rgba(255,255,255,0.92);
      cursor: pointer;
    }

    #${OVERLAY_ID}{
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      z-index: 30000;
      display: none;
      background: rgba(0,0,0,0.55);
    }

    #${OVERLAY_ID} .he-blockly-panel{
      position: absolute;
      left: 2%;
      top: 2%;
      width: 96%;
      height: 96%;
      background: rgba(18,18,22,0.98);
      border: 2px solid #000;
      display: flex;
      flex-direction: column;
    }

    #${OVERLAY_ID} .he-blockly-topbar{
      height: 44px;
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      font: 14px/1.1 monospace;
      color: rgba(255,255,255,0.92);
      user-select: none;
    }

    #${OVERLAY_ID} .he-blockly-topbar button{
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      cursor: pointer;
      border-radius: 6px;
      font: 14px/1.1 monospace;
    }
    #${OVERLAY_ID} .he-blockly-topbar button:hover{
      background: rgba(255,255,255,0.14);
    }

    #${OVERLAY_ID} #${HOST_ID}{
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    /* Ensure Blockly dropdowns/menus appear above our full-screen overlay */
    .blocklyWidgetDiv,
    .blocklyDropDownDiv,
    .blocklyMenuDiv,
    .blocklyTooltipDiv {
      z-index: 40050 !important;
    }
  `;
  document.head.appendChild(style);

  // Open button
  const openBtn = document.createElement("button");
  openBtn.id = BTN_ID;
  openBtn.textContent = "Blockly";
  openBtn.onclick = () => openBlocklyHeroLogicEditor();
  document.body.appendChild(openBtn);

  // Overlay panel
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="he-blockly-panel">
      <div class="he-blockly-topbar">
        <div style="flex:1;">Blockly Hero Logic — profile: <span id="he-blockly-prof"></span>
          <span id="he-blockly-status" style="margin-left:12px; opacity:0.75; font-size:12px;"></span>
        </div>
        <button id="he-blockly-save">Save XML</button>
        <button id="he-blockly-load">Load XML</button>
        <button id="he-blockly-reset">Reset</button>
        <button id="he-blockly-close">Close</button>
        <input id="he-blockly-file" type="file" accept=".xml,text/xml" style="display:none" />
      </div>
      <div id="${HOST_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector("#he-blockly-close") as HTMLButtonElement | null;
  const resetBtn = overlay.querySelector("#he-blockly-reset") as HTMLButtonElement | null;
  const saveBtn = overlay.querySelector("#he-blockly-save") as HTMLButtonElement | null;
  const loadBtn = overlay.querySelector("#he-blockly-load") as HTMLButtonElement | null;

  // File input (needed for Load XML)
  let fileInp = overlay.querySelector("#he-blockly-file") as HTMLInputElement | null;
  if (!fileInp) {
    fileInp = document.createElement("input");
    fileInp.id = "he-blockly-file";
    fileInp.type = "file";
    fileInp.accept = ".xml,text/xml";
    fileInp.style.display = "none";
    overlay.appendChild(fileInp);
  }

  if (!closeBtn || !resetBtn || !saveBtn || !loadBtn || !fileInp) {
    console.error("[blockly] overlay DOM missing required elements", {
      closeBtn: !!closeBtn,
      resetBtn: !!resetBtn,
      saveBtn: !!saveBtn,
      loadBtn: !!loadBtn,
      fileInp: !!fileInp,
    });
    throw new Error("[blockly] overlay DOM missing required elements");
  }

  closeBtn.onclick = () => closeBlocklyHeroLogicEditor();

  resetBtn.onclick = () => {
    try {
      _loadFromXmlText(DEFAULT_WORKSPACE_XML);
      _heEnsureTemplate(_ensureWorkspace(), "reset");
      _saveWorkspace();
      const st = document.getElementById("he-blockly-status");
      if (st) st.textContent = "Reset";
    } catch (e) {
      console.warn("[blockly] reset failed", e);
    }
  };

  saveBtn.onclick = () => {
    try {
      const ws = _ensureWorkspace();
      _heEnsureTemplate(ws, "save");
      const xml = Blockly.Xml.workspaceToDom(ws);
      const text = Blockly.Xml.domToPrettyText(xml);
      const blob = new Blob([text], { type: "text/xml" });
      const a = document.createElement("a");
      const prof = _getProfileName().replace(/[^a-z0-9_\-]+/gi, "_");
      a.download = `HeroLogic_${prof}.xml`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      const st = document.getElementById("he-blockly-status");
      if (st) st.textContent = "Saved XML";
    } catch (e) {
      console.warn("[blockly] save xml failed", e);
    }
  };

  loadBtn.onclick = () => {
    try {
      fileInp.value = "";
      fileInp.click();
    } catch (e) {
      console.warn("[blockly] load click failed", e);
    }
  };

  fileInp.addEventListener("change", async () => {
    const ws = _ensureWorkspace();
    const f = fileInp.files && fileInp.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      _loadFromXmlText(text);
      _heEnsureTemplate(ws, "load");
      _saveWorkspace();
      const st = document.getElementById("he-blockly-status");
      if (st) st.textContent = "Loaded XML";
    } catch (e) {
      console.warn("[blockly] load xml failed", e);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
      if (el && el.style.display !== "none") closeBlocklyHeroLogicEditor();
    }
  });
}





function _ensureWorkspace(): Blockly.WorkspaceSvg {
  if (_workspace) return _workspace;

  const host = document.getElementById(HOST_ID);
  if (!host) throw new Error("[blockly] missing host div");

  _heEnsureBlocksRegistered();

  // “MakeCode-ish” polish: Zelos renderer + slightly tuned theme.
  // Zelos is the renderer that most closely matches Scratch/MakeCode geometry.
  const heScratchLikeTheme = Blockly.Theme.defineTheme("he_scratch_like", {
    base: Blockly.Themes.Classic,

    // These styles are what make the *blocks* match Scratch (not just the category headers).
    blockStyles: {
      // Scratch: Operators (green)
      math_blocks: {
        colourPrimary: "#59C059",
        colourSecondary: "#46A046",
        colourTertiary: "#3B8F3B",
      },
      logic_blocks: {
        colourPrimary: "#59C059",
        colourSecondary: "#46A046",
        colourTertiary: "#3B8F3B",
      },

      // Scratch: Control / Loops (orange)
      loop_blocks: {
        colourPrimary: "#FFAB19",
        colourSecondary: "#E69900",
        colourTertiary: "#CC8800",
      },

      // Scratch: Text (purple)
      text_blocks: {
        colourPrimary: "#9966FF",
        colourSecondary: "#8557E6",
        colourTertiary: "#774DCC",
      },

      // Scratch: Lists (red-orange)
      list_blocks: {
        colourPrimary: "#FF661A",
        colourSecondary: "#E65C17",
        colourTertiary: "#CC5214",
      },

      // Scratch: Variables (orange)
      variable_blocks: {
        colourPrimary: "#FF8C1A",
        colourSecondary: "#E67D17",
        colourTertiary: "#CC6F14",
      },

      // Scratch: My Blocks (pink) — used for Functions / Procedures
      procedure_blocks: {
        colourPrimary: "#FF6680",
        colourSecondary: "#E65B72",
        colourTertiary: "#CC5165",
      },
    } as any,

    // Category header styling (you already liked these; keeping aligned)
    categoryStyles: {
      he_cat_output: { colour: "#FF6680" },
      he_cat_sensing: { colour: "#5CB1D6" },
      he_cat_operators: { colour: "#59C059" },
      he_cat_logic: { colour: "#FFAB19" },
      he_cat_loops: { colour: "#FFAB19" },
      he_cat_lists: { colour: "#FF661A" },
      he_cat_text: { colour: "#9966FF" },
      he_cat_variables: { colour: "#FF8C1A" },
      he_cat_functions: { colour: "#FF6680" },
    } as any,

    componentStyles: {
      // Scratch-like light UI
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


  _workspace = Blockly.inject(host, {
    toolbox: _heFilterToolbox(TOOLBOX),
    trashcan: true,

    // ✅ Big visual win:
    renderer: "zelos",

    // ✅ Scratch-like UI polish (colors/background/toolbox)
    theme: heScratchLikeTheme,

    // Nice ergonomics
    zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2.0, minScale: 0.4 },
    grid: { spacing: 20, length: 3, snap: true },
    move: { scrollbars: true, drag: true, wheel: true },
  });

  // Block illegal variable renames (reserved output vars)
  _heInstallReservedVariableGuards(_workspace);

  _workspace.addChangeListener((e: any) => {
    // Keep required template intact (ignore UI-only events)
    try {
      if (!_heRepairing && !_heIsUiEvent(e)) {
        _heEnforceReservedVarsOnEvent(_workspace!, e);
        _heEnsureTemplate(_workspace!, "event:" + String(e?.type || "change"));
      }

    } catch (err) {
      console.warn("[blockly] template repair failed", err);
    }

    // Debounced autosave
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try {
        _saveWorkspace();
      } catch (e) {
        console.warn("[blockly] save failed", e);
      }
    }, 250);
  });

  // Initial load
  const saved = localStorage.getItem(_storageKey());
  if (saved && saved.trim()) {
    _loadFromXmlText(saved);
    _publishXmlToRuntime(saved);
  } else {
    _loadFromXmlText(DEFAULT_WORKSPACE_XML);
    _saveWorkspace();
  }

  // Required template enforcement (main + terminal return + reserved output vars)
  try { _heEnsureTemplate(_workspace, "initial"); } catch (e) { console.warn("[blockly] template ensure failed", e); }
  return _workspace;
}

function _loadFromXmlText(xmlText: string): void {
  if (!_workspace) return;

  const uxml = (Blockly as any)?.utils?.xml;
  const dom = (uxml && typeof uxml.textToDom === "function")
    ? uxml.textToDom(xmlText)
    : (Blockly as any).Xml.textToDom(xmlText);

  // Loading XML can create variables before our canonical reserved-var IDs are established.
  // Suppress "name exists" UI during load to avoid modal spam / loops (e.g., on Reset).
  _heLoadingXml = true;
  _heSuppressNameExistsUi = true;
  try {
    Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, _workspace);
  } finally {
    _heSuppressNameExistsUi = false;
    _heLoadingXml = false;
  }
}


function _saveWorkspace(): void {
  if (!_workspace) return;

  const dom = Blockly.Xml.workspaceToDom(_workspace);

  const uxml = (Blockly as any)?.utils?.xml;
  const xmlText = (uxml && typeof uxml.domToText === "function")
    ? uxml.domToText(dom)
    : Blockly.Xml.domToText(dom);

  localStorage.setItem(_storageKey(), xmlText);
  _publishXmlToRuntime(xmlText);
}

export function openBlocklyHeroLogicEditor(): void {
  _ensureDomInstalled();

  const overlay = document.getElementById(OVERLAY_ID)!;
  overlay.style.display = "block";

  const profSpan = overlay.querySelector("#he-blockly-prof") as HTMLSpanElement;
  profSpan.textContent = _getProfileName();

  const ws = _ensureWorkspace();
  // Must resize after becoming visible
  setTimeout(() => {
    try {
      Blockly.svgResize(ws);
    } catch {}
  }, 0);
}

export function closeBlocklyHeroLogicEditor(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.style.display = "none";
}

export function resetBlocklyHeroLogicEditorToDefault(): void {
  if (!_workspace) return;
  _loadFromXmlText(DEFAULT_WORKSPACE_XML);
  _saveWorkspace();
  try {
    Blockly.svgResize(_workspace);
  } catch {}
}

export function installBlocklyHeroLogicEditor(): void {
  const g: any = globalThis as any;
  if (g.__heBlocklyHeroLogicInstalled) return;
  g.__heBlocklyHeroLogicInstalled = true;

  // Expose small globals for quick testing if you want:
  g.__heOpenBlocklyHeroLogicEditor = openBlocklyHeroLogicEditor;
  g.__heCloseBlocklyHeroLogicEditor = closeBlocklyHeroLogicEditor;

  // Don’t require DOM to already exist — install once DOM is ready.
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => _ensureDomInstalled(), { once: true });
  } else {
    _ensureDomInstalled();
  }
}
