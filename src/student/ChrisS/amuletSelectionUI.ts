import type { StudentApi } from "../../studentApi";

export type AmuletOption = {
    id: string;
    name: string;
    effectText: string;
    flavorText: string;
    color: string;
    stats: string[];
};

const AMULETS: AmuletOption[] = [
    {
        id: "amulet_water",
        name: "Amulet of Tides",
        effectText: "Grants water affinity; slows burning.",
        flavorText: "A star-shaped amulet with a blue sheen. Harnesses the power of the tides.",
        color: "blue",
        stats: [
            "Movement Speed: +15%",
            "Every 5 Strength moves: Knockback wave",
            "Intelligence: Bubble trap (2.5s stun)",
        ],
    },
    {
        id: "amulet_wind",
        name: "Amulet of Zephyrs",
        effectText: "Increases dodge chance; boosts speed.",
        flavorText: "A star-shaped amulet with a white shimmer. Calls upon the swiftness of the gale.",
        color: "white",
        stats: [
            "Movement Speed: +15%",
            "Strength Moves: +5% speed boost",
            "Intelligence: Tornado pull (pulls enemies)",
        ],
    },
    {
        id: "amulet_fire",
        name: "Amulet of Embers",
        effectText: "Adds fire damage to attacks; ignites small foes.",
        flavorText: "A star-shaped amulet with a warm red glow. Contains the fury of an ever-burning ember.",
        color: "red",
        stats: [
            "Movement Speed: +10%",
            "Burn on hit: 2% enemy health/0.5s (2s total)",
            "Every 3 Strength moves: 1s stun",
        ],
    },
    {
        id: "amulet_poison",
        name: "Amulet of Venom",
        effectText: "Attacks apply minor poison over time.",
        flavorText: "A star-shaped amulet with a purple tint. Infused with a slow-acting, potent toxin.",
        color: "purple",
        stats: [
            "Movement Speed: +12%",
            "Poison on hit: 2% health/0.5s (1.5s total)",
            "Debuff: -5% defense & attack (stacks to -20%)",
        ],
    },
    {
        id: "amulet_earth",
        name: "Amulet of Stones",
        effectText: "Increases defense and resistance to knockback.",
        flavorText: "A star-shaped amulet with an earthy brown luster. Anchored with the strength of the earth.",
        color: "brown",
        stats: [
            "Movement Speed: -10%",
            "Defense: +20%",
            "Strength: 360° knockback (4s cooldown)",
            "Intelligence: Rock drop (2s stun)",
        ],
    },
];

export function showAmuletSelectionUI(api: StudentApi, onSelected: (amuletId: string) => void): void {
    let selectedAmulet: AmuletOption | null = null;

    // Create main container
    const container = document.createElement("div");
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;

    // Create modal
    const modal = document.createElement("div");
    modal.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 3px solid #0f3460;
        border-radius: 12px;
        padding: 30px;
        max-width: 900px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.9);
    `;

    // Title
    const title = document.createElement("h1");
    title.textContent = "Choose Your Amulet Reward";
    title.style.cssText = `
        color: #e0e0e0;
        text-align: center;
        margin-bottom: 20px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
    `;
    modal.appendChild(title);

    // Amulet grid
    const grid = document.createElement("div");
    grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
    `;

    // Create amulet buttons
    for (const amulet of AMULETS) {
        const button = document.createElement("button");
        button.style.cssText = `
            background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
            border: 2px solid ${amulet.color === "blue" ? "#4a9eff" : amulet.color === "white" ? "#e0e0e0" : amulet.color === "red" ? "#ff4444" : amulet.color === "purple" ? "#aa44ff" : "#8b7355"};
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            color: #e0e0e0;
            font-weight: bold;
            transition: all 0.3s;
            text-align: center;
        `;

        button.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 8px; color: ${amulet.color === "blue" ? "#4a9eff" : amulet.color === "white" ? "#e0e0e0" : amulet.color === "red" ? "#ff4444" : amulet.color === "purple" ? "#aa44ff" : "#8b7355"};">★</div>
            <div style="font-size: 13px;">${amulet.name}</div>
        `;

        button.onmouseover = () => {
            button.style.transform = "scale(1.05)";
            button.style.boxShadow = `0 0 15px ${amulet.color === "blue" ? "#4a9eff" : amulet.color === "white" ? "#e0e0e0" : amulet.color === "red" ? "#ff4444" : amulet.color === "purple" ? "#aa44ff" : "#8b7355"}`;
        };

        button.onmouseout = () => {
            button.style.transform = "scale(1)";
            button.style.boxShadow = "none";
        };

        button.onclick = () => {
            selectedAmulet = amulet;
            updateDetailPanel();
            // Highlight selected button
            for (const btn of grid.querySelectorAll("button")) {
                btn.style.border = "2px solid " + (btn === button ? "#ffff00" : (amulet.color === "blue" ? "#4a9eff" : amulet.color === "white" ? "#e0e0e0" : amulet.color === "red" ? "#ff4444" : amulet.color === "purple" ? "#aa44ff" : "#8b7355"));
            }
        };

        grid.appendChild(button);
    }

    modal.appendChild(grid);

    // Detail panel
    const detailPanel = document.createElement("div");
    detailPanel.style.cssText = `
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid #0f3460;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        min-height: 150px;
    `;

    const updateDetailPanel = () => {
        if (!selectedAmulet) {
            detailPanel.innerHTML = '<div style="color: #888; text-align: center;">Select an amulet to view details</div>';
            return;
        }

        detailPanel.innerHTML = `
            <div style="margin-bottom: 12px;">
                <div style="color: ${selectedAmulet.color === "blue" ? "#4a9eff" : selectedAmulet.color === "white" ? "#e0e0e0" : selectedAmulet.color === "red" ? "#ff4444" : selectedAmulet.color === "purple" ? "#aa44ff" : "#8b7355"}; font-size: 18px; font-weight: bold; margin-bottom: 4px;">${selectedAmulet.name}</div>
                <div style="color: #aaa; font-size: 13px; margin-bottom: 8px;">${selectedAmulet.effectText}</div>
                <div style="color: #888; font-size: 12px; font-style: italic; margin-bottom: 12px;">"${selectedAmulet.flavorText}"</div>
            </div>
            <div style="color: #e0e0e0; font-size: 14px;">
                <div style="margin-bottom: 4px; font-weight: bold; color: #ffff00;">Stats:</div>
                ${selectedAmulet.stats.map(stat => `<div style="margin-left: 12px; margin-bottom: 4px;">• ${stat}</div>`).join("")}
            </div>
        `;
    };

    detailPanel.innerHTML = '<div style="color: #888; text-align: center;">Select an amulet to view details</div>';
    modal.appendChild(detailPanel);

    // Buttons container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;

    // Confirm button
    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Confirm Selection";
    confirmButton.style.cssText = `
        background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
        border: 2px solid #27ae60;
        border-radius: 6px;
        padding: 12px 24px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
    `;

    confirmButton.onmouseover = () => {
        confirmButton.style.transform = "scale(1.05)";
    };

    confirmButton.onmouseout = () => {
        confirmButton.style.transform = "scale(1)";
    };

    confirmButton.onclick = () => {
        if (!selectedAmulet) {
            alert("Please select an amulet first!");
            return;
        }

        // Show confirmation popup
        showConfirmationPopup(selectedAmulet.name, () => {
            container.remove();
            onSelected(selectedAmulet.id);
        });
    };

    buttonContainer.appendChild(confirmButton);
    modal.appendChild(buttonContainer);

    container.appendChild(modal);
    document.body.appendChild(container);
}

function showConfirmationPopup(amuletName: string, onConfirm: () => void): void {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    const popup = document.createElement("div");
    popup.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 3px solid #e0e0e0;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.9);
        max-width: 400px;
    `;

    const message = document.createElement("div");
    message.style.cssText = `
        color: #e0e0e0;
        font-size: 18px;
        margin-bottom: 20px;
        line-height: 1.5;
    `;
    message.innerHTML = `Are you sure you want to select<br><span style="color: #ffff00; font-weight: bold;">${amuletName}</span>?`;
    popup.appendChild(message);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;

    const yesButton = document.createElement("button");
    yesButton.textContent = "Yes, Confirm";
    yesButton.style.cssText = `
        background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
        border: 2px solid #27ae60;
        border-radius: 6px;
        padding: 10px 20px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
    `;

    yesButton.onmouseover = () => {
        yesButton.style.transform = "scale(1.05)";
    };

    yesButton.onmouseout = () => {
        yesButton.style.transform = "scale(1)";
    };

    yesButton.onclick = () => {
        overlay.remove();
        onConfirm();
    };

    const noButton = document.createElement("button");
    noButton.textContent = "Cancel";
    noButton.style.cssText = `
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        border: 2px solid #c0392b;
        border-radius: 6px;
        padding: 10px 20px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
    `;

    noButton.onmouseover = () => {
        noButton.style.transform = "scale(1.05)";
    };

    noButton.onmouseout = () => {
        noButton.style.transform = "scale(1)";
    };

    noButton.onclick = () => {
        overlay.remove();
    };

    buttonContainer.appendChild(yesButton);
    buttonContainer.appendChild(noButton);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}
