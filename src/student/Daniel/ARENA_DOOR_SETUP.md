/**
 * Arena Door Integration Setup
 * 
 * This file shows how to integrate the ArenaDoor into your HeroScene.
 * 
 * QUICK SETUP:
 * In src/main.ts, find the HeroScene.create() method (around line 1717)
 * and add these lines after other scene setup:
 * 
 *   // Import at the top:
 *   import { arenaEntrance, ArenaDoor } from "./student/Daniel";
 * 
 *   // Then in create(), after this.tileRenderer is set up:
 *   this._arenaDoor = new ArenaDoor(this, arenaEntrance, 500, 300);
 *   this._arenaDoor.create();
 * 
 * STEP-BY-STEP:
 * 
 * 1. Add import at top of src/main.ts:
 *    import { arenaEntrance, ArenaDoor } from "./student/Daniel";
 * 
 * 2. Add field to HeroScene class (around line 1545):
 *    private _arenaDoor?: ArenaDoor;
 * 
 * 3. In create() method (around line 1717), after tile setup, add:
 *    this._arenaDoor = new ArenaDoor(this, arenaEntrance, 500, 300);
 *    this._arenaDoor.create();
 * 
 * 4. In update() method, the door will be interactive (no update needed)
 * 
 * 5. When leaving the scene, optionally add cleanup
 *    this._arenaDoor?.destroy();
 * 
 * DOOR PARAMETERS:
 * - Scene: the Phaser scene
 * - Arena: the ArenaEntrance instance
 * - X: world x coordinate (e.g., 500)
 * - Y: world y coordinate (e.g., 300)
 * 
 * The door will spawn at (500, 300) in world coordinates.
 * Adjust X/Y based on where you want it in your map.
 */

export const ARENA_DOOR_SETUP_INSTRUCTIONS = `
ArenaDoor Integration Steps:

1. Edit src/main.ts:
   - Add import: import { arenaEntrance, ArenaDoor } from "./student/Daniel";
   - Add field to HeroScene: private _arenaDoor?: ArenaDoor;
   - In create() add: this._arenaDoor = new ArenaDoor(this, arenaEntrance, 500, 300); this._arenaDoor.create();

2. Customize position by changing the 500, 300 coordinates as needed.

3. The door will be clickable and log entrance state to console.

4. Wire entrance countdown to actual combat logic as desired.
`;
