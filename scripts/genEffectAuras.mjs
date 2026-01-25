#!/usr/bin/env node
// scripts/genEffectAuras.mjs
// Generate aura outline sheets for effects.
// Outputs: assets/effects/auras/<name>_aura_r{radius}.png

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const EFFECTS_DIR = path.join(ROOT, "assets", "effects");
const OUT_DIR = path.join(EFFECTS_DIR, "auras");
const DEFAULT_RADII = [1, 2, 3];
const EFFECT_SIZE_OVERRIDES = {
  "sword arcs": { frameW: 125, frameH: 150 },
};

function usage() {
  console.log(`
Usage: node scripts/genEffectAuras.mjs [options]

Options:
  --overwrite, --force   Rebuild even if the aura already exists.
  --skip-existing        Skip existing aura files (default).
  --check                Only report missing outputs (exit code 1 if missing).
  --radius N             Generate only radius N (overrides --radii).
  --radii a,b,c          Generate multiple radii (default ${DEFAULT_RADII.join(",")}).
  --verbose              Log every file processed.
  --help                 Show this help.
`);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseRadii(args) {
  let overwrite = false;
  let skipExisting = true;
  let checkOnly = false;
  let verbose = false;
  let radii = DEFAULT_RADII.slice();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a === "--overwrite" || a === "--force") {
      overwrite = true;
      skipExisting = false;
    } else if (a === "--skip-existing") {
      skipExisting = true;
      overwrite = false;
    } else if (a === "--check") {
      checkOnly = true;
    } else if (a === "--verbose") {
      verbose = true;
    } else if (a === "--radius" && i + 1 < args.length) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 0) radii = [n | 0];
    } else if (a === "--radii" && i + 1 < args.length) {
      const parts = String(args[++i] || "").split(",");
      const next = [];
      for (const p of parts) {
        const n = parseInt(String(p || "").trim(), 10);
        if (Number.isFinite(n) && n >= 0) next.push(n | 0);
      }
      if (next.length) radii = next;
    }
  }

  radii = Array.from(new Set(radii.map((r) => Math.max(0, r | 0)))).sort((a, b) => a - b);
  return { radii, overwrite, skipExisting, checkOnly, verbose };
}

function walkPngs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.toLowerCase() === "auras") continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!ent.name.toLowerCase().endsWith(".png")) continue;
      out.push(full);
    }
  }
  out.sort();
  return out;
}

function parseFrameSizeFromName(baseName) {
  const m = /^(.*?)(?:\s+)(\d+)\s*x\s*(\d+)/i.exec(baseName || "");
  if (!m) return null;
  const baseId = String(m[1] || "").trim().toLowerCase();
  let w = parseInt(m[2], 10);
  let h = parseInt(m[3], 10);
  const override = EFFECT_SIZE_OVERRIDES[baseId];
  if (override) {
    w = override.frameW | 0;
    h = override.frameH | 0;
  }
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { frameW: w | 0, frameH: h | 0 };
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

  return { ok: true, png: out };
}

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function writePng(p, png) {
  fs.writeFileSync(p, PNG.sync.write(png));
}

function main() {
  const { radii, overwrite, skipExisting, checkOnly, verbose } = parseRadii(process.argv.slice(2));
  ensureDir(OUT_DIR);

  const pngs = walkPngs(EFFECTS_DIR);
  let missing = 0;
  let built = 0;
  let skipped = 0;

  for (const file of pngs) {
    const base = path.basename(file, ".png");
    if (!base) continue;
    if (/_aura_r\d+$/i.test(base)) continue;
    const frame = parseFrameSizeFromName(base);
    if (!frame) continue;

    const auraTargets = radii.map((r) => ({
      radius: r | 0,
      outPath: path.join(OUT_DIR, `${base}_aura_r${r}.png`)
    }));

    let needsWork = overwrite || checkOnly;
    if (!needsWork) {
      for (const t of auraTargets) {
        if (!fs.existsSync(t.outPath)) {
          needsWork = true;
          break;
        }
      }
    }

    if (!needsWork && skipExisting) {
      skipped++;
      continue;
    }

    if (checkOnly) {
      for (const t of auraTargets) {
        if (!fs.existsSync(t.outPath)) missing++;
      }
      continue;
    }

    const src = readPng(file);
    for (const t of auraTargets) {
      if (!overwrite && skipExisting && fs.existsSync(t.outPath)) continue;
      const res = buildAuraSheetForGrid(src, frame.frameW | 0, frame.frameH | 0, t.radius | 0);
      if (!res.ok) continue;
      writePng(t.outPath, res.png);
      built++;
      if (verbose) console.log(`[genEffectAuras] ${path.relative(ROOT, t.outPath)}`);
    }
  }

  if (checkOnly) {
    if (missing > 0) {
      console.log(`[genEffectAuras] missing=${missing}`);
      process.exit(1);
    }
    console.log("[genEffectAuras] all aura outputs present");
    return;
  }

  console.log(`[genEffectAuras] built=${built} skipped=${skipped} radii=${radii.join(",")}`);
}

main();
