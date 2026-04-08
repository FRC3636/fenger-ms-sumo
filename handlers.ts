export interface State {
  match: number;
  team1: number;
  team2: number;
  team1Name: string;
  team2Name: string;
  timerEnd: number | null;
  arrows: "up-down" | "down-up" | null;
  winner: "team1" | "team2" | null;
  ondeck1: number | null;
  ondeck2: number | null;
}

export interface AppsScriptResponse {
  matchNumber: number;
  blueTeamNumber: number;
  redTeamNumber: number;
  blueTeamName: string;
  redTeamName: string;
  blueTeamMembers: string;
  redTeamMembers: string;
  blueOnDeck: number;
  redOnDeck: number;
}

export const MATCH_DURATION_MS = 2 * 60 * 1000;

export function mapSheetData(data: AppsScriptResponse): {
  match: number; team1: number; team2: number;
  team1Name: string; team2Name: string;
  team1Members: string; team2Members: string;
  ondeck1: number | null; ondeck2: number | null;
} | null {
  const { matchNumber: match, blueTeamNumber: team1, redTeamNumber: team2 } = data;
  if (!match || !team1 || !team2) return null;
  return {
    match,
    team1,
    team2,
    team1Name: data.blueTeamName || "Blue",
    team2Name: data.redTeamName || "Red",
    team1Members: data.blueTeamMembers || "",
    team2Members: data.redTeamMembers || "",
    ondeck1: data.blueOnDeck || null,
    ondeck2: data.redOnDeck || null,
  };
}

export function applyStateUpdate(
  state: State,
  body: Partial<State>,
  arrows: "up-down" | "down-up",
): State {
  const next = { ...state };
  if (typeof body.match === "number") next.match = body.match;
  if (typeof body.team1 === "number") next.team1 = body.team1;
  if (typeof body.team2 === "number") next.team2 = body.team2;
  if (typeof body.team1Name === "string") next.team1Name = body.team1Name;
  if (typeof body.team2Name === "string") next.team2Name = body.team2Name;
  if (typeof body.ondeck1 === "number") next.ondeck1 = body.ondeck1;
  if (typeof body.ondeck2 === "number") next.ondeck2 = body.ondeck2;
  next.arrows = arrows;
  next.winner = null;
  return next;
}

export function applyStart(state: State, now: number): State {
  return { ...state, timerEnd: now + MATCH_DURATION_MS, arrows: null, winner: null };
}

export function applyEnd(state: State): State {
  return { ...state, timerEnd: null, winner: null };
}

export function applyReset(state: State): State {
  return { ...state, timerEnd: null, winner: null };
}

export function applyWinner(
  state: State,
  winner: string,
): { ok: true; state: State } | { ok: false; error: string } {
  if (winner !== "team1" && winner !== "team2") {
    return { ok: false, error: "winner must be team1 or team2" };
  }
  return {
    ok: true,
    state: { ...state, winner: winner as "team1" | "team2", timerEnd: null },
  };
}
