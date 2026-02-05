import { registerStudentSystem } from "../../studentSdk";
import { setupPetDefinitions } from "./petDefs";
import { setupPetBehaviors } from "./petBehavior";
import { setupPetInventory } from "./petInventory";
import { setupPetCombat } from "./petCombat";

registerStudentSystem({
    id: "Alan",
    name: "Alan",
    register: (api) => {
        // Pet system setup
        setupPetDefinitions(api);
        setupPetBehaviors(api);
        setupPetInventory(api);
        setupPetCombat(api);
    },
});
