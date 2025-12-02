/* 
  arcadeCompat.ts
  Minimal MakeCode Arcade-style compat layer to let HeroEngine + extensions compile.
  Step 1: get things compiling.
  Step 2: wire these stubs to Phaser / real game loop.
*/



// MakeCode Arcade 16-color palette
// 0 is *transparent*; 15 is black
const MAKECODE_PALETTE: number[][] = [
    [0, 0, 0],         // 0 - transparent (we will not draw this)
    [255, 255, 255],   // 1 - #FFFFFF
    [255, 33, 33],     // 2 - #FF2121
    [255, 147, 196],   // 3 - #FF93C4
    [255, 129, 53],    // 4 - #FF8135
    [255, 246, 9],     // 5 - #FFF609
    [36, 156, 163],    // 6 - #249CA3
    [120, 220, 82],    // 7 - #78DC52
    [0, 63, 173],      // 8 - #003FAD
    [135, 242, 255],   // 9 - #87F2FF
    [142, 46, 196],    // 10 - #8E2EC4
    [164, 131, 159],   // 11 - #A4839F
    [92, 64, 108],     // 12 - #5C406C
    [229, 205, 196],   // 13 - #E5CDC4
    [145, 70, 61],     // 14 - #91463D
    [0, 0, 0]          // 15 - #000000
];


/* -------------------------------------------------------
   Basic helpers
------------------------------------------------------- */

function randint(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Extend Math with idiv
interface Math {
    idiv(a: number, b: number): number;
}
(Math as any).idiv = (a: number, b: number): number => (a / b) | 0;


interface Math {
    randomRange(min: number, max: number): number;
}

(Math as any).randomRange = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;



/* -------------------------------------------------------
   Image + image namespace
------------------------------------------------------- */

class Image {
    width: number;
    height: number;
    // simple RGBA-less pixel buffer: palette index per pixel
    private _pixels: Uint8Array;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this._pixels = new Uint8Array(width * height);
    }

    private idx(x: number, y: number): number {
        return y * this.width + x;
    }

    fill(color: number): void {
        this._pixels.fill(color & 0xff);
    }

    fillRect(x: number, y: number, w: number, h: number, color: number): void {
        const c = color & 0xff;
        for (let yy = y; yy < y + h; yy++) {
            if (yy < 0 || yy >= this.height) continue;
            for (let xx = x; xx < x + w; xx++) {
                if (xx < 0 || xx >= this.width) continue;
                this._pixels[this.idx(xx, yy)] = c;
            }
        }
    }

    getPixel(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this._pixels[this.idx(x, y)];
    }

    setPixel(x: number, y: number, color: number): void {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this._pixels[this.idx(x, y)] = color & 0xff;
    }


        // MakeCode compatibility: draw a line between two points
    drawLine(x0: number, y0: number, x1: number, y1: number, color: number): void {
        const c = color & 0xff;

        let dx = Math.abs(x1 - x0);
        let sx = x0 < x1 ? 1 : -1;
        let dy = -Math.abs(y1 - y0);
        let sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            this.setPixel(x0, y0, c);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }





    // Very crude text printing; can be improved later.
    print(text: string, x: number, y: number, color: number, font: image.Font): void {
        // TODO: implement proper bitmap font rendering.
        // For now, no-op for compile; HeroEngine logic won’t break.
    }
}

namespace image {
    export class Font {
        charWidth: number;
        charHeight: number;
        constructor(w: number, h: number) {
            this.charWidth = w;
            this.charHeight = h;
        }
    }

    // Simple default fonts
    export const font5 = new Font(4, 6);
    export const font8 = new Font(6, 8);

    export function create(width: number, height: number): Image {
        return new Image(width, height);
    }

    export function getFontForText(_text: string): Font {
        // Simple heuristic stub: just return font8.
        return font8;
    }

    export function scaledFont(base: Font, scale: number): Font {
        // NOTE: MakeCode returns a scaled font; we just fudge for now.
        return new Font(base.charWidth * scale, base.charHeight * scale);
    }
}


/* -------------------------------------------------------
   MakeCode img`` tagged template shim
------------------------------------------------------- */

function imgOLD(strings: TemplateStringsArray, ...expr: any[]): Image {
    // Turn the MakeCode ASCII image literal into an Image instance.
    // STEP 1: read raw text
    const raw = strings.join("");
    const lines = raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

    // STEP 2: determine width & height
    const height = lines.length;
    const width = Math.max(...lines.map(l => l.length));

    const im = new Image(width, height);

    // STEP 3: naive fill — actual   comes later
    // Right now: treat '.' as 0, anything else as 1
    for (let y = 0; y < height; y++) {
        const row = lines[y];
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            // TODO: full MakeCode palette parsing later
            if (ch === "." || ch === " ") im.setPixel(x, y, 0);
            else im.setPixel(x, y, 1);
        }
    }

    return im;
}

function parseMakeCodeImage(lit: TemplateStringsArray): Image {
    const raw = lit[0]
        .trim()
        .replace(/\r/g, "");

    const rows = raw
        .split("\n")
        .map(r => r.trim())
        .filter(r => r.length > 0);

    const height = rows.length;

    // PARSE EACH ROW TO A LIST OF PIXEL TOKENS
    const pixelRows: string[][] = [];

    for (const row of rows) {
        let tokens: string[] = [];

        if (row.includes(" ")) {
            // FORMAT A: space-separated
            tokens = row.split(/\s+/);
        } else {
            // FORMAT B: compact format
            // split into individual characters
            tokens = row.split("");
        }

        pixelRows.push(tokens);
    }

    // WIDTH = max row width (MakeCode allows uneven rows)
    const width = Math.max(...pixelRows.map(r => r.length));

    const img = new Image(width, height);
    img._pixels = [];

    for (const row of pixelRows) {
        for (let i = 0; i < width; i++) {
            const c = row[i];

            if (!c || c === ".") {
                img._pixels.push(-1);
            } else {
                const val = parseInt(c, 16);
                img._pixels.push(isNaN(val) ? 0 : val);
            }
        }
    }

    return img;
}



/* -------------------------------------------------------
   MakeCode Math.constrain shim
------------------------------------------------------- */

;(Math as any).constrain = function (v: number, min: number, max: number): number {
    if (v < min) return min;
    if (v > max) return max;
    return v;
};




// -------------------------------------------------------
// Polyfill for MakeCode's Array.removeAt(index)
// JS Array doesn't have this; we add a compatible version.
// -------------------------------------------------------
if (!(Array.prototype as any).removeAt) {
    (Array.prototype as any).removeAt = function (index: number) {
        // MakeCode coerces index to int and ignores out-of-range.
        index = index | 0;
        if (index < 0 || index >= this.length) return undefined;

        const removed = this.splice(index, 1);
        return removed.length ? removed[0] : undefined;
    };
}






/* -------------------------------------------------------
   SpriteKind + flags + Sprite
------------------------------------------------------- */

namespace SpriteKind {
    let _next = 10;
    export const Player = 1;
    export const Enemy = 2;
    export function create(): number {
        return _next++;
    }
    // Your game / extensions will add:
    export let Hero: number;
    export let HeroWeapon: number;
    export let HeroAura: number;
    export let EnemySpawner: number;
    export let SupportBeam: number;
    export let SupportIcon: number;
    export let Text: number;
    export let StatusBar: number;
}

const enum SpriteFlag {
    Ghost = 1 << 0,
    RelativeToCamera = 1 << 1,
    AutoDestroy = 1 << 2,
    Invisible = 1 << 3,
    Destroyed = 1 << 4  // add this
}

const enum CollisionDirection {
    Top,
    Bottom,
    Left,
    Right
}

class Sprite {
    // NEW: unique id per sprite
    private static _nextId = 1;
    id: number;
    
    x: number = 0;
    y: number = 0;
    vx: number = 0;
    vy: number = 0;
    z: number = 0;


    image: Image;

    // MakeCode compatibility: width/height mirror the image dimensions
    get width(): number {
        return this.image ? this.image.width : 0;
    }

    get height(): number {
        return this.image ? this.image.height : 0;
    }


    // 🔧 NEW: MakeCode compatibility helper
    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        // We let _syncNativeSprites() push this into Phaser each frame.
    }

    kind: number = SpriteKind.Player;




    flags: number = 0;
    data: { [key: string]: any } = {};
    lifespan: number = 0;
    // Used by status-bars/text.ts:
    followPadding: number = 0;
    
    // NEW: link to a Phaser display object
    native: any = null;

    constructor(img: Image, kind: number) {
        this.id = Sprite._nextId++;  // 🔴 this was missing

        this.image = img;
        this.kind = kind;

        // Debug: prove IDs are being assigned
        if (this.id <= 20) {
            console.log(
                "[Sprite.constructor] created sprite",
                "id=", this.id,
                "kind=", this.kind,
                "img w,h=", img.width, img.height
            );
        }
    }


    setFlag(flag: SpriteFlag, on: boolean): void {
        if (on) this.flags |= flag;
        else this.flags &= ~flag;
    }



setImage(img: Image): void {
    this.image = img;

    // DO NOT destroy or remove textures here.
    // _syncNativeSprites + _attachNativeSprite will re-upload the pixels
    // from this.image into the existing canvas texture each frame.
    if (DEBUG_SPRITE_ATTACH && this.id <= 40) {
        console.log(
            "[Sprite.setImage]",
            "id=", this.id,
            "kind=", this.kind,
            "newImg w,h=",
            img.width, img.height
        );
    }
}



    setKind(kind: number): void {
        this.kind = kind;
    }




destroy(effect?: number, durationMs?: number): void {
    this.flags |= SpriteFlag.Destroyed;
    this._destroyed = true;

    if (DEBUG_SPRITE_ATTACH && this.id <= 40) {
        console.log("[Sprite.destroy] id=", this.id, "kind=", this.kind);
    }
}



    startEffect(effect: number, durationMs: number): void {
        // TODO: hook into Phaser particles / tweens later.
        // No-op for now.
    }

    // Simple bounding-box helpers for status-bars.
    get top(): number {
        return this.y - (this.image?.height ?? 0) / 2;
    }
    set top(v: number) {
        const h = this.image?.height ?? 0;
        this.y = v + h / 2;
    }

    get bottom(): number {
        return this.y + (this.image?.height ?? 0) / 2;
    }
    set bottom(v: number) {
        const h = this.image?.height ?? 0;
        this.y = v - h / 2;
    }

    get left(): number {
        return this.x - (this.image?.width ?? 0) / 2;
    }
    set left(v: number) {
        const w = this.image?.width ?? 0;
        this.x = v + w / 2;
    }

    get right(): number {
        return this.x + (this.image?.width ?? 0) / 2;
    }
    set right(v: number) {
        const w = this.image?.width ?? 0;
        this.x = v - w / 2;
    }

    // internal destroyed flag – not part of MakeCode API but handy.
    _destroyed: boolean = false;
}

/* -------------------------------------------------------
   sprites namespace – creation, projectile, data, events
------------------------------------------------------- */

namespace sprites {
    export const Flag = SpriteFlag;
    const _allSprites: Sprite[] = [];
    // ---- DEBUG CONTROLS ----
    let _syncCallCount = 0;
    let _attachCallCount = 0;

    const MAX_SYNC_VERBOSE = 5;    // fully log first 60 frames
    const SYNC_EVERY_N_AFTER = 300;  // then log every 30th frame

    const MAX_ATTACH_VERBOSE = 20;  // log first 50 sprite attach attempts

    type OverlapHandler = (a: Sprite, b: Sprite) => void;
    type DestroyHandler = (s: Sprite) => void;

    const _overlapHandlers: { a: number; b: number; handler: OverlapHandler }[] = [];
    const _destroyHandlers: { kind: number; handler: DestroyHandler }[] = [];

    let _debugFirstPlaced = false;





function _attachNativeSprite(s: Sprite): void {
    const sc: Phaser.Scene = (globalThis as any).__phaserScene;
    _attachCallCount++;

    if (!sc) {
        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log("[_attachNativeSprite] NO SCENE — skipping for sprite", s.id);
        }
        return;
    }

    if (!s.image) {
        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log("[_attachNativeSprite] sprite has NO image", s);
        }
        return;
    }

    const w = s.image.width;
    const h = s.image.height;
    const texKey = "sprite_" + s.id;

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        console.error(
            "[_attachNativeSprite] INVALID image size – skipping texture",
            "spriteId=", s.id,
            "kind=", s.kind,
            "w=", w,
            "h=", h,
            "image=", s.image
        );
        return;
    }

    if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
        console.log(
            "[_attachNativeSprite] START",
            "spriteId=", s.id,
            "w,h=", w, h,
            "pixelsLen=", w * h
        );
    }

    // --- Get or create CanvasTexture + canvas + ctx ---
    let tex: any = null;
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;

    if (sc.textures.exists(texKey)) {
        // Expect a CanvasTexture from addCanvas
        tex = sc.textures.get(texKey) as any;

        if (tex && tex.canvas && typeof tex.canvas.getContext === "function") {
            canvas = tex.canvas as HTMLCanvasElement;

            // Resize if MakeCode image size changed
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            ctx = canvas.getContext("2d")!;
        } else {
            // Phaser gave us __MISSING or some non-canvas texture – recreate properly
            console.warn(
                "[_attachNativeSprite] existing texture has no valid canvas for",
                texKey,
                tex
            );

            sc.textures.remove(texKey);

            canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            ctx = canvas.getContext("2d")!;

            tex = sc.textures.addCanvas(texKey, canvas);
            if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
                console.log("[_attachNativeSprite] Texture CREATED (replaced bad):", texKey);
            }
        }
    } else {
        // First time for this sprite id
        canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext("2d")!;

        tex = sc.textures.addCanvas(texKey, canvas);
        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log("[_attachNativeSprite] Texture CREATED:", texKey);
        }
    }

    if (!ctx) {
        console.error("[_attachNativeSprite] no 2D context for", texKey);
        return;
    }

    // --- Rebuild pixel data from MakeCode image ---
    const imgData = ctx.createImageData(w, h);
    const palette = MAKECODE_PALETTE as any[];
    const pixelsLen = w * h;

    for (let i = 0; i < pixelsLen; i++) {
        const x = i % w;
        const y = (i / w) | 0;
        const idx = i * 4;

        const p = s.image.getPixel(x, y);  // 0–15 in Arcade

        // Treat 0 as transparent, like Arcade sprites
        if (p <= 0) {
            imgData.data[idx + 0] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 0;
            continue;
        }

        const color = palette[p];
        if (!color) {
            if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
                console.error(
                    "[_attachNativeSprite] BAD PALETTE INDEX",
                    "spriteId=", s.id,
                    "kind=", s.kind,
                    "img w,h=", w, h,
                    "pixelsLen=", pixelsLen,
                    "i=", i,
                    "x=", x,
                    "y=", y,
                    "p=", p,
                    "paletteLength=", palette.length
                );
            }

            imgData.data[idx + 0] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 0;
            continue;
        }

        const [r, g, b] = color;
        imgData.data[idx + 0] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    // Ensure Phaser updates the texture in WebGL
    if (tex && typeof tex.refresh === "function") {
        tex.refresh();
    }

    // --- Create the Phaser.Image once, then reuse it ---
    if (!s.native) {
        try {
            s.native = sc.add.image(s.x, s.y, texKey);
            s.native.setOrigin(0.5, 0.5);
            if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
                console.log("[_attachNativeSprite] Phaser image added", texKey);
            }
        } catch (e) {
            console.error("[_attachNativeSprite] ERROR creating Phaser image:", e);
        }
    }
}





    
        // NEW: simple physics integrator – apply vx,vy to x,y
    export function _physicsStep(dtSeconds: number): void {
        if (!dtSeconds || dtSeconds <= 0) return;

        for (const s of _allSprites) {
            if (!s || (s as any)._destroyed) continue;
            if (!s.vx && !s.vy) continue;

            s.x += s.vx * dtSeconds;
            s.y += s.vy * dtSeconds;
        }
    }

    export function create(img: Image, kind: number): Sprite {
        const s = new Sprite(img, kind);
        _allSprites.push(s);
        
        console.log(
        "[sprites.create] kind=",
        kind,
        "w=",
        img?.width,
        "h=",
        img?.height
        );

        _attachNativeSprite(s);
        return s;
    }

    export function createProjectileFromSprite(img: Image, source: Sprite, vx: number, vy: number): Sprite {
        const s = new Sprite(img, SpriteKind.Enemy); // kind will usually be overridden in your code
        s.x = source.x;
        s.y = source.y;
        s.vx = vx;
        s.vy = vy;
        _allSprites.push(s);
        
        console.log(
        "[createProjectileFromSprite] from kind=",
        source.kind,
        "proj w=",
        img?.width,
        "h=",
        img?.height
        );

        _attachNativeSprite(s);
        return s;
    }



        // Simple physics integrator: apply vx,vy to x,y
        export function _physicsStep(dtSeconds: number): void {
            if (!dtSeconds || dtSeconds <= 0) return;

            for (const s of _allSprites) {
                if (!s || (s as any)._destroyed) continue;
                if (!s.vx && !s.vy) continue;

                s.x += s.vx * dtSeconds;
                s.y += s.vy * dtSeconds;
            }
        }





export function _syncNativeSprites(): void {
    _syncCallCount++;

    const sc: Phaser.Scene = (globalThis as any).__phaserScene;
    const shouldLog = _syncCallCount % SPRITE_SYNC_LOG_MOD === 0;

    if (shouldLog) {
        console.log(
            "[_syncNativeSprites]",
            "call#", _syncCallCount,
            "scenePresent=", !!sc,
            "spriteCount=", _allSprites.length
        );
    }

    if (!sc) {
        if (shouldLog) {
            console.log("[_syncNativeSprites] no scene yet");
        }
        return;
    }

    // Walk backwards so we can safely splice destroyed sprites
    for (let i = _allSprites.length - 1; i >= 0; i--) {
        const s = _allSprites[i];

        // Clean up destroyed sprites: remove native + texture + from array
        if (s._destroyed) {
            if (s.native && s.native.destroy) {
                try {
                    s.native.destroy();
                } catch (e) {
                    console.warn("[_syncNativeSprites] error destroying native", s.id, e);
                }
            }
            s.native = null;

            // Remove canvas texture so future sprites with same id get a fresh one
            const texKey = "sprite_" + s.id;
            if (sc.textures && sc.textures.exists(texKey)) {
                sc.textures.remove(texKey);
            }

            // Actually drop the sprite from our list
            _allSprites.splice(i, 1);

            if (shouldLog) {
                console.log(
                    "[_syncNativeSprites] removed destroyed sprite",
                    "id=", s.id,
                    "remainingSprites=", _allSprites.length
                );
            }
            continue;
        }

        // Normal live sprite path
        _attachNativeSprite(s);

        if (s.native) {
            s.native.x = s.x;
            s.native.y = s.y;
        }
    }
}






    // Debug helper: dump all sprite + native info once on demand
    export function _debugDumpSprites(label: string = ""): void {
        console.log("========== SPRITE DUMP", label, "==========");
        console.log("total sprites =", _allSprites.length);

        for (const s of _allSprites) {
            console.log({
                id: s.id,
                kind: s.kind,
                x: s.x,
                y: s.y,
                imageWidth: s.image && s.image.width,
                imageHeight: s.image && s.image.height,
                hasPixels: !!(s.image && (s.image as any)._pixels),
                nativeType: s.native && s.native.type,
                nativeTextureKey: s.native && s.native.texture && s.native.texture.key
            });
        }
        console.log("===========================================");
    }



    // sprite-data extension surface
    export function setDataNumber(s: Sprite, key: number | string, value: number): void {
        s.data[String(key)] = value;
    }
    export function readDataNumber(s: Sprite, key: number | string): number {
        const v = s.data[String(key)];
        return typeof v === "number" ? v : 0;
    }
    export function changeDataNumberBy(s: Sprite, key: number | string, delta: number): void {
        const k = String(key);
        const current = typeof s.data[k] === "number" ? s.data[k] : 0;
        s.data[k] = current + delta;
    }

    export function setDataString(s: Sprite, key: number | string, value: string): void {
        s.data[String(key)] = value;
    }
    export function readDataString(s: Sprite, key: number | string): string {
        const v = s.data[String(key)];
        return typeof v === "string" ? v : "";
    }

    export function setDataBoolean(s: Sprite, key: number | string, value: boolean): void {
        s.data[String(key)] = value;
    }
    export function readDataBoolean(s: Sprite, key: number | string): boolean {
        const v = s.data[String(key)];
        return !!v;
    }

    export function setDataSprite(s: Sprite, key: number | string, value: Sprite): void {
        s.data[String(key)] = value;
    }
    export function readDataSprite(s: Sprite, key: number | string): Sprite {
        const v = s.data[String(key)];
        return v instanceof Sprite ? v : null;
    }

    export function setDataImage(s: Sprite, key: number | string, value: Image): void {
        s.data[String(key)] = value;
    }
    export function readDataImage(s: Sprite, key: number | string): Image {
        const v = s.data[String(key)];
        return v instanceof Image ? v : null;
    }

    // event hooks – logic only, no real collision detection yet
    export function onOverlap(kindA: number, kindB: number, handler: (a: Sprite, b: Sprite) => void): void {
        _overlapHandlers.push({ a: kindA, b: kindB, handler });
    }

    export function onDestroyed(kind: number, handler: (s: Sprite) => void): void {
        _destroyHandlers.push({ kind, handler });
    }

    // Called from game loop (future Step 2) to process overlaps/destroys.
    export function _processEvents(): void {
        // TODO: implement real collision detection & destroyed callbacks
        // when wired to Phaser. No-op for now.
    }

    export function allSprites(): Sprite[] {
        return _allSprites;
    }
}

/* -------------------------------------------------------
   screen & scene namespaces
------------------------------------------------------- */

namespace screen {
    export let width: number = 320;
    export let height: number = 240;
}


namespace scene {
    export const HUD_Z = 100;
    export const UPDATE_PRIORITY = 10;

    export function setBackgroundColor(colorIndex: number): void {
        const sc: Phaser.Scene = (globalThis as any).__phaserScene;

        if (!sc || !sc.cameras || !sc.cameras.main) {
            console.log("[scene.setBackgroundColor] no Phaser scene yet, colorIndex=", colorIndex);
            return;
        }

        const idx = Math.max(0, Math.min(MAKECODE_PALETTE.length - 1, colorIndex | 0));
        const rgb = MAKECODE_PALETTE[idx] || [0, 0, 0];
        const hex = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

        console.log("[scene.setBackgroundColor] index=", idx, "rgb=", rgb, "hex=", hex.toString(16));

        sc.cameras.main.setBackgroundColor(hex);
    }
}


/* -------------------------------------------------------
   game namespace – time, scene, update handlers
------------------------------------------------------- */

class BasicPhysicsEngine {
    sprites: Sprite[] = [];
    addSprite(s: Sprite): void {
        if (this.sprites.indexOf(s) < 0) this.sprites.push(s);
    }
}

class BasicGameScene {
    physicsEngine = new BasicPhysicsEngine();
    data: { [key: string]: any } = {};
    createdHandlers: ((s: Sprite) => void)[] = [];

    millis(): number {
        return game.runtime();
    }
}

class BasicEventContext {
    // priority not used yet, but stored for future.
    handlers: { priority: number; handler: () => void }[] = [];
    registerFrameHandler(priority: number, handler: () => void): void {
        this.handlers.push({ priority, handler });
    }
}


namespace game {
    const _startTime = Date.now();
    const _scene = new BasicGameScene();
    const _eventContext = new BasicEventContext();
    const _updateHandlers: (() => void)[] = [];
    const _intervalHandlers: { interval: number; last: number; fn: () => void }[] = [];

    let _lastTick = 0;

    export function runtime(): number {
        return Date.now() - _startTime;
    }



    
    export function onUpdate(handler: () => void): void {
        _updateHandlers.push(handler);
    }

    export function onUpdateInterval(intervalMs: number, handler: () => void): void {
        _intervalHandlers.push({ interval: intervalMs, last: runtime(), fn: handler });
    }

    export function currentScene(): BasicGameScene {
        return _scene;
    }

    export function eventContext(): BasicEventContext {
        return _eventContext;
    }
 
 
 
 
 
    // Main engine tick – controllers → physics → user update handlers
    export function _tick(): void {
        const now = runtime();
        if (_lastTick === 0) _lastTick = now;
        const dtMs = now - _lastTick;
        const dtSec = dtMs / 1000;
        _lastTick = now;

        // 0) Update controller-driven velocities (wrapper-only)
        if ((controller as any)._updateAllControllers) {
            (controller as any)._updateAllControllers();
        }

        // 1) Move sprites based on vx,vy
        (sprites as any)._physicsStep(dtSec);

        // 2) Run game.onUpdate + game.onUpdateInterval + event handlers
        for (const h of _updateHandlers) h();
        for (const ih of _intervalHandlers) {
            if (now - ih.last >= ih.interval) {
                ih.last = now;
                ih.fn();
            }
        }
        for (const h of _eventContext.handlers) h.handler();

        // 3) Keep compat sprites and Phaser visuals aligned
        sprites._syncNativeSprites();
    }





}


/* -------------------------------------------------------
   controller namespace – per-player input stubs
------------------------------------------------------- */

namespace controller {
    export interface Button {
        isPressed(): boolean;
    }

    class BasicButton implements Button {
        private _pressed = false;
        isPressed(): boolean {
            return this._pressed;
        }
        _setPressed(v: boolean): void {
            this._pressed = v;
        }
    }

    export interface Controller {
        moveSprite(s: Sprite, vx: number, vy: number): void;
        A: Button;
        B: Button;
        up: Button;
        down: Button;
        left: Button;
        right: Button;
    }

    class BasicController implements Controller {
        A = new BasicButton();
        B = new BasicButton();
        up = new BasicButton();
        down = new BasicButton();
        left = new BasicButton();
        right = new BasicButton();

        // NEW: remember which sprite this controller owns + its base speed
        private _sprite: Sprite | null = null;
        private _speedX: number = 0;
        private _speedY: number = 0;

        moveSprite(s: Sprite, vx: number, vy: number): void {
            // In real MakeCode, this is called repeatedly.
            // In our wrapper, treat it as "bind this sprite + speed to this controller".
            this._sprite = s;
            this._speedX = vx;
            this._speedY = vy;

            // Immediately update once so things respond even before first tick
            this._updateSpriteVelocity();
        }

        // NEW: apply current button state to the bound sprite
        _updateSpriteVelocity(): void {
            const s = this._sprite;
            if (!s) return;

            let dx = 0;
            let dy = 0;
            if (this.left.isPressed()) dx -= 1;
            if (this.right.isPressed()) dx += 1;
            if (this.up.isPressed()) dy -= 1;
            if (this.down.isPressed()) dy += 1;

            s.vx = dx * this._speedX;
            s.vy = dy * this._speedY;
        }
    }

    export const player1: BasicController = new BasicController();
    export const player2: BasicController = new BasicController();
    export const player3: BasicController = new BasicController();
    export const player4: BasicController = new BasicController();



        // Which global player (1–4) this client controls.
        // All keyboard input will apply to THIS controller.
        let _localPlayerSlot = 1; // 1..4

        export function setLocalPlayerSlot(playerId: number): void {
            if (playerId < 1 || playerId > 4) {
                console.warn("[controller.setLocalPlayerSlot] invalid playerId", playerId);
                return;
            }
            _localPlayerSlot = playerId | 0;
            console.log("[controller] local player slot set to", _localPlayerSlot);
        }

        function _getLocalController(): BasicController {
            switch (_localPlayerSlot) {
                case 1: return player1;
                case 2: return player2;
                case 3: return player3;
                case 4: return player4;
                default: return player1;
            }
        }



    
    // NEW: helper for game._tick – update all controllers once per frame
    export function _updateAllControllers(): void {
        (player1 as any)._updateSpriteVelocity();
        (player2 as any)._updateSpriteVelocity();
        (player3 as any)._updateSpriteVelocity();
        (player4 as any)._updateSpriteVelocity();
    }






    let _keyboardWired = false;

    // Send a local input event (button pressed/released) to the network.
    function _sendLocalInput(button: string, pressed: boolean) {
        const net: any = (globalThis as any).__net;
        if (net && typeof net.sendInput === "function") {
            net.sendInput(button, pressed);
        } else {
            // Fallback: no network – apply directly to local controller
            const ctrl = _getLocalController() as any;
            const btn = ctrl[button];
            if (btn && typeof btn._setPressed === "function") {
                btn._setPressed(pressed);
            }
        }
    }

    // Hook Phaser keyboard into the "local" player.
    // SAME keys on every client: arrows + Q/E.
    export function _wireKeyboard(scene: any): void {
        if (_keyboardWired) {
            console.log("[controller._wireKeyboard] already wired, skipping");
            return;
        }
        _keyboardWired = true;

        const kb = scene && scene.input && scene.input.keyboard;
        if (!kb) {
            console.warn("[controller._wireKeyboard] no keyboard plugin on scene", scene);
            return;
        }

        console.log("[controller._wireKeyboard] wiring keyboard controls for LOCAL player (network-aware)");

        function bindKeyToButtonName(key: string, buttonName: string) {
            kb.on("keydown-" + key, () => _sendLocalInput(buttonName, true));
            kb.on("keyup-" + key, () => _sendLocalInput(buttonName, false));
        }

        // Movement: arrows
        bindKeyToButtonName("LEFT",  "left");
        bindKeyToButtonName("RIGHT", "right");
        bindKeyToButtonName("UP",    "up");
        bindKeyToButtonName("DOWN",  "down");

        // Moves: Q/E → A/B
        bindKeyToButtonName("Q", "A");
        bindKeyToButtonName("E", "B");
    }



}




/* -------------------------------------------------------
   effects namespace
------------------------------------------------------- */

namespace effects {
    // Just numeric IDs for now; Sprite.startEffect/destroy interpret them.
    export const trail = 1;
    export const disintegrate = 2;
}

/* -------------------------------------------------------
   End of compat layer
------------------------------------------------------- */
/* -------------------------------------------------------
   Expose MakeCode-style globals for engine files
------------------------------------------------------- */

;(globalThis as any).Image = Image;
;(globalThis as any).Sprite = Sprite;

;(globalThis as any).image = image;
;(globalThis as any).sprites = sprites;
;(globalThis as any).game = game;
;(globalThis as any).scene = scene;
;(globalThis as any).screen = screen;
;(globalThis as any).controller = controller;
;(globalThis as any).effects = effects;

;(globalThis as any).SpriteKind = SpriteKind;
;(globalThis as any).SpriteFlag = SpriteFlag;
;(globalThis as any).CollisionDirection = CollisionDirection;


/* -------------------------------------------------------
   Simple render sync loop – keeps sprites & Phaser in sync
   (Temporary: bypasses game._tick wiring issues)
------------------------------------------------------- */

(function startSpriteSyncLoop() {
    function frame() {
        try {
            (sprites as any)._syncNativeSprites();
        } catch (e) {
            console.warn("[spriteSyncLoop] error:", e);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();



// NEW: engine loop – runs HeroEngine updates + physics
(function startGameLoop() {
    function frame() {
        try {
            (game as any)._tick();
        } catch (e) {
            console.warn("[gameLoop] error in game._tick:", e);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();


/* -------------------------------------------------------
   Player registry – names & profiles for HeroEngine
   (Used by getHeroProfileForHeroIndex in WorkingHeroEngine)
------------------------------------------------------- */

(function initPlayerRegistry() {
    const g: any = (globalThis as any);
    if (!g.__heroProfiles) {
        g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    }
    if (!g.__playerNames) {
        g.__playerNames = [null, null, null, null];
    }
})();

// slotIndex is 0..3 (Player 1..4); name can be null/undefined for default.
export function registerLocalPlayer(slotIndex: number, name: string | null) {
    const g: any = (globalThis as any);
    if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    if (!g.__playerNames) g.__playerNames = [null, null, null, null];

    g.__playerNames[slotIndex] = name || null;
    g.__heroProfiles[slotIndex] = name || "Default";

    // This client controls this slot (1–4)
    if ((globalThis as any).controller &&
        typeof (globalThis as any).controller.setLocalPlayerSlot === "function") {
        (globalThis as any).controller.setLocalPlayerSlot(slotIndex + 1);
    }

    console.log("[players] registered LOCAL player slot", slotIndex + 1, "name=", name);
}


/* -------------------------------------------------------
   Network client – WebSocket → controller bridge
------------------------------------------------------- */

type NetMessage =
    | { type: "assign"; playerId: number; name?: string }
    | { type: "input"; playerId: number; button: string; pressed: boolean };

class NetworkClient {
    private ws: WebSocket | null = null;
    playerId: number | null = null;
    url: string;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (this.ws) return;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            console.log("[net] connected to", this.url);
        };

        ws.onmessage = (ev) => {
            let msg: NetMessage;
            try {
                msg = JSON.parse(ev.data) as NetMessage;
            } catch (e) {
                console.warn("[net] invalid message:", ev.data, e);
                return;
            }
            this.handleMessage(msg);
        };

        ws.onclose = () => {
            console.log("[net] disconnected");
            this.ws = null;
            // You can implement reconnect here later if you want.
        };

        ws.onerror = (ev) => {
            console.warn("[net] error", ev);
        };
    }

    sendInput(button: string, pressed: boolean) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // console.log("[net] not connected; ignoring input");
            return;
        }
        if (this.playerId == null) {
            console.warn("[net] no playerId yet; ignoring input");
            return;
        }
        const payload: NetMessage = {
            type: "input",
            playerId: this.playerId,
            button,
            pressed
        };
        this.ws.send(JSON.stringify(payload));
    }

    private handleMessage(msg: NetMessage) {
        if (msg.type === "assign") {
            this.playerId = msg.playerId;
            console.log("[net] assigned playerId =", this.playerId, "name=", msg.name);

            // Tie this client to that global player slot
            const ctrlNS: any = (globalThis as any).controller;
            if (ctrlNS && typeof ctrlNS.setLocalPlayerSlot === "function") {
                ctrlNS.setLocalPlayerSlot(this.playerId);
            }

            // Register profile / name for HeroEngine hook
            const slotIndex = this.playerId - 1;
            const name = msg.name || null;

            const g: any = (globalThis as any);
            if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
            if (!g.__playerNames) g.__playerNames = [null, null, null, null];

            g.__playerNames[slotIndex] = name;
            g.__heroProfiles[slotIndex] = name || "Default";

            return;
        }

        if (msg.type === "input") {
            const ctrlNS: any = (globalThis as any).controller;
            if (!ctrlNS) return;

            const playerId = msg.playerId;
            let ctrl: any = null;
            if (playerId === 1) ctrl = ctrlNS.player1;
            else if (playerId === 2) ctrl = ctrlNS.player2;
            else if (playerId === 3) ctrl = ctrlNS.player3;
            else if (playerId === 4) ctrl = ctrlNS.player4;

            if (!ctrl) return;

            const btnName = msg.button;       // "left" | "right" | "up" | "down" | "A" | "B"
            const pressed = !!msg.pressed;

            const btn: any = ctrl[btnName];
            if (!btn || typeof btn._setPressed !== "function") return;

            btn._setPressed(pressed);
        }
    }
}

// CHANGE THIS to your actual server IP/port as needed
const _netClient = new NetworkClient("ws://localhost:8080");

export function initNetwork() {
    console.log("[net] initNetwork: connecting...");
    _netClient.connect();
    (globalThis as any).__net = _netClient;
}




export function img(lit: TemplateStringsArray) {
    return parseMakeCodeImage(lit);
}
(globalThis as any).img = img;
