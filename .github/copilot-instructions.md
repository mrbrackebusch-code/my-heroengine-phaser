# Copilot Instructions

This repo uses a strict separation between core code and student work.

- Read copilot.md and follow it exactly. It is authoritative.
- Before editing, read .github/student-owners.json and only edit the folder assigned to your GitHub username; if you are not listed, stop and ask the maintainer. Do not edit .github/student-owners.json.
- Student changes must stay inside src/student/<AssignedFolder>/.
- If you need hooks or anything outside your folder, document it in src/student/<AssignedFolder>/<AssignedFolder>Needs.md and stop; do not edit core files.
- Student debug sandbox: use debug.html?student=<AssignedFolder> (or ?profile=<AssignedFolder>) and implement src/student/<AssignedFolder>/debug.ts (optional).
- Use src/studentSdk.ts for student hooks and registration.
- Prefer src/studentSystemsHooks.ts as the single approved import outside student folders.
- Keep src/student/<AssignedFolder>/index.ts in place (auto-discovery).
- Do not edit core files (src/*.ts) or assets/ unless the maintainer explicitly asks.
- Do not edit src/generated/.
- Keep changes scoped. Avoid refactors and unrelated edits.
- Logging must use debug flags in src/debugFlags.ts; no console.* without a flag.
- For colliding props/decor, do not bypass aura/mask collision data.

If a change needs core hooks or shared APIs, stop and ask the maintainer.
