# Copilot Rules (MANDATORY)

You MUST follow these rules at all times:

1) Before editing, you MUST read .github/student-owners.json.
   - Find your GitHub username and the assigned folder name.
   - If you are not listed, STOP and ask the maintainer to add you.
   - Your only allowed edit path is: src/student/<AssignedFolder>/

2) YOU MAY ONLY EDIT FILES INSIDE:
   src/student/<AssignedFolder>/

3) DO NOT EDIT ANY OTHER FILES.
   - That includes src/*.ts, assets/, src/generated/, scripts/, etc.
   - If a change is needed outside your folder, STOP and ask the maintainer.
   - Do NOT edit .github/student-owners.json.
   - Do NOT edit other students' folders or rename/create student folders.

4) The ONLY file you are allowed to import from outside your folder is:
   src/studentSystemsHooks.ts
   (This is the safe Student SDK + hook request surface.)
   It includes the current hook surface for pets, crafting, wisdom music, dialogue, and quests.

5) If you need a new hook or any change outside your folder:
   - DO NOT edit core files.
   - Create or update: src/student/<AssignedFolder>/<AssignedFolder>Needs.md
   - Add a clear request with what you need and why.
   - In code, you may add a placeholder call to requestHook(...) from
     src/studentSystemsHooks.ts to document the request.

6) Student debug sandbox:
   - Use debug.html?student=<AssignedFolder> (or ?profile=<AssignedFolder>) for a blank canvas (no full game).
   - Your optional debug entry file is: src/student/<AssignedFolder>/debug.ts
   - The debug page auto-discovers students from src/student/*/index.ts.
   - Export either:
     - default function (ctx) { ... } OR
     - const studentDebug = { preload, create, update }
   - Helpers available: ctx.api.helpers.addLabel, addPlaceholderHero, addGrid, spawnHero, spawnProfileHero.
   - For typing, import types from src/studentSystemsHooks.ts (allowed).

7) Assets:
   - All new assets must live inside your student folder (top level or an assets/ subfolder).
   - Never touch assets/ outside your folder.

8) Logging:
   - Do not add console.* logs.
   - Ask the maintainer if a debug flag is needed.

If you are unsure, STOP and ask the maintainer.
