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
  /** 0–100。 */
  readonly affection: number;
  /** Pat 後仍持續摸著（Afterglow 中）。 */
  readonly afterglow: boolean;
  readonly displayId: DisplayId;
  /** 狗狗腳底中心點，螢幕座標；靜止時 y 等於 Ground。 */
  readonly position: Point;
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
/** Pat 之後繼續撫摸，每隔這麼久再 +1（ms）。 */
const STROKE_INTERVAL = 1000;
const HAPPY_AFFECTION = 75;
/** 低於此值時 normal 改用 coldNormal Line Pool。 */
const COLD_AFFECTION = 30;
/** 按下後移動超過此距離就不再是 Click。 */
const DRAG_THRESHOLD = 6;
/** 在頭上按住達此時間即為 Pat；任何部位按住達此時間放開都不是 Click（ms）。 */
const PAT_HOLD = 1000;
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
    tick({ now }) {
      decay(now);
      patIfHeld(now);
      return output();
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
      if (event.type === "up") {
        const patted = patIfHeld(event.time);
        const { dragged, time } = press;
        press = undefined;
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
  return Math.min(100, Math.max(0, affection));
}

function linePool({ mood, affection }: PetSnapshot): LinePool {
  return mood === "normal" && affection < COLD_AFFECTION ? "coldNormal" : mood;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function primaryDisplay(displays: readonly Display[]): Display {
  const display = displays.find((d) => d.primary) ?? displays[0];
  if (!display) throw new Error("No displays");
  return display;
}

function homeSnapshot(display: Display, affection: number): PetSnapshot {
  const { workArea } = display;
  return {
    mood: deriveMood(affection, false),
    affection,
    afterglow: false,
    displayId: display.id,
    position: {
      x: workArea.x + workArea.width - HOME_RIGHT_INSET,
      y: workArea.y + workArea.height,
    },
    facing: "left",
  };
}
