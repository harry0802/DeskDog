import { dialog, Menu, nativeImage, Tray } from "electron";

/** 16x16 橘色圓點，系統列圖示的佔位。 */
const ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAO0lEQVR4nGNgoAV4MM3hPzZMkWaiDCGkGa8hxGrGagipmjEMGTWACgZQHI1USUjEGoJXMyFDiNJMKgAA/oWmXP0/Er8AAAAASUVORK5CYII=";

export interface TrayActions {
  setVisible(visible: boolean): void;
  resetAffection(): void;
  quit(): void;
}

/** 建立系統列圖示與選單；「開啟設定」由設定視窗的票接上。 */
export function createTray(actions: TrayActions): Tray {
  const tray = new Tray(nativeImage.createFromDataURL(ICON));
  tray.setToolTip("DeskDog");
  let visible = true;

  function render(): void {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? "隱藏狗狗" : "顯示狗狗",
          click: () => {
            visible = !visible;
            actions.setVisible(visible);
            render();
          },
        },
        {
          label: "重置好感度…",
          click: () => {
            const choice = dialog.showMessageBoxSync({
              type: "warning",
              buttons: ["重置", "取消"],
              defaultId: 1,
              cancelId: 1,
              title: "重置好感度",
              message: "確定要重置好感度嗎？",
              detail: "好感度會回到預設值，設定不會改變。",
            });
            if (choice === 0) actions.resetAffection();
          },
        },
        { type: "separator" },
        { label: "結束 DeskDog", click: () => actions.quit() },
      ])
    );
  }
  render();
  tray.on("click", () => tray.popUpContextMenu());
  return tray;
}
