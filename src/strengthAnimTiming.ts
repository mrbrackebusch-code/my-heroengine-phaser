// Shared timing knobs for strength custom animation.
// Keep heroAnimGlue and HeroEngineInPhaser in sync by importing from here.
export const STR_SWING_WINDUP_FRAME_MS = [1000, 1000, 1000]; //[60, 60, 60];
export const STR_SWING_FORWARD_FRAME_MS = [1000, 1000, 1000]; //[80, 80, 80];
export const STR_SWING_RESET_FRAME_COLS = [1, 2, 1, 0];
export const STR_SWING_RESET_FRAME_MS = [1000, 1000, 1000, 1000]; //[80, 80, 80, 80];

// Back-compat names used elsewhere in the engine.
export const STR_SWING_RETURN_FRAME_COLS = STR_SWING_RESET_FRAME_COLS;
export const STR_SWING_RETURN_FRAME_MS = STR_SWING_RESET_FRAME_MS;

export const STR_SWING_RESET_INTRO_MS = 60;
export const STR_SWING_RESET_OUTRO_MS = 55;
