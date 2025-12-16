// scripts/gen-hero-auras.mjs
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();

// 64-grid (canonical)
const FRAME_W = 64;
const FRAME_H = 64;
const SHEET_COLS = 13;

// 192-grid (oversize view)
const FRAME_W_192 = 192;
const FRAME_H_192 = 192;

const RADIUS = 2;

const HERO_DIR = path.join(ROOT, "assets", "heroes");
const OUT_DIR = path.join(ROOT, "assets", "auras");

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

function buildAuraSheetForGrid(src, frameW, frameH, expectedColsOrNull) {
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

      const bits = buildDilatedMaskBits(frame, frameW, frameH, RADIUS);

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

async function main() {
  ensureDir(OUT_DIR);

  const heroFiles = listPngs(HERO_DIR);
  if (heroFiles.length === 0) {
    console.error(`[gen-auras] No PNGs found in ${HERO_DIR}`);
    process.exit(1);
  }

  console.log(`[gen-auras] heroes=${heroFiles.length} radius=${RADIUS}`);

  for (const heroPath of heroFiles) {
    const baseName = path.basename(heroPath, ".png");

    const src = await readPng(heroPath);

    // 64-grid aura
    const r64 = buildAuraSheetForGrid(src, FRAME_W, FRAME_H, SHEET_COLS);
    if (!r64.ok) {
      console.warn(`[gen-auras] SKIP ${baseName} (64): ${r64.reason}`);
    } else {
      if (r64.cols !== SHEET_COLS) {
        console.warn(
          `[gen-auras] WARN ${baseName} (64): cols=${r64.cols} (expected ${SHEET_COLS}). Continuing anyway.`
        );
      }
      const outPath64 = path.join(OUT_DIR, `${baseName}_aura_r${RADIUS}.png`);
      await writePng(r64.out, outPath64);
      console.log(`[gen-auras] wrote ${path.relative(ROOT, outPath64)}`);
    }

    // 192-grid aura (oversize view)
    const r192 = buildAuraSheetForGrid(src, FRAME_W_192, FRAME_H_192, null);
    if (!r192.ok) {
      console.warn(`[gen-auras] SKIP ${baseName} (192): ${r192.reason}`);
    } else {
      const outPath192 = path.join(OUT_DIR, `${baseName}_192_aura_r${RADIUS}.png`);
      await writePng(r192.out, outPath192);
      console.log(`[gen-auras] wrote ${path.relative(ROOT, outPath192)}`);
    }
  }

  console.log("[gen-auras] done");
}

main().catch((e) => {
  console.error("[gen-auras] ERROR", e);
  process.exit(1);
});
