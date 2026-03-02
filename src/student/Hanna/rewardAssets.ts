import type { Reward } from "./types";

export const RELIC_ASSET_BY_ID: Record<string, string> = {
    hanna_legend_relic: "/src/student/Hanna/assets/relics/hanna_legend_relic_32x32.png",
    hanna_combo_relic: "/src/student/Hanna/assets/relics/hanna_combo_relic_32x32.png",
    hanna_guardian_relic: "/src/student/Hanna/assets/relics/hanna_guardian_relic_32x32.png",
    hanna_swiftness_relic: "/src/student/Hanna/assets/relics/hanna_swiftness_relic_32x32.png",
};

export function getRelicAssetPath(relicId?: string | null): string | undefined {
    if (!relicId) return undefined;
    return RELIC_ASSET_BY_ID[relicId];
}

export function getRewardVisuals(reward: Reward): { relicAssetPath?: string } {
    return {
        relicAssetPath: getRelicAssetPath(reward.relicId),
    };
}
