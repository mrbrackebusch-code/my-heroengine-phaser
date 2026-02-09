import { registerQuest, registerQuestSource, registerMonsterHooks, type QuestDefinition, type QuestSource } from "../../studentSystemsHooks";

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

// Register the quests
registerQuest(slimeHuntQuest);
registerQuest(wisdomAbilityQuest);
registerQuest(bossLevelQuest);

// Define a quest source (e.g., available automatically or from an NPC)
const slimeHuntSource: QuestSource = {
    id: "slimeHuntSource",
    kind: "auto", // Automatically available, or change to "npc" if tied to an NPC
    questIds: ["slimeHunt", "wisdomAbilityUse", "beatBossLevel"],
};

// Register the quest source
registerQuestSource(slimeHuntSource);

// Register monster hooks for visual effects and quest tracking
registerMonsterHooks({
    onMonsterDefeated: (ctx: any, monsterId: string, x: number, y: number) => {
        if (monsterId === "slime") {
            // Spawn light effect at defeat location
            // TODO: Implement light effect spawning using spawnEffect API once available
            // spawnEffect("light", x, y, { duration: 1000 });
            // TODO: Increment quest progress for slimeHunt quest
        }
    },
});