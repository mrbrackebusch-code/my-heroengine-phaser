import { registerStudentSystem } from "../../studentSdk";
import { setupPetDefinitions } from "./petDefs";
import { setupPetBehaviors } from "./petBehavior";
import { setupPetInventory } from "./petInventory";
import { setupPetCombat } from "./petCombat";
import { setupPetXpProgression } from "./petXpSystem";

registerStudentSystem({
    id: "Alan",
    name: "Alan",
    register: (api) => {
        // Pet system setup
        setupPetDefinitions(api);
        setupPetBehaviors(api);
        setupPetInventory(api);
        setupPetCombat(api);
        setupPetXpProgression(api);
    },
});
