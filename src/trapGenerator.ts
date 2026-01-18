import type {
  ApCspType,
  TrapAxes,
  TrapEffectAxis,
  TrapComparator,
  TrapMathOp,
  TrapTargetingAxis,
  TrapTriggeringAxis,
  TrapKind,
  TrapOutputContract,
  TrapSpec,
  TrapStarterBlocks,
} from "./trapSchema";
import { createTrapInstance, type TrapInstance } from "./trapInstances";
import { getTrapSpecById } from "./trapSpecs";

export type TrapGeneratorFn = (spec: TrapSpec, seed: number) => TrapInstance;

const DEFAULT_STRINGS = ["alpha", "beta", "gamma", "delta", "ember", "spark"];
const DEFAULT_CHARS = ["A", "B", "C", "D", "E", "F"];
const DISASSEMBLED_MATH_OPS: TrapMathOp[] = ["ADD", "MINUS", "MULTIPLY"];
const DISASSEMBLED_OPERANDS = [1, 2, 3, 4, 5, 10];
const DISASSEMBLED_THRESHOLDS = [2, 3, 4, 5, 6, 7, 8];
const DISASSEMBLED_COMPARATORS: TrapComparator[] = [">", "<", ">=", "<="];
const DISASSEMBLED_STRING_SUFFIXES = ["!", "_x", "-ok", "_v2"];
const BROKEN_GIVEN_VALUES = [2, 3, 4, 5, 6, 7, 8, 9];
const BROKEN_ADD_VALUES = [1, 2, 3, 4, 5];
const BROKEN_MULT_VALUES = [2, 3, 4, 5];
const BROKEN_REPEAT_COUNTS = [2, 3, 4, 5];
type BrokenPatternId = "loop_order" | "loop_overwrite" | "comparison";
const BROKEN_PATTERNS: BrokenPatternId[] = ["loop_order", "loop_overwrite", "comparison"];
type UntargetedTargetMode = "closest" | "farthest" | "weakest" | "strongest";
const UNTARGETED_TARGET_MODES: UntargetedTargetMode[] = ["closest", "farthest", "weakest", "strongest"];
type UntargetedSolveStyle = "list" | "loop";
const UNTARGETED_SOLVE_STYLES: UntargetedSolveStyle[] = ["list", "loop"];
const UNTARGETED_LIST_LENGTHS = [3, 4, 5];
const UNTARGETED_ENEMY_NAMES = [
  "goblin",
  "orc",
  "slime",
  "wisp",
  "harpy",
  "marauder",
  "ogre",
  "wyrm",
  "specter",
  "beetle",
  "bandit",
  "drake",
];
const DISASSEMBLED_EFFECT_ELEMENTS: TrapEffectAxis["element"][] = ["fire", "poison", "ice", "arcane"];
const DISASSEMBLED_EFFECT_PATTERNS: TrapEffectAxis["pattern"][] = ["radial", "line", "burst", "single"];
const BASE_PROC_BLOCKS = ["procedures_defreturn", "variables_set", "variables_get"];

type DisassembledNumberStyle = "identity" | "math_single" | "math_double" | "gated";
const DISASSEMBLED_NUMBER_STYLES: DisassembledNumberStyle[] = [
  "identity",
  "math_single",
  "math_double",
  "gated",
];

type DisassembledBooleanStyle = "identity" | "negate";
const DISASSEMBLED_BOOLEAN_STYLES: DisassembledBooleanStyle[] = ["identity", "negate"];

type DisassembledStringStyle = "identity" | "concat";
const DISASSEMBLED_STRING_STYLES: DisassembledStringStyle[] = ["identity", "concat"];

function _mulberry32(seed: number): () => number {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function _rngInt(rng: () => number, min: number, max: number): number {
  const lo = Math.min(min | 0, max | 0) | 0;
  const hi = Math.max(min | 0, max | 0) | 0;
  if (hi <= lo) return lo | 0;
  return (lo + Math.floor(rng() * ((hi - lo + 1) | 0))) | 0;
}

function _pick<T>(rng: () => number, list: T[], fallback: T): T {
  if (!list || list.length === 0) return fallback;
  return list[_rngInt(rng, 0, list.length - 1) | 0];
}

function _uniqBlocks(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const v = String(list[i] || "");
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function _paletteBlocks(list: string[]): { blocksAllowed: string[] } {
  return { blocksAllowed: _uniqBlocks(list) };
}

function _escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _uniqueInts(rng: () => number, count: number, min: number, max: number): number[] {
  const out: number[] = [];
  const lo = Math.min(min | 0, max | 0) | 0;
  const hi = Math.max(min | 0, max | 0) | 0;
  const maxCount = Math.max(0, count | 0) | 0;
  let attempts = 0;
  while (out.length < maxCount && attempts < 200) {
    attempts++;
    const v = _rngInt(rng, lo, hi) | 0;
    if (out.indexOf(v) === -1) out.push(v);
  }
  for (let v = lo; out.length < maxCount && v <= hi; v++) {
    if (out.indexOf(v | 0) === -1) out.push(v | 0);
  }
  while (out.length < maxCount) {
    out.push((lo + out.length) | 0);
  }
  return out;
}

function _pickUniqueNames(rng: () => number, count: number): string[] {
  const pool = UNTARGETED_ENEMY_NAMES.slice();
  const out: string[] = [];
  const maxCount = Math.max(0, count | 0) | 0;
  while (out.length < maxCount && pool.length > 0) {
    const idx = _rngInt(rng, 0, pool.length - 1) | 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  while (out.length < maxCount) {
    out.push(`enemy${out.length + 1}`);
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

function _maxIndex(values: number[]): number {
  if (!values.length) return 0;
  let idx = 0;
  let best = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v > best) {
      best = v;
      idx = i;
    }
  }
  return idx;
}

function _defaultForType(type: ApCspType): unknown {
  switch (type) {
    case "Number":
      return 1;
    case "String":
      return "alpha";
    case "Character":
      return "A";
    case "Boolean":
      return true;
    case "List":
      return [1, 2, 3];
    default:
      return 1;
  }
}

function _mathOpToSymbol(op: TrapMathOp): string {
  switch (op) {
    case "ADD":
      return "+";
    case "MINUS":
      return "-";
    case "MULTIPLY":
      return "*";
    case "DIVIDE":
      return "/";
    default:
      return "+";
  }
}

function _computeMath(op: TrapMathOp, a: number, b: number): number {
  switch (op) {
    case "ADD":
      return (a + b) | 0;
    case "MINUS":
      return (a - b) | 0;
    case "MULTIPLY":
      return (a * b) | 0;
    case "DIVIDE":
      return b !== 0 ? Math.floor(a / b) : a | 0;
    default:
      return (a + b) | 0;
  }
}

function _compareNumber(a: number, comparator: TrapComparator, b: number): boolean {
  switch (comparator) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    default:
      return a === b;
  }
}

function _buildDisassembledMathStarterBlocks(op: TrapMathOp, operand: number): TrapStarterBlocks {
  const opField = String(op || "ADD");
  const num = Number.isFinite(operand) ? (operand | 0) : 1;
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="variables_set" x="20" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="math_arithmetic">
              <field name="OP">${opField}</field>
              <value name="A">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
              <value name="B">
                <block type="math_number">
                  <field name="NUM">${num}</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="250">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
}

function _buildDisassembledDoubleMathStarterBlocks(
  opA: TrapMathOp,
  operandA: number,
  opB: TrapMathOp,
  operandB: number
): TrapStarterBlocks {
  const opFieldA = String(opA || "ADD");
  const opFieldB = String(opB || "ADD");
  const numA = Number.isFinite(operandA) ? (operandA | 0) : 1;
  const numB = Number.isFinite(operandB) ? (operandB | 0) : 1;
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="variables_set" x="20" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="math_arithmetic">
              <field name="OP">${opFieldB}</field>
              <value name="A">
                <block type="math_arithmetic">
                  <field name="OP">${opFieldA}</field>
                  <value name="A">
                    <block type="variables_get">
                      <field name="VAR">givenValue</field>
                    </block>
                  </value>
                  <value name="B">
                    <block type="math_number">
                      <field name="NUM">${numA}</field>
                    </block>
                  </value>
                </block>
              </value>
              <value name="B">
                <block type="math_number">
                  <field name="NUM">${numB}</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="280">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
}

function _buildDisassembledGatedStarterBlocks(
  comparator: TrapComparator,
  threshold: number,
  op: TrapMathOp,
  operand: number
): TrapStarterBlocks {
  const cmp = String(comparator || ">");
  const opField = String(op || "ADD");
  const num = Number.isFinite(operand) ? (operand | 0) : 1;
  const thresh = Number.isFinite(threshold) ? (threshold | 0) : 1;
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="controls_ifelse" x="20" y="120">
          <value name="IF0">
            <block type="logic_compare">
              <field name="OP">${cmp}</field>
              <value name="A">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
              <value name="B">
                <block type="math_number">
                  <field name="NUM">${thresh}</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_set" x="300" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="math_arithmetic">
              <field name="OP">${opField}</field>
              <value name="A">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
              <value name="B">
                <block type="math_number">
                  <field name="NUM">${num}</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_set" x="300" y="240">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="variables_get">
              <field name="VAR">givenValue</field>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="320">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
}

function _buildDisassembledBooleanNegateStarterBlocks(): TrapStarterBlocks {
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="variables_set" x="20" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="logic_negate">
              <value name="BOOL">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="240">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
}

function _buildDisassembledStringConcatStarterBlocks(suffix: string): TrapStarterBlocks {
  const text = _escapeXml(suffix || "");
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
        </block>
        <block type="variables_set" x="20" y="120">
          <field name="VAR">target</field>
          <value name="VALUE">
            <block type="text_join">
              <value name="ADD0">
                <block type="variables_get">
                  <field name="VAR">givenValue</field>
                </block>
              </value>
              <value name="ADD1">
                <block type="text">
                  <field name="TEXT">${text}</field>
                </block>
              </value>
            </block>
          </value>
        </block>
        <block type="variables_get" x="20" y="260">
          <field name="VAR">target</field>
        </block>
      </xml>
    `,
  };
}

function _buildBrokenLoopOrderStarterBlocks(): TrapStarterBlocks {
  return {
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
  };
}

function _buildBrokenLoopOverwriteStarterBlocks(): TrapStarterBlocks {
  return {
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
                        <block type="variables_get">
                          <field name="VAR">addValue</field>
                        </block>
                      </value>
                    </block>
                  </statement>
                  <next>
                    <block type="variables_set">
                      <field name="VAR">target</field>
                      <value name="VALUE">
                        <block type="math_arithmetic">
                          <field name="OP">MULTIPLY</field>
                          <value name="A">
                            <block type="variables_get">
                              <field name="VAR">target</field>
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
                  </next>
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
  };
}

function _buildBrokenComparisonStarterBlocks(): TrapStarterBlocks {
  return {
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
                <block type="controls_if">
                  <mutation else="1"></mutation>
                  <value name="IF0">
                    <block type="logic_compare">
                      <field name="OP">LT</field>
                      <value name="A">
                        <block type="variables_get">
                          <field name="VAR">givenValue</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="variables_get">
                          <field name="VAR">multValue</field>
                        </block>
                      </value>
                    </block>
                  </value>
                  <statement name="DO0">
                    <block type="variables_set">
                      <field name="VAR">target</field>
                      <value name="VALUE">
                        <block type="math_arithmetic">
                          <field name="OP">ADD</field>
                          <value name="A">
                            <block type="variables_get">
                              <field name="VAR">givenValue</field>
                            </block>
                          </value>
                          <value name="B">
                            <block type="math_arithmetic">
                              <field name="OP">MULTIPLY</field>
                              <value name="A">
                                <block type="variables_get">
                                  <field name="VAR">addValue</field>
                                </block>
                              </value>
                              <value name="B">
                                <block type="variables_get">
                                  <field name="VAR">repeatCount</field>
                                </block>
                              </value>
                            </block>
                          </value>
                        </block>
                      </value>
                    </block>
                  </statement>
                  <statement name="ELSE">
                    <block type="variables_set">
                      <field name="VAR">target</field>
                      <value name="VALUE">
                        <block type="math_arithmetic">
                          <field name="OP">MINUS</field>
                          <value name="A">
                            <block type="variables_get">
                              <field name="VAR">givenValue</field>
                            </block>
                          </value>
                          <value name="B">
                            <block type="math_arithmetic">
                              <field name="OP">MULTIPLY</field>
                              <value name="A">
                                <block type="variables_get">
                                  <field name="VAR">addValue</field>
                                </block>
                              </value>
                              <value name="B">
                                <block type="variables_get">
                                  <field name="VAR">repeatCount</field>
                                </block>
                              </value>
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
  };
}

function _targetingOptionsForType(type: ApCspType): TrapTargetingAxis[] {
  switch (type) {
    case "String":
    case "Character":
      return [
        { domain: "enemy", key: "name", source: "given", count: "single" },
        { domain: "prop", key: "name", source: "given", count: "single" },
      ];
    case "Boolean":
      return [
        { domain: "enemy", key: "value", source: "given", count: "single" },
        { domain: "self", key: "value", source: "given", count: "single" },
      ];
    case "List":
      return [
        { domain: "enemy", key: "list", source: "given", count: "list" },
        { domain: "prop", key: "list", source: "given", count: "list" },
      ];
    case "Number":
    default:
      return [
        { domain: "enemy", key: "distance", source: "given", count: "single" },
        { domain: "prop", key: "index", source: "given", count: "single" },
      ];
  }
}

function _buildDisassembledAxes(type: ApCspType, rng: () => number, op?: TrapMathOp, operand?: number): TrapAxes {
  const targeting = _pick(rng, _targetingOptionsForType(type), {
    domain: "none",
    key: "value",
    source: "given",
    count: "single",
  });
  const triggering: TrapTriggeringAxis = {
    mode: "sequence",
    mathOp: op,
    operand,
  };
  const effect: TrapEffectAxis = {
    element: _pick(rng, DISASSEMBLED_EFFECT_ELEMENTS, "fire"),
    pattern: _pick(rng, DISASSEMBLED_EFFECT_PATTERNS, "radial"),
  };
  return {
    targeting,
    triggering,
    effect,
    extras: { extraTarget: false, extraProcedure: false, dualOutput: false },
  };
}

function _buildBrokenAxes(
  type: ApCspType,
  rng: () => number,
  pattern: BrokenPatternId,
  multValue: number
): TrapAxes {
  const targeting = _pick(rng, _targetingOptionsForType(type), {
    domain: "none",
    key: "value",
    source: "given",
    count: "single",
  });
  const triggering: TrapTriggeringAxis = (pattern === "comparison")
    ? {
        mode: "condition",
        comparator: ">",
        mathOp: "MULTIPLY",
        operand: multValue | 0,
      }
    : {
        mode: "sequence",
        mathOp: "MULTIPLY",
        operand: multValue | 0,
      };
  const effect: TrapEffectAxis = {
    element: _pick(rng, DISASSEMBLED_EFFECT_ELEMENTS, "fire"),
    pattern: _pick(rng, DISASSEMBLED_EFFECT_PATTERNS, "radial"),
  };
  return {
    targeting,
    triggering,
    effect,
    extras: { extraTarget: false, extraProcedure: false, dualOutput: false },
  };
}

function _buildUntargetedAxes(mode: UntargetedTargetMode, rng: () => number): TrapAxes {
  const useDistance = (mode === "closest" || mode === "farthest");
  const useMin = (mode === "closest" || mode === "weakest");
  const targeting: TrapTargetingAxis = {
    domain: "enemy",
    key: useDistance ? "distance" : "value",
    source: "given",
    count: "single",
  };
  const triggering: TrapTriggeringAxis = {
    mode: "sequence",
    comparator: useMin ? "<=" : ">=",
    mathOp: useMin ? "MINUS" : "ADD",
    operand: 0,
  };
  const effect: TrapEffectAxis = {
    element: _pick(rng, DISASSEMBLED_EFFECT_ELEMENTS, "fire"),
    pattern: _pick(rng, DISASSEMBLED_EFFECT_PATTERNS, "radial"),
  };
  return {
    targeting,
    triggering,
    effect,
    extras: { extraTarget: false, extraProcedure: false, dualOutput: false },
  };
}

function _buildUntargetedStarterBlocks(comment: string): TrapStarterBlocks {
  const text = _escapeXml(comment);
  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <block type="procedures_defreturn" x="20" y="20">
          <field name="NAME">trapMain</field>
          <comment pinned="true" h="160" w="360" x="10" y="10">${text}</comment>
          <value name="RETURN">
            <block type="variables_get">
              <field name="VAR">target</field>
            </block>
          </value>
        </block>
      </xml>
    `,
  };
}

function _generateValueForContract(contract: TrapOutputContract, rng: () => number, depth = 0): unknown {
  if (!contract || !contract.type) return 0;
  switch (contract.type) {
    case "Number": {
      const cfg = contract.number || {};
      if (cfg.allowedValues && cfg.allowedValues.length > 0) {
        return _pick(rng, cfg.allowedValues, cfg.allowedValues[0]);
      }
      const min = (typeof cfg.min === "number") ? cfg.min : 0;
      const max = (typeof cfg.max === "number") ? cfg.max : (min + 9);
      const val = _rngInt(rng, min | 0, max | 0);
      if (cfg.integerOnly === false) return val;
      return val | 0;
    }
    case "String": {
      const cfg = contract.string || {};
      if (cfg.allowedValues && cfg.allowedValues.length > 0) {
        return _pick(rng, cfg.allowedValues, cfg.allowedValues[0]);
      }
      return _pick(rng, DEFAULT_STRINGS, "alpha");
    }
    case "Character": {
      const cfg = contract.character || {};
      if (cfg.allowedValues && cfg.allowedValues.length > 0) {
        return _pick(rng, cfg.allowedValues, cfg.allowedValues[0]);
      }
      return _pick(rng, DEFAULT_CHARS, "A");
    }
    case "Boolean":
      return rng() < 0.5;
    case "List": {
      const cfg = contract.list || {};
      const length = (typeof cfg.length === "number") ? cfg.length : 3;
      const list: unknown[] = [];
      if (cfg.positions && cfg.positions.length > 0) {
        for (let i = 0; i < cfg.positions.length; i++) {
          const pos = cfg.positions[i];
          list[i] = _generateValueForContract({
            type: pos.type,
            number: pos.number,
            string: pos.string,
            character: pos.character,
            boolean: pos.boolean,
            list: undefined,
          }, rng, depth + 1);
        }
        return list;
      }
      const elementType = cfg.elementType || "Number";
      for (let i = 0; i < length; i++) {
        if (elementType === "List" && depth > 0) {
          list.push(_defaultForType("Number"));
        } else {
          list.push(_generateValueForContract({ type: elementType }, rng, depth + 1));
        }
      }
      return list;
    }
    default:
      return _defaultForType(contract.type as ApCspType);
  }
}

function _generateDisassembledNumberInstance(spec: TrapSpec, seed: number): TrapInstance {
  const rng = _mulberry32(seed | 0);
  const style = _pick(rng, DISASSEMBLED_NUMBER_STYLES, "identity");
  const opA = _pick(rng, DISASSEMBLED_MATH_OPS, "ADD");
  const operandA = _pick(rng, DISASSEMBLED_OPERANDS, 1);
  const opB = _pick(rng, DISASSEMBLED_MATH_OPS, "ADD");
  const operandB = _pick(rng, DISASSEMBLED_OPERANDS, 1);
  const comparator = _pick(rng, DISASSEMBLED_COMPARATORS, ">");
  const threshold = _pick(rng, DISASSEMBLED_THRESHOLDS, 5);

  const numCfg = spec.output?.number || {};
  const outMin = (typeof numCfg.min === "number") ? numCfg.min : -9999;
  const outMax = (typeof numCfg.max === "number") ? numCfg.max : 9999;

  let givenValue = _rngInt(rng, 0, 9);
  let result = givenValue | 0;
  const computeResult = (val: number): number => {
    if (style === "math_single") return _computeMath(opA, val | 0, operandA | 0);
    if (style === "math_double") return _computeMath(opB, _computeMath(opA, val | 0, operandA | 0), operandB | 0);
    if (style === "gated") {
      const shouldCompute = _compareNumber(val | 0, comparator, threshold | 0);
      const computed = _computeMath(opA, val | 0, operandA | 0);
      return shouldCompute ? computed : (val | 0);
    }
    return val | 0;
  };
  for (let i = 0; i < 20; i++) {
    if (style !== "identity") {
      if (opA === "MINUS" && givenValue < operandA) {
        givenValue = (operandA + _rngInt(rng, 0, 5)) | 0;
      } else if (opA === "MULTIPLY" && givenValue === 0) {
        givenValue = _rngInt(rng, 1, 6);
      } else if (opA === "ADD" || opA === "MULTIPLY") {
        givenValue = _rngInt(rng, 0, 9);
      }
    }
    result = computeResult(givenValue | 0);
    if (result >= outMin && result <= outMax) break;
    givenValue = _rngInt(rng, 0, 9);
  }

  let instructions = "Assemble the blocks so the procedure returns the given number.";
  let starterBlocksOverride: TrapStarterBlocks | undefined = undefined;
  let paletteOverride = {
    categories: ["Functions", "Variables"],
    blocksAllowed: [...BASE_PROC_BLOCKS],
  };
  if (style === "math_single") {
    instructions = `Assemble the blocks so the procedure returns the given number ${_mathOpToSymbol(opA)} ${operandA}.`;
    starterBlocksOverride = _buildDisassembledMathStarterBlocks(opA, operandA | 0);
    paletteOverride = {
      categories: ["Functions", "Variables", "Operators"],
      blocksAllowed: [...BASE_PROC_BLOCKS, "math_arithmetic", "math_number"],
    };
  } else if (style === "math_double") {
    instructions = `Assemble the blocks so the procedure returns (given number ${_mathOpToSymbol(opA)} ${operandA}) ${_mathOpToSymbol(opB)} ${operandB}.`;
    starterBlocksOverride = _buildDisassembledDoubleMathStarterBlocks(opA, operandA | 0, opB, operandB | 0);
    paletteOverride = {
      categories: ["Functions", "Variables", "Operators"],
      blocksAllowed: [...BASE_PROC_BLOCKS, "math_arithmetic", "math_number"],
    };
  } else if (style === "gated") {
    instructions = `Assemble the blocks so the procedure returns the given number ${_mathOpToSymbol(opA)} ${operandA} when the given number ${comparator} ${threshold}, otherwise return the given number.`;
    starterBlocksOverride = _buildDisassembledGatedStarterBlocks(comparator, threshold | 0, opA, operandA | 0);
    paletteOverride = {
      categories: ["Functions", "Variables", "Operators", "Logic"],
      blocksAllowed: [
        ...BASE_PROC_BLOCKS,
        "math_arithmetic",
        "math_number",
        "logic_compare",
        "controls_ifelse",
      ],
    };
  }

  const axes = _buildDisassembledAxes("Number", rng, opA, operandA | 0);

  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs: { givenValue: givenValue | 0 },
    expectedOutput: result | 0,
    outputContract: spec.output,
    uiOverride: { instructions },
    starterBlocksOverride,
    paletteOverride,
    axes,
  });
}

function _generateDisassembledInstance(spec: TrapSpec, seed: number): TrapInstance {
  if (spec.output?.type === "Number") return _generateDisassembledNumberInstance(spec, seed | 0);
  const rng = _mulberry32(seed | 0);
  const inputName = (spec.givenInputs && spec.givenInputs.length > 0)
    ? String(spec.givenInputs[0])
    : "givenValue";
  const value = _generateValueForContract(spec.output, rng);
  const inputs: Record<string, unknown> = { [inputName]: value };
  const axes = _buildDisassembledAxes(spec.output.type as ApCspType, rng);
  let paletteOverride = {
    categories: ["Functions", "Variables"],
    blocksAllowed: [...BASE_PROC_BLOCKS],
  };
  let starterBlocksOverride: TrapStarterBlocks | undefined = undefined;
  let uiOverride: Partial<TrapSpec["ui"]> | undefined = undefined;
  let expectedOutput: unknown = value;

  if (spec.output?.type === "Boolean") {
    const style = _pick(rng, DISASSEMBLED_BOOLEAN_STYLES, "identity");
    if (style === "negate") {
      expectedOutput = !Boolean(value);
      starterBlocksOverride = _buildDisassembledBooleanNegateStarterBlocks();
      paletteOverride = {
        categories: ["Functions", "Variables", "Operators"],
        blocksAllowed: [...BASE_PROC_BLOCKS, "logic_negate"],
      };
      uiOverride = { instructions: "Assemble the blocks so the procedure returns the opposite Boolean." };
    }
  }

  if (spec.output?.type === "String") {
    const style = _pick(rng, DISASSEMBLED_STRING_STYLES, "identity");
    if (style === "concat") {
      const suffix = _pick(rng, DISASSEMBLED_STRING_SUFFIXES, "!");
      expectedOutput = String(value || "") + suffix;
      starterBlocksOverride = _buildDisassembledStringConcatStarterBlocks(suffix);
      paletteOverride = {
        categories: ["Functions", "Variables", "Text"],
        blocksAllowed: [...BASE_PROC_BLOCKS, "text", "text_join"],
      };
      uiOverride = { instructions: "Assemble the blocks so the procedure returns the given text with a suffix added." };
    }
  }

  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs,
    expectedOutput,
    outputContract: spec.output,
    paletteOverride,
    uiOverride,
    starterBlocksOverride,
    axes,
  });
}

function _generateBrokenNumberInstance(spec: TrapSpec, seed: number): TrapInstance {
  const rng = _mulberry32(seed | 0);
  const pattern = _pick(rng, BROKEN_PATTERNS, "loop_order");

  let givenValue = _pick(rng, BROKEN_GIVEN_VALUES, 4) | 0;
  let addValue = _pick(rng, BROKEN_ADD_VALUES, 2) | 0;
  let multValue = _pick(rng, BROKEN_MULT_VALUES, 3) | 0;
  let repeatCount = _pick(rng, BROKEN_REPEAT_COUNTS, 3) | 0;

  let expected = 0;
  let instructions = "Fix the logic so the procedure returns the correct number.";
  let starterBlocksOverride: TrapStarterBlocks = _buildBrokenLoopOrderStarterBlocks();
  let paletteBlocks = [
    ...BASE_PROC_BLOCKS,
    "math_arithmetic",
  ];

  if (pattern === "loop_order") {
    expected = givenValue + (addValue * multValue * repeatCount);
    instructions = "Fix the order of operations inside the loop.";
    starterBlocksOverride = _buildBrokenLoopOrderStarterBlocks();
    paletteBlocks = [...paletteBlocks, "controls_repeat_ext"];
  } else if (pattern === "loop_overwrite") {
    expected = (givenValue + (addValue * repeatCount)) * multValue;
    instructions = "Fix the loop so it accumulates instead of overwriting.";
    starterBlocksOverride = _buildBrokenLoopOverwriteStarterBlocks();
    paletteBlocks = [...paletteBlocks, "controls_repeat_ext"];
  } else {
    // comparison
    givenValue = _pick(rng, [6, 7, 8, 9], 7) | 0;
    multValue = _pick(rng, [1, 2, 3, 4], 2) | 0;
    repeatCount = _pick(rng, BROKEN_REPEAT_COUNTS, 3) | 0;
    expected = givenValue + (addValue * repeatCount);
    instructions = "Fix the comparison so the correct branch runs.";
    starterBlocksOverride = _buildBrokenComparisonStarterBlocks();
    paletteBlocks = [...paletteBlocks, "controls_if", "logic_compare"];
  }

  const axes = _buildBrokenAxes("Number", rng, pattern, multValue | 0);
  const paletteOverride = _paletteBlocks(paletteBlocks);

  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs: { givenValue, addValue, multValue, repeatCount },
    expectedOutput: expected | 0,
    outputContract: spec.output,
    uiOverride: { instructions },
    starterBlocksOverride,
    paletteOverride,
    axes,
  });
}

function _generateBrokenInstance(spec: TrapSpec, seed: number): TrapInstance {
  if (spec.output?.type === "Number") return _generateBrokenNumberInstance(spec, seed | 0);
  return _generateDisassembledInstance(spec, seed | 0);
}

function _untargetedModeLabel(mode: UntargetedTargetMode): string {
  switch (mode) {
    case "closest":
      return "closest";
    case "farthest":
      return "farthest";
    case "weakest":
      return "weakest";
    case "strongest":
      return "strongest";
    default:
      return "closest";
  }
}

function _generateUntargetedInstance(spec: TrapSpec, seed: number): TrapInstance {
  const rng = _mulberry32(seed | 0);
  const mode = _pick(rng, UNTARGETED_TARGET_MODES, "closest");
  const style = _pick(rng, UNTARGETED_SOLVE_STYLES, "list");
  const listLen = _pick(rng, UNTARGETED_LIST_LENGTHS, 3) | 0;
  const enemyDist = _uniqueInts(rng, listLen, 1, 12);
  const enemyDistSq = enemyDist.map(v => (v * v) | 0);
  const enemyHp = _uniqueInts(rng, listLen, 4, 20);
  const enemyMaxHp = enemyHp.map(v => (v + _rngInt(rng, 2, 10)) | 0);
  const enemyMana = _uniqueInts(rng, listLen, 0, 12);
  const enemyMaxMana = enemyMana.map(v => (v + _rngInt(rng, 2, 8)) | 0);
  const enemyX = _uniqueInts(rng, listLen, 0, 20);
  const enemyY = _uniqueInts(rng, listLen, 0, 20);
  const enemyVx = _uniqueInts(rng, listLen, -2, 2);
  const enemyVy = _uniqueInts(rng, listLen, -2, 2);
  const enemyDamage = _uniqueInts(rng, listLen, 1, 8);
  const enemyNames = _pickUniqueNames(rng, listLen);

  const useDistances = (mode === "closest" || mode === "farthest");
  const useMin = (mode === "closest" || mode === "weakest");
  const values = useDistances ? enemyDist : enemyHp;
  const idx = useMin ? _minIndex(values) : _maxIndex(values);
  const targetIndex = (idx + 1) | 0;
  const targetName = enemyNames[idx] || "";

  let expected: unknown = targetIndex;
  let outputContract: TrapOutputContract | undefined = spec.output;
  let outputHint = "Return the 1-based index of the target enemy.";
  const useListStyle = style === "list";

  if (spec.output?.type === "String") {
    expected = targetName;
    outputHint = "Return the target enemy name.";
    outputContract = {
      type: "String",
      string: { allowedValues: enemyNames },
    };
  } else if (spec.output?.type === "List") {
    expected = [targetName];
    outputHint = "Return a list containing the target enemy name.";
    outputContract = {
      type: "List",
      list: {
        length: 1,
        positions: [
          { type: "String", string: { allowedValues: enemyNames } },
        ],
      },
    };
  } else {
    outputContract = {
      type: "Number",
      number: { integerOnly: true, min: 1, max: listLen },
    };
  }

  const axes = _buildUntargetedAxes(mode, rng);
  const instructions = `Target the ${_untargetedModeLabel(mode)} enemy. ${outputHint}`;
  const comment = useListStyle
    ? `Goal: target the ${_untargetedModeLabel(mode)} enemy using the enemy <field> list.\nUse MIN or MAX on the list, then find the index.\n${outputHint}`
    : `Goal: target the ${_untargetedModeLabel(mode)} enemy by looping over enemies.\nTrack the best value and its index.\n${outputHint}`;
  const starterBlocksOverride = _buildUntargetedStarterBlocks(comment);
  const paletteBlocks = useListStyle
    ? [
        ...BASE_PROC_BLOCKS,
        "he_trap_enemy_list",
        "math_on_list",
        "lists_indexOf",
      ]
    : [
        ...BASE_PROC_BLOCKS,
        "he_trap_enemy_indices",
        "he_trap_enemy_field_at",
        "controls_forEach",
        "controls_if",
        "logic_compare",
        "math_number",
      ];
  if (spec.output?.type !== "Number") paletteBlocks.push("lists_getIndex");
  if (spec.output?.type === "List") paletteBlocks.push("lists_create_with");
  const paletteOverride = _paletteBlocks(paletteBlocks);

  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs: {
      enemyNames,
      enemyDist,
      enemyDistSq,
      enemyHp,
      enemyMaxHp,
      enemyMana,
      enemyMaxMana,
      enemyX,
      enemyY,
      enemyVx,
      enemyVy,
      enemyDamage,
    },
    expectedOutput: expected,
    outputContract,
    uiOverride: { instructions },
    starterBlocksOverride,
    paletteOverride,
    axes,
  });
}

const TRAP_GENERATORS_BY_KIND: Partial<Record<TrapKind, TrapGeneratorFn>> = {
  Disassembled: _generateDisassembledInstance,
  Broken: _generateBrokenInstance,
  Untargeted: _generateUntargetedInstance,
};

export function generateTrapInstanceById(trapId: string, seed: number): TrapInstance | null {
  const spec = getTrapSpecById(trapId);
  if (!spec) return null;
  const gen = TRAP_GENERATORS_BY_KIND[spec.kind];
  if (!gen) return null;
  return gen(spec, seed | 0);
}
