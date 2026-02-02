// Student Systems Hook Surface
//
// This is the ONLY approved import outside student folders:
//   import { ... } from "../../studentSystemsHooks";
//
// If a student needs a missing hook, they should:
// - Add a request to src/student/<Name>/HOOK_REQUESTS.md
// - Optionally call requestHook(...) below in their code
//
// Do NOT edit core files from student folders.

import { getPropSpec, registerPropSpec, type PropSpec } from "./propSpecs";
import { PROP_VISUALS_BY_NAME, registerPropVisual } from "./tileAtlas";

export * from "./studentSdk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type StudentProfileGate = {
    enabledProfiles?: string[];
    disabledProfiles?: string[];
};

export function isProfileAllowed(gate: StudentProfileGate | null | undefined, profileName: string): boolean {
    const name = String(profileName || "").trim();
    if (!gate) return true;
    const denied = gate.disabledProfiles || [];
    if (name && denied.includes(name)) return false;
    const allowed = gate.enabledProfiles || [];
    if (!allowed.length) return true;
    return name ? allowed.includes(name) : false;
}

function _registerInMap<T extends { id: string }>(map: Map<string, T>, def: T): string {
    const id = String(def?.id || "").trim();
    if (!id) return "";
    map.set(id, { ...def, id });
    return id;
}

function _listFromMap<T>(map: Map<string, T>): T[] {
    return Array.from(map.values());
}

function _normalizeMonsterId(raw: string): string {
    return String(raw || "").trim().toLowerCase().replace(/enemy$/i, "").trim();
}

function _clonePropSpec(base: PropSpec, name: string, action?: string): PropSpec {
    const collision = base.collision
        ? {
              ...base.collision,
              polygon: base.collision.polygon
                  ? { points: base.collision.polygon.points.map((p) => ({ ...p })) }
                  : undefined,
          }
        : undefined;
    const interact = base.interact ? { ...base.interact } : undefined;
    const placement = base.placement ? { ...base.placement } : undefined;
    const directions = base.directions
        ? { ...base.directions, statesByDir: base.directions.statesByDir ? { ...base.directions.statesByDir } : undefined }
        : undefined;

    const next: PropSpec = {
        ...base,
        name,
        collision,
        interact,
        placement,
        directions,
    };

    if (action) {
        next.interact = { ...(next.interact || {}), action };
    }

    return next;
}

// ---------------------------------------------------------------------------
// Shared data: NPCs, props, overlays, items, drops, harvestables
// ---------------------------------------------------------------------------

// Prefer NPC ids as <Name>NPC (ex: "ShopkeeperNPC", "SmithNPC").
export type StudentNpcDefinition = {
    id: string;
    name?: string;
    spriteKey?: string;
    portraitKey?: string;
    role?: string;
    tags?: string[];
    data?: any;
};

const _npcDefs = new Map<string, StudentNpcDefinition>();

export function registerStudentNpc(def: StudentNpcDefinition): string {
    return _registerInMap(_npcDefs, def);
}

export function listStudentNpcs(): StudentNpcDefinition[] {
    return _listFromMap(_npcDefs);
}

export function getStudentNpc(id: string): StudentNpcDefinition | null {
    const key = String(id || "").trim();
    if (!key) return null;
    return _npcDefs.get(key) || null;
}

export type StudentPropDefinition = {
    id: string;
    visualKey?: string;
    specKey?: string;
    interactAction?: string;
    tags?: string[];
    data?: any;
};

const _propDefs = new Map<string, StudentPropDefinition>();

export function registerStudentProp(def: StudentPropDefinition): string {
    const id = _registerInMap(_propDefs, def);
    if (id) {
        const stored = _propDefs.get(id);
        if (stored) _applyStudentPropDefinition(stored);
    }
    return id;
}

export function listStudentProps(): StudentPropDefinition[] {
    return _listFromMap(_propDefs);
}

export function getStudentProp(id: string): StudentPropDefinition | null {
    const key = String(id || "").trim();
    if (!key) return null;
    return _propDefs.get(key) || null;
}

export type StudentPropApplyResult = {
    visualsApplied: number;
    specsApplied: number;
    visualsMissing: number;
    specsMissing: number;
};

function _applyStudentPropDefinition(def: StudentPropDefinition): StudentPropApplyResult {
    const id = String(def?.id || "").trim();
    if (!id) {
        return { visualsApplied: 0, specsApplied: 0, visualsMissing: 0, specsMissing: 0 };
    }

    let visualsApplied = 0;
    let specsApplied = 0;
    let visualsMissing = 0;
    let specsMissing = 0;

    const explicitVisualKey = String(def.visualKey || "").trim();
    const resolvedVisualKey = explicitVisualKey || id;
    if (resolvedVisualKey) {
        const visual = PROP_VISUALS_BY_NAME[resolvedVisualKey];
        if (visual) {
            registerPropVisual(id, visual);
            visualsApplied++;
        } else if (explicitVisualKey) {
            visualsMissing++;
        }
    }

    const explicitSpecKey = String(def.specKey || "").trim();
    const resolvedSpecKey = explicitSpecKey || id;
    if (resolvedSpecKey) {
        const baseSpec = getPropSpec(resolvedSpecKey);
        if (baseSpec) {
            registerPropSpec(_clonePropSpec(baseSpec, id, def.interactAction));
            specsApplied++;
        } else if (explicitSpecKey) {
            specsMissing++;
        }
    }

    return { visualsApplied, specsApplied, visualsMissing, specsMissing };
}

export function applyStudentPropDefinitions(): StudentPropApplyResult {
    let visualsApplied = 0;
    let specsApplied = 0;
    let visualsMissing = 0;
    let specsMissing = 0;

    for (const def of _propDefs.values()) {
        const res = _applyStudentPropDefinition(def);
        visualsApplied += res.visualsApplied;
        specsApplied += res.specsApplied;
        visualsMissing += res.visualsMissing;
        specsMissing += res.specsMissing;
    }

    return { visualsApplied, specsApplied, visualsMissing, specsMissing };
}

export type StudentPropInteractPayload = {
    pid: number;
    hi: number;
    hero: any;
    target: any;
    action: string;
    name: string;
    base: string;
    now: number;
    prop?: StudentPropDefinition | null;
};

export type StudentNpcInteractPayload = {
    pid: number;
    hi: number;
    hero: any;
    target: any;
    action: string;
    npcId: string;
    now: number;
    npc?: StudentNpcDefinition | null;
};

export type StudentPropInteractHandler = (payload: StudentPropInteractPayload) => boolean | void;
export type StudentNpcInteractHandler = (payload: StudentNpcInteractPayload) => boolean | void;

const _propInteractHandlers: StudentPropInteractHandler[] = [];
const _npcInteractHandlers: StudentNpcInteractHandler[] = [];

export function registerStudentPropInteractHandler(handler: StudentPropInteractHandler): void {
    if (typeof handler !== "function") return;
    _propInteractHandlers.push(handler);
}

export function registerStudentNpcInteractHandler(handler: StudentNpcInteractHandler): void {
    if (typeof handler !== "function") return;
    _npcInteractHandlers.push(handler);
}

export function dispatchStudentPropInteract(payload: StudentPropInteractPayload): boolean {
    if (!payload) return false;
    let handled = false;
    const base = String(payload.base || "").trim();
    const callPayload = payload.prop ? payload : { ...payload, prop: base ? getStudentProp(base) : null };
    for (let i = 0; i < _propInteractHandlers.length; i++) {
        const handler = _propInteractHandlers[i];
        if (typeof handler !== "function") continue;
        try {
            if (handler(callPayload) === true) handled = true;
        } catch { /* ignore */ }
    }
    return handled;
}

export function dispatchStudentNpcInteract(payload: StudentNpcInteractPayload): boolean {
    if (!payload) return false;
    let handled = false;
    const id = String(payload.npcId || "").trim();
    const callPayload = payload.npc ? payload : { ...payload, npc: id ? getStudentNpc(id) : null };
    for (let i = 0; i < _npcInteractHandlers.length; i++) {
        const handler = _npcInteractHandlers[i];
        if (typeof handler !== "function") continue;
        try {
            if (handler(callPayload) === true) handled = true;
        } catch { /* ignore */ }
    }
    return handled;
}

export type StudentOverlayDefinition = {
    id: string;
    purpose?: string;
    mountId?: string;
    className?: string;
    blocksInput?: boolean;
    data?: any;
};

const _overlayDefs = new Map<string, StudentOverlayDefinition>();

export function registerStudentOverlay(def: StudentOverlayDefinition): string {
    return _registerInMap(_overlayDefs, def);
}

export function listStudentOverlays(): StudentOverlayDefinition[] {
    return _listFromMap(_overlayDefs);
}

export type StudentItemDefinition = {
    id: string;
    name?: string;
    iconKey?: string;
    data?: any;
};

export type ItemDef = StudentItemDefinition;

const _itemDefs = new Map<string, StudentItemDefinition>();

export function registerStudentItem(def: StudentItemDefinition): string {
    return _registerInMap(_itemDefs, def);
}

export function listStudentItems(): StudentItemDefinition[] {
    return _listFromMap(_itemDefs);
}

export function registerItem(def: StudentItemDefinition): string {
    return registerStudentItem(def);
}

export function listItems(): StudentItemDefinition[] {
    return listStudentItems();
}

export type StudentDropEntry = {
    itemId: string;
    weight: number;
    min?: number;
    max?: number;
};

export type DropEntry = StudentDropEntry;

export type StudentDropTable = {
    id: string;
    entries: StudentDropEntry[];
    notes?: string;
};

export type DropTable = StudentDropTable;

const _dropTables = new Map<string, StudentDropTable>();

export function registerStudentDropTable(def: StudentDropTable): string {
    return _registerInMap(_dropTables, def);
}

export function listStudentDropTables(): StudentDropTable[] {
    return _listFromMap(_dropTables);
}

export function registerDropTable(def: StudentDropTable): string {
    return registerStudentDropTable(def);
}

export function listDropTables(): StudentDropTable[] {
    return listStudentDropTables();
}

export type StudentMonsterDrop = {
    monsterId: string;
    dropTableId: string;
    chancePct?: number;
    minRolls?: number;
    maxRolls?: number;
    data?: any;
};

export type MonsterDrop = StudentMonsterDrop;

const _monsterDrops: StudentMonsterDrop[] = [];

export function registerStudentMonsterDrop(def: StudentMonsterDrop): string {
    const monsterId = _normalizeMonsterId(def?.monsterId || "");
    const dropTableId = String(def?.dropTableId || "").trim();
    if (!monsterId || !dropTableId) return "";
    _monsterDrops.push({
        ...def,
        monsterId,
        dropTableId,
    });
    return monsterId;
}

export function listStudentMonsterDrops(): StudentMonsterDrop[] {
    return _monsterDrops.slice();
}

export function registerMonsterDrop(def: StudentMonsterDrop): string {
    return registerStudentMonsterDrop(def);
}

export function listMonsterDrops(): StudentMonsterDrop[] {
    return listStudentMonsterDrops();
}

export type StudentHarvestable = {
    id: string;
    propId?: string;
    dropTableId?: string;
    harvestAnimId?: string;
    harvestVfxId?: string;
    cooldownMs?: number;
    data?: any;
};

export type Harvestable = StudentHarvestable;

const _harvestables = new Map<string, StudentHarvestable>();

export function registerStudentHarvestable(def: StudentHarvestable): string {
    return _registerInMap(_harvestables, def);
}

export function listStudentHarvestables(): StudentHarvestable[] {
    return _listFromMap(_harvestables);
}

export function registerHarvestable(def: StudentHarvestable): string {
    return registerStudentHarvestable(def);
}

export function listHarvestables(): StudentHarvestable[] {
    return listStudentHarvestables();
}

export type StudentMonsterDropContext = {
    now?: number;
    monsterId: string;
    dropTableId: string;
    drops: Array<{ itemId: string; count: number }>;
    x?: number;
    y?: number;
    killerHi?: number;
    eIndex?: number;
    enemy?: any;
    data?: any;
};

export type StudentDropHooks = StudentProfileGate & {
    onMonsterDrops?: (ctx: StudentMonsterDropContext) => void;
};

let _dropHooks: StudentDropHooks | null = null;

export function registerStudentDropHooks(hooks: StudentDropHooks): void {
    _dropHooks = { ...hooks };
}

export function getStudentDropHooks(): StudentDropHooks | null {
    return _dropHooks ? { ..._dropHooks } : null;
}

// ---------------------------------------------------------------------------
// Crafting system (Jason)
// ---------------------------------------------------------------------------

export type CraftingRecipe = {
    id: string;
    inputs: string[];
    outputs: string[];
    successText?: string;
    failText?: string;
    data?: any;
};

export type CraftingStation = {
    id: string;
    npcId?: string;
    propId?: string;
    overlayId?: string;
    recipeIds?: string[];
    data?: any;
};

export type CraftingHooks = StudentProfileGate & {
    // Called by core when crafting UI should open/close.
    onOpenMenu?: (ctx: any) => void;
    onCloseMenu?: (ctx: any) => void;
    // Called by core after a craft attempt is resolved.
    onCraftResult?: (ctx: any) => void;
};

const _craftingRecipes = new Map<string, CraftingRecipe>();
const _craftingStations = new Map<string, CraftingStation>();
let _craftingHooks: CraftingHooks | null = null;

export function registerCraftingRecipe(def: CraftingRecipe): string {
    return _registerInMap(_craftingRecipes, def);
}

export function listCraftingRecipes(): CraftingRecipe[] {
    return _listFromMap(_craftingRecipes);
}

export function registerCraftingStation(def: CraftingStation): string {
    return _registerInMap(_craftingStations, def);
}

export function listCraftingStations(): CraftingStation[] {
    return _listFromMap(_craftingStations);
}

export function registerCraftingHooks(hooks: CraftingHooks): void {
    _craftingHooks = { ...hooks };
}

export function getCraftingHooks(): CraftingHooks | null {
    return _craftingHooks ? { ..._craftingHooks } : null;
}

// ---------------------------------------------------------------------------
// Wisdom music system (Kyle)
// ---------------------------------------------------------------------------

export type WisdomMusicNote = {
    timeMs: number;
    lane: string;
    holdMs?: number;
    data?: any;
};

export type WisdomMusicSong = {
    id: string;
    title?: string;
    bpm?: number;
    notes?: WisdomMusicNote[];
    data?: any;
};

export type WisdomMusicHooks = StudentProfileGate & {
    // Called when a wisdom move is held long enough to enter music mode.
    onStartMode?: (ctx: any) => void;
    onStopMode?: (ctx: any) => void;
    // Return a song id (must be registered via registerWisdomMusicSong).
    getSongIdForMove?: (ctx: any) => string;
    // Return a scaling factor based on performance (0..1 or higher).
    scoreToScale?: (ctx: any, score: number) => number;
};

const _wisdomSongs = new Map<string, WisdomMusicSong>();
let _wisdomHooks: WisdomMusicHooks | null = null;

export function registerWisdomMusicSong(def: WisdomMusicSong): string {
    return _registerInMap(_wisdomSongs, def);
}

export function listWisdomMusicSongs(): WisdomMusicSong[] {
    return _listFromMap(_wisdomSongs);
}

export function registerWisdomMusicHooks(hooks: WisdomMusicHooks): void {
    _wisdomHooks = { ...hooks };
}

export function getWisdomMusicHooks(): WisdomMusicHooks | null {
    return _wisdomHooks ? { ..._wisdomHooks } : null;
}

// ---------------------------------------------------------------------------
// Dialogue system (Abraham)
// ---------------------------------------------------------------------------

export type DialogueChoice = {
    id: string;
    text: string;
    nextId?: string;
    data?: any;
};

export type DialogueLine = {
    id: string;
    speaker?: string;
    text: string;
    choices?: DialogueChoice[];
    nextId?: string;
    cameraCueId?: string;
    data?: any;
};

export type DialogueScript = {
    id: string;
    title?: string;
    lines: DialogueLine[];
    overlayId?: string;
    pauseGameplay?: boolean;
    data?: any;
};

export type DialogueTrigger = {
    id: string;
    kind: "npc" | "prop" | "auto" | "quest";
    targetId?: string;
    scriptId: string;
    once?: boolean;
    data?: any;
};

export type DialogueCameraCue = {
    id: string;
    x: number;
    y: number;
    zoom?: number;
    durationMs?: number;
    data?: any;
};

export type DialogueHooks = StudentProfileGate & {
    onStartScript?: (ctx: any, scriptId: string) => void;
    onEndScript?: (ctx: any, scriptId: string) => void;
};

const _dialogueScripts = new Map<string, DialogueScript>();
const _dialogueTriggers = new Map<string, DialogueTrigger>();
const _dialogueCues = new Map<string, DialogueCameraCue>();
let _dialogueHooks: DialogueHooks | null = null;

export function registerDialogueScript(def: DialogueScript): string {
    return _registerInMap(_dialogueScripts, def);
}

export function listDialogueScripts(): DialogueScript[] {
    return _listFromMap(_dialogueScripts);
}

export function registerDialogueTrigger(def: DialogueTrigger): string {
    return _registerInMap(_dialogueTriggers, def);
}

export function listDialogueTriggers(): DialogueTrigger[] {
    return _listFromMap(_dialogueTriggers);
}

export function registerDialogueCameraCue(def: DialogueCameraCue): string {
    return _registerInMap(_dialogueCues, def);
}

export function listDialogueCameraCues(): DialogueCameraCue[] {
    return _listFromMap(_dialogueCues);
}

export function registerDialogueHooks(hooks: DialogueHooks): void {
    _dialogueHooks = { ...hooks };
}

export function getDialogueHooks(): DialogueHooks | null {
    return _dialogueHooks ? { ..._dialogueHooks } : null;
}

// ---------------------------------------------------------------------------
// Quest system (ChrisP)
// ---------------------------------------------------------------------------

export type QuestObjective = {
    id: string;
    kind: "collect" | "craft" | "talk" | "visit" | "defeat" | "custom";
    targetId?: string;
    count?: number;
    data?: any;
};

export type QuestReward = {
    coins?: number;
    itemIds?: string[];
    relicId?: string;
    data?: any;
};

export type QuestDefinition = {
    id: string;
    title: string;
    description?: string;
    objectives: QuestObjective[];
    reward?: QuestReward;
    repeatable?: boolean;
    data?: any;
};

export type QuestSource = {
    id: string;
    kind: "npc" | "prop" | "random" | "auto";
    sourceId?: string;
    questIds: string[];
    data?: any;
};

export type QuestHooks = StudentProfileGate & {
    onQuestAccepted?: (ctx: any, questId: string) => void;
    onQuestCompleted?: (ctx: any, questId: string) => void;
};

const _questDefs = new Map<string, QuestDefinition>();
const _questSources = new Map<string, QuestSource>();
let _questHooks: QuestHooks | null = null;

export function registerQuest(def: QuestDefinition): string {
    return _registerInMap(_questDefs, def);
}

export function listQuests(): QuestDefinition[] {
    return _listFromMap(_questDefs);
}

export function registerQuestSource(def: QuestSource): string {
    return _registerInMap(_questSources, def);
}

export function listQuestSources(): QuestSource[] {
    return _listFromMap(_questSources);
}

export function registerQuestHooks(hooks: QuestHooks): void {
    _questHooks = { ...hooks };
}

export function getQuestHooks(): QuestHooks | null {
    return _questHooks ? { ..._questHooks } : null;
}

// ---------------------------------------------------------------------------
// Hook requests
// ---------------------------------------------------------------------------

export type StudentHookRequest = {
    id: string;
    summary: string;
    details?: string;
    suggestedSignature?: string;
    requestedBy?: string;
};

const _hookRequests: StudentHookRequest[] = [];

export function requestHook(req: StudentHookRequest): void {
    const id = String(req?.id || "").trim();
    const summary = String(req?.summary || "").trim();
    if (!id || !summary) return;

    _hookRequests.push({
        id,
        summary,
        details: req.details ? String(req.details) : undefined,
        suggestedSignature: req.suggestedSignature ? String(req.suggestedSignature) : undefined,
        requestedBy: req.requestedBy ? String(req.requestedBy) : undefined,
    });
}

export function listRequestedHooks(): StudentHookRequest[] {
    return _hookRequests.slice();
}
