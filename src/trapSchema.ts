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

  solutionSpec?: {
    expectedOutput?: unknown;
    notes?: string;
  };
}
