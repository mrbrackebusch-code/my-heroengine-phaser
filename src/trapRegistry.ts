import type { TrapKind, TrapSpec } from "./trapSchema";
import type { TrapInstance, TrapInstanceState } from "./trapInstances";
import { createTrapInstance } from "./trapInstances";
import { generateTrapInstanceById } from "./trapGenerator";
import {
  BROKEN_NUMBER_TRAP_ID,
  DISASSEMBLED_NUMBER_TRAP_ID,
  SHRINE_TRAP_ID,
  UNTARGETED_LIST_TRAP_ID,
  UNTARGETED_NUMBER_TRAP_ID,
  UNTARGETED_STRING_TRAP_ID,
  getTrapSpecById,
} from "./trapSpecs";
import {
  DEBUG_TRAP_DUMP_INSTANCE,
  DEBUG_TRAP_FORCE_ID,
  DEBUG_TRAP_FORCE_KIND,
  DEBUG_TRAP_FORCE_SEED,
  DEBUG_TRAP_LOGS,
} from "./debugFlags";

export type TrapSeedPolicy = "perProp" | "perInteract" | "fixed";

export interface TrapDefinition {
  propBase: string;
  trapId: string;
  kind?: TrapKind;
  seedPolicy?: TrapSeedPolicy;
  fixedSeed?: number;
  minFloor?: number;
  maxFloor?: number;
  weight?: number;
  spawnable?: boolean;
  maxAttempts?: number;
  failCooldownMs?: number;
}

const TRAP_PROP_SEED_KEY = "trapSeed";
const TRAP_SEED_MAX = 1000000;
const TRAP_KEY_DATA = "trapKey";
const TRAP_DEFAULT_MAX_ATTEMPTS = 10;
const FLOOR1_TRAP_SPAWN_CHANCE = 0.99;

const DEFAULT_TRAP_ID_BY_KIND: Partial<Record<TrapKind, string>> = {
  Disassembled: DISASSEMBLED_NUMBER_TRAP_ID,
  Broken: BROKEN_NUMBER_TRAP_ID,
  Untargeted: UNTARGETED_NUMBER_TRAP_ID,
};

const _trapDefsByProp: Record<string, TrapDefinition[]> = {
  fire_totem: [
    {
      propBase: "fire_totem",
      trapId: BROKEN_NUMBER_TRAP_ID,
      kind: "Broken",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 1,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
    {
      propBase: "fire_totem",
      trapId: DISASSEMBLED_NUMBER_TRAP_ID,
      kind: "Disassembled",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 1,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
    {
      propBase: "fire_totem",
      trapId: UNTARGETED_NUMBER_TRAP_ID,
      kind: "Untargeted",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 33,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
    {
      propBase: "fire_totem",
      trapId: UNTARGETED_STRING_TRAP_ID,
      kind: "Untargeted",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 33,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
    {
      propBase: "fire_totem",
      trapId: UNTARGETED_LIST_TRAP_ID,
      kind: "Untargeted",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 32,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
  ],
  shrine: [
    {
      propBase: "shrine",
      trapId: SHRINE_TRAP_ID,
      kind: "Dormant",
      seedPolicy: "perProp",
      minFloor: 0,
      maxFloor: 100,
      weight: 1,
      spawnable: false,
      maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
    },
  ],
};

const _trapInstancesById = new Map<string, TrapInstance>();
const _trapInstancesByKey = new Map<string, TrapInstance>();
const _trapSeedByKey = new Map<string, number>();

function _randSeed(): number {
  return 1 + Math.floor(Math.random() * (TRAP_SEED_MAX | 0));
}

function _rngFromSeed(seed: number): () => number {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function _resolveTrapId(def: TrapDefinition): string {
  const forcedId = String(DEBUG_TRAP_FORCE_ID || "").trim();
  if (forcedId) return forcedId;
  const forcedKind = String(DEBUG_TRAP_FORCE_KIND || "").trim();
  if (forcedKind) {
    const id = DEFAULT_TRAP_ID_BY_KIND[forcedKind as TrapKind];
    if (id) return id;
  }
  return def.trapId;
}

function _getOrCreateSeedForKey(key: string, target: Sprite | null): number {
  if (!key) return _randSeed() | 0;
  let seed = _trapSeedByKey.get(key) || 0;
  if (seed <= 0) {
    seed = _randSeed() | 0;
    _trapSeedByKey.set(key, seed | 0);
    if (target) sprites.setDataNumber(target, TRAP_PROP_SEED_KEY, seed | 0);
  }
  return seed | 0;
}

function _resolveSeed(def: TrapDefinition, target: Sprite | null, key: string): number {
  const forced = DEBUG_TRAP_FORCE_SEED | 0;
  if (forced > 0) return forced | 0;

  const policy = def.seedPolicy || "perProp";
  if (policy === "fixed") {
    return (def.fixedSeed && def.fixedSeed > 0) ? (def.fixedSeed | 0) : 1;
  }

  if (policy === "perInteract") {
    return _randSeed() | 0;
  }

  return _getOrCreateSeedForKey(key, target);
}

function _buildFallbackInstance(spec: TrapSpec, seed: number): TrapInstance {
  const inputs = spec.preview?.inputs ? { ...spec.preview.inputs } : {};
  let expected = undefined as unknown;
  if (typeof spec.validator.expectedOutputFromInputs === "function") {
    expected = spec.validator.expectedOutputFromInputs(inputs);
  } else if (Object.prototype.hasOwnProperty.call(spec.validator, "expectedOutput")) {
    expected = spec.validator.expectedOutput;
  }
  return createTrapInstance({
    spec,
    seed: seed | 0,
    inputs,
    expectedOutput: expected,
    outputContract: spec.output,
    maxAttempts: TRAP_DEFAULT_MAX_ATTEMPTS,
  });
}

function _makeTrapKey(floorIndex: number, baseName: string, tileR: number, tileC: number): string {
  const base = String(baseName || "").trim();
  return `${floorIndex | 0}:${base}:${tileR | 0}:${tileC | 0}`;
}

function _getTileFromTarget(target: Sprite | null): { r: number; c: number } {
  if (!target) return { r: -1, c: -1 };
  const r = sprites.readDataNumber(target, "decorTileR") | 0;
  const c = sprites.readDataNumber(target, "decorTileC") | 0;
  return { r, c };
}

function _storeInstanceByKey(key: string, instance: TrapInstance): void {
  if (!key) return;
  _trapInstancesByKey.set(key, instance);
}

function _listTrapDefsForProp(baseName: string): TrapDefinition[] {
  const key = String(baseName || "").trim();
  if (!key) return [];
  return _trapDefsByProp[key] || [];
}

function _pickTrapDefForProp(
  baseName: string,
  floorIndex: number,
  key: string,
  target: Sprite | null
): TrapDefinition | null {
  const list = _filterTrapDefsForFloor(_listTrapDefsForProp(baseName), floorIndex | 0);
  if (!list.length) return null;
  const forcedSeed = DEBUG_TRAP_FORCE_SEED | 0;
  const seed = forcedSeed > 0 ? (forcedSeed | 0) : _getOrCreateSeedForKey(key, target);
  const rng = _rngFromSeed(seed | 0);
  return _pickTrapDefByWeightForFloor(list, floorIndex | 0, rng) || list[0];
}

function _filterTrapDefsForFloor(list: TrapDefinition[], floorIndex: number): TrapDefinition[] {
  const idx = floorIndex | 0;
  const out: TrapDefinition[] = [];
  for (let i = 0; i < list.length; i++) {
    const def = list[i];
    if (!def) continue;
    const min = def.minFloor == null ? -999999 : (def.minFloor | 0);
    const max = def.maxFloor == null ? 999999 : (def.maxFloor | 0);
    if (idx < min || idx > max) continue;
    out.push(def);
  }
  return out;
}

function _pickTrapDefByWeight(list: TrapDefinition[], rng: () => number): TrapDefinition | null {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  let total = 0;
  for (let i = 0; i < list.length; i++) total += (list[i].weight == null ? 1 : (list[i].weight | 0));
  const roll = rng() * (total || 1);
  let acc = 0;
  for (let i = 0; i < list.length; i++) {
    acc += (list[i].weight == null ? 1 : (list[i].weight | 0));
    if (roll <= acc) return list[i];
  }
  return list[0];
}

function _pickTrapDefByWeightForFloor(
  list: TrapDefinition[],
  _floorIndex: number,
  rng: () => number
): TrapDefinition | null {
  if (!list.length) return null;
  return _pickTrapDefByWeight(list, rng);
}

export function canAttemptTrapInstance(instance: TrapInstance, nowMs: number): boolean {
  if (!instance) return false;
  const disabledUntil = instance.disabledUntilMs | 0;
  if (disabledUntil > 0 && (nowMs | 0) < disabledUntil) return false;
  const maxAttempts = instance.maxAttempts | 0;
  if (maxAttempts > 0 && (instance.attempts | 0) >= maxAttempts) return false;
  if (instance.state === "solved") return false;
  return true;
}

export function recordTrapAttempt(instanceId: string, ok: boolean, nowMs: number): {
  attempts: number;
  maxAttempts: number;
  locked: boolean;
  disabledUntilMs: number;
} | null {
  const key = String(instanceId || "").trim();
  if (!key) return null;
  const inst = _trapInstancesById.get(key);
  if (!inst) return null;
  if (ok) {
    return {
      attempts: inst.attempts | 0,
      maxAttempts: inst.maxAttempts | 0,
      locked: false,
      disabledUntilMs: inst.disabledUntilMs | 0,
    };
  }
  inst.attempts = ((inst.attempts | 0) + 1) | 0;
  const maxAttempts = inst.maxAttempts | 0;
  let locked = false;
  if (maxAttempts > 0 && (inst.attempts | 0) >= maxAttempts) {
    inst.state = "failed";
    const cooldown = inst.failCooldownMs | 0;
    if (cooldown > 0) inst.disabledUntilMs = ((nowMs | 0) + cooldown) | 0;
    locked = true;
  }
  return {
    attempts: inst.attempts | 0,
    maxAttempts: inst.maxAttempts | 0,
    locked,
    disabledUntilMs: inst.disabledUntilMs | 0,
  };
}

export function registerTrapPropSpawn(
  baseName: string,
  floorIndex: number,
  tileR: number,
  tileC: number,
  target: Sprite | null,
  defOverride?: TrapDefinition | null
): TrapInstance | null {
  const key = _makeTrapKey(floorIndex | 0, baseName, tileR | 0, tileC | 0);
  if (key && _trapInstancesByKey.has(key)) {
    const inst = _trapInstancesByKey.get(key) || null;
    if (inst && target) {
      sprites.setDataString(target, TRAP_KEY_DATA, key);
      const seed = _trapSeedByKey.get(key) || 0;
      if (seed > 0) sprites.setDataNumber(target, TRAP_PROP_SEED_KEY, seed | 0);
    }
    return inst;
  }

  const def = defOverride || _pickTrapDefForProp(baseName, floorIndex | 0, key, target);
  if (!def) return null;

  const trapId = _resolveTrapId(def);
  const spec = getTrapSpecById(trapId);
  if (!spec) {
    if (DEBUG_TRAP_LOGS) console.log("[TRAP][REGISTRY] missing spec", { trapId });
    return null;
  }

  const seed = _resolveSeed(def, target, key);
  let instance = generateTrapInstanceById(trapId, seed | 0);
  if (!instance) {
    instance = _buildFallbackInstance(spec, seed | 0);
  }

  instance.state = "fresh";
  instance.maxAttempts = (def.maxAttempts == null ? TRAP_DEFAULT_MAX_ATTEMPTS : (def.maxAttempts | 0)) | 0;
  instance.failCooldownMs = (def.failCooldownMs == null ? 0 : (def.failCooldownMs | 0));
  _trapInstancesById.set(instance.instanceId, instance);
  if (key) {
    _storeInstanceByKey(key, instance);
    if (target) sprites.setDataString(target, TRAP_KEY_DATA, key);
  }

  if (DEBUG_TRAP_DUMP_INSTANCE) {
    console.log("[TRAP][REGISTRY] instance", {
      trapId: instance.specId,
      instanceId: instance.instanceId,
      seed: instance.seed | 0,
      inputs: instance.inputs,
      expected: instance.expectedOutput,
      axes: instance.axes || null,
    });
  }

  return instance;
}

export function registerTrapDefinition(def: TrapDefinition): void {
  const key = String(def.propBase || "").trim();
  if (!key) return;
  const list = _trapDefsByProp[key] || [];
  list.push({ ...def, propBase: key });
  _trapDefsByProp[key] = list;
}

export function getTrapDefinitionForProp(baseName: string): TrapDefinition | null {
  const key = String(baseName || "").trim();
  if (!key) return null;
  const list = _trapDefsByProp[key] || [];
  return list.length ? list[0] : null;
}

export function spawnTrapInstanceForProp(baseName: string, target: Sprite | null, floorIndex?: number): TrapInstance | null {
  const idx = floorIndex == null ? 0 : (floorIndex | 0);
  const { r, c } = _getTileFromTarget(target);
  const key = _makeTrapKey(idx | 0, baseName, r | 0, c | 0);
  const def = _pickTrapDefForProp(baseName, idx | 0, key, target);
  if (!def) return null;

  const policy = def.seedPolicy || "perProp";
  if (policy !== "perInteract") {
    return registerTrapPropSpawn(baseName, idx | 0, r | 0, c | 0, target, def);
  }

  const trapId = _resolveTrapId(def);
  const spec = getTrapSpecById(trapId);
  if (!spec) {
    if (DEBUG_TRAP_LOGS) console.log("[TRAP][REGISTRY] missing spec", { trapId });
    return null;
  }

  const seed = _resolveSeed(def, target, "");
  let instance = generateTrapInstanceById(trapId, seed | 0);
  if (!instance) {
    instance = _buildFallbackInstance(spec, seed | 0);
    if (DEBUG_TRAP_LOGS) console.log("[TRAP][REGISTRY] fallback instance", { trapId, seed: seed | 0 });
  }

  instance.state = "fresh";
  instance.maxAttempts = (def.maxAttempts == null ? TRAP_DEFAULT_MAX_ATTEMPTS : (def.maxAttempts | 0)) | 0;
  instance.failCooldownMs = (def.failCooldownMs == null ? 0 : (def.failCooldownMs | 0));
  _trapInstancesById.set(instance.instanceId, instance);
  return instance;
}

export function getTrapInstance(instanceId: string): TrapInstance | null {
  return _trapInstancesById.get(String(instanceId || "")) || null;
}

export function setTrapInstanceState(instanceId: string, state: TrapInstanceState): void {
  const key = String(instanceId || "").trim();
  if (!key) return;
  const inst = _trapInstancesById.get(key);
  if (!inst) return;
  inst.state = state;
}

export function getTrapInstanceForTarget(baseName: string, target: Sprite | null, floorIndex: number): TrapInstance | null {
  if (!target) return null;
  const key = sprites.readDataString(target, TRAP_KEY_DATA) || "";
  if (key && _trapInstancesByKey.has(key)) return _trapInstancesByKey.get(key) || null;
  const rc = _getTileFromTarget(target);
  const nextKey = _makeTrapKey(floorIndex | 0, baseName, rc.r | 0, rc.c | 0);
  return _trapInstancesByKey.get(nextKey) || null;
}

export function listTrapDefinitionsForFloor(floorIndex: number): TrapDefinition[] {
  const idx = floorIndex | 0;
  const out: TrapDefinition[] = [];
  for (const key of Object.keys(_trapDefsByProp)) {
    const list = _trapDefsByProp[key] || [];
    if (!list.length) continue;
    const filtered = _filterTrapDefsForFloor(list, idx | 0).filter(def => def.spawnable !== false);
    for (let i = 0; i < filtered.length; i++) out.push(filtered[i]);
  }
  return out;
}

export function pickTrapDefinitionForFloor(floorIndex: number): TrapDefinition | null {
  const idx = floorIndex | 0;
  const list = listTrapDefinitionsForFloor(idx | 0);
  if (!list.length) return null;
  if (idx === 1 && Math.random() > FLOOR1_TRAP_SPAWN_CHANCE) return null;
  return _pickTrapDefByWeightForFloor(list, idx | 0, Math.random) || null;
}

export function resetAllTrapInstances(): void {
  _trapInstancesById.clear();
  _trapInstancesByKey.clear();
  _trapSeedByKey.clear();
}
