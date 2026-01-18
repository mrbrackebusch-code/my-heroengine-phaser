// Use the global img`` implementation provided by arcadeCompat.ts
declare function img(strings: TemplateStringsArray, ...expr: any[]): Image;

// Phaser-only glue for HeroEngine. Blockly logic is wired inside HeroEngineInPhaser.
export function initHeroEngineHostOverrides() {
    const g: any = globalThis as any;
    const engineNS: any = g.HeroEngine;
    if (!engineNS) {
        console.warn("[heroEnginePhaserGlue] HeroEngine namespace not found on globalThis");
    }
}

//Keep this at the end of the file
// Export HeroEngine runtime to global for netWorld snapshots
game.onUpdate(function () {
    const now = game.runtime() | 0;
    (globalThis as any).__heroEngineWorldRuntimeMs = now;
});
//Keep this at the end of the file
//Keep this at the end of the file
