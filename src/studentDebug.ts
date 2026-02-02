export type StudentDebugStartFloorOverride = {
    profile: string;
    floorIndex?: number;
    kind?: string;
    enabled?: boolean;
};

const _startFloorsByProfile = new Map<string, StudentDebugStartFloorOverride>();

const _normProfile = (raw: any): string => {
    if (typeof raw !== "string") return "";
    return raw.trim();
};

export function registerStudentDebugStartFloor(def: StudentDebugStartFloorOverride): string {
    const profile = _normProfile(def?.profile);
    if (!profile) return "";
    const entry: StudentDebugStartFloorOverride = {
        ...def,
        profile,
    };
    _startFloorsByProfile.set(profile, entry);
    return profile;
}

export function getStudentDebugStartFloor(profileRaw: any): StudentDebugStartFloorOverride | null {
    const profile = _normProfile(profileRaw);
    if (!profile) return null;
    return _startFloorsByProfile.get(profile) || null;
}

export function listStudentDebugStartFloors(): StudentDebugStartFloorOverride[] {
    return Array.from(_startFloorsByProfile.values());
}

export function pickStudentDebugStartFloor(profilesInOrder: string[]): StudentDebugStartFloorOverride | null {
    const profiles = Array.isArray(profilesInOrder) ? profilesInOrder : [];
    for (let i = 0; i < profiles.length; i++) {
        const profile = _normProfile(profiles[i]);
        if (!profile) continue;
        const entry = _startFloorsByProfile.get(profile);
        if (!entry) continue;
        const enabled = (typeof entry.enabled === "boolean") ? entry.enabled : true;
        if (!enabled) continue;
        const hasValue = (typeof entry.floorIndex === "number") || (typeof entry.kind === "string" && entry.kind.trim());
        if (!hasValue) continue;
        return entry;
    }
    return null;
}
