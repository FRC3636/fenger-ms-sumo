import adminHtml from "./admin.html";
import overlayHtml from "./overlay.html";

interface State {
  match: number;
  team1: number;
  team2: number;
  team1Name: string;
  team2Name: string;
  timerEnd: number | null;
  arrows: "up-down" | "down-up" | null; // random arrow direction shown between teams
}

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHvcIBxLcJXsAwEm-yEW7m2VmCZAbJvKOuxyNtVq6iA2CdtUJ_txUodlzgYQD1-hTiPCMiClrX0A3Z/pub?gid=1317889012&single=true&output=csv";

async function fetchSheetRow(): Promise<{ match: number; team1: number; team2: number; team1Name: string; team2Name: string } | null> {
  let text: string;
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }
  const lines = text.split("\n");
  // Skip header (index 0), find last row where Match # column is non-empty
  let lastRow: string[] | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i] ?? "");
    if (cols[0]?.trim()) lastRow = cols;
  }
  if (!lastRow) return null;
  const match = parseInt(lastRow[0] ?? "");
  const team1 = parseInt(lastRow[3] ?? "");        // Blue Team #1
  const team2 = parseInt(lastRow[10] ?? "");       // Red Team #1
  const team1Name = lastRow[5]?.trim() || "Blue";  // Robot Name (Blue)
  const team2Name = lastRow[12]?.trim() || "Red";  // Robot Name (Red)
  console.log("[sheet] cols 3,5,10,12:", lastRow[3], "|", lastRow[5], "|", lastRow[10], "|", lastRow[12]);
  if (isNaN(match) || isNaN(team1) || isNaN(team2)) return null;
  return { match, team1, team2, team1Name, team2Name };
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
};

const MATCH_DURATION_MS = 2 * 60 * 1000;

Bun.serve({
  routes: {
    "/": adminHtml,
    "/overlay": overlayHtml,

    "/api/state": {
      GET: () => Response.json(state),
      POST: async (req) => {
        let body: Partial<State>;
        try {
          body = await req.json() as Partial<State>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (typeof body.match === "number") state.match = body.match;
        if (typeof body.team1 === "number") state.team1 = body.team1;
        if (typeof body.team2 === "number") state.team2 = body.team2;
        if (typeof body.team1Name === "string") state.team1Name = body.team1Name;
        if (typeof body.team2Name === "string") state.team2Name = body.team2Name;
        state.arrows = Math.random() < 0.5 ? "up-down" : "down-up";
        return Response.json(state);
      },
    },

    "/api/start": {
      POST: () => {
        state.timerEnd = Date.now() + MATCH_DURATION_MS;
        state.arrows = null;
        return Response.json(state);
      },
    },

    "/api/end": {
      POST: () => {
        state.timerEnd = null;
        state.match++;
        return Response.json(state);
      },
    },

    "/api/reset": {
      POST: () => {
        state.timerEnd = null;
        return Response.json(state);
      },
    },

    "/api/sheet": {
      GET: async () => {
        try {
          const row = await fetchSheetRow();
          if (!row) return new Response("No data found in sheet", { status: 404 });
          return Response.json(row);
        } catch {
          return new Response("Sheet fetch failed", { status: 502 });
        }
      },
    },
  },
  development: { hmr: true, console: true },
});

console.log("Sumo server running at http://localhost:3000");
console.log("Admin UI:  http://localhost:3000/");
console.log("OBS overlay: http://localhost:3000/overlay");
