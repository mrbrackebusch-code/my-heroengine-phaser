#!/usr/bin/env node
/**
 * Generate precomputed effect metadata to avoid runtime PNG scans.
 *
 * Output: src/generated/effectAtlasMeta.ts
 * Usage:  node scripts/genEffectAtlasMeta.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(path.join(__dirname, ".."));
const EFFECTS_DIR = path.join(ROOT, "assets", "effects");
const OUT_TS = path.join(ROOT, "src", "generated", "effectAtlasMeta.ts");

const SIZE_RE = /^(.*?)(?:\s+)(\d+)x(\d+)(?:_aura_r\d+)?$/i;
const EFFECT_SKIP_EMPTY_FRAMES = true;
const EFFECT_EMPTY_ALPHA_MIN = 8;
const EFFECT_PALETTE_MAX_COLORS = 8;
const EFFECT_PALETTE_ALPHA_MIN = 12;
const EFFECT_PALETTE_SAMPLE_TARGET = 20000;
const EFFECT_PALETTE_SAMPLE_MAX_STRIDE = 8;
const EFFECT_SIZE_OVERRIDES = {
  "sword arcs": { frameW: 125, frameH: 150 },
};
const EFFECT_REMAINDER_ALLOWANCES = {
  "sword arcs": { remW: 6 },
};

function paletteSampleStride(totalPixels) {
  const target = EFFECT_PALETTE_SAMPLE_TARGET | 0;
  if (totalPixels <= target || target <= 0) return 1;
  const stride = Math.ceil(Math.sqrt(totalPixels / target));
  if (!Number.isFinite(stride) || stride <= 1) return 1;
  return Math.max(1, Math.min(EFFECT_PALETTE_SAMPLE_MAX_STRIDE, stride | 0));
}

function paletteFromCounts(counts, maxColors) {
  if (!counts || counts.size <= 0) return null;
  const entries = Array.from(counts.entries()).map(([color, count]) => ({ color, count }));
  entries.sort((a, b) => b.count - a.count);

  const colors = [];
  const limit = Math.max(1, maxColors | 0);
  for (let i = 0; i < entries.length && colors.length < limit; i++) {
    colors.push(entries[i].color >>> 0);
  }

  let tint = 0;
  for (let i = 0; i < entries.length; i++) {
    const c = entries[i].color >>> 0;
    const r = (c >> 16) & 0xff;
    const g = (c >> 8) & 0xff;
    const b = c & 0xff;
    const luma = ((r * 299 + g * 587 + b * 114) / 1000) | 0;
    if (luma >= 30 && luma <= 230) {
      tint = c;
      break;
    }
  }
  if (!tint) tint = colors.length ? (colors[0] >>> 0) : 0xffffff;
  return { colors, tint: tint >>> 0 };
}

function computeFrameBounds(data, w, h, frameW, frameH, frameIndex, alphaMin) {
  const cols = Math.floor(w / frameW);
  const rows = Math.floor(h / frameH);
  if (cols <= 0 || rows <= 0) return null;
  const maxIndex = (cols * rows) - 1;
  const idx = Math.max(0, Math.min(maxIndex, frameIndex | 0)) | 0;
  const row = Math.floor(idx / cols) | 0;
  const col = (idx % cols) | 0;
  const baseX = (col * frameW) | 0;
  const baseY = (row * frameH) | 0;

  let minX = frameW;
  let minY = frameH;
  let maxX = -1;
  let maxY = -1;
  const aMin = alphaMin | 0;

  for (let y = 0; y < frameH; y++) {
    const rowStart = (baseY + y) * w + baseX;
    let idxAlpha = (rowStart << 2) + 3;
    for (let x = 0; x < frameW; x++) {
      if (data[idxAlpha] >= aMin) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      idxAlpha += 4;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const wBox = (maxX - minX + 1) | 0;
  const hBox = (maxY - minY + 1) | 0;
  const centerX = Math.round((minX + maxX) / 2) | 0;
  const centerY = Math.round((minY + maxY) / 2) | 0;
  return {
    frameIndex: idx,
    minX: minX | 0,
    minY: minY | 0,
    maxX: maxX | 0,
    maxY: maxY | 0,
    w: wBox | 0,
    h: hBox | 0,
    centerX,
    centerY
  };
}

function walkEffects(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkEffects(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".png")) continue;
    out.push(full);
  }
}

if (!fs.existsSync(EFFECTS_DIR)) {
  console.error(`[gen-effect-meta] missing folder: ${EFFECTS_DIR}`);
  process.exit(1);
}

const files = [];
walkEffects(EFFECTS_DIR, files);

const meta = {};
const warnings = [];
const missingSize = [];

for (const file of files) {
  const baseName = path.basename(file, ".png");
  const match = SIZE_RE.exec(baseName);
  if (!match) {
    missingSize.push(baseName);
    continue;
  }
  const frameW = parseInt(match[2], 10) | 0;
  const frameH = parseInt(match[3], 10) | 0;
  const baseId = String(match[1] || "").trim().toLowerCase();
  const override = EFFECT_SIZE_OVERRIDES[baseId];
  const useFrameW = override ? (override.frameW | 0) : frameW;
  const useFrameH = override ? (override.frameH | 0) : frameH;
  if (useFrameW <= 0 || useFrameH <= 0) {
    missingSize.push(baseName);
    continue;
  }

  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(file));
  } catch (err) {
    warnings.push(`[gen-effect-meta] unreadable: ${baseName} (${String(err && err.message ? err.message : err)})`);
    continue;
  }

  const w = png.width | 0;
  const h = png.height | 0;
  if (w <= 0 || h <= 0) continue;

  const cols = Math.floor(w / useFrameW);
  const rows = Math.floor(h / useFrameH);
  if (cols <= 0 || rows <= 0) {
    warnings.push(`[gen-effect-meta] invalid grid: ${baseName} size=${w}x${h} frame=${useFrameW}x${useFrameH}`);
    continue;
  }
  const remW = (w % useFrameW) | 0;
  const remH = (h % useFrameH) | 0;
  if (remW !== 0 || remH !== 0) {
    const allowance = EFFECT_REMAINDER_ALLOWANCES[baseId];
    const allowW = allowance && typeof allowance.remW === "number" ? (allowance.remW | 0) : 0;
    const allowH = allowance && typeof allowance.remH === "number" ? (allowance.remH | 0) : 0;
    const okW = remW === 0 || (allowW > 0 && remW === allowW);
    const okH = remH === 0 || (allowH > 0 && remH === allowH);
    if (!(okW && okH)) {
      warnings.push(`[gen-effect-meta] not divisible: ${baseName} size=${w}x${h} frame=${useFrameW}x${useFrameH}`);
    }
  }

  const data = png.data;
  const frameCount = cols * rows;
  const frameIndices = [];
  let emptyCount = 0;
  const wantPalette = (EFFECT_PALETTE_MAX_COLORS | 0) > 0;
  const counts = wantPalette ? new Map() : null;
  const stride = wantPalette ? paletteSampleStride(cols * rows * useFrameW * useFrameH) : 1;
  let sampleCountdown = 0;

  for (let r = 0; r < rows; r++) {
    const baseY = r * useFrameH;
    for (let c = 0; c < cols; c++) {
      const baseX = c * useFrameW;
      const frameIndex = r * cols + c;
      let hasPixel = !EFFECT_SKIP_EMPTY_FRAMES;
      for (let y = 0; y < useFrameH; y++) {
        const rowStart = (baseY + y) * w + baseX;
        let idx = (rowStart << 2);
        for (let x = 0; x < useFrameW; x++) {
          const a = data[idx + 3] | 0;
          if (wantPalette) {
            let sampleOk = true;
            if (stride > 1) {
              sampleOk = (sampleCountdown === 0);
              sampleCountdown++;
              if (sampleCountdown >= stride) sampleCountdown = 0;
            }
            if (sampleOk && a >= (EFFECT_PALETTE_ALPHA_MIN | 0)) {
              const rC = data[idx] | 0;
              const gC = data[idx + 1] | 0;
              const bC = data[idx + 2] | 0;
              const color = ((rC << 16) | (gC << 8) | bC) >>> 0;
              counts.set(color, (counts.get(color) || 0) + 1);
            }
          }
          if (EFFECT_SKIP_EMPTY_FRAMES && a >= (EFFECT_EMPTY_ALPHA_MIN | 0)) hasPixel = true;
          idx += 4;
        }
      }
      if (!EFFECT_SKIP_EMPTY_FRAMES || hasPixel) frameIndices.push(frameIndex);
      else emptyCount++;
    }
  }

  if (EFFECT_SKIP_EMPTY_FRAMES && frameIndices.length === 0) {
    for (let i = 0; i < frameCount; i++) frameIndices.push(i);
    emptyCount = 0;
  }

  const palette = wantPalette ? paletteFromCounts(counts, EFFECT_PALETTE_MAX_COLORS) : null;
  const collisionFrameIndex = frameIndices.length ? (frameIndices[0] | 0) : 0;
  const collisionBounds = computeFrameBounds(
    data,
    w,
    h,
    useFrameW,
    useFrameH,
    collisionFrameIndex,
    EFFECT_EMPTY_ALPHA_MIN
  );

  const entry = { frameIndices };
  if (palette) entry.palette = palette;
  if (collisionBounds) entry.collisionBounds = collisionBounds;
  if (emptyCount > 0) entry.emptyCount = emptyCount | 0;

  meta[baseName] = entry;
}

if (missingSize.length) {
  warnings.push(
    `[gen-effect-meta] missing size in filename: ${missingSize.join(", ")}`
  );
}

const sorted = {};
for (const key of Object.keys(meta).sort()) {
  sorted[key] = meta[key];
}

const header = [
  "// Auto-generated by scripts/genEffectAtlasMeta.mjs. Do not edit.",
  ""
].join("\n");

const body = JSON.stringify(sorted, null, 2);
const output = `${header}\nexport const EFFECT_ATLAS_META = ${body} as const;\n`;
fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });

let prev = "";
try {
  prev = fs.readFileSync(OUT_TS, "utf8");
} catch {}

if (prev !== output) {
  fs.writeFileSync(OUT_TS, output, "utf8");
  console.log(`[gen-effect-meta] wrote ${OUT_TS} (${Object.keys(sorted).length} entries)`);
} else {
  console.log(`[gen-effect-meta] up-to-date (${Object.keys(sorted).length} entries)`);
}

if (warnings.length) {
  for (const line of warnings) console.warn(line);
}
