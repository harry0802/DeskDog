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
      expect(out.snapshot.affection).toBe(started.snapshot.affection);
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

const tick = (pet: ReturnType<typeof createPet>, now: number) =>
  pet.tick({ now, displays: [primary] });

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
