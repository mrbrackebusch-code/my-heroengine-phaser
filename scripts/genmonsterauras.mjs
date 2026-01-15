// scripts/genmonsterauras.mjs
// Generate dilated aura masks for monsters. Uses frame size parsed from the
// filename (e.g., "slime 64x64 ULDR 1Walk.png" -> 64x64 frames).
// Writes outputs to assets/monsters/monster_auras/<name>_aura_r2.png
// Skips regeneration by default when the output already exists; override via flag/env.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const MON_DIR = path.join(ROOT, "assets", "monsters");
const OUT_DIR = path.join(MON_DIR, "monster_auras");
const RADIUS = 2;
const FRAME_DIM_RE = /(\d+)\s*x\s*(\d+)/i;

// Default: avoid rewriting existing auras (toggle here)
const SKIP_EXISTING = true;

function _isTruthy(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}
function _isFalsy(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "0" || s === "false" || s === "no" || s === "n" || s === "off";
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        // Skip output folder to avoid treating generated auras as inputs.
        if (path.basename(full).toLowerCase() === "monster_auras") continue;
        walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".png")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function parseFrameSizeFromName(filePath) {
  const base = path.basename(filePath, ".png");
  const m = base.match(FRAME_DIM_RE);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { frameW: w, frameH: h };
}

function buildDilatedMaskBits(frame, frameW, frameH, r) {
  const n = frameW * frameH;
  const base = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (frame[i * 4 + 3] !== 0) base[i] = 1;
  }
  if (r <= 0) return base;
  const out = new Uint8Array(n);
  for (let y = 0; y < frameH; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(frameH - 1, y + r);
    for (let x = 0; x < frameW; x++) {
      const i = y * frameW + x;
      if (!base[i]) continue;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(frameW - 1, x + r);
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * frameW;
        for (let xx = x0; xx <= x1; xx++) out[row + xx] = 1;
      }
    }
  }
  return out;
}

function buildAuraSheetForGrid(srcPng, frameW, frameH, radius) {
  const { width: w, height: h, data: srcData } = srcPng;
  if ((w % frameW) !== 0 || (h % frameH) !== 0) {
    return { ok: false, reason: `size ${w}x${h} not divisible by ${frameW}x${frameH}` };
  }
  const rows = Math.floor(h / frameH);
  const cols = Math.floor(w / frameW);
  const out = new PNG({ width: w, height: h, colorType: 6 });

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const ox = fc * frameW;
      const oy = fr * frameH;
      const frame = new Uint8Array(frameW * frameH * 4);
      for (let y = 0; y < frameH; y++) {
        const srcRow = ((oy + y) * w + ox) * 4;
        const dstRow = y * frameW * 4;
        frame.set(srcData.subarray(srcRow, srcRow + frameW * 4), dstRow);
      }
      const mask = buildDilatedMaskBits(frame, frameW, frameH, radius);
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const bi = y * frameW + x;
          if (!mask[bi]) continue;
          const oi = ((oy + y) * w + (ox + x)) * 4;
          out.data[oi + 0] = 255;
          out.data[oi + 1] = 255;
          out.data[oi + 2] = 255;
          out.data[oi + 3] = 255;
        }
      }
    }
  }
  return { ok: true, out, rows, cols };
}

async function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

async function writePng(png, filePath) {
  const buf = PNG.sync.write(png);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buf);
}

async function main() {
  ensureDir(OUT_DIR);
  const files = listPngs(MON_DIR);
  if (files.length === 0) {
    console.error("[mon-auras] No monster PNGs found");
    process.exit(1);
  }

  console.log(
    `[mon-auras] monsters=${files.length} radius=${RADIUS} skipExisting=${SKIP_EXISTING ? "yes" : "no"}`
  );

  for (const file of files) {
    const name = path.basename(file, ".png");
    const dims = parseFrameSizeFromName(file);
    if (!dims) {
      console.warn(`[mon-auras] SKIP ${name}: no WxH in filename`);
      continue;
    }
    const { frameW, frameH } = dims;
    const outName = `${name}_aura_r${RADIUS}.png`;
    const outPath = path.join(OUT_DIR, outName);
    if (SKIP_EXISTING && fs.existsSync(outPath)) continue;

    let src;
    try {
      src = await readPng(file);
    } catch (e) {
      console.warn(`[mon-auras] SKIP ${name}: failed to read PNG (${e})`);
      continue;
    }

    const r = buildAuraSheetForGrid(src, frameW, frameH, RADIUS);
    if (!r.ok) {
      console.warn(`[mon-auras] SKIP ${name} (${frameW}x${frameH}): ${r.reason}`);
      continue;
    }

    await writePng(r.out, outPath);
    console.log(
      `[mon-auras] wrote ${path.relative(ROOT, outPath)} (frames=${r.rows}x${r.cols}, frame=${frameW}x${frameH})`
    );
  }

  console.log("[mon-auras] done");
}

main().catch((e) => {
  console.error("[mon-auras] ERROR", e);
  process.exit(1);
});
