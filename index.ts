import adminHtml from "./admin.html";
import overlayHtml from "./overlay.html";
import {
  type State,
  type AppsScriptResponse,
  MATCH_DURATION_MS as _MATCH_DURATION_MS,
  mapSheetData,
  applyStateUpdate,
  applyStart,
  applyEnd,
  applyReset,
  applyWinner,
} from "./handlers";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

function ts() {
  return `${DIM}${new Date().toISOString()}${RESET}`;
}

function log(tag: string, color: string, ...args: unknown[]) {
  console.log(`${ts()} ${color}${BOLD}[${tag}]${RESET}`, ...args);
}

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwmPKewvI1HA34cuwx9tl2YprifSiiyPXuiBrv6Orxv-xcuPk0oNSTn3VS3rHg7GKJIQA/exec?token=fengermanagementsystem";

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

async function fetchSheetRow() {
  const data = await fetchAppsScript();
  if (!data) return null;
  const row = mapSheetData(data);
  if (!row) log("sheet", RED, "missing required fields in response");
  return row;
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
        const arrows = Math.random() < 0.5 ? "up-down" : "down-up" as const;
        Object.assign(state, applyStateUpdate(state, body, arrows));
        log("api", YELLOW, `POST /api/state  match=${prev.match}→${state.match}  blue=${prev.team1} "${prev.team1Name}"→${state.team1} "${state.team1Name}"  red=${prev.team2} "${prev.team2Name}"→${state.team2} "${state.team2Name}"  arrows=${state.arrows}`);
        return Response.json(state);
      },
    },

    "/api/start": {
      POST: () => {
        Object.assign(state, applyStart(state, Date.now()));
        const endsAt = new Date(state.timerEnd!).toISOString();
        log("api", GREEN, `POST /api/start  match=${state.match}  blue=${state.team1} "${state.team1Name}" vs red=${state.team2} "${state.team2Name}"  timer ends at ${endsAt}`);
        return Response.json(state);
      },
    },

    "/api/end": {
      POST: () => {
        log("api", YELLOW, `POST /api/end  match=${state.match}  clearing timer and winner`);
        Object.assign(state, applyEnd(state));
        return Response.json(state);
      },
    },

    "/api/reset": {
      POST: () => {
        log("api", YELLOW, `POST /api/reset  match=${state.match}  resetting timer`);
        Object.assign(state, applyReset(state));
        return Response.json(state);
      },
    },

    "/api/winner": {
      POST: async (req) => {
        let body: { winner: string };
        try {
          body = await req.json() as { winner: string };
        } catch {
          log("api", RED, "POST /api/winner — invalid JSON");
          return new Response("Invalid JSON", { status: 400 });
        }
        const result = applyWinner(state, body.winner);
        if (!result.ok) {
          log("api", RED, `POST /api/winner — bad value: ${body.winner}`);
          return new Response(result.error, { status: 400 });
        }
        Object.assign(state, result.state);
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
          log("api", GREEN, `GET /api/sheet — match=${row.match}  blue=${row.team1} "${row.team1Name}"  red=${row.team2} "${row.team2Name}"  ondeck blue=${row.ondeck1} red=${row.ondeck2}`);
          return Response.json(row);
        } catch (err) {
          log("api", RED, "GET /api/sheet — exception:", err);
          return new Response("Sheet fetch failed", { status: 502 });
        }
      },
    },
  },
  development: { hmr: true, console: true },
});

log("server", GREEN, `${BOLD}Sumo server running at http://localhost:3000`);
log("server", GREEN, `  Admin UI:    http://localhost:3000/`);
log("server", GREEN, `  OBS overlay: http://localhost:3000/overlay`);
