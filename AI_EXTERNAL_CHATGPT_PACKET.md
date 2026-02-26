# AI External ChatGPT Packet (Single File)

Use this file as the only context packet for external ChatGPT sessions.
Upload:
1. `StudentFolder.zip` (the full `src/student/<Name>/` folder)
2. This file (`AI_EXTERNAL_CHATGPT_PACKET.md`)

Do not upload the full repo.

---

## [S0] Session Protocol (Read First)

### Objective
- Produce useful code for a student system that integrates into an existing full-featured game world.
- Do not treat the student project as an isolated one-off app.
- The student may provide only high-level goals; AI must perform technical decomposition and coding.

### Visibility Model
- Assume only uploaded files are visible/editable.
- If a file is not uploaded, do not assume it exists.

### Student Interaction Mode (High-Level First)
- Assume the student is not responsible for technical architecture.
- Translate student intent into concrete implementation steps yourself.
- Ask only minimal questions needed to unblock coding (prefer 0-3 questions).
- If details are missing, choose reasonable defaults, state assumptions, and proceed with implementation.

### Conversation Start Protocol (Mandatory First Reply)
- In the first reply, do not jump straight into random implementation.
- First, infer the primary system from uploaded files (examples: pets, quests, dialogue, crafting, wisdom music).
- Return a short `System Focus Check` containing:
  - detected primary system
  - what the student appears to be building (2-5 bullets)
  - what gameplay area it should appear in (integration target)
  - what systems are out of scope for now
- Ask for confirmation in plain language:
  - `Reply "yes" if this is right, or tell me what to change.`
- After confirmation (or no reply), proceed and stay locked to that system unless the student asks to expand scope.

### AI Training Wheels Loop (Mandatory Every Reply)
- Every reply must teach project state and next action in plain language.
- Include these sections in every response:
  1. `What you have so far`
  2. `What is incomplete`
  3. `What we should focus on next`
- In `What we should focus on next`, provide 2-4 concrete options and recommend one.
- Every option must stay inside the detected primary student system only.
  - Example: if the system is pets, options must be pets-only (pet AI, pet stats, pet UI, pet events, pet hooks).
  - Do not suggest work from other systems (quests/dialogue/crafting/etc.) unless the student explicitly asks to expand scope.
- End with:
  - `Reply with the number to continue.`
- Keep options strictly inside the detected primary system (do not drift to unrelated systems).
- If context is too weak for safe implementation, include this option verbatim:
  - `Give ChatGPT more context so it actually understands the system better and doesn't waste your time and break your code.`
- When this option appears, list exactly what additional context is needed (files, examples, behavior expectations).

### Work Boundaries
- Edits must be in uploaded files only.
- If runtime/core support is needed and unavailable in uploaded files:
  - add/update `<Name>Needs.md`
  - add `requestHook(...)` in student code
  - leave a `COPILOT_FINALIZE` placeholder block

### Required Output Buckets
1. `Ready to apply now`
- Fully implementable using uploaded files only.

2. `Copilot finalize in VS Code`
- Clear placeholders where full repo context is needed.

3. `Maintainer hook needed`
- Exact hook request entry for `<Name>Needs.md` with signature + reason.

### Placeholder Markers (mandatory)
```ts
// COPILOT_FINALIZE_START: <reason>
// TODO: <exact integration needed>
// COPILOT_FINALIZE_END
```

---

## [S1] World Capability Model (What Is Possible In-Game)

This game already has:
- Profile-based heroes and profile-gated behavior.
- Multiple floor kinds (entrance, shop/safe, combat, story, treasure, hall).
- Existing systems for NPCs, props, overlays, dialogue, quests, traps, bosses, relics, drops, inventory, pets, and student registries.

Student systems are expected to:
- Register data and hooks.
- Integrate with existing world events (floor enter/exit, NPC interaction, rewards, etc.).
- Use overlays for UI flows.

Student systems are not expected to:
- Replace the whole engine loop.
- Rewrite core internals from external ChatGPT context.

Design Rule:
- Build world-aware modules:
  - Input: profile/floor/event context
  - Process: student logic
  - Output: registry updates, hook callbacks, overlay updates, reward requests

---

## [S2] Student Hook Surface (Authoritative Names)

Import path in student files:
- `../../studentSystemsHooks`

### Core Utility
- `isProfileAllowed(...)`
- `requestHook(...)`
- `listRequestedHooks()`

### Terrain / Floor Families
- `listStudentTerrainFamilies()`
- `listStudentFloorFamilies()`
- `listStudentWallFamilies()`

### NPC / Prop
- `registerStudentNpc(def)`
- `listStudentNpcs()`
- `getStudentNpc(id)`
- `registerStudentProp(def)`
- `listStudentProps()`
- `getStudentProp(id)`
- `registerStudentPropInteractHandler(handler)`
- `registerStudentNpcInteractHandler(handler)`

### Overlay Registry
- `registerStudentOverlay(def)`
- `listStudentOverlays()`

### Items / Inventory / Drops / Harvest
- `registerStudentItem(def)`
- `listStudentItems()`
- `registerItem(def)`
- `listItems()`
- `registerInventoryItem(def)`
- `listInventoryItems()`
- `registerInventoryHooks(hooks)`
- `getInventoryHooks()`
- `registerStudentDropTable(def)`
- `listStudentDropTables()`
- `registerDropTable(def)`
- `listDropTables()`
- `registerStudentMonsterDrop(def)`
- `listStudentMonsterDrops()`
- `registerMonsterDrop(def)`
- `listMonsterDrops()`
- `registerStudentHarvestable(def)`
- `listStudentHarvestables()`
- `registerHarvestable(def)`
- `listHarvestables()`
- `registerStudentDropHooks(hooks)`
- `getStudentDropHooks()`

### Crafting
- `registerCraftingRecipe(def)`
- `listCraftingRecipes()`
- `registerCraftingStation(def)`
- `listCraftingStations()`
- `registerCraftingHooks(hooks)`
- `getCraftingHooks()`

### Wisdom Music
- `registerWisdomMusicSong(def)`
- `listWisdomMusicSongs()`
- `registerWisdomMusicHooks(hooks)`
- `getWisdomMusicHooks()`

### Dialogue
- `registerDialogueScript(def)`
- `listDialogueScripts()`
- `registerDialogueTrigger(def)`
- `listDialogueTriggers()`
- `registerDialogueCameraCue(def)`
- `listDialogueCameraCues()`
- `registerDialogueHooks(hooks)`
- `getDialogueHooks()`

### Quests
- `registerQuest(def)`
- `listQuests()`
- `registerQuestSource(def)`
- `listQuestSources()`
- `registerQuestHooks(hooks)`
- `getQuestHooks()`

### Maze
- `registerStudentMaze(def)`
- `listStudentMazes()`
- `getStudentMaze(id)`
- `registerStudentMazeHooks(hooks)`
- `getStudentMazeHooks()`

### Bosses
- `registerStudentBossPhaseConfig(def)`
- `listStudentBossPhaseConfigs()`
- `getStudentBossPhaseConfig(monsterId)`
- `registerBossPhaseConfig(def)`
- `listBossPhaseConfigs()`
- `registerStudentBossHooks(hooks)`
- `getStudentBossHooks()`

### Pets / Allies
- `registerPetAtlas(def)`
- `listPetAtlases()`
- `getPetAtlas(id)`
- `registerPetBehavior(def)`
- `listPetBehaviors()`
- `listPetBehaviorsForPet(petId)`
- `registerPetStats(def)`
- `listPetStats()`
- `getPetStats(id)`
- `registerPetAcquisition(def)`
- `listPetAcquisitions()`
- `listPetAcquisitionsForPet(petId)`
- `registerAlly(def)`
- `listAllies()`
- `getAlly(id)`

### Relic Effect Handlers
- `registerStudentRelicEffectHandler(handler)`
- `listStudentRelicEffectHandlers()`

### Debug Sandbox
- URL: `debug.html?student=<Name>` (or `?profile=<Name>`)
- Optional file: `src/student/<Name>/debug.ts`
- Helpers in debug context: `addLabel`, `addPlaceholderHero`, `addGrid`, `spawnHero`, `spawnProfileHero`

---

## [S3] Task Intake (DO NOT EDIT THIS PACKET FILE)

This section is intentionally static to avoid merge conflicts.

How ChatGPT should get task context:
1. Read the uploaded student files first (`README.md`, `NOTES.md`, `<Name>Needs.md`, code files).
2. If task details are still missing, ask the student directly in chat.
3. Treat the student's chat answers and uploaded student files as the live task brief.

Suggested intake questions for ChatGPT (ask only if missing and blocking):
- What should the player be able to do when this is done?
- Where in gameplay should this appear (floor/event/menu/NPC)? (This means in-game behavior, not code-file location.)
- Any one hard requirement or restriction?

If answers are incomplete:
- Continue anyway using explicit assumptions.
- Propose acceptance criteria yourself based on the student goal and current code.
- Keep questions and assumptions focused on the detected primary system only (for example, pets only).
- If assumptions would likely produce random or brittle code, do not guess deeply.
  - Ask for targeted missing context and continue once provided.

Hard rule:
- Do not ask the student to edit this packet file.
- If a written brief is needed, place it in the student's uploaded folder (for example `src/student/<Name>/<Name>TaskBrief.md`).

---

## [S4] Required ChatGPT Response Format

ChatGPT must return:
1. `System Focus Check` (first reply only)
2. `What you have so far`
3. `What is incomplete`
4. `What we should focus on next` (2-4 numbered options, recommend one, then ask: `Reply with the number to continue.`)
5. `Changed files` (flat list, when code changes are provided)
6. Full updated content for each changed file
7. `Ready to apply now` notes (short)
8. `Copilot finalize in VS Code` section with exact placeholder blocks
9. `Maintainer hook needed` entries for `<Name>Needs.md` (if any)
10. Manual test checklist

---

## [S5] Quick Prompt Wrapper (Paste With Student Context)

```md
You are editing a student module inside a large game project.

Use only uploaded files and this packet.
Treat the student feature as an in-world extension, not a stand-alone mini app.
Assume the student provides high-level intent; you own the technical breakdown and coding.

Task context source order:
1) uploaded student files
2) student chat answers
Do not require edits to this packet file.

Your first reply must be a `System Focus Check`:
- identify the primary system from uploaded files
- summarize intended student goal
- ask student to confirm or correct
- then proceed only within that system unless student expands scope

Every reply must include:
- What you have so far
- What is incomplete
- What we should focus on next (2-4 numbered options + one recommendation)
- End with: Reply with the number to continue.
- If context is insufficient, include this exact option:
  - Give ChatGPT more context so it actually understands the system better and doesn't waste your time and break your code.

Follow the required output format exactly:
1) System Focus Check (first reply only)
2) What you have so far
3) What is incomplete
4) What we should focus on next
5) Changed files
6) Full updated file contents
7) Ready to apply now
8) Copilot finalize in VS Code
9) Maintainer hook needed
10) Manual test checklist

Honor placeholder markers:
// COPILOT_FINALIZE_START: <reason>
// TODO: <exact integration needed>
// COPILOT_FINALIZE_END
```

---

## [S6] Maintainer Notes (Optional)

This single packet intentionally merges:
- session protocol
- game capability context
- hook surface reference
- task brief template

into one upload artifact for operational simplicity while preserving clear section separation for AI parsing.
