# Student Systems Groupings (Longform Plan)

This document breaks the student-facing systems into focused work groups. Each group has a clear scope, required hooks, and dependencies. Use each group as a dedicated chat topic.

Group 1 (Core Hook Surface) is owned here and is the foundation for all others.
Groups 2–9 are defined below with more exact deliverables so you can copy-paste them into separate chats.

---

## Group 1 — Student SDK + Hook Surface (Core Contract)
**Owner:** Maintainer (this chat)

**Purpose**
- Define a stable, student-safe API (registries + hooks) that other systems depend on.

**Deliverables**
- `src/studentSystemsHooks.ts` (authoritative hook surface)
- `src/studentSdk.ts` re-exports
- Documentation in `STUDENTS.md` and `copilot.md`

**Notes**
- No core wiring here; just the contract and shared registries.

---

## Group 2 — UI / DOM Overlay System
**Purpose**
- A reusable overlay manager so every system (dialogue, crafting, quests, music) can render UI without bespoke DOM hacks.

**Deliverables**
- `src/ui/overlayManager.ts` (or similar) with a stable API
- A core input-gate that pauses/resumes gameplay when an overlay is modal
- Optional base templates for common layouts

**Minimum API (expected)**
```ts
type OverlayId = string;

type OverlayConfig = {
  id: OverlayId;
  html?: string;
  mountId?: string;
  className?: string;
  blocksInput?: boolean;
  visible?: boolean;
};

type OverlayApi = {
  create: (cfg: OverlayConfig) => HTMLElement;
  show: (id: OverlayId) => void;
  hide: (id: OverlayId) => void;
  remove: (id: OverlayId) => void;
  setHtml: (id: OverlayId, html: string) => void;
  setVisible: (id: OverlayId, visible: boolean) => void;
  isVisible: (id: OverlayId) => boolean;
};
```

**Dependencies**
- None (base utility used by others)

---

## Group 3 — NPC + Prop Registration
**Purpose**
- Standardize student NPC/prop definitions and route interactions to student systems.

**Deliverables**
- Student NPC registry integrated into spawn/interaction pipeline
- Student prop registry integrated into prop visuals/specs
- Naming convention: `<Name>NPC` (e.g., `ShopkeeperNPC`)

**Minimum API (expected)**
```ts
type StudentNpc = {
  id: string;               // "ShopkeeperNPC"
  name?: string;
  spriteKey?: string;
  portraitKey?: string;
  role?: string;
  tags?: string[];
};

type StudentProp = {
  id: string;
  visualKey?: string;
  specKey?: string;
  interactAction?: string;  // "prop", "npc"
  tags?: string[];
};

registerStudentNpc(def: StudentNpc): string
registerStudentProp(def: StudentProp): string
listStudentNpcs(): StudentNpc[]
listStudentProps(): StudentProp[]
```

**Dependencies**
- Tile/prop visuals, prop specs
- Interaction pipeline

---

## Group 4 — Items, Drops, Harvesting, Materials
**Purpose**
- Shared economy layer (materials/items, drops, harvesting) used by crafting and quests.

**Deliverables**
- Item/material registry
- Drop tables (weighted)
- Harvestable props with cooldown + VFX/anim hooks

**Minimum API (expected)**
```ts
type ItemDef = { id: string; name?: string; iconKey?: string; data?: any };
type DropEntry = { itemId: string; weight: number; min?: number; max?: number };
type DropTable = { id: string; entries: DropEntry[] };

type Harvestable = {
  id: string;
  propId?: string;
  dropTableId?: string;
  harvestAnimId?: string;
  cooldownMs?: number;
};

registerItem(def: ItemDef): string
registerDropTable(def: DropTable): string
registerHarvestable(def: Harvestable): string
```

**Dependencies**
- Prop interactions (Group 3)
- VFX/anim utilities (optional)

---

## Group 5 — Dialogue & Story (Abraham)
**Purpose**
- Dialogue scripts, triggers, and overlays, including camera cues and gameplay pause.

**Deliverables**
- Script registry + runtime
- Trigger system for NPC/prop/auto triggers
- Overlay integration with Group 2

**Minimum API (expected)**
```ts
type DialogueChoice = { id: string; text: string; nextId?: string; data?: any };

type DialogueLine = {
  id: string;
  speaker?: string;
  text: string;
  choices?: DialogueChoice[];
  nextId?: string;
  cameraCueId?: string;
  data?: any;
};

type DialogueScript = {
  id: string;
  title?: string;
  lines: DialogueLine[];
  overlayId?: string;
  pauseGameplay?: boolean;
  data?: any;
};

type DialogueTrigger = {
  id: string;
  kind: "npc" | "prop" | "auto" | "quest";
  targetId?: string;
  scriptId: string;
  once?: boolean;
  data?: any;
};

type DialogueCameraCue = {
  id: string;
  x: number;
  y: number;
  zoom?: number;
  durationMs?: number;
  data?: any;
};

registerDialogueScript(def: DialogueScript): string
registerDialogueTrigger(def: DialogueTrigger): string
registerDialogueCameraCue(def: DialogueCameraCue): string
registerDialogueHooks({ onStartScript, onEndScript })
```

**Dependencies**
- Group 2 (overlays)
- Group 3 (NPC/prop registry)

---

## Group 6 — Crafting System (Jason)
**Purpose**
- Crafting stations and recipes in the village, UI for combining materials.

**Deliverables**
- Recipe registry
- Station registry (NPC/prop link)
- UI overlay for recipe selection + result

**Minimum API (expected)**
```ts
type Recipe = {
  id: string;
  inputs: string[];
  outputs: string[];
  successText?: string;
};

type Station = {
  id: string;
  npcId?: string;
  propId?: string;
  recipeIds?: string[];
};

registerCraftingRecipe(def: Recipe): string
registerCraftingStation(def: Station): string
```

**Dependencies**
- Group 2 (overlays)
- Group 3 (NPC/props)
- Group 4 (items/materials/drops)

---

## Group 7 — Quest System (ChrisP)
**Purpose**
- Quests with objectives, progress tracking, rewards, and UI log.

**Deliverables**
- Quest definitions + sources
- Progress tracking + reward payout
- UI overlay for quest log

**Minimum API (expected)**
```ts
type QuestObjective = {
  id: string;
  kind: "collect"|"talk"|"visit"|"defeat";
  targetId?: string;
  count?: number;
};

type QuestReward = { coins?: number; itemIds?: string[] };
type Quest = { id: string; title: string; objectives: QuestObjective[]; reward?: QuestReward };

type QuestSource = {
  id: string;
  kind: "npc"|"prop"|"random";
  sourceId?: string;
  questIds: string[];
};

registerQuest(def: Quest): string
registerQuestSource(def: QuestSource): string
```

**Dependencies**
- Group 2 (overlays)
- Group 3 (NPC/props)
- Group 4 (items/drops)
- Group 5 (optional for story quests)

---

## Group 8 — Wisdom Music Mode (Kyle)
**Purpose**
- Held Wisdom move enters rhythm minigame. Score scales cast outcome.

**Deliverables**
- Held Wisdom hook wired into core
- Song registry + scoring callback
- Music mode UI overlay

**Minimum API (expected)**
```ts
type SongNote = { timeMs: number; lane: string; holdMs?: number };
type Song = { id: string; title?: string; bpm?: number; notes?: SongNote[] };

registerWisdomMusicSong(def: Song): string
registerWisdomMusicHooks({
  onStartMode,
  onStopMode,
  getSongIdForMove,
  scoreToScale
});
```

**Dependencies**
- Group 2 (overlays)
- Possibly Group 9 (Blockly songs)

---

## Group 9 — Blockly Extensions (Optional / Later)
**Purpose**
- Blockly blocks for songs, dialogue, crafting recipes (to avoid manual data entry).

**Deliverables**
- Blockly blocks + runtime translation into registries
- Save/load flows for student data

**Dependencies**
- Group 1 (registries)
- Group 2 (UI host)
- Groups 5/6/8 (systems that consume Blockly output)

---

## Group 10 — Pet System (Elizabeth + Lourdes + Alan)
**Purpose**
- Pet companions with art/animation, AI behaviors, stats/progression, and interactions (feed/heal/ride).

**Deliverables**
- Pet atlas registry for art + animation keys
- Pet behavior registry for AI hooks
- Pet stats + acquisition registry (eggs/summons/quests/drops)
- Inventory hooks for feeding/healing/hatching
- Ally registry for combat integration

**Minimum API (expected)**
```ts
type PetAtlas = {
  id: string;
  textureKey: string;
  anims?: {
    idle?: string;
    walk?: string;
    hurt?: string;
    interact?: string;
    ride?: string;
    sit?: string;
    climb?: string;
  };
};

type PetBehavior = {
  id: string;
  petId: string;
  onSpawn?: (ctx: any) => void;
  onUpdate?: (ctx: any) => void;
  onDamage?: (ctx: any) => void;
  onHeal?: (ctx: any) => void;
  onMount?: (ctx: any) => void;
  onUnmount?: (ctx: any) => void;
};

type PetStats = {
  id: string;
  baseHp?: number;
  baseAtk?: number;
  growthHp?: number;
  growthAtk?: number;
  maxLevel?: number;
};

type PetAcquisition = {
  id: string;
  petId: string;
  kind: "egg" | "summon" | "quest" | "drop";
  condition?: string;
};

type InventoryItem = { id: string; name?: string; iconKey?: string };

type InventoryHook = {
  onItemUse?: (ctx: any) => void;
  onPetFeed?: (ctx: any) => void;
  onPetHeal?: (ctx: any) => void;
  onPetHatch?: (ctx: any) => void;
};

type AllyDef = { id: string; kind: "pet" | "summon" | "monster" };

registerPetAtlas(def: PetAtlas): string
registerPetBehavior(def: PetBehavior): string
registerPetStats(def: PetStats): string
registerPetAcquisition(def: PetAcquisition): string
registerInventoryItem(def: InventoryItem): string
registerInventoryHooks(hooks: InventoryHook): void
registerAlly(def: AllyDef): string
```

**Dependencies**
- Group 1 (registries)
- Group 2 (overlays for pet/inventory UI)
- Group 4 (items/drops/harvestables)
- Combat pipeline (pet/allies vs monsters)

---

## Cross-Group Consistency Rules
- Use the student hook surface (Group 1) as the single entry point.
- Prefer shared overlay + registry utilities; avoid bespoke per-system DOM.
- Keep naming conventions consistent: `<Name>NPC`, `student.<profile>.` keys.
- If something is missing, add a hook request to the student folder, not core edits.
