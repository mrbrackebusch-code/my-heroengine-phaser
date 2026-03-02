import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const TILE_SIZE = 32;

const sourcePngPath = path.resolve("assets/tiles/ProjectUtumno_supplemental.png");
const outputDir = path.resolve("src/student/Hanna/assets/relics");

const relicTileMap = {
    hanna_legend_relic_32x32: { x: 62, y: 22 },
    hanna_combo_relic_32x32: { x: 38, y: 20 },
    hanna_guardian_relic_32x32: { x: 25, y: 21 },
    hanna_swiftness_relic_32x32: { x: 41, y: 40 },
};

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function cropTile(source, tileX, tileY, tileSize) {
    const out = new PNG({ width: tileSize, height: tileSize });
    for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
            const srcX = tileX * tileSize + px;
            const srcY = tileY * tileSize + py;
            const srcIdx = (srcY * source.width + srcX) * 4;
            const dstIdx = (py * tileSize + px) * 4;

            out.data[dstIdx + 0] = source.data[srcIdx + 0];
            out.data[dstIdx + 1] = source.data[srcIdx + 1];
            out.data[dstIdx + 2] = source.data[srcIdx + 2];
            out.data[dstIdx + 3] = source.data[srcIdx + 3];
        }
    }
    return out;
}

function countOpaquePixels(png, alphaThreshold = 20) {
    let opaque = 0;
    for (let index = 3; index < png.data.length; index += 4) {
        if (png.data[index] > alphaThreshold) opaque++;
    }
    return opaque;
}

function main() {
    if (!fs.existsSync(sourcePngPath)) {
        throw new Error(`Missing source sheet: ${sourcePngPath}`);
    }

    ensureDir(outputDir);

    const source = PNG.sync.read(fs.readFileSync(sourcePngPath));
    const cols = Math.floor(source.width / TILE_SIZE);
    const rows = Math.floor(source.height / TILE_SIZE);

    for (const [assetBaseName, coord] of Object.entries(relicTileMap)) {
        const { x, y } = coord;
        if (x < 0 || y < 0 || x >= cols || y >= rows) {
            throw new Error(`Tile out of bounds for ${assetBaseName}: (${x}, ${y}) in ${cols}x${rows}`);
        }

        const tile = cropTile(source, x, y, TILE_SIZE);
        const opaque = countOpaquePixels(tile);

        if (opaque <= 0) {
            throw new Error(`Tile for ${assetBaseName} at (${x}, ${y}) is fully transparent`);
        }

        const outPath = path.join(outputDir, `${assetBaseName}.png`);
        fs.writeFileSync(outPath, PNG.sync.write(tile));
        console.log(`[extractUtumnoRelics] wrote ${path.relative(process.cwd(), outPath)} from tile (${x}, ${y}) opaque=${opaque}`);
    }
}

main();
