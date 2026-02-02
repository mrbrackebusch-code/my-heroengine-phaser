// Student-editable debug overrides (these override corresponding flags in src/debugFlags.ts).
// Flip these to true and reload to enable logs without touching core files.

export type StudentDebugOverrides = {
    overlayLogs?: boolean;
    systemsLogs?: boolean;
    uiLogs?: boolean;
    uiApiLogs?: boolean;
    interactLogs?: boolean;
    propInteractLogs?: boolean;
    trapLogs?: boolean;
    shrineOverlayLogs?: boolean;
};

export const STUDENT_DEBUG_OVERRIDES: StudentDebugOverrides = {
    overlayLogs: false,
    systemsLogs: false,
    uiLogs: false,
    uiApiLogs: false,
    interactLogs: false,
    propInteractLogs: false,
    trapLogs: false,
    shrineOverlayLogs: false,
};
