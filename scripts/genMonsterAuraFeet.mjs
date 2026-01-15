#!/usr/bin/env node
/**
 * Generate precomputed "foot" positions for monster aura sheets.
 *
 * For each aura PNG in assets/monsters/monster_auras, we:
 *   - Read the PNG without external deps.
 *   - Scan the center column for the lowest non-transparent pixel.
 *   - Lift that pixel upward by FOOT_LIFT_PX (clamped) to avoid tiny overhangs.
 *   - Emit a TS module exporting a map keyed by monster id.
 *
 * Output: src/generated/monsterAuraFeet.ts
 *
 * Usage: node scripts/genMonsterAuraFeet.mjs
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(path.join(__dirname, ".."));
const AURA_DIR = path.join(ROOT, "assets/monsters/monster_auras");
const OUT_TS = path.join(ROOT, "src/generated/monsterAuraFeet.ts");
const FOOT_LIFT_PX = 2;       // lift the foot a bit to avoid grabbing trailing pixels
const OVERWRITE_ALL = false;  // set true to recompute all entries; false fills only missing ids

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function parsePng(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Bad PNG signature");
  }
  let pos = 8;
  let w, h, bitDepth, colorType, interlace, comp, flt;
  const idat = [];
  let palette = null;
  let trans = null;

  while (pos + 8 <= data.length) {
    const len = data.readUInt32BE(pos); pos += 4;
    const type = data.slice(pos, pos + 4).toString("ascii"); pos += 4;
    const chunk = data.slice(pos, pos + len); pos += len;
    pos += 4; // crc

    if (type === "IHDR") {
      w = chunk.readUInt32BE(0);
      h = chunk.readUInt32BE(4);
      bitDepth = chunk.readUInt8(8);
      colorType = chunk.readUInt8(9);
      comp = chunk.readUInt8(10);
      flt = chunk.readUInt8(11);
      interlace = chunk.readUInt8(12);
    } else if (type === "PLTE") {
      palette = [];
      for (let i = 0; i < chunk.length; i += 3) {
        palette.push([chunk[i], chunk[i + 1], chunk[i + 2]]);
      }
    } else if (type === "tRNS") {
      trans = chunk;
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || comp !== 0 || flt !== 0 || interlace !== 0) {
    throw new Error("Unsupported PNG format");
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const stride = w * bpp;
  const rows = [];
  let offset = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[offset]; offset += 1;
    let cur = Buffer.from(raw.slice(offset, offset + stride)); offset += stride;
    if (f === 1) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        cur[i] = (cur[i] + left) & 0xff;
      }
    } else if (f === 2) {
      for (let i = 0; i < stride; i++) {
        cur[i] = (cur[i] + prev[i]) & 0xff;
      }
    } else if (f === 3) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        const up = prev[i];
        cur[i] = (cur[i] + ((left + up) >> 1)) & 0xff;
      }
    } else if (f === 4) {
      for (let i = 0; i < stride; i++) {
        const left = i >= bpp ? cur[i - bpp] : 0;
        const up = prev[i];
        const upLeft = i >= bpp ? prev[i - bpp] : 0;
        cur[i] = (cur[i] + paeth(left, up, upLeft)) & 0xff;
      }
    } else if (f !== 0) {
      throw new Error("Unsupported PNG filter");
    }
    rows.push(cur);
    prev = cur;
  }

  const rgbaRows = [];
  if (colorType === 6) {
    rgbaRows.push(...rows.map(r => Buffer.from(r)));
  } else if (colorType === 2) {
    for (const r of rows) {
      const out = Buffer.alloc(w * 4);
      for (let i = 0; i < w; i++) {
        out[i * 4] = r[i * 3];
        out[i * 4 + 1] = r[i * 3 + 1];
        out[i * 4 + 2] = r[i * 3 + 2];
        out[i * 4 + 3] = 255;
      }
      rgbaRows.push(out);
    }
  } else if (colorType === 0) {
    for (const r of rows) {
      const out = Buffer.alloc(w * 4);
      for (let i = 0; i < w; i++) {
        const g = r[i];
        out[i * 4] = g; out[i * 4 + 1] = g; out[i * 4 + 2] = g; out[i * 4 + 3] = 255;
      }
      rgbaRows.push(out);
    }
  } else if (colorType === 4) {
    for (const r of rows) {
      const out = Buffer.alloc(w * 4);
      for (let i = 0; i < w; i++) {
        out[i * 4] = r[i * 2];
        out[i * 4 + 1] = r[i * 2];
        out[i * 4 + 2] = r[i * 2];
        out[i * 4 + 3] = r[i * 2 + 1];
      }
      rgbaRows.push(out);
    }
  } else if (colorType === 3) {
    const alphas = trans ? [...trans] : null;
    for (const r of rows) {
      const out = Buffer.alloc(w * 4);
      for (let i = 0; i < w; i++) {
        const idx = r[i];
        const [pr, pg, pb] = (palette && palette[idx]) ? palette[idx] : [0, 0, 0];
        const a = alphas && idx < alphas.length ? alphas[idx] : 255;
        out[i * 4] = pr; out[i * 4 + 1] = pg; out[i * 4 + 2] = pb; out[i * 4 + 3] = a;
      }
      rgbaRows.push(out);
    }
  }

  return { w, h, rows: rgbaRows };
}

function parseAuraId(baseName) {
  // baseName example: "bat 64x64 ULDR 1Walk_aura_r2"
  const cleaned = baseName.replace(/_aura_r2$/i, "").replace(/_/g, " ").trim();
  const tokens = cleaned.split(/\s+/);
  const sizeIdx = tokens.findIndex(t => /^\d+x\d+$/i.test(t));
  const idTokens = sizeIdx >= 0 ? tokens.slice(0, sizeIdx) : tokens;
  const id = idTokens.join(" ").trim();
  return id;
}

function findFoot(baseName, filePath) {
  const { w, h, rows } = parsePng(filePath);
  const cx = Math.floor(w / 2);
  let foot = h - 1;
  for (let y = h - 1; y >= 0; y--) {
    const a = rows[y][cx * 4 + 3];
    if (a > 0) { foot = y; break; }
  }
  let lifted = foot - FOOT_LIFT_PX;
  if (lifted < 0) lifted = 0;
  return { frameW: w, frameH: h, footBottom: lifted };
}

function main() {
  const files = fs.readdirSync(AURA_DIR).filter(f => f.toLowerCase().endsWith(".png"));
  // Seed with existing data if present
  let out = {};
  if (!OVERWRITE_ALL && fs.existsSync(OUT_TS)) {
    try {
      const txt = fs.readFileSync(OUT_TS, "utf8");
      // Allow optional TS type annotation between name and '='
      const match = txt.match(/MONSTER_AURA_FEET[^=]*=\s*({[\s\S]*?});/);
      if (match && match[1]) {
        out = JSON.parse(match[1]);
      }
    } catch (e) {
      console.warn("[genMonsterAuraFeet] failed to read existing map, will regenerate missing only", e);
    }
  }

  for (const f of files) {
    const full = path.join(AURA_DIR, f);
    const base = f.replace(/\.png$/i, "");
    const id = parseAuraId(base);
    if (!OVERWRITE_ALL && out[id]) {
      continue; // already have entry
    }
    try {
      const info = findFoot(base, full);
      out[id] = info;
      console.log("[genMonsterAuraFeet] ", id, "->", info);
    } catch (e) {
      console.warn("[genMonsterAuraFeet] failed for", f, e);
    }
  }

  const lines = [];
  lines.push("// AUTO-GENERATED by scripts/genMonsterAuraFeet.mjs");
  lines.push("export const MONSTER_AURA_FOOT_LIFT_PX = " + FOOT_LIFT_PX + ";");
  lines.push("export const MONSTER_AURA_FEET: Record<string, { frameW: number; frameH: number; footBottom: number; }> = " + JSON.stringify(out, null, 2) + ";");
  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  fs.writeFileSync(OUT_TS, lines.join("\n") + "\n", "utf8");
  console.log("Wrote", OUT_TS);
}

main();
