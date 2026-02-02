# Copilot Rules (MANDATORY)

You MUST follow these rules at all times:

1) YOU MAY ONLY EDIT FILES INSIDE:
   src/student/<StudentName>/

2) DO NOT EDIT ANY OTHER FILES.
   - That includes src/*.ts, assets/, src/generated/, scripts/, etc.
   - If a change is needed outside your folder, STOP and ask the maintainer.

3) The ONLY file you are allowed to import from outside your folder is:
   src/studentSystemsHooks.ts
   (This is the safe Student SDK + hook request surface.)
   It includes the current hook surface for crafting, wisdom music, dialogue, and quests.

4) If you need a new hook into the core game:
   - DO NOT edit core files.
   - Create or update: src/student/<StudentName>/HOOK_REQUESTS.md
   - Add a clear request with what you need and why.
   - In code, you may add a placeholder call to requestHook(...) from
     src/studentSystemsHooks.ts to document the request.

5) Assets:
   - All new assets must live inside your student folder (top level or an assets/ subfolder).
   - Never touch assets/ outside your folder.

6) Logging:
   - Do not add console.* logs.
   - Ask the maintainer if a debug flag is needed.

If you are unsure, STOP and ask the maintainer.
