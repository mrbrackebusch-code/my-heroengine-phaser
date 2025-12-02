/**
 * STUDENT main.ts – Hero logic + animation hooks
 *
 * This file is designed to be BLOCK-FRIENDLY:
 * - uses `any[]` for hero/enemy arrays
 * - uses `any` for sprite variables (to keep MakeCode happy)
 * - exposes helper variables so you can write:
 *     "IF (something is true) THEN cast THIS move"
 *
 * You can safely switch between Blocks and JavaScript without type errors.
 */

// ---------------------------------------------------------
// GLOBAL HELPERS + SHARED STATE
// ---------------------------------------------------------

// Sprite references used by helper functions
let me: any = null       // "my" hero (for the current logic call)
let enemy: any = null    // current enemy in loops
let ally: any = null     // current ally in loops

// Stats for MY HERO (the one whose logic is running)
let myHP = 0
let myMaxHP = 0
let myMana = 0
let myMaxMana = 0

// Stats for nearby enemies (within some radius of me)
let nearbyEnemyCount = 0
let nearbyEnemyMinHP = 0
let nearbyEnemyMaxHP = 0
let nearbyEnemyTotalHP = 0
let nearbyEnemyAverageHP = 0
let nearbyBruteCount = 0  // how many nearby enemies are BRUTEs

// Default radius (pixels) for "near me"
const HERO1_NEARBY_RADIUS = 60

// ---------------------------------------------------------
// Demo idle images – replace with your own art if you want
// ---------------------------------------------------------

let DEMO_HERO1_IDLE: Image = null
let DEMO_HERO2_IDLE: Image = null
let DEMO_HERO3_IDLE: Image = null
let DEMO_HERO4_IDLE: Image = null

// Simple placeholder images – totally fine to replace
DEMO_HERO1_IDLE = img`
    . . . . . . f f f f . . . . . .
    . . . . f f f 2 2 f f f . . . .
    . . . f f f 2 2 2 2 f f f . . .
    . . f f f e e e e e e f f f . .
    . . f f e 2 2 2 2 2 2 e e f . .
    . . f e 2 f f f f f f 2 e f . .
    . . f f f f e e e e f f f f . .
    . f f e f b f 4 4 f b f e f f .
    . f e e 4 1 f d d f 1 4 e e f .
    . . f e e d d d d d d e e f . .
    . . . f e e 4 4 4 4 e e f . . .
    . . e 4 f 2 2 2 2 2 2 f 4 e . .
    . . 4 d f 2 2 2 2 2 2 f d 4 . .
    . . 4 4 f 4 4 5 5 4 4 f 4 4 . .
    . . . . . f f f f f f . . . . .
    . . . . . f f . . f f . . . . .
`
DEMO_HERO2_IDLE = img`
    . . . . . . c c c c . . . . . .
    . . . . c c 6 6 6 6 c c . . . .
    . . . c 6 6 6 6 6 6 6 6 c . . .
    . . c 6 6 6 6 6 6 6 6 6 6 c . .
    . . c 6 6 f f 6 6 f f 6 6 c . .
    . c 6 6 6 6 6 6 6 6 6 6 6 6 c .
    . c 6 6 6 6 6 6 6 6 6 6 6 6 c .
    . c 6 6 6 6 6 6 6 6 6 6 6 6 c .
    . . c 6 6 6 6 6 6 6 6 6 6 c . .
    . . . c 6 6 6 6 6 6 6 6 c . . .
    . . . . c 6 6 6 6 6 6 c . . . .
    . . . . . c 6 6 6 6 c . . . . .
    . . . . . . c 6 6 c . . . . . .
    . . . . . . c c c c . . . . . .
    . . . . . . c c c c . . . . . .
    . . . . . . . . . . . . . . . .
`
DEMO_HERO3_IDLE = DEMO_HERO2_IDLE
DEMO_HERO4_IDLE = DEMO_HERO1_IDLE

// ---------------------------------------------------------
// Animation hooks – called by the engine
// ---------------------------------------------------------

function animateHero1(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO1_IDLE)
}

function animateHero2(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO2_IDLE)
}

function animateHero3(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO3_IDLE)
}

function animateHero4(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO4_IDLE)
}

// ---------------------------------------------------------
// HELPER FUNCTIONS FOR STUDENT LOGIC
// ---------------------------------------------------------

/**
 * Update myHP, myMaxHP, myMana, myMaxMana for the current hero.
 *
 * Call this once at the start of hero1Logic before using those variables.
 */
function updateMyHeroStats(heroIndex: number, heroesArr: any[]) {
    me = heroesArr[heroIndex]

    if (!me) {
        myHP = 0
        myMaxHP = 0
        myMana = 0
        myMaxMana = 0
        return
    }

    myHP = sprites.readDataNumber(me, HERO_DATA.HP) | 0
    myMaxHP = sprites.readDataNumber(me, HERO_DATA.MAX_HP) | 0
    myMana = sprites.readDataNumber(me, HERO_DATA.MANA) | 0
    myMaxMana = sprites.readDataNumber(me, HERO_DATA.MAX_MANA) | 0
}

/**
 * Check if an enemy should be considered a "BRUTE".
 * Here we use max HP >= 160 (matches ENEMY_KIND.BRUTE).
 */
function isBruteEnemy(e: any): boolean {
    if (!e) return false
    const maxHp = sprites.readDataNumber(e, ENEMY_DATA.MAX_HP) | 0
    return maxHp >= 160
}

/**
 * Update stats for enemies NEAR ME (within maxDistance pixels).
 *
 * After calling this, you can use:
 *  - nearbyEnemyCount
 *  - nearbyEnemyMinHP
 *  - nearbyEnemyMaxHP
 *  - nearbyEnemyTotalHP
 *  - nearbyEnemyAverageHP
 *  - nearbyBruteCount
 */
function updateNearbyEnemiesStats(
    heroIndex: number,
    enemiesArr: any[],
    heroesArr: any[],
    maxDistance: number
) {
    nearbyEnemyCount = 0
    nearbyEnemyMinHP = 0
    nearbyEnemyMaxHP = 0
    nearbyEnemyTotalHP = 0
    nearbyEnemyAverageHP = 0
    nearbyBruteCount = 0

    me = heroesArr[heroIndex]
    if (!me) return

    for (let i = 0; i < enemiesArr.length; i++) {
        enemy = enemiesArr[i]
        if (!enemy || (enemy.flags & sprites.Flag.Destroyed)) continue

        const d = distanceTo(me, enemy)
        if (d > maxDistance) continue

        const hp = sprites.readDataNumber(enemy, ENEMY_DATA.HP) | 0
        const maxHp = sprites.readDataNumber(enemy, ENEMY_DATA.MAX_HP) | 0

        // update count + sums
        nearbyEnemyCount += 1
        nearbyEnemyTotalHP += hp

        if (nearbyEnemyCount == 1) {
            nearbyEnemyMinHP = hp
            nearbyEnemyMaxHP = hp
        } else {
            if (hp < nearbyEnemyMinHP) nearbyEnemyMinHP = hp
            if (hp > nearbyEnemyMaxHP) nearbyEnemyMaxHP = hp
        }

        // brute detection
        if (maxHp >= 160) {
            nearbyBruteCount += 1
        }
    }

    if (nearbyEnemyCount > 0) {
        nearbyEnemyAverageHP = (nearbyEnemyTotalHP / nearbyEnemyCount) | 0
    } else {
        nearbyEnemyAverageHP = 0
    }
}

// ---------------------------------------------------------
// HERO 1 – small helper functions for A / B / A+B / idle
// ---------------------------------------------------------

/**
 * HERO 1 – A BUTTON
 *
 * Example logic:
 * - If there is at least 1 BRUTE near me, use a strong Strength move.
 * - Otherwise, use a medium Strength move.
 *
 * Students: change the IF condition and the numbers in the array
 * to create your own behavior.
 */
function hero1AButton(): number[] {
    if (nearbyBruteCount > 0) {
        // Strong attack (good vs BRUTEs)
        return [
            FAMILY.STRENGTH,
            20, 20, 400, 250,   // traits 1–4 (students can tweak)
            ELEM.NONE,
            ANIM.ID.A
        ]
    } else {
        // Normal attack
        return [
            FAMILY.STRENGTH,
            10, 10, 250, 200,
            ELEM.NONE,
            ANIM.ID.A
        ]
    }
}

/**
 * HERO 1 – B BUTTON
 *
 * Example logic:
 * - If there are 3 or more enemies near me, use an AGILITY move.
 * - Otherwise, do a small poke.
 */
function hero1BButton(): number[] {
    if (nearbyEnemyCount >= 3) {
        // Big agility burst if surrounded
        return [
            FAMILY.AGILITY,
            4, 40, 40, 40,
            ELEM.NONE,
            ANIM.ID.B
        ]
    } else {
        // Light move otherwise
        return [
            FAMILY.AGILITY,
            2, 20, 20, 20,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
}

/**
 * HERO 1 – A+B BUTTON
 *
 * Example logic:
 * - If I have enough mana, cast a powerful INTELLECT move.
 * - If I'm low on mana, do a cheaper version.
 */
function hero1ABButton(): number[] {
    // Simple "enough mana" check: at least 30 mana
    if (myMana >= 30) {
        return [
            FAMILY.INTELLECT,
            80, 40, 40, 40,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    } else {
        // cheaper version if mana is low
        return [
            FAMILY.INTELLECT,
            40, 20, 20, 20,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
}

/**
 * HERO 1 – IDLE
 *
 * Called when no buttons are pressed.
 */
function hero1IdleButton(): number[] {
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]
}

// ---------------------------------------------------------
// HERO 1 MAIN LOGIC – called by the engine each frame
// ---------------------------------------------------------

function hero1Logic(
    button: string,
    heroIndex: number,
    enemiesArr: any[],
    heroesArr: any[]
): number[] {

    // 1) Update helper variables for THIS hero and nearby enemies
    updateMyHeroStats(heroIndex, heroesArr)
    updateNearbyEnemiesStats(heroIndex, enemiesArr, heroesArr, HERO1_NEARBY_RADIUS)

    // 2) Choose which move to use based on the button
    if (button == "A") {
        return hero1AButton()
    } else if (button == "B") {
        return hero1BButton()
    } else if (button == "A+B") {
        return hero1ABButton()
    } else {
        return hero1IdleButton()
    }
}

// ---------------------------------------------------------
// HERO 2–4 – simple placeholder logic (students can ignore)
// ---------------------------------------------------------

function hero2Logic(
    button: string,
    heroIndex: number,
    enemiesArr: any[],
    heroesArr: any[]
): number[] {

    if (button == "A") {
        return [
            FAMILY.STRENGTH,
            8, 8, 200, 200,
            ELEM.NONE,
            ANIM.ID.A
        ]
    } else if (button == "B") {
        return [
            FAMILY.AGILITY,
            3, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    } else if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            30, 20, 20, 20,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    } else {
        return [
            FAMILY.STRENGTH,
            0, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.IDLE
        ]
    }
}

function hero3Logic(
    button: string,
    heroIndex: number,
    enemiesArr: any[],
    heroesArr: any[]
): number[] {

    if (button == "A") {
        return [
            FAMILY.STRENGTH,
            8, 8, 200, 200,
            ELEM.NONE,
            ANIM.ID.A
        ]
    } else if (button == "B") {
        return [
            FAMILY.AGILITY,
            3, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    } else if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            30, 20, 20, 20,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    } else {
        return [
            FAMILY.STRENGTH,
            0, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.IDLE
        ]
    }
}

function hero4Logic(
    button: string,
    heroIndex: number,
    enemiesArr: any[],
    heroesArr: any[]
): number[] {

    if (button == "A") {
        return [
            FAMILY.STRENGTH,
            8, 8, 200, 200,
            ELEM.NONE,
            ANIM.ID.A
        ]
    } else if (button == "B") {
        return [
            FAMILY.AGILITY,
            3, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    } else if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            30, 20, 20, 20,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    } else {
        return [
            FAMILY.STRENGTH,
            0, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.IDLE
        ]
    }
}

// ---------------------------------------------------------
// HOOKS + START ENGINE
// ---------------------------------------------------------

HeroEngine.hero1LogicHook = hero1Logic
HeroEngine.hero2LogicHook = hero2Logic
HeroEngine.hero3LogicHook = hero3Logic
HeroEngine.hero4LogicHook = hero4Logic

HeroEngine.animateHero1Hook = animateHero1
HeroEngine.animateHero2Hook = animateHero2
HeroEngine.animateHero3Hook = animateHero3
HeroEngine.animateHero4Hook = animateHero4

HeroEngine.start()
