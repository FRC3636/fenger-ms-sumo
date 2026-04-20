import adminHtml from "./admin.html";
import overlayHtml from "./overlay.html";
import {
  type State,
  type AppsScriptResponse,
  type RvbScoresResponse,
  mapSheetData,
  applyStateUpdate,
  applyStart,
  applyEnd,
  applyReset,
  applyWinner,
  normalizeRvbServerIp,
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

const TOKEN = "fengermanagementsystem";

const APPS_SCRIPT_BASE =
  "https://script.google.com/macros/s/AKfycbwmPKewvI1HA34cuwx9tl2YprifSiiyPXuiBrv6Orxv-xcuPk0oNSTn3VS3rHg7GKJIQA/exec";

const APPS_SCRIPT_URL = `${APPS_SCRIPT_BASE}?token=${TOKEN}`;
const RVB_SERVER_PORT = 8080;

const RVB_ACTIONS = [
  "start",
  "pause",
  "startTeleop",
  "clear",
  "redScoreUp",
  "redScoreDown",
  "blueScoreUp",
  "blueScoreDown",
  "redAutoUp",
  "redAutoDown",
  "blueAutoUp",
  "blueAutoDown",
  "redPenaltyUp",
  "redPenaltyDown",
  "bluePenaltyUp",
  "bluePenaltyDown",
] as const;

function getRvbBaseUrl(serverIp: string) {
  return `http://${normalizeRvbServerIp(serverIp)}:${RVB_SERVER_PORT}`;
}

async function fetchRvbScores(serverIp: string): Promise<RvbScoresResponse> {
  const baseUrl = getRvbBaseUrl(serverIp);
  const res = await fetch(`${baseUrl}/scores`);
  if (!res.ok) {
    throw new Error(`RVB /scores failed: HTTP ${res.status}`);
  }
  return await res.json() as RvbScoresResponse;
}

async function postRvbAction(serverIp: string, action: string, count = 1) {
  const baseUrl = getRvbBaseUrl(serverIp);
  const res = await fetch(`${baseUrl}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, count }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RVB /action failed: HTTP ${res.status} ${text}`);
  }
  return text;
}

async function fetchAppsScript(autoAddTeams = false): Promise<AppsScriptResponse | null> {
  const url = autoAddTeams ? `${APPS_SCRIPT_URL}&autoAddTeams=true` : APPS_SCRIPT_URL;
  log("sheet", CYAN, `fetching data from Apps Script...${autoAddTeams ? " (tournament mode)" : ""}`);
  try {
    const res = await fetch(url, { redirect: "follow" });
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

async function fetchSheetRow(autoAddTeams = false) {
  const data = await fetchAppsScript(autoAddTeams);
  if (!data) return null;
  const row = mapSheetData(data);
  if (!row) log("sheet", RED, "missing required fields in response");
  return row;
}


const state: State = {
  gameMode: "sumo",
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
  autoAddTeams: true,
  rvbBlue1: 1,
  rvbBlue2: 2,
  rvbRed1: 3,
  rvbRed2: 4,
  rvbServerIp: "localhost",
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
        const prev = { gameMode: state.gameMode, match: state.match, team1: state.team1, team2: state.team2, team1Name: state.team1Name, team2Name: state.team2Name };
        const updatesSumo =
          body.match !== undefined ||
          body.team1 !== undefined ||
          body.team2 !== undefined ||
          body.team1Name !== undefined ||
          body.team2Name !== undefined ||
          body.ondeck1 !== undefined ||
          body.ondeck2 !== undefined ||
          body.autoAddTeams !== undefined;
        const arrows: "up-down" | "down-up" | null = updatesSumo ? (Math.random() < 0.5 ? "up-down" : "down-up") : null;
        Object.assign(state, applyStateUpdate(state, body, arrows));
        log("api", YELLOW, `POST /api/state  mode=${prev.gameMode}→${state.gameMode}  match=${prev.match}→${state.match}  blue=${prev.team1} "${prev.team1Name}"→${state.team1} "${state.team1Name}"  red=${prev.team2} "${prev.team2Name}"→${state.team2} "${state.team2Name}"  rvbServer=${state.rvbServerIp}  arrows=${state.arrows}`);
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

    "/api/export": {
      POST: async (req) => {
        let body: { winner?: string } = {};
        try { body = await req.json() as { winner?: string }; } catch { /* optional body */ }
        const winner = body.winner ?? state.winner;
        const redWin = winner === "team2";
        log("api", CYAN, `POST /api/export  match=${state.match}  winner=${winner}  redWin=${redWin}`);
        try {
          const res = await fetch(APPS_SCRIPT_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: TOKEN, matchNumber: state.match, redWin }),
            redirect: "follow",
          });
          const text = await res.text();
          log("api", res.ok ? GREEN : RED, `POST /api/export — Apps Script responded: ${text}`);
          if (!res.ok) return new Response(text, { status: 502 });
          return new Response(text);
        } catch (err) {
          log("api", RED, "POST /api/export — fetch error:", err);
          return new Response("Export failed", { status: 502 });
        }
      },
    },

    "/api/sheet": {
      GET: async () => {
        log("api", CYAN, "GET /api/sheet");
        try {
          const row = await fetchSheetRow(state.autoAddTeams);
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

    "/api/rvb-scores": {
      GET: async () => {
        try {
          const data = await fetchRvbScores(state.rvbServerIp);
          return Response.json(data);
        } catch (err) {
          log("rvb", RED, "GET /api/rvb-scores failed:", err);
          return new Response("RVB scores fetch failed", { status: 502 });
        }
      },
    },

    "/api/rvb-actions": {
      GET: () => Response.json({ actions: RVB_ACTIONS }),
    },

    "/api/rvb-action": {
      POST: async (req) => {
        let body: { action?: string; count?: number } = {};
        try {
          body = await req.json() as { action?: string; count?: number };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body.action || !RVB_ACTIONS.includes(body.action as typeof RVB_ACTIONS[number])) {
          return Response.json({ error: "invalid action", validActions: RVB_ACTIONS }, { status: 400 });
        }
        const count = Number.isInteger(body.count) ? body.count! : 1;
        if (count < 1 || count > 100) {
          return Response.json({ error: "count must be an integer between 1 and 100" }, { status: 400 });
        }

        try {
          const responseText = await postRvbAction(state.rvbServerIp, body.action, count);
          log("rvb", GREEN, `POST /api/rvb-action  action=${body.action} count=${count} server=${state.rvbServerIp}`);
          return new Response(responseText);
        } catch (err) {
          log("rvb", RED, `POST /api/rvb-action failed for action=${body.action}:`, err);
          return new Response("RVB action failed", { status: 502 });
        }
      },
    },
  },
  development: { hmr: true, console: true },
});

log("server", GREEN, `${BOLD}Sumo server running at http://localhost:3000`);
log("server", GREEN, `  Admin UI:    http://localhost:3000/`);
log("server", GREEN, `  OBS overlay: http://localhost:3000/overlay`);
