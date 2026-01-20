import type { ApCspType, TrapOutputContract, TrapSpec, ValueKind } from "./trapSchema";

export const DISASSEMBLED_NUMBER_TRAP_ID = "trap.disassembled.number.v1";
export const DISASSEMBLED_STRING_TRAP_ID = "trap.disassembled.string.v1";
export const DISASSEMBLED_BOOLEAN_TRAP_ID = "trap.disassembled.boolean.v1";
export const DISASSEMBLED_CHARACTER_TRAP_ID = "trap.disassembled.character.v1";
export const DISASSEMBLED_LIST_TRAP_ID = "trap.disassembled.list.v1";
export const BROKEN_NUMBER_TRAP_ID = "trap.broken.number.v1";
export const UNTARGETED_NUMBER_TRAP_ID = "trap.untargeted.number.v1";
export const UNTARGETED_STRING_TRAP_ID = "trap.untargeted.string.v1";
export const UNTARGETED_LIST_TRAP_ID = "trap.untargeted.list.v1";
export const SHRINE_TRAP_ID = "trap.shrine.blessing.v1";

function makeDisassembledTrapSpec(args: {
  id: string;
  title: string;
  outputLabel: string;
  instructions: string;
  output: TrapOutputContract;
  previewValue: unknown;
  effectId: string;
  outputMapping: string;
  valueKinds?: ValueKind[];
  palette?: TrapSpec["palette"];
  starterBlocks?: TrapSpec["starterBlocks"];
  expectedOutputFromInputs?: (inputs: Record<string, unknown>) => unknown;
}): TrapSpec {
  const type = args.output.type as ApCspType;
  const valueKinds = args.valueKinds ?? ["procedure", "order", "target"];
  const palette = args.palette ?? {
    categories: ["Functions", "Variables"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
    ],
  };
  const starterBlocks = args.starterBlocks ?? {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="variables_set" x="20" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="variables_get">
              <field name="VAR">givenValue</field>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="220">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
  const expectedOutputFromInputs = args.expectedOutputFromInputs
    ?? ((inputs: Record<string, unknown>) => inputs.givenValue);
  return {
    id: args.id,
    version: 1,
    kind: "Disassembled",
    seed: 0,

    inputs: [
      { name: "givenValue", type, description: "Given value" },
    ],
    output: args.output,
    valueKindsUsed: valueKinds,
    palette,

    givenInputs: ["givenValue"],
    requiredInputs: ["givenValue"],

    validator: {
      requireAllGivenInputsUsed: true,
      requiredInputs: ["givenValue"],
      outputContract: args.output,
      expectedOutputFromInputs,
    },
    runtimeBinding: {
      effectId: args.effectId,
      outputMapping: args.outputMapping,
    },

    starterBlocks,
    blockBudget: { maxBlocks: 3, maxDepth: 2 },

    preview: { inputs: { givenValue: args.previewValue } },
    ui: {
      title: args.title,
      instructions: args.instructions,
      outputLabel: args.outputLabel,
    },
  };
}

function _coerceNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const n = Number(value[i]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function _coerceStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (typeof v === "string") out.push(v);
  }
  return out;
}

function _minIndex(values: number[]): number {
  if (!values.length) return 0;
  let idx = 0;
  let best = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < best) {
      best = v;
      idx = i;
    }
  }
  return idx;
}

const UNTARGETED_PREVIEW_INPUTS = {
  enemyNames: ["goblin", "orc", "slime"],
  enemyDist: [2, 5, 1],
  enemyDistSq: [4, 25, 1],
  enemyHp: [9, 6, 12],
  enemyMaxHp: [12, 10, 15],
  enemyMana: [4, 2, 6],
  enemyMaxMana: [6, 5, 9],
  enemyX: [3, 8, 1],
  enemyY: [4, 7, 2],
  enemyVx: [0, 1, -1],
  enemyVy: [1, 0, 0],
  enemyDamage: [2, 3, 1],
};

function makeUntargetedTrapSpec(args: {
  id: string;
  title: string;
  outputLabel: string;
  instructions: string;
  output: TrapOutputContract;
  effectId: string;
  outputMapping: string;
  valueKinds?: ValueKind[];
  palette?: TrapSpec["palette"];
  starterBlocks?: TrapSpec["starterBlocks"];
  expectedOutputFromInputs?: (inputs: Record<string, unknown>) => unknown;
}): TrapSpec {
  const type = args.output.type as ApCspType;
  const valueKinds = args.valueKinds ?? ["target", "list", "logic", "compare", "math"];
  const palette = args.palette ?? {
    categories: ["Functions", "Variables", "Lists", "Operators", "Logic", "Loops", "Sensing"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
      "math_number",
      "math_arithmetic",
      "math_on_list",
      "logic_compare",
      "logic_operation",
      "logic_boolean",
      "logic_negate",
      "he_trap_enemy_list",
      "he_trap_enemy_indices",
      "he_trap_enemy_field_at",
      "lists_create_with",
      "lists_getIndex",
      "lists_indexOf",
      "lists_length",
      "controls_for",
      "controls_forEach",
      "controls_if",
    ],
  };
  const starterBlocks = args.starterBlocks ?? {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <comment pinned="true" h="160" w="360" x="10" y="10">Goal: pick the correct target from the given lists, then return the result.</comment>
        <block type="procedures_defreturn" x="20" y="220">
          <field name="NAME">trapMain</field>
          <value name="RETURN">
            <block type="variables_get">
              <field name="VAR">target</field>
            </block>
          </value>
        </block>
      </xml>
    `,
  };
  const expectedOutputFromInputs = args.expectedOutputFromInputs ?? ((inputs: Record<string, unknown>) => {
    const distances = _coerceNumberList(inputs.enemyDist);
    const names = _coerceStringList(inputs.enemyNames);
    const idx = _minIndex(distances);
    if (type === "Number") return (idx + 1) | 0;
    const name = names[idx] || "";
    if (type === "String") return name;
    if (type === "List") return [name];
    return (idx + 1) | 0;
  });
  return {
    id: args.id,
    version: 1,
    kind: "Untargeted",
    seed: 0,

    inputs: [
      { name: "enemyNames", type: "List", description: "Enemy names" },
      { name: "enemyDist", type: "List", description: "Enemy distances" },
      { name: "enemyDistSq", type: "List", description: "Enemy distance-squared values" },
      { name: "enemyHp", type: "List", description: "Enemy health values" },
      { name: "enemyMaxHp", type: "List", description: "Enemy max health values" },
      { name: "enemyMana", type: "List", description: "Enemy mana values" },
      { name: "enemyMaxMana", type: "List", description: "Enemy max mana values" },
      { name: "enemyX", type: "List", description: "Enemy X positions" },
      { name: "enemyY", type: "List", description: "Enemy Y positions" },
      { name: "enemyVx", type: "List", description: "Enemy X velocity values" },
      { name: "enemyVy", type: "List", description: "Enemy Y velocity values" },
      { name: "enemyDamage", type: "List", description: "Enemy damage values" },
    ],
    output: args.output,
    valueKindsUsed: valueKinds,
    palette,

    givenInputs: [
      "enemyNames",
      "enemyDist",
      "enemyDistSq",
      "enemyHp",
      "enemyMaxHp",
      "enemyMana",
      "enemyMaxMana",
      "enemyX",
      "enemyY",
      "enemyVx",
      "enemyVy",
      "enemyDamage",
    ],
    requiredInputs: [],

    validator: {
      requireAllGivenInputsUsed: false,
      outputContract: args.output,
      expectedOutputFromInputs,
    },
    runtimeBinding: {
      effectId: args.effectId,
      outputMapping: args.outputMapping,
    },

    starterBlocks,
    blockBudget: { maxBlocks: 20, maxDepth: 8 },

    preview: { inputs: { ...UNTARGETED_PREVIEW_INPUTS } },
    ui: {
      title: args.title,
      instructions: args.instructions,
      outputLabel: args.outputLabel,
    },
  };
}

export const DISASSEMBLED_NUMBER_TRAP_SPEC: TrapSpec = makeDisassembledTrapSpec({
  id: DISASSEMBLED_NUMBER_TRAP_ID,
  title: "Disassembled Trap (Number)",
  outputLabel: "Return a Number",
  instructions: "Assemble the blocks so the procedure returns the computed number.",
  output: {
    type: "Number",
    number: { integerOnly: true },
  },
  previewValue: 2,
  effectId: "trap.disassembled.number",
  outputMapping: "Number -> targetIndex",
  valueKinds: ["procedure", "order", "target", "math"],
  palette: {
    categories: ["Functions", "Variables", "Operators"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
      "math_arithmetic",
      "math_number",
    ],
  },
});

export const DISASSEMBLED_CHARACTER_TRAP_SPEC: TrapSpec = makeDisassembledTrapSpec({
  id: DISASSEMBLED_CHARACTER_TRAP_ID,
  title: "Disassembled Trap (Character)",
  outputLabel: "Return a Character",
  instructions: "Assemble the blocks so the procedure returns the given character.",
  output: {
    type: "Character",
    character: {},
  },
  previewValue: "A",
  effectId: "trap.disassembled.character",
  outputMapping: "Character -> targetChar",
});

export const DISASSEMBLED_STRING_TRAP_SPEC: TrapSpec = makeDisassembledTrapSpec({
  id: DISASSEMBLED_STRING_TRAP_ID,
  title: "Disassembled Trap (String)",
  outputLabel: "Return a String",
  instructions: "Assemble the blocks so the procedure returns the given string.",
  output: {
    type: "String",
    string: {},
  },
  previewValue: "flame",
  effectId: "trap.disassembled.string",
  outputMapping: "String -> targetText",
});

export const DISASSEMBLED_BOOLEAN_TRAP_SPEC: TrapSpec = makeDisassembledTrapSpec({
  id: DISASSEMBLED_BOOLEAN_TRAP_ID,
  title: "Disassembled Trap (Boolean)",
  outputLabel: "Return a Boolean",
  instructions: "Assemble the blocks so the procedure returns the given Boolean.",
  output: {
    type: "Boolean",
    boolean: {},
  },
  previewValue: true,
  effectId: "trap.disassembled.boolean",
  outputMapping: "Boolean -> targetFlag",
});

export const DISASSEMBLED_LIST_TRAP_SPEC: TrapSpec = makeDisassembledTrapSpec({
  id: DISASSEMBLED_LIST_TRAP_ID,
  title: "Disassembled Trap (List)",
  outputLabel: "Return a List",
  instructions: "Assemble the blocks so the procedure returns the given list.",
  output: {
    type: "List",
    list: {},
  },
  previewValue: [1, 2, 3],
  effectId: "trap.disassembled.list",
  outputMapping: "List -> targetList",
  valueKinds: ["procedure", "order", "target", "list"],
});

export const BROKEN_NUMBER_TRAP_SPEC: TrapSpec = {
  id: BROKEN_NUMBER_TRAP_ID,
  version: 1,
  kind: "Broken",
  seed: 0,

  inputs: [
    { name: "givenValue", type: "Number", description: "Given value" },
    { name: "addValue", type: "Number", description: "Value to add" },
    { name: "multValue", type: "Number", description: "Value to multiply" },
    { name: "repeatCount", type: "Number", description: "Repeat count" },
  ],
  output: {
    type: "Number",
    number: { integerOnly: true },
  },
  valueKindsUsed: ["procedure", "order", "math", "loop", "logic", "compare"],
  palette: {
    categories: ["Functions", "Variables", "Operators", "Loops", "Logic"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
      "math_arithmetic",
      "math_number",
      "controls_repeat_ext",
      "controls_if",
      "logic_compare",
    ],
  },

  givenInputs: ["givenValue", "addValue", "multValue", "repeatCount"],
  requiredInputs: ["givenValue", "addValue", "multValue", "repeatCount"],

  validator: {
    requireAllGivenInputsUsed: true,
    requiredInputs: ["givenValue", "addValue", "multValue", "repeatCount"],
    outputContract: {
      type: "Number",
      number: { integerOnly: true },
    },
    expectedOutputFromInputs: (inputs: Record<string, unknown>) => {
      const givenValue = Number(inputs.givenValue);
      const addValue = Number(inputs.addValue);
      const multValue = Number(inputs.multValue);
      const repeatCount = Number(inputs.repeatCount);
      return givenValue + (addValue * multValue * repeatCount);
    },
  },
  runtimeBinding: {
    effectId: "trap.broken.number",
    outputMapping: "Number -> targetIndex",
  },

  starterBlocks: {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
          <statement name="STACK">
            <block type="variables_set">
              <field name="VAR">target</field>
              <value name="VALUE">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
              <next>
                <block type="controls_repeat_ext">
                  <value name="TIMES">
                    <block type="variables_get">
                      <field name="VAR">repeatCount</field>
                    </block>
                  </value>
                  <statement name="DO">
                    <block type="variables_set">
                      <field name="VAR">target</field>
                      <value name="VALUE">
                        <block type="math_arithmetic">
                          <field name="OP">MULTIPLY</field>
                          <value name="A">
                            <block type="math_arithmetic">
                              <field name="OP">ADD</field>
                              <value name="A">
                                <block type="variables_get">
                                  <field name="VAR">target</field>
                                </block>
                              </value>
                              <value name="B">
                                <block type="variables_get">
                                  <field name="VAR">addValue</field>
                                </block>
                              </value>
                            </block>
                          </value>
                          <value name="B">
                            <block type="variables_get">
                              <field name="VAR">multValue</field>
                            </block>
                          </value>
                        </block>
                      </value>
                    </block>
                  </statement>
                </block>
              </next>
            </block>
          </statement>
          <value name="RETURN">
            <block type="variables_get">
              <field name="VAR">target</field>
            </block>
          </value>
        </block>
      </xml>
    `,
  },
  blockBudget: { maxBlocks: 12, maxDepth: 6 },

  preview: { inputs: { givenValue: 3, addValue: 2, multValue: 4, repeatCount: 2 } },
  ui: {
    title: "Broken Trap (Number)",
    instructions: "The blocks are assembled but incorrect. Fix the logic so the procedure returns the correct number.",
    outputLabel: "Return a Number",
  },
};

export const UNTARGETED_NUMBER_TRAP_SPEC: TrapSpec = makeUntargetedTrapSpec({
  id: UNTARGETED_NUMBER_TRAP_ID,
  title: "Untargeted Trap (Index)",
  outputLabel: "Return a Number",
  instructions: "Select the correct enemy target and return its index.",
  output: {
    type: "Number",
    number: { integerOnly: true },
  },
  effectId: "trap.untargeted.number",
  outputMapping: "Number -> targetIndex",
});

export const UNTARGETED_STRING_TRAP_SPEC: TrapSpec = makeUntargetedTrapSpec({
  id: UNTARGETED_STRING_TRAP_ID,
  title: "Untargeted Trap (Name)",
  outputLabel: "Return a String",
  instructions: "Select the correct enemy target and return its name.",
  output: {
    type: "String",
    string: {},
  },
  effectId: "trap.untargeted.string",
  outputMapping: "String -> targetName",
});

export const UNTARGETED_LIST_TRAP_SPEC: TrapSpec = makeUntargetedTrapSpec({
  id: UNTARGETED_LIST_TRAP_ID,
  title: "Untargeted Trap (List)",
  outputLabel: "Return a List",
  instructions: "Select the correct enemy target and return a list containing its name.",
  output: {
    type: "List",
    list: { elementType: "String", length: 1 },
  },
  effectId: "trap.untargeted.list",
  outputMapping: "List -> targetNames",
  valueKinds: ["target", "list", "logic", "compare", "math"],
});

export const SHRINE_TRAP_SPEC: TrapSpec = {
  id: SHRINE_TRAP_ID,
  version: 1,
  kind: "Dormant",
  seed: 0,

  inputs: [],
  output: {
    type: "Boolean",
    boolean: {},
  },
  valueKindsUsed: ["list", "math", "logic"],
  palette: {
    categories: ["Variables", "Lists", "Math", "Text", "Logic"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
      "lists_create_with",
      "math_number",
      "text",
      "logic_boolean",
      "logic_compare",
      "logic_operation",
      "controls_if",
      "controls_whileUntil",
    ],
  },

  givenInputs: [],
  requiredInputs: [],

  validator: {
    requireAllGivenInputsUsed: false,
    requiredInputs: [],
    outputContract: { type: "Boolean", boolean: {} },
    expectedOutput: true,
  },
  runtimeBinding: {
    effectId: "trap.shrine.blessing",
    outputMapping: "Boolean -> blessing",
  },

  starterBlocks: {
    readOnly: true,
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">When floor begins</field>
          <statement name="STACK">
            <block type="controls_whileUntil">
              <field name="MODE">UNTIL</field>
              <value name="BOOL">
                <block type="logic_operation">
                  <field name="OP">AND</field>
                  <value name="A">
                    <block type="logic_operation">
                      <field name="OP">AND</field>
                      <value name="A">
                        <block type="variables_get">
                          <field name="VAR">hero is within 2 tiles of shrine</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="variables_get">
                          <field name="VAR">hero is facing away from shrine</field>
                        </block>
                      </value>
                    </block>
                  </value>
                  <value name="B">
                    <block type="variables_get">
                      <field name="VAR">hero is using a strength move</field>
                    </block>
                  </value>
                </block>
              </value>
              <statement name="DO">
                <block type="variables_set">
                  <field name="VAR">shrine stays inactive</field>
                  <value name="VALUE">
                    <block type="logic_boolean">
                      <field name="BOOL">TRUE</field>
                    </block>
                  </value>
                </block>
              </statement>
              <next>
                <block type="variables_set">
                  <field name="VAR">activate</field>
                  <value name="VALUE">
                    <block type="logic_boolean">
                      <field name="BOOL">TRUE</field>
                    </block>
                  </value>
                </block>
              </next>
            </block>
          </statement>
          <value name="RETURN">
            <block type="variables_get">
              <field name="VAR">activate</field>
            </block>
          </value>
        </block>
      </xml>
    `,
  },
  blockBudget: { maxBlocks: 12, maxDepth: 4 },

  preview: { inputs: {} },
  ui: {
    title: "Shrine Blessing",
    instructions: "Read the blessing logic. This shrine is informational only.",
    outputLabel: "Blessing",
  },
};

export function getTrapSpecById(id: string): TrapSpec | null {
  switch (id) {
    case DISASSEMBLED_NUMBER_TRAP_ID:
      return DISASSEMBLED_NUMBER_TRAP_SPEC;
    case DISASSEMBLED_CHARACTER_TRAP_ID:
      return DISASSEMBLED_CHARACTER_TRAP_SPEC;
    case DISASSEMBLED_STRING_TRAP_ID:
      return DISASSEMBLED_STRING_TRAP_SPEC;
    case DISASSEMBLED_BOOLEAN_TRAP_ID:
      return DISASSEMBLED_BOOLEAN_TRAP_SPEC;
    case DISASSEMBLED_LIST_TRAP_ID:
      return DISASSEMBLED_LIST_TRAP_SPEC;
    case BROKEN_NUMBER_TRAP_ID:
      return BROKEN_NUMBER_TRAP_SPEC;
    case UNTARGETED_NUMBER_TRAP_ID:
      return UNTARGETED_NUMBER_TRAP_SPEC;
    case UNTARGETED_STRING_TRAP_ID:
      return UNTARGETED_STRING_TRAP_SPEC;
    case UNTARGETED_LIST_TRAP_ID:
      return UNTARGETED_LIST_TRAP_SPEC;
    case SHRINE_TRAP_ID:
      return SHRINE_TRAP_SPEC;
    default:
      return null;
  }
}
