import { describe, expect, it } from "vitest";
import { createPet, type Display } from "./pet";

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

describe("start", () => {
  it("places the pet on the Ground at the bottom-right of the primary display", () => {
    const pet = createPet({ random: () => 0.5 });

    const { snapshot } = pet.start({ now: 0, displays: [secondary, primary] });

    expect(snapshot.displayId).toBe(primary.id);
    expect(snapshot.position.y).toBe(1392);
    expect(snapshot.position.x).toBeGreaterThan(2560 - 300);
    expect(snapshot.position.x).toBeLessThan(2560);
  });
});
