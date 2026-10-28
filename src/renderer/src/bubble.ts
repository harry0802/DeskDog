// Bubble：在狗狗頭上顯示一句 Line，數秒後淡出；靠近螢幕邊緣時翻到另一側、永不超出螢幕。
import { Container, Graphics, Text } from "pixi.js";
import type { PetSnapshot, Point } from "../../core/pet";

const PADDING = 10;
const MAX_TEXT_WIDTH = 220;
const TAIL = 10;
/** 尾巴距離泡泡側邊的距離。 */
const TAIL_INSET = 24;
/** 與螢幕邊緣保持的距離。 */
const MARGIN = 8;
const MIN_DURATION = 3000;
const MAX_DURATION = 5000;
const PER_CHAR = 120;
const FADE = 400;

export class Bubble {
  readonly view = new Container();
  private readonly background = new Graphics();
  private readonly text = new Text({
    text: "",
    style: {
      fontFamily: "Microsoft JhengHei, sans-serif",
      fontSize: 15,
      fill: 0x2b1d14,
      wordWrap: true,
      breakWords: true,
      wordWrapWidth: MAX_TEXT_WIDTH,
    },
  });
  private remaining = 0;
  private facing: PetSnapshot["facing"] = "left";

  constructor(private readonly screen: { width: number; height: number }) {
    this.view.addChild(this.background, this.text);
    this.view.visible = false;
  }

  /** anchor 為狗狗頭頂，覆蓋層視窗座標。 */
  show(line: string, anchor: Point, facing: PetSnapshot["facing"]): void {
    this.text.text = line;
    this.facing = facing;
    this.follow(anchor);

    this.remaining = clamp(
      MIN_DURATION + line.length * PER_CHAR,
      MIN_DURATION,
      MAX_DURATION
    );
    this.view.alpha = 1;
    this.view.visible = true;
  }

  /** 狗狗移動時（例如拖拽）讓泡泡跟著頭頂。 */
  follow(anchor: Point): void {
    const width = this.text.width + PADDING * 2;
    const height = this.text.height + PADDING * 2;

    // 泡泡預設長在狗狗面向的那一側；超出螢幕就翻到另一側，最後再夾回螢幕內。
    const toward = this.facing === "left" ? -1 : 1;
    let x = toward < 0 ? anchor.x + TAIL_INSET - width : anchor.x - TAIL_INSET;
    if (x < MARGIN || x + width > this.screen.width - MARGIN) {
      x = toward < 0 ? anchor.x - TAIL_INSET : anchor.x + TAIL_INSET - width;
    }
    x = clamp(x, MARGIN, this.screen.width - MARGIN - width);
    const y = Math.max(MARGIN, anchor.y - TAIL - height);
    const tailX = clamp(anchor.x - x, TAIL, width - TAIL);

    this.background
      .clear()
      .roundRect(0, 0, width, height, 12)
      .poly([
        tailX - 7,
        height - 1,
        tailX + 7,
        height - 1,
        tailX,
        height + TAIL,
      ])
      .fill({ color: 0xffffff, alpha: 0.95 })
      .roundRect(0, 0, width, height, 12)
      .stroke({ width: 2, color: 0x2b1d14, alpha: 0.6 });
    this.text.position.set(PADDING, PADDING);
    this.view.position.set(x, y);
  }

  hide(): void {
    this.view.visible = false;
  }

  update(deltaMs: number): void {
    if (!this.view.visible) return;
    this.remaining -= deltaMs;
    this.view.alpha = clamp(this.remaining / FADE, 0, 1);
    if (this.remaining <= 0) this.view.visible = false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
