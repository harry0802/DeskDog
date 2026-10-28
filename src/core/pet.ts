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
  /** 上次存檔；格式尚未定義，目前忽略。 */
  readonly saved?: unknown;
  readonly settings?: Partial<Settings>;
}

export interface Settings {
  /** 狗狗名字，帶入 Line 中的 {name}。 */
  readonly name: string;
}

export interface TickInput {
  readonly now: number;
  readonly displays: readonly Display[];
}

export interface PointerEvent {
  readonly type: "down" | "move" | "up";
  readonly time: number;
  /** 螢幕座標。 */
  readonly position: Point;
  readonly hitBody: boolean;
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
const CLICK_AFFECTION = 2;
const HAPPY_AFFECTION = 75;
/** 按下後移動超過此距離就不再是 Click。 */
const DRAG_THRESHOLD = 6;
/** 按住達此時間就不再是 Click（ms）。 */
const CLICK_MAX_DURATION = 1000;

export function createPet(deps: PetDeps): Pet {
  let snapshot: PetSnapshot | undefined;
  /** 在身上按下的位置與時間；未按在身上時為 undefined。 */
  let press: { position: Point; time: number; dragged: boolean } | undefined;
  let settings = DEFAULT_SETTINGS;
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

  function click(): PetOutput {
    const affection = Math.min(100, current().affection + CLICK_AFFECTION);
    snapshot = { ...current(), affection, mood: deriveMood(affection) };
    return output([say(snapshot.mood)]);
  }

  return {
    start(input) {
      settings = { ...DEFAULT_SETTINGS, ...input.settings };
      snapshot = homeSnapshot(primaryDisplay(input.displays));
      return output([
        { type: "playAnimation", animation: "greeting" },
        say("greeting"),
      ]);
    },
    tick() {
      return output();
    },
    pointer(event) {
      if (event.type === "down") {
        press = event.hitBody
          ? { position: event.position, time: event.time, dragged: false }
          : undefined;
        return output();
      }
      if (!press) return output();
      if (distance(press.position, event.position) > DRAG_THRESHOLD) {
        press.dragged = true;
      }
      if (event.type === "up") {
        const { dragged, time } = press;
        press = undefined;
        if (!dragged && event.time - time < CLICK_MAX_DURATION) return click();
      }
      return output();
    },
  };
}

// 之後的 issue 會加入 annoyed、sleepy、sulky、lonely 與 Afterglow。
function deriveMood(affection: number): Mood {
  return affection >= HAPPY_AFFECTION ? "happy" : "normal";
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function primaryDisplay(displays: readonly Display[]): Display {
  const display = displays.find((d) => d.primary) ?? displays[0];
  if (!display) throw new Error("No displays");
  return display;
}

function homeSnapshot(display: Display): PetSnapshot {
  const { workArea } = display;
  return {
    mood: deriveMood(DEFAULT_AFFECTION),
    affection: DEFAULT_AFFECTION,
    displayId: display.id,
    position: {
      x: workArea.x + workArea.width - HOME_RIGHT_INSET,
      y: workArea.y + workArea.height,
    },
    facing: "left",
  };
}
