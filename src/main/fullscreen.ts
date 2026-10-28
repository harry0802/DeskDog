import { spawn, type ChildProcess } from "node:child_process";

/** 每隔多久查一次（ms，傳給常駐的 PowerShell 迴圈）。 */
const POLL_MS = 2000;

// SHQueryUserNotificationState 的 2（全螢幕程式）會把我們自己蓋滿螢幕、置頂的
// 覆蓋層也算進去，狗狗一出現就把自己藏起來。所以只沿用 3（D3D 全螢幕遊戲）與
// 4（簡報模式），其餘改看前景視窗：不是自己、不是桌面、蓋滿所在螢幕且沒有
// 標題列（最大化的一般視窗有標題列，邊框也會超出螢幕幾 px）。
function script(ownPid: number): string {
  return `
Add-Type -Namespace DD -Name Win -UsingNamespace System.Text -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder name, int max);
[DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int index);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT rect);
[DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
[DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
[DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
public struct RECT { public int L, T, R, B; }
public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
'@
function Test-FullscreenWindow($h) {
  if ($h -eq [IntPtr]::Zero -or $h -eq [DD.Win]::GetShellWindow()) { return 0 }
  $p = [uint32]0
  [void][DD.Win]::GetWindowThreadProcessId($h, [ref]$p)
  if ($p -eq ${ownPid}) { return 0 }
  $class = New-Object System.Text.StringBuilder 64
  [void][DD.Win]::GetClassName($h, $class, 64)
  if ($class.ToString() -in 'Progman', 'WorkerW') { return 0 }
  $WS_CAPTION = 0x00C00000
  if (([DD.Win]::GetWindowLong($h, -16) -band $WS_CAPTION) -eq $WS_CAPTION) { return 0 }
  $r = New-Object DD.Win+RECT
  [void][DD.Win]::GetWindowRect($h, [ref]$r)
  $info = New-Object DD.Win+MONITORINFO
  $info.cbSize = 40
  [void][DD.Win]::GetMonitorInfo([DD.Win]::MonitorFromWindow($h, 2), [ref]$info)
  $m = $info.rcMonitor
  if ($r.L -le $m.L -and $r.T -le $m.T -and $r.R -ge $m.R -and $r.B -ge $m.B) { return 1 }
  return 0
}
function Test-Fullscreen {
  $s = 0
  [void][DD.Win]::SHQueryUserNotificationState([ref]$s)
  if ($s -eq 3 -or $s -eq 4) { return 1 }
  return Test-FullscreenWindow ([DD.Win]::GetForegroundWindow())
}
while ($true) {
  [Console]::Out.WriteLine((Test-Fullscreen))
  Start-Sleep -Milliseconds ${POLL_MS}
}
`;
}

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
        ["-NoProfile", "-NonInteractive", "-Command", script(process.pid)],
        { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
      );
      let buffer = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        const last = lines.at(-1)?.trim();
        if (last !== undefined && last !== "") fullscreen = last === "1";
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
