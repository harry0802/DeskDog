import { app, BrowserWindow, ipcMain, screen } from "electron";
import { join } from "node:path";
import { createPet, type Display } from "../core/pet";
import { IPC, type OverlayInit } from "../preload/api";

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

app.whenReady().then(() => {
  const pet = createPet({ random: Math.random });
  const { snapshot } = pet.start({ now: Date.now(), displays: petDisplays() });

  ipcMain.handle(IPC.init, (event): OverlayInit => {
    const display = overlays.get(event.sender.id);
    if (!display) throw new Error("Unknown overlay");
    return { displayId: display.id, bounds: display.bounds, snapshot };
  });

  ipcMain.on(IPC.setHit, (event, hit: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(!hit, {
      forward: true,
    });
  });

  for (const display of screen.getAllDisplays()) createOverlay(display);
});

app.on("window-all-closed", () => app.quit());
