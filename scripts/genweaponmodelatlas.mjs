#!/usr/bin/env node
/**
 * Build per-weapon-model+anim atlases (variants + bg/fg packed together).
 *
 * Output:
 *  - assets/weapons/_atlas/<tile>__<category>__<model>__<anim>.png
 *  - src/generated/weaponAtlasMeta.ts
 *
 * Run:
 *  - node scripts/genweaponmodelatlas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const OUT_DIR = path.join(WEAPONS_DIR, "_atlas");
const OUT_TS = path.join(ROOT, "src", "generated", "weaponAtlasMeta.ts");
const RUN_AUDIT = true;
const AUDIT_ONLY = true; // true: run audit without rewriting atlas/meta outputs
const AUDIT_FILTER_ATLAS_KEYS = ["t128__sword__arming__attack_slash"]; // [] = audit all
const AUDIT_LOG_EVERY = 10;
const AUDIT_DIR = path.join(ROOT, "tmp");
const AUDIT_OUT = path.join(AUDIT_DIR, "weaponAtlasAudit.json");

const TILE_RE = /^t(064|128|192)$/i;

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

function sortEntries(a, b) {
  if (a.variant !== b.variant) return a.variant.localeCompare(b.variant);
  if (a.layer !== b.layer) return a.layer.localeCompare(b.layer);
  return a.key.localeCompare(b.key);
}

function copyPngIntoAtlas(src, atlas, dstX, dstY) {
  const w = src.width | 0;
  const h = src.height | 0;
  for (let y = 0; y < h; y++) {
    const srcRow = (y * w) << 2;
    const dstRow = ((dstY + y) * atlas.width + dstX) << 2;
    for (let x = 0; x < w; x++) {
      const si = srcRow + (x << 2);
      const di = dstRow + (x << 2);
      atlas.data[di] = src.data[si];
      atlas.data[di + 1] = src.data[si + 1];
      atlas.data[di + 2] = src.data[si + 2];
      atlas.data[di + 3] = src.data[si + 3];
    }
  }
}

ensureDir(OUT_DIR);
ensureDir(path.dirname(OUT_TS));
if (RUN_AUDIT) ensureDir(AUDIT_DIR);

const files = [];
listPngs(WEAPONS_DIR, files);

const groups = new Map();
for (const file of files) {
  const base = basenameNoExt(file);
  const meta = parseWeaponFilename(base);
  if (!meta) continue;
  const atlasKey = `${meta.tile === 64 ? "t064" : meta.tile === 128 ? "t128" : "t192"}__${meta.category}__${meta.model}__${meta.anim}`;
  const list = groups.get(atlasKey) || [];
  list.push({ ...meta, file });
  groups.set(atlasKey, list);
}

const atlasData = {};
const sheetMeta = [];
const warnings = [];
const audit = {
  run: {
    startedAt: new Date().toISOString(),
    groups: 0,
    sheets: 0
  },
  pixelMismatches: [],
  variantDimMismatches: [],
  notDivisible: [],
  outOfBounds: []
};
const variantDimKey = (meta) =>
  `${meta.tile}__${meta.category}__${meta.model}__${meta.anim}__${meta.layer}`;
const variantDims = new Map();

// Drop *_off model atlases when the base model atlas exists.
const atlasKeys = new Set(groups.keys());
for (const [atlasKey, entries] of Array.from(groups.entries())) {
  const sample = entries[0];
  if (!sample || !sample.model || !sample.model.toLowerCase().endsWith("_off")) continue;
  const baseModel = sample.model.slice(0, -4);
  const tileTag = sample.tile === 64 ? "t064" : sample.tile === 128 ? "t128" : "t192";
  const baseKey = `${tileTag}__${sample.category}__${baseModel}__${sample.anim}`;
  if (atlasKeys.has(baseKey)) {
    groups.delete(atlasKey);
  }
}

let groupIndex = 0;
const groupKeys = Array.from(groups.keys());
const auditFilter = new Set(AUDIT_FILTER_ATLAS_KEYS.map(String));
for (const [atlasKey, entriesRaw] of groups.entries()) {
  groupIndex++;
  if (RUN_AUDIT && auditFilter.size > 0 && !auditFilter.has(atlasKey)) {
    continue;
  }
  if (RUN_AUDIT && (groupIndex % AUDIT_LOG_EVERY) === 0) {
    console.log(`[weapon-atlas][audit] group=${groupIndex}/${groupKeys.length} key=${atlasKey}`);
  }
  const entries = entriesRaw.slice().sort(sortEntries);
  const images = [];
  let maxW = 0;
  let maxH = 0;
  for (const e of entries) {
    let png;
    try {
      png = PNG.sync.read(fs.readFileSync(e.file));
    } catch (err) {
      warnings.push(`[weapon-atlas] unreadable ${e.key}: ${String(err && err.message ? err.message : err)}`);
      continue;
    }
    if (!png || !png.width || !png.height) continue;
    images.push({ meta: e, png });
    if (png.width > maxW) maxW = png.width;
    if (png.height > maxH) maxH = png.height;
  }
  if (!images.length) continue;
  const count = images.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const atlasW = cols * maxW;
  const atlasH = rows * maxH;
  const atlasPng = new PNG({ width: atlasW, height: atlasH });
  atlasPng.data.fill(0);

  const frames = {};
  for (let i = 0; i < images.length; i++) {
    const { meta, png } = images[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * maxW;
    const y = row * maxH;
    copyPngIntoAtlas(png, atlasPng, x, y);
    frames[meta.key] = {
      frame: { x, y, w: png.width | 0, h: png.height | 0 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: png.width | 0, h: png.height | 0 },
      sourceSize: { w: png.width | 0, h: png.height | 0 }
    };
    const colsCount = Math.floor((png.width | 0) / (meta.tile | 0));
    const rowsCount = Math.floor((png.height | 0) / (meta.tile | 0));
    const totalFrames = Math.max(0, (colsCount * rowsCount) | 0);
    const divOk = ((png.width % meta.tile) === 0) && ((png.height % meta.tile) === 0);
    if (!divOk) {
      audit.notDivisible.push({
        key: meta.key,
        atlasKey,
        tile: meta.tile,
        width: png.width | 0,
        height: png.height | 0
      });
    }
    const dimKey = variantDimKey(meta);
    const dimVal = { w: png.width | 0, h: png.height | 0, cols: colsCount | 0, rows: rowsCount | 0 };
    const prior = variantDims.get(dimKey);
    if (!prior) {
      variantDims.set(dimKey, dimVal);
    } else if (
      prior.w !== dimVal.w ||
      prior.h !== dimVal.h ||
      prior.cols !== dimVal.cols ||
      prior.rows !== dimVal.rows
    ) {
      audit.variantDimMismatches.push({
        key: meta.key,
        dimKey,
        expected: prior,
        actual: dimVal
      });
    }
    sheetMeta.push({
      key: meta.key,
      atlasKey,
      tile: meta.tile,
      category: meta.category,
      model: meta.model,
      anim: meta.anim,
      layer: meta.layer,
      variant: meta.variant,
      frameW: meta.tile,
      frameH: meta.tile,
      totalFrames,
      cols: colsCount | 0,
      rows: rowsCount | 0
    });
    if ((png.width % meta.tile) !== 0 || (png.height % meta.tile) !== 0) {
      warnings.push(`[weapon-atlas] not divisible: ${meta.key} size=${png.width}x${png.height} frame=${meta.tile}x${meta.tile}`);
    }
  }

  if (!AUDIT_ONLY) {
    const outPath = path.join(OUT_DIR, `${atlasKey}.png`);
    fs.writeFileSync(outPath, PNG.sync.write(atlasPng));
  }

  if (!AUDIT_ONLY) {
    atlasData[atlasKey] = {
      frames,
      meta: {
        app: "heroengine-weapon-atlas",
        image: `${atlasKey}.png`,
        size: { w: atlasW | 0, h: atlasH | 0 },
        scale: "1"
      }
    };
  }

  if (RUN_AUDIT) {
    for (let i = 0; i < images.length; i++) {
      const { meta, png } = images[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * maxW;
      const y = row * maxH;
      const w = png.width | 0;
      const h = png.height | 0;
      if (x + w > atlasPng.width || y + h > atlasPng.height) {
        audit.outOfBounds.push({
          key: meta.key,
          atlasKey,
          x,
          y,
          w,
          h,
          atlasW: atlasPng.width | 0,
          atlasH: atlasPng.height | 0
        });
        continue;
      }
      let mismatch = 0;
      let first = null;
      for (let yy = 0; yy < h; yy++) {
        const srcRow = (yy * w) << 2;
        const dstRow = ((y + yy) * atlasPng.width + x) << 2;
        for (let xx = 0; xx < w; xx++) {
          const si = srcRow + (xx << 2);
          const di = dstRow + (xx << 2);
          if (
            png.data[si] !== atlasPng.data[di] ||
            png.data[si + 1] !== atlasPng.data[di + 1] ||
            png.data[si + 2] !== atlasPng.data[di + 2] ||
            png.data[si + 3] !== atlasPng.data[di + 3]
          ) {
            mismatch++;
            if (!first) first = { x: xx, y: yy };
          }
        }
      }
      if (mismatch > 0) {
        audit.pixelMismatches.push({
          key: meta.key,
          atlasKey,
          variant: meta.variant,
          layer: meta.layer,
          x,
          y,
          w,
          h,
          mismatch,
          first
        });
      }
    }
  }
}

if (!AUDIT_ONLY) {
  sheetMeta.sort((a, b) => a.key.localeCompare(b.key));

  const outTs = `// AUTO-GENERATED by scripts/genweaponmodelatlas.mjs
// Do not edit manually.
export const WEAPON_ATLAS_SHEETS = ${JSON.stringify(sheetMeta, null, 2)};
export const WEAPON_ATLAS_DATA = ${JSON.stringify(atlasData, null, 2)};
`;

  fs.writeFileSync(OUT_TS, outTs);

  // Remove stale atlas PNGs not in the new build.
  const keepFiles = new Set(Object.keys(atlasData).map((k) => `${k}.png`));
  if (fs.existsSync(OUT_DIR)) {
    const existing = fs.readdirSync(OUT_DIR).filter((f) => f.toLowerCase().endsWith(".png"));
    for (const file of existing) {
      if (!keepFiles.has(file)) {
        fs.unlinkSync(path.join(OUT_DIR, file));
      }
    }
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(w);
}
console.log(`[weapon-atlas] groups=${groups.size} sheets=${sheetMeta.length} out=${OUT_DIR}`);
if (RUN_AUDIT) {
  audit.run.groups = (auditFilter.size > 0) ? auditFilter.size : groups.size;
  audit.run.sheets = sheetMeta.length;
  fs.writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2));
  console.log("[weapon-atlas][audit]", {
    out: AUDIT_OUT,
    pixelMismatches: audit.pixelMismatches.length,
    variantDimMismatches: audit.variantDimMismatches.length,
    notDivisible: audit.notDivisible.length,
    outOfBounds: audit.outOfBounds.length
  });
}
