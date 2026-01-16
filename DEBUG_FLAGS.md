# Debug Flags

Source of truth: `src/debugFlags.ts`

Use this file to decide what to turn on first. When you need new logs, prefer an
existing flag in `src/debugFlags.ts` or add a new flag there (and update this doc).

How to use
- Flip flags in `src/debugFlags.ts`, rebuild/reload.
- Keep defaults quiet; turn on only what you need.

Quick index (by subsystem)
- HeroEngine core: `DEBUG_HERO_LOGIC`, `DEBUG_FILTER_LOGS`, `DEBUG_FILTER_PHRASE`, `DEBUG_WARN_PUBLISH_HERO_ACTION_PHASE`
- Anim keys: `DEBUG_ANIM_KEYS`, `DEBUG_ANIM_KEYS_*`
- Agility/integrator: `DEBUG_AGILITY`, `DEBUG_AGI_COMBO_*`, `DEBUG_AGI_AIM_*`, `DEBUG_INTEGRATOR`
- Contract snapshot: `DEBUG_CONTRACT_SNAPSHOT`, `DEBUG_CONTRACT_*`
- Decor/focus/chest: `DEBUG_CHEST_*`, `DEBUG_FOCUS_DIRECT_LOGS`, `DEBUG_DECOR_ENGINE_LOGS`
- Enemy nav: `DEBUG_ENEMY_NAV_LOG`, `DEBUG_ENEMY_STUCK_LOG`, `DEBUG_ENEMY_NAV_COLLISION`
- Arcade compat: `DEBUG_NET`, `DEBUG_TILEMAP_COMPAT`, `DEBUG_SPRITE_*`, `DEBUG_ROLE_*`
- Prop outline: `DEBUG_PROP_OUTLINE_*`, `FORCE_PROP_*`
- Tilemap/tiles: `DEBUG_TILEMAP_MAIN`, `DEBUG_TILEMAP_APPLY_NET`, `DEBUG_TILE_ATLAS_GLOBAL`, `DEBUG_TILEMAP_GLUE`
- Prop focus aura: `DEBUG_PROP_FOCUS_AURA_*`, `LOG_PROP_FOCUS_AURA_*`
- Weapon: `WEAPON_DEBUG`, `WEAPON_DEBUG_VERBOSE`, `ENABLE_WEAPON_AUDIT_*`
- Host/Blockly/student: `DEBUG_HOST_LOGIC`, `DEBUG_BLOCKLY_*`, `DEBUG_HERO_LOGIC_STUDENT`
- Monsters: `DEBUG_MONSTER_SPRITES`

Full list and inline notes live in `src/debugFlags.ts`.
