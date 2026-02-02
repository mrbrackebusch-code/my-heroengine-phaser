# Copilot Instructions

This repo uses a strict separation between core code and student work.

- Read copilot.md and follow it exactly. It is authoritative.
- Student changes must stay inside src/student/<StudentName>/.
- Use src/studentSdk.ts for student hooks and registration.
- Prefer src/studentSystemsHooks.ts as the single approved import outside student folders.
- Keep src/student/<StudentName>/index.ts in place (auto-discovery).
- Do not edit core files (src/*.ts) or assets/ unless the maintainer explicitly asks.
- Do not edit src/generated/.
- Keep changes scoped. Avoid refactors and unrelated edits.
- Logging must use debug flags in src/debugFlags.ts; no console.* without a flag.
- For colliding props/decor, do not bypass aura/mask collision data.

If a change needs core hooks or shared APIs, stop and ask the maintainer.
