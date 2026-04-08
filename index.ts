import adminHtml from "./admin.html";
import overlayHtml from "./overlay.html";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

function ts() {
  return `${DIM}${new Date().toISOString()}${RESET}`;
}

function log(tag: string, color: string, ...args: unknown[]) {
  console.log(`${ts()} ${color}${BOLD}[${tag}]${RESET}`, ...args);
}

interface State {
  match: number;
  team1: number;
  team2: number;
  team1Name: string;
  team2Name: string;
  timerEnd: number | null;
  arrows: "up-down" | "down-up" | null; // random arrow direction shown between teams
  winner: "team1" | "team2" | null;
  ondeck1: number | null; // blue on-deck team number
  ondeck2: number | null; // red on-deck team number
}

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwmPKewvI1HA34cuwx9tl2YprifSiiyPXuiBrv6Orxv-xcuPk0oNSTn3VS3rHg7GKJIQA/exec?token=fengermanagementsystem";

interface AppsScriptResponse {
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

async function fetchAppsScript(): Promise<AppsScriptResponse | null> {
  log("sheet", CYAN, "fetching data from Apps Script...");
  try {
    const res = await fetch(APPS_SCRIPT_URL, { redirect: "follow" });
    if (!res.ok) {
      log("sheet", RED, `HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json() as AppsScriptResponse;
    log("sheet", CYAN, `match=${data.matchNumber}  blue=${data.blueTeamNumber} "${data.blueTeamName}"  red=${data.redTeamNumber} "${data.redTeamName}"  ondeck blue=${data.blueOnDeck} red=${data.redOnDeck}`);
    return data;
  } catch (err) {
    log("sheet", RED, "fetch error:", err);
    return null;
  }
}

async function fetchSheetRow(): Promise<{ match: number; team1: number; team2: number; team1Name: string; team2Name: string; team1Members: string; team2Members: string } | null> {
  const data = await fetchAppsScript();
  if (!data) return null;
  const { matchNumber: match, blueTeamNumber: team1, redTeamNumber: team2 } = data;
  if (!match || !team1 || !team2) {
    log("sheet", RED, "missing required fields in response");
    return null;
  }
  return {
    match,
    team1,
    team2,
    team1Name: data.blueTeamName || "Blue",
    team2Name: data.redTeamName || "Red",
    team1Members: data.blueTeamMembers || "",
    team2Members: data.redTeamMembers || "",
  };
}

async function fetchOnDeckRows(): Promise<{ ondeck1: number; ondeck1Name: string; ondeck2: number; ondeck2Name: string } | null> {
  const data = await fetchAppsScript();
  if (!data) return null;
  const ondeck1 = data.blueOnDeck;
  const ondeck2 = data.redOnDeck;
  if (!ondeck1 || !ondeck2) {
    log("ondeck", RED, `missing on-deck fields — blue=${ondeck1} red=${ondeck2}`);
    return null;
  }
  log("ondeck", MAGENTA, `blue on-deck=${ondeck1}  red on-deck=${ondeck2}`);
  return { ondeck1, ondeck1Name: "", ondeck2, ondeck2Name: "" };
}

const state: State = {
  match: 1,
  team1: 1,
  team2: 2,
  team1Name: "Blue",
  team2Name: "Red",
  timerEnd: null,
  arrows: null,
  winner: null,
  ondeck1: null,
  ondeck2: null,
};

const MATCH_DURATION_MS = 2 * 60 * 1000;

Bun.serve({
  routes: {
    "/": adminHtml,
    "/overlay": overlayHtml,

    "/api/state": {
      GET: () => {
        log("api", DIM, "GET /api/state");
        return Response.json(state);
      },
      POST: async (req) => {
        let body: Partial<State>;
        try {
          body = await req.json() as Partial<State>;
        } catch {
          log("api", RED, "POST /api/state — invalid JSON");
          return new Response("Invalid JSON", { status: 400 });
        }
        const prev = { match: state.match, team1: state.team1, team2: state.team2, team1Name: state.team1Name, team2Name: state.team2Name };
        if (typeof body.match === "number") state.match = body.match;
        if (typeof body.team1 === "number") state.team1 = body.team1;
        if (typeof body.team2 === "number") state.team2 = body.team2;
        if (typeof body.team1Name === "string") state.team1Name = body.team1Name;
        if (typeof body.team2Name === "string") state.team2Name = body.team2Name;
        state.arrows = Math.random() < 0.5 ? "up-down" : "down-up";
        state.winner = null;
        log("api", YELLOW, `POST /api/state  match=${prev.match}→${state.match}  blue=${prev.team1} "${prev.team1Name}"→${state.team1} "${state.team1Name}"  red=${prev.team2} "${prev.team2Name}"→${state.team2} "${state.team2Name}"  arrows=${state.arrows}`);
        return Response.json(state);
      },
    },

    "/api/start": {
      POST: () => {
        state.timerEnd = Date.now() + MATCH_DURATION_MS;
        state.arrows = null;
        state.winner = null;
        const endsAt = new Date(state.timerEnd).toISOString();
        log("api", GREEN, `POST /api/start  match=${state.match}  blue=${state.team1} "${state.team1Name}" vs red=${state.team2} "${state.team2Name}"  timer ends at ${endsAt}`);
        return Response.json(state);
      },
    },

    "/api/end": {
      POST: () => {
        log("api", YELLOW, `POST /api/end  match=${state.match}  clearing timer and winner`);
        state.timerEnd = null;
        state.winner = null;
        return Response.json(state);
      },
    },

    "/api/reset": {
      POST: () => {
        log("api", YELLOW, `POST /api/reset  match=${state.match}  resetting timer`);
        state.timerEnd = null;
        state.winner = null;
        return Response.json(state);
      },
    },

    "/api/winner": {
      POST: async (req) => {
        let body: { winner: "team1" | "team2" };
        try {
          body = await req.json() as { winner: "team1" | "team2" };
        } catch {
          log("api", RED, "POST /api/winner — invalid JSON");
          return new Response("Invalid JSON", { status: 400 });
        }
        if (body.winner !== "team1" && body.winner !== "team2") {
          log("api", RED, `POST /api/winner — bad value: ${body.winner}`);
          return new Response("winner must be team1 or team2", { status: 400 });
        }
        state.winner = body.winner;
        state.timerEnd = null;
        const winnerTeam = body.winner === "team1" ? state.team1 : state.team2;
        const winnerName = body.winner === "team1" ? state.team1Name : state.team2Name;
        const side = body.winner === "team1" ? "BLUE" : "RED";
        log("api", GREEN, `POST /api/winner  match=${state.match}  ${BOLD}${side} WINS — team ${winnerTeam} "${winnerName}"${RESET}`);
        return Response.json(state);
      },
    },

    "/api/sheet": {
      GET: async () => {
        log("api", CYAN, "GET /api/sheet");
        try {
          const row = await fetchSheetRow();
          if (!row) {
            log("api", RED, "GET /api/sheet — no data found");
            return new Response("No data found in sheet", { status: 404 });
          }
          log("api", GREEN, `GET /api/sheet — returning match=${row.match}  blue=${row.team1} "${row.team1Name}"  red=${row.team2} "${row.team2Name}"`);
          return Response.json(row);
        } catch (err) {
          log("api", RED, "GET /api/sheet — exception:", err);
          return new Response("Sheet fetch failed", { status: 502 });
        }
      },
    },

    "/api/ondeck": {
      POST: async () => {
        log("api", MAGENTA, "POST /api/ondeck");
        try {
          const data = await fetchOnDeckRows();
          if (!data) {
            log("api", RED, "POST /api/ondeck — no data found");
            return new Response("No on-deck data found", { status: 404 });
          }
          state.ondeck1 = data.ondeck1;
          state.ondeck2 = data.ondeck2;
          log("api", GREEN, `POST /api/ondeck — blue=${data.ondeck1} "${data.ondeck1Name}"  red=${data.ondeck2} "${data.ondeck2Name}"`);
          return Response.json(data);
        } catch (err) {
          log("api", RED, "POST /api/ondeck — exception:", err);
          return new Response("On-deck fetch failed", { status: 502 });
        }
      },
    },
  },
  development: { hmr: true, console: true },
});

log("server", GREEN, `${BOLD}Sumo server running at http://localhost:3000`);
log("server", GREEN, `  Admin UI:    http://localhost:3000/`);
log("server", GREEN, `  OBS overlay: http://localhost:3000/overlay`);
