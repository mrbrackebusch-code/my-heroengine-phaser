# Quick Reference Card — Pet System Ready State

**Last updated:** Feb 17, 2026

---

## 🎯 For Lourdes (Visuals & Sprites)

**START HERE:** [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md)

**TL;DR:**
- Create `wisp 32x32.png` → 16 frames, 32×32 px each, horizontal strip
  - Frames 0-3: idle | 4-7: walk | 8-11: hurt | 12-15: interact
- Create `wisp_food 16x16.png` (food icon)
- Create `wisp_bandage 16x16.png` (bandage icon)
- Place in `assets/pets/`
- Notify Alan when ready

---

## 📊 For Elizabeth (Leveling & Progression)

**START HERE:** [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md)

**TL;DR:**
- Skeleton code ready in `petXpSystem.ts`
- Tune `_calculateXpThreshold()` → constants: `baseXp=100`, `bonusPerLevel=50`
- Test 7 unit tests (see guide)
- No code edits needed, just verify progression feels right
- Optional: add level-up animations/VFX

**Default Progression:**
- Lv1→2: 100 XP | Lv5→6: 300 XP | Lv10: 550 XP total
- HP grows: 40 → 46 → 52 ... → 94
- ATK grows: 6 → 7 → 8 ... → 15

---

## 🛠️ For Alan

**Status:** Combat & XP integration complete ✅

**Blocked on (AlanNeeds.md):**
- Enemy query API (how to get active enemies)
- Enemy damage methods (confirm `.takeDamage()` vs `.damage()`)
- Asset placement for Lourdes' sprites

**Next Steps:**
1. Contact maintainer → unblock enemy API
2. Integrate Lourdes' sprites when ready (update animation keys in petDefs.ts)
3. Support Elizabeth on progression tuning if needed

---

## 📁 New Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) | Asset specs, sprite requirements | Lourdes |
| [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md) | Progression design, tuning guide | Elizabeth |
| [READY_FOR_COLLABORATORS.md](READY_FOR_COLLABORATORS.md) | Summary of all prep work | All |
| [PET_SYSTEM_STATUS.md](PET_SYSTEM_STATUS.md) | Updated main status (+ new docs linked) | All |

---

## 🧪 Testing Checklist (for Elizabeth)

- [ ] Init: `pet.__alanXp` has `{ currentXp: 0, level: 1, xpToNextLevel: 100 }`
- [ ] Award 50 XP: level stays 1, currentXp = 50
- [ ] Award 100+ XP: level-up triggers, currentXp resets
- [ ] Multiple level-ups: award 500 XP, pet reaches level 4-5
- [ ] Stat growth: verify maxHp grows, atk grows
- [ ] Max level cap: award huge XP, pet caps at level 10
- [ ] Hook integration: simulate enemy defeat, verify XP awarded

---

## 📞 Questions?

- **Lourdes:** See [SPRITE_INTEGRATION_GUIDE.md](SPRITE_INTEGRATION_GUIDE.md) troubleshooting section
- **Elizabeth:** See [ELIZABETH_XP_GUIDE.md](ELIZABETH_XP_GUIDE.md) "Questions?" section
- **Alan:** Check AlanNeeds.md and contact maintainer

---

✅ **Everything is ready. Go build!**
