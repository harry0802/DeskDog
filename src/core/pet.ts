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
  /** 上次存檔；之後的 issue 會補齊欄位與正規化。 */
  readonly saved?: Partial<SavedPetState>;
  readonly settings?: Partial<Settings>;
}

export interface SavedPetState {
  readonly affection: number;
}

export interface Settings {
  /** 狗狗名字，帶入 Line 中的 {name}。 */
  readonly name: string;
}

export interface TickInput {
  readonly now: number;
  readonly displays: readonly Display[];
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
  /** 拖拽中游標的速度（px/s），Rig 據此傾斜與拉伸；其餘時候為 0。 */
  readonly velocity: Point;
  readonly facing: "left" | "right";
}

/** 之後的 issue 會加入要求存檔等效果。 */
export type PetEffect =
  | { readonly type: "say"; readonly line: string }
  | { readonly type: "playAnimation"; readonly animation: "greeting" };

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
}

/** 腳底中心點距離工作區域右緣的距離。 */
const HOME_RIGHT_INSET = 120;
const DEFAULT_AFFECTION = 50;
const DEFAULT_SETTINGS: Settings = { name: "小柴" };
const PAT_AFFECTION = 4;
const SAFE_DROP_AFFECTION = 1;
/** Pat 之後繼續撫摸，每隔這麼久再 +1（ms）。 */
const STROKE_INTERVAL = 1000;
const HAPPY_AFFECTION = 75;
/** 低於此值時 normal 改用 coldNormal Line Pool。 */
const COLD_AFFECTION = 30;
/** 按下後移動超過此距離就不再是 Click。 */
const DRAG_THRESHOLD = 6;
/** 在頭上按住達此時間即為 Pat；任何部位按住達此時間放開都不是 Click（ms）。 */
const PAT_HOLD = 1000;
/** 狗狗外框大小，腳底在底部中央；拖拽時整隻狗留在工作區域內。 */
const PET_SIZE = { width: 220, height: 170 } as const;
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
        samples: { time: number; position: Point }[];
        /** 目前正快速拖拽。 */
        fast: boolean;
        /** 這次 Pickup 曾被快速甩動。 */
        shaken: boolean;
        fastLineAt: number;
      }
    | undefined;
  /** Drop 後下落中：放開時的位置與時間。 */
  let fall: { from: Point; time: number } | undefined;
  /** 落到 Ground 的時間；落地演出結束後清除。 */
  let landedAt: number | undefined;
  let displays: readonly Display[] = [];
  let settings = DEFAULT_SETTINGS;
  let lastTick = 0;
  /** 上次扣 Affection 後累積的 Neglect（ms）。 */
  let neglectSinceDecay = 0;
  const decks = createLineDecks(deps.lines, deps.random);

  function current(): PetSnapshot {
    if (!snapshot) throw new Error("Pet has not been started");
    return snapshot;
  }

  function output(effects: PetEffect[] = []): PetOutput {
    return { snapshot: current(), effects };
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
    const mood = deriveMood(affection, afterglow);
    if (
      affection !== pet.affection ||
      mood !== pet.mood ||
      afterglow !== pet.afterglow
    ) {
      snapshot = { ...pet, affection, mood, afterglow };
    }
    return current();
  }

  /** Interaction 重置 Neglect：衰減重新計時。 */
  function interact(now: number): void {
    decay(now);
    neglectSinceDecay = 0;
  }

  // 只有 Pat 會增加 Affection；Click 只說一句話。
  function click(now: number): PetOutput {
    interact(now);
    return output([say(linePool(current()))]);
  }

  /** 依上次 tick 以來的 Neglect 扣 Affection。 */
  function decay(now: number): void {
    let remaining = now - lastTick;
    lastTick = now;
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
    interact(now);
    // 在空中或落地時也能再抓起，取消下落與落地演出。
    fall = undefined;
    landedAt = undefined;
    const { position } = current();
    drag = {
      since: now,
      offset: { x: position.x - grab.x, y: position.y - grab.y },
      samples: [{ time: now, position: at }],
      fast: false,
      shaken: false,
      fastLineAt: -Infinity,
    };
    moveTo(at);
    setMotion("pickedUp");
    return output([say("pickedUp")]);
  }

  /** 拖拽中讓腳底跟著游標，限制在目前螢幕的工作區域內。 */
  function moveTo(at: Point): void {
    if (!drag) return;
    const pet = current();
    const { workArea } = displayOf(displays, pet.displayId);
    const halfWidth = PET_SIZE.width / 2;
    const position = {
      x: clamp(
        at.x + drag.offset.x,
        workArea.x + halfWidth,
        workArea.x + workArea.width - halfWidth
      ),
      y: clamp(
        at.y + drag.offset.y,
        workArea.y + PET_SIZE.height,
        ground(workArea)
      ),
    };
    if (position.x !== pet.position.x || position.y !== pet.position.y) {
      snapshot = { ...pet, position };
    }
  }

  /** 拖拽中隨時間推進 Motion，並依游標速度判斷快速拖拽。 */
  function carry(now: number, at?: Point): PetEffect[] {
    if (!drag) return [];
    if (now - drag.since >= PICKUP_DURATION) setMotion("dragging");
    if (at) drag.samples.push({ time: now, position: at });
    drag.samples = drag.samples.filter((s) => now - s.time <= VELOCITY_WINDOW);
    const velocity = velocityOf(drag.samples);
    setVelocity(velocity);
    const fast = speed(velocity) > FAST_DRAG_SPEED;
    const started = fast && !drag.fast;
    drag.fast = fast;
    if (!started) return [];
    drag.shaken = true;
    if (now - drag.fastLineAt < FAST_LINE_COOLDOWN) return [];
    drag.fastLineAt = now;
    return [say("fastDragging")];
  }

  function drop(now: number): PetOutput {
    // 被快速甩動不加也不扣。
    const safe = !drag?.shaken;
    drag = undefined;
    setVelocity(STILL);
    interact(now);
    update(safe ? SAFE_DROP_AFFECTION : 0);
    const from = current().position;
    fall = { from, time: now };
    setMotion("falling");
    return output(
      groundY() - from.y >= FALLING_LINE_HEIGHT ? [say("falling")] : []
    );
  }

  /** 依重力推進下落與落地；落地演出結束時回傳 landing Line。 */
  function settle(now: number): PetEffect[] {
    if (fall) {
      const { from, time } = fall;
      const y0 = groundY();
      // 落到 Ground 的時間由下落高度直接算出，與 tick 間隔無關。
      const impact = time + Math.sqrt((2 * (y0 - from.y)) / GRAVITY) * 1000;
      if (now < impact) {
        const t = (now - time) / 1000;
        const y = from.y + (GRAVITY * t * t) / 2;
        snapshot = { ...current(), position: { x: from.x, y } };
        return [];
      }
      fall = undefined;
      landedAt = impact;
      snapshot = { ...current(), position: { x: from.x, y: y0 } };
      setMotion("landing");
    }
    if (landedAt !== undefined && now - landedAt >= LANDING_DURATION) {
      landedAt = undefined;
      setMotion("idle");
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
      interact(now);
      update(PAT_AFFECTION);
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
      settings = { ...DEFAULT_SETTINGS, ...input.settings };
      displays = input.displays;
      lastTick = input.now;
      snapshot = homeSnapshot(
        primaryDisplay(input.displays),
        clampAffection(input.saved?.affection ?? DEFAULT_AFFECTION)
      );
      return output([
        { type: "playAnimation", animation: "greeting" },
        say("greeting"),
      ]);
    },
    tick(input) {
      const { now } = input;
      displays = input.displays;
      decay(now);
      patIfHeld(now);
      return output([...carry(now), ...settle(now)]);
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
        if (drag) return drop(event.time);
        const quick = event.time - time < PAT_HOLD;
        if (!dragged && !patted && quick) return click(event.time);
        update();
      }
      return output();
    },
  };
}

// 之後的 issue 會加入 annoyed、sleepy、sulky、lonely。
function deriveMood(affection: number, afterglow: boolean): Mood {
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

/** 由舊到新的位置樣本推算速度（px/s）；樣本不足時為 0。 */
function velocityOf(
  samples: readonly { time: number; position: Point }[]
): Point {
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

function homeSnapshot(display: Display, affection: number): PetSnapshot {
  const { workArea } = display;
  return {
    mood: deriveMood(affection, false),
    motion: "idle",
    affection,
    afterglow: false,
    displayId: display.id,
    position: {
      x: workArea.x + workArea.width - HOME_RIGHT_INSET,
      y: ground(workArea),
    },
    velocity: STILL,
    facing: "left",
  };
}
