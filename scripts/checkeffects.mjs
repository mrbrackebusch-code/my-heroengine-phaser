import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT_DIR = path.resolve("assets/effects");
const SIZE_RE = /^(.*?)(?:\s+)(\d+)x(\d+)$/i;

const missingSize = [];
const duplicateIds = new Map();
const badDivisible = [];
const checked = [];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name.toLowerCase() === "auras") continue;
            walk(full);
            continue;
        }
        if (!ent.isFile()) continue;
        if (!ent.name.toLowerCase().endsWith(".png")) continue;
        checked.push(full);

        const base = ent.name.slice(0, -4);
        const match = SIZE_RE.exec(base);
        if (!match) {
            missingSize.push(ent.name);
            continue;
        }

        const id = String(match[1] || "").trim();
        const frameW = parseInt(match[2], 10) | 0;
        const frameH = parseInt(match[3], 10) | 0;
        if (!id || frameW <= 0 || frameH <= 0) {
            missingSize.push(ent.name);
            continue;
        }

        if (duplicateIds.has(id)) {
            duplicateIds.get(id).push(ent.name);
        } else {
            duplicateIds.set(id, [ent.name]);
        }

        try {
            const buf = fs.readFileSync(full);
            const png = PNG.sync.read(buf);
            const w = png.width | 0;
            const h = png.height | 0;
            if (w <= 0 || h <= 0 || (w % frameW) !== 0 || (h % frameH) !== 0) {
                badDivisible.push({
                    file: ent.name,
                    size: `${w}x${h}`,
                    frame: `${frameW}x${frameH}`
                });
            }
        } catch (err) {
            badDivisible.push({
                file: ent.name,
                size: "unreadable",
                frame: `${frameW}x${frameH}`,
                error: String(err && err.message ? err.message : err)
            });
        }
    }
}

if (!fs.existsSync(ROOT_DIR)) {
    console.error(`[check-effects] missing folder: ${ROOT_DIR}`);
    process.exit(1);
}

walk(ROOT_DIR);

const issues = [];

if (missingSize.length) {
    issues.push(
        `[check-effects] missing size in filename (use \"<name> WxH.png\"): ${missingSize.join(", ")}`
    );
}

const dupList = [];
for (const [id, files] of duplicateIds.entries()) {
    if (files.length > 1) dupList.push(`${id} => ${files.join(" | ")}`);
}
if (dupList.length) {
    issues.push(`[check-effects] duplicate effect ids: ${dupList.join(" ; ")}`);
}

if (badDivisible.length) {
    const detail = badDivisible.map(entry => {
        const extra = entry.error ? ` err=${entry.error}` : "";
        return `${entry.file} (size=${entry.size}, frame=${entry.frame})${extra}`;
    });
    issues.push(`[check-effects] sheet not divisible by frame size: ${detail.join(" ; ")}`);
}

if (issues.length) {
    for (const line of issues) console.error(line);
    process.exit(1);
}

console.log(`[check-effects] ok (${checked.length} files)`);
