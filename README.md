## Licensing
Code: see `LICENSE`. Third-party art/assets: see `COPYING.txt` and `/licensing`.

## Trademark
Not affiliated with or endorsed by Microsoft. “MakeCode” is a Microsoft trademark.



# HeroEngine (Phaser wrapper + multiplayer)

A Phaser-based runtime/wrapper for MakeCode Arcade-style gameplay, plus a small WebSocket server for multiplayer experiments.

## To-Do
- Cutscenes/camera system: design + implement robust scene runner (zoom, pans, actor control, timing, interrupts) with debug output.
- Effects system: finish “spawn effect by element” pipeline + helpers; verify smoke/dust/poison triggers on demand (explicit test hooks).
- Effects hall: add controlled test cases (static smoke, alive smoke, fade smoke) and verify texture masking/tinting.
- Palettes: brighten enemy palettes to align with LPC hues (still darker than hero effects, not murky).
- Debug dump: expand coverage for all effect sprites + masks + applied changes; validate in effects hall with repeatable snapshots.
- Shrine: rewrite the “what we are looking for” block script to be blunt/explicit with story-like variable names (readable, not tricky).
- Shrine: ensure the blessing effect is floor-wide and applies to all heroes consistently.
- Shrine: add a global screen particle/visual effect while the blessing is active (rainbow ambient), separate from local shrine overlay/sparkles.


## Setup to run locally

Prereqs:
- Node.js (recent LTS)

Install:
```bash
npm install
```

## Run locally
Start multiplayer server (WebSocket, port 8080):

node server.js


Start dev server (Vite):

npm run dev

##Licensing (please read)
My code in this repo (the “Project Code”)

PolyForm Noncommercial License 1.0.0 — noncommercial use only, and you must keep the required attribution notices.
See LICENSE.

If you want to use Project Code commercially (e.g., App Store / paid distribution), contact:
mrbrackebusch@gmail.com


##Third-party code and assets

This repo also contains third-party code and art assets under their own licenses.
See:

COPYING.txt

/licensing/ (credits + license texts)
