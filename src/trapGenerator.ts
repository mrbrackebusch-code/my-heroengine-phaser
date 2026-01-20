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
import { SHRINE_TRAP_ID, getTrapSpecById } from "./trapSpecs";

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

type ShrineRitualKind =
  | "strength_away"
  | "wisdom_near"
  | "enemy_near"
  | "corner_touch";

export type ShrineRitualSpec = {
  kind: ShrineRitualKind;
  description: string;
  radiusTiles?: number;
};

const SHRINE_NEAR_RADIUS_TILES = 2;
const SHRINE_RITUAL_KINDS: ShrineRitualKind[] = [
  "strength_away",
  "wisdom_near",
  "enemy_near",
  "corner_touch",
];

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
        <comment pinned="true" h="160" w="360" x="10" y="10">${text}</comment>
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
}

function _buildUntargetedListStarterBlocks(args: {
  comment: string;
  field: string;
  useMin: boolean;
  outputType: ApCspType;
}): TrapStarterBlocks {
  const text = _escapeXml(args.comment);
  const field = args.field || "dist";
  const op = args.useMin ? "MIN" : "MAX";
  const valuesGet = `
    <block type="variables_get">
      <field name="VAR">values</field>
    </block>
  `;
  const indexOfBlock = `
    <block type="lists_indexOf">
      <field name="END">FIRST</field>
      <value name="VALUE">
        ${valuesGet}
      </value>
      <value name="FIND">
        <block type="math_on_list">
          <field name="OP">${op}</field>
          <value name="LIST">
            ${valuesGet}
          </value>
        </block>
      </value>
    </block>
  `;
  let targetValue = indexOfBlock;
  if (args.outputType === "String" || args.outputType === "List") {
    const nameListBlock = `
      <block type="he_trap_enemy_list">
        <field name="FIELD">name</field>
      </block>
    `;
    const nameAtIndex = `
      <block type="lists_getIndex">
        <field name="MODE">GET</field>
        <field name="WHERE">FROM_START</field>
        <value name="VALUE">
          ${nameListBlock}
        </value>
        <value name="AT">
          ${indexOfBlock}
        </value>
      </block>
    `;
    if (args.outputType === "List") {
      targetValue = `
        <block type="lists_create_with">
          <mutation items="1"></mutation>
          <value name="ADD0">
            ${nameAtIndex}
          </value>
        </block>
      `;
    } else {
      targetValue = nameAtIndex;
    }
  }

  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <comment pinned="true" h="160" w="360" x="10" y="10">${text}</comment>
        <block type="procedures_defreturn" x="20" y="220">
          <field name="NAME">trapMain</field>
          <statement name="STACK">
            <block type="variables_set">
              <field name="VAR">values</field>
              <value name="VALUE">
                <block type="he_trap_enemy_list">
                  <field name="FIELD">${field}</field>
                </block>
              </value>
              <next>
                <block type="variables_set">
                  <field name="VAR">target</field>
                  <value name="VALUE">
                    ${targetValue}
                  </value>
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

function _buildUntargetedLoopStarterBlocks(args: {
  comment: string;
  field: string;
  useMin: boolean;
  outputType: ApCspType;
}): TrapStarterBlocks {
  const text = _escapeXml(args.comment);
  const field = args.field || "dist";
  const compareOp = args.useMin ? "LT" : "GT";
  const valuesGet = `
    <block type="variables_get">
      <field name="VAR">values</field>
    </block>
  `;
  const idxOne = `
    <block type="math_number">
      <field name="NUM">1</field>
    </block>
  `;
  const idxVar = `
    <block type="variables_get">
      <field name="VAR">i</field>
    </block>
  `;
  const bestIndexGet = `
    <block type="variables_get">
      <field name="VAR">bestIndex</field>
    </block>
  `;
  const bestValueGet = `
    <block type="variables_get">
      <field name="VAR">bestValue</field>
    </block>
  `;
  const listGetAt = (indexBlock: string) => `
    <block type="lists_getIndex">
      <field name="MODE">GET</field>
      <field name="WHERE">FROM_START</field>
      <value name="VALUE">
        ${valuesGet}
      </value>
      <value name="AT">
        ${indexBlock}
      </value>
    </block>
  `;
  const compareBlock = `
    <block type="logic_compare">
      <field name="OP">${compareOp}</field>
      <value name="A">
        ${listGetAt(idxVar)}
      </value>
      <value name="B">
        ${bestValueGet}
      </value>
    </block>
  `;
  const updateBestBlock = `
    <block type="variables_set">
      <field name="VAR">bestValue</field>
      <value name="VALUE">
        ${listGetAt(idxVar)}
      </value>
      <next>
        <block type="variables_set">
          <field name="VAR">bestIndex</field>
          <value name="VALUE">
            ${idxVar}
          </value>
        </block>
      </next>
    </block>
  `;
  let targetValue = bestIndexGet;
  if (args.outputType === "String" || args.outputType === "List") {
    const nameListBlock = `
      <block type="he_trap_enemy_list">
        <field name="FIELD">name</field>
      </block>
    `;
    const nameAtBest = `
      <block type="lists_getIndex">
        <field name="MODE">GET</field>
        <field name="WHERE">FROM_START</field>
        <value name="VALUE">
          ${nameListBlock}
        </value>
        <value name="AT">
          ${bestIndexGet}
        </value>
      </block>
    `;
    if (args.outputType === "List") {
      targetValue = `
        <block type="lists_create_with">
          <mutation items="1"></mutation>
          <value name="ADD0">
            ${nameAtBest}
          </value>
        </block>
      `;
    } else {
      targetValue = nameAtBest;
    }
  }

  return {
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        <comment pinned="true" h="170" w="380" x="10" y="10">${text}</comment>
        <block type="procedures_defreturn" x="20" y="240">
          <field name="NAME">trapMain</field>
          <statement name="STACK">
            <block type="variables_set">
              <field name="VAR">values</field>
              <value name="VALUE">
                <block type="he_trap_enemy_list">
                  <field name="FIELD">${field}</field>
                </block>
              </value>
              <next>
                <block type="variables_set">
                  <field name="VAR">bestIndex</field>
                  <value name="VALUE">
                    ${idxOne}
                  </value>
                  <next>
                    <block type="variables_set">
                      <field name="VAR">bestValue</field>
                      <value name="VALUE">
                        ${listGetAt(idxOne)}
                      </value>
                      <next>
                        <block type="controls_forEach">
                          <field name="VAR">i</field>
                          <value name="LIST">
                            <block type="he_trap_enemy_indices"></block>
                          </value>
                          <statement name="DO">
                            <block type="controls_if">
                              <value name="IF0">
                                ${compareBlock}
                              </value>
                              <statement name="DO0">
                                ${updateBestBlock}
                              </statement>
                            </block>
                          </statement>
                          <next>
                            <block type="variables_set">
                              <field name="VAR">target</field>
                              <value name="VALUE">
                                ${targetValue}
                              </value>
                            </block>
                          </next>
                        </block>
                      </next>
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

function _msToSecondsLabel(ms: number): string {
  const clamped = Math.max(0, ms | 0);
  const sec = Math.idiv(clamped, 1000);
  return `${sec}s`;
}

function _blockText(value: string): string {
  return `
    <block type="text">
      <field name="TEXT">${_escapeXml(value)}</field>
    </block>
  `;
}

function _blockBoolean(value: boolean): string {
  return `
    <block type="logic_boolean">
      <field name="BOOL">${value ? "TRUE" : "FALSE"}</field>
    </block>
  `;
}

function _blockNumber(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return `
    <block type="math_number">
      <field name="NUM">${num}</field>
    </block>
  `;
}

function _blockTextList(values: string[]): string {
  const items = values && values.length ? values : [""];
  let out = `<block type="lists_create_with"><mutation items="${items.length}"></mutation>`;
  for (let i = 0; i < items.length; i++) {
    out += `<value name="ADD${i}">${_blockText(String(items[i] || ""))}</value>`;
  }
  out += "</block>";
  return out;
}

function _blockVarSet(name: string, valueBlock: string, nextBlock?: string, pos?: { x: number; y: number }): string {
  const x = pos ? ` x="${pos.x | 0}" y="${pos.y | 0}"` : "";
  const next = nextBlock ? `<next>${nextBlock}</next>` : "";
  return `
    <block type="variables_set"${x}>
      <field name="VAR">${_escapeXml(name)}</field>
      <value name="VALUE">${valueBlock}</value>
      ${next}
    </block>
  `;
}

function _blockVarGet(name: string): string {
  return `
    <block type="variables_get">
      <field name="VAR">${_escapeXml(name)}</field>
    </block>
  `;
}

function _blockLogicCompare(op: string, aBlock: string, bBlock: string): string {
  const mode = _escapeXml(op || "EQ");
  return `
    <block type="logic_compare">
      <field name="OP">${mode}</field>
      <value name="A">${aBlock}</value>
      <value name="B">${bBlock}</value>
    </block>
  `;
}

function _blockLogicAnd(aBlock: string, bBlock: string): string {
  return `
    <block type="logic_operation">
      <field name="OP">AND</field>
      <value name="A">${aBlock}</value>
      <value name="B">${bBlock}</value>
    </block>
  `;
}

function _blockLogicAndChain(blocks: string[]): string {
  const list = (blocks || []).filter(Boolean);
  if (!list.length) return _blockBoolean(false);
  let expr = list[0];
  for (let i = 1; i < list.length; i++) {
    expr = _blockLogicAnd(expr, list[i]);
  }
  return expr;
}

function _blockIf(conditionBlock: string, doBlock: string, nextBlock?: string): string {
  const next = nextBlock ? `<next>${nextBlock}</next>` : "";
  return `
    <block type="controls_if">
      <value name="IF0">${conditionBlock}</value>
      <statement name="DO0">${doBlock}</statement>
      ${next}
    </block>
  `;
}

function _blockWhileUntil(conditionBlock: string, doBlock?: string, nextBlock?: string): string {
  const stmt = doBlock ? `${doBlock}` : "";
  const next = nextBlock ? `<next>${nextBlock}</next>` : "";
  return `
    <block type="controls_whileUntil">
      <field name="MODE">UNTIL</field>
      <value name="BOOL">${conditionBlock}</value>
      <statement name="DO">${stmt}</statement>
      ${next}
    </block>
  `;
}

function _blockProcedureReturn(name: string, stackBlock: string, returnBlock: string): string {
  const procName = String(name || "trapMain");
  return `
    <block type="procedures_defreturn" x="20" y="20">
      <field name="NAME">${_escapeXml(procName)}</field>
      <statement name="STACK">${stackBlock}</statement>
      <value name="RETURN">${returnBlock}</value>
    </block>
  `;
}

export function buildShrineStarterBlocks(ritual: ShrineRitualSpec): TrapStarterBlocks {
  const activateLine = _blockVarSet("activate", _blockBoolean(true));
  const idleLine = _blockVarSet("shrine stays inactive", _blockBoolean(true));
  const waitUntil = (conditionBlock: string, nextBlock?: string) =>
    _blockWhileUntil(conditionBlock, idleLine, nextBlock);

  const heroNear = _blockVarGet("hero is within 2 tiles of shrine");
  const heroFacingAway = _blockVarGet("hero is facing away from shrine");
  const heroStrength = _blockVarGet("hero is using a strength move");
  const heroWisdom = _blockVarGet("hero is using a wisdom move");
  const enemyNear = _blockVarGet("enemy is within 2 tiles of shrine");
  const heroCorner = _blockVarGet("hero is touching a corner of the map");

  let condition = _blockVarGet("activation condition is true");
  if (ritual?.kind === "strength_away") {
    condition = _blockLogicAndChain([heroNear, heroFacingAway, heroStrength]);
  } else if (ritual?.kind === "wisdom_near") {
    condition = _blockLogicAndChain([heroNear, heroWisdom]);
  } else if (ritual?.kind === "enemy_near") {
    condition = enemyNear;
  } else if (ritual?.kind === "corner_touch") {
    condition = heroCorner;
  }

  const stack = waitUntil(condition, activateLine);
  const proc = _blockProcedureReturn("When floor begins", stack, _blockVarGet("activate"));
  return {
    readOnly: true,
    xml: `
      <xml xmlns="https://developers.google.com/blockly/xml">
        ${proc}
      </xml>
    `,
  };
}

function _generateShrineRitual(rng: () => number): ShrineRitualSpec {
  const kind = _pick<ShrineRitualKind>(rng, SHRINE_RITUAL_KINDS, "strength_away");
  if (kind === "strength_away") {
    return {
      kind,
      radiusTiles: SHRINE_NEAR_RADIUS_TILES,
      description: "Use a Strength move while within 2 tiles of the shrine and facing away from it.",
    };
  }
  if (kind === "wisdom_near") {
    return {
      kind,
      radiusTiles: SHRINE_NEAR_RADIUS_TILES,
      description: "Use a Wisdom move while within 2 tiles of the shrine.",
    };
  }
  if (kind === "enemy_near") {
    return {
      kind,
      radiusTiles: SHRINE_NEAR_RADIUS_TILES,
      description: "An enemy is within 2 tiles of the shrine.",
    };
  }
  return {
    kind: "corner_touch",
    description: "Touch a corner of the map.",
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
  const correctField = useDistances ? "dist" : "hp";
  const starterField = useDistances ? "hp" : "dist";
  const starterBlocksOverride = useListStyle
    ? _buildUntargetedListStarterBlocks({
        comment,
        field: starterField,
        useMin,
        outputType: (spec.output?.type as ApCspType) || "Number",
      })
    : _buildUntargetedLoopStarterBlocks({
        comment,
        field: starterField,
        useMin,
        outputType: (spec.output?.type as ApCspType) || "Number",
      });
  const paletteBlocks = useListStyle
    ? [
        ...BASE_PROC_BLOCKS,
        "he_trap_enemy_list",
        "math_on_list",
        "lists_indexOf",
      ]
    : [
        ...BASE_PROC_BLOCKS,
        "he_trap_enemy_list",
        "he_trap_enemy_indices",
        "controls_forEach",
        "controls_if",
        "logic_compare",
        "math_number",
        "lists_getIndex",
      ];
  if (spec.output?.type !== "Number") paletteBlocks.push("lists_getIndex");
  if (spec.output?.type === "List") paletteBlocks.push("lists_create_with");
  const paletteOverride = _paletteBlocks(paletteBlocks);
  const enemyFields = new Set<string>([correctField, starterField]);
  if (spec.output?.type !== "Number") enemyFields.add("name");
  const blocklyOverride = { enemyFields: Array.from(enemyFields), exposedInputs: [] };

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
    blocklyOverride,
    axes,
  });
}

function _generateShrineInstance(spec: TrapSpec, seed: number): TrapInstance {
  const rng = _mulberry32(seed | 0);
  const ritual = _generateShrineRitual(rng);
  const starterBlocksOverride = buildShrineStarterBlocks(ritual);
  const instructions = `Ritual: ${ritual.description}`;

  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs: { ritual },
    expectedOutput: true,
    outputContract: spec.output,
    uiOverride: { instructions },
    starterBlocksOverride,
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
  if (trapId === SHRINE_TRAP_ID) return _generateShrineInstance(spec, seed | 0);
  const gen = TRAP_GENERATORS_BY_KIND[spec.kind];
  if (!gen) return null;
  return gen(spec, seed | 0);
}
