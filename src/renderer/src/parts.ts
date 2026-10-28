// 程式繪製的佔位 Part（ADR-0002）：同一張透明畫布、原位疊合、不裁切；狗狗面向右。
import { Graphics, Rectangle, type Renderer, type Texture } from "pixi.js";
import type { Point } from "../../core/pet";

export const CANVAS = { width: 220, height: 170 } as const;
/** 腳底中心點，畫布座標；對應快照的 position。 */
export const FEET: Point = { x: 110, y: 170 };
/** 頭頂（耳尖上方），畫布座標；Bubble 的錨點。 */
export const HEAD_TOP: Point = { x: 182, y: 10 };
/** 屬於頭部的 Part：按住這些部位可以撫摸，其餘部位之後用來拖曳。 */
export const isHeadPart = (name: string) =>
  name === "head" ||
  name.startsWith("ear_") ||
  name.startsWith("eyes_") ||
  name.startsWith("mouth_");

export interface Part {
  readonly name: string;
  readonly texture: Texture;
  /** 旋轉與彎曲的基準點，畫布座標。 */
  readonly pivot: Point;
  /** 逐像素命中用的 alpha 遮罩（RGBA）。 */
  readonly pixels: { data: Uint8ClampedArray; width: number; height: number };
}

const FUR = 0xd9a066;
const FUR_FAR = 0xb88550;
const FUR_LIGHT = 0xf2d2a9;
const INK = 0x2b1d14;

interface PartDef {
  readonly name: string;
  readonly pivot: Point;
  readonly draw: (g: Graphics) => void;
}

const leg = (x: number, color: number) => (g: Graphics) =>
  g.roundRect(x, 112, 16, 58, 7).fill(color);

// 由後往前的疊合順序。
const DEFS: readonly PartDef[] = [
  {
    name: "tail",
    pivot: { x: 45, y: 95 },
    draw: (g) =>
      g
        .moveTo(45, 95)
        .quadraticCurveTo(20, 90, 14, 62)
        .stroke({ width: 12, color: FUR, cap: "round" }),
  },
  {
    name: "ear_L",
    pivot: { x: 168, y: 46 },
    draw: (g) => g.poly([158, 48, 168, 18, 182, 44]).fill(FUR_FAR),
  },
  { name: "leg_BL", pivot: { x: 63, y: 112 }, draw: leg(55, FUR_FAR) },
  { name: "leg_FL", pivot: { x: 148, y: 112 }, draw: leg(140, FUR_FAR) },
  {
    name: "body",
    pivot: { x: 110, y: 108 },
    draw: (g) => g.roundRect(38, 80, 144, 56, 28).fill(FUR),
  },
  {
    name: "body_lying",
    pivot: { x: 110, y: 145 },
    draw: (g) => g.roundRect(30, 122, 160, 48, 24).fill(FUR),
  },
  { name: "leg_BR", pivot: { x: 83, y: 112 }, draw: leg(75, FUR) },
  { name: "leg_FR", pivot: { x: 168, y: 112 }, draw: leg(160, FUR) },
  {
    name: "head",
    pivot: { x: 160, y: 95 },
    draw: (g) =>
      g
        .circle(176, 68, 32)
        .fill(FUR)
        .ellipse(202, 82, 18, 13)
        .fill(FUR_LIGHT)
        .circle(217, 77, 4.5)
        .fill(INK),
  },
  {
    name: "ear_R",
    pivot: { x: 180, y: 44 },
    draw: (g) => g.poly([170, 46, 184, 14, 196, 46]).fill(FUR),
  },
  {
    name: "eyes_open",
    pivot: { x: 190, y: 62 },
    draw: (g) => g.circle(190, 62, 4).fill(INK),
  },
  {
    name: "eyes_happy",
    pivot: { x: 190, y: 62 },
    draw: (g) =>
      g
        .moveTo(185, 64)
        .quadraticCurveTo(190, 56, 195, 64)
        .stroke({ width: 2.5, color: INK, cap: "round" }),
  },
  {
    name: "eyes_angry",
    pivot: { x: 190, y: 62 },
    draw: (g) =>
      g
        .circle(190, 64, 3.5)
        .fill(INK)
        .moveTo(183, 54)
        .lineTo(197, 59)
        .stroke({ width: 2.5, color: INK, cap: "round" }),
  },
  {
    name: "eyes_sleep",
    pivot: { x: 190, y: 62 },
    draw: (g) =>
      g
        .moveTo(184, 62)
        .quadraticCurveTo(190, 67, 196, 62)
        .stroke({ width: 2.5, color: INK, cap: "round" }),
  },
  {
    name: "mouth_idle",
    pivot: { x: 206, y: 91 },
    draw: (g) =>
      g
        .moveTo(198, 90)
        .quadraticCurveTo(205, 95, 212, 89)
        .stroke({ width: 2, color: INK, cap: "round" }),
  },
  {
    name: "mouth_happy",
    pivot: { x: 206, y: 91 },
    draw: (g) =>
      g
        .moveTo(196, 88)
        .quadraticCurveTo(205, 104, 214, 87)
        .closePath()
        .fill(INK)
        .ellipse(205, 96, 4, 3)
        .fill(0xe46a7a),
  },
  {
    name: "mouth_angry",
    pivot: { x: 206, y: 91 },
    draw: (g) =>
      g
        .moveTo(198, 93)
        .quadraticCurveTo(205, 87, 212, 92)
        .stroke({ width: 2, color: INK, cap: "round" }),
  },
];

export function createPlaceholderParts(renderer: Renderer): Part[] {
  const frame = new Rectangle(0, 0, CANVAS.width, CANVAS.height);
  return DEFS.map(({ name, pivot, draw }) => {
    const g = new Graphics();
    draw(g);
    const texture = renderer.generateTexture({ target: g, frame });
    const { pixels, width, height } = renderer.extract.pixels(texture);
    g.destroy();
    return { name, texture, pivot, pixels: { data: pixels, width, height } };
  });
}
