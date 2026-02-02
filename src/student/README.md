# Student Systems

This folder is reserved for student-developed systems. Each student works only inside their own folder:

- src/student/Kyle/
- src/student/Jason/
- src/student/Abraham/
- src/student/ChrisS/
- src/student/ChrisP/

Rules
- Do not edit files outside your folder unless the maintainer asks.
- Keep changes scoped to the requested feature. Avoid refactors.
- Do not edit assets/ or src/generated/.
- Logging must be behind debug flags in src/debugFlags.ts.
- Keep an index.ts in your folder; it is auto-discovered.

Entry point
- Your system entry file is src/student/<Name>/index.ts.
- Use src/studentSdk.ts for registration and safe hooks.

If you need new hooks or APIs, ask the maintainer.
