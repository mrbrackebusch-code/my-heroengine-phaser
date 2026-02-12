import { registerQuest, registerQuestSource, requestHook, type QuestDefinition, type QuestSource } from "../../studentSystemsHooks";

// Define the slime elimination quest
const slimeHuntQuest: QuestDefinition = {
    id: "slimeHunt",
    title: "Slime Elimination",
    description: "Eliminate exactly 10 slimes to complete this quest.",
    objectives: [
        {
            id: "defeatSlimes",
            kind: "defeat",
            targetId: "slime",
            count: 10,
        },
    ],
    reward: {
        coins: 20,
    },
    repeatable: false,
};

// Define the wisdom ability usage quest
const wisdomAbilityQuest: QuestDefinition = {
    id: "wisdomAbilityUse",
    title: "Wisdom Mastery",
    description: "Use Wisdom abilities 5 times to complete this quest.",
    objectives: [
        {
            id: "useWisdomAbilities",
            kind: "custom",
            targetId: "wisdom",
            count: 5,
        },
    ],
    reward: {
        data: { xp: 10 }, // Placeholder for XP until hook is implemented
    },
    repeatable: false,
};

// Define the boss level quest
const bossLevelQuest: QuestDefinition = {
    id: "beatBossLevel",
    title: "Boss Conqueror",
    description: "Beat the boss level to complete this quest.",
    objectives: [
        {
            id: "completeBossLevel",
            kind: "custom",
            targetId: "bossLevel",
            count: 1,
        },
    ],
    reward: {
        coins: 75,
    },
    repeatable: false,
};

// Define the 20-slime exterminator quest (title reward requested)
const slimeExterminatorQuest: QuestDefinition = {
    id: "slimeExterminator",
    title: "Slime Exterminator",
    description: "Eliminate 20 slimes to earn the title 'Slime Exterminator'.",
    objectives: [
        {
            id: "defeatTwentySlimes",
            kind: "defeat",
            targetId: "slime",
            count: 20,
        },
    ],
    reward: {
        data: { title: "Slime Exterminator" }, // Placeholder until title grant hook exists
    },
    repeatable: false,
};

// Register the quests
registerQuest(slimeHuntQuest);
registerQuest(wisdomAbilityQuest);
registerQuest(bossLevelQuest);
registerQuest(slimeExterminatorQuest);

// Define a quest source (e.g., available automatically or from an NPC)
const slimeHuntSource: QuestSource = {
    id: "slimeHuntSource",
    kind: "auto", // Automatically available, or change to "npc" if tied to an NPC
    questIds: ["slimeHunt", "wisdomAbilityUse", "beatBossLevel", "slimeExterminator"],
};

// Register the quest source
registerQuestSource(slimeHuntSource);

// We cannot call `registerMonsterHooks` because that hook is not implemented
// in the core. Registering a runtime hook here would cause an import error.
// Instead, request the hook from the maintainer so they can implement it.
requestHook({
    id: "monsterDefeatHook",
    summary: "Add onMonsterDefeated hook to notify students when a monster dies",
    details: "Students need a callback fired when monsters are defeated so quests can track defeats and spawn visual effects at the death location.",
    suggestedSignature: "export type MonsterHooks = StudentProfileGate & { onMonsterDefeated?: (ctx: any, monsterId: string, x: number, y: number) => void; }; export function registerMonsterHooks(hooks: MonsterHooks): void; export function getMonsterHooks(): MonsterHooks | null;",
    requestedBy: "ChrisP",
});

requestHook({
    id: "spawnEffectApi",
    summary: "Provide spawnEffect API for students to spawn effects",
    details: "Students need an API to spawn visual effects (lights, particles) at world positions. This will be used by quests and debug pages.",
    suggestedSignature: "export function spawnEffect(effectId: string, x: number, y: number, options?: { duration?: number; scale?: number; alpha?: number }): void;",
    requestedBy: "ChrisP",
});