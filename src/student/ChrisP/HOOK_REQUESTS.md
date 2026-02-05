# Hook Requests for ChrisP Quest System

## Request: Ability Usage Tracking Hook

- **ID**: abilityUsageHook
- **Summary**: Add a hook to track when abilities are used, specifically for quest objectives like using "wisdom" abilities a certain number of times.
- **Details**: Need a callback like `onAbilityUsed(ctx: any, abilityId: string, family: string)` that fires whenever a player uses an ability. This would allow quests to increment progress for objectives like "use wisdom abilities 5 times". The family parameter should match hero families (e.g., "wisdom", "strength").
- **Suggested Signature**:
  ```typescript
  export type AbilityHooks = StudentProfileGate & {
      onAbilityUsed?: (ctx: any, abilityId: string, family: string) => void;
  };

  // Registration function
  export function registerAbilityHooks(hooks: AbilityHooks): void;
  export function getAbilityHooks(): AbilityHooks | null;
  ```
- **Requested By**: ChrisP

## Request: XP Reward in Quests

- **ID**: questXpReward
- **Summary**: Allow quests to reward XP (experience points) to the player.
- **Details**: Add `xp?: number;` to the `QuestReward` type, and implement logic to grant XP when the quest is completed.
- **Suggested Signature**:
  ```typescript
  export type QuestReward = {
      coins?: number;
      itemIds?: string[];
      relicId?: string;
      xp?: number; // New field
      data?: any;
  };
  ```
- **Requested By**: ChrisP

## Request: Level Completion Tracking Hook

- **ID**: levelCompletionHook
- **Summary**: Add a hook to track when levels or specific areas (like boss levels) are completed.
- **Details**: Need a callback like `onLevelCompleted(ctx: any, levelId: string, isBoss: boolean)` that fires when a level is beaten. This would allow quests like "beat the boss level".
- **Suggested Signature**:
  ```typescript
  export type LevelHooks = StudentProfileGate & {
      onLevelCompleted?: (ctx: any, levelId: string, isBoss: boolean) => void;
  };

  // Registration function
  export function registerLevelHooks(hooks: LevelHooks): void;
  export function getLevelHooks(): LevelHooks | null;
  ```
- **Requested By**: ChrisP