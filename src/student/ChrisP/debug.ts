import type { StudentDebugContext } from "../../studentSystemsHooks";
import { listQuests, listQuestSources } from "../../studentSystemsHooks";

export default function debug(ctx: StudentDebugContext): void {
    const { api, student } = ctx;
    const profile = student;

    api.helpers.addGrid({ cell: 48, alpha: 0.3 });
    api.helpers.addLabel(`Debug sandbox: ${profile}`, { x: 16, y: 16, fontSize: 18 });

    const hero = api.helpers.spawnProfileHero({ profile, phase: "idle", dir: "down" });
    if (!hero) {
        api.helpers.addPlaceholderHero({ label: profile });
    }

    // Quest debugging
    const quests = listQuests();
    const sources = listQuestSources();

    api.helpers.addLabel(`Quests: ${quests.length}`, { x: 16, y: 50, fontSize: 14 });
    quests.forEach((quest, index) => {
        api.helpers.addLabel(`${quest.id}: ${quest.title} - ${quest.description}`, { x: 16, y: 70 + index * 20, fontSize: 12 });
    });

    api.helpers.addLabel(`Quest Sources: ${sources.length}`, { x: 16, y: 70 + quests.length * 20 + 20, fontSize: 14 });
    sources.forEach((source, index) => {
        api.helpers.addLabel(`${source.id}: ${source.kind} - ${source.questIds.join(', ')}`, { x: 16, y: 90 + quests.length * 20 + 20 + index * 20, fontSize: 12 });
    });
}
