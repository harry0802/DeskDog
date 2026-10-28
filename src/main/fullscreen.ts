import { spawn, type ChildProcess } from "node:child_process";

/** 每隔多久查一次（ms，傳給常駐的 PowerShell 迴圈）。 */
const POLL_MS = 2000;

// SHQueryUserNotificationState：2 = 全螢幕程式、3 = D3D 全螢幕遊戲、4 = 簡報模式。
const SCRIPT = `
Add-Type -Namespace DD -Name Shell -MemberDefinition '[System.Runtime.InteropServices.DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);'
while ($true) {
  $s = 0
  [void][DD.Shell]::SHQueryUserNotificationState([ref]$s)
  [Console]::Out.WriteLine($s)
  Start-Sleep -Milliseconds ${POLL_MS}
}
`;

/** 前景是否為全螢幕程式的最新判斷；非 Windows 或偵測失敗時恆為 false。 */
export interface FullscreenWatcher {
  isFullscreen(): boolean;
  stop(): void;
}

/** 常駐一個 PowerShell 子行程輸出狀態，避免每次輪詢都付出啟動成本。 */
export function watchFullscreen(): FullscreenWatcher {
  let fullscreen = false;
  let child: ChildProcess | undefined;
  if (process.platform === "win32") {
    try {
      child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", SCRIPT],
        { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
      );
      let buffer = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        const last = lines.at(-1)?.trim();
        if (last !== undefined && last !== "") {
          fullscreen = ["2", "3", "4"].includes(last);
        }
      });
      child.on("error", () => (fullscreen = false));
      child.on("exit", () => (fullscreen = false));
    } catch {
      fullscreen = false;
    }
  }
  return {
    isFullscreen: () => fullscreen,
    stop: () => child?.kill(),
  };
}
