import type {
  TrapAxes,
  TrapKind,
  TrapOutputContract,
  TrapPaletteSpec,
  TrapSpec,
  TrapStarterBlocks,
  TrapUIText,
} from "./trapSchema";

export type TrapInstanceState = "fresh" | "editing" | "solved" | "failed";

export interface TrapInstance {
  instanceId: string;
  specId: string;
  specVersion: number;
  kind: TrapKind;
  seed: number;
  inputs: Record<string, unknown>;
  expectedOutput?: unknown;
  outputContract?: TrapOutputContract;
  paletteOverride?: TrapPaletteSpec;
  uiOverride?: Partial<TrapUIText>;
  starterBlocksOverride?: TrapStarterBlocks;
  axes?: TrapAxes;
  state?: TrapInstanceState;
  attempts?: number;
  maxAttempts?: number;
  disabledUntilMs?: number;
  failCooldownMs?: number;
}

let _trapInstanceSeq = 0;

export function makeTrapInstanceId(specId: string, seed: number): string {
  _trapInstanceSeq = (_trapInstanceSeq + 1) | 0;
  const base = String(specId || "trap").replace(/[^a-zA-Z0-9_]+/g, "_");
  return `${base}_${seed | 0}_${_trapInstanceSeq | 0}`;
}

export function createTrapInstance(args: {
  spec: TrapSpec;
  seed: number;
  inputs: Record<string, unknown>;
  expectedOutput?: unknown;
  outputContract?: TrapOutputContract;
  paletteOverride?: TrapPaletteSpec;
  uiOverride?: Partial<TrapUIText>;
  starterBlocksOverride?: TrapStarterBlocks;
  axes?: TrapAxes;
  attempts?: number;
  maxAttempts?: number;
  disabledUntilMs?: number;
  failCooldownMs?: number;
}): TrapInstance {
  return {
    instanceId: makeTrapInstanceId(args.spec.id, args.seed | 0),
    specId: args.spec.id,
    specVersion: args.spec.version | 0,
    kind: args.spec.kind,
    seed: args.seed | 0,
    inputs: { ...(args.inputs || {}) },
    expectedOutput: args.expectedOutput,
    outputContract: args.outputContract,
    paletteOverride: args.paletteOverride,
    uiOverride: args.uiOverride,
    starterBlocksOverride: args.starterBlocksOverride,
    axes: args.axes,
    state: "fresh",
    attempts: args.attempts == null ? 0 : (args.attempts | 0),
    maxAttempts: args.maxAttempts == null ? 10 : (args.maxAttempts | 0),
    disabledUntilMs: args.disabledUntilMs == null ? 0 : (args.disabledUntilMs | 0),
    failCooldownMs: args.failCooldownMs == null ? 0 : (args.failCooldownMs | 0),
  };
}

export function resolveTrapSpecForInstance(spec: TrapSpec, instance: TrapInstance): TrapSpec {
  const next: TrapSpec = {
    ...spec,
    palette: spec.palette ? { ...spec.palette } : spec.palette,
    output: spec.output ? { ...spec.output } : spec.output,
    ui: spec.ui ? { ...spec.ui } : spec.ui,
    validator: spec.validator ? { ...spec.validator } : spec.validator,
    starterBlocks: spec.starterBlocks ? { ...spec.starterBlocks } : spec.starterBlocks,
  };

  if (instance.outputContract) {
    next.output = { ...instance.outputContract };
    if (next.validator) next.validator.outputContract = { ...instance.outputContract };
  }

  if (instance.paletteOverride) {
    next.palette = { ...next.palette, ...instance.paletteOverride };
  }

  if (instance.uiOverride) {
    next.ui = { ...next.ui, ...instance.uiOverride };
  }

  if (instance.starterBlocksOverride) {
    next.starterBlocks = instance.starterBlocksOverride;
  }

  if (instance.expectedOutput !== undefined && next.validator) {
    next.validator.expectedOutput = instance.expectedOutput;
    next.validator.expectedOutputFromInputs = undefined;
  }

  return next;
}
