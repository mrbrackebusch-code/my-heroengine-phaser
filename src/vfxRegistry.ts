// VFX registry + helpers (no asset authoring here).
// Presets should be thin wrappers around existing effect sheets.

export type VfxContext = {
    nowMs: number;
};

export type VfxPreset<TParams = any> = (ctx: VfxContext, params: TParams) => void;

export type VfxRegistry = {
    register: <TParams = any>(id: string, preset: VfxPreset<TParams>) => void;
    run: <TParams = any>(id: string, params: TParams, ctx?: Partial<VfxContext>) => boolean;
    has: (id: string) => boolean;
    list: () => string[];
};

export type VfxHelpers = {
    spawnEffect: (args: {
        x: number;
        y: number;
        z?: number;
        skinId: string;
        opts?: any;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
    }) => Sprite;
    spawnLayered: (args: {
        x: number;
        y: number;
        z?: number;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
        layers: Array<{
            skinId: string;
            offsetX?: number;
            offsetY?: number;
            z?: number;
            opts?: any;
        }>;
    }) => Sprite[];
    spawnBurstRect: (args: {
        x: number;
        y: number;
        w: number;
        h: number;
        count: number;
        skinId: string;
        opts?: any;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
    }) => Sprite[];
};

type VfxDeps = {
    applyEffect: (s: Sprite, skinId: string, opts?: any) => void;
    getEffectDummyImage: () => Image;
    nowMs: () => number;
};

function _mergeOpts(base: any, patch: any): any {
    if (!base) return patch || {};
    if (!patch) return base;
    return { ...base, ...patch };
}

export function createVfxRegistry(deps: VfxDeps): { registry: VfxRegistry; helpers: VfxHelpers } {
    const presets = new Map<string, VfxPreset<any>>();

    const registry: VfxRegistry = {
        register: <TParams = any>(id: string, preset: VfxPreset<TParams>) => {
            const key = String(id || "").trim();
            if (!key || typeof preset !== "function") return;
            presets.set(key, preset as VfxPreset<any>);
        },
        run: <TParams = any>(id: string, params: TParams, ctx?: Partial<VfxContext>) => {
            const key = String(id || "").trim();
            if (!key) return false;
            const preset = presets.get(key);
            if (!preset) return false;
            const nowMs = deps.nowMs ? (deps.nowMs() | 0) : 0;
            preset({ nowMs, ...(ctx || {}) }, params);
            return true;
        },
        has: (id: string) => presets.has(String(id || "").trim()),
        list: () => Array.from(presets.keys())
    };

    const spawnEffect = (args: {
        x: number;
        y: number;
        z?: number;
        skinId: string;
        opts?: any;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
    }): Sprite => {
        const skinId = String(args.skinId || "").trim();
        const kind = (args.kind != null) ? (args.kind | 0) : (SpriteKind.HeroEffect | 0);
        const fx = sprites.create(deps.getEffectDummyImage(), kind as any);
        const ghost = (args.ghost == null) ? true : !!args.ghost;
        if (ghost) fx.setFlag(SpriteFlag.Ghost, true);
        fx.x = args.x | 0;
        fx.y = args.y | 0;
        if (args.z != null) fx.z = args.z | 0;
        if (args.lifespanMs != null && (args.lifespanMs | 0) > 0) {
            fx.lifespan = args.lifespanMs | 0;
        }
        if (skinId) deps.applyEffect(fx, skinId, args.opts);
        return fx;
    };

    const spawnLayered = (args: {
        x: number;
        y: number;
        z?: number;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
        layers: Array<{
            skinId: string;
            offsetX?: number;
            offsetY?: number;
            z?: number;
            opts?: any;
        }>;
    }): Sprite[] => {
        const out: Sprite[] = [];
        const baseX = args.x | 0;
        const baseY = args.y | 0;
        const baseZ = (args.z != null) ? (args.z | 0) : 0;
        for (let i = 0; i < args.layers.length; i++) {
            const layer = args.layers[i];
            if (!layer || !layer.skinId) continue;
            const lx = (baseX + (layer.offsetX | 0)) | 0;
            const ly = (baseY + (layer.offsetY | 0)) | 0;
            const lz = (layer.z != null) ? (layer.z | 0) : baseZ;
            const fx = spawnEffect({
                x: lx,
                y: ly,
                z: lz,
                skinId: layer.skinId,
                opts: _mergeOpts(layer.opts, null),
                kind: args.kind,
                lifespanMs: args.lifespanMs,
                ghost: args.ghost
            });
            out.push(fx);
        }
        return out;
    };

    const spawnBurstRect = (args: {
        x: number;
        y: number;
        w: number;
        h: number;
        count: number;
        skinId: string;
        opts?: any;
        kind?: number;
        lifespanMs?: number;
        ghost?: boolean;
    }): Sprite[] => {
        const out: Sprite[] = [];
        const count = Math.max(0, args.count | 0);
        if (count <= 0) return out;
        const halfW = Math.max(0, Math.idiv(args.w | 0, 2)) | 0;
        const halfH = Math.max(0, Math.idiv(args.h | 0, 2)) | 0;
        for (let i = 0; i < count; i++) {
            const ox = Math.randomRange(-halfW, halfW) | 0;
            const oy = Math.randomRange(-halfH, halfH) | 0;
            out.push(spawnEffect({
                x: (args.x + ox) | 0,
                y: (args.y + oy) | 0,
                z: undefined,
                skinId: args.skinId,
                opts: args.opts,
                kind: args.kind,
                lifespanMs: args.lifespanMs,
                ghost: args.ghost
            }));
        }
        return out;
    };

    return {
        registry,
        helpers: {
            spawnEffect,
            spawnLayered,
            spawnBurstRect
        }
    };
}
