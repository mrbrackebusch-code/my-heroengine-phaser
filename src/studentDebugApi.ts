import type Phaser from "phaser";
import type { StudentApi } from "./studentApi";
import type { HeroDir, HeroFamily, HeroPhase } from "./heroAtlas";

export type StudentDebugHeroSpawnOptions = {
    heroName?: string;
    family?: HeroFamily;
    phase?: HeroPhase;
    dir?: HeroDir;
    x?: number;
    y?: number;
};

export type StudentDebugProfileHeroOptions = {
    profile?: string;
    family?: HeroFamily;
    phase?: HeroPhase;
    dir?: HeroDir;
    x?: number;
    y?: number;
};

export type StudentDebugHelpers = {
    addLabel: (text: string, opts?: { x?: number; y?: number; fontSize?: number; color?: string }) => Phaser.GameObjects.Text;
    addPlaceholderHero: (opts?: { x?: number; y?: number; label?: string; color?: number }) => Phaser.GameObjects.Container;
    addGrid: (opts?: { cell?: number; color?: number; alpha?: number }) => Phaser.GameObjects.Graphics;
    spawnHero: (opts?: StudentDebugHeroSpawnOptions) => Phaser.GameObjects.Sprite | null;
    spawnProfileHero: (opts?: StudentDebugProfileHeroOptions) => Phaser.GameObjects.Sprite | null;
};

export type StudentDebugApi = StudentApi & {
    scene: Phaser.Scene;
    game: Phaser.Game;
    overlayMountId: string;
    helpers: StudentDebugHelpers;
};

export type StudentDebugContext = {
    student: string;
    api: StudentDebugApi;
    scene: Phaser.Scene;
    game: Phaser.Game;
};

export type StudentDebugDefinition = {
    preload?: (ctx: StudentDebugContext) => void;
    create?: (ctx: StudentDebugContext) => void;
    update?: (ctx: StudentDebugContext, time: number, delta: number) => void;
};

export type StudentDebugModule = StudentDebugDefinition | ((ctx: StudentDebugContext) => void);
