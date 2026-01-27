#!/usr/bin/env node
// scripts/genWeaponAuras.mjs
// Generate aura outline sheets for weapons (from _atlas + _hookshot).
// Outputs: assets/weapons/auras/<weapon>_aura_r{radius}.png

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const ATLAS_DIR = path.join(WEAPONS_DIR, "_atlas");
const HOOKSHOT_DIR = path.join(WEAPONS_DIR, "_hookshot");
const OUT_DIR = path.join(WEAPONS_DIR, "auras");
const DEFAULT_RADII = [0, 1, 2, 3];

function usage() {
  console.log(`
Usage: node scripts/genWeaponAuras.mjs [options]

Options:
  --overwrite, --force   Rebuild even if the aura already exists.
  --skip-existing        Skip existing aura files (default).
  --check                Only report missing outputs (exit code 1 if missing).
  --radius N             Generate only radius N (overrides --radii).
  --radii a,b,c          Generate multiple radii (default ${DEFAULT_RADII.join(",")}).
  --verbose              Log every file processed.
  --help                 Show this help.

Notes:
  - Reads assets/weapons/_atlas/*.png (t064/t128/t192 only) and assets/weapons/_hookshot/*.png.
`);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseRadii(args) {
  let radii = DEFAULT_RADII.slice();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--radius" && i + 1 < args.length) {
      const v = parseInt(args[i + 1], 10);
      if (Number.isFinite(v) && v >= 0) radii = [v | 0];
      i++;
    } else if (a === "--radii" && i + 1 < args.length) {
      const list = String(args[i + 1] || "")
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .map((n) => n | 0);
      if (list.length) radii = list;
      i++;
    }
  }
  radii = Array.from(new Set(radii)).sort((a, b) => a - b);
  return radii;
}

function walkWeaponPngs() {
  const out = [];
  if (fs.existsSync(ATLAS_DIR)) {
    const entries = fs.readdirSync(ATLAS_DIR, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!ent.name.toLowerCase().endsWith(".png")) continue;
      if (!/^t(064|128|192)__/.test(ent.name)) continue;
      out.push(path.join(ATLAS_DIR, ent.name));
    }
  }
  if (fs.existsSync(HOOKSHOT_DIR)) {
    const entries = fs.readdirSync(HOOKSHOT_DIR, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!ent.name.toLowerCase().endsWith(".png")) continue;
      out.push(path.join(HOOKSHOT_DIR, ent.name));
    }
  }
  out.sort();
  return out;
}

function parseTileSizeFromName(baseName) {
  const m = /^t(064|128|192)__/i.exec(String(baseName || ""));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { frameW: n | 0, frameH: n | 0 };
}

function parseSizeFromName(baseName) {
  const m = /(\d+)\s*x\s*(\d+)/i.exec(String(baseName || ""));
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { frameW: w | 0, frameH: h | 0 };
}

function buildDilatedMaskBits(mask, frameW, frameH, r) {
  if (r <= 0) return mask;
  const out = new Uint8Array(frameW * frameH);
  for (let y = 0; y < frameH; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(frameH - 1, y + r);
    for (let x = 0; x < frameW; x++) {
      const i = y * frameW + x;
      if (!mask[i]) continue;
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
  const srcW = srcPng.width | 0;
  const srcH = srcPng.height | 0;
  if (srcW % frameW !== 0 || srcH % frameH !== 0) {
    return { ok: false, reason: `size ${srcW}x${srcH} not divisible by ${frameW}x${frameH}` };
  }
  const cols = Math.floor(srcW / frameW);
  const rows = Math.floor(srcH / frameH);
  const out = new PNG({ width: srcW, height: srcH, colorType: 6 });

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const ox = fc * frameW;
      const oy = fr * frameH;
      const mask = new Uint8Array(frameW * frameH);
      for (let y = 0; y < frameH; y++) {
        const srcRow = ((oy + y) * srcW + ox) * 4;
        const dstRow = y * frameW;
        for (let x = 0; x < frameW; x++) {
          const a = srcPng.data[srcRow + x * 4 + 3] | 0;
          if (a > 0) mask[dstRow + x] = 1;
        }
      }
      const dm = buildDilatedMaskBits(mask, frameW, frameH, radius);
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const bi = y * frameW + x;
          if (!dm[bi]) continue;
          const oi = ((oy + y) * srcW + (ox + x)) * 4;
          out.data[oi + 0] = 255;
          out.data[oi + 1] = 255;
          out.data[oi + 2] = 255;
          out.data[oi + 3] = 255;
        }
      }
    }
  }

  return { ok: true, out };
}

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

function writePng(png, filePath) {
  const buf = PNG.sync.write(png);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buf);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  let skipExisting = true;
  let checkOnly = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--overwrite" || a === "--force") skipExisting = false;
    else if (a === "--skip-existing") skipExisting = true;
    else if (a === "--check") checkOnly = true;
    else if (a === "--verbose") verbose = true;
  }

  if (checkOnly) skipExisting = true;

  const radii = parseRadii(args);
  const files = walkWeaponPngs();
  let wrote = 0;
  let skipped = 0;
  let missing = 0;

  for (const file of files) {
    const base = path.basename(file, ".png");
    const frame = parseTileSizeFromName(base) || parseSizeFromName(base);
    if (!frame) {
      if (verbose) console.log(`[weapon-auras][SKIP] missing size in filename: ${base}`);
      continue;
    }

    let src;
    try {
      src = readPng(file);
    } catch (e) {
      console.warn(`[weapon-auras][SKIP] ${base}: read failed (${e})`);
      continue;
    }

    for (const radius of radii) {
      const outPath = path.join(OUT_DIR, `${base}_aura_r${radius}.png`);
      const exists = fs.existsSync(outPath);
      if (checkOnly) {
        if (!exists) {
          missing++;
          console.log(`[weapon-auras][MISS] ${path.relative(ROOT, outPath)}`);
        }
        continue;
      }
      if (skipExisting && exists) {
        skipped++;
        if (verbose) console.log(`[weapon-auras][SKIP] ${path.relative(ROOT, outPath)}`);
        continue;
      }
      const r = buildAuraSheetForGrid(src, frame.frameW | 0, frame.frameH | 0, radius);
      if (!r.ok) {
        console.error(`[weapon-auras][ERROR] ${base}: ${r.reason}`);
        process.exit(1);
      }
      writePng(r.out, outPath);
      wrote++;
      if (verbose) console.log(`[weapon-auras][WROTE] ${path.relative(ROOT, outPath)}`);
    }
  }

  if (checkOnly) {
    if (missing > 0) {
      console.log(`[weapon-auras][CHECK] missing=${missing}`);
      process.exit(1);
    }
    console.log("[weapon-auras][CHECK] OK");
    return;
  }

  console.log(`[weapon-auras] wrote=${wrote} skipped=${skipped} radii=${radii.join(",")}`);
}

main().catch((e) => {
  console.error("[weapon-auras] ERROR", e);
  process.exit(1);
});
