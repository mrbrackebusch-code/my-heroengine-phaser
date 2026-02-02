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

// ---------------------------------------------------------------------------
// Shared data: NPCs, props, overlays, drops, harvestables
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
    return _registerInMap(_propDefs, def);
}

export function listStudentProps(): StudentPropDefinition[] {
    return _listFromMap(_propDefs);
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

export type StudentDropEntry = {
    itemId: string;
    weight: number;
    min?: number;
    max?: number;
};

export type StudentDropTable = {
    id: string;
    entries: StudentDropEntry[];
    notes?: string;
};

const _dropTables = new Map<string, StudentDropTable>();

export function registerStudentDropTable(def: StudentDropTable): string {
    return _registerInMap(_dropTables, def);
}

export function listStudentDropTables(): StudentDropTable[] {
    return _listFromMap(_dropTables);
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

const _harvestables = new Map<string, StudentHarvestable>();

export function registerStudentHarvestable(def: StudentHarvestable): string {
    return _registerInMap(_harvestables, def);
}

export function listStudentHarvestables(): StudentHarvestable[] {
    return _listFromMap(_harvestables);
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
    data?: any;
};

export type DialogueScript = {
    id: string;
    title?: string;
    lines: DialogueLine[];
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
