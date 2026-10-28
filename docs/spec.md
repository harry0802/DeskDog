---
status: ready-for-agent
version: v1.2 MVP
---

# DeskDog v1.2 MVP Spec

> 術語以 `GLOSSARY.md` 為準；架構決策見 `docs/adr/0001`（每螢幕全螢幕覆蓋層）與 `docs/adr/0002`（分層 Part + 程序動畫）。

## Problem Statement

我長時間在 Windows 電腦前工作或讀書，桌面冷冰冰的，沒有任何會回應我的東西。現有的桌寵不是太吵（一直跳通知、擋住工作區），就是太死板（點了只會播固定動畫，不記得我、也不在乎我有沒有理牠）。我想要一隻安靜待在角落、會看著我、被摸會開心、被冷落會鬧彆扭、可以被我抱起來搬到別處的狗狗，而且關掉程式後牠仍記得我們的關係。

## Solution

DeskDog 是一隻常駐 Windows 桌面的側面視角狗狗。牠站在螢幕工作區域的底緣（Ground）上，會呼吸、眨眼、搖尾巴、偶爾 Stroll，眼睛跟著游標。使用者可以 Click、Pat、Pickup 牠；被抱起時腿會下垂、身體依拖拽速度傾斜，Drop 後依重力 Toss 落回 Ground 並壓扁回彈。

狗狗的 Mood 由 Affection、Neglect、AFK、時段即時推導：被摸會 happy、被冷落會 lonely 再 sulky、被連點會 annoyed、深夜沒人會 sleepy。牠會以 Bubble 說出本地 Line Pool 中的 Line，也會依使用者設定的頻率 Chatter。所有狀態保存在本機。完全不使用 AI。

## User Stories

### 桌面常駐

1. As a 使用者, I want 啟動 DeskDog 後狗狗出現在主螢幕右下角的 Ground 上, so that 牠不擋住我的工作區。
2. As a 使用者, I want 狗狗沒有視窗邊框、標題列或背景, so that 牠看起來真的住在桌面上。
3. As a 使用者, I want 狗狗永遠在其他視窗之上, so that 我隨時看得到牠。
4. As a 使用者, I want 狗狗不出現在工作列, so that 工作列不被佔用。
5. As a 使用者, I want 狗狗身體以外的區域完全點擊穿透, so that 我可以照常操作底下的視窗與桌面圖示。
6. As a 使用者, I want 只有點到狗狗不透明的身體才算命中, so that 狗狗周圍的空白不會吃掉我的點擊。
7. As a 使用者, I want 系統列有 DeskDog 圖示, so that 我能找到並控制牠。
8. As a 使用者, I want 從系統列顯示／隱藏狗狗, so that 我需要專心或分享螢幕時可以暫時收起牠。
9. As a 使用者, I want 從系統列開啟設定, so that 我能調整狗狗的行為。
10. As a 使用者, I want 從系統列重置好感度（需確認）, so that 我能重新開始我們的關係。
11. As a 使用者, I want 從系統列結束 DeskDog, so that 我能完全關閉它。
12. As a 多螢幕使用者, I want 狗狗可以被抱到任何一個螢幕上, so that 牠能待在我最常看的那個螢幕。
13. As a 多螢幕使用者, I want 上次存的位置所在螢幕已不存在時，狗狗回到主螢幕右下角, so that 我拔掉外接螢幕後不會找不到牠。
14. As a 使用者, I want 前景程式全螢幕時（遊戲、影片、簡報）狗狗自動隱藏, so that 牠不擋畫面；離開全螢幕後再出現。
15. As a 使用者, I want 狗狗被隱藏時不消耗動畫運算, so that 不浪費電腦資源。

### 外觀與待機動畫

16. As a 使用者, I want 狗狗待機時會呼吸、隨機眨眼、偶爾搖尾巴, so that 牠看起來是活的。
17. As a 使用者, I want 狗狗的眼睛／頭朝游標方向看, so that 我感覺牠在注意我。
18. As a 使用者, I want 狗狗閒置時偶爾沿 Ground Stroll 一小段（50～200px，不離開目前螢幕）, so that 牠有自己的生活感。
19. As a 使用者, I want 狗狗散步時面向行進方向, so that 動作自然。
20. As a 使用者, I want 狗狗在 sleepy、lonely、sulky 時不散步, so that 行為符合心情。
21. As a 使用者, I want happy 時狗狗會跳躍、尾巴快速擺動、露出笑臉, so that 我看得出牠很開心。
22. As a 使用者, I want lonely 時狗狗趴下、耳朵下垂、尾巴變慢, so that 我知道牠想要我理牠。
23. As a 使用者, I want annoyed 時狗狗皺眉、左右跺腳, so that 我知道我惹到牠了。
24. As a 使用者, I want sulky 時狗狗背對我、皺眉, so that 我知道牠在鬧彆扭。
25. As a 使用者, I want sleepy 時狗狗閉眼、呼吸變慢、冒出 Zzz, so that 我知道牠睡著了。
26. As a 素材提供者, I want 只需提供一組分層 Part（PSD 或同畫布 PNG）就能讓狗狗動起來, so that 我不用畫逐格動畫。
27. As a 開發者, I want 在素材到位前使用程式繪製的佔位 Part, so that 開發不被美術卡住。

### 手勢：Click、Pat、Pickup

28. As a 使用者, I want 在狗狗身上按下並在 1 秒內放開（未移動超過拖拽門檻）算 Click, so that 輕點有明確回應。
29. As a 使用者, I want Click 依目前 Mood 說一句 Line（不改變 Affection，只有 Pat 會增加）, so that 每次點牠都有回饋。
30. As a 使用者, I want 在狗狗身上按住不動達 1 秒算 Pat, so that 我能好好摸摸牠。
31. As a 使用者, I want Pat 讓 Affection +4 並進入 Afterglow（持續摸著時 Mood 為 happy 並冒出愛心，放開即結束）, so that 摸頭比點一下更有感。
32. As a 使用者, I want 按住後移動超過拖拽門檻（約 6px）就 Pickup, so that 我想搬牠時不會被誤判成摸頭或點擊。
33. As a 使用者, I want Pickup 時游標變成抓取狀態, so that 我知道我正抓著牠。
34. As a 使用者, I want 1.5 秒內連續 Click 5 次時 Affection -1 並進入 annoyed（10 秒冷卻）, so that 狗狗有被打擾的真實反應。
35. As a 使用者, I want annoyed 冷卻結束後自動恢復, so that 牠不會一直記仇。

### 抱起、拖拽、Drop

36. As a 使用者, I want Pickup 瞬間狗狗露出驚訝表情、耳朵豎起、身體輕微放大並抬起, so that 有「被抱起來」的感覺。
37. As a 使用者, I want Pickup 時狗狗從 pickedUp Line Pool 說一句話, so that 牠對被抱起有反應。
38. As a 使用者, I want 拖拽時狗狗懸空、四條腿自然下垂並帶鐘擺慣性, so that 看起來像被拎著。
39. As a 使用者, I want 拖拽時狗狗依游標水平速度傾斜（上限約 12～15 度）並帶彈簧阻尼, so that 動作有重量感。
40. As a 使用者, I want 快速拖拽時狗狗身體拉伸、耳朵與尾巴往反方向甩，並說 fastDragging Line, so that 牠會抗議太快。
41. As a 使用者, I want 拖拽期間狗狗不散步、不入睡、不 Chatter, so that 拖拽不被其他行為打斷。
42. As a 使用者, I want 連續拖拽 8 秒時狗狗說一句 draggedTooLong Line, so that 牠會表示想被放下。
43. As a 使用者, I want 連續拖拽超過 15 秒時狗狗進入 annoyed（10 秒冷卻）且這次 Drop 不加 Affection, so that 拖太久有後果。
44. As a 使用者, I want annoyed 時仍可以 Pickup 狗狗，但牠改說 protestPickup Line 且 Drop 不加 Affection, so that 我能搬牠但牠還在生氣。
45. As a 使用者, I want 狗狗不能被拖出螢幕可視範圍, so that 我永遠找得到牠。
46. As a 使用者, I want Drop 後狗狗依重力落到所在螢幕的 Ground, so that 牠總是站在地上。
47. As a 使用者, I want Drop 時若游標仍有速度，狗狗會 Toss：沿拋物線飛出、在 Ground 上摩擦滑行、撞螢幕邊緣反彈, so that 丟牠出去很好玩。
48. As a 使用者, I want Toss 速度有上限（約 2500 px/s）, so that 狗狗不會飛得失控。
49. As a 使用者, I want 下落時狗狗輕微旋轉並可說 falling Line, so that 下落過程生動。
50. As a 使用者, I want 落到 Ground 時狗狗 Y 軸壓扁、X 軸變寬再回彈（約 200～350 ms）, so that 落地有彈性。
51. As a 使用者, I want 落地後狗狗說一句 landing Line, so that 牠會評論新位置。
52. As a 使用者, I want 安全 Drop（非 annoyed、未拖太久）讓 Affection +1, so that 溫柔搬牠會被感謝。
53. As a 使用者, I want 被快速甩動不加也不扣 Affection, so that 玩鬧不會被懲罰。
54. As a 多螢幕使用者, I want Drop 時狗狗落在中心點所在螢幕的 Ground, so that 跨螢幕搬運結果可預期。
55. As a 使用者, I want 落地後新位置（含所在螢幕）被保存, so that 下次開啟牠還在那裡。
56. As a 使用者, I want 在設定中把拖拽物理切成「標準／活潑／關閉」, so that 我能選擇喜歡的手感；「關閉」時 Drop 直接回到 Ground 不做 Toss，「活潑」時回彈與速度上限更高。

### Mood 與 Affection

57. As a 使用者, I want Mood 依 Affection、Neglect、AFK、時段與冷卻即時推導, so that 狗狗的情緒總是合理而且一致。
58. As a 使用者, I want Affection ≥ 75 時狗狗預設 happy, so that 長期對牠好會有回報。
59. As a 使用者, I want Affection 30～74 時狗狗為 normal, so that 一般狀態平穩。
60. As a 使用者, I want Affection < 30 時狗狗的 normal 改說 coldNormal Line, so that 關係疏遠看得出來。
61. As a 使用者, I want Neglect 超過 10 分鐘時狗狗 lonely, so that 牠會想念我。
62. As a 使用者, I want Neglect 超過 45 分鐘時狗狗 sulky, so that 長時間冷落有後果。
63. As a 使用者, I want 只有對狗狗本身的 Interaction（Click、Pat、Pickup）會重置 Neglect，我在其他程式上工作不算, so that 「專心工作沒理牠」也會讓牠孤單。
64. As a 使用者, I want App 沒在執行的時間不計入 Neglect, so that 隔天開機牠不會一啟動就鬧彆扭。
65. As a 使用者, I want 被冷落時 Affection Decay（高於 80 時每 3 分鐘 Neglect -1，80 以下每 1 小時 -1，App 未執行不計）, so that 好感度有意義、不會一直停在開心。
66. As a 使用者, I want sulky 時我的第一次 Interaction 只換來「轉頭哼一聲」與 sulkyCoaxing Line, so that 牠不會一點就好。
67. As a 使用者, I want 在 30 秒內累積 3 次 Interaction 或 1 次 Pat 時觸發 Make-up 並說 makeUp Line, so that 哄好牠有成就感。
68. As a 使用者, I want 23:00～07:00 且 AFK 超過 3 分鐘時狗狗 sleepy 並睡覺, so that 深夜我離開後牠會乖乖睡。
69. As a 使用者, I want 我深夜還在打字時狗狗不會睡著, so that sleepy 反映的是我真的離開了。
70. As a 使用者, I want 在設定中關閉「深夜睡覺」, so that 夜貓子的我不被影響。
71. As a 使用者, I want 睡覺中 Click 會吵醒狗狗（Woken）：說 woken Line、揉眼睛、保持清醒 2 分鐘，之後若我仍 AFK 才再睡, so that 叫醒牠有真實反應。
72. As a 使用者, I want 睡覺中 Pat 不會吵醒牠，只在夢中搖一下尾巴, so that 我能溫柔地摸睡著的牠。
73. As a 使用者, I want 睡覺中的 Click 不扣 Affection, so that 叫醒牠不是壞事。
74. As a 使用者, I want annoyed 的優先順序高於其他 Mood, so that 剛被惹毛的狗不會瞬間變回開心。
75. As a 使用者, I want App 啟動時狗狗做一次 Greeting 並說 greeting Line, so that 我每次打開都被歡迎。

### Line、Bubble、Chatter

76. As a 使用者, I want Line 顯示在狗狗頭上的 Bubble 中，3～5 秒後淡出, so that 對話不干擾我。
77. As a 使用者, I want Bubble 靠近螢幕邊緣時自動翻到另一側、永不超出螢幕, so that 我總能讀到完整的話。
78. As a 使用者, I want 每個 Line Pool 洗牌依序抽、抽完才重洗，且重洗後第一句不與上一句相同, so that 短期內不會聽到重複的話。
79. As a 使用者, I want Line 可用 {name} 帶入狗狗名字, so that 牠像是我的狗。
80. As a 使用者, I want 說話時不跳 Windows 通知、不中斷動畫, so that 一切都安靜發生在桌面上。
81. As a 使用者, I want 台詞放在可編輯的 JSON 台詞庫, so that 我日後能自己修改與擴充。
82. As a 使用者, I want 狗狗會依設定頻率 Chatter（關閉／低 20～30 分／普通 8～15 分／高 4～6 分）, so that 牠偶爾主動跟我說話。
83. As a 使用者, I want 「打字時不打擾」開啟時（預設開），我正在打字時狗狗不 Chatter, so that 牠不打斷我的思緒。
84. As a 使用者, I want 每個 Mood 至少有 5 句 Line, so that 對話有變化。
85. As a 使用者, I want 狗狗在全螢幕隱藏、拖拽中、sleepy 時不 Chatter, so that Chatter 只在合適的時候發生。

### 設定與存檔

86. As a 使用者, I want 在設定中自訂狗狗名字（預設「小柴」）, so that 牠有我取的名字。
87. As a 使用者, I want 在設定中開關開機自動啟動（預設關）, so that 我決定牠要不要每天自動出現。
88. As a 使用者, I want 設定變更立即生效且被保存, so that 不需要重啟。
89. As a 使用者, I want 在設定中重置所有資料（Affection、位置、狀態），並需二次確認, so that 不會誤刪。
90. As a 使用者, I want 關閉後重新開啟時 Affection、位置、名字與設定都保留, so that 我們的關係延續。
91. As a 使用者, I want 存檔損壞或讀不到時 App 以預設值啟動而不崩潰, so that 狗狗永遠會出現。
92. As a 使用者, I want 存檔寫入不會因中途斷電而損毀, so that 我不會失去狗狗的資料。
93. As a 使用者, I want 在 Pat、落地、Mood 改變、設定變更與 App 關閉時存檔, so that 進度不會遺失。

### 效能

94. As a 使用者, I want 狗狗待機時 CPU 低於 3%、記憶體低於 250 MB, so that 牠不拖慢我的電腦。
95. As a 使用者, I want 點擊與拖拽回應延遲低於 100 ms, so that 互動跟手。
96. As a 使用者, I want 互動／拖拽／下落時 60fps、一般待機 30fps、sleepy 或 AFK 超過 5 分鐘時 10fps, so that 流暢與省電兼顧。

## Implementation Decisions

### 架構

- **桌面殼**：Electron，以 electron-vite 建置，electron-builder 打包為 Windows 安裝檔。曾評估 Tauri（較省資源），但覆蓋層點擊穿透與多螢幕在 Electron 有現成支援，MVP 風險較低。
- **視窗模型（ADR-0001）**：每個螢幕一個全螢幕、透明、無邊框、置頂、不入工作列的覆蓋視窗。主行程依覆蓋層回報的命中結果切換滑鼠穿透（帶 forward 以持續收到移動事件）。跨螢幕拖拽時，Drop 由狗狗中心點所在螢幕的覆蓋層接手。
- **覆蓋層**：純 TypeScript + PixiJS，不使用 UI 框架。Bubble 也直接以 Pixi 繪製。
- **設定視窗**：獨立的原生 Electron 視窗，使用 React。
- **狀態**：自寫的小型 store，不引入 Pinia／Zustand。

### 模組

1. **Pet 核心（深模組，唯一測試切入點）**：純邏輯，不依賴 Electron／PixiJS／DOM。封裝手勢判定、Mood 推導、Affection 規則、Make-up 進度、Woken、Afterglow、Line 抽選、Chatter 排程、Toss／重力／摩擦／反彈物理、Stroll 決策、存檔資料的正規化與預設值。時間、亂數、存檔來源一律由外部注入。
   - 輸入：指標事件（down／move／up，含螢幕座標、時間戳、是否命中身體）、tick（現在時間、系統 AFK 秒數、是否正在打字、前景是否全螢幕、各螢幕工作區域）、設定變更、啟動（含上次存檔）。
   - 輸出：快照（Mood、Motion、Affection、位置與所在螢幕、朝向、縮放、傾斜、腿與耳尾的物理參數、當前 Bubble Line）與效果清單（say Line、播放某段動畫、要求存檔、要求隱藏／顯示、建議 fps）。
2. **Rig（覆蓋層）**：把核心快照映射成 Part 的變換；Container 旋轉、`MeshRope` 尾巴與四腿、`MeshPlane` 身體呼吸與壓扁回彈、眼睛／嘴巴 Part 切換。依 Part alpha 做逐像素命中（alpha > 10%），游標遠離時直接判定未命中。
3. **Part 載入器**：讀取同畫布、未裁切的 Part PNG 與 Pivot 描述；素材缺席時改用程式繪製的佔位 Part。另附一個把 PSD 拆層並產生 Pivot 描述的腳本。
4. **主行程**：建立覆蓋層、系統列選單、設定視窗；提供系統 AFK（powerMonitor）、全螢幕偵測、打字偵測、螢幕工作區域；處理開機自啟；讀寫存檔。
5. **存檔**：兩個 JSON 檔於 `%APPDATA%/DeskDog`：`pet-state`（Affection、位置與所在螢幕、Neglect 相關累計時間、冷卻截止時間）與 `settings`（名字、開機自啟、Chatter 頻率、打字時不打擾、深夜睡覺、拖拽物理）。先寫暫存檔再改名。「重置好感度」只清 `pet-state`。
6. **台詞庫**：一份 JSON，鍵為 Line Pool 名稱：happy、normal、coldNormal、lonely、annoyed、sulky、sulkyCoaxing、makeUp、sleepy、woken、greeting、pickedUp、protestPickup、dragging、fastDragging、falling、landing、draggedTooLong。

### 狀態模型

Mood 與 Motion 嚴格分開；Mood 為推導值，不是事件寫死的值。

```ts
type Mood = "happy" | "normal" | "lonely" | "annoyed" | "sulky" | "sleepy";
type Motion =
  | "idle"
  | "strolling"
  | "pickedUp"
  | "dragging"
  | "falling"
  | "landing"
  | "sleeping";
```

### Mood 推導順序

1. annoyed 冷卻中 → annoyed
2. 啟用深夜睡覺、23:00 ≤ 時刻 < 07:00、AFK > 3 分鐘、且不在 Woken 期間 → sleepy
3. Neglect > 45 分鐘（或尚未 Make-up 的 sulky）→ sulky
4. Neglect > 10 分鐘 → lonely
5. Afterglow 中，或 Affection ≥ 75 → happy
6. 否則 → normal（Affection < 30 時用 coldNormal Line Pool）

### 手勢與數值

| 項目                    | 值                                                |
| ----------------------- | ------------------------------------------------- |
| 拖拽門檻                | 約 6px 移動                                       |
| Pat                     | 按住不動 1 秒                                     |
| 連點判定                | 1.5 秒內 5 次 Click → Affection -1、annoyed 10 秒 |
| Click / Pat / 安全 Drop | 0 / +4 / +1                                       |
| Afterglow               | 持續到放開滑鼠                                    |
| Affection Decay         | >80：每 3 分鐘 Neglect -1；≤80：每 1 小時 -1      |
| Make-up                 | 30 秒內 3 次 Interaction 或 1 次 Pat              |
| Woken                   | 清醒 2 分鐘                                       |
| 拖太久                  | 8 秒說 Line；15 秒進 annoyed                      |
| 重力                    | 1400～1800 px/s²                                  |
| 傾斜上限                | 12～15 度                                         |
| 回彈係數                | 0.2～0.3（活潑模式提高）                          |
| 落地壓扁                | Y 0.75、X 1.2，回復 200～350 ms                   |
| Toss 速度上限           | 約 2500 px/s（活潑模式提高）                      |
| Stroll                  | 每 1～3 分鐘 30% 機率，50～200px                  |
| fps                     | 互動 60／待機 30／sleepy 或 AFK > 5 分 10／隱藏 0 |

### 美術（ADR-0002）

側面視角，左右以水平翻轉表現。約 15 個 Part：body、body_lying、head、ear_L、ear_R、tail（橫向拉直）、leg_FL／FR／BL／BR（直向拉直）、eyes_open／closed／happy／angry／sleep、mouth_idle／happy／angry；全部同一透明畫布、原位疊合、不裁切；另附 Pivot 描述（頸、尾根、各腿根、耳根）。

## Testing Decisions

- **好測試的標準**：只透過 Pet 核心的公開輸入（指標事件、tick、設定、啟動存檔）驅動，只斷言公開輸出（快照與效果清單）。不測內部欄位、不測私有函式、不依賴呼叫順序。時間與亂數由測試控制，使情境可重現。
- **唯一切入點**：Pet 核心。以 Vitest 進行 TDD（先寫失敗測試再實作）。代表性情境：
  - Click／Pat／Pickup 的判定邊界（移動 5px vs 7px、按住 0.9 秒 vs 1.0 秒）。
  - 1.5 秒內 5 次 Click → annoyed，10 秒後恢復；annoyed 期間 Pickup 說 protestPickup、Drop 不加分。
  - Neglect 10／45 分鐘轉 lonely／sulky；App 未執行時間不計；Affection Decay。
  - sulky 的 Make-up：1 次 Interaction 不夠、3 次或 1 次 Pat 才和好。
  - 深夜 AFK 3 分鐘入睡、打字中不睡、Click 吵醒並清醒 2 分鐘、Pat 不吵醒、關閉深夜睡覺時不睡。
  - Drop 後依重力落到 Ground、Toss 撞牆反彈、速度上限、拖拽物理關閉時直接回地面、跨螢幕 Drop 落在中心點所在螢幕、不能超出螢幕。
  - 拖拽 8 秒說 draggedTooLong、15 秒轉 annoyed。
  - Line Pool 洗牌不重複、重洗後首句不等於上一句、{name} 帶入。
  - Chatter 依頻率排程、打字時／拖拽中／全螢幕時不發生。
  - 存檔損壞或缺欄位時使用預設值；上次螢幕不存在時回主螢幕右下角。
- **不在切入點內（手動驗收）**：覆蓋層繪製與動畫手感、逐像素命中、滑鼠穿透切換、系統列、設定視窗、跨螢幕覆蓋層交接、全螢幕偵測、效能指標。
- **Prior art**：新專案，無既有測試。

## Out of Scope

- LLM／AI 對話、語音輸入輸出、口型同步。
- 帳號、雲端同步、多使用者、手機版。
- 螢幕內容辨識。
- 複雜養成（餵食、洗澡、生病、商店、打工）。
- 多隻狗狗。
- 落在其他視窗的標題列上（Ground 只到工作區域底緣）。
- 正面或 3/4 視角、Live2D、Spine。
- 自訂皮膚與台詞包 UI（台詞可直接改 JSON）。
- 番茄鐘、喝水、久坐提醒。

## Further Notes

- 建議開發順序：Pet 核心（TDD）→ 覆蓋層與佔位 Rig → 手勢與拖拽物理接線 → Bubble 與台詞庫 → 存檔 → 系統列與設定視窗 → 全螢幕／AFK／打字偵測 → 正式 Part 素材替換 → 打包。
- 新增 Line Pool 的草稿已在設計討論中擬定，使用者可再修改後放入台詞庫。
- 本 spec 目前僅存於本機；待 issue tracker 設定完成後，以 `ready-for-agent` 標籤發佈。
