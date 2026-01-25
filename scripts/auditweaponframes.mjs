#!/usr/bin/env node
/**
 * Compare original weapon frames against atlas frames at the same indices.
 *
 * This is a static, code-only audit: no Phaser runtime or browser required.
 *
 * Usage examples:
 *   node scripts/auditweaponframes.mjs --filter "arming__attack_slash__fg__vgold"
 *   node scripts/auditweaponframes.mjs --filter "spear__thrust__fg__vcopper" --frames "0,24,31"
 *   node scripts/auditweaponframes.mjs --filter "simple__spellcast__fg__vbase" --dir down --col 6
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const ATLAS_DIR = path.join(WEAPONS_DIR, "_atlas");
const META_PATH = path.join(ROOT, "src", "generated", "weaponAtlasMeta.ts");

const TILE_RE = /^t(064|128|192)$/i;
const DIRS = ["down", "left", "right", "up"];

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");

let filterRe = null;
let framesArg = "";
let dirArg = "";
let colArg = "";
let limit = Infinity;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--filter" && args[i + 1]) {
    filterRe = new RegExp(args[i + 1], "i");
    i++;
    continue;
  }
  if (a === "--frames" && args[i + 1]) {
    framesArg = String(args[i + 1] || "");
    i++;
    continue;
  }
  if (a === "--dir" && args[i + 1]) {
    dirArg = String(args[i + 1] || "").toLowerCase();
    i++;
    continue;
  }
  if (a === "--col" && args[i + 1]) {
    colArg = String(args[i + 1] || "");
    i++;
    continue;
  }
  if (a === "--limit" && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (Number.isFinite(n) && n > 0) limit = n | 0;
    i++;
  }
}

function basenameNoExt(p) {
  const file = p.split(/[\\/]/).pop() || p;
  return file.replace(/\.png$/i, "");
}

function listOriginalPngs(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.toLowerCase() === "_atlas") continue;
      listOriginalPngs(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".png")) continue;
    out.push(full);
  }
}

function parseWeaponFilename(base) {
  const parts = base.split("__").filter(Boolean);
  if (parts.length < 6) return null;
  const tPart = parts[0];
  if (!TILE_RE.test(tPart)) return null;
  let vIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^v.+/i.test(parts[i])) {
      vIndex = i;
      break;
    }
  }
  if (vIndex < 5) return null;
  const layer = parts[vIndex - 1];
  const anim = parts[vIndex - 2];
  const modelTokens = parts.slice(2, vIndex - 2);
  if (!modelTokens.length) return null;
  const model = modelTokens.join("_");
  const variant = parts[vIndex].slice(1);
  const tileNum = Number(tPart.slice(1));
  const tile = tileNum === 64 ? 64 : tileNum === 128 ? 128 : 192;
  if (layer !== "bg" && layer !== "fg") return null;
  return { key: base, model, anim, layer, variant, tile };
}

function extractJson(text, name, isArray) {
  const re = new RegExp(
    `export const ${name} = (\\${isArray ? "[" : "{"}.*?\\${isArray ? "]" : "}"});`,
    "s"
  );
  const match = text.match(re);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function loadMeta() {
  const text = fs.readFileSync(META_PATH, "utf8");
  const sheets = extractJson(text, "WEAPON_ATLAS_SHEETS", true);
  const data = extractJson(text, "WEAPON_ATLAS_DATA", false);
  if (!sheets || !data) throw new Error("Failed to parse weaponAtlasMeta.ts");
  return { sheets, data };
}

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function parseFramesArg(frames, cols, rows) {
  const total = Math.max(1, (cols | 0) * (rows | 0));
  if (!frames) return [0, Math.max(0, total - 1)];
  return frames
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = Number(s);
      return Number.isFinite(n) ? (n | 0) : -1;
    })
    .filter((n) => n >= 0 && n < total);
}

function dirIndex(dir) {
  const i = DIRS.indexOf(String(dir || "").toLowerCase());
  return i >= 0 ? i : 0;
}

function frameIndexFromDirCol(dir, col, cols, rows) {
  const safeCols = Math.max(1, cols | 0);
  const safeRows = Math.max(1, rows | 0);
  const row = safeRows >= 4 ? dirIndex(dir) : 0;
  const safeCol = Math.max(0, Math.min(safeCols - 1, col | 0));
  return row * safeCols + safeCol;
}

function compareFrame(orig, atlas, ox, oy, ax, ay, w, h) {
  let diffPixels = 0;
  for (let y = 0; y < h; y++) {
    const oRow = ((oy + y) * orig.width + ox) << 2;
    const aRow = ((ay + y) * atlas.width + ax) << 2;
    for (let x = 0; x < w; x++) {
      const oi = oRow + (x << 2);
      const ai = aRow + (x << 2);
      if (
        orig.data[oi] !== atlas.data[ai] ||
        orig.data[oi + 1] !== atlas.data[ai + 1] ||
        orig.data[oi + 2] !== atlas.data[ai + 2] ||
        orig.data[oi + 3] !== atlas.data[ai + 3]
      ) {
        diffPixels++;
      }
    }
  }
  return diffPixels;
}

function main() {
  const { sheets, data } = loadMeta();
  const sheetByKey = new Map(sheets.map((s) => [s.key, s]));
  const atlasCache = new Map();

  const originals = [];
  listOriginalPngs(WEAPONS_DIR, originals);

  let checkedSheets = 0;
  let mismatchedSheets = 0;
  let checkedFrames = 0;
  let mismatchedFrames = 0;

  for (const origPath of originals) {
    if (checkedSheets >= limit) break;
    const key = basenameNoExt(origPath);
    if (filterRe && !filterRe.test(key)) continue;

    const parsed = parseWeaponFilename(key);
    if (!parsed) continue;

    const meta = sheetByKey.get(key);
    if (!meta) continue;
    if (!meta.atlasKey) continue;

    const atlasEntry = data[meta.atlasKey];
    const frameRect = atlasEntry?.frames?.[key]?.frame;
    const atlasImage = atlasEntry?.meta?.image;
    if (!frameRect || !atlasImage) continue;

    const atlasPath = path.join(ATLAS_DIR, atlasImage);
    if (!fs.existsSync(atlasPath)) continue;

    const origPng = readPng(origPath);
    let atlasPng = atlasCache.get(atlasPath);
    if (!atlasPng) {
      atlasPng = readPng(atlasPath);
      atlasCache.set(atlasPath, atlasPng);
    }

    const cols = meta.cols | 0;
    const rows = meta.rows | 0;
    const frameW = meta.frameW | 0;
    const frameH = meta.frameH | 0;

    const framesToCheck = (() => {
      if (dirArg && colArg) {
        const col = Number(colArg);
        if (Number.isFinite(col)) {
          return [frameIndexFromDirCol(dirArg, col | 0, cols, rows)];
        }
      }
      return parseFramesArg(framesArg, cols, rows);
    })();

    checkedSheets++;

    let sheetHasMismatch = false;

    for (const frameIndex of framesToCheck) {
      const col = frameIndex % cols;
      const row = Math.floor(frameIndex / cols);

      const ox = col * frameW;
      const oy = row * frameH;

      const ax = (frameRect.x | 0) + ox;
      const ay = (frameRect.y | 0) + oy;

      const diffPixels = compareFrame(origPng, atlasPng, ox, oy, ax, ay, frameW, frameH);
      checkedFrames++;

      const line =
        "[WPN-FRAME-AUDIT] key=" + key +
        " atlas=" + meta.atlasKey +
        " image=" + atlasImage +
        " frame=" + frameIndex +
        " row=" + row +
        " col=" + col +
        " diff=" + diffPixels;

      if (diffPixels !== 0) {
        mismatchedFrames++;
        sheetHasMismatch = true;
        console.log(line);
      } else if (verbose) {
        console.log(line);
      }
    }

    if (sheetHasMismatch) mismatchedSheets++;
  }

  console.log(
    "[WPN-FRAME-AUDIT] sheets=" + checkedSheets +
      " mismatchedSheets=" + mismatchedSheets +
      " frames=" + checkedFrames +
      " mismatchedFrames=" + mismatchedFrames
  );
}

main();

