import type { Card } from "./types";
import { getRarityDisplay, getVariantDisplay } from "./cardFactory";

/**
 * Card Renderer — generates DOM elements for cards with dynamic labels.
 * 
 * The renderer takes a Card object and creates an HTML card element
 * with the appropriate background template and dynamically rendered labels
 * (Stat, Rarity, Variant) that update based on card data.
 */

export interface CardRendererOptions {
    width?: number; // default 256
    height?: number; // default 360
    onCardClick?: (card: Card) => void;
}

/** Map rarity to template background class and PNG filename */
function getRarityClass(rarity: string): string {
    switch (rarity) {
        case "common":
            return "card-rarity-common";
        case "uncommon":
            return "card-rarity-uncommon";
        case "rare":
            return "card-rarity-rare";
        case "legendary":
            return "card-rarity-legendary";
        default:
            return "card-rarity-common";
    }
}

/** Map rarity to PNG filename (relative to project root for debug.html) */
function getRarityImage(rarity: string): string {
    // Use absolute path from project root for debug.html
    switch (rarity) {
        case "common":
            return "src/student/Hanna/assets/cards/1.png";
        case "uncommon":
            return "src/student/Hanna/assets/cards/2.png";
        case "rare":
            return "src/student/Hanna/assets/cards/3.png";
        case "legendary":
            return "src/student/Hanna/assets/cards/4.png";
        default:
            return "src/student/Hanna/assets/cards/1.png";
    }
}

/**
 * Create a DOM element for a card with dynamic labels.
 * 
 * @param card The card to render
 * @param options Rendering options (width, height, click handler)
 * @returns HTMLElement representing the card
 */
export function renderCard(card: Card, options?: CardRendererOptions): HTMLElement {
    const width = options?.width || 256;
    const height = options?.height || 360;

    const container = document.createElement("div");
    container.className = `card ${getRarityClass(card.rarity)}`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.position = "relative";
    container.style.cursor = options?.onCardClick ? "pointer" : "default";
    container.setAttribute("data-card-id", card.id);

    // Background (template image)
    const background = document.createElement("div");
    background.className = "card-background";
    background.style.position = "absolute";
    background.style.inset = "0";
    background.style.backgroundSize = "cover";
    background.style.backgroundPosition = "center";
    background.style.backgroundImage = `url('${getRarityImage(card.rarity)}')`;
    container.appendChild(background);

    // Overlay container for labels
    const overlay = document.createElement("div");
    overlay.className = "card-overlay";
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "space-between";
    overlay.style.padding = "12px";
    overlay.style.pointerEvents = "none";
    container.appendChild(overlay);

    // Variant overlay only (no rarity overlay)
    const variantText = getVariantDisplay(card.variant);
    if (variantText) {
        const variantElem = document.createElement("div");
        variantElem.className = "card-variant-text";
        variantElem.textContent = variantText;
        variantElem.style.position = "absolute";
        variantElem.style.top = "8px";
        variantElem.style.right = "12px";
        variantElem.style.fontSize = "13px";
        variantElem.style.fontWeight = "bold";
        variantElem.style.color = "#222";
        variantElem.style.background = "rgba(255,255,255,0.7)";
        variantElem.style.padding = "2px 8px";
        variantElem.style.borderRadius = "6px";
        variantElem.style.pointerEvents = "none";
        overlay.appendChild(variantElem);
    }

    // Center: Stat (large prominent number)
    const center = document.createElement("div");
    center.className = "card-stat-container";
    center.style.display = "flex";
    center.style.justifyContent = "center";
    center.style.alignItems = "center";
    center.style.flex = "1";
    
    const statNumber = document.createElement("div");
    statNumber.className = "card-stat-number";
    statNumber.textContent = String(card.stat);
    statNumber.style.fontSize = "48px";
    statNumber.style.fontWeight = "bold";
    statNumber.style.color = "#000";
    statNumber.style.textShadow = "2px 2px 4px rgba(255,255,255,0.8)";
    center.appendChild(statNumber);
    overlay.appendChild(center);

    // No GMGBH label overlay

    // Click handler
    if (options?.onCardClick) {
        container.addEventListener("click", () => options.onCardClick?.(card));
    }

    return container;
}

/**
 * Create a grid of card DOM elements from an array of cards.
 * 
 * @param cards Array of cards to render
 * @param options Rendering options
 * @returns HTMLElement container with grid layout
 */
export function renderCardGrid(cards: Card[], options?: CardRendererOptions & { columns?: number }): HTMLElement {
    const columns = options?.columns || 3;
    const container = document.createElement("div");
    container.className = "card-grid";
    container.style.display = "grid";
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    container.style.gap = "16px";
    container.style.padding = "16px";

    for (const card of cards) {
        const cardElem = renderCard(card, options);
        container.appendChild(cardElem);
    }

    return container;
}

/**
 * Update a card element's labels after the card data changes.
 * Useful for dynamic updates during gameplay.
 * 
 * @param container The card DOM container to update
 * @param card The updated card data
 */
export function updateCardLabels(container: HTMLElement, card: Card): void {
    // Update rarity display
    const rarityText = container.querySelector(".card-rarity-text");
    if (rarityText) {
        rarityText.textContent = getRarityDisplay(card.rarity as any);
    }

    // Update variant display (show/hide based on variant)
    let variantElem = container.querySelector(".card-variant-text");
    const variantText = getVariantDisplay(card.variant);
    
    if (variantText) {
        if (!variantElem) {
            variantElem = document.createElement("div");
            variantElem.className = "card-variant-text";
            variantElem.style.fontSize = "10px";
            variantElem.style.marginTop = "2px";
            const topRight = container.querySelector(".card-top-right");
            if (topRight) topRight.appendChild(variantElem);
        }
        variantElem.textContent = variantText;
    } else if (variantElem) {
        variantElem.remove();
    }

    // Update stat number
    const statNumber = container.querySelector(".card-stat-number");
    if (statNumber) {
        statNumber.textContent = String(card.stat);
    }

    // Update container class for rarity-based styling
    container.className = `card ${getRarityClass(card.rarity)}`;
}
