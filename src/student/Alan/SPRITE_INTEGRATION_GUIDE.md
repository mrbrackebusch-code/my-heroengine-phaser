# Sprite Integration Guide for Lourdes

This guide explains exactly what sprites are needed and how to integrate them into the pet system.

---

## 📦 Required Asset Files

### Main Spritesheet: `wisp 32x32.png`

**Location:** `assets/pets/` (or as directed by maintainer)

**Specifications:**
- **Frame Size:** 32×32 pixels (MUST include in filename as `32x32`)
- **Layout:** Horizontal strip (all frames in one row, no gaps between frames)
- **Total Frames:** 16 frames (indices 0-15)
- **Format:** PNG with transparency

**Frame Breakdown:**

| Frame Index | Animation | Count | Purpose |
|-------------|-----------|-------|---------|
| 0-3         | `idle`    | 4     | Pet standing, slight breathing/flicker |
| 4-7         | `walk`    | 4     | Pet moving alongside player |
| 8-11        | `hurt`    | 4     | Pet recoiling from damage (fast 12 fps) |
| 12-15       | `interact`| 4     | Pet celebrating, level-up, special event |

**Example layout (all one row):**
```
[Idle 0][Idle 1][Idle 2][Idle 3] [Walk 0][Walk 1][Walk 2][Walk 3] [Hurt 0][Hurt 1][Hurt 2][Hurt 3] [Interact 0][Interact 1][Interact 2][Interact 3]
```

**Animation Playback (default settings, can be tuned):**
- `idle`: 10 fps, repeat
- `walk`: 10 fps, repeat
- `hurt`: 12 fps, play-once (quick reaction)
- `interact`: 8 fps, play-once (celebration)

---

### Inventory Item Icons

**File 1: `wisp_food 16x16.png`**
- **Size:** 16×16 pixels (single frame)
- **Purpose:** Food item icon in inventory menu
- **Location:** `assets/pets/` (same folder as main spritesheet)

**File 2: `wisp_bandage 16x16.png`**
- **Size:** 16×16 pixels (single frame)
- **Purpose:** Bandage (revive item) icon in inventory menu
- **Location:** `assets/pets/` (same folder as main spritesheet)

---

## 🔗 Integration Steps

### Step 1: Create the Sprite Files

Once you create the PNG files, place them in the designated folder (confirmed with maintainer).

### Step 2: Update Texture Registration (if needed)

In [petDefs.ts](petDefs.ts), the animation frame data is already prepared:

```typescript
const animFrames = {
    idle: { start: 0, end: 3, frameRate: 10 },
    walk: { start: 4, end: 7, frameRate: 10 },
    hurt: { start: 8, end: 11, frameRate: 12 },
    interact: { start: 12, end: 15, frameRate: 8 },
};
```

**If your frame layout is different:**
- Update the `start` and `end` indices to match your spritesheet
- Adjust `frameRate` if you want different animation speeds
- Example: If idle is frames 0-2 (3 frames), change `{ start: 0, end: 2, frameRate: 10 }`

### Step 3: Asset Registration (done by maintainer)

The maintainer will:
- Place your PNG files in the correct folder
- Register texture keys in the core system
- Link the animation frame data to Phaser

You don't need to edit core files for asset registration.

---

## 🎨 Design Guidelines

### Wisp Character Design

- **Style:** Small, ethereal companion (think sprite, wisp, orb-like)
- **Color:** Fits Alan's theme (cool colors suggested: blue, purple, cyan)
- **Movement:** Should float/hover rather than walk (but named "walk" for compatibility)
- **Size:** 32×32 fits well with typical tile-based games (32×32 tiles)

### Idle Animation (frames 0-3)

- Subtle movement: slight bobbing, pulsing glow, or shimmer
- Loop infinitely, should feel calm and present
- @ 10 fps = 400ms per cycle

### Walk Animation (frames 4-7)

- Following motion: should look like moving alongside the player
- Similar to idle but with horizontal component
- @ 10 fps = 400ms per cycle

### Hurt Animation (frames 8-11)

- Quick flinch: recoil, flash, or compression
- Plays faster (12 fps) so it's snappy and responsive
- @ 12 fps = 333ms per cycle
- Should feel impactful but brief

### Interact Animation (frames 12-15)

- Celebration or reaction: jump, spin, or glow burst
- Optional: reserved for future interactions (level-up, item use, etc.)
- Slow and emphasized (8 fps)
- @ 8 fps = 500ms per cycle

---

## ⚡ Quick Checklist

- [ ] Created `wisp 32x32.png` with 16 frames in a horizontal strip
- [ ] Created `wisp_food 16x16.png` (single frame icon)
- [ ] Created `wisp_bandage 16x16.png` (single frame icon)
- [ ] Placed all files in agreed-upon folder (e.g., `assets/pets/`)
- [ ] All PNGs use transparency background
- [ ] Frame indices in each animation are sequential and non-overlapping
- [ ] Filename includes dimensions as `WxH` (e.g., `32x32`)
- [ ] Notified Alan/maintainer that sprites are ready for texture key registration

---

## 🐛 Troubleshooting

**"Frames don't line up or animation looks glitchy"**
- Check that all frames are exactly 32×32 px (no padding, no gaps)
- Verify frame indices in petDefs.ts match your layout
- Confirm spritesheet is a single horizontal row (no multi-row grids)

**"Idle animation looks wrong"**
- Increase frameRate for faster loop, decrease for slower
- Verify frames 0-3 are created correctly

**"Hurt animation plays too fast/slow"**
- Adjust `frameRate: 12` in petDefs.ts animFrames.hurt (higher = faster)

**"Icons don't show in inventory"**
- Confirm `wisp_food 16x16.png` and `wisp_bandage 16x16.png` are in the right folder
- Check that filenames match exactly (case-sensitive on Linux servers)

---

## 📞 Questions?

If you need clarification on:
- **Sprite dimensions:** Check the filename convention above
- **Animation timing:** See frameRate values in petDefs.ts
- **Asset location:** Confirm with maintainer in AlanNeeds.md or team chat
- **Integration issues:** Reach out to Alan or the maintainer

---

**Last Updated:** February 17, 2026  
**Created for:** Lourdes (visuals & animations)  
**Linked from:** [PET_SYSTEM_STATUS.md](PET_SYSTEM_STATUS.md)
