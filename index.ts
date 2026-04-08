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

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHvcIBxLcJXsAwEm-yEW7m2VmCZAbJvKOuxyNtVq6iA2CdtUJ_txUodlzgYQD1-hTiPCMiClrX0A3Z/pub?gid=1317889012&single=true&output=csv";

const ONDECK_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHvcIBxLcJXsAwEm-yEW7m2VmCZAbJvKOuxyNtVq6iA2CdtUJ_txUodlzgYQD1-hTiPCMiClrX0A3Z/pub?gid=1738939427&single=true&output=csv";

async function fetchSheetRow(): Promise<{ match: number; team1: number; team2: number; team1Name: string; team2Name: string; team1Members: string; team2Members: string } | null> {
  let text: string;
  log("sheet", CYAN, "fetching match sheet CSV...");
  try {
    const url = `${SHEET_CSV_URL}&t=${Date.now()}-${Math.random()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      log("sheet", RED, `HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    text = await res.text();
    log("sheet", CYAN, `got ${text.length} bytes, ${text.split("\n").length} lines`);
  } catch (err) {
    log("sheet", RED, "fetch error:", err);
    return null;
  }
  const lines = text.split("\n");
  // Skip header (index 0), find row with the highest Match # value
  let lastRow: string[] | null = null;
  let highestMatch = -Infinity;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i] ?? "");
    const matchNum = parseInt(cols[0] ?? "");
    if (!isNaN(matchNum) && matchNum > highestMatch) {
      highestMatch = matchNum;
      lastRow = cols;
    }
  }
  if (!lastRow) {
    log("sheet", RED, "no valid match rows found");
    return null;
  }
  const match = parseInt(lastRow[0] ?? "");
  const team1 = parseInt(lastRow[3] ?? "");        // Blue Team #1
  const team2 = parseInt(lastRow[10] ?? "");       // Red Team #1
  const team1Name = lastRow[5]?.trim() || "Blue";  // Robot Name (Blue)
  const team2Name = lastRow[12]?.trim() || "Red";  // Robot Name (Red)
  const team1Members = lastRow[4]?.trim() || "";   // Team Members (Blue Team #1)
  const team2Members = lastRow[11]?.trim() || "";  // Team Members (Red Team #1)
  log("sheet", CYAN, `match=${match}  blue=${team1} "${team1Name}" [${team1Members}]  red=${team2} "${team2Name}" [${team2Members}]`);
  if (isNaN(match) || isNaN(team1) || isNaN(team2)) {
    log("sheet", RED, "parsed NaN values — discarding row");
    return null;
  }
  return { match, team1, team2, team1Name, team2Name, team1Members, team2Members };
}

async function fetchOnDeckRows(): Promise<{ ondeck1: number; ondeck1Name: string; ondeck2: number; ondeck2Name: string } | null> {
  let text: string;
  log("ondeck", MAGENTA, "fetching on-deck sheet CSV...");
  try {
    const res = await fetch(`${ONDECK_CSV_URL}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      log("ondeck", RED, `HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    text = await res.text();
    log("ondeck", MAGENTA, `got ${text.length} bytes`);
  } catch (err) {
    log("ondeck", RED, "fetch error:", err);
    return null;
  }
  const lines = text.split("\n").filter(l => l.trim());
  // lines[0] = header, lines[1] = red (ondeck2), lines[2] = blue (ondeck1)
  if (lines.length < 3) {
    log("ondeck", RED, `not enough rows (got ${lines.length}, need 3)`);
    return null;
  }
  const redRow = parseCSVRow(lines[1] ?? "");
  const blueRow = parseCSVRow(lines[2] ?? "");
  const ondeck2 = parseInt(redRow[4] ?? "");
  const ondeck2Name = redRow[5]?.trim() || "Red";
  const ondeck1 = parseInt(blueRow[4] ?? "");
  const ondeck1Name = blueRow[5]?.trim() || "Blue";
  if (isNaN(ondeck1) || isNaN(ondeck2)) {
    log("ondeck", RED, `parsed NaN — ondeck1=${ondeck1} ondeck2=${ondeck2}`);
    return null;
  }
  log("ondeck", MAGENTA, `blue on-deck=${ondeck1} "${ondeck1Name}"  red on-deck=${ondeck2} "${ondeck2Name}"`);
  return { ondeck1, ondeck1Name, ondeck2, ondeck2Name };
}

// Simple CSV row parser that handles quoted fields with commas/newlines
function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
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
        log("api", CYAN, "GET /api/sheet — fetching twice in parallel...");
        try {
          const [row1, row2] = await Promise.all([fetchSheetRow(), fetchSheetRow()]);
          log("api", CYAN, `sheet parallel results: row1.match=${row1?.match ?? "null"}  row2.match=${row2?.match ?? "null"}`);
          const best = [row1, row2]
            .filter(r => r !== null)
            .reduce<typeof row1>((a, b) => (b!.match > a!.match ? b : a), row1);
          if (!best) {
            log("api", RED, "GET /api/sheet — no data found");
            return new Response("No data found in sheet", { status: 404 });
          }
          log("api", GREEN, `GET /api/sheet — returning match=${best.match}  blue=${best.team1} "${best.team1Name}"  red=${best.team2} "${best.team2Name}"`);
          return Response.json(best);
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
