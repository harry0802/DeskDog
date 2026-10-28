# Ralph

Ralph 是一個會自己做 GitHub issue 的 AI 代理迴圈。它會從 DeskDog 標了 `ready-for-agent` 的 issue 裡挑一個，寫程式、跑檢查、commit、回報到 issue 上，然後換下一個，直到沒有 issue 可做或跑滿你設定的次數。

名字來自社群的「Ralph 模式」：用一個簡單的迴圈，把同一份 prompt 一直丟給 Claude。

## 一輪在做什麼

```
afk.sh（主機，Git Bash）
 └─ 每一輪啟動一個新的 Podman 容器（lib.sh）
     └─ inside.sh（容器內）
         1. pnpm install
         2. 用 gh 抓所有 open 且標了 ready-for-agent 的 issue（含留言）
            → 一個都沒有就直接結束，不呼叫 Claude
         3. 抓最近 10 個 RALPH: commit
         4. prompt.md + 上面兩份資料 → 交給 claude
             └─ Claude：挑一個 issue → 照 do-work skill 做完它
                （規劃 → Red Green Refactor → type-check / test → commit → QA 步驟）
                → 關閉 issue（附 QA 步驟）或留言
 └─ 輸出單獨一行 <promise>COMPLETE</promise> → 提早停止；否則跑下一輪
```

每一輪都是**全新的 Claude**，不記得上一輪的事。上一輪做到哪裡，靠下面兩樣東西傳下去：

- **`RALPH:` 開頭的 commit 訊息**：寫了關鍵決策、改了哪些檔案、下一輪要注意什麼
- **issue 留言**：沒做完的 issue，Ralph 會留言記錄進度，下一輪讀到後接著做

## 檔案

| 檔案                                  | 作用                                                                                                                                 | 你會改它嗎                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `once.ps1`、`afk.ps1`、`git-bash.ps1` | PowerShell 的入口：找到 Git Bash，再執行對應的 `.sh`                                                                                 | 不會                                                  |
| `once.sh`                             | 只跑一輪，**互動模式**：你看得到 Claude 在做什麼，它要執行指令時會先問你                                                             | 不會                                                  |
| `afk.sh`                              | 跑 N 輪，**無人值守**：不會問你，跑完再回來看結果                                                                                    | 不會                                                  |
| `prompt.md`                           | Ralph 專屬的規則：怎麼挑 issue、`RALPH:` commit 前綴、怎麼回報 issue。實際怎麼寫程式和跑測試，交給 `.claude/skills/do-work/SKILL.md` | **會：挑 issue 的規則改這裡；寫程式的流程改 do-work** |
| `inside.sh`                           | 容器裡每一輪的步驟（安裝套件、抓 issue、組 prompt、呼叫 claude）                                                                     | 很少                                                  |
| `lib.sh`                              | 怎麼啟動容器（掛載 repo、帶入 token 和 git 身分）                                                                                    | 很少                                                  |
| `.env.example`                        | `.env` 的範本                                                                                                                        | 不會                                                  |
| `.env`                                | 你的 token（已 gitignore，不會進 git）                                                                                               | 填一次                                                |

## 第一次設定

1. **Podman 要先啟動**（每次重開機後都要）：`podman machine start`。podman 不在 PATH 上的話，用完整路徑：`& "C:\Program Files\RedHat\Podman\podman.exe" machine start`
2. **容器映像檔**：Ralph 用的是 Sandcastle 建好的 `sandcastle:deskdog`。如果不見了，執行：
   `pnpm exec sandcastle podman build-image --image-name sandcastle:deskdog`
3. **Token**：`cp ralph/.env.example ralph/.env`，然後填入：
   - `CLAUDE_CODE_OAUTH_TOKEN`：在主機上跑 `claude setup-token` 取得，用的是你的 Claude 訂閱額度
   - `GH_TOKEN`：GitHub fine-grained token，只開放 `harry0802/DeskDog`，權限是 Issues **Read and write**、Metadata Read

## 使用

在 repo 根目錄執行。先開一個分支，因為 Ralph 會直接 commit 到目前分支：

```bash
git switch -c ralph/<這批工作的名字>
```

**PowerShell**（`.ps1` 會自己找到 Git Bash 來跑）：

```powershell
.\ralph\once.ps1      # 第一次或改過 prompt 後：跑一輪看看
.\ralph\afk.ps1 5     # 放心後：最多跑 5 輪
```

**Git Bash**：

```bash
bash ralph/once.sh
bash ralph/afk.sh 5
```

> 在 PowerShell 裡**不要**打 `bash ralph/afk.sh`：那個 `bash` 可能是 WSL 的，不是 Git Bash，會找不到 podman。也不要直接打 `ralph/afk.sh`，PowerShell 不會執行 `.sh` 檔。

跑完後：

- `git log --oneline` 看 `RALPH:` commit
- 到 GitHub 看哪些 issue 被關閉、哪些有新留言
- 確認沒問題就把分支合併回去

## 怎麼控制 Ralph 做哪些事

- **要它做的 issue**：標上 `ready-for-agent`。沒標的 issue 它完全看不到。
- **不要它碰的 issue**：拿掉標籤，或改標 `ready-for-human`。
- **大型 issue（多階段計畫）**：它一輪只做一個階段，做完就留言，下一輪再接著做。
- **改優先順序**：編輯 `prompt.md` 的 `TASK SELECTION` 段。
- **改寫程式、跑測試、commit 的方式**：編輯 `.claude/skills/do-work/SKILL.md`。你平常打 `/do-work` 和 Ralph 用的是同一份，改一次兩邊都生效。容器掛載的是你的工作目錄，所以**還沒 commit 的修改也會被 Ralph 讀到**。

## 安全設計

- `afk.sh` 讓 Claude 在不詢問的情況下執行任何指令（`--dangerously-skip-permissions`）。這之所以可以接受，是因為它在容器裡，**只看得到這個 repo 資料夾**，碰不到你電腦上的其他東西。
- Ralph **只會 commit，不會 push**。
- GitHub token 只給 issue 權限，沒辦法改程式碼或設定。
- 你沒 commit 的修改不會被它帶進 commit：prompt 規定它只能 stage 自己改的檔案。
- 容器的 `node_modules` 放在獨立的 Podman volume（`deskdog-ralph-node-modules`），不會覆蓋主機上 Windows 的 `node_modules`。

## 常見問題

| 狀況                                                                  | 原因／解法                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `Ralph needs Git Bash, but this is another bash (likely WSL)`         | 在 PowerShell 打了 `bash ...`，改用 `.\ralph\afk.ps1`     |
| `wsl: Failed to start the systemd user session`                       | 同上：PowerShell 的 `bash` 叫到了 WSL                     |
| `Missing ralph/.env`                                                  | 還沒建 `.env`，見「第一次設定」                           |
| `Missing image sandcastle:deskdog`                                    | 映像檔不見了，見「第一次設定」第 2 步                     |
| 連不上 Podman                                                         | 先跑 `podman machine start`                               |
| `gh auth login` 或 `Resource not accessible by personal access token` | `GH_TOKEN` 沒填，或權限不夠（Issues 要 Read and write）   |
| `once.sh` 出現 `not a TTY`                                            | 在 Windows Terminal 裡開 Git Bash，不要用舊的 mintty 視窗 |
| `afk.sh` 跑很久都沒輸出                                               | 正常：無人值守模式要等整輪做完才會印出結果                |
| 印出 `Stopped at the N-iteration cap`                                 | 跑滿次數了但還有 issue，再跑一次就好                      |

## 跟 `.sandcastle/` 的差別

repo 裡另有一套 Sandcastle 設定（`.sandcastle/`），做的事情一樣。差別在：

- **Sandcastle**：代理在暫時的分支上做，跑完自動合併回來，用 `pnpm sandcastle` 執行
- **Ralph**：直接 commit 到目前的分支，所有步驟都是看得到、改得動的 shell 腳本

兩套共用同一個容器映像檔，選一套用就好。
