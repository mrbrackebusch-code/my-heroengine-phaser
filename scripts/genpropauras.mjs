#!/usr/bin/env node
// scripts/genpropauras.mjs
// Generate aura mask sheets for tiles and animations (props).
// Output files keep the "_aura_r2" suffix for loader compatibility.
// The mask itself is the sprite silhouette; outline expansion is handled at runtime.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const TILES_DIR = path.join(ROOT, "assets", "tiles");
const ANIMS_DIR = path.join(ROOT, "assets", "animations");
const OUT_TILES_DIR = path.join(ROOT, "assets", "auras_32x32", "tiles");
const OUT_ANIM_ROOT = path.join(ROOT, "assets");

const OUT_SUFFIX = "_aura_r2";
const DEFAULT_ANIM_FRAME = 64;

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

function usage() {
  console.log(`
Usage: node scripts/genpropauras.mjs [options]

Options:
  --overwrite, --force   Rebuild even if the aura already exists.
  --skip-existing        Skip existing aura files (default).
  --check                Only report missing outputs (exit code 1 if missing).
  --radius N             Dilate mask by N pixels (default 0).
  --tiles                Process tiles only.
  --anims                Process animations only.
  --verbose              Log every file processed.
  --help                 Show this help.
`);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .map(f => path.join(dir, f))
    .sort();
}

function parseFrameSizeFromName(baseName) {
  const m = /(\d+)\s*x\s*(\d+)/i.exec(baseName || "");
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { frameW: w, frameH: h };
}

function readFileText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function loadAnimOverrides() {
  const out = Object.create(null);
  const srcPath = path.join(ROOT, "src", "tileAtlas.ts");
  const src = readFileText(srcPath);
  if (!src) return out;

  const m = /const\s+ANIM_FRAME_OVERRIDES[\s\S]*?=\s*\{([\s\S]*?)\};/m.exec(src);
  if (!m) return out;
  const body = m[1] || "";

  const re = /^[ \t]*["']?([^"'\n]+)["']?\s*:\s*\{\s*frameW\s*:\s*(\d+)\s*,\s*frameH\s*:\s*(\d+)\s*\}/gm;
  let hit;
  while ((hit = re.exec(body))) {
    const name = String(hit[1] || "").trim();
    const frameW = parseInt(hit[2], 10);
    const frameH = parseInt(hit[3], 10);
    if (!name || !Number.isFinite(frameW) || !Number.isFinite(frameH)) continue;
    out[name] = { frameW, frameH };
  }
  return out;
}

function buildDilatedMaskBits(mask, frameW, frameH, r) {
  if (r <= 0) return mask;
  const n = frameW * frameH;
  const out = new Uint8Array(n);
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
  const srcData = srcPng.data;
  const cols = Math.floor(srcW / frameW);
  const rows = Math.floor(srcH / frameH);
  if (cols <= 0 || rows <= 0) {
    return { ok: false, reason: `size ${srcW}x${srcH} too small for ${frameW}x${frameH}` };
  }
  const outW = (cols * frameW) | 0;
  const outH = (rows * frameH) | 0;
  const cropped = (outW !== srcW || outH !== srcH);
  const out = new PNG({ width: outW, height: outH, colorType: 6 });

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const ox = fc * frameW;
      const oy = fr * frameH;
      const mask = new Uint8Array(frameW * frameH);
      for (let y = 0; y < frameH; y++) {
        const srcRow = ((oy + y) * srcW + ox) * 4;
        const dstRow = y * frameW;
        for (let x = 0; x < frameW; x++) {
          const a = srcData[srcRow + x * 4 + 3] | 0;
          if (a > 0) mask[dstRow + x] = 1;
        }
      }

      const dm = buildDilatedMaskBits(mask, frameW, frameH, radius);
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const bi = y * frameW + x;
          if (!dm[bi]) continue;
          const oi = ((oy + y) * outW + (ox + x)) * 4;
          out.data[oi + 0] = 255;
          out.data[oi + 1] = 255;
          out.data[oi + 2] = 255;
          out.data[oi + 3] = 255;
        }
      }
    }
  }
  return { ok: true, out, rows, cols, cropped, srcW, srcH, outW, outH };
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

function animOutDir(frameW, frameH) {
  const fw = frameW | 0;
  const fh = frameH | 0;
  if (fw <= 0 || fh <= 0) return "";
  return path.join(OUT_ANIM_ROOT, `auras_${fw}x${fh}`, "animations");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  let skipExisting = true;
  if (_isTruthy(process.env.OVERWRITE) || _isTruthy(process.env.FORCE)) skipExisting = false;
  if (_isFalsy(process.env.SKIP_EXISTING)) skipExisting = false;

  let checkOnly = false;
  let radius = 0;
  let wantTiles = true;
  let wantAnims = true;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--overwrite" || a === "--force") skipExisting = false;
    else if (a === "--skip-existing") skipExisting = true;
    else if (a === "--check") checkOnly = true;
    else if (a === "--tiles") { wantTiles = true; wantAnims = false; }
    else if (a === "--anims") { wantAnims = true; wantTiles = false; }
    else if (a === "--verbose") verbose = true;
    else if (a === "--radius" && i + 1 < args.length) {
      const v = parseInt(args[i + 1], 10);
      if (Number.isFinite(v) && v >= 0) radius = v | 0;
      i++;
    }
  }

  if (checkOnly) skipExisting = true;

  const overrides = loadAnimOverrides();
  let wrote = 0;
  let skipped = 0;
  let missing = 0;

  if (wantTiles) {
    const tiles = listPngs(TILES_DIR);
    for (const file of tiles) {
      const base = path.basename(file, ".png");
      const outPath = path.join(OUT_TILES_DIR, `${base}${OUT_SUFFIX}.png`);
      const exists = fs.existsSync(outPath);
      if (checkOnly) {
        if (!exists) {
          missing++;
          console.log(`[prop-auras][MISS][tile] ${path.relative(ROOT, outPath)}`);
        }
        continue;
      }
      if (skipExisting && exists) {
        skipped++;
        if (verbose) console.log(`[prop-auras][SKIP][tile] ${path.relative(ROOT, outPath)}`);
        continue;
      }
      let src;
      try {
        src = readPng(file);
      } catch (e) {
        console.warn(`[prop-auras][SKIP][tile] ${base}: read failed (${e})`);
        continue;
      }
      const r = buildAuraSheetForGrid(src, 32, 32, radius);
      if (!r.ok) {
        console.warn(`[prop-auras][SKIP][tile] ${base}: ${r.reason}`);
        continue;
      }
      if (r.cropped) {
        console.warn(
          `[prop-auras][WARN][tile] ${base}: source ${r.srcW}x${r.srcH} not divisible by 32x32; cropped to ${r.outW}x${r.outH}`
        );
      }
      writePng(r.out, outPath);
      wrote++;
      if (verbose) console.log(`[prop-auras][WROTE][tile] ${path.relative(ROOT, outPath)}`);
    }
  }

  if (wantAnims) {
    const anims = listPngs(ANIMS_DIR);
    for (const file of anims) {
      const base = path.basename(file, ".png");
      let frame = parseFrameSizeFromName(base);
      if (!frame && overrides[base]) frame = overrides[base];
      if (!frame) frame = { frameW: DEFAULT_ANIM_FRAME, frameH: DEFAULT_ANIM_FRAME };

      const outDir = animOutDir(frame.frameW | 0, frame.frameH | 0);
      if (!outDir) {
        console.warn(`[prop-auras][SKIP][anim] ${base}: invalid frame ${frame.frameW}x${frame.frameH}`);
        continue;
      }

      const outPath = path.join(outDir, `${base}${OUT_SUFFIX}.png`);
      const exists = fs.existsSync(outPath);
      if (checkOnly) {
        if (!exists) {
          missing++;
          console.log(`[prop-auras][MISS][anim] ${path.relative(ROOT, outPath)}`);
        }
        continue;
      }
      if (skipExisting && exists) {
        skipped++;
        if (verbose) console.log(`[prop-auras][SKIP][anim] ${path.relative(ROOT, outPath)}`);
        continue;
      }

      let src;
      try {
        src = readPng(file);
      } catch (e) {
        console.warn(`[prop-auras][SKIP][anim] ${base}: read failed (${e})`);
        continue;
      }
      const r = buildAuraSheetForGrid(src, frame.frameW | 0, frame.frameH | 0, radius);
      if (!r.ok) {
        console.warn(`[prop-auras][SKIP][anim] ${base}: ${r.reason}`);
        continue;
      }
      if (r.cropped) {
        console.warn(
          `[prop-auras][WARN][anim] ${base}: source ${r.srcW}x${r.srcH} not divisible by ${frame.frameW}x${frame.frameH}; cropped to ${r.outW}x${r.outH}`
        );
      }
      writePng(r.out, outPath);
      wrote++;
      if (verbose) console.log(`[prop-auras][WROTE][anim] ${path.relative(ROOT, outPath)}`);
    }
  }

  if (checkOnly) {
    if (missing > 0) {
      console.log(`[prop-auras][CHECK] missing=${missing}`);
      process.exit(1);
    }
    console.log("[prop-auras][CHECK] OK");
    return;
  }

  console.log(`[prop-auras] wrote=${wrote} skipped=${skipped} radius=${radius}`);
}

main().catch((e) => {
  console.error("[prop-auras] ERROR", e);
  process.exit(1);
});
