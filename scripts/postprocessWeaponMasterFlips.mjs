#!/usr/bin/env node
/**
 * Post-process vertical flips for selected weapons in the master atlas.
 * This is a FINAL step: flips pixels in-place and recomputes tip/butt.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const META_PATH = path.join(ROOT, "src", "generated", "weaponMasterMeta.ts");
const MASTER_DIR = path.join(ROOT, "assets", "weapons", "_master");

const FLIPS = [
  { weaponId: "bow_arrow" },
  { weaponId: "crossbow" },
  { weaponId: "halberd" },
  { weaponId: "longspear" },
  { weaponId: "scythe" },
  { weaponId: "waraxe" },
  { weaponId: "x", variant: "hoe" },
  { weaponId: "dragonspear" },
  { weaponId: "trident" },
  { weaponId: "spear" },
  { weaponId: "whip" },
  { weaponId: "flail" },
  { weaponId: "x", variant: "shovel" },
  { weaponId: "x", variant: "watering" }
];

function extractJson(text, name, isArray) {
  const re = new RegExp(
    `export const ${name}(?:\\s*:[^=]+)?\\s*=\\s*(\\${isArray ? "[" : "{"}.*?\\${isArray ? "]" : "}"});`,
    "s"
  );
  const match = text.match(re);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function flipFrameVertical(png, frameIndex, frameW, frameH, cols) {
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  const ox = col * frameW;
  const oy = row * frameH;
  for (let y = 0; y < Math.floor(frameH / 2); y++) {
    const y2 = frameH - 1 - y;
    for (let x = 0; x < frameW; x++) {
      const idx1 = (((oy + y) * png.width + (ox + x)) << 2);
      const idx2 = (((oy + y2) * png.width + (ox + x)) << 2);
      const r = png.data[idx1];
      const g = png.data[idx1 + 1];
      const b = png.data[idx1 + 2];
      const a = png.data[idx1 + 3];
      png.data[idx1] = png.data[idx2];
      png.data[idx1 + 1] = png.data[idx2 + 1];
      png.data[idx1 + 2] = png.data[idx2 + 2];
      png.data[idx1 + 3] = png.data[idx2 + 3];
      png.data[idx2] = r;
      png.data[idx2 + 1] = g;
      png.data[idx2 + 2] = b;
      png.data[idx2 + 3] = a;
    }
  }
}

function recomputeTipButt(png, frameIndex, frameW, frameH, cols) {
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  const ox = col * frameW;
  const oy = row * frameH;
  const centerX = Math.floor(frameW / 2);
  const centerY = Math.floor(frameH / 2);
  let minY = 1e9;
  let maxY = -1e9;
  let tipSumX = 0;
  let tipCount = 0;
  let buttSumX = 0;
  let buttCount = 0;

  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const idx = (((oy + y) * png.width + (ox + x)) << 2);
      const a = png.data[idx + 3];
      if (a === 0) continue;
      if (y < minY) {
        minY = y;
        tipSumX = x;
        tipCount = 1;
      } else if (y === minY) {
        tipSumX += x;
        tipCount++;
      }
      if (y > maxY) {
        maxY = y;
        buttSumX = x;
        buttCount = 1;
      } else if (y === maxY) {
        buttSumX += x;
        buttCount++;
      }
    }
  }

  if (tipCount <= 0 || buttCount <= 0) return null;
  const tipX = (tipSumX / tipCount) - centerX;
  const tipY = minY - centerY;
  const buttX = (buttSumX / buttCount) - centerX;
  const buttY = maxY - centerY;
  const length = Math.hypot(tipX - buttX, tipY - buttY);
  return { tipX, tipY, buttX, buttY, length };
}

function main() {
  const text = fs.readFileSync(META_PATH, "utf8");
  const sheet = extractJson(text, "WEAPON_MASTER_SHEET", false);
  const frames = extractJson(text, "WEAPON_MASTER_FRAMES", true);
  if (!sheet || !frames) throw new Error("Failed to parse weaponMasterMeta.ts");

  const frameW = sheet.frameW | 0;
  const frameH = sheet.frameH | 0;
  const cols = sheet.cols | 0;
  const sheetPath = path.join(MASTER_DIR, `weapon_master ${frameW}x${frameH}.png`);
  if (!fs.existsSync(sheetPath)) throw new Error(`Missing master sheet: ${sheetPath}`);

  const png = PNG.sync.read(fs.readFileSync(sheetPath));
  const flipSet = new Set();
  for (const f of frames) {
    const wId = String(f.weaponId || "").toLowerCase();
    const vId = String(f.variant || "").toLowerCase();
    const hit = FLIPS.some((spec) => {
      if (String(spec.weaponId).toLowerCase() !== wId) return false;
      if (spec.variant != null && String(spec.variant).toLowerCase() !== vId) return false;
      return true;
    });
    if (hit) flipSet.add(f.frameIndex | 0);
  }

  for (const idx of flipSet) {
    flipFrameVertical(png, idx, frameW, frameH, cols);
  }

  for (const f of frames) {
    const idx = f.frameIndex | 0;
    if (!flipSet.has(idx)) continue;
    const recompute = recomputeTipButt(png, idx, frameW, frameH, cols);
    if (!recompute) continue;
    f.tipX = Number(recompute.tipX.toFixed(3));
    f.tipY = Number(recompute.tipY.toFixed(3));
    f.buttX = Number(recompute.buttX.toFixed(3));
    f.buttY = Number(recompute.buttY.toFixed(3));
    f.length = Number(recompute.length.toFixed(3));
  }

  fs.writeFileSync(sheetPath, PNG.sync.write(png));

  const metaText =
`// AUTO-GENERATED by scripts/genweaponmasteratlas.mjs
export const WEAPON_MASTER_SHEET = ${JSON.stringify(sheet, null, 2)};

export type WeaponMasterFrame = {
  weaponId: string;
  variant: string;
  anim: string;
  tile: number;
  frameIndex: number;
  sourceFrame: number;
  sourceRow: number;
  sourceCol: number;
  frameW: number;
  frameH: number;
  tipX: number;
  tipY: number;
  buttX: number;
  buttY: number;
  length: number;
  appliedRotMdeg: number;
  sheetKeyBg: string;
  sheetKeyFg: string;
};

export const WEAPON_MASTER_FRAMES: WeaponMasterFrame[] = ${JSON.stringify(frames, null, 2)};
`;

  fs.writeFileSync(META_PATH, metaText);
  console.log("Flipped frames:", flipSet.size);
  console.log("Updated:", sheetPath);
  console.log("Updated:", META_PATH);
}

main();
