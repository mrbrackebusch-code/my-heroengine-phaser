# VFX Requests

Use this file to track all requested effects before implementation.
Each request must explicitly list required assets and the user decision.

## Active Requests

| ID | Request | Use Case | Assets Needed / Choices | User Choice | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| VFX-001 | Reusable smoke variants (dust, poison, sky cloud) | Pad sink, bombs, ambience | Base smoke sheet (confirm `smoke 128x128` or other). Texture fill from `assets/effects/textures` (magic2 texture / waves1 texture). Optional aura variants. | Dust: waves1 texture 256x256. Other variants TBD (magic2 was initial choice). | needs-asset-choice | Need confirm base smoke ID + dust/cloud overlay choices + blend order. Rule: no heroEffects on enemies. |
| VFX-002 | Ambient screen overlay per floor theme | Floor "feel" / haze | Overlay sheet(s) to use and blend mode(s). |  | needs-asset-choice | Could be full-screen or anchored. |

## Completed / Implemented

| ID | Request | Assets Used | Location | Notes |
| --- | --- | --- | --- | --- |
| VFX-000 |  |  |  |  |
