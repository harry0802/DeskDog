// 愛心特效：撫摸（Pat 後持續摸著）期間從頭上冒出愛心，往上飄並淡出。
import { Container, Graphics, GraphicsContext } from "pixi.js";
import type { Point } from "../../core/pet";

/** 持續撫摸時每隔多久冒一顆（ms）。 */
const SPAWN_INTERVAL = 350;
/** 開始撫摸時一次冒出的數量。 */
const BURST = 3;
const LIFETIME = 1200;
const RISE = 70;
const SPREAD = 18;
const SWAY = 6;

const HEART = new GraphicsContext()
  .circle(-4, -2, 4.4)
  .circle(4, -2, 4.4)
  .poly([-8.2, -0.5, 8.2, -0.5, 0, 9])
  .fill(0xff5c8a);

interface Heart {
  readonly view: Graphics;
  readonly origin: Point;
  readonly phase: number;
  age: number;
}

export class Hearts {
  readonly view = new Container();
  private readonly hearts: Heart[] = [];
  private active = false;
  private untilNextSpawn = 0;

  /** anchor 回傳愛心冒出的位置（狗狗頭上），覆蓋層視窗座標。 */
  constructor(private readonly anchor: () => Point) {}

  setActive(active: boolean): void {
    if (active && !this.active) {
      for (let i = 0; i < BURST; i++) this.spawn();
      this.untilNextSpawn = SPAWN_INTERVAL;
    }
    this.active = active;
  }

  update(deltaMs: number): void {
    if (this.active) {
      this.untilNextSpawn -= deltaMs;
      if (this.untilNextSpawn <= 0) {
        this.spawn();
        this.untilNextSpawn += SPAWN_INTERVAL;
      }
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const heart = this.hearts[i]!;
      heart.age += deltaMs;
      const t = heart.age / LIFETIME;
      if (t >= 1) {
        heart.view.destroy();
        this.hearts.splice(i, 1);
        continue;
      }
      heart.view.position.set(
        heart.origin.x + Math.sin(heart.phase + t * Math.PI * 2) * SWAY,
        heart.origin.y - t * RISE
      );
      heart.view.alpha = 1 - t * t;
      heart.view.scale.set(0.8 + t * 0.5);
    }
  }

  private spawn(): void {
    const { x, y } = this.anchor();
    const view = new Graphics(HEART);
    this.view.addChild(view);
    this.hearts.push({
      view,
      origin: { x: x + (Math.random() * 2 - 1) * SPREAD, y },
      phase: Math.random() * Math.PI * 2,
      age: 0,
    });
  }
}
