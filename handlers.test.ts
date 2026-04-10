import { describe, test, expect } from "bun:test";
import {
  type State,
  type AppsScriptResponse,
  MATCH_DURATION_MS,
  mapSheetData,
  applyStateUpdate,
  applyStart,
  applyEnd,
  applyReset,
  applyWinner,
} from "./handlers";

const baseState: State = {
  match: 1,
  team1: 10,
  team2: 20,
  team1Name: "Blue",
  team2Name: "Red",
  timerEnd: null,
  arrows: null,
  winner: null,
  ondeck1: null,
  ondeck2: null,
};

const fullSheet: AppsScriptResponse = {
  matchNumber: 5,
  blueTeamNumber: 123,
  redTeamNumber: 456,
  blueTeamName: "Sparky",
  redTeamName: "Chomper",
  blueTeamMembers: "Alice, Bob",
  redTeamMembers: "Carol, Dave",
  blueOnDeck: 789,
  redOnDeck: 999,
};

// --- mapSheetData ---

describe("mapSheetData", () => {
  test("maps a full response", () => {
    const row = mapSheetData(fullSheet);
    expect(row).toEqual({
      match: 5,
      team1: 123,
      team2: 456,
      team1Name: "Sparky",
      team2Name: "Chomper",
      team1Members: "Alice, Bob",
      team2Members: "Carol, Dave",
      ondeck1: 789,
      ondeck2: 999,
    });
  });

  test("returns null if matchNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, matchNumber: 0 })).toBeNull();
  });

  test("returns null if blueTeamNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, blueTeamNumber: 0 })).toBeNull();
  });

  test("returns null if redTeamNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, redTeamNumber: 0 })).toBeNull();
  });

  test("falls back to 'Blue'/'Red' when names are empty", () => {
    const row = mapSheetData({ ...fullSheet, blueTeamName: "", redTeamName: "" });
    expect(row?.team1Name).toBe("Blue");
    expect(row?.team2Name).toBe("Red");
  });

  test("ondeck is null when zero", () => {
    const row = mapSheetData({ ...fullSheet, blueOnDeck: 0, redOnDeck: 0 });
    expect(row?.ondeck1).toBeNull();
    expect(row?.ondeck2).toBeNull();
  });
});

// --- applyStateUpdate ---

describe("applyStateUpdate", () => {
  test("updates provided fields", () => {
    const next = applyStateUpdate(baseState, { match: 3, team1: 11, team1Name: "Voltage" }, "up-down");
    expect(next.match).toBe(3);
    expect(next.team1).toBe(11);
    expect(next.team1Name).toBe("Voltage");
    expect(next.team2).toBe(20); // unchanged
  });

  test("sets arrows to the provided value", () => {
    expect(applyStateUpdate(baseState, {}, "up-down").arrows).toBe("up-down");
    expect(applyStateUpdate(baseState, {}, "down-up").arrows).toBe("down-up");
  });

  test("clears winner", () => {
    const withWinner = { ...baseState, winner: "team1" as const };
    expect(applyStateUpdate(withWinner, {}, "up-down").winner).toBeNull();
  });

  test("ignores non-numeric team values", () => {
    const next = applyStateUpdate(baseState, { team1: "bad" as any }, "up-down");
    expect(next.team1).toBe(10); // unchanged
  });

  test("updates ondeck fields", () => {
    const next = applyStateUpdate(baseState, { ondeck1: 77, ondeck2: 88 }, "up-down");
    expect(next.ondeck1).toBe(77);
    expect(next.ondeck2).toBe(88);
  });

  test("does not mutate the original state", () => {
    applyStateUpdate(baseState, { match: 99 }, "up-down");
    expect(baseState.match).toBe(1);
  });
});

// --- applyStart ---

describe("applyStart", () => {
  test("sets timerEnd to now + MATCH_DURATION_MS", () => {
    const now = 1_000_000;
    const next = applyStart(baseState, now);
    expect(next.timerEnd).toBe(now + MATCH_DURATION_MS);
  });

  test("clears arrows and winner", () => {
    const active = { ...baseState, arrows: "up-down" as const, winner: "team2" as const };
    const next = applyStart(active, Date.now());
    expect(next.arrows).toBeNull();
    expect(next.winner).toBeNull();
  });

  test("does not mutate the original state", () => {
    applyStart(baseState, Date.now());
    expect(baseState.timerEnd).toBeNull();
  });
});

// --- applyEnd ---

describe("applyEnd", () => {
  test("clears timerEnd but preserves winner", () => {
    const active = { ...baseState, timerEnd: Date.now() + 10000, winner: "team1" as const };
    const next = applyEnd(active);
    expect(next.timerEnd).toBeNull();
    expect(next.winner).toBe("team1");
  });

  test("preserves other fields", () => {
    const next = applyEnd({ ...baseState, match: 7 });
    expect(next.match).toBe(7);
  });
});

// --- applyReset ---

describe("applyReset", () => {
  test("clears timerEnd and winner", () => {
    const active = { ...baseState, timerEnd: Date.now() + 5000, winner: "team2" as const };
    const next = applyReset(active);
    expect(next.timerEnd).toBeNull();
    expect(next.winner).toBeNull();
  });

  test("preserves team and match info", () => {
    const next = applyReset({ ...baseState, match: 4, team1: 55 });
    expect(next.match).toBe(4);
    expect(next.team1).toBe(55);
  });
});

// --- applyWinner ---

describe("applyWinner", () => {
  test("sets winner=team1 and clears timer", () => {
    const active = { ...baseState, timerEnd: Date.now() + 30000 };
    const result = applyWinner(active, "team1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe("team1");
    expect(result.state.timerEnd).toBeNull();
  });

  test("sets winner=team2", () => {
    const result = applyWinner(baseState, "team2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe("team2");
  });

  test("rejects invalid winner value", () => {
    const result = applyWinner(baseState, "team3");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/team1 or team2/);
  });

  test("rejects empty string", () => {
    expect(applyWinner(baseState, "").ok).toBe(false);
  });

  test("does not mutate the original state", () => {
    applyWinner(baseState, "team1");
    expect(baseState.winner).toBeNull();
  });
});
