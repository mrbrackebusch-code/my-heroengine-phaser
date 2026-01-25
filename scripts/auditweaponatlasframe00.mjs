#!/usr/bin/env node
/**
 * Audit atlas mappings by comparing frame (0,0) from originals to mapped atlas pixels.
 * Outputs a JSON report to tmp/weaponAtlasFrame00Audit.json.
 *
 * Usage:
 *   node scripts/auditweaponatlasframe00.mjs [--filter <regex>] [--limit <n>] [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const ATLAS_DIR = path.join(WEAPONS_DIR, "_atlas");
const META_PATH = path.join(ROOT, "src", "generated", "weaponAtlasMeta.ts");
const OUT_DIR = path.join(ROOT, "tmp");
const OUT_PATH = path.join(OUT_DIR, "weaponAtlasFrame00Audit.json");

const TILE_RE = /^t(064|128|192)$/i;
const EXCLUDE_MODELS = new Set(["cane_female", "wand_female", "wand_male"]);

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
let filterRe = null;
let limit = Infinity;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--filter" && args[i + 1]) {
    filterRe = new RegExp(args[i + 1]);
    i++;
    continue;
  }
  if (args[i] === "--limit" && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (Number.isFinite(n) && n > 0) limit = n | 0;
    i++;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listPngs(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.toLowerCase() === "_atlas") continue;
      listPngs(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".png")) continue;
    out.push(full);
  }
}

function basenameNoExt(p) {
  const file = p.split(/[\\/]/).pop() || p;
  return file.replace(/\.png$/i, "");
}

function parseWeaponFilename(base) {
  const parts = base.split("__").filter(Boolean);
  if (parts.length < 6) return null;
  const tPart = parts[0];
  if (!TILE_RE.test(tPart)) return null;
  const category = parts[1];
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
  const tile = (tileNum === 64 ? 64 : tileNum === 128 ? 128 : 192);
  if (!category || !model || !anim || !variant) return null;
  if (layer !== "bg" && layer !== "fg") return null;
  return {
    key: base,
    tile,
    category,
    model,
    anim,
    layer,
    variant
  };
}

function extractJson(text, name, isArray) {
  const re = new RegExp(`export const ${name} = (\\${isArray ? "[" : "{"}.*?\\${isArray ? "]" : "}"});`, "s");
  const match = text.match(re);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function loadMeta() {
  const text = fs.readFileSync(META_PATH, "utf8");
  const sheets = extractJson(text, "WEAPON_ATLAS_SHEETS", true);
  const data = extractJson(text, "WEAPON_ATLAS_DATA", false);
  if (!sheets || !data) {
    throw new Error("Failed to parse weaponAtlasMeta.ts exports");
  }
  return { sheets, data };
}

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function compareFrame00(orig, atlas, frame, tile) {
  const ow = orig.width | 0;
  const oh = orig.height | 0;
  const aw = atlas.width | 0;
  const ah = atlas.height | 0;
  const fx = frame.x | 0;
  const fy = frame.y | 0;

  if (ow < tile || oh < tile) {
    return { ok: false, diffPixels: -1, reason: "original too small" };
  }
  if (fx + tile > aw || fy + tile > ah) {
    return { ok: false, diffPixels: -1, reason: "atlas frame out of bounds" };
  }

  let diffPixels = 0;
  let firstDiff = null;

  for (let y = 0; y < tile; y++) {
    const oRow = (y * ow) << 2;
    const aRow = ((fy + y) * aw + fx) << 2;
    for (let x = 0; x < tile; x++) {
      const oi = oRow + (x << 2);
      const ai = aRow + (x << 2);
      const r1 = orig.data[oi];
      const g1 = orig.data[oi + 1];
      const b1 = orig.data[oi + 2];
      const a1 = orig.data[oi + 3];
      const r2 = atlas.data[ai];
      const g2 = atlas.data[ai + 1];
      const b2 = atlas.data[ai + 2];
      const a2 = atlas.data[ai + 3];
      if (r1 !== r2 || g1 !== g2 || b1 !== b2 || a1 !== a2) {
        diffPixels++;
        if (!firstDiff) {
          firstDiff = {
            x,
            y,
            original: [r1, g1, b1, a1],
            atlas: [r2, g2, b2, a2]
          };
        }
      }
    }
  }

  return { ok: diffPixels === 0, diffPixels, firstDiff };
}

function main() {
  const { sheets, data } = loadMeta();
  const sheetByKey = new Map(sheets.map((s) => [s.key, s]));
  const atlasCache = new Map();

  const originals = [];
  listPngs(WEAPONS_DIR, originals);

  const report = {
    metaPath: META_PATH,
    atlasDir: ATLAS_DIR,
    totalOriginals: originals.length,
    checked: 0,
    matched: 0,
    mismatched: 0,
    skippedExcluded: 0,
    missingMeta: 0,
    missingAtlasKey: 0,
    missingAtlasFrame: 0,
    missingAtlasImage: 0,
    errors: 0,
    details: {
      mismatches: [],
      missingMeta: [],
      missingAtlasKey: [],
      missingAtlasFrame: [],
      missingAtlasImage: [],
      errors: []
    }
  };

  for (const file of originals) {
    if (report.checked >= limit) break;
    const base = basenameNoExt(file);
    if (filterRe && !filterRe.test(base)) continue;

    const parsed = parseWeaponFilename(base);
    if (!parsed) continue;
    if (EXCLUDE_MODELS.has(parsed.model)) {
      report.skippedExcluded++;
      continue;
    }

    const sheet = sheetByKey.get(base);
    if (!sheet) {
      report.missingMeta++;
      report.details.missingMeta.push({ key: base, file });
      continue;
    }

    const atlasEntry = data[sheet.atlasKey];
    if (!atlasEntry) {
      report.missingAtlasKey++;
      report.details.missingAtlasKey.push({ key: base, atlasKey: sheet.atlasKey });
      continue;
    }

    const frame = atlasEntry.frames?.[base]?.frame;
    if (!frame) {
      report.missingAtlasFrame++;
      report.details.missingAtlasFrame.push({ key: base, atlasKey: sheet.atlasKey });
      continue;
    }

    const atlasImage = atlasEntry.meta?.image;
    if (!atlasImage) {
      report.missingAtlasImage++;
      report.details.missingAtlasImage.push({ key: base, atlasKey: sheet.atlasKey });
      continue;
    }

    const atlasPath = path.join(ATLAS_DIR, atlasImage);
    if (!fs.existsSync(atlasPath)) {
      report.missingAtlasImage++;
      report.details.missingAtlasImage.push({ key: base, atlasKey: sheet.atlasKey, atlasPath });
      continue;
    }

    let atlasPng = atlasCache.get(atlasPath);
    if (!atlasPng) {
      atlasPng = readPng(atlasPath);
      atlasCache.set(atlasPath, atlasPng);
    }

    let origPng;
    try {
      origPng = readPng(file);
    } catch (err) {
      report.errors++;
      report.details.errors.push({ key: base, file, error: String(err) });
      continue;
    }

    report.checked++;

    const cmp = compareFrame00(origPng, atlasPng, frame, sheet.tile | 0);
    if (cmp.ok) {
      report.matched++;
      if (verbose) console.log(`[OK] ${base}`);
      continue;
    }

    report.mismatched++;
    report.details.mismatches.push({
      key: base,
      file,
      atlasKey: sheet.atlasKey,
      atlasImage,
      tile: sheet.tile,
      frame,
      diffPixels: cmp.diffPixels,
      firstDiff: cmp.firstDiff,
      reason: cmp.reason || null
    });

    if (verbose) {
      console.log(`[MISMATCH] ${base} diffPixels=${cmp.diffPixels} reason=${cmp.reason || "pixel-diff"}`);
    }
  }

  ensureDir(OUT_DIR);
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log(`[WPN-FRAME00-AUDIT] checked=${report.checked} matched=${report.matched} mismatched=${report.mismatched}`);
  console.log(`[WPN-FRAME00-AUDIT] missingMeta=${report.missingMeta} missingAtlasKey=${report.missingAtlasKey} missingAtlasFrame=${report.missingAtlasFrame} missingAtlasImage=${report.missingAtlasImage} errors=${report.errors}`);
  console.log(`[WPN-FRAME00-AUDIT] report=${OUT_PATH}`);
}

main();
