// scripts/genmonsterauras.mjs
// Generate dilated aura masks for monsters. Uses frame size parsed from the
// filename (e.g., "slime 64x64 ULDR 1Walk.png" -> 64x64 frames).
// Writes outputs to assets/enemies/<group>/auras/<name>_aura_r{radius}.png
// Skips regeneration by default when the output already exists; override via args.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const MONSTER_DIRS = [
  path.join(ROOT, "assets", "enemies", "monsters"),
  path.join(ROOT, "assets", "enemies", "bosses"),
];
const OUT_SUBDIR = "auras";
const DEFAULT_RADII = [0, 1, 2, 3];
const args = process.argv.slice(2);
const FRAME_DIM_RE = /(\d+)\s*x\s*(\d+)/i;

// Default: avoid rewriting existing auras (toggle here)
const DEFAULT_SKIP_EXISTING = true;

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
        if (ent.name.toLowerCase() === OUT_SUBDIR) continue;
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

function buildDilatedMaskBits(mask, frameW, frameH, r) {
  const n = frameW * frameH;
  if (r <= 0) return mask;
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
  const { width: w, height: h, data: srcData } = srcPng;
  if ((w % frameW) !== 0 || (h % frameH) !== 0) {
    return { ok: false, reason: `size ${w}x${h} not divisible by ${frameW}x${frameH}` };
  }
  const rows = Math.floor(h / frameH);
  const cols = Math.floor(w / frameW);
  const outFrameW = (radius > 0) ? ((frameW + radius * 2) | 0) : (frameW | 0);
  const outFrameH = (radius > 0) ? ((frameH + radius * 2) | 0) : (frameH | 0);
  const outW = (cols * outFrameW) | 0;
  const outH = (rows * outFrameH) | 0;
  const out = new PNG({ width: outW, height: outH, colorType: 6 });

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const srcOx = fc * frameW;
      const srcOy = fr * frameH;
      const dstOx = fc * outFrameW;
      const dstOy = fr * outFrameH;
      const mask = new Uint8Array(frameW * frameH);
      for (let y = 0; y < frameH; y++) {
        const srcRow = ((srcOy + y) * w + srcOx) * 4;
        const dstRow = y * frameW;
        for (let x = 0; x < frameW; x++) {
          const a = srcData[srcRow + x * 4 + 3] | 0;
          if (a > 0) mask[dstRow + x] = 1;
        }
      }

      if (radius <= 0) {
        for (let y = 0; y < frameH; y++) {
          for (let x = 0; x < frameW; x++) {
            const bi = y * frameW + x;
            if (!mask[bi]) continue;
            const oi = ((dstOy + y) * outW + (dstOx + x)) * 4;
            out.data[oi + 0] = 255;
            out.data[oi + 1] = 255;
            out.data[oi + 2] = 255;
            out.data[oi + 3] = 255;
          }
        }
        continue;
      }

      const expW = outFrameW | 0;
      const expH = outFrameH | 0;
      const expanded = new Uint8Array(expW * expH);
      for (let y = 0; y < frameH; y++) {
        const row = (y + radius) * expW;
        const srcRow = y * frameW;
        for (let x = 0; x < frameW; x++) {
          if (mask[srcRow + x]) expanded[row + (x + radius)] = 1;
        }
      }

      const dm = buildDilatedMaskBits(expanded, expW, expH, radius);
      for (let y = 0; y < expH; y++) {
        for (let x = 0; x < expW; x++) {
          const bi = y * expW + x;
          if (!dm[bi] || expanded[bi]) continue;
          const oi = ((dstOy + y) * outW + (dstOx + x)) * 4;
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
  const radii = parseRadii(args);
  let skipExisting = DEFAULT_SKIP_EXISTING;
  if (args.includes("--overwrite") || args.includes("--force")) skipExisting = false;
  if (args.includes("--skip-existing")) skipExisting = true;

  const inputs = [];
  for (const dir of MONSTER_DIRS) {
    const files = listPngs(dir);
    for (const file of files) inputs.push({ file, dir });
  }
  if (inputs.length === 0) {
    console.error(`[mon-auras] No monster PNGs found in: ${MONSTER_DIRS.join(", ")}`);
    process.exit(1);
  }

  console.log(
    `[mon-auras] monsters=${inputs.length} radii=${radii.join(",")} skipExisting=${skipExisting ? "yes" : "no"}`
  );

  let missingSize = 0;

  for (const entry of inputs) {
    const file = entry.file;
    const name = path.basename(file, ".png");
    const dims = parseFrameSizeFromName(file);
    if (!dims) {
      missingSize++;
      console.error(`[mon-auras] ERROR ${name}: missing WxH in filename`);
      continue;
    }
    const { frameW, frameH } = dims;

    let src;
    try {
      src = await readPng(file);
    } catch (e) {
      console.warn(`[mon-auras] SKIP ${name}: failed to read PNG (${e})`);
      continue;
    }

    for (const radius of radii) {
      const outName = `${name}_aura_r${radius}.png`;
      const outPath = path.join(entry.dir, OUT_SUBDIR, outName);
      if (skipExisting && fs.existsSync(outPath)) continue;

      const r = buildAuraSheetForGrid(src, frameW, frameH, radius);
      if (!r.ok) {
        console.warn(`[mon-auras] SKIP ${name} (${frameW}x${frameH}): ${r.reason}`);
        continue;
      }

      await writePng(r.out, outPath);
      console.log(
        `[mon-auras] wrote ${path.relative(ROOT, outPath)} (frames=${r.rows}x${r.cols}, frame=${frameW}x${frameH})`
      );
    }
  }

  if (missingSize > 0) {
    console.error(`[mon-auras] ERROR missing size suffix in ${missingSize} monster file(s).`);
    process.exit(1);
  }

  console.log("[mon-auras] done");
}

main().catch((e) => {
  console.error("[mon-auras] ERROR", e);
  process.exit(1);
});
