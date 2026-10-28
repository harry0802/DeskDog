// CSP 不允許 unsafe-eval，改用 Pixi 預先產生的 shader 同步程式。
import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import type { Motion, PetOutput, PointerEvent } from "../../core/pet";
import { Bubble } from "./bubble";
import { DebugPanel } from "./debug-panel";
import { Hearts } from "./hearts";
import { createPlaceholderParts } from "./parts";
import { Rig } from "./rig";
import { Zzz } from "./zzz";

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

const rig = new Rig(createPlaceholderParts(app.renderer), bounds);
const bubble = new Bubble(bounds);
// 愛心從頭頂下方一點冒出，往上飄過耳朵。
const hearts = new Hearts(() => {
  const { x, y } = rig.headTop();
  return { x, y: y + 30 };
});
const zzz = new Zzz(() => {
  const { x, y } = rig.headTop();
  return { x, y: y + 10 };
});
app.stage.addChild(rig.view, hearts.view, zzz.view, bubble.view);
// 除錯面板只在開發模式（pnpm dev）建立。
const debugPanel = import.meta.env.DEV ? new DebugPanel(bounds) : undefined;
if (debugPanel) app.stage.addChild(debugPanel.view);
app.ticker.add((ticker) => {
  rig.update(ticker.deltaMS);
  hearts.update(ticker.deltaMS);
  zzz.update(ticker.deltaMS);
  bubble.update(ticker.deltaMS);
});

/** 抱著狗狗時游標變成抓取狀態。 */
const isCarried = (motion: Motion) =>
  motion === "pickedUp" || motion === "dragging";

/** 前景全螢幕而隱藏中：不回應游標，也不攔截滑鼠。 */
let hidden = false;

function render({ snapshot, effects }: PetOutput): void {
  // 每個覆蓋層都畫狗狗（超出螢幕的部分自然被裁掉），跨在螢幕邊上時不會斷掉。
  rig.apply(snapshot);
  const here = snapshot.displayId === displayId;
  // 核心建議的 fps；0 為隱藏，停止繪製。
  hidden = snapshot.hidden;
  document.body.style.visibility = hidden ? "hidden" : "";
  if (hidden) setHit(false);
  if (snapshot.fps === 0) {
    app.ticker.stop();
  } else {
    app.ticker.maxFPS = snapshot.fps;
    if (!app.ticker.started) app.ticker.start();
  }
  document.body.style.cursor = isCarried(snapshot.motion) ? "grabbing" : "";
  // 拖拽中 Bubble 跟著頭頂走。
  if (bubble.view.visible) bubble.follow(rig.headTop());
  debugPanel?.show(snapshot, rig.footprint(), here);
  hearts.setActive(snapshot.afterglow && here);
  zzz.setActive(snapshot.motion === "sleeping" && here);
  // 只有狗狗所在螢幕的覆蓋層演出效果；狗狗被抱走時收起這裡的 Bubble。
  if (!here) {
    bubble.hide();
    return;
  }
  for (const effect of effects) {
    if (effect.type === "say") {
      bubble.show(effect.line, rig.headTop(), snapshot.facing);
    } else if (effect.type === "playAnimation") {
      if (effect.animation === "hmph") rig.playHmph();
      else if (effect.animation === "rubEyes") rig.playRubEyes();
      else if (effect.animation === "dreamWag") rig.playDreamWag();
      else rig.playGreeting();
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
    hit: rig.hitTest({ x: e.clientX, y: e.clientY }),
  });
}

window.addEventListener("mousemove", (e) => {
  if (hidden) return;
  rig.lookAt({ x: e.clientX, y: e.clientY });
  if (pressed) {
    sendPointer("move", e);
    return;
  }
  setHit(rig.hitTest({ x: e.clientX, y: e.clientY }) !== "none");
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
  setHit(rig.hitTest({ x: e.clientX, y: e.clientY }) !== "none");
});
