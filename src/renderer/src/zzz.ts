// Zzz 特效：睡覺期間從頭上冒出 Z，往上飄並淡出。
import { Container, Text } from "pixi.js";
import type { Point } from "../../core/pet";

/** 每隔多久冒一個 Z（ms）。 */
const SPAWN_INTERVAL = 1200;
const LIFETIME = 3000;
const RISE = 50;
const DRIFT = 22;
const FONT_SIZE = 18;

interface Z {
  readonly view: Text;
  readonly origin: Point;
  age: number;
}

export class Zzz {
  readonly view = new Container();
  private readonly zs: Z[] = [];
  private active = false;
  private untilNextSpawn = 0;

  /** anchor 回傳 Z 冒出的位置（狗狗頭上），覆蓋層視窗座標。 */
  constructor(private readonly anchor: () => Point) {}

  setActive(active: boolean): void {
    if (active && !this.active) this.untilNextSpawn = 0;
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
    for (let i = this.zs.length - 1; i >= 0; i--) {
      const z = this.zs[i]!;
      z.age += deltaMs;
      const t = z.age / LIFETIME;
      if (t >= 1) {
        z.view.destroy();
        this.zs.splice(i, 1);
        continue;
      }
      z.view.position.set(z.origin.x + t * DRIFT, z.origin.y - t * RISE);
      z.view.alpha = 1 - t * t;
      z.view.scale.set(0.7 + t * 0.6);
    }
  }

  private spawn(): void {
    const view = new Text({
      text: "Z",
      style: {
        fontSize: FONT_SIZE,
        fontWeight: "bold",
        fill: 0x6b7bb8,
        stroke: { color: 0xffffff, width: 3 },
      },
    });
    view.anchor.set(0.5);
    this.view.addChild(view);
    this.zs.push({ view, origin: this.anchor(), age: 0 });
  }
}
