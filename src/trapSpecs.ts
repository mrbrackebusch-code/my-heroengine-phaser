import type { TrapSpec } from "./trapSchema";

export const DISASSEMBLED_NUMBER_TRAP_ID = "trap.disassembled.number.v1";

export const DISASSEMBLED_NUMBER_TRAP_SPEC: TrapSpec = {
  id: DISASSEMBLED_NUMBER_TRAP_ID,
  version: 1,
  kind: "Disassembled",
  seed: 0,

  inputs: [
    { name: "givenValue", type: "Number", description: "Given target index" },
  ],
  output: {
    type: "Number",
    number: { integerOnly: true, min: 0, max: 5 },
  },
  valueKindsUsed: ["procedure", "order", "target"],
  palette: {
    categories: ["Functions", "Variables"],
    blocksAllowed: [
      "procedures_defreturn",
      "variables_set",
      "variables_get",
    ],
  },

  givenInputs: ["givenValue"],
  requiredInputs: ["givenValue"],

  validator: {
    requireAllGivenInputsUsed: true,
    requiredInputs: ["givenValue"],
    outputContract: {
      type: "Number",
      number: { integerOnly: true, min: 0, max: 5 },
    },
    expectedOutputFromInputs: (inputs: Record<string, unknown>) => inputs.givenValue,
  },
  runtimeBinding: {
    effectId: "trap.disassembled.number",
    outputMapping: "Number -> targetIndex",
  },

  starterBlocks: {
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
  },
  blockBudget: { maxBlocks: 3, maxDepth: 2 },

  preview: { inputs: { givenValue: 2 } },
  ui: {
    title: "Disassembled Trap (Number)",
    instructions: "Assemble the blocks so the procedure returns the given number.",
    outputLabel: "Return a Number",
  },
};

export function getTrapSpecById(id: string): TrapSpec | null {
  if (id === DISASSEMBLED_NUMBER_TRAP_ID) return DISASSEMBLED_NUMBER_TRAP_SPEC;
  return null;
}
