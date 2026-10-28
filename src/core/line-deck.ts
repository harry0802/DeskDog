import type { LineLibrary, LinePool } from "./pet";

export interface LineDecks {
  /** 洗牌後依序抽，抽完才重洗；重洗後第一句不等於上一句。 */
  draw(pool: LinePool): string;
}

export function createLineDecks(
  lines: LineLibrary,
  random: () => number
): LineDecks {
  const decks = new Map<LinePool, string[]>();
  const last = new Map<LinePool, string>();

  function shuffle(pool: LinePool): string[] {
    const deck = [...lines[pool]];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    if (deck.length > 1 && deck[0] === last.get(pool)) {
      [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1]!, deck[0]!];
    }
    return deck;
  }

  return {
    draw(pool) {
      let deck = decks.get(pool);
      if (!deck?.length) {
        deck = shuffle(pool);
        decks.set(pool, deck);
      }
      const line = deck.shift() ?? "";
      last.set(pool, line);
      return line;
    },
  };
}
