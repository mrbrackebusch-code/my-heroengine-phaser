export {}

declare global {
  // Arcade runtime globals (provided by arcadeCompat.ts at runtime)
  type Sprite = any;
  const Sprite: any;

  interface Image {
    [key: string]: any;
    width: number;
    height: number;
    clearCrop?(): void;
  }

  interface ImageConstructor {
    fromJSON?(width: number, height: number, pixels: number[]): Image;
    [key: string]: any;
  }
  const Image: ImageConstructor;

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

  namespace SpriteKind {
    let Player: number;
    let Enemy: number;
  }

  namespace sprites {
    function readDataNumber(...args: any[]): number;
    function readDataString(...args: any[]): string;
    function readDataBoolean(...args: any[]): boolean;
    function readDataSprite(...args: any[]): Sprite | null;
    function setDataNumber(...args: any[]): void;
    function setDataString(...args: any[]): void;
    function setDataBoolean(...args: any[]): void;
    function setDataSprite(...args: any[]): void;
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
