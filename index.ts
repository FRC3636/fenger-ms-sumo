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
  try {
    const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}-${Math.random()}`, { cache: "no-store" });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
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
  if (!lastRow) return null;
  const match = parseInt(lastRow[0] ?? "");
  const team1 = parseInt(lastRow[3] ?? "");        // Blue Team #1
  const team2 = parseInt(lastRow[10] ?? "");       // Red Team #1
  const team1Name = lastRow[5]?.trim() || "Blue";  // Robot Name (Blue)
  const team2Name = lastRow[12]?.trim() || "Red";  // Robot Name (Red)
  const team1Members = lastRow[4]?.trim() || "";   // Team Members (Blue Team #1)
  const team2Members = lastRow[11]?.trim() || "";  // Team Members (Red Team #1)
  console.log("[sheet] cols 3,5,10,12:", lastRow[3], "|", lastRow[5], "|", lastRow[10], "|", lastRow[12]);
  if (isNaN(match) || isNaN(team1) || isNaN(team2)) return null;
  return { match, team1, team2, team1Name, team2Name, team1Members, team2Members };
}

async function fetchOnDeckRows(): Promise<{ ondeck1: number; ondeck1Name: string; ondeck2: number; ondeck2Name: string } | null> {
  let text: string;
  try {
    const res = await fetch(`${ONDECK_CSV_URL}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }
  const lines = text.split("\n").filter(l => l.trim());
  // lines[0] = header, lines[1] = red (ondeck2), lines[2] = blue (ondeck1)
  if (lines.length < 3) return null;
  const redRow = parseCSVRow(lines[1] ?? "");
  const blueRow = parseCSVRow(lines[2] ?? "");
  const ondeck2 = parseInt(redRow[4] ?? "");
  const ondeck2Name = redRow[5]?.trim() || "Red";
  const ondeck1 = parseInt(blueRow[4] ?? "");
  const ondeck1Name = blueRow[5]?.trim() || "Blue";
  if (isNaN(ondeck1) || isNaN(ondeck2)) return null;
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
        state.winner = null;
        return Response.json(state);
      },
    },

    "/api/start": {
      POST: () => {
        state.timerEnd = Date.now() + MATCH_DURATION_MS;
        state.arrows = null;
        state.winner = null;
        return Response.json(state);
      },
    },

    "/api/end": {
      POST: () => {
        state.timerEnd = null;
        state.winner = null;
        return Response.json(state);
      },
    },

    "/api/reset": {
      POST: () => {
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
          return new Response("Invalid JSON", { status: 400 });
        }
        if (body.winner !== "team1" && body.winner !== "team2") {
          return new Response("winner must be team1 or team2", { status: 400 });
        }
        state.winner = body.winner;
        state.timerEnd = null;
        return Response.json(state);
      },
    },

    "/api/sheet": {
      GET: async () => {
        try {
          const [row1, row2] = await Promise.all([fetchSheetRow(), fetchSheetRow()]);
          const best = [row1, row2]
            .filter(r => r !== null)
            .reduce<typeof row1>((a, b) => (b!.match > a!.match ? b : a), row1);
          if (!best) return new Response("No data found in sheet", { status: 404 });
          return Response.json(best);
        } catch {
          return new Response("Sheet fetch failed", { status: 502 });
        }
      },
    },

    "/api/ondeck": {
      POST: async () => {
        try {
          const data = await fetchOnDeckRows();
          if (!data) return new Response("No on-deck data found", { status: 404 });
          state.ondeck1 = data.ondeck1;
          state.ondeck2 = data.ondeck2;
          return Response.json(data);
        } catch {
          return new Response("On-deck fetch failed", { status: 502 });
        }
      },
    },
  },
  development: { hmr: true, console: true },
});

console.log("Sumo server running at http://localhost:3000");
console.log("Admin UI:  http://localhost:3000/");
console.log("OBS overlay: http://localhost:3000/overlay");
