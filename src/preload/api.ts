// 主行程 ↔ 覆蓋層的 IPC 介面；只含型別，renderer 與 preload 共用。
import type { DisplayId, PetOutput, PointerEvent, Rect } from "../core/pet";

export interface OverlayInit {
  readonly displayId: DisplayId;
  /** 此覆蓋層所在螢幕的完整範圍（含工作列），螢幕座標。 */
  readonly bounds: Rect;
  /** 目前快照，以及啟動時的效果（Greeting）。 */
  readonly output: PetOutput;
}

export interface DeskDogApi {
  init(): Promise<OverlayInit>;
  /** 回報游標是否命中狗狗身體；未命中時主行程讓滑鼠穿透。 */
  setHit(hit: boolean): void;
  pointer(event: PointerEvent): void;
  /** 核心每次產生輸出時通知所有覆蓋層。 */
  onOutput(listener: (output: PetOutput) => void): void;
}

export const IPC = {
  init: "overlay:init",
  setHit: "overlay:set-hit",
  pointer: "pet:pointer",
  output: "pet:output",
} as const;
