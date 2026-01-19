export type ApCspType = "Number" | "String" | "Boolean" | "Character" | "List";

export type TrapKind =
  | "Broken"
  | "Disassembled"
  | "Untargeted"
  | "Unconfigured"
  | "Dormant"
  | "Unstable"
  | "Fragmented"
  | "Miscalibrated"
  | "Bloated"
  | "Stalled"
  | "Volatile"
  | "Robot";

export type ValueKind =
  | "math"
  | "list"
  | "logic"
  | "compare"
  | "order"
  | "procedure"
  | "loop"
  | "target"
  | "direction";

export type TrapTargetDomain = "enemy" | "prop" | "self" | "tile" | "none";
export type TrapTargetKey = "name" | "index" | "position" | "distance" | "value" | "list";
export type TrapTargetSource = "given" | "sensed";
export type TrapTargetCount = "single" | "list";

export interface TrapTargetingAxis {
  domain: TrapTargetDomain;
  key: TrapTargetKey;
  source: TrapTargetSource;
  count: TrapTargetCount;
}

export type TrapTriggerMode = "none" | "sequence" | "condition";
export type TrapComparator = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type TrapLogicOp = "and" | "or" | "not";
export type TrapMathOp = "ADD" | "MINUS" | "MULTIPLY" | "DIVIDE";

export interface TrapTriggeringAxis {
  mode: TrapTriggerMode;
  comparator?: TrapComparator;
  logicOps?: TrapLogicOp[];
  mathOp?: TrapMathOp;
  operand?: number;
}

export type TrapEffectElement = "fire" | "poison" | "ice" | "arcane";
export type TrapEffectPattern = "radial" | "line" | "burst" | "single";

export interface TrapEffectAxis {
  element: TrapEffectElement;
  pattern: TrapEffectPattern;
}

export interface TrapExtrasAxis {
  extraTarget?: boolean;
  extraProcedure?: boolean;
  dualOutput?: boolean;
}

export interface TrapAxes {
  targeting: TrapTargetingAxis;
  triggering: TrapTriggeringAxis;
  effect: TrapEffectAxis;
  extras: TrapExtrasAxis;
}

export interface TrapInputSpec {
  name: string;
  type: ApCspType;
  description: string;
}

export interface TrapOutputContract {
  type: ApCspType;
  number?: {
    integerOnly?: boolean;
    min?: number;
    max?: number;
    allowedValues?: number[];
  };
  string?: {
    allowedValues?: string[];
    minLength?: number;
    maxLength?: number;
  };
  character?: {
    allowedValues?: string[];
  };
  boolean?: {};
  list?: {
    length?: number;
    elementType?: ApCspType;
    positions?: Array<{
      type: ApCspType;
      number?: TrapOutputContract["number"];
      string?: TrapOutputContract["string"];
      character?: TrapOutputContract["character"];
      boolean?: TrapOutputContract["boolean"];
    }>;
  };
}

export interface TrapPaletteSpec {
  categories: string[];
  blocksAllowed: string[];
  blocksBanned?: string[];
}

export interface TrapBlocklySpec {
  enemyFields?: string[];
  exposedInputs?: string[];
}

export interface TrapStarterBlocks {
  xml: string;
  readOnly?: boolean;
}

export interface TrapValidatorSpec {
  requireAllGivenInputsUsed?: boolean;
  requiredInputs?: string[];
  outputContract: TrapOutputContract;
  gradingMode?: "strict" | "rule";
  ruleId?: string;
  expectedOutput?: unknown;
  expectedOutputFromInputs?: (inputs: Record<string, unknown>) => unknown;
  matchOutput?: (value: unknown, inputs: Record<string, unknown>) => boolean;
}

export interface TrapRuntimeBinding {
  effectId: string;
  outputMapping: string;
}

export interface TrapPreviewData {
  inputs: Record<string, unknown>;
}

export interface TrapUIText {
  title: string;
  instructions: string;
  hint?: string;
  outputLabel?: string;
}

export interface TrapAnalyticsSpec {
  tags: string[];
}

export interface TrapSpec {
  id: string;
  version: number;
  kind: TrapKind;
  seed: number;

  inputs: TrapInputSpec[];
  output: TrapOutputContract;
  valueKindsUsed: ValueKind[];
  palette: TrapPaletteSpec;

  givenInputs: string[];
  requiredInputs: string[];

  validator: TrapValidatorSpec;
  runtimeBinding: TrapRuntimeBinding;

  starterBlocks: TrapStarterBlocks;
  blockBudget?: { maxBlocks?: number; maxDepth?: number };

  preview: TrapPreviewData;
  ui: TrapUIText;
  analytics?: TrapAnalyticsSpec;
  blockly?: TrapBlocklySpec;

  solutionSpec?: {
    expectedOutput?: unknown;
    notes?: string;
  };
}
