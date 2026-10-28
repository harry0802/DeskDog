// CSP 不允許 unsafe-eval，改用 Pixi 預先產生的 shader 同步程式。
import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import type { PetOutput, PointerEvent } from "../../core/pet";
import { Bubble } from "./bubble";
import { DebugPanel } from "./debug-panel";
import { Hearts } from "./hearts";
import { createPlaceholderParts } from "./parts";
import { Rig } from "./rig";

const { displayId, bounds, output } = await window.deskdog.init();

const app = new Application();
await app.init({
  backgroundAlpha: 0,
  resizeTo: window,
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
});
app.ticker.maxFPS = 30;
document.body.appendChild(app.canvas);

const rig = new Rig(createPlaceholderParts(app.renderer), displayId, bounds);
const bubble = new Bubble(bounds);
// 愛心從頭頂下方一點冒出，往上飄過耳朵。
const hearts = new Hearts(() => {
  const { x, y } = rig.headTop();
  return { x, y: y + 30 };
});
app.stage.addChild(rig.view, hearts.view, bubble.view);
// 除錯面板只在開發模式（pnpm dev）建立。
const debugPanel = import.meta.env.DEV ? new DebugPanel(bounds) : undefined;
if (debugPanel) app.stage.addChild(debugPanel.view);
app.ticker.add((ticker) => {
  rig.update(ticker.deltaMS);
  hearts.update(ticker.deltaMS);
  bubble.update(ticker.deltaMS);
});

function render({ snapshot, effects }: PetOutput): void {
  rig.apply(snapshot);
  debugPanel?.show(snapshot, rig.footprint(), rig.view.visible);
  hearts.setActive(snapshot.afterglow && rig.view.visible);
  // 只有狗狗所在螢幕的覆蓋層演出效果。
  if (!rig.view.visible) return;
  for (const effect of effects) {
    if (effect.type === "say") {
      bubble.show(effect.line, rig.headTop(), snapshot.facing);
    } else {
      rig.playGreeting();
    }
  }
}

render(output);
window.deskdog.onOutput(render);

// 視窗穿透時仍會收到 mousemove（forward: true），據此切換是否攔截滑鼠。
// 按住期間持續攔截，確保收得到放開事件。
let hit = false;
let pressed = false;

function setHit(next: boolean): void {
  if (next === hit) return;
  hit = next;
  window.deskdog.setHit(hit);
}

function sendPointer(type: PointerEvent["type"], e: MouseEvent): void {
  window.deskdog.pointer({
    type,
    time: Date.now(),
    position: { x: e.clientX + bounds.x, y: e.clientY + bounds.y },
    hitBody: rig.hitTest({ x: e.clientX, y: e.clientY }),
  });
}

window.addEventListener("mousemove", (e) => {
  if (pressed) {
    sendPointer("move", e);
    return;
  }
  setHit(rig.hitTest({ x: e.clientX, y: e.clientY }));
});

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  pressed = true;
  sendPointer("down", e);
});

window.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !pressed) return;
  pressed = false;
  sendPointer("up", e);
  setHit(rig.hitTest({ x: e.clientX, y: e.clientY }));
});
