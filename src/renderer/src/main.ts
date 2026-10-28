// CSP 不允許 unsafe-eval，改用 Pixi 預先產生的 shader 同步程式。
import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import { createPlaceholderParts } from "./parts";
import { Rig } from "./rig";

const { displayId, bounds, snapshot } = await window.deskdog.init();

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
rig.apply(snapshot);
app.stage.addChild(rig.view);

// 視窗穿透時仍會收到 mousemove（forward: true），據此切換是否攔截滑鼠。
let hit = false;
window.addEventListener("mousemove", (e) => {
  const next = rig.hitTest({ x: e.clientX, y: e.clientY });
  if (next === hit) return;
  hit = next;
  window.deskdog.setHit(hit);
});
