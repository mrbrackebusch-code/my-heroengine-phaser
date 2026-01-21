// scripts/addHeroProfile.mjs
// Copy a hero sheet into assets/heroes and generate auras for that file only.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HERO_DIR = path.join(ROOT, "assets", "heroes");
const AURA_SCRIPT = path.join(ROOT, "scripts", "genheroauras.mjs");

function usage() {
  console.log("Usage: node scripts/addHeroProfile.mjs <path-to-hero.png> [--name ProfileName] [--force]");
  console.log("  - If the file is already named <ProfileName>Hero.png, --name is optional.");
}

function parseArgs(argv) {
  const out = { file: "", name: "", force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === "--name" || a === "--profile") {
      out.name = String(argv[i + 1] || "").trim();
      i++;
      continue;
    }
    if (a === "--force") {
      out.force = true;
      continue;
    }
    if (!out.file) {
      out.file = a;
      continue;
    }
  }
  return out;
}

function pickProfileName(filePath, nameOverride) {
  if (nameOverride) return nameOverride.trim();
  const base = path.basename(filePath);
  const m = base.match(/^(.+?)Hero\.png$/i);
  if (m && m[1]) return m[1].trim();
  return "";
}

function main() {
  const { file, name, force } = parseArgs(process.argv.slice(2));
  if (!file) {
    usage();
    process.exit(1);
  }

  const src = path.resolve(ROOT, file);
  if (!fs.existsSync(src)) {
    console.error(`[add-hero] file not found: ${src}`);
    process.exit(1);
  }

  const profileName = pickProfileName(src, name);
  if (!profileName) {
    console.error("[add-hero] profile name missing. Use --name or name the file <ProfileName>Hero.png");
    process.exit(1);
  }

  const destName = `${profileName}Hero.png`;
  const dest = path.join(HERO_DIR, destName);
  if (fs.existsSync(dest) && !force) {
    console.error(`[add-hero] destination already exists: ${dest}`);
    console.error("Use --force to overwrite.");
    process.exit(1);
  }

  fs.mkdirSync(HERO_DIR, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[add-hero] copied ${src} -> ${dest}`);

  const res = spawnSync("node", [AURA_SCRIPT, "--file", dest], { stdio: "inherit" });
  if (res.status !== 0) {
    console.error("[add-hero] aura generation failed");
    process.exit(res.status || 1);
  }

  console.log(`[add-hero] done. New profile: ${profileName}`);
  console.log("[add-hero] If the server is running, it should pick up the new profile automatically.");
  console.log("[add-hero] Refresh the browser to load the new sprite sheet.");
}

main();
