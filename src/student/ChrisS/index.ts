import { registerStudentSystem } from "../../studentSdk";

registerStudentSystem({
    id: "ChrisS",
    name: "ChrisS",
    register(api) {
        const base = (id: string, name: string, effectText: string, flavor: string, color: string) => ({
            id,
            name,
            effectText,
            flavorText: flavor || "",
            rarity: "relic",
            uiHints: { kind: "amulet", glyphText: color },
        });

        api.relics.register(base("amulet_water", "Amulet of Tides", "Grants water affinity; slows burning.", "A star-shaped amulet with a blue sheen. Harnesses the power of the tides.", "blue"));
        api.relics.register(base("amulet_wind", "Amulet of Zephyrs", "Increases dodge chance; boosts speed.", "A star-shaped amulet with a white shimmer. Calls upon the swiftness of the gale.", "white"));
        api.relics.register(base("amulet_fire", "Amulet of Embers", "Adds fire damage to attacks; ignites small foes.", "A star-shaped amulet with a warm red glow. Contains the fury of an ever-burning ember.", "red"));
        api.relics.register(base("amulet_poison", "Amulet of Venom", "Attacks apply minor poison over time.", "A star-shaped amulet with a purple tint. Infused with a slow-acting, potent toxin.", "purple"));
        api.relics.register(base("amulet_earth", "Amulet of Stones", "Increases defense and resistance to knockback.", "A star-shaped amulet with an earthy brown luster. Anchored with the strength of the earth.", "brown"));
    },
});
