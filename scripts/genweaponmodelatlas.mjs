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
const AUDIT_ONLY = false; // true: run audit without rewriting atlas/meta outputs
const AUDIT_FILTER_ATLAS_KEYS = []; // [] = audit all
const MAX_ATLAS_SIZE = 4096; // cap packed atlases; split into parts if exceeded
const CONSOLIDATE_SINGLE_VARIANTS = true;
const CONSOLIDATED_ATLAS_PREFIX = "tall__consolidated";
const EXCLUDE_MODELS = new Set(["cane_female", "wand_female", "wand_male"]);
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

function normalizeAnimForConsolidation(anim) {
  let a = String(anim || "");
  if (a.startsWith("universal_")) a = a.replace(/^universal_/, "");
  if (a.startsWith("attack_")) a = a.replace(/^attack_/, "");
  return a;
}

function readPngDimsCached(meta) {
  if (meta && meta._dims) return meta._dims;
  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(meta.file));
  } catch {
    return null;
  }
  if (!png || !png.width || !png.height) return null;
  const cols = Math.floor((png.width | 0) / (meta.tile | 0));
  const rows = Math.floor((png.height | 0) / (meta.tile | 0));
  const total = Math.max(0, (cols * rows) | 0);
  const dims = { w: png.width | 0, h: png.height | 0, cols, rows, total };
  meta._dims = dims;
  return dims;
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

function _boxSort(a, b) {
  const dh = (b.h | 0) - (a.h | 0);
  if (dh) return dh;
  const dw = (b.w | 0) - (a.w | 0);
  if (dw) return dw;
  return String(a.key || "").localeCompare(String(b.key || ""));
}

function _placeBoxInSpaces(box, spaces) {
  for (let i = 0; i < spaces.length; i++) {
    const s = spaces[i];
    if (box.w > s.w || box.h > s.h) continue;
    box.x = s.x | 0;
    box.y = s.y | 0;
    if (box.w === s.w && box.h === s.h) {
      spaces.splice(i, 1);
    } else if (box.h === s.h) {
      s.x = (s.x + box.w) | 0;
      s.w = (s.w - box.w) | 0;
    } else if (box.w === s.w) {
      s.y = (s.y + box.h) | 0;
      s.h = (s.h - box.h) | 0;
    } else {
      spaces.push({
        x: (s.x + box.w) | 0,
        y: s.y | 0,
        w: (s.w - box.w) | 0,
        h: box.h | 0
      });
      s.y = (s.y + box.h) | 0;
      s.h = (s.h - box.h) | 0;
    }
    return true;
  }
  return false;
}

// Pair fg+bg by variant, then pack vertically up to maxSize height.
// When height would overflow, start a new fg/bg column pair to the right.
// When width would overflow, start a new atlas part.
function packIntoBins(images, maxSize) {
  const byVariant = new Map();
  const isDupKey = (key) => /__dup\d+$/i.test(String(key || ""));
  for (const { meta, png } of images) {
    const vKey = String(meta.variant || "base");
    // Variant alone is not unique during consolidation; key by model+variant.
    const mvKey = `${meta.category}__${meta.model}__${vKey}`;
    let pair = byVariant.get(mvKey);
    if (!pair) {
      pair = { variant: vKey, fg: null, bg: null };
      byVariant.set(mvKey, pair);
    }
    const box = {
      key: meta.key,
      meta,
      png,
      w: png.width | 0,
      h: png.height | 0,
      x: 0,
      y: 0
    };
    if (meta.layer === "fg") {
      if (!pair.fg) pair.fg = box;
      else if (isDupKey(pair.fg.key) && !isDupKey(box.key)) pair.fg = box;
    } else {
      if (!pair.bg) pair.bg = box;
      else if (isDupKey(pair.bg.key) && !isDupKey(box.key)) pair.bg = box;
    }
  }

  const pairs = Array.from(byVariant.values()).map((pair) => {
    const fgW = pair.fg ? (pair.fg.w | 0) : 0;
    const fgH = pair.fg ? (pair.fg.h | 0) : 0;
    const bgW = pair.bg ? (pair.bg.w | 0) : 0;
    const bgH = pair.bg ? (pair.bg.h | 0) : 0;
    const w = (fgW + bgW) | 0;
    const h = Math.max(fgH, bgH) | 0;
    return { ...pair, w, h, key: pair.variant };
  }).sort(_boxSort);

  const bins = [];
  const newBin = () => ({
    boxes: [],
    w: 0,
    h: 0,
    fill: 0,
    colX: 0,
    colY: 0,
    colW: 0
  });

  let bin = newBin();
  bins.push(bin);

  const placePair = (p) => {
    const pairW = p.w | 0;
    const pairH = p.h | 0;
    if (pairW <= 0 || pairH <= 0) return;

    // Roll to next column pair if height would overflow.
    if (bin.colY > 0 && (bin.colY + pairH) > maxSize) {
      bin.colX = (bin.colX + bin.colW) | 0;
      bin.colY = 0;
      bin.colW = 0;
    }

    // Start a new atlas part if width would overflow.
    if ((bin.colX + pairW) > maxSize && bin.boxes.length > 0) {
      bin = newBin();
      bins.push(bin);
    }

    const fgW = p.fg ? (p.fg.w | 0) : 0;
    const baseX = bin.colX | 0;
    const baseY = bin.colY | 0;

    if (p.fg) {
      p.fg.x = baseX;
      p.fg.y = baseY;
      bin.boxes.push(p.fg);
    }
    if (p.bg) {
      p.bg.x = (baseX + fgW) | 0;
      p.bg.y = baseY;
      bin.boxes.push(p.bg);
    }

    bin.colY = (bin.colY + pairH) | 0;
    if (pairW > bin.colW) bin.colW = pairW;

    const usedW = (bin.colX + bin.colW) | 0;
    const usedH = bin.colY | 0;
    if (usedW > bin.w) bin.w = usedW;
    if (usedH > bin.h) bin.h = usedH;
  };

  for (const p of pairs) {
    if ((p.w | 0) > maxSize || (p.h | 0) > maxSize) {
      const oversize = newBin();
      const fgW = p.fg ? (p.fg.w | 0) : 0;
      if (p.fg) {
        p.fg.x = 0;
        p.fg.y = 0;
        oversize.boxes.push(p.fg);
      }
      if (p.bg) {
        p.bg.x = fgW;
        p.bg.y = 0;
        oversize.boxes.push(p.bg);
      }
      oversize.w = p.w | 0;
      oversize.h = p.h | 0;
      oversize.fill = 1;
      bins.push(oversize);
      bin = newBin();
      bins.push(bin);
      continue;
    }
    placePair(p);
  }

  for (const b of bins) {
    if (!b.boxes.length) continue;
    const area = b.boxes.reduce((sum, box) => sum + (box.w | 0) * (box.h | 0), 0);
    const denom = Math.max(1, (b.w | 0) * (b.h | 0));
    b.fill = area / denom;
  }

  return bins.filter((b) => b.boxes.length > 0);
}

ensureDir(OUT_DIR);
ensureDir(path.dirname(OUT_TS));
if (RUN_AUDIT) ensureDir(AUDIT_DIR);

const files = [];
listPngs(WEAPONS_DIR, files);

const entries = [];
for (const file of files) {
  const base = basenameNoExt(file);
  const meta = parseWeaponFilename(base);
  if (!meta) continue;
  if (EXCLUDE_MODELS.has(meta.model)) continue;
  entries.push({ ...meta, file });
}

// Second pass: if a BG sheet is tagged "universal_*" but the FG sheet exists
// for the base anim, fold the BG into the base anim group so they combine.
const entryKey = (meta, animOverride, layerOverride) =>
  `${meta.tile}__${meta.category}__${meta.model}__${meta.variant}__${layerOverride || meta.layer}__${animOverride || meta.anim}`;
const entryKeySet = new Set(entries.map((e) => entryKey(e)));
const universalBgRemaps = [];

for (const meta of entries) {
  if (meta.layer !== "bg") continue;
  const anim = String(meta.anim || "");
  if (!anim.startsWith("universal_")) continue;
  const baseAnim = anim.replace(/^universal_/, "");
  if (!baseAnim || baseAnim === anim) continue;
  const fgKey = entryKey(meta, baseAnim, "fg");
  if (!entryKeySet.has(fgKey)) continue;
  universalBgRemaps.push({ key: meta.key, from: meta.anim, to: baseAnim });
  meta.anim = baseAnim;
}

// Drop *_off model atlases when the base model atlas exists.
const baseAnimSet = new Set();
for (const meta of entries) {
  const model = String(meta.model || "");
  if (model.toLowerCase().endsWith("_off")) continue;
  const tileTag = meta.tile === 64 ? "t064" : meta.tile === 128 ? "t128" : "t192";
  baseAnimSet.add(`${tileTag}__${meta.category}__${meta.model}__${meta.anim}`);
}
const filteredEntries = entries.filter((meta) => {
  const model = String(meta.model || "");
  if (!model.toLowerCase().endsWith("_off")) return true;
  const baseModel = model.slice(0, -4);
  const tileTag = meta.tile === 64 ? "t064" : meta.tile === 128 ? "t128" : "t192";
  const baseKey = `${tileTag}__${meta.category}__${baseModel}__${meta.anim}`;
  return !baseAnimSet.has(baseKey);
});

// Single-variant detection (per model)
const variantsByModel = new Map();
for (const meta of filteredEntries) {
  const modelKey = `${meta.tile}__${meta.category}__${meta.model}`;
  let set = variantsByModel.get(modelKey);
  if (!set) variantsByModel.set(modelKey, (set = new Set()));
  set.add(meta.variant);
}
const singleVariantModels = new Set();
for (const [key, set] of variantsByModel.entries()) {
  if (set.size === 1) singleVariantModels.add(key);
}

const groups = new Map();
for (const meta of filteredEntries) {
  const tileTag = meta.tile === 64 ? "t064" : meta.tile === 128 ? "t128" : "t192";
  const modelKey = `${meta.tile}__${meta.category}__${meta.model}`;
  let atlasKey = `${tileTag}__${meta.category}__${meta.model}__${meta.anim}`;
  if (CONSOLIDATE_SINGLE_VARIANTS && singleVariantModels.has(modelKey)) {
    const dims = readPngDimsCached(meta);
    const animNorm = normalizeAnimForConsolidation(meta.anim);
    if (dims && animNorm) {
      atlasKey = `${CONSOLIDATED_ATLAS_PREFIX}__${animNorm}__${dims.cols}x${dims.rows}`;
    }
  }
  const list = groups.get(atlasKey) || [];
  list.push(meta);
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
  atlasMeta: {},
  pixelMismatches: [],
  variantDimMismatches: [],
  notDivisible: [],
  outOfBounds: [],
  universalBgRemaps
};
const variantDimKey = (meta) =>
  `${meta.tile}__${meta.category}__${meta.model}__${meta.anim}__${meta.layer}`;
const variantDims = new Map();

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
  const bins = packIntoBins(images, MAX_ATLAS_SIZE);

  for (let bi = 0; bi < bins.length; bi++) {
    const bin = bins[bi];
    const partKey = (bins.length > 1) ? `${atlasKey}__p${bi + 1}` : atlasKey;
    const atlasW = Math.max(1, bin.w | 0);
    const atlasH = Math.max(1, bin.h | 0);
    const atlasPng = new PNG({ width: atlasW, height: atlasH });
    atlasPng.data.fill(0);

    const frames = {};
    for (const b of bin.boxes) {
      const { meta, png, x, y } = b;
      copyPngIntoAtlas(png, atlasPng, x, y);
      frames[meta.key] = {
        frame: { x: x | 0, y: y | 0, w: png.width | 0, h: png.height | 0 },
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
          atlasKey: partKey,
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
        atlasKey: partKey,
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
      const outPath = path.join(OUT_DIR, `${partKey}.png`);
      fs.writeFileSync(outPath, PNG.sync.write(atlasPng));
    }

    if (!AUDIT_ONLY) {
      atlasData[partKey] = {
        frames,
        meta: {
          app: "heroengine-weapon-atlas",
          image: `${partKey}.png`,
          size: { w: atlasW | 0, h: atlasH | 0 },
          scale: "1"
        }
      };
    }

    if (RUN_AUDIT) {
      audit.atlasMeta[partKey] = {
        size: { w: atlasW | 0, h: atlasH | 0 },
        images: bin.boxes.length | 0,
        fill: bin.fill || 0
      };
      for (const b of bin.boxes) {
        const { meta, png, x, y } = b;
        const w = png.width | 0;
        const h = png.height | 0;
        if (x + w > atlasPng.width || y + h > atlasPng.height) {
          audit.outOfBounds.push({
            key: meta.key,
            atlasKey: partKey,
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
            atlasKey: partKey,
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
