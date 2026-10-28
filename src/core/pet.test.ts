import { describe, expect, it } from "vitest";
import {
  createPet,
  LINE_POOLS,
  type Display,
  type LineLibrary,
  type PetDeps,
  type PetOutput,
  type Point,
  type StartInput,
} from "./pet";

const secondary: Display = {
  id: 2,
  primary: false,
  workArea: { x: -1920, y: 0, width: 1920, height: 1080 },
};
const primary: Display = {
  id: 1,
  primary: true,
  // 工作列佔掉底部 48px
  workArea: { x: 0, y: 0, width: 2560, height: 1392 },
};

function lines(overrides: Partial<LineLibrary> = {}): LineLibrary {
  const library = Object.fromEntries(
    LINE_POOLS.map((pool) => [pool, [`${pool}-1`, `${pool}-2`]])
  ) as Record<keyof LineLibrary, string[]>;
  return { ...library, ...overrides };
}

function startedPet(
  deps: Partial<PetDeps> = {},
  input: Partial<StartInput> = {}
) {
  const pet = createPet({ random: () => 0.5, lines: lines(), ...deps });
  const started = pet.start({ now: 0, displays: [primary], ...input });
  // click()／pat() 從啟動時間往後推，避免跨測試累積的時間觸發 Affection Decay。
  clock = input.now ?? 0;
  return { pet, started };
}

const said = (output: PetOutput) =>
  output.effects.flatMap((e) => (e.type === "say" ? [e.line] : []));

const BODY: Point = { x: 2400, y: 1300 };

describe("start", () => {
  it("places the pet on the Ground at the bottom-right of the primary display", () => {
    const pet = createPet({ random: () => 0.5, lines: lines() });

    const { snapshot } = pet.start({ now: 0, displays: [secondary, primary] });

    expect(snapshot.displayId).toBe(primary.id);
    expect(snapshot.position.y).toBe(1392);
    expect(snapshot.position.x).toBeGreaterThan(2560 - 300);
    expect(snapshot.position.x).toBeLessThan(2560);
  });

  it("plays the Greeting and says a greeting Line", () => {
    const { started } = startedPet({
      lines: lines({ greeting: ["{name}來了！"] }),
    });

    expect(started.effects).toContainEqual({
      type: "playAnimation",
      animation: "greeting",
    });
    expect(said(started)).toEqual(["小柴來了！"]);
  });
});

describe("Click", () => {
  it("says a Line from the current Mood's pool without changing Affection", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const out = pet.pointer({
      type: "up",
      time: 1100,
      position: BODY,
      hit: "body",
    });

    expect(out.snapshot.affection).toBe(started.snapshot.affection);
    expect(said(out)).toHaveLength(1);
    expect(["normal-1", "normal-2"]).toContain(said(out)[0]);
  });

  it.each([
    { moved: 5, isClick: true },
    { moved: 7, isClick: false },
  ])(
    "moving $moved px before release: Click = $isClick",
    ({ moved, isClick }) => {
      const { pet, started } = startedPet();
      const to = { x: BODY.x + moved, y: BODY.y };

      pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
      pet.pointer({ type: "move", time: 1050, position: to, hit: "body" });
      const out = pet.pointer({
        type: "up",
        time: 1100,
        position: to,
        hit: "body",
      });

      expect(said(out)).toHaveLength(isClick ? 1 : 0);
      // 移動 7px 是 Pickup，Drop 另有 Affection 規則（見 Drop）。
      if (isClick) {
        expect(out.snapshot.affection).toBe(started.snapshot.affection);
      }
    }
  );

  it.each([
    { held: 900, isClick: true },
    { held: 1000, isClick: false },
  ])("releasing after $held ms: Click = $isClick", ({ held, isClick }) => {
    const { pet } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const out = pet.pointer({
      type: "up",
      time: 1000 + held,
      position: BODY,
      hit: "body",
    });

    expect(said(out)).toHaveLength(isClick ? 1 : 0);
  });

  it("says happy Lines once Pats raise Affection to 75", () => {
    const { pet } = startedPet({
      lines: lines({ normal: ["n"], happy: ["h"] }),
    });

    // 預設 50，每次 Pat +4：6 次後 74 仍 normal，第 7 次 78 轉 happy。
    for (let i = 0; i < 6; i++) pat(pet);
    expect(said(click(pet))).toEqual(["n"]);
    pat(pet);
    const out = click(pet);
    expect(out.snapshot.mood).toBe("happy");
    expect(said(out)).toEqual(["h"]);
  });

  it("ignores presses that start off the body", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "none" });
    const out = pet.pointer({
      type: "up",
      time: 1100,
      position: BODY,
      hit: "body",
    });

    expect(said(out)).toHaveLength(0);
    expect(out.snapshot.affection).toBe(started.snapshot.affection);
  });
});

/** 可重現的亂數（LCG）。 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

let clock = 0;
/** 按住 1.1 秒後放開：一次 Pat。 */
function pat(pet: ReturnType<typeof createPet>): PetOutput {
  clock += 5_000;
  pet.pointer({ type: "down", time: clock, position: BODY, hit: "head" });
  return pet.pointer({
    type: "up",
    time: clock + 1_100,
    position: BODY,
    hit: "head",
  });
}

function click(pet: ReturnType<typeof createPet>): PetOutput {
  clock += 5_000;
  pet.pointer({ type: "down", time: clock, position: BODY, hit: "body" });
  return pet.pointer({
    type: "up",
    time: clock + 100,
    position: BODY,
    hit: "body",
  });
}

describe("Line Pool", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "draws every Line once per cycle and never repeats across a reshuffle (seed %i)",
    (seed) => {
      const pool = ["a", "b", "c"];
      const { pet } = startedPet({
        random: seeded(seed),
        // 讓 Click 一直落在 normal pool：Affection 不會在 9 次內到 75。
        lines: lines({ normal: pool }),
      });

      const drawn = Array.from({ length: 9 }, () => said(click(pet))[0]);

      for (let cycle = 0; cycle < 3; cycle++) {
        expect([...drawn.slice(cycle * 3, cycle * 3 + 3)].sort()).toEqual(pool);
      }
      for (let i = 1; i < drawn.length; i++) {
        expect(drawn[i]).not.toBe(drawn[i - 1]);
      }
    }
  );

  it("fills {name} with the pet's name", () => {
    const { pet } = startedPet(
      { lines: lines({ normal: ["我是{name}，{name}最乖"] }) },
      { settings: { name: "阿福" } }
    );

    expect(said(click(pet))).toEqual(["我是阿福，阿福最乖"]);
  });

  it("uses 小柴 as the default name", () => {
    const { pet } = startedPet({ lines: lines({ normal: ["我是{name}"] }) });

    expect(said(click(pet))).toEqual(["我是小柴"]);
  });
});

const tick = (
  pet: ReturnType<typeof createPet>,
  now: number,
  displays = [primary]
) => pet.tick({ now, displays });

describe("Pat", () => {
  it("keeps adding 1 Affection per extra second of petting", () => {
    const { pet, started } = startedPet();
    const before = started.snapshot.affection;

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });

    expect(tick(pet, 2000).snapshot.affection).toBe(before + 4);
    expect(tick(pet, 2999).snapshot.affection).toBe(before + 4);
    expect(tick(pet, 3000).snapshot.affection).toBe(before + 5);
    expect(tick(pet, 5000).snapshot.affection).toBe(before + 7);
    const out = pet.pointer({
      type: "up",
      time: 5500,
      position: BODY,
      hit: "head",
    });
    expect(out.snapshot.affection).toBe(before + 7);
    expect(tick(pet, 8000).snapshot.affection).toBe(before + 7);
  });

  it("keeps counting as a Pat while stroking the head back and forth", () => {
    const { pet, started } = startedPet();
    const left = { x: BODY.x - 20, y: BODY.y };

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });
    pet.pointer({ type: "move", time: 1300, position: left, hit: "head" });
    pet.pointer({ type: "move", time: 1600, position: BODY, hit: "head" });

    expect(tick(pet, 2000).snapshot.affection).toBe(
      started.snapshot.affection + 4
    );
  });

  it("only happens on the head: holding the body is not a Pat", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const out = tick(pet, 3000);

    expect(out.snapshot.affection).toBe(started.snapshot.affection);
    expect(out.snapshot.afterglow).toBe(false);
  });

  it("is not a Pat after 0.9 s of holding, but is at 1.0 s and adds 4 Affection", () => {
    const { pet, started } = startedPet();
    const before = started.snapshot.affection;

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });

    expect(tick(pet, 1900).snapshot.affection).toBe(before);
    expect(tick(pet, 2000).snapshot.affection).toBe(before + 4);
  });

  it("counts a 1 s hold released before any tick as a Pat, not a Click", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });
    const out = pet.pointer({
      type: "up",
      time: 2200,
      position: BODY,
      hit: "head",
    });

    expect(out.snapshot.affection).toBe(started.snapshot.affection + 4);
  });

  it("gives the +4 Pat bonus only once per hold", () => {
    const { pet, started } = startedPet();

    // 都在 Pat 後的第一秒內，不含撫摸的 +1。
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });
    tick(pet, 2000);
    tick(pet, 2500);
    tick(pet, 2900);
    const out = pet.pointer({
      type: "up",
      time: 2950,
      position: BODY,
      hit: "head",
    });

    expect(out.snapshot.affection).toBe(started.snapshot.affection + 4);
  });
});

describe("Afterglow", () => {
  it("keeps the Mood happy while still being patted, and ends on release", () => {
    const { pet } = startedPet();
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });
    // 第 2000 ms 觸發 Pat（Affection 54，本身仍是 normal）。
    expect(tick(pet, 2000).snapshot.mood).toBe("happy");
    expect(tick(pet, 5000).snapshot.mood).toBe("happy");

    const released = pet.pointer({
      type: "up",
      time: 5500,
      position: BODY,
      hit: "head",
    });

    expect(released.snapshot.mood).toBe("normal");
  });

  it("exposes whether the pet is in Afterglow", () => {
    const { pet, started } = startedPet();
    expect(started.snapshot.afterglow).toBe(false);

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "head" });
    expect(tick(pet, 2000).snapshot.afterglow).toBe(true);

    const released = pet.pointer({
      type: "up",
      time: 2500,
      position: BODY,
      hit: "head",
    });
    expect(released.snapshot.afterglow).toBe(false);
  });
});

describe("Mood from Affection", () => {
  it.each([
    { affection: 75, mood: "happy", pool: "happy" },
    { affection: 72, mood: "normal", pool: "normal" },
    { affection: 30, mood: "normal", pool: "normal" },
    { affection: 26, mood: "normal", pool: "coldNormal" },
  ])(
    "Affection $affection → $mood, a Click says a Line from $pool",
    ({ affection, mood, pool }) => {
      const { pet } = startedPet(
        {
          lines: lines({ happy: ["h"], normal: ["n"], coldNormal: ["c"] }),
        },
        { saved: { affection } }
      );

      const out = click(pet);

      expect(out.snapshot.affection).toBe(affection);
      expect(out.snapshot.mood).toBe(mood);
      expect(said(out)).toEqual([
        { happy: "h", normal: "n", coldNormal: "c" }[pool],
      ]);
    }
  );
});

describe("Affection range", () => {
  it.each([
    { saved: 150, expected: 100 },
    { saved: -10, expected: 0 },
  ])(
    "clamps a saved Affection of $saved to $expected",
    ({ saved, expected }) => {
      const { started } = startedPet({}, { saved: { affection: saved } });

      expect(started.snapshot.affection).toBe(expected);
    }
  );

  it("never rises above 100", () => {
    const { pet } = startedPet({}, { saved: { affection: 98 } });

    expect(pat(pet).snapshot.affection).toBe(100);
    expect(pat(pet).snapshot.affection).toBe(100);
  });
});

const MINUTE = 60_000;

describe("Affection Decay", () => {
  it("loses 1 Affection per hour of Neglect at or below 80", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });

    expect(tick(pet, 60 * MINUTE - 1).snapshot.affection).toBe(60);
    expect(tick(pet, 60 * MINUTE).snapshot.affection).toBe(59);
  });

  it("decays fastest near 100 and slows down tier by tier", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 100 } });

    // 100 → 95：每 1 分鐘 -1，共 5 分鐘。
    expect(tick(pet, 1 * MINUTE - 1).snapshot.affection).toBe(100);
    expect(tick(pet, 1 * MINUTE).snapshot.affection).toBe(99);
    expect(tick(pet, 5 * MINUTE).snapshot.affection).toBe(95);
    // 95 → 90：每 2 分鐘 -1，共 10 分鐘。
    expect(tick(pet, 7 * MINUTE - 1).snapshot.affection).toBe(95);
    expect(tick(pet, 15 * MINUTE).snapshot.affection).toBe(90);
    // 90 → 80：每 3 分鐘 -1，共 30 分鐘。
    expect(tick(pet, 18 * MINUTE - 1).snapshot.affection).toBe(90);
    expect(tick(pet, 45 * MINUTE).snapshot.affection).toBe(80);
    // 80 以下：每 1 小時 -1。
    expect(tick(pet, 105 * MINUTE - 1).snapshot.affection).toBe(80);
    expect(tick(pet, 105 * MINUTE).snapshot.affection).toBe(79);
  });

  it("applies both rates correctly within a single long tick", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 100 } });

    // 5 + 10 + 30 分鐘 100 → 80，再 60 分鐘 80 → 79。
    expect(tick(pet, 105 * MINUTE).snapshot.affection).toBe(79);
  });

  it("restarts the Neglect count after a Click", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });
    tick(pet, 59 * MINUTE);

    const at = 59 * MINUTE;
    pet.pointer({ type: "down", time: at, position: BODY, hit: "body" });
    pet.pointer({ type: "up", time: at + 100, position: BODY, hit: "body" });

    expect(tick(pet, 61 * MINUTE).snapshot.affection).toBe(60);
    expect(tick(pet, at + 100 + 60 * MINUTE).snapshot.affection).toBe(59);
  });

  it("stops at 0", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 1 } });

    expect(tick(pet, 10 * 60 * MINUTE).snapshot.affection).toBe(0);
  });
});

describe("Neglect", () => {
  it("turns lonely after 10 minutes of Neglect and sulky after 45", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });

    expect(tick(pet, 10 * MINUTE).snapshot.mood).toBe("normal");
    expect(tick(pet, 10 * MINUTE + 1).snapshot.mood).toBe("lonely");
    expect(tick(pet, 45 * MINUTE).snapshot.mood).toBe("lonely");
    expect(tick(pet, 45 * MINUTE + 1).snapshot.mood).toBe("sulky");
  });

  it.each([
    { interaction: "Click", act: click },
    { interaction: "Pat", act: pat },
    {
      interaction: "Pickup",
      act: (pet: ReturnType<typeof createPet>) => {
        const at = 20 * MINUTE;
        const to = { x: BODY.x - 10, y: BODY.y };
        pet.pointer({ type: "down", time: at, position: BODY, hit: "body" });
        pet.pointer({ type: "move", time: at + 50, position: to, hit: "body" });
      },
    },
  ])("restarts the Neglect count after a $interaction", ({ act }) => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });
    // 一直 tick 不算 Interaction。
    for (let now = MINUTE; now <= 20 * MINUTE; now += MINUTE) tick(pet, now);
    expect(tick(pet, 20 * MINUTE).snapshot.mood).toBe("lonely");
    clock = 20 * MINUTE;

    act(pet);

    const after = tick(pet, 20 * MINUTE + 10_000).snapshot;
    expect(after.mood).toBe("normal");
  });

  it("continues from the saved Neglect after a restart, not counting the time the App was closed", () => {
    // 存檔時已被冷落 9 分鐘；隔天（App 關閉的時間很長）才重新開啟。
    const tomorrow = 24 * 60 * MINUTE;
    const { pet, started } = startedPet(
      {},
      { now: tomorrow, saved: { affection: 60, neglect: 9 * MINUTE } }
    );

    expect(started.snapshot.mood).toBe("normal");
    expect(tick(pet, tomorrow + MINUTE).snapshot.mood).toBe("normal");
    expect(tick(pet, tomorrow + MINUTE + 1).snapshot.mood).toBe("lonely");
    expect(pet.stop({ now: tomorrow + 2 * MINUTE }).effects).toContainEqual(
      expect.objectContaining({
        petState: expect.objectContaining({ neglect: 11 * MINUTE }),
      })
    );
  });

  it("starts sulky when the saved Neglect is already over 45 minutes", () => {
    const { started } = startedPet({}, { saved: { neglect: 50 * MINUTE } });

    expect(started.snapshot.mood).toBe("sulky");
  });
});

describe("Make-up", () => {
  function sulkyPet() {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });
    tick(pet, 46 * MINUTE);
    clock = 46 * MINUTE;
    return pet;
  }

  it("only coaxes on the first Click and stays sulky", () => {
    const pet = sulkyPet();

    const out = click(pet);

    expect(said(out)).toEqual(["sulkyCoaxing-1"]);
    expect(out.snapshot.mood).toBe("sulky");
    expect(tick(pet, clock + 10_000).snapshot.mood).toBe("sulky");
  });

  it("plays the hmph animation when coaxing, not when making up", () => {
    const pet = sulkyPet();
    const hmph = { type: "playAnimation", animation: "hmph" };

    expect(click(pet).effects).toContainEqual(hmph);
    click(pet);
    expect(click(pet).effects).not.toContainEqual(hmph);
  });

  it("makes up after 3 Interactions within 30 seconds", () => {
    const pet = sulkyPet();
    click(pet);
    expect(said(click(pet))).toEqual(["sulkyCoaxing-2"]);

    const out = click(pet);

    expect(said(out)).toEqual(["makeUp-1"]);
    expect(out.snapshot.mood).toBe("normal");
  });

  it("makes up after a single Pat", () => {
    const pet = sulkyPet();

    const out = pat(pet);

    expect(said(out)).toEqual(["makeUp-1"]);
    expect(out.snapshot.mood).toBe("normal");
  });

  it("does not make up when the 3 Interactions are spread over more than 30 seconds", () => {
    const pet = sulkyPet();
    click(pet);
    clock += 15_000;
    click(pet);
    clock += 15_000;

    const out = click(pet);

    expect(said(out)).toHaveLength(1);
    expect(said(out)[0]).toMatch(/^sulkyCoaxing/);
    expect(out.snapshot.mood).toBe("sulky");
  });

  it("stays sulky across a restart until Make-up", () => {
    const pet = sulkyPet();
    click(pet);
    const saved = pet
      .stop({ now: clock + 1000 })
      .effects.find((e) => e.type === "save");
    if (saved?.type !== "save") throw new Error("expected a save");

    const { started } = startedPet({}, { now: clock, saved: saved.petState });

    expect(started.snapshot.mood).toBe("sulky");
  });
});

describe("Annoyed from rapid Clicks", () => {
  /** 從 start 起每 300ms Click 一次。 */
  function clicks(pet: ReturnType<typeof createPet>, count: number, first = 0) {
    let out!: PetOutput;
    for (let i = first; i < first + count; i++) {
      const time = 1000 + 300 * i;
      pet.pointer({ type: "down", time, position: BODY, hit: "body" });
      out = pet.pointer({
        type: "up",
        time: time + 50,
        position: BODY,
        hit: "body",
      });
    }
    return out;
  }

  it("5 Clicks within 1.5 seconds cost 1 Affection and turn annoyed for 10 seconds", () => {
    const { pet } = startedPet({}, { saved: { affection: 60 } });

    const four = clicks(pet, 4);
    expect(four.snapshot.mood).not.toBe("annoyed");
    const out = clicks(pet, 1, 4);

    expect(out.snapshot.mood).toBe("annoyed");
    expect(out.snapshot.affection).toBe(59);
    expect(said(out)).toEqual(["annoyed-1"]);
    expect(tick(pet, 2250 + 9_999).snapshot.mood).toBe("annoyed");
    expect(tick(pet, 2250 + 10_000).snapshot.mood).toBe("normal");
  });
});

describe("Dragged too long", () => {
  /** 在 1050 抱起，之後游標不動。 */
  function carried() {
    const { pet, started } = startedPet();
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    pet.pointer({
      type: "move",
      time: 1050,
      position: { x: BODY.x - 10, y: BODY.y },
      hit: "body",
    });
    return { pet, started };
  }
  const HELD = { x: BODY.x - 10, y: BODY.y };

  it("says draggedTooLong once after 8 seconds of carrying", () => {
    const { pet } = carried();

    expect(said(tick(pet, 1050 + 7_999))).toEqual([]);
    expect(said(tick(pet, 1050 + 8_000))).toEqual(["draggedTooLong-1"]);
    expect(said(tick(pet, 1050 + 9_000))).toEqual([]);
  });

  it("turns annoyed after 15 seconds, and that Drop adds no Affection", () => {
    const { pet, started } = carried();
    tick(pet, 1050 + 14_999);

    const annoyed = tick(pet, 1050 + 15_000);
    expect(annoyed.snapshot.mood).toBe("annoyed");

    const out = pet.pointer({
      type: "up",
      time: 1050 + 16_000,
      position: HELD,
      hit: "body",
    });
    expect(out.snapshot.affection).toBe(started.snapshot.affection);
    expect(tick(pet, 1050 + 25_000).snapshot.mood).toBe("normal");
  });
});

describe("Annoyed Pickup", () => {
  /** 連點 5 次惹毛狗狗，最後一次在 2200+50。 */
  function annoyedPet(saved: Record<string, unknown> = {}) {
    const { pet, started } = startedPet({}, { saved });
    for (let i = 0; i < 5; i++) {
      const time = 1000 + 300 * i;
      pet.pointer({ type: "down", time, position: BODY, hit: "body" });
      pet.pointer({ type: "up", time: time + 50, position: BODY, hit: "body" });
    }
    return { pet, started };
  }

  it("can still be picked up, but protests and the Drop adds no Affection", () => {
    const { pet } = annoyedPet({ affection: 60 });
    pet.pointer({ type: "down", time: 3000, position: BODY, hit: "body" });

    const lifted = pet.pointer({
      type: "move",
      time: 3050,
      position: { x: BODY.x - 10, y: BODY.y },
      hit: "body",
    });
    expect(lifted.snapshot.motion).toBe("pickedUp");
    expect(said(lifted)).toEqual(["protestPickup-1"]);

    const dropped = pet.pointer({
      type: "up",
      time: 4000,
      position: { x: BODY.x - 10, y: BODY.y },
      hit: "body",
    });
    expect(dropped.snapshot.affection).toBe(59);
  });

  it("outranks happy", () => {
    const { pet } = annoyedPet({ affection: 90 });

    expect(tick(pet, 2300).snapshot.mood).toBe("annoyed");
    expect(tick(pet, 2250 + 10_000).snapshot.mood).toBe("happy");
  });
});

describe("Pickup", () => {
  it("lifts the pet after moving 7 px on the body and says a pickedUp Line", () => {
    const { pet } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const out = pet.pointer({
      type: "move",
      time: 1050,
      position: { x: BODY.x + 7, y: BODY.y },
      hit: "body",
    });

    expect(out.snapshot.motion).toBe("pickedUp");
    expect(said(out)).toHaveLength(1);
    expect(["pickedUp-1", "pickedUp-2"]).toContain(said(out)[0]);
    expect(tick(pet, 1400).snapshot.motion).toBe("dragging");
  });

  it("carries the pet with the cursor but keeps it inside the screen", () => {
    const { pet, started } = startedPet();
    const home = started.snapshot.position;
    const move = (time: number, position: Point) =>
      pet.pointer({ type: "move", time, position, hit: "body" });

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    move(1050, { x: BODY.x - 10, y: BODY.y });
    expect(
      move(1100, { x: BODY.x - 300, y: BODY.y - 400 }).snapshot.position
    ).toEqual({ x: home.x - 300, y: home.y - 400 });

    // 整隻狗留在工作區域內：腳底距左右緣至少半個身寬、距頂端至少一個身高。
    const topRight = move(1150, { x: 9999, y: -9999 }).snapshot.position;
    const bottomLeft = move(1200, { x: -9999, y: 9999 }).snapshot.position;
    expect(topRight.x).toBeLessThan(2560);
    expect(topRight.y).toBeGreaterThan(0);
    expect(bottomLeft.x).toBeGreaterThan(0);
    expect(bottomLeft.y).toBe(1392);
    expect(topRight.x - bottomLeft.x).toBeGreaterThan(2560 - 300);
    expect(bottomLeft.y - topRight.y).toBeGreaterThan(1392 - 300);
  });
});

/** 從 BODY 抱起並慢慢拖到 to，在 at（≥ 1500）時放開；Drop 無速度。 */
function dragAndDrop(
  pet: ReturnType<typeof createPet>,
  to: Point,
  at: number
): PetOutput {
  pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
  pet.pointer({
    type: "move",
    time: 1050,
    position: { x: BODY.x - 10, y: BODY.y },
    hit: "body",
  });
  // 與上一次移動相隔超過速度取樣窗：慢慢搬，不算快速拖拽。
  pet.pointer({ type: "move", time: 1500, position: to, hit: "body" });
  return pet.pointer({ type: "up", time: at, position: to, hit: "body" });
}

describe("Dragging velocity", () => {
  it("reports the cursor's recent velocity while dragging, and 0 once it stops", () => {
    const { pet, started } = startedPet();
    expect(started.snapshot.velocity).toEqual({ x: 0, y: 0 });
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });

    // 每 20ms 往右 10px：500 px/s。
    let out = started;
    for (let i = 1; i <= 6; i++) {
      out = pet.pointer({
        type: "move",
        time: 1000 + 20 * i,
        position: { x: BODY.x + 10 * i, y: BODY.y },
        hit: "body",
      });
    }
    expect(out.snapshot.velocity.x).toBeCloseTo(500);
    expect(out.snapshot.velocity.y).toBe(0);

    expect(tick(pet, 1400).snapshot.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe("Drop", () => {
  it("falls to the Ground under gravity, then lands and goes idle", () => {
    const { pet, started } = startedPet();
    const ground = started.snapshot.position.y;

    // 抬高 600px 後放開。
    const dropped = dragAndDrop(pet, { x: BODY.x, y: BODY.y - 600 }, 2000);
    expect(dropped.snapshot.motion).toBe("falling");
    expect(dropped.snapshot.position.y).toBe(ground - 600);

    // 0.5 秒後已加速下落，但還沒到 Ground。
    const midair = tick(pet, 2500).snapshot;
    expect(midair.motion).toBe("falling");
    expect(midair.position.y).toBeGreaterThan(
      ground - 600 + (1400 * 0.5 ** 2) / 2
    );
    expect(midair.position.y).toBeLessThan(
      ground - 600 + (1800 * 0.5 ** 2) / 2
    );

    const landed = tick(pet, 3000);
    expect(landed.snapshot.motion).toBe("landing");
    expect(landed.snapshot.position.y).toBe(ground);
    expect(landed.snapshot.position.x).toBe(dropped.snapshot.position.x);

    const idle = tick(pet, 3500);
    expect(idle.snapshot.motion).toBe("idle");
    expect(said(idle)).toHaveLength(1);
    expect(["landing-1", "landing-2"]).toContain(said(idle)[0]);
  });

  it.each([
    { height: 600, says: true },
    { height: 100, says: false },
  ])(
    "dropped from $height px: says a falling Line = $says",
    ({ height, says }) => {
      const { pet } = startedPet();

      const out = dragAndDrop(pet, { x: BODY.x, y: BODY.y - height }, 2000);

      expect(said(out)).toEqual(says ? ["falling-1"] : []);
    }
  );

  it("can be caught again in mid-air without falling out of the hand", () => {
    const { pet } = startedPet();
    const high = { x: BODY.x, y: BODY.y - 600 };
    dragAndDrop(pet, high, 2000);
    const midair = tick(pet, 2200).snapshot.position;

    // 在空中再抓一次（游標在狗身上，相對位置同 BODY 之於腳底）。
    const grab = { x: BODY.x, y: midair.y - 92 };
    pet.pointer({ type: "down", time: 2250, position: grab, hit: "body" });
    pet.pointer({
      type: "move",
      time: 2300,
      position: { x: grab.x + 10, y: grab.y },
      hit: "body",
    });
    const held = tick(pet, 3500).snapshot;

    expect(held.motion).toBe("dragging");
    expect(held.position.y).toBe(midair.y);
  });

  it("ignores a release far from the press when no move came in between", () => {
    const { pet } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    pet.pointer({
      type: "up",
      time: 1100,
      position: { x: BODY.x + 50, y: BODY.y },
      hit: "body",
    });

    expect(tick(pet, 1500).snapshot.motion).toBe("idle");
  });

  it("adds 1 Affection for a safe Drop", () => {
    const { pet, started } = startedPet();

    const out = dragAndDrop(pet, { x: BODY.x - 200, y: BODY.y - 100 }, 2000);

    expect(out.snapshot.affection).toBe(started.snapshot.affection + 1);
  });

  it("says fastDragging once when shaken fast, and that Drop adds no Affection", () => {
    const { pet, started } = startedPet();
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    pet.pointer({
      type: "move",
      time: 1050,
      position: { x: BODY.x - 10, y: BODY.y },
      hit: "body",
    });

    // 每 16ms 移動 50px（約 3000 px/s）。
    const lines: string[] = [];
    let at = BODY;
    for (let i = 1; i <= 10; i++) {
      at = { x: BODY.x - 10 - 50 * i, y: BODY.y - 200 };
      lines.push(
        ...said(
          pet.pointer({
            type: "move",
            time: 1050 + 16 * i,
            position: at,
            hit: "body",
          })
        )
      );
    }
    expect(lines).toHaveLength(1);
    expect(["fastDragging-1", "fastDragging-2"]).toContain(lines[0]);

    // 停下來一陣子再放開。
    tick(pet, 1500);
    const out = pet.pointer({
      type: "up",
      time: 2000,
      position: at,
      hit: "body",
    });
    expect(out.snapshot.affection).toBe(started.snapshot.affection);
  });
});

/**
 * 從 BODY 抱起、慢慢拖到 from（游標座標），再以 velocity（px/s）甩 80ms，在 at 時放開。
 * 腳底相對游標的位移為 (40, 92)。
 */
function toss(
  pet: ReturnType<typeof createPet>,
  from: Point,
  velocity: Point,
  at = 2000
): PetOutput {
  pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
  pet.pointer({
    type: "move",
    time: 1050,
    position: { x: BODY.x - 10, y: BODY.y },
    hit: "body",
  });
  pet.pointer({ type: "move", time: 1500, position: from, hit: "body" });
  let position = from;
  for (let i = 0; i <= 5; i++) {
    const ms = 16 * i;
    position = {
      x: from.x + (velocity.x * ms) / 1000,
      y: from.y + (velocity.y * ms) / 1000,
    };
    pet.pointer({ type: "move", time: at - 80 + ms, position, hit: "body" });
  }
  return pet.pointer({ type: "up", time: at, position, hit: "body" });
}

/** 每 16ms tick 一次直到 until，回傳每次的快照。 */
function run(pet: ReturnType<typeof createPet>, from: number, until: number) {
  const snapshots = [];
  for (let now = from + 16; now <= until; now += 16) {
    snapshots.push(tick(pet, now).snapshot);
  }
  return snapshots;
}

describe("Toss", () => {
  it("flies along a parabola when dropped with velocity and comes to rest on the Ground", () => {
    const { pet, started } = startedPet();
    const ground = started.snapshot.position.y;

    // 往左上方甩出。
    const dropped = toss(pet, { x: 1500, y: 1000 }, { x: -2400, y: -2400 });
    const path = run(pet, 2000, 6000);

    const peak = Math.min(...path.map((s) => s.position.y));
    expect(peak).toBeLessThan(dropped.snapshot.position.y);
    // 持續往左飛，沒有直直落下。
    expect(path[10]!.position.x).toBeLessThan(
      dropped.snapshot.position.x - 100
    );
    const rest = path[path.length - 1]!;
    expect(rest.motion).toBe("idle");
    expect(rest.position.y).toBe(ground);
    expect(rest.velocity).toEqual({ x: 0, y: 0 });
  });

  it("barely moves after a small flick", () => {
    const { pet } = startedPet();

    // 在 Ground 上輕輕一甩（600 px/s）。
    const dropped = toss(pet, { x: 1500, y: BODY.y }, { x: -600, y: 0 });
    const rest = run(pet, 2000, 4000).at(-1)!;

    expect(rest.motion).toBe("idle");
    expect(
      Math.abs(rest.position.x - dropped.snapshot.position.x)
    ).toBeLessThan(20);
  });

  it("caps the Toss speed and bounces off the screen's left edge", () => {
    const { pet } = startedPet();

    // 貼近左緣、沿 Ground 以 8000 px/s 往左甩（帶給 Toss 一半，超過上限）。
    const dropped = toss(pet, { x: 400, y: BODY.y }, { x: -8000, y: 0 });
    expect(dropped.snapshot.velocity.x).toBeCloseTo(-2500);

    const path = run(pet, 2000, 4000);
    const left = Math.min(...path.map((s) => s.position.x));
    expect(left).toBeGreaterThan(0);
    // 撞牆後往右彈回，速度只剩一部分。
    const bounced = path.find((s) => s.velocity.x > 0);
    expect(bounced).toBeDefined();
    expect(bounced!.velocity.x).toBeLessThan(2500 * 0.3);
    expect(bounced!.velocity.x).toBeGreaterThan(2500 * 0.2 - 100);
  });
});

describe("Drag physics setting", () => {
  it("off: a Drop goes straight back to the Ground without a Toss", () => {
    const { pet, started } = startedPet(
      {},
      { settings: { dragPhysics: "off" } }
    );

    const dropped = toss(pet, { x: 1500, y: 1000 }, { x: -800, y: -800 });

    expect(dropped.snapshot.position).toEqual({
      x: dropped.snapshot.position.x,
      y: started.snapshot.position.y,
    });
    expect(dropped.snapshot.velocity).toEqual({ x: 0, y: 0 });
    expect(dropped.snapshot.motion).toBe("landing");
    const rest = run(pet, 2000, 3000).at(-1)!;
    expect(rest.motion).toBe("idle");
    expect(rest.position).toEqual(dropped.snapshot.position);
  });

  it("lively: switching the setting raises the Toss speed cap and the bounce", () => {
    const wallToss = (pet: ReturnType<typeof createPet>) => {
      const dropped = toss(pet, { x: 400, y: BODY.y }, { x: -8000, y: 0 });
      const bounced = run(pet, 2000, 4000).find((s) => s.velocity.x > 0);
      return { cap: -dropped.snapshot.velocity.x, bounce: bounced!.velocity.x };
    };
    const standard = wallToss(startedPet().pet);
    const { pet } = startedPet();

    pet.configure({ dragPhysics: "lively" });
    const lively = wallToss(pet);

    expect(lively.cap).toBeGreaterThan(standard.cap);
    expect(lively.bounce).toBeGreaterThan(standard.bounce);
  });
});

describe("Across displays", () => {
  const displays = [primary, secondary];

  it("lands on the Ground of the display holding the pet's center after a Drop there", () => {
    const { pet } = startedPet({}, { displays });

    // 腳底相對游標為 (40, 92)：拖到左邊螢幕中央。
    const dropped = dragAndDrop(pet, { x: -1000, y: 500 }, 2000);
    expect(dropped.snapshot.displayId).toBe(secondary.id);
    expect(dropped.snapshot.position).toEqual({ x: -960, y: 592 });

    const rest = tick(pet, 4000, displays).snapshot;
    expect(rest.motion).toBe("idle");
    expect(rest.displayId).toBe(secondary.id);
    expect(rest.position).toEqual({ x: -960, y: 1080 });
  });

  it("stays in view when dragged into a gap between displays or where no display is", () => {
    // 右邊螢幕與主螢幕之間隔了 400px。
    const right: Display = {
      id: 3,
      primary: false,
      workArea: { x: 2960, y: 0, width: 1920, height: 1040 },
    };
    const spread = [secondary, primary, right];
    const { pet } = startedPet({}, { displays: spread });
    const inView = ({ x, y }: Point) =>
      spread.some(
        ({ workArea: a }) =>
          x - 110 >= a.x &&
          x + 110 <= a.x + a.width &&
          y - 170 >= a.y &&
          y <= a.y + a.height
      );
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const move = (time: number, position: Point) =>
      pet.pointer({ type: "move", time, position, hit: "body" }).snapshot;

    // 空隙正中央。
    const gap = move(1050, { x: 2720, y: 500 });
    expect(inView(gap.position)).toBe(true);
    // 左邊螢幕下方（主螢幕較高，這裡沒有螢幕）。
    const below = move(1100, { x: -1000, y: 1300 });
    expect(below.displayId).toBe(secondary.id);
    expect(below.position).toEqual({ x: -960, y: 1080 });
    // 所有螢幕外。
    expect(inView(move(1150, { x: 9999, y: -9999 }).position)).toBe(true);
  });

  it("crosses the shared edge between adjacent displays without jumping", () => {
    const { pet } = startedPet({}, { displays });
    pet.pointer({ type: "down", time: 1000, position: BODY, hit: "body" });
    const move = (time: number, x: number) =>
      pet.pointer({
        type: "move",
        time,
        position: { x: x - 40, y: 400 },
        hit: "body",
      }).snapshot;

    expect(move(1050, 50)).toMatchObject({
      displayId: primary.id,
      position: { x: 50, y: 492 },
    });
    expect(move(1100, -50)).toMatchObject({
      displayId: secondary.id,
      position: { x: -50, y: 492 },
    });

    // 跨在邊上放開也不會被推開。
    pet.pointer({
      type: "up",
      time: 1500,
      position: { x: -90, y: 400 },
      hit: "body",
    });
    const rest = tick(pet, 3500, displays).snapshot;
    expect(rest.displayId).toBe(secondary.id);
    expect(rest.position).toEqual({ x: -50, y: 1080 });
  });
});

describe("Saved state", () => {
  it.each([
    { saved: "garbage", settings: 42 },
    {
      saved: { affection: "abc" },
      settings: { name: "", dragPhysics: "wild" },
    },
    { saved: null, settings: null },
  ])(
    "starts with defaults when the save is corrupt or missing fields ($saved)",
    ({ saved, settings }) => {
      const { pet, started } = startedPet(
        { lines: lines({ greeting: ["{name}"] }) },
        { saved, settings }
      );

      expect(started.snapshot.affection).toBe(50);
      expect(started.snapshot.displayId).toBe(primary.id);
      expect(said(started)).toEqual(["小柴"]);
      // 預設拖拽物理為 standard：放開時仍帶速度就 Toss。
      const dropped = toss(pet, { x: 1500, y: 1000 }, { x: -2400, y: 0 });
      expect(dropped.snapshot.motion).toBe("falling");
    }
  );

  it("returns to the saved position on the saved display", () => {
    const { started } = startedPet(
      {},
      {
        displays: [primary, secondary],
        saved: { displayId: secondary.id, position: { x: -700, y: 1080 } },
      }
    );

    expect(started.snapshot.displayId).toBe(secondary.id);
    expect(started.snapshot.position).toEqual({ x: -700, y: 1080 });
  });

  it("goes home to the bottom-right of the primary display when the saved display is gone", () => {
    const home = startedPet().started.snapshot.position;

    const { started } = startedPet(
      {},
      { saved: { displayId: secondary.id, position: { x: -700, y: 1080 } } }
    );

    expect(started.snapshot.displayId).toBe(primary.id);
    expect(started.snapshot.position).toEqual(home);
  });

  it("asks to save after a Pat", () => {
    const { pet, started } = startedPet();

    const out = pat(pet);

    expect(saves(out)).toEqual([
      {
        type: "save",
        petState: {
          affection: started.snapshot.affection + 4,
          displayId: primary.id,
          position: started.snapshot.position,
          neglect: 0,
          neglectSinceDecay: 0,
          sulking: false,
        },
        settings: {
          name: "小柴",
          dragPhysics: "standard",
          nightSleep: true,
          chatter: "normal",
          quietWhileTyping: true,
        },
      },
    ]);
  });

  it("asks to save where the pet lands once the landing is over", () => {
    const { pet, started } = startedPet();
    dragAndDrop(pet, { x: BODY.x - 500, y: BODY.y - 600 }, 2000);

    const outputs = [];
    for (let now = 2016; now <= 4000; now += 16) outputs.push(tick(pet, now));
    const saved = outputs.flatMap(saves);

    expect(outputs.at(-1)!.snapshot.motion).toBe("idle");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      petState: {
        position: { x: started.snapshot.position.x - 500, y: 1392 },
      },
    });
  });

  it("asks to save when the Mood changes", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 75 } });

    expect(saves(tick(pet, 10 * 60_000))).toEqual([]);
    const out = tick(pet, 10 * 60_000 + 1);

    expect(out.snapshot.mood).toBe("lonely");
    expect(saves(out)).toHaveLength(1);
    expect(saves(tick(pet, 11 * 60_000))).toEqual([]);
  });

  it("asks to save the new settings when they change", () => {
    const { pet } = startedPet();

    const out = pet.configure({ name: "阿福" });

    expect(saves(out)).toHaveLength(1);
    expect(saves(out)[0]).toMatchObject({
      settings: { name: "阿福", dragPhysics: "standard" },
    });
  });

  it("keeps counting the saved Neglect toward the next Affection Decay", () => {
    const { pet } = startedPet(
      {},
      { now: 0, saved: { affection: 60, neglectSinceDecay: 59 * 60_000 } }
    );

    expect(tick(pet, 60_000).snapshot.affection).toBe(59);
  });

  it("asks to save the Neglect so far when the App closes", () => {
    const { pet } = startedPet({}, { now: 0, saved: { affection: 60 } });

    const out = pet.stop({ now: 30 * 60_000 });

    expect(saves(out)).toHaveLength(1);
    expect(saves(out)[0]).toMatchObject({
      petState: {
        affection: 60,
        neglect: 30 * 60_000,
        neglectSinceDecay: 30 * 60_000,
      },
    });
  });
});

const saves = (output: PetOutput) =>
  output.effects.filter((e) => e.type === "save");

describe("Sleepy", () => {
  const NIGHT = 23.5;
  const asleep = (pet: ReturnType<typeof createPet>, now: number, at = {}) =>
    pet.tick({
      now,
      displays: [primary],
      hour: NIGHT,
      afkSeconds: 181,
      ...at,
    });

  it("falls asleep at night once the user has been AFK for over 3 minutes", () => {
    const { pet } = startedPet();

    const out = asleep(pet, 1000);

    expect(out.snapshot.mood).toBe("sleepy");
    expect(out.snapshot.motion).toBe("sleeping");
  });

  it.each([
    { why: "it is daytime", at: { hour: 12 } },
    { why: "07:00 has come", at: { hour: 7 } },
    { why: "the AFK is only 3 minutes", at: { afkSeconds: 180 } },
    { why: "the user is typing", at: { typing: true } },
  ])("stays awake when $why", ({ at }) => {
    const { pet } = startedPet();

    const out = asleep(pet, 1000, at);

    expect(out.snapshot.mood).not.toBe("sleepy");
    expect(out.snapshot.motion).toBe("idle");
  });

  it("sleeps from 23:00 and stays down until the user returns", () => {
    const { pet } = startedPet();

    expect(asleep(pet, 1000, { hour: 22.9 }).snapshot.mood).toBe("normal");
    expect(asleep(pet, 2000, { hour: 23 }).snapshot.mood).toBe("sleepy");
    expect(asleep(pet, 3000, { hour: 6.9 }).snapshot.mood).toBe("sleepy");
    const back = asleep(pet, 4000, { afkSeconds: 0 });
    expect(back.snapshot.mood).toBe("normal");
    expect(back.snapshot.motion).toBe("idle");
  });

  it("never sleeps when night sleep is turned off", () => {
    const { pet } = startedPet({}, { settings: { nightSleep: false } });

    expect(asleep(pet, 1000).snapshot.mood).toBe("normal");
    expect(pet.configure({ nightSleep: true }).snapshot.mood).toBe("normal");
    expect(asleep(pet, 2000).snapshot.mood).toBe("sleepy");
  });

  it("does not fall asleep while being carried", () => {
    const { pet } = startedPet();
    const to = { x: BODY.x - 50, y: BODY.y };
    pet.pointer({ type: "down", time: 500, position: BODY, hit: "body" });
    pet.pointer({ type: "move", time: 600, position: to, hit: "body" });

    const out = asleep(pet, 700);

    expect(out.snapshot.mood).not.toBe("sleepy");
    expect(out.snapshot.motion).not.toBe("sleeping");
  });

  describe("Woken", () => {
    function sleepingPet() {
      const { pet } = startedPet({
        lines: lines({ woken: ["woken"], sleepy: ["zzz"] }),
      });
      asleep(pet, 1000);
      clock = 1000;
      return pet;
    }

    it("is woken by a Click: says a woken Line and rubs its eyes", () => {
      const pet = sleepingPet();

      const out = click(pet);

      expect(out.snapshot.mood).not.toBe("sleepy");
      expect(out.snapshot.motion).toBe("idle");
      expect(said(out)).toEqual(["woken"]);
      expect(out.effects).toContainEqual({
        type: "playAnimation",
        animation: "rubEyes",
      });
    });

    it("stays awake for 2 minutes, then sleeps again if still AFK", () => {
      const pet = sleepingPet();
      click(pet);
      const wokenAt = clock + 100;

      const awake = asleep(pet, wokenAt + 2 * MINUTE - 1);
      const later = asleep(pet, wokenAt + 2 * MINUTE + 1);

      expect(awake.snapshot.mood).not.toBe("sleepy");
      expect(later.snapshot.mood).toBe("sleepy");
      expect(later.snapshot.motion).toBe("sleeping");
    });

    it("does not sleep again after the 2 minutes if the user is back", () => {
      const pet = sleepingPet();
      click(pet);

      const out = asleep(pet, clock + 3 * MINUTE, { afkSeconds: 5 });

      expect(out.snapshot.mood).not.toBe("sleepy");
    });

    it("is woken by a Pickup too", () => {
      const pet = sleepingPet();
      const to = { x: BODY.x - 50, y: BODY.y };
      pet.pointer({ type: "down", time: 2000, position: BODY, hit: "body" });
      const out = pet.pointer({
        type: "move",
        time: 2100,
        position: to,
        hit: "body",
      });

      expect(out.snapshot.motion).toBe("pickedUp");
      expect(out.snapshot.mood).not.toBe("sleepy");
    });

    it("is not woken by a Pat: Affection still rises and the tail wags in the dream", () => {
      const pet = sleepingPet();
      const before = asleep(pet, 1100).snapshot.affection;

      const out = pat(pet);

      expect(out.snapshot.mood).toBe("sleepy");
      expect(out.snapshot.motion).toBe("sleeping");
      expect(out.snapshot.affection).toBeGreaterThan(before);
      expect(out.effects).toContainEqual({
        type: "playAnimation",
        animation: "dreamWag",
      });
      expect(said(out)).toEqual([]);
    });
  });
});

describe("Chatter", () => {
  const MIN = 60_000;
  /** 每 step ms tick 一次直到 until，回傳每次 Chatter 的時間。 */
  function chatterTimes(
    pet: ReturnType<typeof createPet>,
    until: number,
    at: Partial<Parameters<typeof pet.tick>[0]> = {},
    from = 0
  ): number[] {
    const times: number[] = [];
    for (let now = from + 1000; now <= until; now += 1000) {
      if (said(pet.tick({ now, displays: [primary], ...at })).length > 0) {
        times.push(now);
      }
    }
    return times;
  }

  it.each([
    { frequency: "low", random: 0, from: 20, to: 20 },
    { frequency: "low", random: 0.999, from: 30, to: 30 },
    { frequency: "normal", random: 0, from: 8, to: 8 },
    { frequency: "normal", random: 0.999, from: 15, to: 15 },
    { frequency: "high", random: 0, from: 4, to: 4 },
    { frequency: "high", random: 0.999, from: 6, to: 6 },
  ] as const)(
    "$frequency with random $random chatters after $from minutes",
    ({ frequency, random, from, to }) => {
      const { pet } = startedPet(
        { random: () => random },
        { settings: { chatter: frequency } }
      );

      const [first] = chatterTimes(pet, 31 * MIN);

      expect(first).toBeGreaterThanOrEqual(from * MIN);
      expect(first).toBeLessThanOrEqual(to * MIN + 1000);
    }
  );

  it("defaults to the normal frequency", () => {
    const { pet } = startedPet({ random: () => 0 });

    const [first] = chatterTimes(pet, 31 * MIN);

    expect(first).toBeGreaterThanOrEqual(8 * MIN);
    expect(first).toBeLessThanOrEqual(8 * MIN + 1000);
  });

  it("schedules the next Chatter after each one", () => {
    const { pet } = startedPet(
      { random: () => 0 },
      { settings: { chatter: "high" } }
    );

    const times = chatterTimes(pet, 13 * MIN);

    expect(times).toHaveLength(3);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(4 * MIN);
  });

  it("says a Line from the current Mood's pool", () => {
    const { pet } = startedPet(
      { random: () => 0, lines: lines({ normal: ["blah"] }) },
      { settings: { chatter: "high" } }
    );

    const out = pet.tick({ now: 4 * MIN, displays: [primary] });

    expect(said(out)).toEqual(["blah"]);
  });

  it("never chatters when off", () => {
    const { pet } = startedPet({}, { settings: { chatter: "off" } });

    expect(chatterTimes(pet, 120 * MIN)).toEqual([]);
  });

  it("starts chattering when switched on from off", () => {
    const { pet } = startedPet(
      { random: () => 0 },
      { settings: { chatter: "off" } }
    );
    chatterTimes(pet, 10 * MIN);
    pet.configure({ chatter: "high" });

    const [first] = chatterTimes(pet, 20 * MIN, {}, 10 * MIN);

    expect(first).toBeGreaterThanOrEqual(14 * MIN);
    expect(first).toBeLessThanOrEqual(14 * MIN + 1000);
  });

  describe("while the user is typing", () => {
    const high = { chatter: "high" } as const;

    it("holds back by default and speaks once typing stops", () => {
      const { pet } = startedPet({ random: () => 0 }, { settings: high });

      expect(chatterTimes(pet, 6 * MIN, { typing: true })).toEqual([]);
      const [first] = chatterTimes(pet, 7 * MIN, { typing: false }, 6 * MIN);

      expect(first).toBe(6 * MIN + 1000);
    });

    it("chatters as usual when the setting is off", () => {
      const { pet } = startedPet(
        { random: () => 0 },
        { settings: { ...high, quietWhileTyping: false } }
      );

      const [first] = chatterTimes(pet, 6 * MIN, { typing: true });

      expect(first).toBeLessThanOrEqual(4 * MIN + 1000);
    });
  });

  it("holds back while the pet is being dragged", () => {
    const { pet } = startedPet(
      { random: () => 0 },
      { settings: { chatter: "high" } }
    );
    pet.pointer({
      type: "down",
      time: 4 * MIN - 500,
      position: BODY,
      hit: "body",
    });
    pet.pointer({
      type: "move",
      time: 4 * MIN - 400,
      position: { x: BODY.x - 100, y: BODY.y },
      hit: "body",
    });

    const during = pet.tick({ now: 4 * MIN + 1000, displays: [primary] });

    expect(during.snapshot.motion).toBe("dragging");
    expect(said(during)).toEqual([]);
  });

  it("holds back while the pet is sleepy", () => {
    const { pet } = startedPet(
      { random: () => 0 },
      { settings: { chatter: "high" } }
    );

    const times = chatterTimes(pet, 10 * MIN, { hour: 23.5, afkSeconds: 181 });

    expect(times).toEqual([]);
  });
});

describe("Stroll", () => {
  const MIN = 60_000;
  const HOME_X = 2440;
  /**
   * start 與 Line 抽選用掉的亂數一律為 0（Stroll 1 分鐘後第一次判定）；
   * 之後每次判定依序消耗 rolls：下次判定的時間、機率、距離、方向。
   */
  let rolls: number[] = [];
  const random = () => rolls.shift() ?? 0;
  const tick = (pet: ReturnType<typeof createPet>, now: number) =>
    pet.tick({ now, displays: [primary] });
  const stroller = (input: Partial<StartInput> = {}) => {
    rolls = [];
    return startedPet({ random }, input).pet;
  };
  const MID = 0.5;

  it("walks 50–200px to the left, facing the way it goes, when the roll succeeds", () => {
    const pet = stroller();
    rolls = [0, 0.1, MID, 0.1];

    const begun = tick(pet, MIN);
    const midway = tick(pet, MIN + 1000);
    const arrived = tick(pet, MIN + 5000);

    expect(begun.snapshot.motion).toBe("strolling");
    expect(begun.snapshot.facing).toBe("left");
    expect(midway.snapshot.position.x).toBeLessThan(HOME_X);
    expect(midway.snapshot.position.x).toBeGreaterThan(HOME_X - 125);
    expect(arrived.snapshot.motion).toBe("idle");
    expect(arrived.snapshot.position).toEqual({ x: HOME_X - 125, y: 1392 });
  });

  it("does not walk when the roll fails", () => {
    const pet = stroller();
    rolls = [0, 0.3, MID, 0.1];

    const out = tick(pet, MIN);

    expect(out.snapshot.motion).toBe("idle");
    expect(out.snapshot.position.x).toBe(HOME_X);
  });

  it("rolls again 1–3 minutes after a failed roll", () => {
    const pet = stroller();
    rolls = [0, 0.9, 0, 0.1, MID, 0.1];

    tick(pet, MIN);
    const early = tick(pet, MIN + 30_000);
    const second = tick(pet, 2 * MIN);

    expect(early.snapshot.motion).toBe("idle");
    expect(second.snapshot.motion).toBe("strolling");
  });

  it.each([
    { roll: 0, length: 50 },
    { roll: 0.999, length: 200 },
  ])("walks $length px when the distance roll is $roll", ({ roll, length }) => {
    const pet = stroller();
    rolls = [0, 0.1, roll, 0.1];

    tick(pet, MIN);
    const arrived = tick(pet, MIN + 10_000);

    expect(HOME_X - arrived.snapshot.position.x).toBeCloseTo(length, 0);
  });

  it("walks the other way instead of leaving the screen", () => {
    // 往右 125px 會超出右緣（2450），所以改往左。
    const pet = stroller();
    rolls = [0, 0.1, MID, 0.9];

    const begun = tick(pet, MIN);
    const arrived = tick(pet, MIN + 10_000);

    expect(begun.snapshot.facing).toBe("left");
    expect(arrived.snapshot.position.x).toBe(HOME_X - 125);
  });

  it("faces right when walking right", () => {
    const pet = stroller({
      saved: { displayId: 1, position: { x: 1000, y: 1392 } },
    });
    rolls = [0, 0.1, MID, 0.9];

    const begun = tick(pet, MIN);
    const arrived = tick(pet, MIN + 10_000);

    expect(begun.snapshot.facing).toBe("right");
    expect(arrived.snapshot.position.x).toBe(1125);
  });

  it("does not walk while sleepy", () => {
    const pet = stroller();
    rolls = [0, 0.1, MID, 0.1];

    const out = pet.tick({
      now: MIN,
      displays: [primary],
      hour: 23.5,
      afkSeconds: 181,
    });

    expect(out.snapshot.motion).toBe("sleeping");
  });

  it.each([
    { why: "lonely", neglect: 11 * MIN },
    { why: "sulky", neglect: 46 * MIN },
  ])("does not walk while $why", ({ neglect }) => {
    const pet = stroller({ saved: { neglect } });
    rolls = [0, 0.1, MID, 0.1];

    const out = tick(pet, MIN);

    expect(out.snapshot.motion).toBe("idle");
  });

  it("does not walk while being dragged", () => {
    const pet = stroller();
    rolls = [0, 0.1, MID, 0.1];
    pet.pointer({ type: "down", time: MIN - 500, position: BODY, hit: "body" });
    pet.pointer({
      type: "move",
      time: MIN - 400,
      position: { x: BODY.x - 100, y: BODY.y },
      hit: "body",
    });

    const out = tick(pet, MIN);

    expect(out.snapshot.motion).toBe("dragging");
  });

  it("stops walking when picked up", () => {
    const pet = stroller();
    rolls = [0, 0.1, MID, 0.1];
    tick(pet, MIN);
    pet.pointer({ type: "down", time: MIN + 500, position: BODY, hit: "body" });

    const out = pet.pointer({
      type: "move",
      time: MIN + 600,
      position: { x: BODY.x - 100, y: BODY.y },
      hit: "body",
    });

    expect(out.snapshot.motion).toBe("pickedUp");
  });
});

describe("Fullscreen hiding and fps", () => {
  const MIN = 60_000;
  const at = (
    pet: ReturnType<typeof createPet>,
    now: number,
    input: Partial<Parameters<typeof pet.tick>[0]> = {}
  ) => pet.tick({ now, displays: [primary], ...input });

  it("hides while a foreground app is fullscreen and shows again after", () => {
    const { pet } = startedPet();

    expect(at(pet, 1000).snapshot.hidden).toBe(false);
    expect(at(pet, 2000, { fullscreen: true }).snapshot.hidden).toBe(true);
    expect(at(pet, 3000, { fullscreen: true }).snapshot.hidden).toBe(true);
    expect(at(pet, 4000, { fullscreen: false }).snapshot.hidden).toBe(false);
  });

  it("does not Chatter while hidden, and chatters once shown again", () => {
    const { pet } = startedPet();
    const hiddenSaid: string[] = [];
    for (let now = 1000; now <= 30 * MIN; now += 1000) {
      hiddenSaid.push(...said(at(pet, now, { fullscreen: true })));
    }

    expect(hiddenSaid).toEqual([]);
    expect(said(at(pet, 30 * MIN + 1000))).not.toEqual([]);
  });

  it.each([
    { why: "idle", input: {}, fps: 30 },
    { why: "fullscreen", input: { fullscreen: true }, fps: 0 },
    { why: "AFK for over 5 minutes", input: { afkSeconds: 301 }, fps: 10 },
    { why: "AFK for exactly 5 minutes", input: { afkSeconds: 300 }, fps: 30 },
    { why: "asleep at night", input: { hour: 23.5, afkSeconds: 181 }, fps: 10 },
  ])("suggests $fps fps when $why", ({ input, fps }) => {
    const { pet } = startedPet();

    expect(at(pet, 1000, input).snapshot.fps).toBe(fps);
  });

  it("suggests 60 fps while held, dragged and falling", () => {
    const { pet } = startedPet();
    const down = pet.pointer({
      type: "down",
      time: 1000,
      position: BODY,
      hit: "body",
    });
    const moved = pet.pointer({
      type: "move",
      time: 1100,
      position: { x: BODY.x + 40, y: BODY.y - 200 },
      hit: "body",
    });
    const dragging = at(pet, 2000);
    pet.pointer({
      type: "up",
      time: 2100,
      position: { x: BODY.x + 40, y: BODY.y - 200 },
      hit: "body",
    });
    const falling = at(pet, 2116);

    expect(down.snapshot.fps).toBe(60);
    expect(moved.snapshot.fps).toBe(60);
    expect(dragging.snapshot.fps).toBe(60);
    expect(falling.snapshot.motion).toBe("falling");
    expect(falling.snapshot.fps).toBe(60);
  });
});
