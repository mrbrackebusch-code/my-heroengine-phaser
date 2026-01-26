#!/usr/bin/env node
/**
 * Audit thrust weapon frames for "gap-free" silhouettes by compositing BG+FG.
 * Outputs a JSON report + a human-readable TXT summary in tmp/.
 *
 * Usage:
 *   node scripts/auditweaponthrustframes.mjs
 *   node scripts/auditweaponthrustframes.mjs --anim thrust
 *   node scripts/auditweaponthrustframes.mjs --filter "spear" --anim thrust
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const OUT_DIR = path.join(ROOT, "tmp");
const OUT_JSON = path.join(OUT_DIR, "weaponThrustGoodFrames.json");
const OUT_TXT = path.join(OUT_DIR, "weaponThrustGoodFrames.txt");

const TILE_RE = /^t(064|128|192)$/i;

const args = process.argv.slice(2);
let filterRe = null;
let animFilter = "thrust";
let limit = Infinity;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--filter" && args[i + 1]) {
    filterRe = new RegExp(args[i + 1], "i");
    i++;
    continue;
  }
  if (a === "--anim" && args[i + 1]) {
    animFilter = String(args[i + 1] || "").toLowerCase();
    i++;
    continue;
  }
  if (a === "--limit" && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (Number.isFinite(n) && n > 0) limit = n | 0;
    i++;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
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

function basenameNoExt(p) {
  const file = p.split(/[\\/]/).pop() || p;
  return file.replace(/\.png$/i, "");
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

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function getFrameRect(frameIndex, cols, rows, tile) {
  const safeCols = Math.max(1, cols | 0);
  const safeRows = Math.max(1, rows | 0);
  const idx = Math.max(0, Math.min(frameIndex | 0, safeCols * safeRows - 1));
  const col = idx % safeCols;
  const row = Math.floor(idx / safeCols);
  return {
    x: col * tile,
    y: row * tile,
    w: tile,
    h: tile
  };
}

function buildMask(bg, fg, rect) {
  const w = rect.w | 0;
  const h = rect.h | 0;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const by = rect.y + y;
    for (let x = 0; x < w; x++) {
      const bx = rect.x + x;
      const bi = ((by * bg.width + bx) << 2) + 3;
      const fi = ((by * fg.width + bx) << 2) + 3;
      const a = (bg.data[bi] | 0) + (fg.data[fi] | 0);
      if (a > 0) mask[y * w + x] = 1;
    }
  }
  return { mask, w, h };
}

function analyzeMask(mask, w, h) {
  let filled = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        filled++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!filled) {
    return { filled: 0, components: 0, holes: 0, bbox: null };
  }

  const visited = new Uint8Array(w * h);
  const dirs = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];

  let components = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx] || visited[idx]) continue;
      components++;
      const stack = [idx];
      visited[idx] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cy = Math.floor(cur / w);
        const cx = cur - cy * w;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }

  // Hole detection: flood-fill empty space from bbox border, remaining empty = holes.
  let holes = 0;
  const bbox = { minX, minY, maxX, maxY };
  const bw = bbox.maxX - bbox.minX + 1;
  const bh = bbox.maxY - bbox.minY + 1;
  const emptyVisited = new Uint8Array(bw * bh);
  const q = [];
  const pushEmpty = (x, y) => {
    const idx = y * bw + x;
    if (emptyVisited[idx]) return;
    emptyVisited[idx] = 1;
    q.push(idx);
  };

  // Seed from border empties.
  for (let x = 0; x < bw; x++) {
    const top = bbox.minY;
    const bot = bbox.maxY;
    if (!mask[(top * w) + (bbox.minX + x)]) pushEmpty(x, 0);
    if (!mask[(bot * w) + (bbox.minX + x)]) pushEmpty(x, bh - 1);
  }
  for (let y = 0; y < bh; y++) {
    const left = bbox.minX;
    const right = bbox.maxX;
    if (!mask[((bbox.minY + y) * w) + left]) pushEmpty(0, y);
    if (!mask[((bbox.minY + y) * w) + right]) pushEmpty(bw - 1, y);
  }

  while (q.length) {
    const idx = q.pop();
    const y = Math.floor(idx / bw);
    const x = idx - y * bw;
    const absX = bbox.minX + x;
    const absY = bbox.minY + y;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
      const ax = bbox.minX + nx;
      const ay = bbox.minY + ny;
      if (mask[ay * w + ax]) continue;
      const ni = ny * bw + nx;
      if (emptyVisited[ni]) continue;
      emptyVisited[ni] = 1;
      q.push(ni);
    }
  }

  // Any empty not reached from border inside bbox is a hole.
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const ax = bbox.minX + x;
      const ay = bbox.minY + y;
      if (mask[ay * w + ax]) continue;
      const idx = y * bw + x;
      if (!emptyVisited[idx]) {
        holes++;
        // mark as visited to avoid double count
        emptyVisited[idx] = 1;
      }
    }
  }

  return { filled, components, holes, bbox };
}

function main() {
  ensureDir(OUT_DIR);

  const originals = [];
  listOriginalPngs(WEAPONS_DIR, originals);

  const groups = new Map();
  for (const file of originals) {
    const base = basenameNoExt(file);
    if (filterRe && !filterRe.test(base)) continue;
    const parsed = parseWeaponFilename(base);
    if (!parsed) continue;
    const animLower = String(parsed.anim || "").toLowerCase();
    if (!animLower.includes(animFilter)) continue;

    const key = `${parsed.model}__${parsed.anim}__${parsed.variant}__t${parsed.tile}`;
    const entry = groups.get(key) || {
      model: parsed.model,
      anim: parsed.anim,
      variant: parsed.variant,
      tile: parsed.tile,
      bgPath: "",
      fgPath: ""
    };
    if (parsed.layer === "bg") entry.bgPath = file;
    if (parsed.layer === "fg") entry.fgPath = file;
    groups.set(key, entry);
  }

  const report = {
    animFilter,
    totalGroups: groups.size,
    analyzed: 0,
    results: []
  };

  const txtLines = [];
  let processed = 0;
  for (const entry of groups.values()) {
    if (processed >= limit) break;
    if (!entry.bgPath || !entry.fgPath) continue;
    processed++;

    const bg = readPng(entry.bgPath);
    const fg = readPng(entry.fgPath);
    const tile = entry.tile | 0;
    const cols = Math.floor(bg.width / tile);
    const rows = Math.floor(bg.height / tile);
    const total = cols * rows;
    const frames = [];
    const goodNoHoles = [];
    const goodSingleComponent = [];

    for (let i = 0; i < total; i++) {
      const rect = getFrameRect(i, cols, rows, tile);
      const { mask, w, h } = buildMask(bg, fg, rect);
      const info = analyzeMask(mask, w, h);
      const frameInfo = {
        frame: i,
        filled: info.filled,
        components: info.components,
        holes: info.holes
      };
      frames.push(frameInfo);
      if (info.components === 1) goodSingleComponent.push(i);
      if (info.components === 1 && info.holes === 0) goodNoHoles.push(i);
    }

    report.analyzed++;
    report.results.push({
      model: entry.model,
      anim: entry.anim,
      variant: entry.variant,
      tile,
      cols,
      rows,
      totalFrames: total,
      goodSingleComponent,
      goodNoHoles,
      frames
    });

    const label = `${entry.model} | ${entry.anim} | v${entry.variant} | t${tile}`;
    txtLines.push(label);
    txtLines.push(`  goodSingleComponent: ${goodSingleComponent.join(", ") || "none"}`);
    txtLines.push(`  goodNoHoles: ${goodNoHoles.join(", ") || "none"}`);
    txtLines.push("");
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(OUT_TXT, txtLines.join("\n"));
  console.log("Wrote:", OUT_JSON);
  console.log("Wrote:", OUT_TXT);
}

main();
