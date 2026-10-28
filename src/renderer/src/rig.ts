// Rig：把核心快照映射成 Part 的變換（ADR-0002），並做逐像素命中。
import { Container, Sprite } from "pixi.js";
import type { DisplayId, Mood, PetSnapshot, Point, Rect } from "../../core/pet";
import { CANVAS, FEET, HEAD_TOP, type Part } from "./parts";

/** Part alpha 超過 10% 才算命中。 */
const HIT_ALPHA = 255 * 0.1;
/** Greeting：原地小跳兩下。 */
const GREETING_DURATION = 700;
const GREETING_HOPS = 2;
const GREETING_HEIGHT = 18;
/** happy：每隔一段時間跳一下，尾巴快速擺動。 */
const HAPPY_HOP_PERIOD = 1600;
const HAPPY_HOP_DURATION = 320;
const HAPPY_HOP_HEIGHT = 14;
const HAPPY_WAG_PERIOD = 240;
const HAPPY_WAG_ANGLE = 0.35;

/** 各 Mood 顯示的表情 Part；未列出的眼睛、嘴巴 Part 隱藏。 */
const EXPRESSIONS: Partial<Record<Mood, readonly string[]>> = {
  happy: ["eyes_happy", "mouth_happy"],
};
const DEFAULT_EXPRESSION = ["eyes_open", "mouth_idle"];
const isExpression = (name: string) =>
  name.startsWith("eyes_") || name.startsWith("mouth_");

interface RiggedPart {
  readonly part: Part;
  readonly sprite: Sprite;
}

export class Rig {
  readonly view = new Container();
  private readonly parts: RiggedPart[];
  private readonly tail: Sprite | undefined;
  private base: Point = { x: 0, y: 0 };
  private mood: Mood = "normal";
  private elapsed = 0;
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
    this.tail = this.parts.find(({ part }) => part.name === "tail")?.sprite;
    this.showExpression();
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
    if (snapshot.mood !== this.mood) {
      this.mood = snapshot.mood;
      this.showExpression();
    }
  }

  playGreeting(): void {
    this.greetingElapsed = 0;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.greetingElapsed = Math.min(
      GREETING_DURATION,
      this.greetingElapsed + deltaMs
    );
    const happy = this.mood === "happy";

    const greetingPhase =
      (this.greetingElapsed / GREETING_DURATION) * GREETING_HOPS;
    const greetingHop =
      Math.abs(Math.sin(greetingPhase * Math.PI)) * GREETING_HEIGHT;
    const hopTime = this.elapsed % HAPPY_HOP_PERIOD;
    const happyHop =
      happy && hopTime < HAPPY_HOP_DURATION
        ? Math.sin((hopTime / HAPPY_HOP_DURATION) * Math.PI) * HAPPY_HOP_HEIGHT
        : 0;
    this.view.position.set(
      this.base.x,
      this.base.y - Math.max(greetingHop, happyHop)
    );

    if (this.tail) {
      this.tail.rotation = happy
        ? Math.sin((this.elapsed / HAPPY_WAG_PERIOD) * Math.PI * 2) *
          HAPPY_WAG_ANGLE
        : 0;
    }
  }

  /** 狗狗畫布範圍（不含跳躍），覆蓋層視窗座標。 */
  footprint(): Rect {
    return {
      x: this.base.x - FEET.x,
      y: this.base.y - FEET.y,
      width: CANVAS.width,
      height: CANVAS.height,
    };
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
      if (!sprite.visible) return false;
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

  private showExpression(): void {
    const shown = EXPRESSIONS[this.mood] ?? DEFAULT_EXPRESSION;
    for (const { part, sprite } of this.parts) {
      if (isExpression(part.name)) sprite.visible = shown.includes(part.name);
    }
  }
}
