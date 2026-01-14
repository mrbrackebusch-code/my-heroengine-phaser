// src/blocklyHeroLogicRuntime.ts
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";

const STORAGE_PREFIX = "he_blockly_ws_v1:";
const STEP_LIMIT = 20000;
const FALLBACK_PROFILE = "Default";


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
        this.setDeletable(true);
        this.setMovable(true);
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

  // Enemy/Hero property accessors with dropdown fields
  const enemyFieldOptions = [
    ["hp", "hp"], ["maxHp", "maxHp"], ["mana", "mana"], ["maxMana", "maxMana"],
    ["x", "x"], ["y", "y"], ["vx", "vx"], ["vy", "vy"], ["damage", "dmg"], ["distSq", "distSq"],
  ];
  if (!Blocks["he_ro_enemy_field"]) {
    (Blockly as any).Blocks["he_ro_enemy_field"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField(new (Blockly as any).FieldDropdown(enemyFieldOptions), "FIELD").appendField("of enemy at index");
        this.appendValueInput("I").setCheck("Number");
        this.setOutput(true, "Number");
      },
    };
  }
  const heroFieldOptions = [
    ["hp", "hp"], ["maxHp", "maxHp"], ["mana", "mana"], ["maxMana", "maxMana"],
    ["level", "lvl"], ["x", "x"], ["y", "y"], ["vx", "vx"], ["vy", "vy"], ["damage", "dmg"],
  ];
  if (!Blocks["he_ro_hero_field"]) {
    (Blockly as any).Blocks["he_ro_hero_field"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField(new (Blockly as any).FieldDropdown(heroFieldOptions), "FIELD").appendField("of hero at index");
        this.appendValueInput("I").setCheck("Number");
        this.setOutput(true, "Number");
      },
    };
  }
  if (!Blocks["he_ro_my_field"]) {
    (Blockly as any).Blocks["he_ro_my_field"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField("my").appendField(new (Blockly as any).FieldDropdown(heroFieldOptions), "FIELD");
        this.setOutput(true, "Number");
      },
    };
  }
  if (!Blocks["he_ro_my_ids"]) {
    (Blockly as any).Blocks["he_ro_my_ids"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField("my").appendField(new (Blockly as any).FieldDropdown([
          ["relic ids", "relics"], ["weapon ids", "weapons"],
        ]), "KIND");
        this.setOutput(true);
      },
    };
  }
  if (!Blocks["he_ro_closest_enemy_field"]) {
    (Blockly as any).Blocks["he_ro_closest_enemy_field"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField(new (Blockly as any).FieldDropdown(enemyFieldOptions), "FIELD").appendField("of closest enemy");
        this.setOutput(true, "Number");
      },
    };
  }
  if (!Blocks["he_ro_reach_px"]) {
    (Blockly as any).Blocks["he_ro_reach_px"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput()
          .appendField("range of")
          .appendField(new (Blockly as any).FieldDropdown([
            ["strength", "strength"], ["agility", "agility"], ["intelligence", "intelligence"], ["wisdom", "wisdom"],
          ]), "FAM")
          .appendField("move with reach");
        this.appendValueInput("REACH").setCheck("Number");
        this.setOutput(true, "Number");
      },
    };
  }
  if (!Blocks["he_ro_my_ids"]) {
    (Blockly as any).Blocks["he_ro_my_ids"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField("my").appendField(new (Blockly as any).FieldDropdown([
          ["relic ids", "relics"], ["weapon ids", "weapons"],
        ]), "KIND");
        this.setOutput(true);
      },
    };
  }
  if (!Blocks["he_ro_closest_enemy_field"]) {
    (Blockly as any).Blocks["he_ro_closest_enemy_field"] = {
      init: function () {
        this.setColour("#5CB1D6");
        this.appendDummyInput().appendField(new (Blockly as any).FieldDropdown(enemyFieldOptions), "FIELD").appendField("of closest enemy");
        this.setOutput(true, "Number");
      },
    };
  }


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
        const input = this.appendValueInput("VALUE").appendField(label).setCheck("Number");
        try {
          // Shadow default so users start with a number field already present.
          const shadow = Blockly.utils.xml.textToDom('<shadow type="math_number"><field name="NUM">0</field></shadow>');
          input.connection.setShadowDom(shadow);
        } catch { }
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      },
    };
  };

  _mkNumSetter("he_set_damage", "set damage to");
  _mkNumSetter("he_set_reach", "set reach to");
  _mkNumSetter("he_set_time", "set time to");
  _mkNumSetter("he_set_status", "set status to");

  // Convenience block: set all outputs at once
  if (!Blocks["he_set_outputs_bundle"]) {
    (Blockly as any).Blocks["he_set_outputs_bundle"] = {
      init: function () {
        this.setColour(170);
        this.appendDummyInput().appendField("Set move outputs");
        this.appendDummyInput().appendField("family").appendField(new (Blockly as any).FieldDropdown([
          ["strength", "strength"], ["agility", "agility"], ["intelligence", "intelligence"], ["wisdom", "wisdom"],
        ]), "FAM");
        const dmg = this.appendValueInput("DAMAGE").appendField("damage").setCheck("Number");
        const reach = this.appendValueInput("REACH").appendField("reach").setCheck("Number");
        const time = this.appendValueInput("TIME").appendField("time").setCheck("Number");
        const status = this.appendValueInput("STATUS").appendField("status").setCheck("Number");
        try {
          const numShadow = '<shadow type="math_number"><field name="NUM">0</field></shadow>';
          dmg.connection.setShadowDom(Blockly.utils.xml.textToDom(numShadow));
          reach.connection.setShadowDom(Blockly.utils.xml.textToDom(numShadow));
          time.connection.setShadowDom(Blockly.utils.xml.textToDom(numShadow));
          status.connection.setShadowDom(Blockly.utils.xml.textToDom(numShadow));
        } catch { }
        this.appendDummyInput().appendField("element").appendField(new (Blockly as any).FieldDropdown([
          ["none", "none"], ["fire", "fire"], ["earth", "earth"], ["wind", "wind"], ["water", "water"],
          ["lightning", "lightning"], ["ice", "ice"], ["poison", "poison"],
        ]), "EL");
        this.appendDummyInput().appendField("ID").appendField(new (Blockly as any).FieldDropdown([
          ["A", "A"], ["B", "B"], ["A+B", "A+B"],
        ]), "ID");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      },
    };
  }

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

  _mkSensor("he_ro_enemy_count", "total enemy count", "Number");
  _mkSensor("he_ro_weakest_enemy_index", "index of weakest enemy", "Number");
  _mkSensor("he_ro_enemy_hp_all", "enemy HP list", null);
  _mkSensor("he_ro_enemy_dist2_all", "enemy distance^2 list", null);
  _mkSensor("he_ro_enemy_dist_all", "enemy distance list", null);
  _mkSensor("he_ro_ally_hp_all", "ally HP list", null);
  _mkSensor("he_ro_ally_level_all", "ally level list", null);
  _mkSensor("he_ro_my_level", "my level", "Number");
  _mkSensor("he_ro_my_relics", "my relic ids", null);
  _mkSensor("he_ro_my_weapons", "my weapon ids", null);
  _mkSensor("he_ro_my_weapon_bonuses", "my weapon bonuses", null);
  _mkSensor("he_ro_enemies_list", "enemies (list)", null);
  _mkSensor("he_ro_heroes_list", "heroes (list)", null);
  _mkSensor("he_ro_my_level", "my level", "Number");
  _mkSensor("he_ro_enemy_hp_all", "enemy HP list", null);
  _mkSensor("he_ro_enemy_dist2_all", "enemy distance^2 list", null);
  _mkSensor("he_ro_enemy_dist_all", "enemy distance list", null);
  _mkSensor("he_ro_ally_hp_all", "ally HP list", null);
  _mkSensor("he_ro_ally_level_all", "ally level list", null);
  _mkSensor("he_ro_my_relics", "my relic ids", null);
  _mkSensor("he_ro_my_weapons", "my weapon ids", null);
  _mkSensor("he_ro_my_weapon_bonuses", "my weapon bonuses", null);

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

  // Back-compat: clamp block (kept for existing XML even if not shown in toolbox)
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
  __heValOut("family", ${family}, "strength"),
  __heNumOut("damage", ${damage}),
  __heNumOut("reach", ${reach}),
  __heNumOut("time", ${time}),
  __heStatusOut(${status}, status2),
  __heValOut("element", ${element}, "none"),
  __heIdOut(__heForcedId, ${id})
];
`;
  };
  // Main entry: generates the actual function the engine calls.
  const _emitRouter = () => `
function chooseMyMove(button) {
  if (button === "A" && typeof chooseMoveA === "function") return chooseMoveA(button);
  if (button === "B" && typeof chooseMoveB === "function") return chooseMoveB(button);
  if (button === "A+B" && typeof chooseMoveAB === "function") return chooseMoveAB(button);
  return null;
}
function heroLogic(button){ return chooseMyMove(button); }
`;

  const _emitDefaults = (forcedId: string) => `
  __heResetDefaultsUsed();
  family = undefined;
  damage = undefined;
  reach = undefined;
  time = undefined;
  status = undefined;
  status2 = undefined;
  element = undefined;
  id = ${JSON.stringify(forcedId)};
`;

const _mkEntryGen = (type: string, fnName: string, forcedId: string) => {
    G.forBlock[type] = function (block: any, generator: any) {
      const body = generator.statementToCode(block, "DO");
      const fallbackReturn = `
  return [
    __heValOut("family", family, "strength"),
    __heNumOut("damage", damage),
    __heNumOut("reach", reach),
    __heNumOut("time", time),
    __heStatusOut(status, status2),
    __heValOut("element", element, "none"),
    __heIdOut(__heForcedId, id)
  ];
`;
      return `function ${fnName}(button) {
  const __heForcedId = ${JSON.stringify(forcedId)};
${_emitDefaults(forcedId)}
${body || ""}
${fallbackReturn}}
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

  G.forBlock["he_set_outputs_bundle"] = function (block: any, generator: any) {
    const fam = block.getFieldValue("FAM") || "strength";
    const dmg = generator.valueToCode(block, "DAMAGE", generator.ORDER_NONE) || "0";
    const reach = generator.valueToCode(block, "REACH", generator.ORDER_NONE) || "0";
    const time = generator.valueToCode(block, "TIME", generator.ORDER_NONE) || "0";
    const status = generator.valueToCode(block, "STATUS", generator.ORDER_NONE) || "0";
    const el = block.getFieldValue("EL") || "none";
    const id = block.getFieldValue("ID") || "A";
    return `family = ${JSON.stringify(fam)};
damage = ${dmg};
reach = ${reach};
time = ${time};
status = ${status};
status2 = ${status};
element = ${JSON.stringify(el)};
id = ${JSON.stringify(id)};
`;
  };

  const _mkNumSetterGen = (type: string, varName: string) => {
    G.forBlock[type] = function (block: any, generator: any) {
      const v = generator.valueToCode(block, "VALUE", generator.ORDER_NONE) || "0";
      if (varName === "status") {
        return `status = ${v};
status2 = ${v};
`;
      }
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
  _sensor("he_ro_my_level", "__heRO_myLevel()");
  _sensor("he_ro_enemy_count", "__heRO_enemyCount()");
  _sensor("he_ro_enemies_list", "__heEnemies()");
  _sensor("he_ro_heroes_list", "__heHeroes()");

  G.forBlock["he_ro_enemies_within_radius"] = function (block: any, generator: any) {
    const r = generator.valueToCode(block, "R", generator.ORDER_NONE) || "0";
    return [`__heRO_enemiesWithinRadius(${r})`, G.ORDER_FUNCTION_CALL];
  };

  G.forBlock["he_ro_enemy_field"] = function (block: any, generator: any) {
    const i = generator.valueToCode(block, "I", generator.ORDER_NONE) || "0";
    const field = block.getFieldValue("FIELD") || "hp";
    return [`__heEnemyField(${i}, ${JSON.stringify(field)})`, G.ORDER_FUNCTION_CALL];
  };
  G.forBlock["he_ro_hero_field"] = function (block: any, generator: any) {
    const i = generator.valueToCode(block, "I", generator.ORDER_NONE) || "0";
    const field = block.getFieldValue("FIELD") || "hp";
    return [`__heHeroField(${i}, ${JSON.stringify(field)})`, G.ORDER_FUNCTION_CALL];
  };
  G.forBlock["he_ro_my_field"] = function (block: any) {
    const field = block.getFieldValue("FIELD") || "hp";
    return [`__heMyField(${JSON.stringify(field)})`, G.ORDER_FUNCTION_CALL];
  };
  G.forBlock["he_ro_my_ids"] = function (block: any) {
    const kind = block.getFieldValue("KIND") || "relics";
    return [`__heMyIds(${JSON.stringify(kind)})`, G.ORDER_FUNCTION_CALL];
  };
  G.forBlock["he_ro_closest_enemy_field"] = function (block: any) {
    const field = block.getFieldValue("FIELD") || "hp";
    return [`__heClosestEnemyField(${JSON.stringify(field)})`, G.ORDER_FUNCTION_CALL];
  };
  G.forBlock["he_ro_reach_px"] = function (block: any, generator: any) {
    const fam = block.getFieldValue("FAM") || "strength";
    const reach = generator.valueToCode(block, "REACH", generator.ORDER_NONE) || "0";
    return [`__heReachPx(${JSON.stringify(fam)}, ${reach})`, G.ORDER_FUNCTION_CALL];
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
  lastRawByButton: Record<string, any>;
  lastErrByButton: Record<string, string | null>;
  lastXml: string;
  lastCode: string | null;
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
  return STORAGE_PREFIX + encodeURIComponent(profile || FALLBACK_PROFILE);
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

function _fixConstWithoutInit(src: string): string {
  return src.replace(/const\s+([^;]+);/g, (full, decls) => {
    const parts = decls.split(",").map((raw: string) => {
      const t = raw.trim();
      if (!t) return t;
      if (t.includes("=")) return t;
      // For any declarator with no initializer, default to undefined.
      return `${t} = undefined`;
    });
    const fixed = parts.join(", ");
    if (fixed !== decls.trim()) {
      console.warn("[BlocklyHeroLogic] fixed const without initializer", { before: full, after: `let ${fixed};` });
    }
    return `let ${fixed};`;
  });
}


function _compileFromXml(xmlText: string): { ok: true; fn: (button: string) => any; code: string } | { ok: false; err: string } {
  try {
    _ensureHeBlocksRegistered();

    const ws = new (Blockly as any).Workspace();
    const dom =
      (Blockly as any).utils?.xml?.textToDom?.(xmlText) ||
      (Blockly as any).Xml?.textToDom?.(xmlText);
    if (!dom) return { ok: false, err: "no xml parser available" };

    (Blockly as any).Xml.domToWorkspace(dom, ws);

    // Drop only stray top-level Return blocks; keep helper/procedure blocks intact.
    const tops: any[] = ws.getTopBlocks(false) || [];
    for (const b of tops) {
      if (b.type === "he_return_move") {
        try { b.dispose(false, true); } catch { }
      }
    }

    // Ensure each entry block has a terminal return so headless compiles don't produce null.
    const ensureReturn = (main: any) => {
      if (!main || typeof main.getInput !== "function") return;
      const stackInput = main.getInput("DO");
      const stackConn = stackInput && stackInput.connection;
      if (!stackConn) return;
      const getTail = (b: any) => {
        let cur = b, tail = b;
        while (cur) {
          tail = cur;
          cur = cur.getNextBlock?.();
        }
        return tail || null;
      };
      const findReturn = (b: any) => {
        let cur = b;
        while (cur) {
          if (cur.type === "he_return_move") return cur;
          cur = cur.getNextBlock?.();
        }
        return null;
      };
      const head = (typeof main.getInputTargetBlock === "function") ? main.getInputTargetBlock("DO") : null;
      let ret = findReturn(head);
      if (!ret) {
        ret = ws.newBlock("he_return_move");
        ret.initSvg?.();
        ret.render?.();
      }
      const tail = getTail((typeof main.getInputTargetBlock === "function") ? main.getInputTargetBlock("DO") : null);
      if (!tail) {
        try { stackConn.connect(ret.previousConnection); } catch { }
      } else if (tail !== ret) {
        try { ret.previousConnection?.disconnect(); } catch { }
        try { tail.nextConnection?.connect(ret.previousConnection); } catch { }
      }
    };
    const entryTypes = ["he_on_button_a", "he_on_button_b", "he_on_button_ab", "he_choose_move"];
    const allBlocks: any[] = ws.getAllBlocks(false) || [];
    for (const b of allBlocks) {
      if (entryTypes.indexOf(b.type) >= 0) ensureReturn(b);
    }

    // Generate JS from blocks
    const codeRaw = javascriptGenerator.workspaceToCode(ws);
    const code = _fixConstWithoutInit(codeRaw);

    // Helpers are available inside heroLogic().
    const helpers = `
      const __heDefaultsUsed = { family: false, damage: false, reach: false, time: false, status: false, element: false, id: false };
      function __heResetDefaultsUsed() {
        try {
          for (const k in __heDefaultsUsed) {
            if (Object.prototype.hasOwnProperty.call(__heDefaultsUsed, k)) {
              __heDefaultsUsed[k] = false;
            }
          }
          if (typeof globalThis !== "undefined") {
            globalThis.__heLastDefaultsUsed = __heDefaultsUsed;
          }
        } catch {}
      }
      function __heValOut(name, v, def) {
        if (v == null) { __heDefaultsUsed[name] = true; return undefined; }
        return v;
      }
      function __heVal(v, def) { return (v == null) ? def : v; }
      function __heNumOut(name, v) {
        const n = Number(v);
        if (typeof n === "number" && isFinite(n)) return n;
        __heDefaultsUsed[name] = true;
        return undefined;
      }
      function __heNum(v) { const n = Number(v); return (typeof n === "number" && isFinite(n)) ? n : 0; }
      function __heIdOut(forcedId, v) {
        if (typeof forcedId !== "undefined") return forcedId;
        if (v == null) { __heDefaultsUsed.id = true; return undefined; }
        return v;
      }
      function __heStatusOut(v1, v2) {
        // Prefer explicit status, then Blockly-renamed status2
        const cands = [v1, v2];
        for (const c of cands) {
          const n = Number(c);
          if (typeof n === "number" && isFinite(n)) return n;
        }
        __heDefaultsUsed.status = true;
        return undefined;
      }
      function __heRO() {
        const hasGT = (typeof globalThis !== "undefined");
        const ro = (hasGT && globalThis.__heBlocklyRO) ? globalThis.__heBlocklyRO : null;
        return ro || {
          heroIndex: 0,
          meHp: 0, meMp: 0, meX: 0, meY: 0, meLvl: 1,
          enemyCount: 0, enemyHp: [], enemyDistSq: [], enemies: [],
          heroCount: 0, heroHp: [], heroX: [], heroY: [], heroLvl: [], heroes: [],
          relicIds: [], weaponIds: [], weaponBonuses: [],
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
      function __heRO_enemyHpAll() {
        const ro = __heRO();
        const a = (ro.enemyHp && ro.enemyHp.length) ? ro.enemyHp : [];
        return a.slice(0);
      }
      function __heRO_enemyDistSqAt(i) {
        const ro = __heRO();
        const a = (ro.enemyDistSq && ro.enemyDistSq.length) ? ro.enemyDistSq : [];
        const idx = (i|0);
        if (idx < 0 || idx >= a.length) return 0;
        const v = a[idx];
        return (typeof v === "number") ? (+v) : 0;
      }
      function __heRO_enemyDistSqAll() {
        const ro = __heRO();
        const a = (ro.enemyDistSq && ro.enemyDistSq.length) ? ro.enemyDistSq : [];
        return a.slice(0);
      }
      function __heRO_enemyDistAt(i) {
        const ds = __heRO_enemyDistSqAt(i);
        return Math.sqrt(Math.max(0, ds));
      }
      function __heRO_enemyDistAll() {
        const ro = __heRO();
        const a = (ro.enemyDistSq && ro.enemyDistSq.length) ? ro.enemyDistSq : [];
        return a.map(v => Math.sqrt(Math.max(0, Number(v) || 0)));
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
      function __heRO_allyHpAll() {
        const ro = __heRO();
        const a = (ro.heroHp && ro.heroHp.length) ? ro.heroHp : [];
        return a.slice(0);
      }
      function __heRO_allyLevelAll() {
        const ro = __heRO();
        const a = (ro.heroLvl && ro.heroLvl.length) ? ro.heroLvl : [];
        return a.slice(0);
      }
      function __heRO_myLevel() {
        const ro = __heRO();
        return (ro.meLvl | 0) || 0;
      }
      function __heRO_myRelics() {
        const ro = __heRO();
        const a = (ro.relicIds && ro.relicIds.length) ? ro.relicIds : [];
        return a.slice(0);
      }
      function __heRO_myWeapons() {
        const ro = __heRO();
        const a = (ro.weaponIds && ro.weaponIds.length) ? ro.weaponIds : [];
        return a.slice(0);
      }
      function __heRO_myWeaponBonuses() {
        const ro = __heRO();
        const a = (ro.weaponBonuses && ro.weaponBonuses.length) ? ro.weaponBonuses : [];
        return a.slice(0);
      }
      function __heEnemies() {
        const ro = __heRO();
        const a = Array.isArray(ro.enemies) ? ro.enemies : [];
        return a.slice(0);
      }
      function __heHeroes() {
        const ro = __heRO();
        const a = Array.isArray(ro.heroes) ? ro.heroes : [];
        return a.slice(0);
      }
      function __heEnemyField(i, field) {
        const arr = __heEnemies();
        const obj = arr[i|0];
        if (!obj) return 0;
        switch (field) {
          case "hp": return obj.hp | 0;
          case "maxHp": return obj.maxHp | 0;
          case "mana": return obj.mana | 0;
          case "maxMana": return obj.maxMana | 0;
          case "x": return obj.x | 0;
          case "y": return obj.y | 0;
          case "vx": return +obj.vx || 0;
          case "vy": return +obj.vy || 0;
          case "dmg": return obj.dmg | 0;
          case "distSq": return obj.distSq | 0;
          default: return 0;
        }
      }
      function __heHeroField(i, field) {
        const arr = __heHeroes();
        const obj = arr[i|0];
        if (!obj) return 0;
        switch (field) {
          case "hp": return obj.hp | 0;
          case "maxHp": return obj.maxHp | 0;
          case "mana": return obj.mana | 0;
          case "maxMana": return obj.maxMana | 0;
          case "lvl": return obj.lvl | 0;
          case "x": return obj.x | 0;
          case "y": return obj.y | 0;
          case "vx": return +obj.vx || 0;
          case "vy": return +obj.vy || 0;
          case "dmg": return obj.dmg | 0;
          default: return 0;
        }
      }
      function __heMyField(field) {
        const ro = __heRO();
        const idx = (ro.heroIndex | 0) || 0;
        return __heHeroField(idx, field);
      }
      function __heMyIds(kind) {
        const ro = __heRO();
        if (kind === "relics") return __heRO_myRelics();
        if (kind === "weapons") return __heRO_myWeapons();
        return [];
      }
      function __heClosestEnemyField(field) {
        const idx = __heRO_closestEnemyIndex();
        if (idx < 0) return 0;
        return __heEnemyField(idx, field);
      }
      function __heReachPx(family, reachVal) {
        const famStr = ("" + family).toLowerCase();
        const famNum = Number(family);
        const famName = (() => {
          if (famStr === "strength" || famNum === 0) return "strength";
          if (famStr === "agility" || famNum === 1) return "agility";
          if (famStr === "intelligence" || famStr === "intellect" || famNum === 2) return "intelligence";
          if (famStr === "wisdom" || famStr === "support" || famNum === 3) return "wisdom";
          return "strength";
        })();
        const BAL: any = (typeof globalThis !== "undefined" && (globalThis as any).BALANCE) ? (globalThis as any).BALANCE : null;
        const mv = BAL && BAL.MOVES ? BAL.MOVES : null;
        const rv = Number(reachVal) || 0;
        if (famName === "strength" && mv && mv.STRENGTH) {
          const base = Number(mv.STRENGTH.REACH_BASE_PX) || 0;
          const per = Number(mv.STRENGTH.REACH_PER_POINT_PX) || 0;
          return base + rv * per;
        }
        if (famName === "agility" && mv && mv.AGILITY) {
          const base = Number(mv.AGILITY.REACH_BASE_PX) || 0;
          const per = Number(mv.AGILITY.REACH_PER_POINT_PX) || 0;
          return base + rv * per;
        }
        if (famName === "intelligence" && mv && mv.INTELLECT) {
          const base = Number(mv.INTELLECT.REACH_BASE_PX) || 0;
          const per = Number(mv.INTELLECT.REACH_PER_POINT_PX) || 0;
          return base + rv * per;
        }
        if (famName === "wisdom" && mv && mv.SUPPORT) {
          const base = Number(mv.SUPPORT.REACH_BASE_PX) || 0;
          const per = Number(mv.SUPPORT.REACH_PER_POINT_PX) || 0;
          return base + rv * per;
        }
        return rv;
      }
      function __heMyIds(kind) {
        const ro = __heRO();
        if (kind === "relics") return __heRO_myRelics();
        if (kind === "weapons") return __heRO_myWeapons();
        return [];
      }
      function __heClosestEnemyField(field) {
        const idx = __heRO_closestEnemyIndex();
        if (idx < 0) return 0;
        return __heEnemyField(idx, field);
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
    
// Declare output vars (Blockly may rename "status" to "status2"). No defaults so missing fields can be detected.
var family;
var damage;
var reach;
var time;
var status;
var status2;
var element;
var id;
// Normalize status/status2 aliases if one is defined.
if (typeof status === "undefined" && typeof status2 !== "undefined") { status = status2; }
if (typeof status2 === "undefined" && typeof status !== "undefined") { status2 = status; }
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
    // If no entry blocks were present, fall back to a harmless no-op so we don't spam errors.
    const safeFn = (typeof fn === "function") ? fn : (() => null);
    return { ok: true, fn: safeFn, code };
  } catch (e: any) {
    try {
      console.error("[BlocklyHeroLogic] compile debug", {
        err: String(e?.message || e),
        codePreview: (typeof code === "string") ? code.slice(0, 1000) : "",
      });
    } catch {}
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
  const effectiveProfile = profile && profile.trim() ? profile.trim() : FALLBACK_PROFILE;

  let xmlProfile = effectiveProfile;
  let xml = _getSavedXml(effectiveProfile);
  if (!xml && effectiveProfile !== FALLBACK_PROFILE) {
    const fallbackXml = _getSavedXml(FALLBACK_PROFILE);
    if (fallbackXml) {
      xml = fallbackXml;
      xmlProfile = FALLBACK_PROFILE;
    }
  }
  if (!xml) return null;

  const cached = _cache.get(effectiveProfile);
  if (!cached || cached.xml !== xml) {
    const { fn, err, code } = _compileFromXml(xml);
    _cache.set(effectiveProfile, {
      profile: xmlProfile,
      xml,
      lastXml: xml,
      lastCode: code || null,
      fn,
      lastErr: err,
      lastRaw: null,
      lastDefaultsUsed: null,
      lastDefaultsUsedByButton: {},
      lastRawByButton: {},
      lastErrByButton: {},
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
    entry.lastRawByButton[button] = rawOut;

    let defaultsUsed: any = null;
    try {
      const g: any = (typeof globalThis !== "undefined") ? (globalThis as any) : null;
      const du = g && g.__heLastDefaultsUsed;
      if (du && typeof du === "object") defaultsUsed = { ...du };
    } catch {}

    const ok = _validateOut(rawOut);
    const usedDefaults = !!(defaultsUsed && Object.values(defaultsUsed).some(Boolean));
    if (!ok || usedDefaults) {
      const errMsg = !ok ? "invalid-out" : "default-out";
      entry.lastErr = errMsg;
      entry.lastErrByButton[button] = errMsg;
      if (defaultsUsed) {
        entry.lastDefaultsUsed = defaultsUsed;
        entry.lastDefaultsUsedByButton[button] = defaultsUsed;
      }
      try {
        console.warn(`[BlocklyHeroLogic] raw (${errMsg}) profile=${effectiveProfile} button=${button} out=`, rawOut, "defaultsUsed=", defaultsUsed);
        if (entry.lastCode) {
          console.warn(`[BlocklyHeroLogic] code profile=${effectiveProfile} code=`, entry.lastCode);
        }
      } catch {}
      return null;
    }

    entry.lastDefaultsUsed = defaultsUsed;
    entry.lastDefaultsUsedByButton[button] = defaultsUsed;
    entry.lastErr = null;
    entry.lastErrByButton[button] = null;
    return ok;
  } catch (e: any) {
    const msg = String(e?.message || e);
    entry.lastErr = msg;
    entry.lastErrByButton[button] = msg;
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
    lastRaw: entry ? entry.lastRaw : undefined,
    lastRawType: entry ? (typeof entry.lastRaw) : "undefined",
    lastRawJson: (() => {
      try { return JSON.stringify(entry ? entry.lastRaw : undefined); } catch { return "<unserializable>"; }
    })(),
    lastDefaultsUsed: entry?.lastDefaultsUsed || null,
    lastDefaultsUsedByButton: entry?.lastDefaultsUsedByButton || {},
    lastRawByButton: entry?.lastRawByButton || {},
    lastErrByButton: entry?.lastErrByButton || {},
    lastXml: entry?.lastXml || null,
    lastCode: entry?.lastCode || null,
    codePreview: entry?.lastCode ? entry.lastCode.slice(0, 800) : null,
    xmlPreview: xml ? xml.slice(0, 800) : null,
  };
}

(globalThis as any).__heBlocklyHeroLogicDebug = dbgBlocklyHeroLogic;
