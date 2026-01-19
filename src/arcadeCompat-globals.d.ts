export {}

declare global {
  // Arcade runtime globals (provided by arcadeCompat.ts at runtime)
  type Sprite = any;
  const Sprite: any;

  type Image = any;

  interface Math {
    idiv(a: number, b: number): number;
    randomRange(min: number, max: number): number;
    constrain(value: number, min: number, max: number): number;
  }

  interface Array<T> {
    removeAt(index: number): T | undefined;
  }

  type StatusBarSprite = any;
  type TextSprite = any;
  type MoveTraits = number[];
  type SyncContext = any;
  type CollisionDirection = any;

  namespace SpriteKind {
    let Player: number;
    let Enemy: number;
  }

  namespace sprites {
    const Flag: any;
    function create(image: Image, kind?: number): Sprite;
    function onOverlap(kind: number, otherKind: number, handler: (sprite: Sprite, other: Sprite) => void): void;
    function onDestroyed(kind: number, handler: (sprite: Sprite) => void): void;
    function allOfKind(kind: number): Sprite[];
    function readDataNumber(...args: any[]): number;
    function readDataString(...args: any[]): string;
    function readDataBoolean(...args: any[]): boolean;
    function readDataSprite(...args: any[]): Sprite | null;
    function setDataNumber(...args: any[]): void;
    function setDataString(...args: any[]): void;
    function setDataBoolean(...args: any[]): void;
    function setDataSprite(...args: any[]): void;
  }

  namespace image {
    type Font = any;
    const font5: Font;
    const font8: Font;
    const font12: Font;
    const font16: Font;
    function create(width: number, height: number): Image;
  }

  const SpriteKind: any;
  const SpriteFlag: any;
  const CollisionDirection: any;
  const StatusBarKind: any;

  const sprites: any;
  const image: any;
  const statusbars: any;
  const textsprite: any;
  const tiles: any;
  const tilemap: any;
  const game: any;
  const scene: any;
  const screen: any;
  const controller: any;
  const effects: any;
  const img: any;
}
