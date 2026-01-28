import fs from "fs";

const SRC = "src/vfxPalettes.ts";
const OUT = "src/vfxEnemyPalettes.ts";
const MIN_PCT = 0;
const MAX_PCT = 20;

const text = fs.readFileSync(SRC, "utf8");
const heroBlock = /export const HERO_EFFECT_PALETTES[\s\S]*?=\s*\{([\s\S]*?)\n\};/m.exec(text);
if (!heroBlock) throw new Error("HERO_EFFECT_PALETTES not found");
const body = heroBlock[1];
const hero = {};
for (const line of body.split(/\n/)) {
  const m = /^\s*(\w+)\s*:\s*\[(.*?)\]\s*,?\s*$/.exec(line.trim());
  if (!m) continue;
  const key = m[1];
  const arr = m[2].split(",").map((s) => s.trim()).filter(Boolean).map((h) => parseInt(h, 16));
  hero[key] = arr;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function adjust(hex, pct) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const { h, s, l } = rgbToHsl(r, g, b);
  const l2 = Math.min(1, Math.max(0, l * (1 - pct / 100)));
  const s2 = Math.min(1, Math.max(0, s * (1 - pct / 200)));
  const { r: rr, g: gg, b: bb } = hslToRgb(h, s2, l2);
  return (rr << 16) | (gg << 8) | bb;
}

const variants = {};
for (let pct = MIN_PCT; pct <= MAX_PCT; pct++) {
  const per = {};
  for (const key of Object.keys(hero)) {
    per[key] = hero[key].map((hex) => adjust(hex, pct));
  }
  variants[pct] = per;
}

let out = "";
out += "import type { VfxElementKey } from \"./vfxPalettes\";\n\n";
out += `export const ENEMY_EFFECT_PALETTES_BY_DARKEN_PCT: Record<number, Record<VfxElementKey, number[]>> = {\n`;
for (let pct = MIN_PCT; pct <= MAX_PCT; pct++) {
  out += `  ${pct}: {\n`;
  const per = variants[pct];
  for (const key of Object.keys(per)) {
    const arr = per[key].map((v) => "0x" + v.toString(16).padStart(6, "0").toUpperCase());
    out += `    ${key}: [${arr.join(", ")}],\n`;
  }
  out += "  },\n";
}
out += "};\n";

fs.writeFileSync(OUT, out, "utf8");
console.log(`[gen-enemy-palettes] wrote ${OUT}`);
