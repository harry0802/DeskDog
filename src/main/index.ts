import { app, BrowserWindow, ipcMain, powerMonitor, screen } from "electron";
import { join } from "node:path";
import {
  createPet,
  type Display,
  type PetOutput,
  type PointerEvent,
} from "../core/pet";
import { IPC, type OverlayInit } from "../preload/api";
import lines from "./lines.json";
import { watchFullscreen } from "./fullscreen";
import { readJson, writeJson } from "./store";
import { createTray } from "./tray";

/** 核心 tick 間隔（ms）；Pat 判定依賴它。 */
const TICK_INTERVAL = 100;
/** 距上次輸入不到這麼久，游標又沒動，就當作使用者正在打字（s）。 */
const TYPING_IDLE = 2;

/** 狗狗在動（抱起、下落、落地）時加快 tick，讓下落平順（ms）。 */
const ACTIVE_TICK_INTERVAL = 16;

// 每個螢幕一個全螢幕透明覆蓋層（ADR-0001）。key 為 webContents id。
const overlays = new Map<number, Electron.Display>();

function petDisplays(): Display[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    primary: d.id === primaryId,
    workArea: d.workArea,
  }));
}

function createOverlay(display: Electron.Display): void {
  const win = new BrowserWindow({
    ...display.bounds,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  // 部分系統會把初始大小夾在工作區域內，建立後再設一次確保蓋滿整個螢幕。
  win.setBounds(display.bounds);
  win.setIgnoreMouseEvents(true, { forward: true });
  overlays.set(win.webContents.id, display);
  win.on("closed", () => overlays.delete(win.webContents.id));
  win.once("ready-to-show", () => win.showInactive());

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

/** %APPDATA%/DeskDog 下的存檔。 */
function saveFile(name: "pet-state" | "settings"): string {
  return join(app.getPath("appData"), "DeskDog", `${name}.json`);
}

/** 核心要求存檔時寫入 pet-state 與 settings；寫入失敗不影響狗狗。 */
function persist({ effects }: PetOutput): void {
  for (const effect of effects) {
    if (effect.type !== "save") continue;
    try {
      writeJson(saveFile("pet-state"), effect.petState);
      writeJson(saveFile("settings"), effect.settings);
    } catch (error) {
      console.error("Failed to save", error);
    }
  }
}

app.whenReady().then(() => {
  const pet = createPet({ random: Math.random, lines });
  const started = pet.start({
    now: Date.now(),
    displays: petDisplays(),
    saved: readJson(saveFile("pet-state")),
    settings: readJson(saveFile("settings")),
  });
  let snapshot = started.snapshot;

  ipcMain.handle(IPC.init, (event): OverlayInit => {
    const display = overlays.get(event.sender.id);
    if (!display) throw new Error("Unknown overlay");
    return {
      displayId: display.id,
      bounds: display.bounds,
      output: { snapshot, effects: started.effects },
    };
  });

  /** 先處理存檔；快照有變化或有其他效果時才通知覆蓋層。 */
  function publish(output: PetOutput): void {
    persist(output);
    const effects = output.effects.filter((e) => e.type !== "save");
    if (output.snapshot === snapshot && effects.length === 0) return;
    snapshot = output.snapshot;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.output, { ...output, effects });
    }
  }

  ipcMain.on(IPC.pointer, (_event, pointer: PointerEvent) => {
    publish(pet.pointer(pointer));
  });

  // 不掛全域鍵盤鉤子：剛有輸入、但游標沒動，視為正在打字。
  let lastCursor = screen.getCursorScreenPoint();
  function typing(afkSeconds: number): boolean {
    const cursor = screen.getCursorScreenPoint();
    const moved = cursor.x !== lastCursor.x || cursor.y !== lastCursor.y;
    lastCursor = cursor;
    return afkSeconds < TYPING_IDLE && !moved;
  }

  const fullscreenWatcher = watchFullscreen();

  function loop(): void {
    const afkSeconds = powerMonitor.getSystemIdleTime();
    const date = new Date();
    publish(
      pet.tick({
        now: date.getTime(),
        displays: petDisplays(),
        afkSeconds,
        typing: typing(afkSeconds),
        fullscreen: fullscreenWatcher.isFullscreen(),
        hour: date.getHours() + date.getMinutes() / 60,
      })
    );
    const resting =
      snapshot.motion === "idle" || snapshot.motion === "sleeping";
    setTimeout(loop, resting ? TICK_INTERVAL : ACTIVE_TICK_INTERVAL);
  }
  setTimeout(loop, TICK_INTERVAL);

  ipcMain.on(IPC.setHit, (event, hit: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(!hit, {
      forward: true,
    });
  });

  app.on("before-quit", () => fullscreenWatcher.stop());
  app.on("before-quit", () => persist(pet.stop({ now: Date.now() })));

  // 保持參考，避免系統列圖示被垃圾回收。
  const tray = createTray({
    setVisible: (visible) => publish(pet.setVisible(visible)),
    resetAffection: () => publish(pet.resetAffection()),
    quit: () => app.quit(),
  });
  app.on("before-quit", () => tray.destroy());

  for (const display of screen.getAllDisplays()) createOverlay(display);
});

app.on("window-all-closed", () => app.quit());
