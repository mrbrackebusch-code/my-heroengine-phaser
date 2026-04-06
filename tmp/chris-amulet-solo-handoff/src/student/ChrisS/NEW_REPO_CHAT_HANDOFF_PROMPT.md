# New Repo Chat Handoff Prompt

Copy/paste this into your first chat in your new solo repo.

---

I migrated my amulet feature from another repo and I need you to continue it as my own standalone project.

Context and goals:
- This is MY repo now. Do not shrink to a toy project.
- Preserve existing behavior and architecture unless refactor is needed for portability.
- Build/keep a clean adapter boundary so game-engine dependencies are isolated.
- Keep AP CSP explainability strong.

What to read first in this repo:
1. `handoff-manifest.json`
2. `src/student/ChrisS/SOLO_REPO_TRANSITION.md`
3. `src/student/ChrisS/amuletData.ts`
4. `src/student/ChrisS/amuletSelectionUI.ts`
5. `src/student/ChrisS/amuletEffects.ts`
6. `src/student/ChrisS/amuletChest.ts`
7. `host-reference/src/studentApi.ts`
8. `host-reference/src/studentSystemsHooks.ts`

My migration requirements:
1. Create a portability adapter layer for host/game APIs.
2. Replace direct student-hook imports with local feature-facing interfaces where possible.
3. Keep the AP slice intact:
   - List: `AMULETS`
   - Procedure: `buildAmuletPreviewData(amuletId, amuletOptions)`
4. Make sure the project runs in this repo without school-specific ownership tooling.

Output format I want from you:
1. "Current State Audit"
2. "Dependency Gap List"
3. "Migration Patches"
4. "Run Instructions"
5. "AP Slice Verification"

Constraints:
- Do not delete my feature or replace it with an example app.
- Prefer refactor over rewrite.
- Keep names readable and easy for AP exam explanation.

---
