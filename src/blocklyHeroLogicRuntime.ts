// src/blocklyHeroLogicRuntime.ts
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";

const STORAGE_PREFIX = "he_blockly_ws_v1:";
const STEP_LIMIT = 20000;


const HE_OUTPUT_VARS = ["family", "damage", "reach", "time", "status", "element", "id"] as const;

let _heBlocksRegistered = false;

function _ensureHeBlocksRegistered(): void {
  if (_heBlocksRegistered) return;
  _heBlocksRegistered = true;

  const Blocks: any = (Blockly as any).Blocks || {};

  // Block definitions (needed for headless XML->workspace compile)
  if (!Blocks["he_return_move"]) {
    (Blockly as any).Blocks["he_return_move"] = {
      init: function () {
        this.setColour(170);
        this.appendDummyInput().appendField("Return Move (7)");
        this.appendValueInput("FAMILY").appendField("Family:");
        this.appendValueInput("DAMAGE").appendField("Damage:");
        this.appendValueInput("REACH").appendField("Reach:");
        this.appendValueInput("TIME").appendField("Time:");
        this.appendValueInput("STATUS").appendField("Status:");
        this.appendValueInput("ELEMENT").appendField("Element:");
        this.appendValueInput("ID").appendField("ID:");
        this.setPreviousStatement(true);
        this.setNextStatement(false);
      },
    };
  }

  const _mkDropdownSetter = (type: string, label: string, field: string, options: Array<[string, string]>) => {
    if (Blocks[type]) return;
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#4cff88");
        this.appendDummyInput().appendField(label).appendField(new (Blockly as any).FieldDropdown(options), field);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      },
    };
  };
  const _mkEntry = (type: string, label: string) => {
    if (Blocks[type]) return;
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#ffd54a");
        this.appendDummyInput().appendField(label);
        this.appendStatementInput("DO").appendField("do");
        this.setTooltip("Your main decision logic goes here. Must end with Return Move (7).");
      },
    };
  };
  _mkEntry("he_on_button_a", "When A Button Pressed");
  _mkEntry("he_on_button_b", "When B Button Pressed");
  _mkEntry("he_on_button_ab", "When A+B Button Pressed");
  _mkEntry("he_choose_move", "Choose My Move");


  _mkDropdownSetter("he_set_family", "set family to", "FAM", [
    ["strength", "strength"], ["agility", "agility"], ["intelligence", "intelligence"], ["wisdom", "wisdom"],
  ]);
  _mkDropdownSetter("he_set_element", "set element to", "EL", [
    ["none", "none"], ["fire", "fire"], ["earth", "earth"], ["wind", "wind"], ["water", "water"],
    ["lightning", "lightning"], ["ice", "ice"], ["poison", "poison"],
  ]);
  _mkDropdownSetter("he_set_id", "set id to", "ID", [["A", "A"], ["B", "B"], ["A+B", "A+B"]]);

  const _mkNumSetter = (type: string, label: string) => {
    if (Blocks[type]) return;
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#4cff88");
        this.appendValueInput("VALUE").appendField(label);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      },
    };
  };

  _mkNumSetter("he_set_damage", "set damage to");
  _mkNumSetter("he_set_reach", "set reach to");
  _mkNumSetter("he_set_time", "set time to");
  _mkNumSetter("he_set_status", "set status to");

  const _mkSensor = (type: string, label: string, output: string | null) => {
    if (Blocks[type]) return;
    (Blockly as any).Blocks[type] = {
      init: function () {
        this.setColour("#4aa3ff");
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
  _mkSensor("he_ro_weakest_enemy_index", "index of weakest enemy", "Number");

  if (!Blocks["he_ro_enemy_hp_at"]) {
    (Blockly as any).Blocks["he_ro_enemy_hp_at"] = {
      init: function () {
        this.setColour("#4aa3ff");
        this.appendValueInput("I").appendField("enemy HP at index");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_ro_enemy_dist_at"]) {
    (Blockly as any).Blocks["he_ro_enemy_dist_at"] = {
      init: function () {
        this.setColour("#4aa3ff");
        this.appendValueInput("I").appendField("enemy distance at index");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_ro_enemies_within_radius"]) {
    (Blockly as any).Blocks["he_ro_enemies_within_radius"] = {
      init: function () {
        this.setColour("#4aa3ff");
        this.appendValueInput("R").appendField("enemies within radius");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_grid_make"]) {
    (Blockly as any).Blocks["he_grid_make"] = {
      init: function () {
        this.setColour("#ff4b4b");
        this.appendValueInput("ROWS").appendField("make grid rows");
        this.appendValueInput("COLS").appendField("cols");
        this.appendValueInput("FILL").appendField("fill");
        this.setOutput(true);
      },
    };
  }

  if (!Blocks["he_grid_get"]) {
    (Blockly as any).Blocks["he_grid_get"] = {
      init: function () {
        this.setColour("#ff4b4b");
        this.appendValueInput("GRID").appendField("grid");
        this.appendValueInput("ROW").appendField("row");
        this.appendValueInput("COL").appendField("col");
        this.setOutput(true);
      },
    };
  }

  if (!Blocks["he_grid_set"]) {
    (Blockly as any).Blocks["he_grid_set"] = {
      init: function () {
        this.setColour("#ff4b4b");
        this.appendValueInput("GRID").appendField("set grid");
        this.appendValueInput("ROW").appendField("row");
        this.appendValueInput("COL").appendField("col");
        this.appendValueInput("VALUE").appendField("to");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      },
    };
  }

  // --- Extra Math helpers (your build lacks core math_minmax) ---
  if (!Blocks["he_math_min2"]) {
    (Blockly as any).Blocks["he_math_min2"] = {
      init: function () {
        this.setColour("#ffd54a");
        this.appendValueInput("A").appendField("min");
        this.appendValueInput("B").appendField("and");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_math_max2"]) {
    (Blockly as any).Blocks["he_math_max2"] = {
      init: function () {
        this.setColour("#ffd54a");
        this.appendValueInput("A").appendField("max");
        this.appendValueInput("B").appendField("and");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_math_clamp"]) {
    (Blockly as any).Blocks["he_math_clamp"] = {
      init: function () {
        this.setColour("#ffd54a");
        this.appendValueInput("V").appendField("clamp");
        this.appendValueInput("MIN").appendField("min");
        this.appendValueInput("MAX").appendField("max");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_list_min"]) {
    (Blockly as any).Blocks["he_list_min"] = {
      init: function () {
        this.setColour("#ff4b4b");
        this.appendValueInput("LIST").appendField("min of list");
        this.setOutput(true, "Number");
      },
    };
  }

  if (!Blocks["he_list_max"]) {
    (Blockly as any).Blocks["he_list_max"] = {
      init: function () {
        this.setColour("#ff4b4b");
        this.appendValueInput("LIST").appendField("max of list");
        this.setOutput(true, "Number");
      },
    };
  }

  // Generators (these MUST exist for headless compile).
  const G: any = javascriptGenerator as any;

  G.forBlock["he_return_move"] = function (block: any, generator: any) {
    const family = generator.valueToCode(block, "FAMILY", generator.ORDER_NONE) || `"strength"`;
    const damage = generator.valueToCode(block, "DAMAGE", generator.ORDER_NONE) || "0";
    const reach = generator.valueToCode(block, "REACH", generator.ORDER_NONE) || "0";
    const time = generator.valueToCode(block, "TIME", generator.ORDER_NONE) || "0";
    const status = generator.valueToCode(block, "STATUS", generator.ORDER_NONE) || "0";
    const element = generator.valueToCode(block, "ELEMENT", generator.ORDER_NONE) || `"none"`;
    const id = generator.valueToCode(block, "ID", generator.ORDER_NONE) || `"A"`;
    return `return [
  __heVal(${family}, "strength"),
  __heNum(${damage}),
  __heNum(${reach}),
  __heNum(${time}),
  __heNum(${status}),
  __heVal(${element}, "none"),
  (typeof __heForcedId !== "undefined" ? __heForcedId : __heVal(${id}, "A"))
];
`;
  };
  // Main entry: generates the actual function the engine calls.
  const _emitRouter = () => `
function chooseMyMove(button) {
  if (button === "A" && typeof chooseMoveA === "function") return chooseMoveA(button);
  if (button === "B" && typeof chooseMoveB === "function") return chooseMoveB(button);
  if (button === "A+B" && typeof chooseMoveAB === "function") return chooseMoveAB(button);
  if (typeof chooseMoveA === "function") return chooseMoveA(button);
  if (typeof chooseMoveB === "function") return chooseMoveB(button);
  if (typeof chooseMoveAB === "function") return chooseMoveAB(button);
  return null;
}
function heroLogic(button){ return chooseMyMove(button); }
`;

  const _emitDefaults = (forcedId: string) => `
  family = (family == null) ? "strength" : family;
  damage = (typeof damage === "number" && isFinite(damage)) ? damage : 0;
  reach = (typeof reach === "number" && isFinite(reach)) ? reach : 0;
  time = (typeof time === "number" && isFinite(time)) ? time : 0;
  status = (typeof status === "number" && isFinite(status)) ? status : 0;
  element = (element == null) ? "none" : element;
  id = ${JSON.stringify(forcedId)};
`;

  const _mkEntryGen = (type: string, fnName: string, forcedId: string) => {
    G.forBlock[type] = function (block: any, generator: any) {
      const body = generator.statementToCode(block, "DO");
      return `function ${fnName}(button) {
  const __heForcedId = ${JSON.stringify(forcedId)};
${_emitDefaults(forcedId)}
${body}}
${_emitRouter()}`;
    };
  };

  _mkEntryGen("he_on_button_a", "chooseMoveA", "A");
  _mkEntryGen("he_on_button_b", "chooseMoveB", "B");
  _mkEntryGen("he_on_button_ab", "chooseMoveAB", "A+B");

  G.forBlock["he_choose_move"] = function (block: any, generator: any) {
    const body = generator.statementToCode(block, "DO");
    return `function chooseMyMove(button) {
${body}}
function heroLogic(button){ return chooseMyMove(button); }
`;
  };


  // Output setters
  G.forBlock["he_set_family"] = function (block: any) {
    const fam = block.getFieldValue("FAM") || "strength";
    return `family = ${JSON.stringify(fam)};
`;
  };

  G.forBlock["he_set_element"] = function (block: any) {
    const el = block.getFieldValue("EL") || "none";
    return `element = ${JSON.stringify(el)};
`;
  };

  G.forBlock["he_set_id"] = function (block: any) {
    const id = block.getFieldValue("ID") || "A";
    return `id = ${JSON.stringify(id)};
`;
  };

  const _mkNumSetterGen = (type: string, varName: string) => {
    G.forBlock[type] = function (block: any, generator: any) {
      const v = generator.valueToCode(block, "VALUE", generator.ORDER_NONE) || "0";
      return `${varName} = ${v};
`;
    };
  };

  _mkNumSetterGen("he_set_damage", "damage");
  _mkNumSetterGen("he_set_reach", "reach");
  _mkNumSetterGen("he_set_time", "time");
  _mkNumSetterGen("he_set_status", "status");

  // Sensors (read-only getters)
  const _sensor = (type: string, expr: string) => {
    G.forBlock[type] = function () {
      return [expr, G.ORDER_FUNCTION_CALL];
    };
  };

  _sensor("he_ro_my_hp", "__heRO_myHp()");
  _sensor("he_ro_my_mp", "__heRO_myMp()");
  _sensor("he_ro_my_x", "__heRO_myX()");
  _sensor("he_ro_my_y", "__heRO_myY()");
  _sensor("he_ro_enemy_count", "__heRO_enemyCount()");
  _sensor("he_ro_closest_enemy_exists", "__heRO_enemyCount() > 0");
  _sensor("he_ro_closest_enemy_hp", "__heRO_closestEnemyHp()");
  _sensor("he_ro_closest_enemy_dist", "__heRO_closestEnemyDist()");
  _sensor("he_ro_weakest_enemy_index", "__heRO_weakestEnemyIndex()");

  G.forBlock["he_ro_enemies_within_radius"] = function (block: any, generator: any) {
    const r = generator.valueToCode(block, "R", generator.ORDER_NONE) || "0";
    return [`__heRO_enemiesWithinRadius(${r})`, G.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_ro_enemy_hp_at"] = function (block: any, generator: any) {
    const i = generator.valueToCode(block, "I", generator.ORDER_NONE) || "0";
    return [`__heRO_enemyHpAt(${i})`, G.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_ro_enemy_dist_at"] = function (block: any, generator: any) {
    const i = generator.valueToCode(block, "I", generator.ORDER_NONE) || "0";
    return [`__heRO_enemyDistAt(${i})`, G.ORDER_FUNCTION_CALL];
  };

  // 2D list helpers
  G.forBlock["he_grid_make"] = function (block: any, generator: any) {
    const rows = generator.valueToCode(block, "ROWS", generator.ORDER_NONE) || "0";
    const cols = generator.valueToCode(block, "COLS", generator.ORDER_NONE) || "0";
    const fill = generator.valueToCode(block, "FILL", generator.ORDER_NONE) || "0";
    return [`__heGridMake(${rows}, ${cols}, ${fill})`, G.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_grid_get"] = function (block: any, generator: any) {
    const grid = generator.valueToCode(block, "GRID", generator.ORDER_NONE) || "[]";
    const row = generator.valueToCode(block, "ROW", generator.ORDER_NONE) || "0";
    const col = generator.valueToCode(block, "COL", generator.ORDER_NONE) || "0";
    return [`__heGridGet(${grid}, ${row}, ${col})`, G.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_grid_set"] = function (block: any, generator: any) {
    const grid = generator.valueToCode(block, "GRID", generator.ORDER_NONE) || "[]";
    const row = generator.valueToCode(block, "ROW", generator.ORDER_NONE) || "0";
    const col = generator.valueToCode(block, "COL", generator.ORDER_NONE) || "0";
    const val = generator.valueToCode(block, "VALUE", generator.ORDER_NONE) || "0";
    return `__heGridSet(${grid}, ${row}, ${col}, ${val});
`;
  };

  G.forBlock["he_math_min2"] = function (block: any, generator: any) {
    const a = generator.valueToCode(block, "A", generator.ORDER_NONE) || "0";
    const b = generator.valueToCode(block, "B", generator.ORDER_NONE) || "0";
    return [`Math.min(${a}, ${b})`, generator.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_math_max2"] = function (block: any, generator: any) {
    const a = generator.valueToCode(block, "A", generator.ORDER_NONE) || "0";
    const b = generator.valueToCode(block, "B", generator.ORDER_NONE) || "0";
    return [`Math.max(${a}, ${b})`, generator.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_math_clamp"] = function (block: any, generator: any) {
    const v = generator.valueToCode(block, "V", generator.ORDER_NONE) || "0";
    const mn = generator.valueToCode(block, "MIN", generator.ORDER_NONE) || "0";
    const mx = generator.valueToCode(block, "MAX", generator.ORDER_NONE) || "0";
    // clamp(v, mn, mx) => min(max(v, mn), mx)
    return [`Math.min(Math.max(${v}, ${mn}), ${mx})`, generator.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_list_min"] = function (block: any, generator: any) {
    const list = generator.valueToCode(block, "LIST", generator.ORDER_NONE) || "[]";
    const code = `(function(__a){ if(!Array.isArray(__a)||__a.length===0) return 0; let __m=Number(__a[0]); if(!Number.isFinite(__m)) __m=0; for(let __i=1; __i<__a.length; __i++){ const __v=Number(__a[__i]); if(!Number.isFinite(__v)) continue; if(__v<__m) __m=__v; } return __m; })(${list})`;
    return [code, generator.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_list_max"] = function (block: any, generator: any) {
    const list = generator.valueToCode(block, "LIST", generator.ORDER_NONE) || "[]";
    const code = `(function(__a){ if(!Array.isArray(__a)||__a.length===0) return 0; let __m=Number(__a[0]); if(!Number.isFinite(__m)) __m=0; for(let __i=1; __i<__a.length; __i++){ const __v=Number(__a[__i]); if(!Number.isFinite(__v)) continue; if(__v>__m) __m=__v; } return __m; })(${list})`;
    return [code, generator.ORDER_FUNCTION_CALL];
  };
}

// Ensure registration on module load (runtime compiles headlessly).
_ensureHeBlocksRegistered();


type HeroLogicOut = any[] | null;

type CacheEntry = {
  profile: string;
  xml: string;
  fn: ((button: string) => any) | null;
  lastErr: string | null;
  lastRaw: any;
};

const _cache = new Map<string, CacheEntry>();
(globalThis as any).__heBlocklyLogicCache = _cache;

// ---- Blockly v12 deprecation shim (silence getAllVariables warning) ----
(() => {
  const W: any = (Blockly as any).Workspace;
  if (!W || !W.prototype) return;

  (W.prototype as any).getAllVariables = function () {
    const vm = this.getVariableMap?.();
    if (vm && typeof vm.getAllVariables === "function") return vm.getAllVariables();
    return [];
  };
})();

function _storageKey(profile: string): string {
  return STORAGE_PREFIX + encodeURIComponent(profile || "Default");
}

function _getSavedXml(profile: string): string | null {
  try {
    const g: any = globalThis as any;
    const map = g && g.__heBlocklyXmlByProfile;
    if (map && typeof map === "object") {
      const live = String(map[profile] || "");
      if (live && live.trim()) return live;
    }

    const key = _storageKey(profile);
    const xml = localStorage.getItem(key);
    return xml && xml.trim() ? xml : null;
  } catch {
    return null;
  }
}

function _xmlTextToDom(xmlText: string): Element {
  const uxml = (Blockly as any)?.utils?.xml;
  if (uxml && typeof uxml.textToDom === "function") return uxml.textToDom(xmlText);

  const x = (Blockly as any)?.Xml;
  if (x && typeof x.textToDom === "function") return x.textToDom(xmlText);

  throw new Error("no-xml-textToDom");
}


function _compileFromXml(xmlText: string): { ok: true; fn: (button: string) => any } | { ok: false; err: string } {
  try {
    _ensureHeBlocksRegistered();

    const ws = new (Blockly as any).Workspace();
    const dom =
      (Blockly as any).utils?.xml?.textToDom?.(xmlText) ||
      (Blockly as any).Xml?.textToDom?.(xmlText);
    if (!dom) return { ok: false, err: "no xml parser available" };

    (Blockly as any).Xml.domToWorkspace(dom, ws);

    // Generate JS from blocks
    const code = javascriptGenerator.workspaceToCode(ws);

    // Helpers are available inside heroLogic().
    const helpers = `
      function __heRO() {
        const hasGT = (typeof globalThis !== "undefined");
        const ro = (hasGT && globalThis.__heBlocklyRO) ? globalThis.__heBlocklyRO : null;
        return ro || {
          meHp: 0, meMp: 0, meX: 0, meY: 0,
          enemyCount: 0, enemyHp: [], enemyDistSq: []
        };
      }
      function __heNum(v) { const n = Number(v); return (typeof n === "number" && isFinite(n)) ? n : 0; }
      function __heVal(v, def) { return (v == null) ? def : v; }
      function __heRO_myHp() { const ro = __heRO(); return (ro.meHp|0) || 0; }
      function __heRO_myMp() { const ro = __heRO(); return (ro.meMp|0) || 0; }
      function __heRO_myX() { const ro = __heRO(); return (+ro.meX) || 0; }
      function __heRO_myY() { const ro = __heRO(); return (+ro.meY) || 0; }

      function __heRO_enemyCount() { const ro = __heRO(); return (ro.enemyCount|0) || 0; }
      function __heRO_enemyHpAt(i) {
        const ro = __heRO();
        const a = (ro.enemyHp && ro.enemyHp.length) ? ro.enemyHp : [];
        const idx = (i|0);
        if (idx < 0 || idx >= a.length) return 0;
        const v = a[idx];
        return (typeof v === "number") ? (v|0) : 0;
      }
      function __heRO_enemyDistSqAt(i) {
        const ro = __heRO();
        const a = (ro.enemyDistSq && ro.enemyDistSq.length) ? ro.enemyDistSq : [];
        const idx = (i|0);
        if (idx < 0 || idx >= a.length) return 0;
        const v = a[idx];
        return (typeof v === "number") ? (+v) : 0;
      }
      function __heRO_enemyDistAt(i) {
        const ds = __heRO_enemyDistSqAt(i);
        return Math.sqrt(Math.max(0, ds));
      }
      function __heRO_closestEnemyIndex() {
        const ro = __heRO();
        const n = __heRO_enemyCount();
        if (n <= 0) return -1;
        const ds = (ro.enemyDistSq && ro.enemyDistSq.length) ? ro.enemyDistSq : [];
        let bestI = 0;
        let best = (typeof ds[0] === "number") ? (+ds[0]) : 0;
        for (let i = 1; i < n; i++) {
          const v = (typeof ds[i] === "number") ? (+ds[i]) : 0;
          if (v < best) { best = v; bestI = i; }
        }
        return bestI;
      }
      function __heRO_closestEnemyHp() {
        const i = __heRO_closestEnemyIndex();
        return __heRO_enemyHpAt(i);
      }
      function __heRO_closestEnemyDist() {
        const i = __heRO_closestEnemyIndex();
        return __heRO_enemyDistAt(i);
      }
      function __heRO_weakestEnemyIndex() {
        const n = __heRO_enemyCount();
        if (n <= 0) return -1;
        let bestI = 0;
        let best = __heRO_enemyHpAt(0);
        for (let i = 1; i < n; i++) {
          const hp = __heRO_enemyHpAt(i);
          if (hp < best) { best = hp; bestI = i; }
        }
        return bestI;
      }
      function __heRO_enemiesWithinRadius(r) {
        const n = __heRO_enemyCount();
        if (n <= 0) return 0;
        const rr = (+r);
        const r2 = rr * rr;
        let c = 0;
        for (let i = 0; i < n; i++) {
          if (__heRO_enemyDistSqAt(i) <= r2) c++;
        }
        return c;
      }

      function __heGridMake(rows, cols, fill) {
        const r = Math.max(0, rows|0);
        const c = Math.max(0, cols|0);
        const g = [];
        for (let y = 0; y < r; y++) {
          const row = [];
          for (let x = 0; x < c; x++) row.push(fill);
          g.push(row);
        }
        return g;
      }
      function __heGridGet(grid, row, col) {
        const r = row|0, c = col|0;
        if (!grid || !grid.length) return null;
        const rr = grid[r];
        if (!rr || !rr.length) return null;
        return rr[c];
      }
      function __heGridSet(grid, row, col, value) {
        const r = row|0, c = col|0;
        if (!grid) return;
        if (!grid[r]) grid[r] = [];
        grid[r][c] = value;
      }
    `;

    // Back-compat: publish __heBlocklyRO fields as globals for older student code
    const bindings = `
      try {
        const hasGT = (typeof globalThis !== "undefined");
        const ro = (hasGT && globalThis.__heBlocklyRO) ? globalThis.__heBlocklyRO : null;
        const g = hasGT ? globalThis : null;
        if (ro && g) {
          g.meHp = ro.meHp; g.meMp = ro.meMp; g.meX = ro.meX; g.meY = ro.meY;
          g.enemyCount = ro.enemyCount || 0;
          g.enemyHp = ro.enemyHp || [];
          g.enemyDistSq = ro.enemyDistSq || [];
        }
      } catch (e) {}
    
// Ensure required output vars always exist (prevents ReferenceError if XML only reads them).
var family = (family == null) ? "strength" : family;
var damage = (typeof damage === "number" && isFinite(damage)) ? damage : 0;
var reach = (typeof reach === "number" && isFinite(reach)) ? reach : 0;
var time = (typeof time === "number" && isFinite(time)) ? time : 0;
var status = (typeof status === "number" && isFinite(status)) ? status : 0;
var element = (element == null) ? "none" : element;
var id = (id == null) ? "A" : id;
`;

    const factorySrc = `
      "use strict";
      ${helpers}
      ${bindings}
            ${code}
      // Always provide a callable heroLogic wrapper for engine compatibility.
      // (Your UI entrypoint is Choose My Move -> chooseMyMove.)
      if (typeof heroLogic !== "function") {
        function heroLogic(button) {
          if (typeof chooseMyMove === "function") return chooseMyMove(button);
          return null;
        }
      }
      return (typeof chooseMyMove === "function") ? chooseMyMove : ((typeof heroLogic === "function") ? heroLogic : null);
    `;

    const factory = new Function(factorySrc) as any;
    const fn = factory();
    if (typeof fn !== "function") return { ok: false, err: "heroLogic() not defined" };
    return { ok: true, fn };
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e) };
  }
}

function _validateOut(out: any): HeroLogicOut {
  if (out == null) return null;
  if (!Array.isArray(out)) return null;
  if (out.length !== 7) return null;

  // Slot 0 (family): string or number
  if (!(typeof out[0] === "string" || (typeof out[0] === "number" && Number.isFinite(out[0])))) return null;

  // Slots 1..4 (trait points): must be finite numbers
  for (let i = 1; i <= 4; i++) {
    if (!(typeof out[i] === "number" && Number.isFinite(out[i]))) return null;
  }

  // Slot 5 (element): string or number
  if (!(typeof out[5] === "string" || (typeof out[5] === "number" && Number.isFinite(out[5])))) return null;

  // Slot 6 (anim): string or number
  if (!(typeof out[6] === "string" || (typeof out[6] === "number" && Number.isFinite(out[6])))) return null;

  // Return a shallow copy so downstream can safely read without mutation surprises
  return out.slice(0, 7);
}

/**
 * Returns:
 * - any[7] if Blockly workspace exists + runs successfully + passes validation
 * - null if no workspace, compile error, runtime error, invalid result, or step-limit
 */
export function tryRunBlocklyHeroLogic(profile: string, button: string): HeroLogicOut {
  const effectiveProfile = profile && profile.trim() ? profile.trim() : "Default";

  const xml = _getSavedXml(effectiveProfile);
  if (!xml) return null;

  const cached = _cache.get(effectiveProfile);
  if (!cached || cached.xml !== xml) {
    const { fn, err } = _compileFromXml(xml);
    _cache.set(effectiveProfile, {
      profile: effectiveProfile,
      xml,
      fn,
      lastErr: err,
      lastRaw: null,
    });

    if (err) {
      console.warn(`[BlocklyHeroLogic] compile failed profile=${effectiveProfile} err=${err}`);
      return null;
    }
  }

  const entry = _cache.get(effectiveProfile)!;
  if (!entry.fn) return null;

  try {
    const rawOut = entry.fn(button);
    entry.lastRaw = rawOut;

    const ok = _validateOut(rawOut);
    if (!ok) {
      entry.lastErr = "invalid-out";
      return null;
    }

    entry.lastErr = null;
    return ok;
  } catch (e: any) {
    const msg = String(e?.message || e);
    entry.lastErr = msg;
    console.warn(`[BlocklyHeroLogic] runtime failed profile=${effectiveProfile} err=${msg}`);
    return null;
  }
}

// Debug helper: why am I missing?
export function dbgBlocklyHeroLogic(profile: string) {
  const p = profile && profile.trim() ? profile.trim() : "Default";
  const key = _storageKey(p);
  const xml = _getSavedXml(p);
  const entry = _cache.get(p) || null;

  return {
    profile: p,
    key,
    hasXml: !!xml,
    xmlLen: xml ? xml.length : 0,
    cached: !!entry,
    lastErr: entry?.lastErr ?? null,
    lastRaw: entry?.lastRaw ?? null,
  };
}

(globalThis as any).__heBlocklyHeroLogicDebug = dbgBlocklyHeroLogic;
