// Rig：把核心快照映射成 Part 的變換（ADR-0002），並做逐像素命中。
import { Container, Sprite } from "pixi.js";
import type { DisplayId, PetSnapshot, Point, Rect } from "../../core/pet";
import { CANVAS, FEET, type Part } from "./parts";

/** Part alpha 超過 10% 才算命中。 */
const HIT_ALPHA = 255 * 0.1;

interface RiggedPart {
  readonly part: Part;
  readonly sprite: Sprite;
}

export class Rig {
  readonly view = new Container();
  private readonly parts: RiggedPart[];

  constructor(
    parts: readonly Part[],
    private readonly displayId: DisplayId,
    private readonly bounds: Rect
  ) {
    this.view.pivot.set(FEET.x, FEET.y);
    this.parts = parts.map((part) => {
      const sprite = new Sprite(part.texture);
      sprite.pivot.set(part.pivot.x, part.pivot.y);
      sprite.position.set(part.pivot.x, part.pivot.y);
      this.view.addChild(sprite);
      return { part, sprite };
    });
  }

  apply(snapshot: PetSnapshot): void {
    this.view.visible = snapshot.displayId === this.displayId;
    this.view.position.set(
      snapshot.position.x - this.bounds.x,
      snapshot.position.y - this.bounds.y
    );
    // 佔位 Part 面向右；面向左時水平翻轉。
    this.view.scale.x = snapshot.facing === "left" ? -1 : 1;
  }

  /** point 為覆蓋層視窗座標。 */
  hitTest(point: Point): boolean {
    if (!this.view.visible) return false;
    // 游標遠離時直接判定未命中。
    if (!this.view.getBounds().containsPoint(point.x, point.y)) return false;
    return this.parts.some(({ part, sprite }) => {
      const local = sprite.toLocal(point);
      if (
        local.x < 0 ||
        local.y < 0 ||
        local.x >= CANVAS.width ||
        local.y >= CANVAS.height
      ) {
        return false;
      }
      const { data, width, height } = part.pixels;
      const px = Math.floor((local.x / CANVAS.width) * width);
      const py = Math.floor((local.y / CANVAS.height) * height);
      return (data[(py * width + px) * 4 + 3] ?? 0) > HIT_ALPHA;
    });
  }
}
