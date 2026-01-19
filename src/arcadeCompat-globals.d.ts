export {}

declare global {
  // Arcade runtime globals (provided by arcadeCompat.ts at runtime)
  type Sprite = any;
  const Sprite: any;

  interface Image {
    [key: string]: any;
    width: number;
    height: number;
  }

  interface ImageConstructor {
    fromJSON?(width: number, height: number, pixels: number[]): Image;
    [key: string]: any;
  }

  interface Math {
    idiv(a: number, b: number): number;
    randomRange(min: number, max: number): number;
  }

  interface Array<T> {
    removeAt(index: number): T | undefined;
  }

  type StatusBarSprite = any;
  type TextSprite = any;
  type MoveTraits = number[];
  type SyncContext = any;

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
