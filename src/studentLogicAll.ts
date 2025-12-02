// ----------------------------------------------------------
// Phaser host shims for HeroEngine constants & helpers
// This file is only used in the Phaser wrapper, so it's safe
// to duplicate these without affecting MakeCode Arcade.
// ----------------------------------------------------------

// Match HERO_DATA keys from WorkingHeroEngine25.ts
const HERO_DATA = {
    HP: "hp", MAX_HP: "maxHp", MANA: "mana", MAX_MANA: "maxMana",
    FAMILY: "family", BUTTON: "btn",
    TRAIT1: "t1", TRAIT2: "t2", TRAIT3: "t3", TRAIT4: "t4",
    INPUT_LOCKED: "inputLocked", STORED_VX: "sVx", STORED_VY: "sVy",
    TARGET_START_MS: "tStart", TARGET_LOCK_MS: "tLock",
    IS_CONTROLLING_SPELL: "isCtrlSpell",
    COMBO_COUNT: "comboCount", COMBO_MULT: "comboMult",
    LAST_HIT_TIME: "lastHit", LAST_MOVE_KEY: "lastMoveKey",
    IFRAME_UNTIL: "iUntil",
    AGI_DASH_UNTIL: "aDashUntil",
    AGI_COMBO_UNTIL: "aComboUntil",
    STR_INNER_RADIUS: "strInnerR",
    OWNER: "owner",
    BUSY_UNTIL: "busyUntil",
    MOVE_SPEED_MULT: "mvMult",
    DAMAGE_AMP_MULT: "dmgMult",
    BUFF_JSON: "buffsJson"
};

// Match FAMILY enum from WorkingHeroEngine25.ts
const FAMILY = { STRENGTH: 0, AGILITY: 1, INTELLECT: 2, HEAL: 3 };

// Match ELEM enum from WorkingHeroEngine25.ts
const ELEM = { NONE: 0, GRASS: 1, FIRE: 2, WATER: 3, ELECTRIC: 4, HEAL: 5 };

// Match ANIM structure from WorkingHeroEngine25.ts
const ANIM = {
    IDLE: "idle",
    A: "A-Move",
    B: "B-Move",
    AB: "A+B Move",
    ID: { IDLE: 0, A: 1, B: 2, AB: 3 }
};

// distanceTo helper to match HeroEngine
function distanceTo(a: Sprite, b: Sprite): number {
    if (!a || !b) return 99999;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}


const DEBUG_HERO_LOGIC_STUDENT = true


let DEMO_HERO1_IDLE: Image = null
let DEMO_HERO2_IDLE: Image = null
let DEMO_HERO3_IDLE: Image = null
let DEMO_HERO4_IDLE: Image = null

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
    . . . . c c c 5 5 c c c . . . . 
    . . . c c c 5 5 5 5 c c c . . . 
    . . c c c e e e e e e c c c . . 
    . . c c e 5 5 5 5 5 5 e e c . . 
    . . c e 5 c c c c c c 5 e c . . 
    . . c c c c e e e e c c c c . . 
    . c c e c b c 4 4 c b c e c c . 
    . c e e 4 1 c d d c 1 4 e e c . 
    . . c e e d d d d d d e e c . . 
    . . . c e e 4 4 4 4 e e c . . . 
    . . e 4 c 5 5 5 5 5 5 c 4 e . . 
    . . 4 d c 5 5 5 5 5 5 c d 4 . . 
    . . 4 4 c 4 4 7 7 4 4 c 4 4 . . 
    . . . . . c c c c c c . . . . . 
    . . . . . c c . . c c . . . . . 
`
DEMO_HERO3_IDLE = img`
    . . . . . . 6 6 6 6 . . . . . . 
    . . . . 6 6 6 3 3 6 6 6 . . . . 
    . . . 6 6 6 3 3 3 3 6 6 6 . . . 
    . . 6 6 6 e e e e e e 6 6 6 . . 
    . . 6 6 e 3 3 3 3 3 3 e e 6 . . 
    . . 6 e 3 6 6 6 6 6 6 3 e 6 . . 
    . . 6 6 6 6 e e e e 6 6 6 6 . . 
    . 6 6 e 6 b 6 4 4 6 b 6 e 6 6 . 
    . 6 e e 4 1 6 d d 6 1 4 e e 6 . 
    . . 6 e e d d d d d d e e 6 . . 
    . . . 6 e e 4 4 4 4 e e 6 . . . 
    . . e 4 6 3 3 3 3 3 3 6 4 e . . 
    . . 4 d 6 3 3 3 3 3 3 6 d 4 . . 
    . . 4 4 6 4 4 9 9 4 4 6 4 4 . . 
    . . . . . 6 6 6 6 6 6 . . . . . 
    . . . . . 6 6 . . 6 6 . . . . . 
`
DEMO_HERO4_IDLE = img`
    . . . . . . 8 8 8 8 . . . . . . 
    . . . . 8 8 8 7 7 8 8 8 . . . . 
    . . . 8 8 8 7 7 7 7 8 8 8 . . . 
    . . 8 8 8 e e e e e e 8 8 8 . . 
    . . 8 8 e 7 7 7 7 7 7 e e 8 . . 
    . . 8 e 7 8 8 8 8 8 8 7 e 8 . . 
    . . 8 8 8 8 e e e e 8 8 8 8 . . 
    . 8 8 e 8 b 8 4 4 8 b 8 e 8 8 . 
    . 8 e e 4 1 8 d d 8 1 4 e e 8 . 
    . . 8 e e d d d d d d e e 8 . . 
    . . . 8 e e 4 4 4 4 e e 8 . . . 
    . . e 4 8 7 7 7 7 7 7 8 4 e . . 
    . . 4 d 8 7 7 7 7 7 7 8 d 4 . . 
    . . 4 4 8 4 4 9 9 4 4 8 4 4 . . 
    . . . . . 8 8 8 8 8 8 . . . . . 
    . . . . . 8 8 . . 8 8 . . . . . 
`

export function ChrisHeroLogic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {

    // Testing a comment
    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen4 = enemiesArr ? enemiesArr.length : -1;
const heroesLen4 = heroesArr ? heroesArr.length : -1;
console.log("[hero4Logic] ENTER button=" + button + " heroIndex=" + heroIndex + " enemiesLen=" + enemiesLen4 + " heroesLen=" + heroesLen4)
    }
    me4 = heroesArr[heroIndex]
    targetIndex4 = -1
    if (me4 && enemiesArr.length > 0) {
        best4 = 1000000000
        for (let s = 0; s <= enemiesArr.length - 1; s++) {
            t = enemiesArr[s]
            if (!(t) || (t.flags & sprites.Flag.Destroyed)) {
                continue;
            }
            const u = distanceTo(me4, t)
if (u < best4) {
                best4 = u
                targetIndex4 = s
            }
        }
    }
    anyHeroLow4 = false
    for (let v = 0; v <= heroesArr.length - 1; v++) {
        w = heroesArr[v]
        if (!(w)) {
            continue;
        }
        const hp4 = sprites.readDataNumber(w, HERO_DATA.HP) | 0
if (hp4 > 0 && hp4 < 50) {
            anyHeroLow4 = true
            break;
        }
    }
    if (button == "A") {
        if (anyHeroLow4) {
            return [
            FAMILY.HEAL,
            25,
            25,
            25,
            25,
            ELEM.HEAL,
            ANIM.ID.A
            ]
        } else {
            return [
            FAMILY.STRENGTH,
            10,
            10,
            50,
            200,
            ELEM.NONE,
            ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
        FAMILY.AGILITY,
        4,
        30,
        30,
        30,
        ELEM.NONE,
        ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
        FAMILY.INTELLECT,
        12,
        25,
        25,
        25,
        ELEM.NONE,
        ANIM.ID.AB
        ]
    }
    return [
    FAMILY.STRENGTH,
    0,
    25,
    25,
    25,
    ELEM.NONE,
    ANIM.ID.IDLE
    ]
}

export function DemoHeroLogic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {


    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero1Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}


// studentLogicAll.ts
// Students only touch THIS file (or their own file) and only define functions

export function JasonHeroLogic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {



    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero1Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}


export function KyleHeroLogic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {

    //Your code from the function goes here:
    
    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero2Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me2: any = heroesArr[heroIndex]
    let targetIndex2 = -1

    if (me2 && enemiesArr.length > 0) {
        let best2 = 1e9
        for (let k = 0; k < enemiesArr.length; k++) {
            let f: any = enemiesArr[k]
            if (!f || (f.flags & sprites.Flag.Destroyed)) continue
            const g = distanceTo(me2, f)
            if (g < best2) {
                best2 = g
                targetIndex2 = k
            }
        }
    }

    let anyHeroLow2 = false
    for (let l = 0; l < heroesArr.length; l++) {
        let m: any = heroesArr[l]
        if (!m) continue
        const hp2 = sprites.readDataNumber(m, HERO_DATA.HP) | 0
        if (hp2 > 0 && hp2 < 50) {
            anyHeroLow2 = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow2) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 50, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            12, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]

    //Your code from the function goes above this
}





// ---------------------------------------------------------
// Animation hooks – called by the engine
// ---------------------------------------------------------

export function animateHero1(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO1_IDLE)
}

export function animateHero2(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO2_IDLE)
}

export function animateHero3(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO3_IDLE)
}

export function animateHero4(hero: Sprite, animKey: string, timeMs: number, direction: string) {
    hero.setImage(DEMO_HERO4_IDLE)
}





//Default logic functions:


export function hero1Logic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {


    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero1Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}



export function hero2Logic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {


    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero2Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}




export function hero3Logic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {


    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero3Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}




export function hero4Logic(
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
): number[] {


    if (DEBUG_HERO_LOGIC_STUDENT) {
        const enemiesLen = enemiesArr ? enemiesArr.length : -1;
        const heroesLen = heroesArr ? heroesArr.length : -1;
        console.log(
            "[hero4Logic] ENTER button=" + button +
            " heroIndex=" + heroIndex +
            " enemiesLen=" + enemiesLen +
            " heroesLen=" + heroesLen
        );
    }

    let me: any = heroesArr[heroIndex]
    let targetIndex = -1

    if (me && enemiesArr.length > 0) {
        let best = 1e9
        for (let i = 0; i < enemiesArr.length; i++) {
            let e: any = enemiesArr[i]
            if (!e || (e.flags & sprites.Flag.Destroyed)) continue
            const d = distanceTo(me, e)
            if (d < best) {
                best = d
                targetIndex = i
            }
        }
    }

    let anyHeroLow = false
    for (let j = 0; j < heroesArr.length; j++) {
        let h: any = heroesArr[j]
        if (!h) continue
        const hp = sprites.readDataNumber(h, HERO_DATA.HP) | 0
        if (hp > 0 && hp < 50) {
            anyHeroLow = true
            break
        }
    }

    if (button == "A") {
        if (anyHeroLow) {
            return [
                FAMILY.HEAL,
                25, 25, 25, 25,
                ELEM.HEAL,
                ANIM.ID.A
            ]
        } else {
            return [
                FAMILY.STRENGTH,
                10, 10, 300, 200,
                ELEM.NONE,
                ANIM.ID.A
            ]
        }
    }
    if (button == "B") {
        return [
            FAMILY.AGILITY,
            4, 30, 30, 30,
            ELEM.NONE,
            ANIM.ID.B
        ]
    }
    if (button == "A+B") {
        return [
            FAMILY.INTELLECT,
            100, 25, 25, 25,
            ELEM.NONE,
            ANIM.ID.AB
        ]
    }
    return [
        FAMILY.STRENGTH,
        0, 25, 25, 25,
        ELEM.NONE,
        ANIM.ID.IDLE
    ]


}






// etc. for ChrisHeroLogic, DanielHeroLogic, ...
