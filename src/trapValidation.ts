import type { ApCspType, TrapOutputContract } from "./trapSchema";

export interface TrapValidationResult {
  ok: boolean;
  errors: string[];
}

function _err(msg: string, errors: string[]): void {
  errors.push(msg);
}

function _validateNumberContract(contract: TrapOutputContract, value: unknown, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    _err("Expected Number output", errors);
    return;
  }
  const cfg = contract.number;
  if (cfg?.integerOnly && !Number.isInteger(value)) {
    _err("Expected Integer output", errors);
  }
  if (typeof cfg?.min === "number" && value < cfg.min) {
    _err("Number below minimum", errors);
  }
  if (typeof cfg?.max === "number" && value > cfg.max) {
    _err("Number above maximum", errors);
  }
  if (cfg?.allowedValues && cfg.allowedValues.length > 0) {
    if (!cfg.allowedValues.includes(value)) {
      _err("Number not in allowed set", errors);
    }
  }
}

function _validateStringContract(contract: TrapOutputContract, value: unknown, errors: string[]): void {
  if (typeof value !== "string") {
    _err("Expected String output", errors);
    return;
  }
  const cfg = contract.string;
  if (typeof cfg?.minLength === "number" && value.length < cfg.minLength) {
    _err("String shorter than minimum length", errors);
  }
  if (typeof cfg?.maxLength === "number" && value.length > cfg.maxLength) {
    _err("String longer than maximum length", errors);
  }
  if (cfg?.allowedValues && cfg.allowedValues.length > 0) {
    if (!cfg.allowedValues.includes(value)) {
      _err("String not in allowed set", errors);
    }
  }
}

function _validateCharacterContract(contract: TrapOutputContract, value: unknown, errors: string[]): void {
  if (typeof value !== "string" || value.length !== 1) {
    _err("Expected Character output", errors);
    return;
  }
  const cfg = contract.character;
  if (cfg?.allowedValues && cfg.allowedValues.length > 0) {
    if (!cfg.allowedValues.includes(value)) {
      _err("Character not in allowed set", errors);
    }
  }
}

function _validateBooleanContract(_contract: TrapOutputContract, value: unknown, errors: string[]): void {
  if (typeof value !== "boolean") {
    _err("Expected Boolean output", errors);
  }
}

function _validateListContract(contract: TrapOutputContract, value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    _err("Expected List output", errors);
    return;
  }
  const cfg = contract.list;
  if (typeof cfg?.length === "number" && value.length !== cfg.length) {
    _err("List length mismatch", errors);
  }
  if (cfg?.elementType) {
    for (let i = 0; i < value.length; i++) {
      _validateByType(cfg.elementType, cfg, value[i], errors);
    }
  }
  if (cfg?.positions && cfg.positions.length > 0) {
    for (let i = 0; i < cfg.positions.length; i++) {
      const pos = cfg.positions[i];
      const v = value[i];
      _validateByType(pos.type, pos, v, errors);
    }
  }
}

function _validateByType(type: ApCspType, contract: TrapOutputContract | any, value: unknown, errors: string[]): void {
  switch (type) {
    case "Number":
      _validateNumberContract(contract, value, errors);
      break;
    case "String":
      _validateStringContract(contract, value, errors);
      break;
    case "Character":
      _validateCharacterContract(contract, value, errors);
      break;
    case "Boolean":
      _validateBooleanContract(contract, value, errors);
      break;
    case "List":
      _validateListContract(contract, value, errors);
      break;
    default:
      _err("Unknown output type", errors);
      break;
  }
}

export function validateTrapOutput(contract: TrapOutputContract, value: unknown): TrapValidationResult {
  const errors: string[] = [];
  _validateByType(contract.type, contract, value, errors);
  return { ok: errors.length === 0, errors };
}

export function validateRequiredInputs(usedInputs: Set<string>, requiredInputs: string[]): TrapValidationResult {
  const errors: string[] = [];
  for (const name of requiredInputs) {
    if (!usedInputs.has(name)) errors.push(`Required input not used: ${name}`);
  }
  return { ok: errors.length === 0, errors };
}
