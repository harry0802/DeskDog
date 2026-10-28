# DeskDog

一隻常駐 Windows 桌面的狗狗桌寵；牠的情緒由使用者與牠的互動、被冷落的時間與好感度決定。

## 狗狗的狀態

**Mood（情緒）**：
狗狗「現在感覺如何」，由好感度、冷落時間、AFK 與時段即時推導，不是事件寫死的值。值為 `happy`、`normal`、`lonely`、`annoyed`、`sulky`、`sleepy`。
_Avoid_: 心情狀態、emotion

**Motion（動作）**：
狗狗「目前正在做什麼」，例如 idle、walking、pickedUp、falling、landing、sleeping；與 Mood 互相獨立。
_Avoid_: 動作狀態、action、state

**Affection（好感度）**：
0–100 的長期數值，代表狗狗對使用者的喜愛程度。
_Avoid_: 親密度、好感值、love

**Afterglow（摸後餘韻）**：
Pat 成立後到放開滑鼠為止的期間；期間 Mood 為 happy，不論 Affection 高低，放開即結束。

**Affection Decay（好感衰減）**：
被冷落時 Affection 隨時間下降：高於 80 時較快，80 以下緩慢；App 未執行的時間不計。

**Annoyed（被惹毛）**：
因被打擾（如連點）而產生的短暫不悅；冷卻時間到就自動消失。
_Avoid_: upset、生氣（未區分時）

**Sulky（鬧彆扭）**：
因長時間被冷落而產生的不悅；需使用者重新互動才會解除。
_Avoid_: upset、生氣（未區分時）

**Make-up（和好）**：
Sulky 解除的時刻：使用者在短時間內給予足夠的 Interaction，狗狗表示原諒。
_Avoid_: 消氣、reset

**Woken（被吵醒）**：
睡覺中被單擊後短暫清醒的期間；期間不會再入睡。

## 互動與時間

**Interaction（互動）**：
使用者直接對狗狗做的事：單擊、摸頭、抱起。滑鼠經過或使用其他程式不算。
_Avoid_: 操作、使用

**Click（單擊）**：
在狗狗身上按下並在 1 秒內放開，期間未移動超過拖拽門檻。

**Pat（摸頭）**：
在狗狗身上按住不動達 1 秒。
_Avoid_: 長按（未說明是摸頭時）

**Pickup（抱起）**：
在狗狗身上按住後移動超過拖拽門檻，狗狗被抓離地面跟著游標走。
_Avoid_: 拖曳開始、grab

**Drop（放下）**：
抱起中放開滑鼠；之後狗狗下落到 Ground 並落地。

**Neglect（冷落）**：
距離上一次 Interaction 的時間，只計算 App 執行中的時間。決定 lonely 與 sulky。
_Avoid_: idle（與 AFK 混淆）

**AFK（離開電腦）**：
使用者沒有碰鍵盤滑鼠的時間（系統層級閒置）。決定 sleepy。
_Avoid_: idle（與 Neglect 混淆）

**Greeting（迎接）**：
App 啟動時狗狗對使用者的一次歡迎反應。

## 空間

**Ground（地面）**：
狗狗所在螢幕工作區域（不含工作列）的底緣；狗狗靜止時一定站在 Ground 上。
_Avoid_: 地板、bottom

**Toss（拋擲）**：
Drop 時狗狗仍帶有速度，沿拋物線飛出並在 Ground 上滑行、撞牆反彈。

**Stroll（散步）**：
狗狗自己沿 Ground 左右走一小段，不離開目前螢幕。
_Avoid_: walk、巡邏

## 外觀

**Part（部件）**：
狗狗身體的一個分層圖片（如頭、左耳、尾巴、右前腿、某種眼睛），疊合後組成完整的狗狗。
_Avoid_: sprite、圖層（在程式語境中）

**Pivot（關節點）**：
Part 旋轉與彎曲的基準點，例如頸部、尾根、腿根。

## 對話

**Line（台詞）**：
狗狗說出的一句話，來自本地台詞庫。
_Avoid_: dialogue、message

**Line Pool（台詞池）**：
某個情境（某個 Mood 或某個拖拽階段）可抽選的一組 Line。

**Chatter（主動說話）**：
狗狗未被互動時自己冒出的 Line；頻率可由使用者調整。
_Avoid_: 隨機對話（未區分是否為回應時）

**Bubble（對話泡泡）**：
顯示一句 Line 的泡泡框，數秒後淡出。
