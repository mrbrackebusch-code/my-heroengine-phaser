#!/usr/bin/env node
/**
 * Build a master weapon atlas (tip up, vertically aligned) from the packed _atlas sheets.
 *
 * Output:
 *  - assets/weapons/_master/weapon_master <WxH>.png
 *  - src/generated/weaponMasterMeta.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const ATLAS_DIR = path.join(WEAPONS_DIR, "_atlas");
const OUT_DIR = path.join(WEAPONS_DIR, "_master");
const OUT_META = path.join(ROOT, "src", "generated", "weaponMasterMeta.ts");
const META_PATH = path.join(ROOT, "src", "generated", "weaponAtlasMeta.ts");

const PAD = 2;
const DIR_ORDER = ["up", "left", "down", "right"]; // keep in sync with weaponAnimGlue.ts

const ANIM_PREFS = {
  arming: { animIncludes: "attack_slash" },
  bow_normal: { animExact: "universal_shoot" },
  bow_recurve: { animExact: "universal_shoot" },
  bow_great: { animExact: "universal_shoot" }
};

const FRAME_OVERRIDES = {
  arming: { row: 2, col: 2 },      // handled by composite logic below
  boomerang: { row: 2, col: 0 },   // down row, frame 0
  flail: { row: 2, col: 2 },       // down row, frame 2
  bow_arrow: { row: 1, col: 2, rotCwDeg: 90 },
  bow_normal: { row: 1, col: 4 },
  bow_recurve: { row: 1, col: 4 },
  bow_great: { row: 1, col: 4 },
  crossbow: { row: 1, col: 3, rotCwDeg: 90 },
  scythe: { row: 1, col: 0, skipAutoRotate: true },
  halberd: { row: 1, col: 0, rotCwDeg: 45 },
  rod: { row: 1, col: 1, rotCwDeg: -45 },
  trident: { row: 0, col: 7, skipAutoRotate: true },
  whip: { row: 2, col: 4 },
  smash: {
    variants: {
      pickaxe: { row: 2, col: 3 }  // down row, frame 3
    }
  },
  x: {
    variants: {
      shovel: {},
      watering: {}
    }
  }
};

// Final per-frame vertical flips (applied AFTER rotation + gap-fill, BEFORE packing).
// Populate this list once the flip logic is verified.
const FINAL_FRAME_FLIPS = [
  { weaponId: "bow_arrow" },
  { weaponId: "crossbow" },
  { weaponId: "dragonspear" },
  { weaponId: "flail" },
  { weaponId: "halberd" },
  { weaponId: "longspear" },
  { weaponId: "scythe" },
  { weaponId: "spear" },
  { weaponId: "trident" },
  { weaponId: "waraxe" },
  { weaponId: "x", variant: "hoe" },
  { weaponId: "x", variant: "shovel" },
  { weaponId: "x", variant: "watering" }
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
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

function isDupKey(key) {
  return /__dup\\d+$/i.test(String(key || ""));
}

function dirIndex(dir) {
  const i = DIR_ORDER.indexOf(String(dir || "").toLowerCase());
  return i >= 0 ? i : 0;
}

function animScore(anim) {
  const a = String(anim || "").toLowerCase();
  if (a.includes("walk")) return -1000000;
  if (a.includes("hurt")) return -1000000;
  let score = 0;
  if (a.includes("attack_slash") || a.includes("slash")) score += 50;
  if (a.includes("attack_thrust") || a.includes("thrust")) score += 40;
  if (a.includes("shoot")) score += 30;
  if (a.includes("cast") || a.includes("spell")) score += 20;
  if (a.includes("idle")) score += 5;
  if (a.includes("universal")) score += 2;
  return score;
}

function isBadAnim(anim) {
  const a = String(anim || "").toLowerCase();
  return a.includes("walk") || a.includes("hurt");
}

function animScoreForModel(model, anim) {
  let score = animScore(anim);
  const pref = ANIM_PREFS[model];
  if (pref) {
    const a = String(anim || "");
    if (pref.animExact && a === pref.animExact) score += 200;
    if (pref.animIncludes && a.includes(pref.animIncludes)) score += 100;
  }
  return score;
}

function pickAnimEntry(model, entries) {
  const pref = ANIM_PREFS[model];
  if (pref) {
    const hit = entries.find((e) => {
      const anim = String(e.anim || "");
      if (pref.animExact && anim === pref.animExact) return true;
      if (pref.animIncludes && anim.includes(pref.animIncludes)) return true;
      return false;
    });
    if (hit) return hit;
  }
  let best = null;
  let bestScore = -9999;
  for (const e of entries) {
    const s = animScore(e.anim);
    if (s > bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return best;
}

function pickFrameRowCol(model, variant, anim, cols, rows) {
  const base = FRAME_OVERRIDES[model];
  if (base) {
    const v = String(variant || "").toLowerCase();
    if (base.variants && base.variants[v]) {
      const ov = base.variants[v];
      return { row: ov.row | 0, col: ov.col | 0 };
    }
    if (typeof base.row === "number" && typeof base.col === "number") {
      return { row: base.row | 0, col: base.col | 0 };
    }
  }

  let row = 0;
  if ((rows | 0) >= 4) row = dirIndex("down");
  let col = 0;
  const a = String(anim || "").toLowerCase();
  if (a.includes("slash") || a.includes("attack")) col = 2;
  else if (a.includes("thrust")) col = 1;
  else if (a.includes("shoot")) col = (cols >= 5 ? 4 : Math.floor(cols / 2));
  else if (a.includes("walk")) col = (cols >= 3 ? 2 : Math.max(0, cols - 1));
  col = Math.max(0, Math.min((cols | 0) - 1, col));
  row = Math.max(0, Math.min((rows | 0) - 1, row));
  return { row, col };
}

function preferredCol(anim, cols) {
  let col = 0;
  const a = String(anim || "").toLowerCase();
  if (a.includes("slash") || a.includes("attack")) col = 2;
  else if (a.includes("thrust")) col = 1;
  else if (a.includes("shoot")) col = (cols >= 5 ? 4 : Math.floor(cols / 2));
  else if (a.includes("walk")) col = (cols >= 3 ? 2 : Math.max(0, cols - 1));
  col = Math.max(0, Math.min((cols | 0) - 1, col));
  return col;
}

function getFrameOverride(model, variant) {
  const base = FRAME_OVERRIDES[model];
  if (!base) return null;
  const v = String(variant || "").toLowerCase();
  if (base.variants && base.variants[v]) {
    const ov = base.variants[v];
    return {
      row: (typeof ov.row === "number") ? (ov.row | 0) : null,
      col: (typeof ov.col === "number") ? (ov.col | 0) : null,
      rotCwDeg: Number.isFinite(ov.rotCwDeg) ? ov.rotCwDeg : null,
      skipAutoRotate: !!ov.skipAutoRotate,
      hasFrame: (typeof ov.row === "number") && (typeof ov.col === "number")
    };
  }
  const hasFrame = (typeof base.row === "number") && (typeof base.col === "number");
  return {
    row: hasFrame ? (base.row | 0) : null,
    col: hasFrame ? (base.col | 0) : null,
    rotCwDeg: Number.isFinite(base.rotCwDeg) ? base.rotCwDeg : null,
    skipAutoRotate: !!base.skipAutoRotate,
    hasFrame
  };
}

function shouldFinalFlip(model, variant) {
  const m = String(model || "").toLowerCase();
  const v = String(variant || "").toLowerCase();
  for (const spec of FINAL_FRAME_FLIPS) {
    if (!spec || !spec.weaponId) continue;
    if (String(spec.weaponId).toLowerCase() !== m) continue;
    if (spec.variant != null && String(spec.variant).toLowerCase() !== v) continue;
    return true;
  }
  return false;
}

function alphaBlend(bg, fg) {
  const a1 = fg[3] / 255;
  const a0 = bg[3] / 255;
  const outA = a1 + a0 * (1 - a1);
  if (outA <= 0) return [0, 0, 0, 0];
  const r = (fg[0] * a1 + bg[0] * a0 * (1 - a1)) / outA;
  const g = (fg[1] * a1 + bg[1] * a0 * (1 - a1)) / outA;
  const b = (fg[2] * a1 + bg[2] * a0 * (1 - a1)) / outA;
  return [Math.round(r), Math.round(g), Math.round(b), Math.round(outA * 255)];
}

function computeAxis(pixels, cx, cy) {
  let xx = 0, xy = 0, yy = 0;
  const n = pixels.length || 1;
  for (const p of pixels) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  xx /= n; xy /= n; yy /= n;
  let vx = 1, vy = 0;
  if (Math.abs(xy) < 1e-6) {
    if (yy > xx) { vx = 0; vy = 1; }
  } else {
    const trace = xx + yy;
    const disc = Math.sqrt((xx - yy) * (xx - yy) + 4 * xy * xy);
    const lambda = (trace + disc) / 2;
    vx = lambda - yy;
    vy = xy;
  }
  const len = Math.hypot(vx, vy) || 1;
  return { vx: vx / len, vy: vy / len };
}

function extractFramePixels(params) {
  const {
    frameW, frameH,
    bgAtlasPng, fgAtlasPng,
    x0, y0, x1, y1
  } = params;
  const pixels = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      let bgPx = [0, 0, 0, 0];
      let fgPx = [0, 0, 0, 0];
      if (bgAtlasPng) {
        const bi = (((y0 + y) * bgAtlasPng.width + (x0 + x)) << 2);
        bgPx = [
          bgAtlasPng.data[bi],
          bgAtlasPng.data[bi + 1],
          bgAtlasPng.data[bi + 2],
          bgAtlasPng.data[bi + 3]
        ];
      }
      if (fgAtlasPng) {
        const fi = (((y1 + y) * fgAtlasPng.width + (x1 + x)) << 2);
        fgPx = [
          fgAtlasPng.data[fi],
          fgAtlasPng.data[fi + 1],
          fgAtlasPng.data[fi + 2],
          fgAtlasPng.data[fi + 3]
        ];
      }
      const out = alphaBlend(bgPx, fgPx);
      if (out[3] > 0) {
        pixels.push({ x, y, r: out[0], g: out[1], b: out[2], a: out[3] });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!pixels.length) return null;
  return { pixels, minX, minY, maxX, maxY };
}

function analyzePixels(pixels, bounds) {
  const { minX, minY, maxX, maxY } = bounds;
  const width = (maxX - minX + 1) | 0;
  const height = (maxY - minY + 1) | 0;
  const area = pixels.length | 0;
  const fillRatio = area / Math.max(1, width * height);
  let sx = 0, sy = 0;
  for (const p of pixels) { sx += p.x; sy += p.y; }
  const cx = sx / pixels.length;
  const cy = sy / pixels.length;
  const { vx, vy } = computeAxis(pixels, cx, cy);
  let minT = 1e9, maxT = -1e9;
  let meanDist = 0;
  for (const p of pixels) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const t = dx * vx + dy * vy;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
    const dist = Math.abs(dx * vy - dy * vx);
    meanDist += dist;
  }
  meanDist = meanDist / pixels.length;
  const length = Math.max(1, maxT - minT);
  const angleDeg = Math.abs(Math.atan2(vx, vy)) * (180 / Math.PI);
  const straightness = meanDist / length;
  return { width, height, area, fillRatio, cx, cy, vx, vy, length, angleDeg, straightness };
}

function scoreFrame(model, anim, metrics) {
  const base = animScoreForModel(model, anim);
  if (base < -100000) return -1e9;
  const aspect =
    Math.max(metrics.width, metrics.height) / Math.max(1, Math.min(metrics.width, metrics.height));
  const straightScore = 1 / (0.02 + metrics.straightness);
  const thinScore = 1 / (0.02 + metrics.fillRatio);
  return (
    (base * 500) +
    (metrics.length * 2) +
    (straightScore * 80) +
    (thinScore * 12) +
    (aspect * 10)
  );
}

function rotateAll(pixels, cx, cy, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const out = [];
  for (const p of pixels) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
    out.push({ x: rx, y: ry, r: p.r, g: p.g, b: p.b, a: p.a });
  }
  return { rotated: out, minX, maxX, minY, maxY };
}

function centerPoints(points) {
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  const cx = sx / points.length;
  const cy = sy / points.length;
  const out = points.map((p) => ({ ...p, x: p.x - cx, y: p.y - cy }));
  return { points: out, cx, cy };
}

function yBounds(points) {
  let minY = 1e9;
  let maxY = -1e9;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minY, maxY };
}

function measureBandWidth(points, minY, maxY) {
  let minX = 1e9, maxX = -1e9, count = 0;
  for (const p of points) {
    if (p.y < minY || p.y > maxY) continue;
    count++;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  if (!count) return { count: 0, width: 0 };
  return { count, width: maxX - minX };
}

function needsTipFlip(points, minY, maxY) {
  const band = Math.max(2, (maxY - minY) * 0.08);
  const top = measureBandWidth(points, minY, minY + band);
  const bottom = measureBandWidth(points, maxY - band, maxY);
  if (!top.count || !bottom.count) return false;
  return top.width > bottom.width * 1.15;
}

function blendPixel(data, idx, r, g, b, a) {
  const a1 = a / 255;
  const a0 = data[idx + 3] / 255;
  const outA = a1 + a0 * (1 - a1);
  if (outA <= 0) return;
  const rr = (r * a1 + data[idx] * a0 * (1 - a1)) / outA;
  const gg = (g * a1 + data[idx + 1] * a0 * (1 - a1)) / outA;
  const bb = (b * a1 + data[idx + 2] * a0 * (1 - a1)) / outA;
  data[idx] = Math.round(rr);
  data[idx + 1] = Math.round(gg);
  data[idx + 2] = Math.round(bb);
  data[idx + 3] = Math.round(outA * 255);
}

function rasterizePoints(points) {
  if (!points.length) return null;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const coords = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const ix = Math.round(p.x);
    const iy = Math.round(p.y);
    coords[i] = { ix, iy, p };
    if (ix < minX) minX = ix;
    if (ix > maxX) maxX = ix;
    if (iy < minY) minY = iy;
    if (iy > maxY) maxY = iy;
  }
  const w = Math.max(1, (maxX - minX + 1) | 0);
  const h = Math.max(1, (maxY - minY + 1) | 0);
  const data = new Uint8ClampedArray(w * h * 4);
  for (const c of coords) {
    const x = c.ix - minX;
    const y = c.iy - minY;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = ((y * w) + x) << 2;
    blendPixel(data, idx, c.p.r, c.p.g, c.p.b, c.p.a);
  }
  return { data, w, h, offsetX: minX, offsetY: minY };
}

function findComponents(data, w, h) {
  const visited = new Uint8Array(w * h);
  const comps = [];
  const stack = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      if (data[(idx << 2) + 3] === 0) continue;
      const comp = {
        minX: x, maxX: x, minY: y, maxY: y, count: 0,
        sumX: 0, sumY: 0,
        topEdge: new Int32Array(w).fill(-1),
        bottomEdge: new Int32Array(w).fill(-1)
      };
      visited[idx] = 1;
      stack.push(idx);
      while (stack.length) {
        const cur = stack.pop();
        const cy = (cur / w) | 0;
        const cx = cur - cy * w;
        comp.count++;
        comp.sumX += cx;
        comp.sumY += cy;
        if (cx < comp.minX) comp.minX = cx;
        if (cx > comp.maxX) comp.maxX = cx;
        if (cy < comp.minY) comp.minY = cy;
        if (cy > comp.maxY) comp.maxY = cy;
        const t = comp.topEdge[cx];
        if (t < 0 || cy < t) comp.topEdge[cx] = cy;
        const b = comp.bottomEdge[cx];
        if (b < 0 || cy > b) comp.bottomEdge[cx] = cy;
        // neighbors
        if (cx > 0) {
          const ni = cur - 1;
          if (!visited[ni] && data[(ni << 2) + 3] > 0) { visited[ni] = 1; stack.push(ni); }
        }
        if (cx + 1 < w) {
          const ni = cur + 1;
          if (!visited[ni] && data[(ni << 2) + 3] > 0) { visited[ni] = 1; stack.push(ni); }
        }
        if (cy > 0) {
          const ni = cur - w;
          if (!visited[ni] && data[(ni << 2) + 3] > 0) { visited[ni] = 1; stack.push(ni); }
        }
        if (cy + 1 < h) {
          const ni = cur + w;
          if (!visited[ni] && data[(ni << 2) + 3] > 0) { visited[ni] = 1; stack.push(ni); }
        }
      }
      comp.cx = comp.sumX / comp.count;
      comp.cy = comp.sumY / comp.count;
      comps.push(comp);
    }
  }
  return comps;
}

function fillVerticalGaps(points, maxGap) {
  if (!points.length) return null;
  const raster = rasterizePoints(points);
  if (!raster) return null;
  const { data, w, h, offsetX, offsetY } = raster;
  const gapLimit = Number.isFinite(maxGap) ? Math.max(1, maxGap | 0) : null;
  const comps = findComponents(data, w, h);
  let filled = false;
  if (comps.length >= 2) {
    comps.sort((a, b) => a.minY - b.minY);
    for (let i = 0; i < comps.length - 1; i++) {
      const upper = comps[i];
      const lower = comps[i + 1];
      const gap = lower.minY - upper.maxY - 1;
      if (gap <= 0) continue;
      if (gapLimit != null && gap > gapLimit) continue;
      const xStart = Math.max(upper.minX, lower.minX);
      const xEnd = Math.min(upper.maxX, lower.maxX);
      if (xStart > xEnd) continue;
      for (let x = xStart; x <= xEnd; x++) {
        const yTop = upper.bottomEdge[x];
        const yBot = lower.topEdge[x];
        if (yTop < 0 || yBot < 0 || yBot - yTop <= 1) continue;
        if (gapLimit != null && (yBot - yTop - 1) > gapLimit) continue;
        const srcIdx = ((yTop * w) + x) << 2;
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        const a = data[srcIdx + 3];
        for (let y = yTop + 1; y < yBot; y++) {
          const dstIdx = ((y * w) + x) << 2;
          if (data[dstIdx + 3] > 0) continue;
          data[dstIdx] = r;
          data[dstIdx + 1] = g;
          data[dstIdx + 2] = b;
          data[dstIdx + 3] = a;
          filled = true;
        }
      }
    }
  }

  if (!filled) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, maxX, minY, maxY };
  }

  const out = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = ((y * w) + x) << 2;
      const a = data[idx + 3];
      if (a === 0) continue;
      const px = x + offsetX;
      const py = y + offsetY;
      out.push({ x: px, y: py, r: data[idx], g: data[idx + 1], b: data[idx + 2], a });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { points: out, minX, maxX, minY, maxY };
}

function fillSmallColumnGaps(points, maxGap) {
  if (!points.length) return null;
  const raster = rasterizePoints(points);
  if (!raster) return null;
  const { data, w, h, offsetX, offsetY } = raster;
  let filled = false;
  for (let x = 0; x < w; x++) {
    const runs = [];
    let y = 0;
    while (y < h) {
      const idx = ((y * w) + x) << 2;
      if (data[idx + 3] === 0) {
        y++;
        continue;
      }
      const start = y;
      let end = y;
      let endColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
      y++;
      while (y < h) {
        const ii = ((y * w) + x) << 2;
        if (data[ii + 3] === 0) break;
        end = y;
        endColor = [data[ii], data[ii + 1], data[ii + 2], data[ii + 3]];
        y++;
      }
      runs.push({ start, end, color: endColor });
    }
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1];
      const cur = runs[i];
      const gap = cur.start - prev.end - 1;
      if (gap <= 0 || gap > maxGap) continue;
      for (let yy = prev.end + 1; yy < cur.start; yy++) {
        const dstIdx = ((yy * w) + x) << 2;
        if (data[dstIdx + 3] > 0) continue;
        data[dstIdx] = prev.color[0];
        data[dstIdx + 1] = prev.color[1];
        data[dstIdx + 2] = prev.color[2];
        data[dstIdx + 3] = prev.color[3];
        filled = true;
      }
    }
  }

  if (!filled) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, maxX, minY, maxY };
  }

  const out = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = ((y * w) + x) << 2;
      const a = data[idx + 3];
      if (a === 0) continue;
      const px = x + offsetX;
      const py = y + offsetY;
      out.push({ x: px, y: py, r: data[idx], g: data[idx + 1], b: data[idx + 2], a });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { points: out, minX, maxX, minY, maxY };
}

function fillBowVerticalBridge(points, maxGap) {
  // TODO(weapons): Bow rim/handle gap fill is still imperfect; revisit rim-band detection and fill strategy.
  if (!points.length) return null;
  const raster = rasterizePoints(points);
  if (!raster) return null;
  const { data, w, h, offsetX, offsetY } = raster;
  let filled = false;

  const longestRunByX = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let y = 0;
    let longest = 0;
    while (y < h) {
      const idx = ((y * w) + x) << 2;
      if (data[idx + 3] === 0) { y++; continue; }
      const start = y;
      y++;
      while (y < h) {
        const ii = ((y * w) + x) << 2;
        if (data[ii + 3] === 0) break;
        y++;
      }
      const len = y - start;
      if (len > longest) longest = len;
    }
    longestRunByX[x] = longest;
  }

  const minRun = Math.max(2, Math.round(h * 0.5));
  const rimCols = [];
  for (let x = 0; x < w; x++) {
    if (longestRunByX[x] >= minRun) rimCols.push(x);
  }
  if (rimCols.length < 2) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, maxX, minY, maxY };
  }

  rimCols.sort((a, b) => a - b);
  const clusters = [];
  let clusterStart = rimCols[0];
  let clusterEnd = rimCols[0];
  for (let i = 1; i < rimCols.length; i++) {
    const x = rimCols[i];
    if (x === clusterEnd + 1) {
      clusterEnd = x;
    } else {
      clusters.push({ start: clusterStart, end: clusterEnd });
      clusterStart = x;
      clusterEnd = x;
    }
  }
  clusters.push({ start: clusterStart, end: clusterEnd });
  if (clusters.length < 2) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, maxX, minY, maxY };
  }

  const leftCluster = clusters[0];
  const rightCluster = clusters[clusters.length - 1];
  const leftWidth = (leftCluster.end - leftCluster.start + 1) | 0;
  const rightWidth = (rightCluster.end - rightCluster.start + 1) | 0;
  const bandWidth = Math.max(1, leftWidth, rightWidth);
  const gapLimit = Math.max(1, Math.max(Number.isFinite(maxGap) ? (maxGap | 0) : 0, bandWidth));

  const fillColumnGaps = (x) => {
    const runs = [];
    let y = 0;
    while (y < h) {
      const idx = ((y * w) + x) << 2;
      if (data[idx + 3] === 0) { y++; continue; }
      const start = y;
      y++;
      while (y < h) {
        const ii = ((y * w) + x) << 2;
        if (data[ii + 3] === 0) break;
        y++;
      }
      const end = y - 1;
      const endIdx = ((end * w) + x) << 2;
      runs.push({
        start,
        end,
        color: [
          data[endIdx],
          data[endIdx + 1],
          data[endIdx + 2],
          data[endIdx + 3]
        ]
      });
    }
    if (runs.length < 2) return;
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1];
      const cur = runs[i];
      const gap = cur.start - prev.end - 1;
      if (gap <= 0 || gap > gapLimit) continue;
      for (let yy = prev.end + 1; yy < cur.start; yy++) {
        const dstIdx = ((yy * w) + x) << 2;
        if (data[dstIdx + 3] > 0) continue;
        data[dstIdx] = prev.color[0];
        data[dstIdx + 1] = prev.color[1];
        data[dstIdx + 2] = prev.color[2];
        data[dstIdx + 3] = prev.color[3];
        filled = true;
      }
    }
  };

  for (let x = leftCluster.start; x <= leftCluster.end; x++) fillColumnGaps(x);
  for (let x = rightCluster.start; x <= rightCluster.end; x++) fillColumnGaps(x);

  if (!filled) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, maxX, minY, maxY };
  }

  const out = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = ((y * w) + x) << 2;
      const a = data[idx + 3];
      if (a === 0) continue;
      const px = x + offsetX;
      const py = y + offsetY;
      out.push({ x: px, y: py, r: data[idx], g: data[idx + 1], b: data[idx + 2], a });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { points: out, minX, maxX, minY, maxY };
}

function buildCompositeArming(entries, atlasCache, data) {
  const idleEntries = entries.filter((e) => String(e.anim || "").includes("universal_combat_idle"));
  if (!idleEntries.length) return null;
  const pick = idleEntries[0];
  if (!pick) return null;
  const bg = pick.bg || null;
  const fg = pick.fg || null;
  const base = bg || fg;
  if (!base) return null;

  const cols = Math.max(1, base.cols | 0);
  const rows = Math.max(1, base.rows | 0);
  let frameW = Math.max(1, base.frameW | 0);
  let frameH = Math.max(1, base.frameH | 0);

  let bgAtlasPng = null;
  let fgAtlasPng = null;
  let frameBg = null;
  let frameFg = null;
  if (bg) {
    const atlasKeyBg = String(bg.atlasKey || "");
    const atlasBg = data[atlasKeyBg];
    const atlasImageBg = String(atlasBg?.meta?.image || "");
    if (!atlasImageBg) return null;
    const atlasPathBg = path.join(ATLAS_DIR, atlasImageBg);
    bgAtlasPng = atlasCache.get(atlasPathBg);
    if (!bgAtlasPng) {
      if (!fs.existsSync(atlasPathBg)) return null;
      bgAtlasPng = PNG.sync.read(fs.readFileSync(atlasPathBg));
      atlasCache.set(atlasPathBg, bgAtlasPng);
    }
    frameBg = atlasBg?.frames?.[bg.key]?.frame || null;
    if (!frameBg) return null;
  }
  if (fg) {
    const atlasKeyFg = String(fg.atlasKey || "");
    const atlasFg = data[atlasKeyFg];
    const atlasImageFg = String(atlasFg?.meta?.image || "");
    if (!atlasImageFg) return null;
    const atlasPathFg = path.join(ATLAS_DIR, atlasImageFg);
    fgAtlasPng = atlasCache.get(atlasPathFg);
    if (!fgAtlasPng) {
      if (!fs.existsSync(atlasPathFg)) return null;
      fgAtlasPng = PNG.sync.read(fs.readFileSync(atlasPathFg));
      atlasCache.set(atlasPathFg, fgAtlasPng);
    }
    frameFg = atlasFg?.frames?.[fg.key]?.frame || null;
    if (!frameFg) return null;
  }

  const sheetFrame = frameBg || frameFg;
  if (sheetFrame && sheetFrame.w && sheetFrame.h) {
    const derivedW = Math.round((sheetFrame.w | 0) / cols);
    const derivedH = Math.round((sheetFrame.h | 0) / rows);
    if (derivedW > 0) frameW = derivedW;
    if (derivedH > 0) frameH = derivedH;
  }

  const rowLeft = dirIndex("left");
  const rowRight = dirIndex("right");
  const col = 0;
  const x0L = frameBg ? ((frameBg.x | 0) + (col * frameW)) : 0;
  const y0L = frameBg ? ((frameBg.y | 0) + (rowLeft * frameH)) : 0;
  const x1L = frameFg ? ((frameFg.x | 0) + (col * frameW)) : 0;
  const y1L = frameFg ? ((frameFg.y | 0) + (rowLeft * frameH)) : 0;
  const x0R = frameBg ? ((frameBg.x | 0) + (col * frameW)) : 0;
  const y0R = frameBg ? ((frameBg.y | 0) + (rowRight * frameH)) : 0;
  const x1R = frameFg ? ((frameFg.x | 0) + (col * frameW)) : 0;
  const y1R = frameFg ? ((frameFg.y | 0) + (rowRight * frameH)) : 0;

  const left = extractFramePixels({
    frameW, frameH,
    bgAtlasPng, fgAtlasPng,
    x0: x0L, y0: y0L, x1: x1L, y1: y1L
  });
  const right = extractFramePixels({
    frameW, frameH,
    bgAtlasPng, fgAtlasPng,
    x0: x0R, y0: y0R, x1: x1R, y1: y1R
  });
  if (!left || !right) return null;

  const leftMetrics = analyzePixels(left.pixels, left);
  const rightMetrics = analyzePixels(right.pixels, right);
  const leftRot = rotateAll(left.pixels, leftMetrics.cx, leftMetrics.cy, Math.atan2(leftMetrics.vx, leftMetrics.vy));
  const rightRot = rotateAll(right.pixels, rightMetrics.cx, rightMetrics.cy, Math.atan2(rightMetrics.vx, rightMetrics.vy));
  const leftCentered = centerPoints(leftRot.rotated);
  const rightCentered = centerPoints(rightRot.rotated);
  const rightFlipped = rightCentered.points.map((p) => ({ ...p, y: -p.y }));

  let merged = leftCentered.points.concat(rightFlipped);
  const mirrored = merged.map((p) => ({ ...p, x: -p.x }));
  merged = merged.concat(mirrored);

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of merged) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (needsTipFlip(merged, minY, maxY)) {
    merged = merged.map((p) => ({ ...p, x: -p.x, y: -p.y }));
    minX = 1e9; maxX = -1e9; minY = 1e9; maxY = -1e9;
    for (const p of merged) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const metrics = analyzePixels(merged, { minX, minY, maxX, maxY });
  return {
    pixels: merged,
    metrics,
    rows,
    frameRow: rowLeft,
    frameCol: col,
    anim: pick.anim,
    bg,
    fg
  };
}

function main() {
  const { sheets, data } = loadMeta();

  const pairsByAnim = new Map(); // model|variant|tile -> anim -> {bg,fg}
  for (const m of sheets) {
    if (!m || !m.key) continue;
    if (isDupKey(m.key)) continue;
    const model = String(m.model || "");
    const variant = String(m.variant || "");
    const tile = m.tile | 0;
    const anim = String(m.anim || "");
    const layer = String(m.layer || "");
    if (!model || !variant || !anim) continue;
    const mvKey = `${model}|${variant}|${tile}`;
    let animMap = pairsByAnim.get(mvKey);
    if (!animMap) {
      animMap = new Map();
      pairsByAnim.set(mvKey, animMap);
    }
    let entry = animMap.get(anim);
    if (!entry) {
      entry = { model, variant, tile, anim, bg: null, fg: null };
      animMap.set(anim, entry);
    }
    if (layer === "bg") entry.bg = m;
    if (layer === "fg") entry.fg = m;
  }

  const atlasCache = new Map();
  const frames = [];
  let maxAbsX = 0;
  let maxAbsY = 0;

  const mvKeys = Array.from(pairsByAnim.keys()).sort();
  for (const mvKey of mvKeys) {
    const [model, variant, tileStr] = mvKey.split("|");
    const animMap = pairsByAnim.get(mvKey);
    if (!animMap) continue;
    const entries = Array.from(animMap.values()).filter(e => e.bg || e.fg);
    if (!entries.length) continue;

    if (String(model || "").toLowerCase() === "arming") {
      const composite = buildCompositeArming(entries, atlasCache, data);
      if (!composite) continue;
      const best = {
        model,
        variant,
        tile: tileStr | 0,
        anim: composite.anim,
        bg: composite.bg,
        fg: composite.fg,
        frameIndex: 0,
        frameRow: composite.frameRow,
        frameCol: composite.frameCol,
        rows: composite.rows,
        pixels: composite.pixels,
        override: { rotCwDeg: 0, skipAutoRotate: true, mirrorX: false },
        metrics: composite.metrics,
        score: 0
      };

      let rot = 0;
      let pass = rotateAll(best.pixels, best.metrics.cx, best.metrics.cy, rot);
      let working = { points: pass.rotated, minX: pass.minX, maxX: pass.maxX, minY: pass.minY, maxY: pass.maxY };
      const filled = fillVerticalGaps(working.points);
      const final = filled || working;
      let finalPoints = final.points;
      let minX = final.minX, maxX = final.maxX, minY = final.minY, maxY = final.maxY;

      if (shouldFinalFlip(model, variant)) {
        const flipped = new Array(finalPoints.length);
        minX = 1e9; maxX = -1e9; minY = 1e9; maxY = -1e9;
        for (let i = 0; i < finalPoints.length; i++) {
          const p = finalPoints[i];
          const np = { ...p, y: -p.y };
          flipped[i] = np;
          if (np.x < minX) minX = np.x;
          if (np.x > maxX) maxX = np.x;
          if (np.y < minY) minY = np.y;
          if (np.y > maxY) maxY = np.y;
        }
        finalPoints = flipped;
      }

      maxAbsX = Math.max(maxAbsX, Math.abs(minX), Math.abs(maxX));
      maxAbsY = Math.max(maxAbsY, Math.abs(minY), Math.abs(maxY));

      let tipX = 0, tipY = 0, tipN = 0;
      let buttX = 0, buttY = 0, buttN = 0;
      for (const p of finalPoints) {
        if (p.y <= (minY + 0.5)) { tipX += p.x; tipY += p.y; tipN++; }
        if (p.y >= (maxY - 0.5)) { buttX += p.x; buttY += p.y; buttN++; }
      }
      if (tipN > 0) { tipX /= tipN; tipY /= tipN; }
      if (buttN > 0) { buttX /= buttN; buttY /= buttN; }

      frames.push({
        model,
        variant,
        tile: best.tile | 0,
        anim: best.anim,
        sheetKeyBg: best.bg ? best.bg.key : "",
        sheetKeyFg: best.fg ? best.fg.key : "",
        frameIndex: best.frameIndex,
        frameRow: best.frameRow,
        frameCol: best.frameCol,
        rotated: finalPoints,
        tipX: Number(tipX.toFixed(3)),
        tipY: Number(tipY.toFixed(3)),
        buttX: Number(buttX.toFixed(3)),
        buttY: Number(buttY.toFixed(3)),
        appliedRotMdeg: Math.round((rot * 180000) / Math.PI)
      });
      continue;
    }

    const override = getFrameOverride(model, variant);
    let best = null;

    for (let pass = 0; pass < 2; pass++) {
      const useOverride = pass === 0 && !!override && !!override.hasFrame;
      if (pass === 1 && !override) break;

      for (const entry of entries) {
        if (isBadAnim(entry.anim)) continue;

        const bg = entry.bg || null;
        const fg = entry.fg || null;
        const base = bg || fg;
        if (!base) continue;

        const cols = Math.max(1, base.cols | 0);
        const rows = Math.max(1, base.rows | 0);
        let frameW = Math.max(1, base.frameW | 0);
        let frameH = Math.max(1, base.frameH | 0);

        let bgAtlasPng = null;
        let fgAtlasPng = null;
        let frameBg = null;
        let frameFg = null;
        if (bg) {
          const atlasKeyBg = String(bg.atlasKey || "");
          const atlasBg = data[atlasKeyBg];
          const atlasImageBg = String(atlasBg?.meta?.image || "");
          if (!atlasImageBg) continue;
          const atlasPathBg = path.join(ATLAS_DIR, atlasImageBg);
          bgAtlasPng = atlasCache.get(atlasPathBg);
          if (!bgAtlasPng) {
            if (!fs.existsSync(atlasPathBg)) continue;
            bgAtlasPng = PNG.sync.read(fs.readFileSync(atlasPathBg));
            atlasCache.set(atlasPathBg, bgAtlasPng);
          }
          frameBg = atlasBg?.frames?.[bg.key]?.frame || null;
          if (!frameBg) continue;
        }
        if (fg) {
          const atlasKeyFg = String(fg.atlasKey || "");
          const atlasFg = data[atlasKeyFg];
          const atlasImageFg = String(atlasFg?.meta?.image || "");
          if (!atlasImageFg) continue;
          const atlasPathFg = path.join(ATLAS_DIR, atlasImageFg);
          fgAtlasPng = atlasCache.get(atlasPathFg);
          if (!fgAtlasPng) {
            if (!fs.existsSync(atlasPathFg)) continue;
            fgAtlasPng = PNG.sync.read(fs.readFileSync(atlasPathFg));
            atlasCache.set(atlasPathFg, fgAtlasPng);
          }
          frameFg = atlasFg?.frames?.[fg.key]?.frame || null;
          if (!frameFg) continue;
        }

        const sheetFrame = frameBg || frameFg;
        if (sheetFrame && sheetFrame.w && sheetFrame.h) {
          const derivedW = Math.round((sheetFrame.w | 0) / cols);
          const derivedH = Math.round((sheetFrame.h | 0) / rows);
          if (derivedW > 0) frameW = derivedW;
          if (derivedH > 0) frameH = derivedH;
        }

        const rowCols = [];
        if (useOverride && override) {
          rowCols.push({ row: override.row, col: override.col });
        } else {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) rowCols.push({ row: r, col: c });
          }
        }

        const downRow = dirIndex("down");
        const upRow = dirIndex("up");
        const prefCol = preferredCol(entry.anim, cols);

        for (const rc of rowCols) {
          const row = rc.row | 0;
          const col = rc.col | 0;
          if (row < 0 || col < 0 || row >= rows || col >= cols) continue;
          const frameIndex = (row * cols + col) | 0;
          const x0 = frameBg ? ((frameBg.x | 0) + (col * frameW)) : 0;
          const y0 = frameBg ? ((frameBg.y | 0) + (row * frameH)) : 0;
          const x1 = frameFg ? ((frameFg.x | 0) + (col * frameW)) : 0;
          const y1 = frameFg ? ((frameFg.y | 0) + (row * frameH)) : 0;

          const extracted = extractFramePixels({
            frameW, frameH,
            bgAtlasPng, fgAtlasPng,
            x0, y0, x1, y1
          });
          if (!extracted) continue;
          const metrics = analyzePixels(extracted.pixels, extracted);
          let score = scoreFrame(model, entry.anim, metrics);
          let rowBias = 0;
          if (rows >= 4) {
            if (row === downRow) rowBias += 140;
            else if (row === upRow) rowBias += 30;
            else rowBias -= 40;
          }
          const colBias = -Math.abs(col - prefCol) * 8;
          score += rowBias + colBias;
          if (!best || score > best.score) {
            best = {
              model,
              variant,
              tile: tileStr | 0,
              anim: entry.anim,
              bg,
              fg,
              frameIndex,
              frameRow: row,
              frameCol: col,
              rows,
              pixels: extracted.pixels,
              override,
              metrics,
              score
            };
          }
        }
      }

      if (useOverride && best) break;
    }

    if (!best) continue;

    let rot = 0;
    if (best.override && Number.isFinite(best.override.rotCwDeg)) {
      rot = (-best.override.rotCwDeg * Math.PI) / 180;
    } else {
      rot = Math.atan2(best.metrics.vx, best.metrics.vy) + Math.PI;
    }

    const sourcePixels = best.pixels;

    let pass = rotateAll(sourcePixels, best.metrics.cx, best.metrics.cy, rot);
    const allowAutoRotate = !(best.override && (best.override.skipAutoRotate || Number.isFinite(best.override.rotCwDeg)));
    if (allowAutoRotate) {
      const bounds = yBounds(sourcePixels);
      const southAnchor = (() => {
        let ax = 0, ay = 0, n = 0;
        const band = 0.5;
        for (const p of sourcePixels) {
          if (p.y >= (bounds.maxY - band)) { ax += p.x; ay += p.y; n++; }
        }
        if (!n) return { x: best.metrics.cx, y: bounds.maxY };
        return { x: ax / n, y: ay / n };
      })();
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const dx = southAnchor.x - best.metrics.cx;
      const dy = southAnchor.y - best.metrics.cy;
      const southRotY = (dx * s + dy * c);
      if (southRotY < 0) {
        rot += Math.PI;
        pass = rotateAll(sourcePixels, best.metrics.cx, best.metrics.cy, rot);
      }
    }

    let working = { points: pass.rotated, minX: pass.minX, maxX: pass.maxX, minY: pass.minY, maxY: pass.maxY };
    if (String(model || "").toLowerCase().startsWith("bow")) {
      const bowFix = fillSmallColumnGaps(working.points, 3);
      if (bowFix) working = bowFix;
      const bowBridge = fillBowVerticalBridge(working.points, 6);
      if (bowBridge) working = bowBridge;
    }
    const scytheGapLimit = (String(model || "").toLowerCase() === "scythe") ? 6 : null;
    const filled = fillVerticalGaps(working.points, scytheGapLimit);
    const final = filled || working;
    let finalPoints = final.points;
    let minX = final.minX, maxX = final.maxX, minY = final.minY, maxY = final.maxY;

    if (shouldFinalFlip(model, variant)) {
      const flipped = new Array(finalPoints.length);
      minX = 1e9; maxX = -1e9; minY = 1e9; maxY = -1e9;
      for (let i = 0; i < finalPoints.length; i++) {
        const p = finalPoints[i];
        const np = { ...p, y: -p.y };
        flipped[i] = np;
        if (np.x < minX) minX = np.x;
        if (np.x > maxX) maxX = np.x;
        if (np.y < minY) minY = np.y;
        if (np.y > maxY) maxY = np.y;
      }
      finalPoints = flipped;
    }

    maxAbsX = Math.max(maxAbsX, Math.abs(minX), Math.abs(maxX));
    maxAbsY = Math.max(maxAbsY, Math.abs(minY), Math.abs(maxY));

    // tip/butt anchors
    let tipX = 0, tipY = 0, tipN = 0;
    let buttX = 0, buttY = 0, buttN = 0;
    for (const p of finalPoints) {
      if (p.y <= (minY + 0.5)) { tipX += p.x; tipY += p.y; tipN++; }
      if (p.y >= (maxY - 0.5)) { buttX += p.x; buttY += p.y; buttN++; }
    }
    if (tipN > 0) { tipX /= tipN; tipY /= tipN; }
    if (buttN > 0) { buttX /= buttN; buttY /= buttN; }

    frames.push({
      model,
      variant,
      tile: best.tile | 0,
      anim: best.anim,
      sheetKeyBg: best.bg ? best.bg.key : "",
      sheetKeyFg: best.fg ? best.fg.key : "",
      frameIndex: best.frameIndex,
      frameRow: best.frameRow,
      frameCol: best.frameCol,
      rotated: finalPoints,
      tipX: Number(tipX.toFixed(3)),
      tipY: Number(tipY.toFixed(3)),
      buttX: Number(buttX.toFixed(3)),
      buttY: Number(buttY.toFixed(3)),
      appliedRotMdeg: Math.round((rot * 180000) / Math.PI)
    });
  }

  if (!frames.length) {
    console.log("No frames found.");
    return;
  }

  const extentX = Math.ceil(maxAbsX) + PAD;
  const extentY = Math.ceil(maxAbsY) + PAD;
  const frameW = extentX * 2 + 1;
  const frameH = extentY * 2 + 1;
  const count = frames.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));

  const sheet = new PNG({ width: frameW * cols, height: frameH * rows });
  sheet.data.fill(0);
  const centerX = extentX;
  const centerY = extentY;

  const meta = [];
  const indexLines = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * frameW;
    const oy = row * frameH;

    for (const p of f.rotated) {
      const ix = Math.round(p.x + centerX);
      const iy = Math.round(p.y + centerY);
      if (ix < 0 || iy < 0 || ix >= frameW || iy >= frameH) continue;
      const sx = ox + ix;
      const sy = oy + iy;
      const idx = ((sy * sheet.width) + sx) << 2;
      const a1 = p.a / 255;
      const a0 = sheet.data[idx + 3] / 255;
      const outA = a1 + a0 * (1 - a1);
      if (outA <= 0) continue;
      const r = (p.r * a1 + sheet.data[idx] * a0 * (1 - a1)) / outA;
      const g = (p.g * a1 + sheet.data[idx + 1] * a0 * (1 - a1)) / outA;
      const b = (p.b * a1 + sheet.data[idx + 2] * a0 * (1 - a1)) / outA;
      sheet.data[idx] = Math.round(r);
      sheet.data[idx + 1] = Math.round(g);
      sheet.data[idx + 2] = Math.round(b);
      sheet.data[idx + 3] = Math.round(outA * 255);
    }

    const len = Number(Math.hypot(f.tipX - f.buttX, f.tipY - f.buttY).toFixed(3));
    meta.push({
      weaponId: f.model,
      variant: f.variant,
      anim: f.anim,
      tile: f.tile | 0,
      frameIndex: i,
      sourceFrame: f.frameIndex,
      sourceRow: f.frameRow,
      sourceCol: f.frameCol,
      frameW,
      frameH,
      tipX: f.tipX,
      tipY: f.tipY,
      buttX: f.buttX,
      buttY: f.buttY,
      length: len,
      appliedRotMdeg: f.appliedRotMdeg,
      sheetKeyBg: f.sheetKeyBg || "",
      sheetKeyFg: f.sheetKeyFg || ""
    });
    indexLines.push(
      `${row},${col}\t${f.model}\t${f.variant}\t${f.anim}\trow=${f.frameRow}\tcol=${f.frameCol}\tframe=${i}`
    );
  }

  ensureDir(OUT_DIR);
  const outPng = path.join(OUT_DIR, `weapon_master ${frameW}x${frameH}.png`);
  fs.writeFileSync(outPng, PNG.sync.write(sheet));

  const metaText =
`// AUTO-GENERATED by scripts/genweaponmasteratlas.mjs
export const WEAPON_MASTER_SHEET = ${JSON.stringify({
  key: "weapon.master",
  frameW,
  frameH,
  cols,
  rows,
  total: count
}, null, 2)};

export type WeaponMasterFrame = {
  weaponId: string;
  variant: string;
  anim: string;
  tile: number;
  frameIndex: number;
  sourceFrame: number;
  sourceRow: number;
  sourceCol: number;
  frameW: number;
  frameH: number;
  tipX: number;
  tipY: number;
  buttX: number;
  buttY: number;
  length: number;
  appliedRotMdeg: number;
  sheetKeyBg: string;
  sheetKeyFg: string;
};

export const WEAPON_MASTER_FRAMES: WeaponMasterFrame[] = ${JSON.stringify(meta, null, 2)};
`;

  ensureDir(path.dirname(OUT_META));
  fs.writeFileSync(OUT_META, metaText);

  const debugDir = path.join(ROOT, "debug_dumps");
  ensureDir(debugDir);
  fs.writeFileSync(path.join(debugDir, "weapon_master_index.txt"), indexLines.join("\n"));

  console.log("Wrote:", outPng);
  console.log("Wrote:", OUT_META);
}

main();
