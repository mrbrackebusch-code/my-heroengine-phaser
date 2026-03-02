# Card Combo Minigame — Design

Overview
- Short optional minigame (<= 90s) presented after boss battles or when player stats are low.
- Player draws and plays cards to form combos. Combos are evaluated and yield rewards.
- Reward scaling depends on session difficulty, time remaining, and combo complexity.

Goals
- Fast, repeatable, and fun — single session < 90 seconds.
- Clean student-only implementation (all files and assets in `src/student/Hanna/`).
- Minimal core dependencies: register overlay definition, request runtime hooks.

High-level Flow
1. Trigger: game asks player to open the minigame (after boss/low stats). Core decision logic occurs in main game.
2. Player accepts -> core opens overlay and calls our `onOverlayShown()` entry point.
3. Game runs a 90s timer. Player performs quick card plays to assemble combos.
4. On timer end or player finish, evaluate combos and compute rewards.
5. Call core-provided reward hook to grant items/XPs/relics.
6. Close overlay; persist any unlocked cards or rewards locally via student hooks.

Session Parameters
- `difficulty`: number (1..5) affects enemy strength of minigame and card pool quality.
- `rewardMultiplier`: estimated from boss difficulty / time taken to reach boss.
- `maxDurationMs`: 90,000 (1m30s)

Data Model (summary)
- Card: { id, name, power, type, rarity }
- Hand: limited size (e.g., 5 cards) to keep play fast
- Combo: sequence or set of cards; different patterns yield different tiered rewards
- Reward: { xp?: number, gold?: number, itemId?: string, relicId?: string }

Combos (examples)
- Pair (two cards same type): small XP
- Sequence (3 cards of increasing power): medium gold
- Set (3 same rarity): higher XP + chance at item
- Legendary chain (4+ cards with strict pattern): guaranteed relic (very rare)

Integration Points and Hooks (what core must provide)
- A mechanism to open/close overlays by `id` and pass `data` to the student overlay UI.
- A runtime function to grant rewards to the player: `grantPlayerReward(reward)`.
- Optional: persistent card unlock API (or student can store unlocked cards locally and request a core hook later).

Student APIs provided
- `registerStudentOverlay({ id: 'Hanna.CardMinigame', ... })` — overlay definition
- `export function onOverlayShown(data)` — called by core when overlay is shown; starts a session
- `export function createSession(params)` — creates a session object (useful for testing)

Files
- `types.ts` — types & small helpers
- `minigame.ts` — core class and exported functions
- `HannaNeeds.md` — exact hook requests to the maintainer
- `assets/` — card art and UI assets (student-supplied)

Testing
- Unit test candidate: combo evaluation logic is pure and can be tested without core.

Notes
- Keep runtime UI and rendering minimal; core overlay system is expected to mount the DOM. If core cannot, we provide a fallback DOM mount under `document.body` but prefer core-managed overlays.
- All changes restricted to `src/student/Hanna/`.
