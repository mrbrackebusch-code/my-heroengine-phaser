#!/usr/bin/env node
/**
 * Generate a composite hookshot thrust weapon sheet + metadata.
 *
 * - Uses frame 1 from each thrust / attack_thrust weapon (BG+FG merged).
 * - Rotates each weapon so the shaft axis is vertical (tip up).
 * - Centers the weapon so the shaft axis is on the vertical center line.
 * - Pads to a uniform frame size across all weapons.
 *
 * Outputs:
 *   assets/weapons/_hookshot/hookshot_thrust.png
 *   src/generated/hookshotWeaponMeta.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const WEAPONS_DIR = path.join(ROOT, "assets", "weapons");
const OUT_DIR = path.join(WEAPONS_DIR, "_hookshot");
const OUT_PNG = path.join(OUT_DIR, "hookshot_thrust.png");
const OUT_META = path.join(ROOT, "src", "generated", "hookshotWeaponMeta.ts");

const TILE_RE = /^t(064|128|192)$/i;
const FRAME_INDEX = 1;
const PAD = 2;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listOriginalPngs(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const name = ent.name.toLowerCase();
      if (name === "_atlas" || name === "_hookshot") continue;
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

function rotatePoint(x, y, cos, sin) {
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

function main() {
  ensureDir(OUT_DIR);

  const originals = [];
  listOriginalPngs(WEAPONS_DIR, originals);

  const groups = new Map();
  for (const file of originals) {
    const base = basenameNoExt(file);
    const parsed = parseWeaponFilename(base);
    if (!parsed) continue;
    const animLower = String(parsed.anim || "").toLowerCase();
    if (!animLower.includes("thrust")) continue;
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

  const frames = [];
  let maxAbsX = 0;
  let maxAbsY = 0;

  const entries = Array.from(groups.values())
    .filter(e => e.bgPath && e.fgPath)
    .sort((a, b) =>
      a.model.localeCompare(b.model) ||
      a.variant.localeCompare(b.variant) ||
      a.anim.localeCompare(b.anim) ||
      (a.tile | 0) - (b.tile | 0)
    );

  for (const entry of entries) {
    const bg = readPng(entry.bgPath);
    const fg = readPng(entry.fgPath);
    const tile = entry.tile | 0;
    const cols = Math.max(1, Math.floor(bg.width / tile));
    const rows = Math.max(1, Math.floor(bg.height / tile));
    const total = cols * rows;
    const idx = Math.max(0, Math.min(total - 1, FRAME_INDEX));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x0 = col * tile;
    const y0 = row * tile;

    const pixels = [];
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const bi = ((y0 + y) * bg.width + (x0 + x)) << 2;
        const fi = ((y0 + y) * fg.width + (x0 + x)) << 2;
        const bgPx = [bg.data[bi], bg.data[bi + 1], bg.data[bi + 2], bg.data[bi + 3]];
        const fgPx = [fg.data[fi], fg.data[fi + 1], fg.data[fi + 2], fg.data[fi + 3]];
        const out = alphaBlend(bgPx, fgPx);
        if (out[3] > 0) pixels.push({ x, y, r: out[0], g: out[1], b: out[2], a: out[3] });
      }
    }
    if (!pixels.length) continue;

    let sx = 0, sy = 0;
    let minY0 = 1e9, maxY0 = -1e9;
    for (const p of pixels) {
      sx += p.x; sy += p.y;
      if (p.y < minY0) minY0 = p.y;
      if (p.y > maxY0) maxY0 = p.y;
    }
    const cx = sx / pixels.length;
    const cy = sy / pixels.length;

    let { vx, vy } = computeAxis(pixels, cx, cy);

    const rotateAll = (rotAngle) => {
      const c = Math.cos(rotAngle);
      const s = Math.sin(rotAngle);
      let minX = 1e9, maxX2 = -1e9, minY = 1e9, maxY2 = -1e9;
      const rotated = [];
      for (const p of pixels) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const r = rotatePoint(dx, dy, c, s);
        if (r.x < minX) minX = r.x;
        if (r.x > maxX2) maxX2 = r.x;
        if (r.y < minY) minY = r.y;
        if (r.y > maxY2) maxY2 = r.y;
        rotated.push({ x: r.x, y: r.y, r: p.r, g: p.g, b: p.b, a: p.a });
      }
      return { rotated, minX, maxX2, minY, maxY2 };
    };

    // Align axis to vertical (tip up). We'll flip 180 if the original bottom edge
    // (row 0 "south" in source) ends up above center after rotation.
    const southAnchor = (() => {
      let ax = 0, ay = 0, n = 0;
      for (const p of pixels) {
        if (p.y >= (maxY0 - 0.5)) { ax += p.x; ay += p.y; n++; }
      }
      if (!n) return { x: cx, y: maxY0 };
      return { x: ax / n, y: ay / n };
    })();

    let rot = Math.atan2(vx, vy) + Math.PI;
    let pass = rotateAll(rot);
    {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const southRot = rotatePoint(southAnchor.x - cx, southAnchor.y - cy, c, s);
      if (southRot.y < 0) {
        rot += Math.PI;
        pass = rotateAll(rot);
      }
    }

    const pickTipButt = (rotated, minY, maxY) => {
      let tipX = 0, tipY = 0, tipN = 0;
      let buttX = 0, buttY = 0, buttN = 0;
      for (const p of rotated) {
        if (p.y <= (minY + 0.5)) { tipX += p.x; tipY += p.y; tipN++; }
        if (p.y >= (maxY - 0.5)) { buttX += p.x; buttY += p.y; buttN++; }
      }
      if (tipN > 0) { tipX /= tipN; tipY /= tipN; } else { tipX = 0; tipY = minY; }
      if (buttN > 0) { buttX /= buttN; buttY /= buttN; } else { buttX = 0; buttY = maxY; }
      return { tipX, tipY, buttX, buttY };
    };

    const tipButt = pickTipButt(pass.rotated, pass.minY, pass.maxY2);

    const rotated = pass.rotated;
    const minX = pass.minX;
    const maxX2 = pass.maxX2;
    const minY = pass.minY;
    const maxY2 = pass.maxY2;

    const tipRot = { x: tipButt.tipX, y: tipButt.tipY };
    const buttRot = { x: tipButt.buttX, y: tipButt.buttY };

    maxAbsX = Math.max(maxAbsX, Math.abs(minX), Math.abs(maxX2));
    maxAbsY = Math.max(maxAbsY, Math.abs(minY), Math.abs(maxY2));

    frames.push({
      model: entry.model,
      anim: entry.anim,
      variant: entry.variant,
      tile: entry.tile | 0,
      sourceFrame: idx,
      rotated,
      tipRot,
      buttRot,
      appliedRotMdeg: Math.round((rot * 180000) / Math.PI)
    });
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

  const meta = [];

  const centerX = extentX;
  const centerY = extentY;

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

    const buttX = Number(f.buttRot.x.toFixed(3));
    const buttY = Number(f.buttRot.y.toFixed(3));
    const tipX = Number(f.tipRot.x.toFixed(3));
    const tipY = Number(f.tipRot.y.toFixed(3));
    const len = Number(Math.hypot(tipX - buttX, tipY - buttY).toFixed(3));

    meta.push({
      weaponId: f.model,
      anim: f.anim,
      variant: f.variant,
      tile: f.tile,
      frameIndex: i,
      sourceFrame: f.sourceFrame,
      frameW,
      frameH,
      buttX,
      buttY,
      tipX,
      tipY,
      length: len,
      appliedRotMdeg: f.appliedRotMdeg
    });
  }

  ensureDir(path.dirname(OUT_PNG));
  fs.writeFileSync(OUT_PNG, PNG.sync.write(sheet));

  const metaText =
`// AUTO-GENERATED by scripts/genhookshotweapons.mjs
export const HOOKSHOT_THRUST_SHEET = ${JSON.stringify({
  key: "hookshot.thrust",
  frameW,
  frameH,
  cols,
  rows,
  total: count
}, null, 2)};

export type HookshotWeaponFrame = {
  weaponId: string;
  anim: string;
  variant: string;
  tile: number;
  frameIndex: number;
  sourceFrame: number;
  frameW: number;
  frameH: number;
  buttX: number;
  buttY: number;
  tipX: number;
  tipY: number;
  length: number;
  appliedRotMdeg: number;
};

export const HOOKSHOT_THRUST_FRAMES: HookshotWeaponFrame[] = ${JSON.stringify(meta, null, 2)};
`;

  ensureDir(path.dirname(OUT_META));
  fs.writeFileSync(OUT_META, metaText);

  console.log("Wrote:", OUT_PNG);
  console.log("Wrote:", OUT_META);
}

main();
