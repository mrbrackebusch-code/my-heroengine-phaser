#!/usr/bin/env node
// scripts/genAuraMaskBits.mjs
// Build 1-bit collision masks from aura PNGs.
// - Writes <aura>.mask.json next to each aura PNG (optional).
// - Writes src/generated/auraMaskBits.ts for runtime lookup.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const OUT_TS = path.join(ROOT, "src", "generated", "auraMaskIndex.ts");
const DEFAULT_RADII = [0, 1, 2, 3];

function usage() {
  console.log(`
Usage: node scripts/genAuraMaskBits.mjs [options]

Options:
  --overwrite, --force   Overwrite existing *.mask.json files.
  --skip-existing        Skip writing *.mask.json if it already exists (default).
  --check                Only verify mask outputs exist (no writes).
  --no-json              Do not emit per-aura JSON files.
  --radius N             Only process a single radius (overrides --radii).
  --radii a,b,c          Only process listed radii (default ${DEFAULT_RADII.join(",")}).
  --rebuild              Rebuild all bins from scratch (no incremental append).
  --help                 Show this help.
`);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .map((f) => path.join(dir, f))
    .sort();
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

function parseRadiusFromName(baseName) {
  const m = /_aura_r(\d+)/i.exec(String(baseName || ""));
  if (!m) return null;
  const r = parseInt(m[1], 10);
  return Number.isFinite(r) ? (r | 0) : null;
}

function parseSizeFromName(baseName) {
  const m = /(\d+)\s*x\s*(\d+)/i.exec(String(baseName || ""));
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { frameW: w | 0, frameH: h | 0 };
}

function parseWeaponSizeFromName(baseName) {
  const m = /^t(064|128|192)__/i.exec(String(baseName || ""));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { frameW: n | 0, frameH: n | 0 };
}

function kindFromRel(rel) {
  if (rel.startsWith("assets/tiles/auras/")) return "tiles";
  if (rel.startsWith("assets/props/auras/")) return "props";
  if (rel.startsWith("assets/heroes/auras/")) return "hero";
  if (rel.startsWith("assets/enemies/humanoid/auras/")) return "hero";
  if (rel.startsWith("assets/enemies/monsters/auras/")) return "monster";
  if (rel.startsWith("assets/enemies/bosses/auras/")) return "monster";
  if (rel.startsWith("assets/effects/auras/")) return "effects";
  if (rel.startsWith("assets/weapons/auras/")) return "weapons";
  return "other";
}

function textureKeyForAura(kind, baseName) {
  if (kind === "tiles") return `tiles.${baseName}`;
  if (kind === "props") return `anims.${baseName}`;
  if (kind === "effects") return `effects.${String(baseName || "").replace(/\\s+/g, "_")}`;
  return baseName;
}

function frameSizeForAura(kind, baseName, radius) {
  let size = null;
  if (kind === "tiles") size = { frameW: 32, frameH: 32 };
  else if (kind === "hero") {
    if (String(baseName || "").includes("_192")) size = { frameW: 192, frameH: 192 };
    else size = { frameW: 64, frameH: 64 };
  } else if (kind === "weapons") {
    size = parseWeaponSizeFromName(baseName) || parseSizeFromName(baseName);
  } else {
    size = parseSizeFromName(baseName);
  }
  if (!size) return null;
  const r = (radius | 0) || 0;
  if (r > 0) {
    return { frameW: (size.frameW + r * 2) | 0, frameH: (size.frameH + r * 2) | 0 };
  }
  return size;
}

function readGroupBinary(dirPath) {
  const binPath = path.join(dirPath, "_mask.bin");
  if (!fs.existsSync(binPath)) return null;
  try {
    const buf = fs.readFileSync(binPath);
    if (buf.length < 8) return null;
    if (buf[0] !== 0x41 || buf[1] !== 0x4d || buf[2] !== 0x53 || buf[3] !== 0x4b) return null;
    const headerLen = buf.readUInt32LE(4);
    let dataOffset = 8 + headerLen;
    if ((dataOffset & 3) !== 0) dataOffset += (4 - (dataOffset & 3));
    if (dataOffset > buf.length) return null;
    const headerStr = buf.slice(8, 8 + headerLen).toString("utf8");
    const header = JSON.parse(headerStr);
    const byteLen = buf.length - dataOffset;
    if ((byteLen & 3) !== 0) return null;
    const words = new Uint32Array(buf.buffer, buf.byteOffset + dataOffset, byteLen >>> 2);
    return { header, words };
  } catch {
    return null;
  }
}

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

function buildMaskBits(png, frameW, frameH) {
  const srcW = png.width | 0;
  const srcH = png.height | 0;
  if (srcW % frameW !== 0 || srcH % frameH !== 0) {
    throw new Error(`size ${srcW}x${srcH} not divisible by ${frameW}x${frameH}`);
  }
  const cols = (srcW / frameW) | 0;
  const rows = (srcH / frameH) | 0;
  const frames = (cols * rows) | 0;
  const bitsPerFrame = ((frameW * frameH) | 0);
  const wordsPerFrame = ((bitsPerFrame + 31) >>> 5) | 0;
  const bits = new Uint32Array((wordsPerFrame * frames) | 0);

  for (let fr = 0; fr < rows; fr++) {
    for (let fc = 0; fc < cols; fc++) {
      const frameIndex = ((fr * cols + fc) | 0);
      const baseWord = (frameIndex * wordsPerFrame) | 0;
      const ox = (fc * frameW) | 0;
      const oy = (fr * frameH) | 0;
      for (let y = 0; y < frameH; y++) {
        const rowStart = (((oy + y) * srcW + ox) * 4) | 0;
        const bitRow = (y * frameW) | 0;
        for (let x = 0; x < frameW; x++) {
          const a = png.data[rowStart + (x * 4) + 3] | 0;
          if (a === 0) continue;
          const bitIndex = (bitRow + x) | 0;
          const wordIndex = (bitIndex >>> 5) | 0;
          bits[baseWord + wordIndex] |= (1 << (bitIndex & 31));
        }
      }
    }
  }

  return { cols, rows, wordsPerFrame, bits };
}

function writeGroupBinary(dirPath, payload) {
  // Single-file composite mask: binary with JSON header.
  // Format:
  //  - 4 bytes: "AMSK"
  //  - 4 bytes: uint32 LE header length
  //  - N bytes: UTF-8 JSON header
  //  - M bytes: uint32 LE words payload
  ensureDir(dirPath);
  const outPath = path.join(dirPath, "_mask.bin");
  const { words, ...header } = payload || {};
  const headerJson = JSON.stringify(header);
  const headerBuf = Buffer.from(headerJson, "utf8");
  const magic = Buffer.from("AMSK");
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32LE(headerBuf.length >>> 0, 0);
  const padLen = (4 - (headerBuf.length & 3)) & 3;
  const padBuf = padLen ? Buffer.alloc(padLen, 0) : Buffer.alloc(0);
  const wordArr = words instanceof Uint32Array ? words : new Uint32Array();
  const dataBuf = Buffer.from(wordArr.buffer, wordArr.byteOffset, wordArr.byteLength);
  const out = Buffer.concat([magic, headerLen, headerBuf, padBuf, dataBuf]);
  fs.writeFileSync(outPath, out);
}

function writeIndexTsFile(entries, binRels) {
  ensureDir(path.dirname(OUT_TS));
  const lines = [];
  lines.push("// AUTO-GENERATED by scripts/genAuraMaskBits.mjs. Do not edit.");
  lines.push("export type AuraMaskIndexEntry = { bin: string; w: number; h: number; cols: number; rows: number; wordsPerFrame: number; wordOffset: number; wordCount: number; };");
  lines.push("export const AURA_MASK_INDEX: Record<string, AuraMaskIndexEntry> = {");
  for (const key of Object.keys(entries).sort()) {
    const e = entries[key];
    lines.push(`  ${JSON.stringify(key)}: { bin: ${JSON.stringify(e.bin)}, w: ${e.w}, h: ${e.h}, cols: ${e.cols}, rows: ${e.rows}, wordsPerFrame: ${e.wordsPerFrame}, wordOffset: ${e.wordOffset}, wordCount: ${e.wordCount} },`);
  }
  lines.push("};");
  lines.push("export const AURA_MASK_BINS: string[] = [");
  for (const binRel of Array.from(binRels).sort()) {
    lines.push(`  ${JSON.stringify(binRel)},`);
  }
  lines.push("];");
  fs.writeFileSync(OUT_TS, lines.join("\n"));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  let skipExisting = true;
  let writeJsonFiles = true;
  let checkOnly = false;
  let forceRebuild = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--overwrite" || a === "--force") skipExisting = false;
    else if (a === "--skip-existing") skipExisting = true;
    else if (a === "--no-json") writeJsonFiles = false;
    else if (a === "--check") checkOnly = true;
    else if (a === "--rebuild") forceRebuild = true;
  }

  const radii = parseRadii(args);

  const auraDirs = [
    path.join(ROOT, "assets", "tiles", "auras"),
    path.join(ROOT, "assets", "props", "auras"),
    path.join(ROOT, "assets", "heroes", "auras"),
    path.join(ROOT, "assets", "enemies", "humanoid", "auras"),
    path.join(ROOT, "assets", "enemies", "monsters", "auras"),
    path.join(ROOT, "assets", "enemies", "bosses", "auras"),
    path.join(ROOT, "assets", "effects", "auras"),
    path.join(ROOT, "assets", "weapons", "auras"),
  ];

  const entries = Object.create(null);
  const filesByDir = new Map();
  const binRels = new Set();
  const requiredKeys = [];
  let wroteJson = 0;
  let errors = 0;

  for (const dir of auraDirs) {
    const files = listPngs(dir);
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const baseName = path.basename(file, ".png");
      const radius = parseRadiusFromName(baseName);
      if (radius == null) continue;
      if (radii.length && !radii.includes(radius)) continue;

      const kind = kindFromRel(rel);
      const size = frameSizeForAura(kind, baseName, radius);
      if (!size) {
        console.error(`[aura-masks][ERROR] missing WxH in filename: ${rel}`);
        errors++;
        continue;
      }

      const texKey = textureKeyForAura(kind, baseName);
      requiredKeys.push(texKey);

      const list = filesByDir.get(dir) ?? [];
      list.push({ file, rel, baseName, texKey, kind, size });
      filesByDir.set(dir, list);
    }
  }

  if (checkOnly) {
    if (!fs.existsSync(OUT_TS)) {
      console.error(`[aura-masks][MISSING] ${path.relative(ROOT, OUT_TS)}`);
      errors++;
    }
    if (fs.existsSync(OUT_TS)) {
      const ts = fs.readFileSync(OUT_TS, "utf8");
      const keyMatches = new Set();
      const re = /"([^"]+)":\s*\{\s*bin:/g;
      let m;
      while ((m = re.exec(ts))) {
        keyMatches.add(m[1]);
      }
      for (const key of requiredKeys) {
        if (!keyMatches.has(key)) {
          console.error(`[aura-masks][MISSING] ${path.relative(ROOT, OUT_TS)} key=${key}`);
          errors++;
        }
      }
    }
    if (writeJsonFiles) {
      for (const dir of filesByDir.keys()) {
        const outPath = path.join(dir, "_mask.bin");
        if (!fs.existsSync(outPath)) {
          console.error(`[aura-masks][MISSING] ${path.relative(ROOT, outPath)}`);
          errors++;
        }
      }
    }
  } else {
    for (const [dir, list] of filesByDir.entries()) {
      if (!list || list.length === 0) continue;
      const relDir = path.relative(ROOT, dir).replace(/\\/g, "/");
      const binRel = `${relDir}/_mask.bin`;
      binRels.add(binRel);
      const existing = (!forceRebuild && writeJsonFiles) ? readGroupBinary(dir) : null;
      const existingEntries = (existing && existing.header && existing.header.entries) ? existing.header.entries : null;
      const existingWords = (existing && existing.words) ? existing.words : null;

      let needWrite = (!existingWords && writeJsonFiles);
      let appendedWords = 0;
      const newChunks = [];
      let wordsBaseLen = existingWords ? existingWords.length : 0;
      const compactEntries = Object.create(null);

      for (const info of list) {
        const ex = (!forceRebuild && existingEntries) ? existingEntries[info.texKey] : null;
        if (ex && ((ex.w | 0) === (info.size.frameW | 0)) && ((ex.h | 0) === (info.size.frameH | 0))) {
          compactEntries[info.texKey] = ex;
          entries[info.texKey] = {
            bin: binRel,
            w: ex.w | 0,
            h: ex.h | 0,
            cols: ex.cols | 0,
            rows: ex.rows | 0,
            wordsPerFrame: ex.wordsPerFrame | 0,
            wordOffset: ex.offsetWords | 0,
            wordCount: ex.wordCount | 0
          };
          continue;
        }

        let png;
        try {
          png = readPng(info.file);
        } catch (err) {
          console.error(`[aura-masks][ERROR] read failed: ${info.rel} (${err})`);
          errors++;
          continue;
        }

        let mask;
        try {
          mask = buildMaskBits(png, info.size.frameW | 0, info.size.frameH | 0);
        } catch (err) {
          console.error(`[aura-masks][ERROR] ${info.rel}: ${err}`);
          errors++;
          continue;
        }

        const bitsArr = mask.bits;
        const wordCount = bitsArr.length | 0;
        const offsetWords = (wordsBaseLen + appendedWords) | 0;
        appendedWords += wordCount;
        newChunks.push(bitsArr);
        compactEntries[info.texKey] = {
          w: info.size.frameW | 0,
          h: info.size.frameH | 0,
          cols: mask.cols | 0,
          rows: mask.rows | 0,
          wordsPerFrame: mask.wordsPerFrame | 0,
          offsetWords,
          wordCount
        };
        entries[info.texKey] = {
          bin: binRel,
          w: info.size.frameW | 0,
          h: info.size.frameH | 0,
          cols: mask.cols | 0,
          rows: mask.rows | 0,
          wordsPerFrame: mask.wordsPerFrame | 0,
          wordOffset: offsetWords,
          wordCount
        };
        needWrite = true;
      }

      if (writeJsonFiles && needWrite) {
        const totalWords = (wordsBaseLen + appendedWords) | 0;
        const words = new Uint32Array(totalWords);
        if (existingWords && existingWords.length) words.set(existingWords, 0);
        let cursor = wordsBaseLen;
        for (const chunk of newChunks) {
          words.set(chunk, cursor);
          cursor += chunk.length;
        }
        writeGroupBinary(dir, {
          version: 1,
          kind: list[0].kind,
          dir: relDir,
          entries: compactEntries,
          words
        });
        wroteJson++;
      }
    }
    writeIndexTsFile(entries, binRels);
  }

  if (errors > 0) {
    console.error(`[aura-masks] ERROR count=${errors}`);
    process.exit(1);
  }

  console.log(`[aura-masks] wroteJson=${wroteJson} radii=${radii.join(",")}`);
}

main().catch((e) => {
  console.error("[aura-masks] ERROR", e);
  process.exit(1);
});
