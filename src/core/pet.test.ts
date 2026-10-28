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
  it("adds 2 Affection and says a Line from the current Mood's pool", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hitBody: true });
    const out = pet.pointer({
      type: "up",
      time: 1100,
      position: BODY,
      hitBody: true,
    });

    expect(out.snapshot.affection).toBe(started.snapshot.affection + 2);
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

      pet.pointer({ type: "down", time: 1000, position: BODY, hitBody: true });
      pet.pointer({ type: "move", time: 1050, position: to, hitBody: true });
      const out = pet.pointer({
        type: "up",
        time: 1100,
        position: to,
        hitBody: true,
      });

      expect(said(out)).toHaveLength(isClick ? 1 : 0);
      expect(out.snapshot.affection).toBe(
        started.snapshot.affection + (isClick ? 2 : 0)
      );
    }
  );

  it.each([
    { held: 900, isClick: true },
    { held: 1000, isClick: false },
  ])("releasing after $held ms: Click = $isClick", ({ held, isClick }) => {
    const { pet } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hitBody: true });
    const out = pet.pointer({
      type: "up",
      time: 1000 + held,
      position: BODY,
      hitBody: true,
    });

    expect(said(out)).toHaveLength(isClick ? 1 : 0);
  });

  it("becomes happy and says happy Lines once Affection reaches 75", () => {
    const { pet } = startedPet({
      lines: lines({ normal: ["n"], happy: ["h"] }),
    });

    const outputs = Array.from({ length: 13 }, () => click(pet));

    // 預設 50，每次 +2：第 12 次 74 仍 normal，第 13 次 76 轉 happy。
    expect(outputs[11]?.snapshot.mood).toBe("normal");
    expect(said(outputs[11]!)).toEqual(["n"]);
    expect(outputs[12]?.snapshot.mood).toBe("happy");
    expect(said(outputs[12]!)).toEqual(["h"]);
  });

  it("ignores presses that start off the body", () => {
    const { pet, started } = startedPet();

    pet.pointer({ type: "down", time: 1000, position: BODY, hitBody: false });
    const out = pet.pointer({
      type: "up",
      time: 1100,
      position: BODY,
      hitBody: true,
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

let clock = 10_000;
function click(pet: ReturnType<typeof createPet>): PetOutput {
  clock += 5_000;
  pet.pointer({ type: "down", time: clock, position: BODY, hitBody: true });
  return pet.pointer({
    type: "up",
    time: clock + 100,
    position: BODY,
    hitBody: true,
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
