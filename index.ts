import adminHtml from "./admin.html";
import overlayHtml from "./overlay.html";

interface State {
  match: number;
  team1: number;
  team2: number;
  timerEnd: number | null;
  arrows: "up-down" | "down-up" | null; // random arrow direction shown between teams
}

const state: State = {
  match: 1,
  team1: 1,
  team2: 2,
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
        const body = await req.json() as Partial<State>;
        if (typeof body.match === "number") state.match = body.match;
        if (typeof body.team1 === "number") state.team1 = body.team1;
        if (typeof body.team2 === "number") state.team2 = body.team2;
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
  },
  development: { hmr: true, console: true },
});

console.log("Sumo server running at http://localhost:3000");
console.log("Admin UI:  http://localhost:3000/");
console.log("OBS overlay: http://localhost:3000/overlay");
