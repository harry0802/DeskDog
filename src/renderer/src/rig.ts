// Rig：把核心快照映射成 Part 的變換（ADR-0002），並做逐像素命中。
import { Container, Sprite } from "pixi.js";
import type { DisplayId, PetSnapshot, Point, Rect } from "../../core/pet";
import { CANVAS, FEET, HEAD_TOP, type Part } from "./parts";

/** Part alpha 超過 10% 才算命中。 */
const HIT_ALPHA = 255 * 0.1;
/** Greeting：原地小跳兩下。 */
const GREETING_DURATION = 700;
const GREETING_HOPS = 2;
const GREETING_HEIGHT = 18;

interface RiggedPart {
  readonly part: Part;
  readonly sprite: Sprite;
}

export class Rig {
  readonly view = new Container();
  private readonly parts: RiggedPart[];
  private base: Point = { x: 0, y: 0 };
  private greetingElapsed = GREETING_DURATION;

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
    this.base = {
      x: snapshot.position.x - this.bounds.x,
      y: snapshot.position.y - this.bounds.y,
    };
    this.view.position.set(this.base.x, this.base.y);
    // 佔位 Part 面向右；面向左時水平翻轉。
    this.view.scale.x = snapshot.facing === "left" ? -1 : 1;
  }

  playGreeting(): void {
    this.greetingElapsed = 0;
  }

  update(deltaMs: number): void {
    if (this.greetingElapsed >= GREETING_DURATION) return;
    this.greetingElapsed = Math.min(
      GREETING_DURATION,
      this.greetingElapsed + deltaMs
    );
    const phase = (this.greetingElapsed / GREETING_DURATION) * GREETING_HOPS;
    const hop = Math.abs(Math.sin(phase * Math.PI)) * GREETING_HEIGHT;
    this.view.position.set(this.base.x, this.base.y - hop);
  }

  /** 頭頂位置（不含跳躍），覆蓋層視窗座標；Bubble 的錨點。 */
  headTop(): Point {
    const sign = this.view.scale.x;
    return {
      x: this.base.x + (HEAD_TOP.x - FEET.x) * sign,
      y: this.base.y + (HEAD_TOP.y - FEET.y),
    };
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
