#!/usr/bin/env node

// generate_wisp_placeholder.mjs
// Generates a basic placeholder spritesheet for the wisp pet.
// Run with: node generate_wisp_placeholder.mjs

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const FRAME_W = 32;
const FRAME_H = 32;
const FRAMES = 16;
const SHEET_W = FRAME_W * FRAMES;
const SHEET_H = FRAME_H;

// Create a new PNG image
const png = new PNG({ width: SHEET_W, height: SHEET_H });

// Fill with transparent background
for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) {
        const idx = (SHEET_W * y + x) << 2;
        png.data[idx] = 0;     // R
        png.data[idx + 1] = 0; // G
        png.data[idx + 2] = 0; // B
        png.data[idx + 3] = 0; // A (transparent)
    }
}

// Draw a simple wisp (blue circle with glow) for each frame
for (let frame = 0; frame < FRAMES; frame++) {
    const centerX = frame * FRAME_W + FRAME_W / 2;
    const centerY = FRAME_H / 2;
    const radius = 12 + Math.sin(frame * 0.5) * 2; // Slight variation

    // Draw circle with glow
    for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
            const dx = x - (centerX - frame * FRAME_W);
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < radius) {
                const alpha = Math.max(0, 255 - dist * 20);
                const idx = (SHEET_W * y + (frame * FRAME_W + x)) << 2;
                png.data[idx] = 100;     // R (blue-ish)
                png.data[idx + 1] = 150; // G
                png.data[idx + 2] = 255; // B
                png.data[idx + 3] = alpha; // A
            }
        }
    }
}

// Save the PNG
const outputPath = path.join(process.cwd(), "src", "student", "Alan", "assets", "pets", "wisp 32x32.png");
png.pack().pipe(fs.createWriteStream(outputPath));

console.log(`Placeholder wisp spritesheet generated at: ${outputPath}`);
console.log("This is a basic blue circle with slight variations. Replace with your custom design!");