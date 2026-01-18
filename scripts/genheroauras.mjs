// scripts/genheroauras.mjs
// Generate aura masks for hero-style sheets (heroes + humanoid enemies).
// Outputs <name>_aura_r{radius}.png in each parent folder's auras/ subdir.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();

// 64-grid (canonical)
const FRAME_W = 64;
const FRAME_H = 64;
const SHEET_COLS = 13;

// Default behavior (toggle here)
const SKIP_EXISTING = true; // flip to false if you always want rebuilds

const DEFAULT_RADII = [0, 1, 2, 3];

const HERO_DIR = path.join(ROOT, "assets", "heroes");
const HERO_OUT = path.join(ROOT, "assets", "heroes", "auras");
const HUMANOID_DIR = path.join(ROOT, "assets", "enemies", "humanoid");
const HUMANOID_OUT = path.join(ROOT, "assets", "enemies", "humanoid", "auras");
const INPUTS = [
  { label: "heroes", dir: HERO_DIR, outDir: HERO_OUT },
  { label: "humanoid", dir: HUMANOID_DIR, outDir: HUMANOID_OUT },
];

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

// SKIP_EXISTING is controlled solely by the constant above.

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .map((f) => path.join(dir, f));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// 1-bit mask as Uint32 bitset
function allocBits(n) {
  return new Uint32Array((n + 31) >>> 5);
}
function getBit(bits, i) {
  return (bits[i >>> 5] & (1 << (i & 31))) !== 0;
}
function setBit(bits, i) {
  bits[i >>> 5] |= (1 << (i & 31));
}

function buildDilatedMaskBits(frameRgba, w, h, r) {
  const n = w * h;
  const base = allocBits(n);

  // alpha>0 base mask
  for (let i = 0; i < n; i++) {
    const a = frameRgba[i * 4 + 3];
    if (a !== 0) setBit(base, i);
  }

  if (r <= 0) return base;

  // square dilation
  const out = allocBits(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!getBit(base, i)) continue;

      const y0 = clamp(y - r, 0, h - 1);
      const y1 = clamp(y + r, 0, h - 1);
      const x0 = clamp(x - r, 0, w - 1);
      const x1 = clamp(x + r, 0, w - 1);

      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * w;
        for (let xx = x0; xx <= x1; xx++) {
          setBit(out, row + xx);
        }
      }
    }
  }
  return out;
}

function readPng(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on("parsed", function () {
        resolve(this);
      })
      .on("error", reject);
  });
}

function writePng(png, filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    png.pack().pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function buildAuraSheetForGrid(src, frameW, frameH, expectedColsOrNull, radius) {
  if (src.width % frameW !== 0 || src.height % frameH !== 0) {
    return { ok: false, reason: `size ${src.width}x${src.height} not divisible by ${frameW}x${frameH}` };
  }

  const rows = src.height / frameH;
  const cols = src.width / frameW;

  if (expectedColsOrNull != null && cols !== expectedColsOrNull) {
    // Not fatal; just warning for 64-grid
  }

  const out = new PNG({ width: src.width, height: src.height });

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const ox = fc * frameW;
      const oy = fr * frameH;

      // extract frame RGBA
      const frame = Buffer.alloc(frameW * frameH * 4);
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const si = ((oy + y) * src.width + (ox + x)) * 4;
          const di = (y * frameW + x) * 4;
          frame[di + 0] = src.data[si + 0];
          frame[di + 1] = src.data[si + 1];
          frame[di + 2] = src.data[si + 2];
          frame[di + 3] = src.data[si + 3];
        }
      }

      const bits = buildDilatedMaskBits(frame, frameW, frameH, radius);

      // write frame into out png (white pixels where bit=1)
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const bi = y * frameW + x;
          if (!getBit(bits, bi)) continue;

          const oi = ((oy + y) * out.width + (ox + x)) * 4;
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

async function main() {
  const radii = parseRadii(process.argv.slice(2));
  for (const input of INPUTS) ensureDir(input.outDir);

  const batches = INPUTS.map((input) => ({
    label: input.label,
    outDir: input.outDir,
    files: listPngs(input.dir),
  }));
  const totalFiles = batches.reduce((sum, b) => sum + b.files.length, 0);
  if (totalFiles === 0) {
    console.error(`[gen-auras] No PNGs found in hero inputs.`);
    process.exit(1);
  }

  console.log(
    `[gen-auras] heroes=${batches[0]?.files.length ?? 0} humanoid=${batches[1]?.files.length ?? 0} ` +
    `radii=${radii.join(",")} skipExisting=${SKIP_EXISTING ? "yes" : "no"}`
  );

  for (const batch of batches) {
    for (const heroPath of batch.files) {
      const baseName = path.basename(heroPath, ".png");
      const src = await readPng(heroPath);

      for (const radius of radii) {
        // 64-grid aura
        const r64 = buildAuraSheetForGrid(src, FRAME_W, FRAME_H, SHEET_COLS, radius);
        if (!r64.ok) {
          console.warn(`[gen-auras] SKIP ${baseName} (64): ${r64.reason}`);
          continue;
        }
        if (r64.cols !== SHEET_COLS) {
          console.warn(
            `[gen-auras] WARN ${baseName} (64): cols=${r64.cols} (expected ${SHEET_COLS}). Continuing anyway.`
          );
        }
        const outPath64 = path.join(batch.outDir, `${baseName}_aura_r${radius}.png`);
        if (SKIP_EXISTING && fs.existsSync(outPath64)) continue;
        await writePng(r64.out, outPath64);
        console.log(`[gen-auras] wrote ${path.relative(ROOT, outPath64)}`);
      }
    }
  }

  console.log("[gen-auras] done");
}

main().catch((e) => {
  console.error("[gen-auras] ERROR", e);
  process.exit(1);
});
