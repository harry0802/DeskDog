// Pet 核心：純邏輯，不依賴 Electron、PixiJS 或 DOM。
// 時間、亂數、存檔來源一律由外部注入；輸入為啟動／tick／指標事件，輸出為快照與效果清單。

import { createLineDecks } from "./line-deck";

export type DisplayId = number;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Display {
  readonly id: DisplayId;
  readonly primary: boolean;
  /** 工作區域（不含工作列），螢幕座標。 */
  readonly workArea: Rect;
}

export interface StartInput {
  readonly now: number;
  readonly displays: readonly Display[];
  /** 上次存檔（pet-state）；可能損壞或缺欄位，壞掉的欄位以預設值取代。 */
  readonly saved?: unknown;
  /** 上次存檔（settings）；同上。 */
  readonly settings?: unknown;
}

/** pet-state 存檔內容。 */
export interface SavedPetState {
  readonly affection: number;
  readonly displayId: DisplayId;
  /** 腳底中心點；讀檔時放回 Ground。 */
  readonly position: Point;
  /** 距上一次 Interaction 的 Neglect（ms）。 */
  readonly neglect: number;
  /** 上次扣 Affection 後累積的 Neglect（ms）。 */
  readonly neglectSinceDecay: number;
  /** 正在鬧彆扭且尚未 Make-up；Interaction 重置 Neglect 後仍保留。 */
  readonly sulking: boolean;
}

export interface Settings {
  /** 狗狗名字，帶入 Line 中的 {name}。 */
  readonly name: string;
  /** 拖拽物理：off 時 Drop 直接回到 Ground，lively 回彈與 Toss 速度上限更高。 */
  readonly dragPhysics: DragPhysics;
  /** 深夜使用者離開後是否睡覺。 */
  readonly nightSleep: boolean;
  /** Chatter（主動說話）的頻率。 */
  readonly chatter: ChatterFrequency;
  /** 使用者正在打字時不 Chatter。 */
  readonly quietWhileTyping: boolean;
  /** 開機自動啟動。 */
  readonly launchAtLogin: boolean;
}

const CHATTER_FREQUENCIES = ["off", "low", "normal", "high"] as const;
export type ChatterFrequency = (typeof CHATTER_FREQUENCIES)[number];

const DRAG_PHYSICS = ["standard", "lively", "off"] as const;
export type DragPhysics = (typeof DRAG_PHYSICS)[number];

export interface TickInput {
  readonly now: number;
  readonly displays: readonly Display[];
  /** 系統 AFK 秒數（使用者沒碰鍵盤滑鼠多久）；沒給視為 0。 */
  readonly afkSeconds?: number;
  /** 使用者正在打字；沒給視為沒有。 */
  readonly typing?: boolean;
  /** 本地時刻，0 ≤ hour < 24（可含小數，例如 23.5 為 23:30）；沒給視為白天。 */
  readonly hour?: number;
  /** 前景程式正在全螢幕（遊戲、影片、簡報）；沒給視為沒有。 */
  readonly fullscreen?: boolean;
}

export type HitRegion = "head" | "body" | "none";

export interface PointerEvent {
  readonly type: "down" | "move" | "up";
  readonly time: number;
  /** 螢幕座標。 */
  readonly position: Point;
  /** 游標命中狗狗的哪個部位；none 表示沒命中。 */
  readonly hit: HitRegion;
}

export type Mood =
  "happy" | "normal" | "lonely" | "annoyed" | "sulky" | "sleepy";

/** 狗狗目前正在做什麼；與 Mood 互相獨立。 */
export type Motion =
  | "idle"
  | "strolling"
  | "pickedUp"
  | "dragging"
  | "falling"
  | "landing"
  | "sleeping";

export const LINE_POOLS = [
  "happy",
  "normal",
  "coldNormal",
  "lonely",
  "annoyed",
  "sulky",
  "sulkyCoaxing",
  "makeUp",
  "sleepy",
  "woken",
  "greeting",
  "pickedUp",
  "protestPickup",
  "dragging",
  "fastDragging",
  "falling",
  "landing",
  "draggedTooLong",
] as const;

export type LinePool = (typeof LINE_POOLS)[number];

/** 台詞庫：鍵為 Line Pool 名稱。 */
export type LineLibrary = Readonly<Record<LinePool, readonly string[]>>;

export interface PetSnapshot {
  readonly mood: Mood;
  readonly motion: Motion;
  /** 0–100。 */
  readonly affection: number;
  /** Pat 後仍持續摸著（Afterglow 中）。 */
  readonly afterglow: boolean;
  readonly displayId: DisplayId;
  /** 狗狗腳底中心點，螢幕座標；靜止時 y 等於 Ground。 */
  readonly position: Point;
  /** 拖拽中游標的速度，或 Toss 中狗狗的速度（px/s）；Rig 據此傾斜與拉伸。靜止時為 0。 */
  readonly velocity: Point;
  readonly facing: "left" | "right";
  /** 前景全螢幕而隱藏：覆蓋層不繪製，也不 Chatter。 */
  readonly hidden: boolean;
  /** 建議的覆蓋層 fps：互動 60、待機 30、sleepy 或 AFK > 5 分鐘 10、隱藏 0。 */
  readonly fps: number;
}

export type PetEffect =
  | { readonly type: "say"; readonly line: string }
  | {
      readonly type: "playAnimation";
      readonly animation: "greeting" | "hmph" | "rubEyes" | "dreamWag";
    }
  /** 要求主行程向系統登記（或取消）開機自動啟動。 */
  | { readonly type: "launchAtLogin"; readonly enabled: boolean }
  /** 要求主行程把 pet-state 與 settings 寫入存檔。 */
  | {
      readonly type: "save";
      readonly petState: SavedPetState;
      readonly settings: Settings;
    };

export interface PetOutput {
  readonly snapshot: PetSnapshot;
  readonly effects: readonly PetEffect[];
}

export interface PetDeps {
  readonly random: () => number;
  readonly lines: LineLibrary;
}

export interface Pet {
  start(input: StartInput): PetOutput;
  tick(input: TickInput): PetOutput;
  pointer(event: PointerEvent): PetOutput;
  /** 設定變更；未給的欄位維持原值。 */
  configure(settings: Partial<Settings>): PetOutput;
  /** 使用者從系統列顯示／隱藏狗狗；隱藏時 0fps、不 Chatter。 */
  setVisible(visible: boolean): PetOutput;
  /** 重置好感度：Affection 回預設、Neglect 與情緒冷卻清空；位置與設定不變。 */
  resetAffection(): PetOutput;
  /** App 關閉：要求存檔。 */
  stop(input: StopInput): PetOutput;
}

export interface StopInput {
  readonly now: number;
}

/** 腳底中心點距離工作區域右緣的距離。 */
const HOME_RIGHT_INSET = 120;
const DEFAULT_AFFECTION = 50;
const DEFAULT_SETTINGS: Settings = {
  name: "小柴",
  dragPhysics: "standard",
  nightSleep: true,
  chatter: "normal",
  quietWhileTyping: true,
  launchAtLogin: false,
};
/** 各頻率兩次 Chatter 之間的間隔範圍（ms）。 */
const CHATTER_INTERVAL: Record<
  Exclude<ChatterFrequency, "off">,
  { min: number; max: number }
> = {
  low: { min: 20 * 60_000, max: 30 * 60_000 },
  normal: { min: 8 * 60_000, max: 15 * 60_000 },
  high: { min: 4 * 60_000, max: 6 * 60_000 },
};
/** 深夜時段：NIGHT_START ≤ 時刻 < 24 或 0 ≤ 時刻 < NIGHT_END（時）。 */
const NIGHT_START = 23;
const NIGHT_END = 7;
/** AFK 超過此秒數才入睡（s）。 */
const SLEEP_AFK = 180;
/** 被吵醒後保持清醒的時間（ms）。 */
const WOKEN_DURATION = 2 * 60_000;
const PAT_AFFECTION = 4;
const SAFE_DROP_AFFECTION = 1;
/** Pat 之後繼續撫摸，每隔這麼久再 +1（ms）。 */
const STROKE_INTERVAL = 1000;
const HAPPY_AFFECTION = 75;
/** Neglect 超過此值為 lonely、sulky（ms）。 */
const LONELY_NEGLECT = 10 * 60_000;
const SULKY_NEGLECT = 45 * 60_000;
/** 低於此值時 normal 改用 coldNormal Line Pool。 */
const COLD_AFFECTION = 30;
/** sulky 時在這段時間內累積 MAKE_UP_INTERACTIONS 次 Interaction 就 Make-up（ms）。 */
const MAKE_UP_WINDOW = 30_000;
const MAKE_UP_INTERACTIONS = 3;
/** 連點判定：這段時間內 CLICK_BURST 次 Click 會惹毛狗狗（ms）。 */
const CLICK_BURST_WINDOW = 1500;
const CLICK_BURST = 5;
const BURST_AFFECTION = -1;
/** 連續拖拽這麼久說 draggedTooLong；再久就惹毛狗狗（ms）。 */
const DRAG_COMPLAINT = 8000;
const DRAG_LIMIT = 15_000;
/** annoyed 持續的時間（ms）。 */
const ANNOYED_COOLDOWN = 10_000;
/** 按下後移動超過此距離就不再是 Click。 */
const DRAG_THRESHOLD = 6;
/** 在頭上按住達此時間即為 Pat；任何部位按住達此時間放開都不是 Click（ms）。 */
const PAT_HOLD = 1000;
/** 狗狗外框大小，腳底在底部中央；拖拽時整隻狗留在工作區域內。 */
const PET_SIZE = { width: 220, height: 170 } as const;
/** 建議 fps 的三個檔位；隱藏為 0。 */
const FPS_INTERACTING = 60;
const FPS_IDLE = 30;
const FPS_SLOW = 10;
/** AFK 超過這麼久就降到慢速（s）。 */
const AFK_SLOW_SECONDS = 300;

/** Pickup 的驚訝演出長度，之後轉為 dragging（ms）。 */
const PICKUP_DURATION = 300;
/** 拖拽速度以最近這段時間內的游標位移計算（ms）。 */
const VELOCITY_WINDOW = 100;
/** 拖拽速度超過此值為快速拖拽：說 fastDragging，這次 Drop 不加 Affection（px/s）。 */
export const FAST_DRAG_SPEED = 1500;
/** 兩次 fastDragging Line 的最短間隔（ms）。 */
const FAST_LINE_COOLDOWN = 3000;
/** Drop 後下落的重力加速度（px/s²）。 */
const GRAVITY = 1600;
/** 在 Ground 上滑行時的摩擦減速度（px/s²）。 */
const FRICTION = 4000;
/** 飛行中的空氣阻力：水平速度每秒衰減的比例係數（1/s）。 */
const AIR_DRAG = 1.5;
/** 放開時游標速度只有這個比例帶給 Toss，避免輕輕一甩就飛很遠。 */
const TOSS_TRANSFER = 0.35;
/** 游標速度低於此值時不 Toss，直接落下（px/s）。 */
const MIN_TOSS_SPEED = 800;
/**
 * 各拖拽物理模式的 Toss：maxSpeed 為速度上限（px/s），
 * restitution 為撞到螢幕邊緣時保留的速度比例。
 */
const TOSS: Record<Exclude<DragPhysics, "off">, Toss> = {
  standard: { maxSpeed: 2500, restitution: 0.25 },
  lively: { maxSpeed: 3500, restitution: 0.45 },
};
/** 物理模擬的固定步長，結果與 tick 間隔無關（ms）。 */
const PHYSICS_STEP = 4;
/** 從至少這個高度 Drop 才說 falling Line（px）。 */
const FALLING_LINE_HEIGHT = 300;
/** 落地壓扁回彈的長度，之後回到 idle 並說 landing Line（ms）。 */
export const LANDING_DURATION = 300;
/**
 * Affection Decay：Affection 高於 above 時，每累積 interval 的 Neglect 扣 1（ms）。
 * 越接近 100 掉得越快，避免狗狗長時間停在開心；由高到低排列。
 */
const DECAY_TIERS = [
  { above: 95, interval: 1 * 60_000 },
  { above: 90, interval: 2 * 60_000 },
  { above: 80, interval: 3 * 60_000 },
] as const;
const DECAY_INTERVAL = 60 * 60_000;
/** Stroll：每隔 STROLL_INTERVAL 判定一次，成功機率 STROLL_CHANCE，走 STROLL_DISTANCE 的距離。 */
const STROLL_INTERVAL = { min: 60_000, max: 3 * 60_000 } as const;
const STROLL_CHANCE = 0.3;
const STROLL_DISTANCE = { min: 50, max: 200 } as const;
/** 散步速度（px/s）。 */
const STROLL_SPEED = 60;
const STILL: Point = { x: 0, y: 0 };

export function createPet(deps: PetDeps): Pet {
  let snapshot: PetSnapshot | undefined;
  /** 在身上按下的位置與時間；未按在身上時為 undefined。 */
  let press:
    | {
        position: Point;
        time: number;
        /** 按在頭上：可以 Pat。 */
        onHead: boolean;
        dragged: boolean;
        patted: boolean;
        /** Pat 之後繼續撫摸已加過的 Affection。 */
        strokes: number;
      }
    | undefined;
  /** Pickup 中；Drop 時結束。 */
  let drag:
    | {
        since: number;
        /** 腳底相對游標的位置，維持抓住的那一點。 */
        offset: Point;
        /** 最近 VELOCITY_WINDOW 內的游標位置，由舊到新。 */
        samples: Sample[];
        /** 目前正快速拖拽。 */
        fast: boolean;
        /** 這次 Pickup 曾被快速甩動。 */
        shaken: boolean;
        fastLineAt: number;
        /** 已說過 draggedTooLong。 */
        complained: boolean;
        /** 拖太久而惹毛了狗狗：這次 Drop 不加 Affection。 */
        exhausted: boolean;
        /** 抱起時還在生氣：這次 Drop 不加 Affection。 */
        protested: boolean;
      }
    | undefined;
  /** Drop 後到停下為止：飛行、下落或在 Ground 上滑行。time 為已模擬到的時間。 */
  let flight: (Flight & { time: number; toss: Toss }) | undefined;
  /** 落到 Ground 的時間；落地演出結束後清除。 */
  let landedAt: number | undefined;
  let displays: readonly Display[] = [];
  let settings = DEFAULT_SETTINGS;
  let lastTick = 0;
  /** 使用者從系統列把狗狗收起來。 */
  let userHidden = false;
  /** 距上一次 Interaction 的時間，只計 App 執行中（ms）。 */
  let neglect = 0;
  /** 上次扣 Affection 後累積的 Neglect（ms）。 */
  let neglectSinceDecay = 0;
  /** 鬧彆扭中，直到 Make-up 才解除。 */
  let sulking = false;
  /** sulky 期間最近的 Interaction 時間，用來判斷 Make-up。 */
  let coaxes: number[] = [];
  /** annoyed 冷卻結束的時間；沒在冷卻中為 undefined。 */
  let annoyedUntil: number | undefined;
  /** 最近的 Click 時間，用來判斷連點。 */
  let clickTimes: number[] = [];
  /** 最近一次 tick 帶來的使用者狀態，推導 sleepy 用。 */
  let presence = { afkSeconds: 0, typing: false, hour: 12, fullscreen: false };
  /** Woken 清醒期結束的時間；沒在清醒期為 undefined。 */
  let wokenUntil: number | undefined;
  /** 下一次 Chatter 的時間；關閉時為 undefined。 */
  let nextChatter: number | undefined;
  /** 下一次 Stroll 判定的時間。 */
  let nextStroll = 0;
  /** 散步中：目標 x 與已走到的時間。 */
  let stroll: { targetX: number; time: number } | undefined;
  /** 不是當下動作直接產生、要在下次輸出時一併送出的效果。 */
  let pending: PetEffect[] = [];
  /** 下次輸出時要求存檔。 */
  let saveRequested = false;
  /** 上次存檔時的 Mood；Mood 改變也要存檔。 */
  let savedMood: Mood = "normal";
  const decks = createLineDecks(deps.lines, deps.random);

  function current(): PetSnapshot {
    if (!snapshot) throw new Error("Pet has not been started");
    return snapshot;
  }

  function output(effects: PetEffect[] = []): PetOutput {
    const pet = withDisplay(current());
    snapshot = pet;
    if (pending.length > 0) {
      effects = [...effects, ...pending];
      pending = [];
    }
    if (saveRequested || pet.mood !== savedMood) {
      saveRequested = false;
      savedMood = pet.mood;
      effects = [...effects, save()];
    }
    return { snapshot: pet, effects };
  }

  /** 依隱藏與互動狀態填入 hidden 與建議 fps；沒變就沿用原物件。 */
  function withDisplay(pet: PetSnapshot): PetSnapshot {
    const hidden = presence.fullscreen || userHidden;
    const interacting =
      press !== undefined ||
      drag !== undefined ||
      (pet.motion !== "idle" &&
        pet.motion !== "strolling" &&
        pet.motion !== "sleeping");
    const fps = hidden
      ? 0
      : interacting
        ? FPS_INTERACTING
        : pet.mood === "sleepy" || presence.afkSeconds > AFK_SLOW_SECONDS
          ? FPS_SLOW
          : FPS_IDLE;
    if (pet.hidden === hidden && pet.fps === fps) return pet;
    return { ...pet, hidden, fps };
  }

  function save(): PetEffect {
    const { affection, displayId, position } = current();
    const petState = {
      affection,
      displayId,
      position,
      neglect,
      neglectSinceDecay,
      sulking,
    };
    return { type: "save", petState, settings };
  }

  /** 從 from 起依頻率抽出下一次 Chatter 的時間。 */
  function scheduleChatter(from: number): void {
    if (settings.chatter === "off") {
      nextChatter = undefined;
      return;
    }
    const { min, max } = CHATTER_INTERVAL[settings.chatter];
    nextChatter = from + min + deps.random() * (max - min);
  }

  /** 到時間且沒被打斷（打字、拖拽、睡覺）才說話；錯過的就等到可以時再說。 */
  function chatter(now: number): PetEffect[] {
    if (nextChatter === undefined || now < nextChatter) return [];
    const pet = current();
    if (
      drag ||
      pet.mood === "sleepy" ||
      presence.fullscreen ||
      userHidden ||
      (presence.typing && settings.quietWhileTyping)
    ) {
      return [];
    }
    scheduleChatter(now);
    return [say(linePool(pet))];
  }

  function scheduleStroll(from: number): void {
    const { min, max } = STROLL_INTERVAL;
    nextStroll = from + min + deps.random() * (max - min);
  }

  /** 閒置且心情允許時才散步：sleepy、lonely、sulky 與拖拽中不散步。 */
  function canStroll(): boolean {
    const { mood, motion } = current();
    return (
      !drag &&
      !press &&
      (motion === "idle" || motion === "strolling") &&
      mood !== "sleepy" &&
      mood !== "lonely" &&
      mood !== "sulky"
    );
  }

  /** 推進散步，並在到時間時判定要不要開始新的一段。 */
  function walk(now: number): void {
    if (stroll && !canStroll()) {
      stroll = undefined;
      setMotion("idle");
    }
    if (stroll) {
      const pet = current();
      const reach = (STROLL_SPEED * (now - stroll.time)) / 1000;
      const left = stroll.targetX - pet.position.x;
      stroll.time = now;
      if (Math.abs(left) <= reach) {
        snapshot = { ...pet, position: { ...pet.position, x: stroll.targetX } };
        stroll = undefined;
        setMotion("idle");
      } else {
        const x = pet.position.x + Math.sign(left) * reach;
        snapshot = { ...pet, position: { ...pet.position, x } };
      }
    }
    if (now < nextStroll) return;
    scheduleStroll(now);
    if (!stroll && canStroll() && deps.random() < STROLL_CHANCE) {
      beginStroll(now);
    }
  }

  function beginStroll(now: number): void {
    const pet = current();
    const area = feetArea(displayOf(displays, pet.displayId), displays);
    const { min, max } = STROLL_DISTANCE;
    const length = min + deps.random() * (max - min);
    let direction = deps.random() < 0.5 ? -1 : 1;
    // 走出螢幕就改往另一邊；兩邊都放不下時只走到邊緣。
    const fits = (d: number) => {
      const x = pet.position.x + d * length;
      return x >= area.left && x <= area.right;
    };
    if (!fits(direction) && fits(-direction)) direction = -direction;
    const targetX = clamp(
      pet.position.x + direction * length,
      area.left,
      area.right
    );
    stroll = { targetX, time: now };
    snapshot = { ...pet, facing: direction < 0 ? "left" : "right" };
    setMotion("strolling");
  }

  function say(pool: LinePool): PetEffect {
    const line = decks.draw(pool).replaceAll("{name}", settings.name);
    return { type: "say", line };
  }

  /** 更新 Affection 並重新推導 Mood；沒有變化時保留原快照。 */
  function update(affectionDelta = 0): PetSnapshot {
    const pet = current();
    const affection = clampAffection(pet.affection + affectionDelta);
    // Afterglow：Pat 之後持續按住的期間，放開即結束。
    const afterglow = press?.patted ?? false;
    if (neglect > SULKY_NEGLECT) sulking = true;
    const annoyed = annoyedUntil !== undefined && lastTick < annoyedUntil;
    const woken = wokenUntil !== undefined && lastTick < wokenUntil;
    const settled = pet.motion === "idle" || pet.motion === "sleeping";
    const sleepy =
      settled &&
      !woken &&
      settings.nightSleep &&
      isNight(presence.hour) &&
      presence.afkSeconds > SLEEP_AFK &&
      !presence.typing;
    const mood = deriveMood(
      affection,
      afterglow,
      neglect,
      sulking,
      annoyed,
      sleepy
    );
    const motion = mood === "sleepy" ? "sleeping" : wakeUp(pet.motion);
    if (
      affection !== pet.affection ||
      mood !== pet.mood ||
      afterglow !== pet.afterglow ||
      motion !== pet.motion
    ) {
      snapshot = { ...pet, affection, mood, afterglow, motion };
    }
    return current();
  }

  /** Interaction 重置 Neglect：衰減重新計時，lonely／sulky 隨之結束。 */
  function interact(now: number, pat = false): void {
    decay(now);
    neglect = 0;
    neglectSinceDecay = 0;
    if (sulking) coax(now, pat);
    update();
  }

  /** sulky 時的 Interaction：Pat 或短時間內夠多次就 Make-up。 */
  function coax(now: number, pat: boolean): void {
    coaxes = [...coaxes.filter((t) => now - t <= MAKE_UP_WINDOW), now];
    if (!pat && coaxes.length < MAKE_UP_INTERACTIONS) return;
    sulking = false;
    coaxes = [];
    saveRequested = true;
    pending.push(say("makeUp"));
  }

  // 只有 Pat 會增加 Affection；Click 只說一句話。
  function click(now: number): PetOutput {
    const wasSulking = sulking;
    const wasSleeping = wakeIfSleeping(now);
    interact(now);
    clickTimes = [
      ...clickTimes.filter((t) => now - t <= CLICK_BURST_WINDOW),
      now,
    ];
    if (clickTimes.length >= CLICK_BURST) {
      clickTimes = [];
      annoyedUntil = now + ANNOYED_COOLDOWN;
      update(BURST_AFFECTION);
      return output([say("annoyed")]);
    }
    if (wasSleeping) {
      return output([
        { type: "playAnimation", animation: "rubEyes" },
        say("woken"),
      ]);
    }
    // Make-up 的 makeUp Line 已排入 pending。
    if (wasSulking)
      return output(
        sulking
          ? [{ type: "playAnimation", animation: "hmph" }, say("sulkyCoaxing")]
          : []
      );
    return output([say(linePool(current()))]);
  }

  /** 睡著時被吵醒：之後 WOKEN_DURATION 內不再入睡。回傳原本是否睡著。 */
  function wakeIfSleeping(now: number): boolean {
    if (current().mood !== "sleepy") return false;
    wokenUntil = now + WOKEN_DURATION;
    return true;
  }

  /** 依上次 tick 以來的 Neglect 扣 Affection。 */
  function decay(now: number): void {
    let remaining = now - lastTick;
    lastTick = now;
    neglect += remaining;
    update();
    while (remaining > 0 && current().affection > 0) {
      const interval = decayInterval(current().affection);
      const untilDecay = interval - neglectSinceDecay;
      if (remaining < untilDecay) {
        neglectSinceDecay += remaining;
        return;
      }
      remaining -= untilDecay;
      neglectSinceDecay = 0;
      update(-1);
    }
  }

  /** 狗狗目前所在螢幕的 Ground。 */
  function groundY(): number {
    return ground(displayOf(displays, current().displayId).workArea);
  }

  function setVelocity(velocity: Point): void {
    const pet = current();
    if (velocity.x !== pet.velocity.x || velocity.y !== pet.velocity.y) {
      snapshot = { ...pet, velocity };
    }
  }

  function setMotion(motion: Motion): void {
    if (current().motion !== motion) snapshot = { ...current(), motion };
  }

  /** grab 為按下的位置，at 為目前游標位置。 */
  function pickup(now: number, grab: Point, at: Point): PetOutput {
    wakeIfSleeping(now);
    interact(now);
    // 在空中或落地時也能再抓起，取消下落與落地演出。
    flight = undefined;
    landedAt = undefined;
    stroll = undefined;
    const { position } = current();
    drag = {
      since: now,
      offset: { x: position.x - grab.x, y: position.y - grab.y },
      samples: [{ time: now, position: at }],
      fast: false,
      shaken: false,
      fastLineAt: -Infinity,
      complained: false,
      exhausted: false,
      protested: current().mood === "annoyed",
    };
    moveTo(at);
    setMotion("pickedUp");
    return output([say(drag.protested ? "protestPickup" : "pickedUp")]);
  }

  /** 拖拽中讓腳底跟著游標，可跨螢幕，但限制在某個螢幕的工作區域內。 */
  function moveTo(at: Point): void {
    if (!drag) return;
    const pet = current();
    const { display, position } = nearestPlace(displays, {
      x: at.x + drag.offset.x,
      y: at.y + drag.offset.y,
    });
    if (
      display.id !== pet.displayId ||
      position.x !== pet.position.x ||
      position.y !== pet.position.y
    ) {
      snapshot = { ...pet, displayId: display.id, position };
    }
  }

  /** 拖拽中隨時間推進 Motion，並依游標速度判斷快速拖拽。 */
  function carry(now: number, at?: Point): PetEffect[] {
    if (!drag) return [];
    if (now - drag.since >= PICKUP_DURATION) setMotion("dragging");
    if (at) drag.samples.push({ time: now, position: at });
    drag.samples = recent(drag.samples, now);
    const velocity = velocityOf(drag.samples);
    setVelocity(velocity);
    const effects = complain(now);
    const fast = speed(velocity) > FAST_DRAG_SPEED;
    const started = fast && !drag.fast;
    drag.fast = fast;
    if (!started) return effects;
    drag.shaken = true;
    if (now - drag.fastLineAt < FAST_LINE_COOLDOWN) return effects;
    drag.fastLineAt = now;
    return [...effects, say("fastDragging")];
  }

  /** 拖太久：8 秒說 draggedTooLong，15 秒惹毛狗狗。 */
  function complain(now: number): PetEffect[] {
    if (!drag) return [];
    const held = now - drag.since;
    const effects: PetEffect[] = [];
    if (!drag.complained && held >= DRAG_COMPLAINT) {
      drag.complained = true;
      effects.push(say("draggedTooLong"));
    }
    if (!drag.exhausted && held >= DRAG_LIMIT) {
      drag.exhausted = true;
      annoyedUntil = now + ANNOYED_COOLDOWN;
      update();
    }
    return effects;
  }

  /** at 為放開時的游標位置；游標仍有速度時 Toss。 */
  function drop(now: number, at: Point): PetOutput {
    // 被快速甩動不加也不扣。
    complain(now);
    const safe = !drag?.shaken && !drag?.exhausted && !drag?.protested;
    const samples = [...(drag?.samples ?? []), { time: now, position: at }];
    const physics = settings.dragPhysics;
    const toss = physics === "off" ? undefined : TOSS[physics];
    const release = velocityOf(recent(samples, now));
    const velocity =
      toss && speed(release) >= MIN_TOSS_SPEED
        ? limitSpeed(scale(release, TOSS_TRANSFER), toss.maxSpeed)
        : STILL;
    drag = undefined;
    setVelocity(velocity);
    interact(now);
    update(safe ? SAFE_DROP_AFFECTION : 0);
    const from = current().position;
    if (!toss) {
      snapshot = { ...current(), position: { x: from.x, y: groundY() } };
      landedAt = now;
      setMotion("landing");
      return output();
    }
    flight = { position: from, velocity, time: now, grounded: false, toss };
    setMotion("falling");
    return output(
      groundY() - from.y >= FALLING_LINE_HEIGHT ? [say("falling")] : []
    );
  }

  /** 依物理推進 Toss、下落與滑行；落地演出結束時回傳 landing Line。 */
  function settle(now: number): PetEffect[] {
    if (flight) {
      const area = feetArea(displayOf(displays, current().displayId), displays);
      while (flight.time < now) {
        const ms = Math.min(PHYSICS_STEP, now - flight.time);
        flight.time += ms;
        if (step(flight, ms / 1000, area, flight.toss.restitution)) {
          landedAt = flight.time;
          setMotion("landing");
        }
      }
      const { position, velocity, grounded } = flight;
      snapshot = { ...current(), position, velocity };
      // 在 Ground 上停下才算結束。
      if (grounded && velocity.x === 0) flight = undefined;
    }
    if (
      !flight &&
      landedAt !== undefined &&
      now - landedAt >= LANDING_DURATION
    ) {
      landedAt = undefined;
      setMotion("idle");
      // 停在 Ground 上了：存下位置。
      saveRequested = true;
      return [say("landing")];
    }
    return [];
  }

  /** 按住不動達 PAT_HOLD 時觸發一次 Pat；回傳這次按住是否已 Pat。 */
  function patIfHeld(now: number): boolean {
    // 在頭上移動是在撫摸，不會取消 Pat；拖曳只從頭部以外判斷。
    if (!press?.onHead) return false;
    const held = now - press.time;
    if (!press.patted && held >= PAT_HOLD) {
      press.patted = true;
      // 睡覺中的 Pat 不吵醒，只在夢中搖一下尾巴。
      if (current().mood === "sleepy") {
        pending.push({ type: "playAnimation", animation: "dreamWag" });
      }
      interact(now, true);
      update(PAT_AFFECTION);
      saveRequested = true;
    }
    if (press.patted) {
      const strokes = Math.floor((held - PAT_HOLD) / STROKE_INTERVAL);
      if (strokes > press.strokes) {
        interact(now);
        update(strokes - press.strokes);
        press.strokes = strokes;
      }
    }
    return press.patted;
  }

  return {
    start(input) {
      settings = readSettings(input.settings);
      const saved = fields(input.saved);
      displays = input.displays;
      lastTick = input.now;
      scheduleChatter(input.now);
      scheduleStroll(input.now);
      stroll = undefined;
      neglect = Math.max(0, numberOr(saved["neglect"], 0));
      neglectSinceDecay = Math.max(0, numberOr(saved["neglectSinceDecay"], 0));
      sulking = saved["sulking"] === true || neglect > SULKY_NEGLECT;
      snapshot = restSnapshot(
        savedPlace(input.displays, saved) ?? homePlace(input.displays),
        clampAffection(numberOr(saved["affection"], DEFAULT_AFFECTION)),
        neglect,
        sulking
      );
      savedMood = current().mood;
      return output([
        { type: "playAnimation", animation: "greeting" },
        say("greeting"),
        { type: "launchAtLogin", enabled: settings.launchAtLogin },
      ]);
    },
    tick(input) {
      const { now } = input;
      displays = input.displays;
      presence = {
        afkSeconds: input.afkSeconds ?? 0,
        typing: input.typing ?? false,
        hour: input.hour ?? 12,
        fullscreen: input.fullscreen ?? false,
      };
      decay(now);
      patIfHeld(now);
      const effects = [...carry(now), ...settle(now)];
      walk(now);
      if (effects.some((e) => e.type === "say")) return output(effects);
      return output([...effects, ...chatter(now)]);
    },
    stop({ now }) {
      decay(now);
      saveRequested = true;
      return output();
    },
    setVisible(visible) {
      userHidden = !visible;
      return output();
    },
    resetAffection() {
      neglect = 0;
      neglectSinceDecay = 0;
      sulking = false;
      coaxes = [];
      annoyedUntil = undefined;
      clickTimes = [];
      wokenUntil = undefined;
      update(DEFAULT_AFFECTION - current().affection);
      saveRequested = true;
      return output();
    },
    configure(change) {
      const before = settings;
      settings = { ...settings, ...change };
      if (settings.chatter !== before.chatter) scheduleChatter(lastTick);
      saveRequested = true;
      if (settings.launchAtLogin === before.launchAtLogin) return output();
      return output([
        { type: "launchAtLogin", enabled: settings.launchAtLogin },
      ]);
    },
    pointer(event) {
      if (event.type === "down") {
        press =
          event.hit !== "none"
            ? {
                position: event.position,
                time: event.time,
                onHead: event.hit === "head",
                dragged: false,
                patted: false,
                strokes: 0,
              }
            : undefined;
        return output();
      }
      if (!press) return output();
      if (distance(press.position, event.position) > DRAG_THRESHOLD) {
        press.dragged = true;
      }
      if (event.type === "move") {
        // 頭上移動是在撫摸；只有頭部以外的身體可以抱起。
        if (press.dragged && !press.onHead && !drag) {
          return pickup(event.time, press.position, event.position);
        }
        moveTo(event.position);
        return output(carry(event.time, event.position));
      }
      if (event.type === "up") {
        const patted = patIfHeld(event.time);
        const { dragged, time } = press;
        press = undefined;
        if (drag) return drop(event.time, event.position);
        const quick = event.time - time < PAT_HOLD;
        if (!dragged && !patted && quick) return click(event.time);
        update();
      }
      return output();
    },
  };
}

/** 存檔的欄位；不是物件時視為沒有任何欄位。 */
function fields(saved: unknown): Readonly<Record<string, unknown>> {
  return typeof saved === "object" && saved !== null
    ? (saved as Record<string, unknown>)
    : {};
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readSettings(saved: unknown): Settings {
  const {
    name,
    dragPhysics,
    nightSleep,
    chatter,
    quietWhileTyping,
    launchAtLogin,
  } = fields(saved);
  return {
    name:
      typeof name === "string" && name !== "" ? name : DEFAULT_SETTINGS.name,
    dragPhysics:
      DRAG_PHYSICS.find((p) => p === dragPhysics) ??
      DEFAULT_SETTINGS.dragPhysics,
    nightSleep:
      typeof nightSleep === "boolean"
        ? nightSleep
        : DEFAULT_SETTINGS.nightSleep,
    chatter:
      CHATTER_FREQUENCIES.find((f) => f === chatter) ??
      DEFAULT_SETTINGS.chatter,
    quietWhileTyping:
      typeof quietWhileTyping === "boolean"
        ? quietWhileTyping
        : DEFAULT_SETTINGS.quietWhileTyping,
    launchAtLogin:
      typeof launchAtLogin === "boolean"
        ? launchAtLogin
        : DEFAULT_SETTINGS.launchAtLogin,
  };
}

function isNight(hour: number): boolean {
  return hour >= NIGHT_START || hour < NIGHT_END;
}

/** 睡著的 Motion 在不再 sleepy 時回到 idle。 */
function wakeUp(motion: Motion): Motion {
  return motion === "sleeping" ? "idle" : motion;
}

function deriveMood(
  affection: number,
  afterglow: boolean,
  neglect: number,
  sulking: boolean,
  annoyed: boolean,
  sleepy = false
): Mood {
  if (annoyed) return "annoyed";
  if (sleepy) return "sleepy";
  if (sulking) return "sulky";
  if (neglect > LONELY_NEGLECT) return "lonely";
  return afterglow || affection >= HAPPY_AFFECTION ? "happy" : "normal";
}

function decayInterval(affection: number): number {
  return (
    DECAY_TIERS.find(({ above }) => affection > above)?.interval ??
    DECAY_INTERVAL
  );
}

function clampAffection(affection: number): number {
  return clamp(affection, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function linePool({ mood, affection }: PetSnapshot): LinePool {
  return mood === "normal" && affection < COLD_AFFECTION ? "coldNormal" : mood;
}

/**
 * 腳底可以到的範圍：整隻狗留在工作區域內；
 * 左右緣與相鄰螢幕相接時放寬到中心點可以碰到邊緣，跨螢幕時不會跳開。
 */
interface FeetArea {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function feetArea(display: Display, displays: readonly Display[]): FeetArea {
  const { workArea } = display;
  const halfWidth = PET_SIZE.width / 2;
  const right = workArea.x + workArea.width;
  /** 另一個螢幕的 edge 落在 x 上且上下範圍重疊：兩者左右相接。 */
  const neighbor = (edge: (other: Rect) => number, x: number) =>
    displays.some(
      ({ id, workArea: a }) =>
        id !== display.id &&
        edge(a) === x &&
        a.y < ground(workArea) &&
        workArea.y < ground(a)
    );
  return {
    left:
      workArea.x + (neighbor((a) => a.x + a.width, workArea.x) ? 0 : halfWidth),
    right: right - (neighbor((a) => a.x, right) ? 0 : halfWidth),
    top: workArea.y + PET_SIZE.height,
    bottom: ground(workArea),
  };
}

/** 離 feet 最近、狗狗可以待的位置，以及它所在的螢幕。 */
function nearestPlace(displays: readonly Display[], feet: Point): Place {
  const places = displays.map((display) => {
    const area = feetArea(display, displays);
    const position = {
      x: clamp(feet.x, area.left, area.right),
      y: clamp(feet.y, area.top, area.bottom),
    };
    return { display, position };
  });
  const [nearest] = places.sort(
    (a, b) => distance(a.position, feet) - distance(b.position, feet)
  );
  if (!nearest) throw new Error("No displays");
  return nearest;
}

interface Toss {
  readonly maxSpeed: number;
  readonly restitution: number;
}

interface Flight {
  position: Point;
  velocity: Point;
  /** 已落到 Ground，之後在 Ground 上滑行。 */
  grounded: boolean;
}

/** 推進一個物理步長；回傳這一步是否剛落到 Ground。 */
function step(
  flight: Flight,
  dt: number,
  area: FeetArea,
  restitution: number
): boolean {
  let { x, y } = flight.position;
  let { x: vx, y: vy } = flight.velocity;
  let landed = false;
  if (!flight.grounded) {
    vx *= Math.exp(-AIR_DRAG * dt);
    y += vy * dt + (GRAVITY * dt * dt) / 2;
    vy += GRAVITY * dt;
    if (y >= area.bottom) {
      y = area.bottom;
      vy = 0;
      flight.grounded = true;
      landed = true;
    } else if (y < area.top) {
      y = area.top;
      vy = -vy * restitution;
    }
  } else {
    const slowdown = FRICTION * dt;
    vx = Math.abs(vx) <= slowdown ? 0 : vx - Math.sign(vx) * slowdown;
  }
  x += vx * dt;
  // 撞到左右邊緣反彈。
  if (x < area.left || x > area.right) {
    x = clamp(x, area.left, area.right);
    vx = -vx * restitution;
  }
  flight.position = { x, y };
  flight.velocity = { x: vx, y: vy };
  return landed;
}

type Sample = { time: number; position: Point };

/** 只留最近 VELOCITY_WINDOW 內的樣本。 */
function recent(samples: readonly Sample[], now: number): Sample[] {
  return samples.filter((s) => now - s.time <= VELOCITY_WINDOW);
}

/** 由舊到新的位置樣本推算速度（px/s）；樣本不足時為 0。 */
function velocityOf(samples: readonly Sample[]): Point {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || last.time === first.time) return STILL;
  const seconds = (last.time - first.time) / 1000;
  return {
    x: (last.position.x - first.position.x) / seconds,
    y: (last.position.y - first.position.y) / seconds,
  };
}

function speed(velocity: Point): number {
  return Math.hypot(velocity.x, velocity.y);
}

function scale(velocity: Point, ratio: number): Point {
  return { x: velocity.x * ratio, y: velocity.y * ratio };
}

function limitSpeed(velocity: Point, max: number): Point {
  const ratio = max / speed(velocity);
  return ratio < 1 ? scale(velocity, ratio) : velocity;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function primaryDisplay(displays: readonly Display[]): Display {
  const display = displays.find((d) => d.primary) ?? displays[0];
  if (!display) throw new Error("No displays");
  return display;
}

/** 找不到時（例如螢幕被拔掉）退回主螢幕。 */
function displayOf(displays: readonly Display[], id: DisplayId): Display {
  return displays.find((d) => d.id === id) ?? primaryDisplay(displays);
}

function ground(workArea: Rect): number {
  return workArea.y + workArea.height;
}

interface Place {
  readonly display: Display;
  readonly position: Point;
}

/** 主螢幕右下角的 Ground。 */
function homePlace(displays: readonly Display[]): Place {
  const display = primaryDisplay(displays);
  const { workArea } = display;
  return {
    display,
    position: {
      x: workArea.x + workArea.width - HOME_RIGHT_INSET,
      y: ground(workArea),
    },
  };
}

/** 上次所在螢幕的 Ground；螢幕已不存在或位置損壞時為 undefined。 */
function savedPlace(
  displays: readonly Display[],
  saved: Readonly<Record<string, unknown>>
): Place | undefined {
  const display = displays.find((d) => d.id === saved["displayId"]);
  const x = numberOr(fields(saved["position"])["x"], NaN);
  if (!display || Number.isNaN(x)) return undefined;
  // 螢幕解析度可能變了：夾回工作區域內。
  const area = feetArea(display, displays);
  return {
    display,
    position: { x: clamp(x, area.left, area.right), y: area.bottom },
  };
}

function restSnapshot(
  { display, position }: Place,
  affection: number,
  neglect: number,
  sulking: boolean
): PetSnapshot {
  return {
    mood: deriveMood(affection, false, neglect, sulking, false),
    motion: "idle",
    affection,
    afterglow: false,
    displayId: display.id,
    position,
    velocity: STILL,
    facing: "left",
    hidden: false,
    fps: FPS_IDLE,
  };
}
