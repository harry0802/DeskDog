// 開發用除錯面板：顯示 Mood、Motion、Affection 與 Afterglow，只在開發模式出現。
import { Container, Graphics, Text } from "pixi.js";
import type { PetSnapshot, Rect } from "../../core/pet";

const PADDING = 8;
/** 與狗狗、螢幕邊緣保持的距離。 */
const GAP = 8;
/** 面板頂端距離狗狗畫布頂端的距離，避開頭上的 Bubble。 */
const TOP_OFFSET = 40;

export class DebugPanel {
  readonly view = new Container();
  private readonly background = new Graphics();
  private readonly text = new Text({
    text: "",
    style: {
      fontFamily: "Consolas, Microsoft JhengHei, monospace",
      fontSize: 13,
      fill: 0xffffff,
      lineHeight: 18,
    },
  });

  constructor(private readonly screen: { width: number; height: number }) {
    this.view.addChild(this.background, this.text);
    this.text.position.set(PADDING, PADDING);
  }

  /** dog 為狗狗畫布範圍（不含跳躍），覆蓋層視窗座標。 */
  show(snapshot: PetSnapshot, dog: Rect, visible: boolean): void {
    this.view.visible = visible;
    if (!visible) return;

    this.text.text = [
      `Mood:      ${snapshot.mood}`,
      `Motion:    ${snapshot.motion}`,
      `Affection: ${snapshot.affection}`,
      `Afterglow: ${snapshot.afterglow ? "摸著中" : "—"}`,
    ].join("\n");
    const width = this.text.width + PADDING * 2;
    const height = this.text.height + PADDING * 2;
    this.background
      .clear()
      .roundRect(0, 0, width, height, 6)
      .fill({ color: 0x000000, alpha: 0.7 });

    // 優先放在狗狗背後（尾巴那側），放不下就放到面前；最後夾回螢幕內。
    const behind =
      snapshot.facing === "left"
        ? dog.x + dog.width + GAP
        : dog.x - GAP - width;
    const front =
      snapshot.facing === "left"
        ? dog.x - GAP - width
        : dog.x + dog.width + GAP;
    const fits = (x: number) =>
      x >= GAP && x + width <= this.screen.width - GAP;
    const x = clamp(
      fits(behind) ? behind : front,
      GAP,
      this.screen.width - GAP - width
    );
    const y = clamp(dog.y + TOP_OFFSET, GAP, this.screen.height - GAP - height);
    this.view.position.set(x, y);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
