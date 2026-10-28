// Pet 核心：純邏輯，不依賴 Electron、PixiJS 或 DOM。
// 時間、亂數、存檔來源一律由外部注入；輸入為啟動／tick／指標事件，輸出為快照與效果清單。

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

export interface PetSnapshot {
  readonly displayId: DisplayId;
  /** 狗狗腳底中心點，螢幕座標；靜止時 y 等於 Ground。 */
  readonly position: Point;
  readonly facing: "left" | "right";
}

/** 之後的 issue 會加入 say、播放動畫、要求存檔等效果。 */
export type PetEffect = never;

export interface PetOutput {
  readonly snapshot: PetSnapshot;
  readonly effects: readonly PetEffect[];
}

export interface PetDeps {
  readonly random: () => number;
}

export interface Pet {
  start(input: StartInput): PetOutput;
  tick(input: TickInput): PetOutput;
  pointer(event: PointerEvent): PetOutput;
}

/** 腳底中心點距離工作區域右緣的距離。 */
const HOME_RIGHT_INSET = 120;

export function createPet(_deps: PetDeps): Pet {
  let snapshot: PetSnapshot | undefined;

  function output(): PetOutput {
    if (!snapshot) throw new Error("Pet has not been started");
    return { snapshot, effects: [] };
  }

  return {
    start({ displays }) {
      snapshot = homeSnapshot(primaryDisplay(displays));
      return output();
    },
    tick() {
      return output();
    },
    pointer() {
      return output();
    },
  };
}

function primaryDisplay(displays: readonly Display[]): Display {
  const display = displays.find((d) => d.primary) ?? displays[0];
  if (!display) throw new Error("No displays");
  return display;
}

function homeSnapshot(display: Display): PetSnapshot {
  const { workArea } = display;
  return {
    displayId: display.id,
    position: {
      x: workArea.x + workArea.width - HOME_RIGHT_INSET,
      y: workArea.y + workArea.height,
    },
    facing: "left",
  };
}
