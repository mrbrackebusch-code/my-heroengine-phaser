# ChrisS Needs

## Hook Request: Relic Effect Handler Registration

**Summary:** Student needs to register gameplay effects for amulets/relics.

**Details:**
Need a hook surface to register `RelicEffectHandler` implementations for student-created relics. This would allow amulets registered via the relics API to have actual gameplay mechanics like:
- Modifying damage/armor  
- Applying status effects
- Triggering special abilities
- Modifying resource costs
- Triggering on specific events (hit enemy, take damage, combat clears, floor changes, etc.)

**Requested Structure:**
```typescript
// In studentSystemsHooks.ts
export type StudentRelicEffectHandler = {
    effectKey: string;
    modifyMoveStats?: (ctx: any) => void;
    onHitEnemy?: (ctx: any) => void;
    beforeHeroDamage?: (ctx: any) => void;
    // ... other hooks from RelicEffectHandler
};

export function registerStudentRelicEffectHandler(handler: StudentRelicEffectHandler): void;
```

Currently, amulets can be registered with metadata but cannot have gameplay effects implemented.
