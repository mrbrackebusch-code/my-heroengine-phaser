import * as Blockly from "blockly";
import { tryRunBlocklyHeroLogic } from "./blocklyHeroLogicRuntime";

export type TowerTrialRequirementId =
  | "noHardcodedTraits"
  | "noRepeatPerButton"
  | "dynamicFamilyOneButton"
  | "noSingleEnemyBlocks"
  | "capOnlyFunctions";

export type TowerTrialIssueKind = "code" | "execution" | "mismatch";

export type TowerTrialIssue = {
  requirementId: TowerTrialRequirementId | "invalidOutput";
  kind: TowerTrialIssueKind;
  message: string;
  button?: string;
  trait?: string;
  blockType?: string;
};

export type TowerTrialRequirementSet = {
  ids: TowerTrialRequirementId[];
  minPressesPerButton: number;
  needsPhases: boolean;
};

export type TowerTrialSimResult = {
  ok: boolean;
  issues: TowerTrialIssue[];
  predictedRepeatButtons: string[];
  dynamicFamilyButtons: string[];
};

export const TOWER_TRIAL_BUTTONS: string[] = ["A", "B", "A+B", "R"];

const ENTRY_BY_BUTTON: Record<string, string> = {
  "A": "he_on_button_a",
  "B": "he_on_button_b",
  "A+B": "he_on_button_ab",
  "R": "he_on_button_r",
};

const BUTTON_LABEL: Record<string, string> = {
  "A": "Q",
  "B": "W",
  "A+B": "E",
  "R": "R",
};

const TRAIT_INPUTS: Array<{ input: string; label: string }> = [
  { input: "DAMAGE", label: "damage" },
  { input: "REACH", label: "reach" },
  { input: "TIME", label: "time" },
  { input: "STATUS", label: "status" },
];

const BANNED_SINGLE_ENEMY_BLOCKS = new Set<string>([
  "he_ro_closest_enemy_field",
  "he_ro_enemy_field",
  "he_ro_enemy_hp_at",
  "he_ro_enemy_dist_at",
  "he_ro_weakest_enemy_index",
]);

const CAP_ALLOWED_BLOCKS = new Set<string>([
  "procedures_callreturn",
  "procedures_callnoreturn",
  "he_return_move",
]);

export function towerTrialButtonLabel(button: string): string {
  return BUTTON_LABEL[button] || String(button || "");
}

export function towerTrialRequirementSetForFloor(floorIndex: number): TowerTrialRequirementSet {
  const floor = floorIndex | 0;
  const ids: TowerTrialRequirementId[] = [];

  if (floor >= 5 && floor <= 10) ids.push("noHardcodedTraits");
  if (floor >= 11 && floor <= 15) ids.push("noRepeatPerButton");
  if (floor >= 16 && floor <= 20) ids.push("dynamicFamilyOneButton");
  if (floor >= 21 && floor <= 25) ids.push("noSingleEnemyBlocks");
  if (floor >= 26 && floor <= 30) ids.push("capOnlyFunctions");

  const minPressesPerButton = ids.includes("noRepeatPerButton") ? 2 : 1;
  const needsPhases = ids.includes("dynamicFamilyOneButton");

  return { ids, minPressesPerButton, needsPhases };
}

export function towerTrialShouldRequireTrial(floorIndex: number): boolean {
  return towerTrialRequirementSetForFloor(floorIndex).ids.length > 0;
}

function _buildWorkspaceFromXml(xmlText: string): Blockly.Workspace {
  const ws = new (Blockly as any).Workspace();
  const uxml = (Blockly as any)?.utils?.xml;
  const dom = uxml?.textToDom?.(xmlText) || (Blockly as any).Xml?.textToDom?.(xmlText);
  if (!dom) return ws;
  (Blockly as any).Xml?.domToWorkspace?.(dom, ws);
  return ws;
}

function _collectBlockTypes(ws: Blockly.Workspace): Set<string> {
  const types = new Set<string>();
  const blocks = ws.getAllBlocks(false) || [];
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i]?.type;
    if (t) types.add(String(t));
  }
  return types;
}

function _findEntryBlocks(ws: Blockly.Workspace): Record<string, Blockly.Block | null> {
  const out: Record<string, Blockly.Block | null> = { "A": null, "B": null, "A+B": null, "R": null };
  const blocks = ws.getAllBlocks(false) || [];
  for (let i = 0; i < blocks.length; i++) {
    const b: any = blocks[i];
    const type = String(b?.type || "");
    if (type === ENTRY_BY_BUTTON.A) out["A"] = b;
    if (type === ENTRY_BY_BUTTON.B) out["B"] = b;
    if (type === ENTRY_BY_BUTTON["A+B"]) out["A+B"] = b;
    if (type === ENTRY_BY_BUTTON.R) out["R"] = b;
  }
  return out;
}

function _findReturnBlock(entry: Blockly.Block | null): Blockly.Block | null {
  if (!entry) return null;
  const head = (entry as any).getInputTargetBlock?.("DO") || null;
  let cur: any = head;
  while (cur) {
    if (cur.type === "he_return_move") return cur;
    cur = cur.getNextBlock?.();
  }
  return null;
}

function _exprHasDynamicSource(block: Blockly.Block | null, visited: Set<string>): boolean {
  if (!block) return false;
  const id = (block as any).id;
  if (id && visited.has(id)) return false;
  if (id) visited.add(id);

  const type = String((block as any).type || "");
  if (type.startsWith("he_ro_")) return true;
  if (type.startsWith("variables_get")) return true;
  if (type.startsWith("procedures_call")) return true;

  const inputs = (block as any).inputList || [];
  for (let i = 0; i < inputs.length; i++) {
    const target = inputs[i]?.connection?.targetBlock?.() || null;
    if (_exprHasDynamicSource(target, visited)) return true;
  }
  return false;
}

function _checkNoHardcodedTraits(ws: Blockly.Workspace, issues: TowerTrialIssue[]): void {
  const entries = _findEntryBlocks(ws);
  const buttons = Object.keys(entries);
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const entry = entries[button];
    const ret = _findReturnBlock(entry);
    if (!ret) {
      issues.push({
        requirementId: "noHardcodedTraits",
        kind: "code",
        button,
        message: `${towerTrialButtonLabel(button)}: Return Move block missing.`,
      });
      continue;
    }

    for (let j = 0; j < TRAIT_INPUTS.length; j++) {
      const inputName = TRAIT_INPUTS[j].input;
      const label = TRAIT_INPUTS[j].label;
      const target = (ret as any).getInputTargetBlock?.(inputName) || null;
      if (!target) {
        issues.push({
          requirementId: "noHardcodedTraits",
          kind: "code",
          button,
          trait: label,
          message: `${towerTrialButtonLabel(button)}: ${label} must use a variable or sensor.`,
        });
        continue;
      }
      const hasDynamic = _exprHasDynamicSource(target, new Set<string>());
      if (!hasDynamic) {
        issues.push({
          requirementId: "noHardcodedTraits",
          kind: "code",
          button,
          trait: label,
          message: `${towerTrialButtonLabel(button)}: ${label} must use a variable or sensor.`,
        });
      }
    }
  }
}

function _checkNoSingleEnemyBlocks(ws: Blockly.Workspace, issues: TowerTrialIssue[]): void {
  const types = _collectBlockTypes(ws);
  types.forEach((t) => {
    if (BANNED_SINGLE_ENEMY_BLOCKS.has(t)) {
      issues.push({
        requirementId: "noSingleEnemyBlocks",
        kind: "code",
        blockType: t,
        message: `Block not allowed in this trial: ${t}.`,
      });
    }
  });
}

function _checkCapOnlyFunctions(ws: Blockly.Workspace, issues: TowerTrialIssue[]): void {
  const entries = _findEntryBlocks(ws);
  const buttons = Object.keys(entries);
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const entry = entries[button];
    if (!entry) continue;
    let cur: any = (entry as any).getInputTargetBlock?.("DO") || null;
    while (cur) {
      const type = String(cur.type || "");
      if (!CAP_ALLOWED_BLOCKS.has(type)) {
        issues.push({
          requirementId: "capOnlyFunctions",
          kind: "code",
          button,
          blockType: type,
          message: `${towerTrialButtonLabel(button)}: Only function calls and Return Move are allowed.`,
        });
        break;
      }
      if (type === "he_return_move") break;
      cur = cur.getNextBlock?.();
    }
  }
}

function _normalizeFamily(val: any): string {
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "strength" || s === "0") return "strength";
    if (s === "agility" || s === "1") return "agility";
    if (s === "intellect" || s === "intelligence" || s === "2") return "intelligence";
    if (s === "wisdom" || s === "support" || s === "heal" || s === "3") return "wisdom";
    return s;
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    const n = val | 0;
    if (n === 0) return "strength";
    if (n === 1) return "agility";
    if (n === 2) return "intelligence";
    if (n === 3) return "wisdom";
    return String(n);
  }
  return String(val ?? "");
}

function _normalizeElement(val: any): string {
  if (typeof val === "string") {
    return val.trim().toLowerCase();
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    return String(val | 0);
  }
  return String(val ?? "");
}

function _normalizeAnim(val: any): string {
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "a") return "A";
    if (s === "b") return "B";
    if (s === "ab" || s === "a+b") return "A+B";
    if (s === "r") return "R";
    return s.toUpperCase();
  }
  if (typeof val === "number" && Number.isFinite(val)) return String(val | 0);
  return String(val ?? "");
}

function _normalizeOut(out: any[] | null): any[] | null {
  if (!out || !Array.isArray(out) || out.length < 7) return null;
  const family = _normalizeFamily(out[0]);
  const t1 = Number(out[1] ?? 0);
  const t2 = Number(out[2] ?? 0);
  const t3 = Number(out[3] ?? 0);
  const t4 = Number(out[4] ?? 0);
  const element = _normalizeElement(out[5]);
  const anim = _normalizeAnim(out[6]);
  return [family, t1, t2, t3, t4, element, anim];
}

function _outputsEqual(a: any[] | null, b: any[] | null): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

type TrialScenario = {
  heroX: number;
  heroY: number;
  enemies: Array<{ x: number; y: number; hp: number; maxHp: number; mana: number; maxMana: number; dmg: number }>;
};

const TRIAL_SCENARIOS: TrialScenario[] = [
  {
    heroX: 0,
    heroY: 0,
    enemies: [
      { x: 60, y: 0, hp: 45, maxHp: 45, mana: 0, maxMana: 0, dmg: 6 },
      { x: 180, y: 0, hp: 20, maxHp: 20, mana: 0, maxMana: 0, dmg: 4 },
    ],
  },
  {
    heroX: 0,
    heroY: 0,
    enemies: [
      { x: 200, y: 0, hp: 20, maxHp: 20, mana: 0, maxMana: 0, dmg: 6 },
      { x: 40, y: 0, hp: 45, maxHp: 45, mana: 0, maxMana: 0, dmg: 4 },
    ],
  },
];

function _makeReadonlyCtx(profileKey: string, scenario: TrialScenario): any {
  const enemyX: number[] = [];
  const enemyY: number[] = [];
  const enemyHp: number[] = [];
  const enemyDistSq: number[] = [];
  const enemies: any[] = [];

  for (let i = 0; i < scenario.enemies.length; i++) {
    const e = scenario.enemies[i];
    enemyX.push(e.x | 0);
    enemyY.push(e.y | 0);
    enemyHp.push(e.hp | 0);
    const dx = (e.x - scenario.heroX);
    const dy = (e.y - scenario.heroY);
    enemyDistSq.push(Math.round(dx * dx + dy * dy));
    enemies.push({
      hp: e.hp | 0,
      maxHp: e.maxHp | 0,
      mana: e.mana | 0,
      maxMana: e.maxMana | 0,
      x: e.x | 0,
      y: e.y | 0,
      vx: 0,
      vy: 0,
      dmg: e.dmg | 0,
      distSq: Math.round(dx * dx + dy * dy),
    });
  }

  return {
    heroIndex: 0,
    meX: scenario.heroX | 0,
    meY: scenario.heroY | 0,
    meHp: 100,
    meMp: 100,
    meLvl: 1,
    enemyCount: enemies.length | 0,
    enemyX,
    enemyY,
    enemyHp,
    enemyDistSq,
    heroCount: 1,
    heroX: [scenario.heroX | 0],
    heroY: [scenario.heroY | 0],
    heroHp: [100],
    heroLvl: [1],
    heroes: [{ hp: 100, maxHp: 100, mana: 100, maxMana: 100, lvl: 1, x: scenario.heroX | 0, y: scenario.heroY | 0, vx: 0, vy: 0, dmg: 0 }],
    relicIds: [],
    weaponIds: [],
    weaponBonuses: [],
    enemies,
    profileKey: String(profileKey || ""),
  };
}

function _runWithRo(profileKey: string, xmlText: string, button: string, ro: any): any[] | null {
  const g: any = globalThis as any;
  if (!g.__heBlocklyXmlByProfile) g.__heBlocklyXmlByProfile = {};
  if (xmlText && profileKey) g.__heBlocklyXmlByProfile[profileKey] = xmlText;
  const prevRo = g.__heBlocklyRO;
  try {
    g.__heBlocklyRO = ro;
    return tryRunBlocklyHeroLogic(profileKey, button) as any[] | null;
  } finally {
    g.__heBlocklyRO = prevRo;
  }
}

export function towerTrialSimulateProfile(profileKey: string, xmlText: string, floorIndex: number): TowerTrialSimResult {
  const reqSet = towerTrialRequirementSetForFloor(floorIndex);
  const issues: TowerTrialIssue[] = [];
  const predictedRepeatButtons: string[] = [];
  const dynamicFamilyButtons: string[] = [];

  if (!xmlText || !xmlText.trim()) {
    issues.push({
      requirementId: "invalidOutput",
      kind: "code",
      message: "No Blockly XML found for this profile.",
    });
    return { ok: false, issues, predictedRepeatButtons, dynamicFamilyButtons };
  }

  if (reqSet.ids.includes("noHardcodedTraits") || reqSet.ids.includes("noSingleEnemyBlocks") || reqSet.ids.includes("capOnlyFunctions")) {
    const ws = _buildWorkspaceFromXml(xmlText);
    if (reqSet.ids.includes("noHardcodedTraits")) _checkNoHardcodedTraits(ws, issues);
    if (reqSet.ids.includes("noSingleEnemyBlocks")) _checkNoSingleEnemyBlocks(ws, issues);
    if (reqSet.ids.includes("capOnlyFunctions")) _checkCapOnlyFunctions(ws, issues);
  }

  const needRepeat = reqSet.ids.includes("noRepeatPerButton");
  const needDynamicFamily = reqSet.ids.includes("dynamicFamilyOneButton");

  if (needRepeat || needDynamicFamily) {
    const ro0 = _makeReadonlyCtx(profileKey, TRIAL_SCENARIOS[0]);
    const ro1 = _makeReadonlyCtx(profileKey, TRIAL_SCENARIOS[1]);

    for (let i = 0; i < TOWER_TRIAL_BUTTONS.length; i++) {
      const button = TOWER_TRIAL_BUTTONS[i];
      const out0 = _normalizeOut(_runWithRo(profileKey, xmlText, button, ro0));
      const out1 = _normalizeOut(_runWithRo(profileKey, xmlText, button, ro1));
      const out0b = _normalizeOut(_runWithRo(profileKey, xmlText, button, ro0));

      if (!out0 || !out1) {
        issues.push({
          requirementId: "invalidOutput",
          kind: "code",
          button,
          message: `${towerTrialButtonLabel(button)}: Move output invalid in trial sim.`,
        });
        continue;
      }

      if (needRepeat && _outputsEqual(out0, out0b)) {
        predictedRepeatButtons.push(button);
        issues.push({
          requirementId: "noRepeatPerButton",
          kind: "code",
          button,
          message: `${towerTrialButtonLabel(button)} repeats the same move twice in a row.`,
        });
      }

      if (needDynamicFamily && out0[0] !== out1[0]) {
        dynamicFamilyButtons.push(button);
      }
    }

    if (needDynamicFamily && dynamicFamilyButtons.length === 0) {
      issues.push({
        requirementId: "dynamicFamilyOneButton",
        kind: "code",
        message: "At least one button must change family across trial phases.",
      });
    }
  }

  return { ok: issues.length === 0, issues, predictedRepeatButtons, dynamicFamilyButtons };
}
