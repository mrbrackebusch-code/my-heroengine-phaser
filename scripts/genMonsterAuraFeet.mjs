#!/usr/bin/env node
/**
 * Generate precomputed "foot" positions for monster aura sheets.
 *
 * For each aura PNG in assets/enemies/<group>/auras, we:
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
const AURA_DIRS = [
  path.join(ROOT, "assets", "enemies", "monsters", "auras"),
  path.join(ROOT, "assets", "enemies", "bosses", "auras"),
];
const OUT_TS = path.join(ROOT, "src/generated/monsterAuraFeet.ts");
const FOOT_LIFT_PX = 2;       // lift the foot a bit to avoid grabbing trailing pixels
const OVERWRITE_ALL = (process.env.OVERWRITE_AURA_FEET === "true");  // true to recompute all entries; false fills only missing ids
const OUTLINE_SIDES_PRIMARY = 8; // octagon candidate
const OUTLINE_SIDES_ALT = 6; // hexagon fallback when 8-sides isn't meaningfully different
const OUTLINE_SIMILARITY_PCT = 0.04; // choose 6 if |area8-area6|/area8 <= this
const DIR_LETTERS = new Set(["U", "D", "L", "R", "N", "E", "S", "W"]);
const AURA_RADIUS_RE = /_aura_r(\d+)$/i;

function mapLetterToDir(ch) {
  switch (ch) {
    case "U":
    case "N": return "up";
    case "D":
    case "S": return "down";
    case "L":
    case "W": return "left";
    case "R":
    case "E": return "right";
    default: return "down";
  }
}

function makeDirs(sides) {
  const dirs = [];
  for (let i = 0; i < sides; i++) {
    const ang = (Math.PI * 2 * i) / sides;
    dirs.push({ x: Math.cos(ang), y: Math.sin(ang) });
  }
  return dirs;
}

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

function parseAuraMeta(baseName) {
  const radiusMatch = baseName.match(AURA_RADIUS_RE);
  const radius = radiusMatch ? parseInt(radiusMatch[1], 10) : null;
  const cleaned = baseName.replace(AURA_RADIUS_RE, "").replace(/_/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  const sizeIdx = tokens.findIndex(t => /^\d+x\d+$/i.test(t));
  if (sizeIdx === -1) return null;
  const id = tokens.slice(0, sizeIdx).join(" ").trim();
  const rest = tokens.slice(sizeIdx + 1);

  let hasDirs = false;
  let dirs = undefined;
  if (rest[0] && /^[A-Z]+/.test(rest[0])) {
    const dirToken = rest[0];
    const letters = [];
    for (const ch of dirToken) {
      if (DIR_LETTERS.has(ch)) {
        letters.push(ch);
        hasDirs = true;
      } else {
        break;
      }
    }
    if (letters.length > 0) {
      dirs = letters.map(mapLetterToDir);
    }
  }

  let hasWalk = false;
  let hasAttack = false;
  let hasDeath = false;
  for (const token of rest) {
    const re = /(\d+)(Walk|Attack|Death|Row)/gi;
    let m;
    while ((m = re.exec(token)) !== null) {
      const label = String(m[2] || "").toLowerCase();
      if (label === "walk") hasWalk = true;
      else if (label === "attack") hasAttack = true;
      else if (label === "death") hasDeath = true;
    }
    if (!hasDeath && /death/i.test(token)) hasDeath = true;
  }

  return { id, hasDirs, hasWalk, hasAttack, hasDeath, baseName: cleaned, dirs, radius };
}

function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += (a[0] * b[1]) - (b[0] * a[1]);
  }
  return Math.abs(sum) / 2;
}

function initOutlineState(sides, centerX, centerY) {
  return {
    sides,
    dirs: makeDirs(sides),
    maxProj: new Array(sides).fill(-Infinity),
    bestX: new Array(sides).fill(Math.round(centerX)),
    bestY: new Array(sides).fill(Math.round(centerY)),
  };
}

function findFoot(baseName, filePath, meta) {
  const sizeMatch = baseName.match(/(\d+)x(\d+)/i);
  const declaredW = sizeMatch ? parseInt(sizeMatch[1], 10) : null;
  const declaredH = sizeMatch ? parseInt(sizeMatch[2], 10) : null;

  const { w: sheetW, h: sheetH, rows } = parsePng(filePath);
  const frameW = declaredW && declaredW > 0 ? declaredW : sheetW;
  const frameH = declaredH && declaredH > 0 ? declaredH : sheetH;
  const cols = Math.max(1, Math.floor(sheetW / frameW));
  const rowsCount = Math.max(1, Math.floor(sheetH / frameH));

  let bestFoot = frameH - 1;
  const centerX = (frameW - 1) / 2;
  const centerY = (frameH - 1) / 2;
  const outline8 = initOutlineState(OUTLINE_SIDES_PRIMARY, centerX, centerY);
  const outline6 = initOutlineState(OUTLINE_SIDES_ALT, centerX, centerY);
  let minX = frameW - 1;
  let minY = frameH - 1;
  let maxX = 0;
  let maxY = 0;
  let anyPixel = false;

  const dirOrder = (meta && Array.isArray(meta.dirs)) ? meta.dirs : [];
  const dirCount = dirOrder.length | 0;
  const dirStates = {};
  const dirAny = {};

  function initDirState() {
    return {
      outline8: initOutlineState(OUTLINE_SIDES_PRIMARY, centerX, centerY),
      outline6: initOutlineState(OUTLINE_SIDES_ALT, centerX, centerY),
      minX: frameW - 1,
      minY: frameH - 1,
      maxX: 0,
      maxY: 0
    };
  }

  for (const d of dirOrder) {
    dirStates[d] = initDirState();
    dirAny[d] = false;
  }

  for (let ry = 0; ry < rowsCount; ry++) {
    const rowDir = (dirCount > 0 && ry >= 0 && ry < dirCount) ? dirOrder[ry] : null;
    for (let rx = 0; rx < cols; rx++) {
      const x0 = rx * frameW;
      const y0 = ry * frameH;
      const cx = Math.floor(frameW / 2);
      for (let y = frameH - 1; y >= 0; y--) {
        const ay = y0 + y;
        const ax = (x0 + cx) * 4;
        const a = rows[ay][ax + 3];
        if (a > 0) {
          if (y > bestFoot) bestFoot = y;
          break;
        }
      }

      for (let y = 0; y < frameH; y++) {
        const ay = y0 + y;
        const row = rows[ay];
        for (let x = 0; x < frameW; x++) {
          const ax = (x0 + x) * 4;
          const a = row[ax + 3];
          if (a <= 0) continue;
          anyPixel = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          const dx = x - centerX;
          const dy = y - centerY;
          for (let k = 0; k < outline8.sides; k++) {
            const dir = outline8.dirs[k];
            const proj = dx * dir.x + dy * dir.y;
            if (proj > outline8.maxProj[k]) {
              outline8.maxProj[k] = proj;
              outline8.bestX[k] = x;
              outline8.bestY[k] = y;
            }
          }
          for (let k = 0; k < outline6.sides; k++) {
            const dir = outline6.dirs[k];
            const proj = dx * dir.x + dy * dir.y;
            if (proj > outline6.maxProj[k]) {
              outline6.maxProj[k] = proj;
              outline6.bestX[k] = x;
              outline6.bestY[k] = y;
            }
          }
          if (rowDir && dirStates[rowDir]) {
            const st = dirStates[rowDir];
            dirAny[rowDir] = true;
            if (x < st.minX) st.minX = x;
            if (y < st.minY) st.minY = y;
            if (x > st.maxX) st.maxX = x;
            if (y > st.maxY) st.maxY = y;
            for (let k = 0; k < st.outline8.sides; k++) {
              const d0 = st.outline8.dirs[k];
              const proj0 = dx * d0.x + dy * d0.y;
              if (proj0 > st.outline8.maxProj[k]) {
                st.outline8.maxProj[k] = proj0;
                st.outline8.bestX[k] = x;
                st.outline8.bestY[k] = y;
              }
            }
            for (let k = 0; k < st.outline6.sides; k++) {
              const d1 = st.outline6.dirs[k];
              const proj1 = dx * d1.x + dy * d1.y;
              if (proj1 > st.outline6.maxProj[k]) {
                st.outline6.maxProj[k] = proj1;
                st.outline6.bestX[k] = x;
                st.outline6.bestY[k] = y;
              }
            }
          }
        }
      }
    }
  }

  if (!anyPixel) {
    minX = 0;
    minY = 0;
    maxX = frameW - 1;
    maxY = frameH - 1;
  }

  let lifted = maxY - FOOT_LIFT_PX;
  if (lifted < 0) lifted = 0;

  function chooseOutline(st) {
    const outline8Pts = [];
    for (let k = 0; k < st.outline8.sides; k++) {
      outline8Pts.push([st.outline8.bestX[k] | 0, st.outline8.bestY[k] | 0]);
    }
    const outline6Pts = [];
    for (let k = 0; k < st.outline6.sides; k++) {
      outline6Pts.push([st.outline6.bestX[k] | 0, st.outline6.bestY[k] | 0]);
    }

    const area8 = polygonArea(outline8Pts);
    const area6 = polygonArea(outline6Pts);
    let outline = outline8Pts;
    let outlineSides = OUTLINE_SIDES_PRIMARY;
    if (area8 > 0) {
      const diffPct = Math.abs(area8 - area6) / area8;
      if (diffPct <= OUTLINE_SIMILARITY_PCT) {
        outline = outline6Pts;
        outlineSides = OUTLINE_SIDES_ALT;
      }
    } else if (outline6Pts.length >= 3) {
      outline = outline6Pts;
      outlineSides = OUTLINE_SIDES_ALT;
    }

    return { outline, outlineSides };
  }

  const picked = chooseOutline({ outline8, outline6 });
  const outline = picked.outline;
  const outlineSides = picked.outlineSides;

  const centerOutX = Math.round((minX + maxX) / 2);
  const centerOutY = Math.round((minY + maxY) / 2);

  const out = {
    frameW,
    frameH,
    footBottom: lifted,
    outline,
    outlineSides,
    minX,
    minY,
    maxX,
    maxY,
    centerX: centerOutX,
    centerY: centerOutY
  };

  const dirsOut = {};
  for (const dir of dirOrder) {
    if (!dirAny[dir]) continue;
    const st = dirStates[dir];
    const dMinX = st.minX;
    const dMinY = st.minY;
    const dMaxX = st.maxX;
    const dMaxY = st.maxY;
    const dCenterX = Math.round((dMinX + dMaxX) / 2);
    const dCenterY = Math.round((dMinY + dMaxY) / 2);
    let dLifted = dMaxY - FOOT_LIFT_PX;
    if (dLifted < 0) dLifted = 0;
    const pickedDir = chooseOutline(st);
    dirsOut[dir] = {
      frameW,
      frameH,
      footBottom: dLifted,
      outline: pickedDir.outline,
      outlineSides: pickedDir.outlineSides,
      minX: dMinX,
      minY: dMinY,
      maxX: dMaxX,
      maxY: dMaxY,
      centerX: dCenterX,
      centerY: dCenterY
    };
  }

  if (Object.keys(dirsOut).length > 0) {
    out.dirs = dirsOut;
  }

  return out;
}

function listAuraPngs() {
  const out = [];
  for (const dir of AURA_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".png"));
    for (const file of files) {
      out.push({ dir, file, full: path.join(dir, file) });
    }
  }
  return out;
}

function main() {
  const entries = listAuraPngs();
  if (entries.length === 0) {
    console.error(`[genMonsterAuraFeet] No aura PNGs found in: ${AURA_DIRS.join(", ")}`);
    process.exit(1);
  }
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

  const byId = new Map();
  const seenAny = new Set();
  const seenR0 = new Set();
  for (const entry of entries) {
    const base = entry.file.replace(/\.png$/i, "");
    const meta = parseAuraMeta(base);
    if (!meta) continue;
    seenAny.add(meta.id);
    if (meta.radius === 0) {
      seenR0.add(meta.id);
      const list = byId.get(meta.id) || [];
      list.push({ ...meta, file: entry.file, full: entry.full });
      byId.set(meta.id, list);
    }
  }

  const missingR0 = [];
  for (const id of seenAny) {
    if (!seenR0.has(id)) missingR0.push(id);
  }
  if (missingR0.length) {
    console.error(`[genMonsterAuraFeet] ERROR missing r0 aura for ${missingR0.length} monster(s): ${missingR0.join(", ")}`);
    process.exit(1);
  }

  const phaseRank = (m) => (m.hasWalk ? 0 : (m.hasAttack ? 1 : (m.hasDeath ? 2 : 3)));
  const compareEntry = (a, b) => {
    const pa = phaseRank(a);
    const pb = phaseRank(b);
    if (pa !== pb) return pa - pb;
    const da = a.hasDirs ? 0 : 1;
    const db = b.hasDirs ? 0 : 1;
    if (da !== db) return da - db;
    return a.baseName.localeCompare(b.baseName);
  };

  for (const [id, list] of byId.entries()) {
    if (!list || list.length === 0) continue;
    list.sort(compareEntry);
    const chosen = list[0];
    if (!OVERWRITE_ALL && out[id] && Array.isArray(out[id].outline)) {
      continue; // already have entry with outline
    }
    try {
      const info = findFoot(chosen.baseName, chosen.full, chosen);
      out[id] = info;
      console.log("[genMonsterAuraFeet] ", id, "->", info);
    } catch (e) {
      console.warn("[genMonsterAuraFeet] failed for", chosen.file, e);
    }
  }

  const lines = [];
  lines.push("// AUTO-GENERATED by scripts/genMonsterAuraFeet.mjs");
  lines.push("export const MONSTER_AURA_FOOT_LIFT_PX = " + FOOT_LIFT_PX + ";");
  lines.push("export const MONSTER_AURA_OUTLINE_SIDES_PRIMARY = " + OUTLINE_SIDES_PRIMARY + ";");
  lines.push("export const MONSTER_AURA_OUTLINE_SIDES_ALT = " + OUTLINE_SIDES_ALT + ";");
  lines.push("export const MONSTER_AURA_OUTLINE_SIMILARITY_PCT = " + OUTLINE_SIMILARITY_PCT + ";");
  lines.push("export const MONSTER_AURA_FEET: Record<string, { frameW: number; frameH: number; footBottom: number; outline: number[][]; outlineSides: number; minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number; dirs?: Record<string, { frameW: number; frameH: number; footBottom: number; outline: number[][]; outlineSides: number; minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number; }>; }> = " + JSON.stringify(out, null, 2) + ";");
  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  fs.writeFileSync(OUT_TS, lines.join("\n") + "\n", "utf8");
  console.log("Wrote", OUT_TS);
}

main();
